const {
  getStripe, getSupabaseAdmin, getPriceId, getAuthUser,
  getActiveSubscriptionId, assertSubscriptionOwnership
} = require('./_stripeHelpers');
const { canjearNivelHitos } = require('./_hitosReward');
const { capturarError } = require('./_sentry');

// Cambia el precio de la suscripción activa SIN prorrateo: crea un
// subscriptionSchedule con la fase actual (precio viejo hasta que acabe el
// período ya pagado) y una fase nueva (precio nuevo desde la siguiente
// renovación) -- coincide con lo que promete la FAQ pública ("se aplica en
// el siguiente período, nunca a mitad de mes, sin cargos extra"). Este
// comentario decía "con prorrateo" y contradecía tanto el código real de
// abajo como el mensaje que ve el cliente en index.html (ya corregido).
//
// También atiende `accion: 'canjear-hito'`, que aplica el % de descuento de un
// nivel de hitos a la próxima cuota. Va aquí, y no en su propio endpoint, porque
// el plan Hobby de Vercel sólo admite 12 funciones serverless y ya estaban las 12
// ocupadas; aplicar un cupón a la suscripción encaja además con este endpoint.
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

    // ─── Canje de recompensa por nivel de hitos ───
    if (req.body.accion === 'canjear-hito') {
      const r = await canjearNivelHitos({ stripe, supabaseAdmin, user, nivel: req.body.nivel });
      return res.status(r.status).json(r.body);
    }

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

    // Durante el mes de oferta (1,99€) no se toca la facturación.
    const offerPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
    if (offerPriceId && currentPriceId === offerPriceId) {
      return res.status(200).json({ ok: true, enOferta: true, noChange: true });
    }

    if (currentPriceId === newPriceId) {
      return res.status(200).json({ ok: true, noChange: true });
    }

    // Cambio de plan: se aplica al final del período actual (sin prorrateo).
    // El cliente mantiene su plan actual hasta que termine el mes/trimestre/año,
    // y en la próxima renovación se cobra el nuevo plan.
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: subscription.current_period_start,
          end_date: subscription.current_period_end,
        },
        {
          items: [{ price: newPriceId, quantity: 1 }],
        }
      ],
    });

    return res.status(200).json({ ok: true, currentPeriodEnd: subscription.current_period_end, cambioProgamado: true });

  } catch (err) {
    console.error('[update-subscription] error:', err);
    capturarError(err, { fn: 'update-subscription' });
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : err.message });
  }
};
