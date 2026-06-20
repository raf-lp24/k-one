const { getStripe, getSupabaseAdmin } = require('./_stripeHelpers');

// Vercel necesita el cuerpo de la petición sin parsear para verificar la firma de Stripe.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Actualiza (o crea) la fila de subscriptions a partir de un objeto suscripción de Stripe.
async function upsertFromSubscription(supabaseAdmin, subscription, userId) {
  const item      = subscription.items.data[0];
  const periodEnd = item?.current_period_end   ?? subscription.current_period_end;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;

  const row = {
    stripe_customer_id:     subscription.customer,
    stripe_subscription_id: subscription.id,
    plan:                   item?.price?.id || null,
    status:                 subscription.status,
    current_period_start:   periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end:     new Date(periodEnd * 1000).toISOString(),
    cancel_at_period_end:   !!subscription.cancel_at_period_end
  };

  async function escribir(r) {
    if (userId) {
      return supabaseAdmin.from('subscriptions').upsert({ user_id: userId, ...r }, { onConflict: 'user_id' });
    }
    return supabaseAdmin.from('subscriptions').update(r).eq('stripe_customer_id', subscription.customer);
  }

  let { error: err } = await escribir(row);

  // M-3: loggear el error ANTES del fallback para que aparezca en los logs de Vercel
  if (err && err.message && /current_period_start|cancel_at_period_end/.test(err.message)) {
    console.warn('[stripe-webhook] columna faltante en subscriptions, reintentando sin ella:', err.message);
    const rowMin = { ...row };
    delete rowMin.current_period_start;
    delete rowMin.cancel_at_period_end;
    ({ error: err } = await escribir(rowMin));
  }

  if (err) throw new Error(`Supabase upsert error: ${err.message}`);
}

// Sincroniza el estado del cliente eligiendo SIEMPRE su mejor suscripción activa.
// Evita que un evento de cancelación de una suscripción vieja quite el acceso si ya
// tiene una nueva activa (p. ej. renovación anticipada o cambio de plan).
async function syncCustomerFromStripe(stripe, supabaseAdmin, customerId, fallbackSub) {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const subs = list.data;
  const activaSinCancelar = subs.find(s => ['active', 'trialing'].includes(s.status) && !s.cancel_at_period_end);
  const activa   = subs.find(s => ['active', 'trialing'].includes(s.status));
  const elegida  = activaSinCancelar || activa || fallbackSub || subs[0];
  if (elegida) await upsertFromSubscription(supabaseAdmin, elegida, null);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Método no permitido');
  }

  // A-4: try/catch global
  try {
    const stripe       = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const rawBody = await readRawBody(req);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Firma inválida: ${err.message}`);
    }

    // C-3: idempotencia — si este event.id ya fue procesado devolvemos 200 inmediatamente.
    // Requiere la tabla webhook_events en Supabase (ver supabase/schema.sql).
    const { error: dupErr } = await supabaseAdmin
      .from('webhook_events')
      .insert({ event_id: event.id, type: event.type });

    if (dupErr?.code === '23505') {
      // Duplicado conocido: Stripe reenvió el evento, ya fue procesado
      return res.status(200).json({ received: true, duplicate: true });
    }
    if (dupErr) {
      // La tabla puede no existir aún — loggeamos pero NO bloqueamos el procesamiento
      console.warn('[stripe-webhook] webhook_events insert error (no bloqueante):', dupErr.message);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.client_reference_id || session.metadata?.supabase_user_id;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Oferta 1,99€: al terminar el primer mes, pasa automáticamente a 19,99€/mes
        // (plan completo mensual). Si el cliente cambia de plan antes, el schedule se
        // sobreescribe con el nuevo plan elegido.
        if (session.metadata?.oferta === 'si') {
          const completoMensualId = process.env.STRIPE_PRICE_COMPLETO_MENSUAL;
          if (completoMensualId) {
            try {
              await stripe.subscriptionSchedules.create({
                from_subscription: subscription.id,
                phases: [
                  {
                    items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
                    start_date: subscription.current_period_start,
                    end_date: subscription.current_period_end,
                  },
                  {
                    items: [{ price: completoMensualId, quantity: 1 }],
                    iterations: null,
                  }
                ],
              });
            } catch (schedErr) {
              console.error('[stripe-webhook] Error creando schedule oferta→completo:', schedErr.message);
            }
          }
        }

        await upsertFromSubscription(supabaseAdmin, subscription, userId);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
        await syncCustomerFromStripe(stripe, supabaseAdmin, subscription.customer, subscription);
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[stripe-webhook] error no controlado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
