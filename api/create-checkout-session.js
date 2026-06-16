const { getStripe, getSupabaseAdmin, getPriceId, getAuthUser } = require('./_stripeHelpers');

// Crea una sesión de Stripe Checkout (suscripción) para el plan/periodicidad
// elegidos por el usuario logueado y devuelve la URL a la que redirigir.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();

  const user = await getAuthUser(req, supabaseAdmin);
  if (!user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const { tipoPlan, periodicidad, oferta } = req.body || {};
  // Modo "oferta": primer mes a 0,99€ (STRIPE_PRICE_OFERTA_MES). El plan definitivo
  // (mensual/trimestral/anual/nutrición) se elige al terminar el mes, en el paywall.
  // Modo normal (paywall de fin de mes): se cobra directamente el plan elegido.
  const ofertaPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
  const usarOferta = !!oferta && !!ofertaPriceId;

  let priceId;
  if (usarOferta) {
    priceId = ofertaPriceId;
  } else {
    priceId = getPriceId(tipoPlan, periodicidad);
    if (!priceId) {
      res.status(400).json({ error: 'Plan o periodicidad no válidos' });
      return;
    }
  }

  // Reutiliza el cliente de Stripe si ya existe uno para este usuario.
  const { data: existingSub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let customerId = existingSub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id }
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('subscriptions')
      .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });
  }

  const origin = `https://${req.headers.host}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_types: ['card'], // solo tarjeta (incluye Apple Pay / Google Pay); sin Klarna, PayPal ni SEPA
    success_url: `${origin}/?checkout=exito`,
    cancel_url: `${origin}/?checkout=cancelado`,
    metadata: {
      supabase_user_id: user.id,
      tipoPlan: tipoPlan || '',
      periodicidad: periodicidad || '',
      oferta: usarOferta ? 'si' : 'no'
    }
  });

  res.status(200).json({ url: session.url });
};
