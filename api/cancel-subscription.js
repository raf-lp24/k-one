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
    .select('stripe_subscription_id, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    res.status(404).json({ error: 'No tienes una suscripción activa' });
    return;
  }

  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true
  });

  res.status(200).json({
    cancelAt: updated.cancel_at,
    currentPeriodEnd: updated.current_period_end
  });
};
