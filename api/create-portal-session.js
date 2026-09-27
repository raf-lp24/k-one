const { getStripe, getSupabaseAdmin, getAuthUser, assertSubscriptionOwnership } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');

// Pago fallido (past_due): se devuelve la página de pago de la factura
// pendiente en vez del portal. Desde el 27 sept 2026 un pago fallido corta el
// acceso al momento, y actualizar la tarjeta en el portal NO cobra la factura
// en ese momento -- Stripe espera al siguiente reintento programado (días; ver
// docs.stripe.com/billing/revenue-recovery/smart-retries). El cliente se
// quedaba bloqueado después de haberlo arreglado. Pagando la factura, el
// webhook pasa la suscripción a active y el acceso vuelve en el acto.
// save_default_payment_method=on_subscription: la tarjeta con la que pague
// queda como la de la suscripción para los meses siguientes.
async function urlFacturaPendiente(stripe, sub) {
  if (!sub?.stripe_subscription_id) return null;
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ['latest_invoice'] });
  assertSubscriptionOwnership(subscription, sub.stripe_customer_id);
  if (subscription.status !== 'past_due') return null;
  const factura = subscription.latest_invoice;
  if (!factura || factura.status !== 'open' || !factura.hosted_invoice_url) return null;
  try {
    await stripe.subscriptions.update(subscription.id, { payment_settings: { save_default_payment_method: 'on_subscription' } });
  } catch (e) {
    console.warn('[create-portal-session] no se pudo activar save_default_payment_method:', e.message);
  }
  return factura.hosted_invoice_url;
}

// Crea una sesión del Portal de Clientes de Stripe para que el usuario
// gestione/cambie/cancele su suscripción y método de pago.
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
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return res.status(404).json({ error: 'No tienes una suscripción asociada todavía' });
    }

    if (sub.status === 'past_due') {
      try {
        const urlFactura = await urlFacturaPendiente(stripe, sub);
        if (urlFactura) return res.status(200).json({ url: urlFactura, tipo: 'factura_pendiente' });
      } catch (e) {
        // Si algo falla aquí, el portal sigue siendo una salida válida.
        console.warn('[create-portal-session] factura pendiente no disponible, se usa el portal:', e.message);
      }
    }

    // M-4: origen desde variable de entorno para evitar header Host manipulado
    const origin = process.env.APP_URL || 'https://k-one.fit';

    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: `${origin}/`
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[create-portal-session] error:', err);
    capturarError(err, { fn: 'create-portal-session' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
