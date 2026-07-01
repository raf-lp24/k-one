const { getStripe, getSupabaseAdmin, getPriceId, getAuthUser } = require('./_stripeHelpers');

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

    const { tipoPlan, periodicidad, oferta } = req.body;

    // Modo oferta: primer mes a 1,99€. Modo normal: plan elegido en el paywall.
    const ofertaPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
    const usarOferta = !!oferta && !!ofertaPriceId;

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

    let priceId;
    if (usarOferta) {
      // SEGURIDAD: la oferta de primer mes (1,99€) solo es válida para quien NUNCA ha
      // tenido una suscripción. No basta con el flag del cliente (sería manipulable):
      // se verifica el historial de Stripe del cliente. Un customer recién creado no
      // tiene historial, así que se salta la llamada.
      if (!customerEraNuevo) {
        const prev = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
        if (prev.data.length > 0) {
          return res.status(400).json({ error: 'La oferta de primer mes ya no está disponible para esta cuenta.' });
        }
      }
      priceId = ofertaPriceId;
    } else {
      // A-2 + B-2: getPriceId ya no hace fallback silencioso
      if (!tipoPlan || !periodicidad) {
        return res.status(400).json({ error: 'tipoPlan y periodicidad son obligatorios' });
      }
      priceId = getPriceId(tipoPlan, periodicidad);
      if (!priceId) {
        return res.status(400).json({ error: 'Plan o periodicidad no válidos' });
      }
    }

    const origin = process.env.APP_URL;
    if (!origin) return res.status(500).json({ error: 'APP_URL no configurada' });

    const session = await stripe.checkout.sessions.create({
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
        oferta: usarOferta ? 'si' : 'no'
      },
      // El metadata de la sesión NO se copia a la suscripción. Se propaga aquí para
      // que los eventos customer.subscription.* del webhook (renovación, descuento de
      // referidos) puedan identificar al usuario de Supabase directamente.
      subscription_data: {
        metadata: { supabase_user_id: user.id }
      }
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[create-checkout-session] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message });
  }
};
