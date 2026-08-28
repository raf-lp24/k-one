const { getStripe, getSupabaseAdmin, getPriceId, getAuthUser } = require('./_stripeHelpers');
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

      // Si este upsert falla (p.ej. fallo transitorio de Supabase), la próxima
      // vez que este usuario pague no encontraremos su stripe_customer_id aquí
      // y, si tampoco lo localiza la búsqueda por metadata de más arriba (lag
      // de consistencia de Stripe justo tras crear el customer), se crearía UN
      // SEGUNDO Customer -- con su propio historial vacío, así que ese usuario
      // podría acabar con dos meses de prueba automáticos y dos suscripciones
      // cobrando en paralelo. No podemos evitar el 100% del caso (es una carrera
      // con la propia consistencia eventual de Stripe), pero como mínimo el
      // fallo debe quedar visible en vez de perderse en silencio.
      const { error: upsertErr } = await supabaseAdmin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });
      if (upsertErr) {
        console.error('[create-checkout-session] upsert stripe_customer_id falló:', upsertErr.message);
        capturarError(new Error(`upsert stripe_customer_id falló: ${upsertErr.message}`), { fn: 'create-checkout-session', userId: user.id, customerId });
      }
    }

    // SEGURIDAD: la oferta de primer mes (1,99€) y las promociones de bienvenida
    // solo valen para quien NUNCA ha tenido una suscripción. No basta con el flag
    // del cliente (sería manipulable): se verifica el historial real de Stripe.
    // Un customer recién creado no tiene historial, así que se salta la llamada.
    let tieneHistorial = false;
    let yaTieneActiva = false;
    if (!customerEraNuevo) {
      const prev = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      // incomplete_expired: intento de pago que nunca llegó a activarse (falló la
      // autenticación de la tarjeta, o la sesión de checkout expiró sin
      // completarse) -- no se le cobró nada ni tuvo nunca acceso. No debe contar
      // como "historial real": si contara, un cliente legítimo con un intento
      // fallido perdería para siempre la elegibilidad al mes de prueba
      // automático por un fallo que no tuvo nada que ver con abusar de la oferta.
      const historialReal = prev.data.filter(s => s.status !== 'incomplete_expired');
      tieneHistorial = historialReal.length > 0;
      yaTieneActiva = historialReal.some(s => ['active', 'trialing', 'past_due'].includes(s.status));
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

    // SEGURIDAD: candado anti doble-click/doble-pestaña. El guard de arriba
    // (yaTieneActiva) no sirve para esto: la suscripción real de Stripe solo
    // existe al COMPLETAR el checkout, no al crear la sesión, así que dos
    // peticiones casi simultáneas pasan las dos ese guard viendo 0
    // suscripciones y crean 2 sesiones (2 suscripciones reales si el cliente
    // completa ambas -- doble cobro). Este UPDATE...WHERE es atómico en
    // Postgres: con dos peticiones a la vez, la fila se bloquea a nivel de
    // fila y la segunda solo se ejecuta cuando la primera ya ha confirmado su
    // cambio, así que como mucho UNA de las dos ve la condición cumplida.
    // Expira solo a los 30s en vez de liberarse a mano al terminar: así una
    // función que se cuelga a medias no deja el candado pillado para siempre.
    {
      const ahora = new Date();
      const { data: lockRows, error: lockErr } = await supabaseAdmin
        .from('subscriptions')
        .update({ checkout_lock_until: new Date(ahora.getTime() + 30000).toISOString() })
        .eq('user_id', user.id)
        .or(`checkout_lock_until.is.null,checkout_lock_until.lt.${ahora.toISOString()}`)
        .select('user_id');
      if (lockErr) {
        console.warn('[create-checkout-session] no se pudo comprobar el candado de checkout:', lockErr.message);
      } else if (!lockRows || !lockRows.length) {
        // 0 filas afectadas: o hay un checkout en curso de verdad, o (más raro)
        // la fila de subscriptions no llegó a crearse antes (fallo del upsert
        // de más arriba). Se distingue para no bloquear por error a alguien
        // que en realidad no tiene ningún candado activo.
        const { data: fila } = await supabaseAdmin.from('subscriptions').select('user_id').eq('user_id', user.id).maybeSingle();
        if (fila) {
          return res.status(429).json({ error: 'Ya hay un pago en curso. Espera unos segundos e inténtalo de nuevo.' });
        }
      }
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

    // El metadata de la sesión NO se copia a la suscripción. Se propaga aquí para
    // que los eventos customer.subscription.* del webhook (renovación, descuento de
    // referidos) puedan identificar al usuario de Supabase directamente.
    //
    // PRIMER MES GRATIS AUTOMÁTICO: antes existían códigos promocionales (mes
    // gratis vía código, o % de descuento) además de esta lógica. Se retiraron
    // (2026-08): el único beneficio que queda es este, automático para todo
    // cliente sin historial real en Stripe, sin depender de que nadie escriba
    // ningún código. Se suscribe DIRECTAMENTE a su plan real desde el día 1,
    // con un periodo de prueba que retrasa el primer cobro.
    const diasPrueba = !tieneHistorial ? 30 : 0;
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
        periodicidad: periodicidad || ''
      },
      subscription_data: subscriptionData
    };

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
