const {
  getStripe, getSupabaseAdmin, getAuthUser,
  getActiveSubscriptionId, assertSubscriptionOwnership, getSubscriptionPeriod
} = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');

// Reactiva una suscripción marcada para cancelarse (deshace cancel_at_period_end),
// SIN cobrar nada nuevo: el cliente sigue con su plan y misma fecha de renovación.
//
// Casos:
// - Plan de pago real cancelado y aún activo  → reactiva (ok: reactivated).
// - Primer mes de oferta (1,99€)              → no se reactiva; el cliente elige plan
//                                               definitivo en el paywall (needsCheckout, enOferta).
// - Sin suscripción vigente (ya expiró)       → hay que pasar por checkout (needsCheckout).
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
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // M-6: helper compartido
    const subscriptionId = await getActiveSubscriptionId(stripe, sub);
    if (!subscriptionId) {
      return res.status(200).json({ needsCheckout: true });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // C-1: verificar ownership
    assertSubscriptionOwnership(subscription, sub.stripe_customer_id);

    if (!['active', 'trialing'].includes(subscription.status)) {
      return res.status(200).json({ needsCheckout: true });
    }

    // Durante el primer mes de oferta no se reactiva: la oferta termina sí o sí.
    const offerPriceId  = process.env.STRIPE_PRICE_OFERTA_MES;
    const currentPriceId = subscription.items.data[0]?.price?.id;
    if (offerPriceId && currentPriceId === offerPriceId) {
      return res.status(200).json({ needsCheckout: true, enOferta: true });
    }

    if (subscription.cancel_at_period_end) {
      const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
      return res.status(200).json({ ok: true, reactivated: true, currentPeriodEnd: getSubscriptionPeriod(updated).end });
    }

    // Ya estaba activa sin cancelación pendiente: nada que hacer.
    return res.status(200).json({ ok: true, noChange: true });

  } catch (err) {
    console.error('[reactivate-subscription] error:', err);
    capturarError(err, { fn: 'reactivate-subscription' });
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.type === 'StripeCardError' ? err.message : 'Error interno del servidor' });
  }
};
