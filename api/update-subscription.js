const {
  getStripe, getSupabaseAdmin, getPriceId, getAuthUser,
  getActiveSubscriptionId, assertSubscriptionOwnership
} = require('./_stripeHelpers');

// Cambia el precio de la suscripción activa con prorrateo.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // A-4: try/catch global
  try {
    // A-2: validar body
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ error: 'Body JSON requerido' });
    }

    const stripe       = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { tipoPlan, periodicidad } = req.body;
    if (!tipoPlan || !periodicidad) {
      return res.status(400).json({ error: 'tipoPlan y periodicidad son obligatorios' });
    }
    const newPriceId = getPriceId(tipoPlan, periodicidad);
    if (!newPriceId) {
      return res.status(400).json({ error: 'Plan o periodicidad no válidos' });
    }

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // M-6: helper compartido (antes duplicado en cancel y reactivate)
    const subscriptionId = await getActiveSubscriptionId(stripe, sub);
    if (!subscriptionId) {
      return res.status(404).json({ error: 'No tienes una suscripción activa para actualizar' });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // C-1: verificar que la suscripción pertenece al cliente del usuario autenticado
    assertSubscriptionOwnership(subscription, sub.stripe_customer_id);

    if (!['active', 'trialing'].includes(subscription.status)) {
      return res.status(400).json({ error: 'La suscripción no está activa' });
    }

    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return res.status(500).json({ error: 'No se encontró el ítem de la suscripción' });
    }

    const currentPriceId = subscription.items.data[0]?.price?.id;

    // Durante el mes de oferta (0,99€) no se toca la facturación.
    const offerPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
    if (offerPriceId && currentPriceId === offerPriceId) {
      return res.status(200).json({ ok: true, enOferta: true, noChange: true });
    }

    if (currentPriceId === newPriceId) {
      return res.status(200).json({ ok: true, noChange: true });
    }

    const updateParams = {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations'
    };
    if (subscription.cancel_at_period_end) {
      updateParams.cancel_at_period_end = true;
    }
    const updated = await stripe.subscriptions.update(subscriptionId, updateParams);

    return res.status(200).json({ ok: true, currentPeriodEnd: updated.current_period_end });

  } catch (err) {
    console.error('[update-subscription] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message });
  }
};
