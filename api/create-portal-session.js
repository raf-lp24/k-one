const { getStripe, getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');

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
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return res.status(404).json({ error: 'No tienes una suscripción asociada todavía' });
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
