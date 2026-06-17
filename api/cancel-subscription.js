const {
  getStripe, getSupabaseAdmin, getAuthUser,
  getActiveSubscriptionId, assertSubscriptionOwnership
} = require('./_stripeHelpers');

// Cancela la suscripción al final del período actual (cancel_at_period_end: true).
// La cuenta sigue activa hasta current_period_end; no se renueva después.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // A-4: try/catch global
  try {
    const stripe       = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    // M-6: helper compartido
    const subscriptionId = await getActiveSubscriptionId(stripe, sub);
    if (!subscriptionId) {
      return res.status(404).json({ error: 'No tienes una suscripción activa' });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // C-1: verificar ownership
    assertSubscriptionOwnership(subscription, sub.stripe_customer_id);

    if (!['active', 'trialing'].includes(subscription.status)) {
      return res.status(400).json({ error: 'La suscripción no está activa' });
    }

    if (subscription.cancel_at_period_end) {
      return res.status(200).json({
        ok: true,
        alreadyCancelled: true,
        cancelAt: subscription.cancel_at,
        currentPeriodEnd: subscription.current_period_end
      });
    }

    const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

    return res.status(200).json({
      ok: true,
      cancelAt: updated.cancel_at,
      currentPeriodEnd: updated.current_period_end
    });

  } catch (err) {
    console.error('[cancel-subscription] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message });
  }
};
