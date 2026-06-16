const { getStripe, getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

// Cancela la suscripción al final del período actual (cancel_at_period_end: true).
// La cuenta sigue activa hasta current_period_end; no se renueva después.
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
    .select('stripe_subscription_id, stripe_customer_id, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  // Resiliencia: si el webhook no guardó el id de la suscripción, búscala en
  // Stripe por el id de cliente para no impedir la cancelación.
  let subscriptionId = sub?.stripe_subscription_id;
  if (!subscriptionId && sub?.stripe_customer_id) {
    const lista = await stripe.subscriptions.list({ customer: sub.stripe_customer_id, status: 'all', limit: 10 });
    const activa = lista.data.find(s => ['active', 'trialing'].includes(s.status));
    subscriptionId = activa?.id || null;
  }

  if (!subscriptionId) {
    res.status(404).json({ error: 'No tienes una suscripción activa' });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!['active', 'trialing'].includes(subscription.status)) {
    res.status(400).json({ error: 'La suscripción no está activa' });
    return;
  }

  if (subscription.cancel_at_period_end) {
    res.status(200).json({
      ok: true,
      alreadyCancelled: true,
      cancelAt: subscription.cancel_at,
      currentPeriodEnd: subscription.current_period_end
    });
    return;
  }

  const updated = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });

  res.status(200).json({
    ok: true,
    cancelAt: updated.cancel_at,
    currentPeriodEnd: updated.current_period_end
  });
};
