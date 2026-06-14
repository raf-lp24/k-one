const { getStripe, getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

// Crea una sesión del Portal de Clientes de Stripe para que el usuario
// gestione/cambie/cancele su suscripción y método de pago.
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

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    res.status(404).json({ error: 'No tienes una suscripción asociada todavía' });
    return;
  }

  const origin = `https://${req.headers.host}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/`
  });

  res.status(200).json({ url: session.url });
};
