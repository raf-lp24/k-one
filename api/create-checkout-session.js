const { getStripe, getSupabaseAdmin, getPriceId, getAuthUser } = require('./_stripeHelpers');
const { resolverBeneficioPromo } = require('./_promo');
const { capturarError } = require('./_sentry');

// Crea una sesión de Stripe Checkout (suscripción) para el plan/periodicidad
// elegidos por el usuario logueado y devuelve la URL a la que redirigir.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // A-4: try/catch global — ningún error interno llega crudo al cliente
  try {
    // A-2: validar que el body es un objeto JSON parseado
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ error: 'Body JSON requerido' });
    }

    const stripe = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { tipoPlan, periodicidad } = req.body;

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // C-2: buscar cliente existente en Stripe por metadata antes de crear uno nuevo,
    // para evitar duplicados si la misma request llega dos veces en paralelo.
    // Se resuelve el customer ANTES de decidir el precio para poder verificar la
    // elegibilidad de la oferta contra el historial real de Stripe.
    let customerId = existingSub?.stripe_customer_id;
    let customerEraNuevo = false;
    if (!customerId) {
      const search = await stripe.customers.search({
        query: `metadata['supabase_user_id']:'${user.id}'`,
        limit: 1
      });
      customerId = search.data[0]?.id || null;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id }
        });
        customerId = customer.id;
        customerEraNuevo = true;
      }

      await supabaseAdmin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });
    }

    // SEGURIDAD: la oferta de primer mes (1,99€) y las promociones de bienvenida
    // solo valen para quien NUNCA ha tenido una suscripción. No basta con el flag
    // del cliente (sería manipulable): se verifica el historial real de Stripe.
    // Un customer recién creado no tiene historial, así que se salta la llamada.
    let tieneHistorial = false;
    let yaTieneActiva = false;
    if (!customerEraNuevo) {
      const prev = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      tieneHistorial = prev.data.length > 0;
      yaTieneActiva = prev.data.some(s => ['active', 'trialing', 'past_due'].includes(s.status));
    }

    // SEGURIDAD: si el cliente ya tiene una suscripción activa/en prueba/con pago
    // pendiente, no le dejamos crear una segunda. Sin este guard, dos clicks en
    // "empezar" (doble click, doble pestaña, o repetir la llamada) crean DOS
    // suscripciones reales en Stripe sobre el mismo customer -- doble cobro. Nuestra
    // sync (syncCustomerFromStripe) solo refleja "la mejor" en Supabase, así que el
    // problema pasaría desapercibido en el panel aunque Stripe siguiera cobrando
    // ambas. Para cambiar de plan ya existe update-subscription.js.
    if (yaTieneActiva) {
      return res.status(400).json({ error: 'Ya tienes una suscripción activa. Gestiona tu plan desde el panel de tu cuenta.' });
    }

    // A-2 + B-2: getPriceId ya no hace fallback silencioso
    if (!tipoPlan || !periodicidad) {
      return res.status(400).json({ error: 'tipoPlan y periodicidad son obligatorios' });
    }
    const priceId = getPriceId(tipoPlan, periodicidad);
    if (!priceId) {
      return res.status(400).json({ error: 'Plan o periodicidad no válidos' });
    }

    const origin = process.env.APP_URL;
    if (!origin) return res.status(500).json({ error: 'APP_URL no configurada' });

    // Código promocional (mes gratis o % de descuento). Se valida y se canjea
    // aquí, en el servidor: el navegador solo pudo guardar el código en el perfil.
    const promo = await resolverBeneficioPromo({
      supabaseAdmin, stripe, userId: user.id, tieneHistorial
    });

    // El metadata de la sesión NO se copia a la suscripción. Se propaga aquí para
    // que los eventos customer.subscription.* del webhook (renovación, descuento de
    // referidos) puedan identificar al usuario de Supabase directamente.
    //
    // PRIMER MES GRATIS AUTOMÁTICO: antes, el primer mes costaba 1,99€ de verdad
    // y un webhook programaba (subscriptionSchedule) el cambio al precio real un
    // mes después -- ese mecanismo se deja intacto para los clientes que ya
    // estaban dentro de esa oferta (metadata.oferta === 'si' en stripe-webhook.js),
    // pero ya no se usa para checkouts nuevos. Ahora, todo cliente sin historial
    // real en Stripe se suscribe DIRECTAMENTE a su plan real desde el día 1, con
    // un periodo de prueba que retrasa el primer cobro -- el mismo mecanismo que
    // ya usaba el código GRATIS1MES (trial_period_days), solo que automático para
    // todos y sin depender de que nadie escriba ningún código.
    const diasPrueba = (promo && promo.trialDays) ? promo.trialDays : (!tieneHistorial ? 30 : 0);
    const subscriptionData = { metadata: { supabase_user_id: user.id } };
    if (diasPrueba) subscriptionData.trial_period_days = diasPrueba;

    const params = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card'],
      success_url: `${origin}/?checkout=exito`,
      cancel_url:  `${origin}/?checkout=cancelado`,
      metadata: {
        supabase_user_id: user.id,
        tipoPlan:    tipoPlan    || '',
        periodicidad: periodicidad || '',
        codigo_promo: promo ? promo.codigo : ''
      },
      subscription_data: subscriptionData
    };
    if (promo && promo.couponId) params.discounts = [{ coupon: promo.couponId }];

    const session = await stripe.checkout.sessions.create(params);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[create-checkout-session] error:', err);
    capturarError(err, { fn: 'create-checkout-session' });
    const status = err.statusCode || 500;
    // Solo los errores de tarjeta de Stripe están pensados para mostrarse al
    // usuario tal cual; el resto (invalid_request_error, etc.) puede filtrar
    // detalles internos (IDs de objetos, configuración) que no son de nadie
    // más que del servidor.
    return res.status(status).json({ error: err.type === 'StripeCardError' ? err.message : 'Error interno del servidor' });
  }
};
