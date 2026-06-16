const { getStripe, getSupabaseAdmin, getPriceId, getAuthUser } = require('./_stripeHelpers');

// Cambia el precio de la suscripción activa con prorrateo inmediato.
// Si es una subida de plan (ej: nutrición → completo), Stripe cobra la diferencia
// al momento. Si es una bajada, abona la diferencia en el próximo ciclo.
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

  const { tipoPlan, periodicidad } = req.body || {};
  const newPriceId = getPriceId(tipoPlan, periodicidad);
  if (!newPriceId) {
    res.status(400).json({ error: 'Plan o periodicidad no válidos' });
    return;
  }

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    res.status(404).json({ error: 'No tienes una suscripción activa para actualizar' });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

  if (!['active', 'trialing'].includes(subscription.status)) {
    res.status(400).json({ error: 'La suscripción no está activa' });
    return;
  }

  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    res.status(500).json({ error: 'No se encontró el ítem de la suscripción' });
    return;
  }

  // Si ya tiene ese precio, no hacemos nada
  const currentPriceId = subscription.items.data[0]?.price?.id;
  if (currentPriceId === newPriceId) {
    res.status(200).json({ ok: true, noChange: true });
    return;
  }

  const updateParams = {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations'
  };
  // Si la suscripción estaba programada para cancelarse, mantener esa cancelación
  // al cambiar el precio. Sin esto, el update borraría cancel_at_period_end=true.
  if (subscription.cancel_at_period_end) {
    updateParams.cancel_at_period_end = true;
  }
  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, updateParams);

  res.status(200).json({
    ok: true,
    currentPeriodEnd: updated.current_period_end
  });
};
