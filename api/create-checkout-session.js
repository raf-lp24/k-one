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

    // Modo oferta: primer mes a 0,99€. Modo normal: plan elegido en el paywall.
    const ofertaPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
    const usarOferta = !!oferta && !!ofertaPriceId;

    let priceId;
    if (usarOferta) {
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

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // C-2: buscar cliente existente en Stripe por metadata antes de crear uno nuevo,
    // para evitar duplicados si la misma request llega dos veces en paralelo.
    let customerId = existingSub?.stripe_customer_id;
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
      }

      await supabaseAdmin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });
    }

    // M-4: origen desde variable de entorno para evitar header Host manipulado
    const origin = process.env.APP_URL || `https://${req.headers.host}`;

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
      }
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[create-checkout-session] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message });
  }
};
