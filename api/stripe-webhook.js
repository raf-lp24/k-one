const { getStripe, getSupabaseAdmin } = require('./_stripeHelpers');

// Vercel necesita el cuerpo de la petición sin parsear para verificar
// la firma de Stripe.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Actualiza (o crea) la fila de subscriptions a partir de una suscripción de Stripe.
async function upsertFromSubscription(supabaseAdmin, subscription, userId) {
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const row = {
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    plan: item?.price?.id || null,
    status: subscription.status,
    current_period_end: new Date(periodEnd * 1000).toISOString()
  };

  if (userId) {
    await supabaseAdmin.from('subscriptions').upsert({ user_id: userId, ...row }, { onConflict: 'user_id' });
  } else {
    await supabaseAdmin.from('subscriptions').update(row).eq('stripe_customer_id', subscription.customer);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end('Método no permitido');
    return;
  }

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();

  const rawBody = await readRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Firma inválida: ${err.message}`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.supabase_user_id;
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertFromSubscription(supabaseAdmin, subscription, userId);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
      await upsertFromSubscription(supabaseAdmin, subscription, null);
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
};
