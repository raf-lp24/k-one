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

  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations'
  });

  res.status(200).json({
    ok: true,
    currentPeriodEnd: updated.current_period_end
  });
};
