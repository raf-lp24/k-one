const { getStripe, getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

// Reactiva una suscripción de pago que estaba marcada para cancelarse al final
// del período (deshace cancel_at_period_end), SIN cobrar nada nuevo: el cliente
// sigue con su plan y su misma fecha de renovación.
//
// Casos:
// - Plan de pago real cancelado y aún activo  -> se reactiva (ok: reactivated).
// - Primer mes de oferta (0,99€)              -> no se reactiva la oferta; el cliente
//                                                debe elegir su plan definitivo y pagar
//                                                (needsCheckout, enOferta).
// - Sin suscripción vigente (ya expiró)       -> hay que pasar por checkout (needsCheckout).
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
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Localiza la suscripción vigente (con fallback por cliente si faltara el id).
  let subscriptionId = sub?.stripe_subscription_id;
  if (!subscriptionId && sub?.stripe_customer_id) {
    const lista = await stripe.subscriptions.list({ customer: sub.stripe_customer_id, status: 'all', limit: 10 });
    const activa = lista.data.find(s => ['active', 'trialing'].includes(s.status));
    subscriptionId = activa?.id || null;
  }

  if (!subscriptionId) {
    res.status(200).json({ needsCheckout: true });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Si ya no está vigente, no se puede reactivar: hay que volver a contratar.
  if (!['active', 'trialing'].includes(subscription.status)) {
    res.status(200).json({ needsCheckout: true });
    return;
  }

  // Durante el primer mes de oferta no se reactiva: la oferta termina sí o sí y el
  // cliente elige su plan definitivo en el paywall.
  const offerPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
  const currentPriceId = subscription.items.data[0]?.price?.id;
  if (offerPriceId && currentPriceId === offerPriceId) {
    res.status(200).json({ needsCheckout: true, enOferta: true });
    return;
  }

  // Plan de pago real: si estaba marcado para cancelar, lo reactivamos sin cargo.
  if (subscription.cancel_at_period_end) {
    const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    res.status(200).json({ ok: true, reactivated: true, currentPeriodEnd: updated.current_period_end });
    return;
  }

  // Ya estaba activa y sin cancelar: nada que hacer.
  res.status(200).json({ ok: true, noChange: true });
};
