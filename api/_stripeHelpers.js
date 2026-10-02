const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no definida');
  // Sin timeout propio, una llamada a Stripe que tardara de más consumía
  // todo el maxDuration de la función (varias llamadas encadenadas en
  // create-checkout-session.js, hasta 4 seguidas) en vez de fallar rápido
  // y de forma predecible.
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000 });
}

// A-1: URL desde variable de entorno, nunca hardcodeada
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidas');
  return createClient(url, key);
}

// Mapea tipo de plan + periodicidad al Price ID de Stripe (variable de entorno en Vercel).
const PRICE_ENV_MAP = {
  'Plan completo: entrenamiento + nutrición': {
    // Mensual y trimestral. El plan anual se retiró en julio de 2026.
    mensual:    'STRIPE_PRICE_COMPLETO_MENSUAL',
    trimestral: 'STRIPE_PRICE_COMPLETO_TRIMESTRAL'
  },
  'Solo nutrición, sin entrenamiento': {
    mensual: 'STRIPE_PRICE_NUTRICION_MENSUAL'
  }
};

// B-2: sin fallback silencioso al plan completo — si tipoPlan es inválido devuelve null
function getPriceId(tipoPlan, periodicidad) {
  const planMap = PRICE_ENV_MAP[tipoPlan];
  if (!planMap) return null;
  const envVar = planMap[periodicidad];
  return envVar ? (process.env[envVar] || null) : null;
}

// Extrae y valida el usuario de Supabase a partir del token Authorization.
async function getAuthUser(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

// M-6: lógica de fallback "buscar suscripción activa por stripe_customer_id" compartida
// entre update, cancel y reactivate — antes estaba duplicada en los 3 handlers.
async function getActiveSubscriptionId(stripe, sub) {
  if (sub?.stripe_subscription_id) return sub.stripe_subscription_id;
  if (!sub?.stripe_customer_id) return null;
  const lista = await stripe.subscriptions.list({
    customer: sub.stripe_customer_id,
    status: 'all',
    limit: 10
  });
  return lista.data.find(s => ['active', 'trialing'].includes(s.status))?.id || null;
}

// current_period_start/end pueden venir en el objeto subscription de nivel
// superior o, según la versión de la API de Stripe, solo dentro de cada item
// de la suscripción. Este fallback ya existía duplicado solo en el webhook
// (upsertFromSubscription); update-subscription/cancel-subscription/
// reactivate-subscription leían subscription.current_period_* directo y se
// habrían quedado con `undefined` en el mismo escenario que motivó el fix
// original -- aquí queda centralizado para los cuatro sitios que lo usan.
function getSubscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0];
  return {
    start: item?.current_period_start ?? subscription.current_period_start,
    end:   item?.current_period_end   ?? subscription.current_period_end,
  };
}

// Candado atómico compartido por cancel/reactivate/update-subscription: sin
// esto, dos pestañas del mismo usuario cancelando y reactivando casi a la
// vez pueden pisarse el estado en Stripe (gana quien complete el UPDATE de
// Stripe más tarde, no la intención real del usuario). Mismo patrón que
// checkout_lock_until en create-checkout-session.js: un UPDATE...WHERE es
// atómico en Postgres, así que con peticiones simultáneas como mucho una ve
// la condición cumplida. Requiere la columna sub_action_lock_until
// (supabase/migration-agosto29-hardening.sql). Fail-open si la columna no
// existe todavía (no bloquea nada, igual que antes de este fix).
async function adquirirCandadoSuscripcion(supabaseAdmin, userId, segundos = 15) {
  const ahora = new Date();
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ sub_action_lock_until: new Date(ahora.getTime() + segundos * 1000).toISOString() })
    .eq('user_id', userId)
    .or(`sub_action_lock_until.is.null,sub_action_lock_until.lt.${ahora.toISOString()}`)
    .select('user_id');
  if (error) {
    console.warn('[adquirirCandadoSuscripcion] no se pudo comprobar el candado, se deja pasar:', error.message);
    return true;
  }
  return !!(data && data.length);
}

// C-1: verifica que la suscripción de Stripe pertenece al cliente del usuario autenticado.
// Llama después de stripe.subscriptions.retrieve() en update/cancel/reactivate.
function assertSubscriptionOwnership(subscription, stripeCustomerId) {
  if (subscription.customer !== stripeCustomerId) {
    const err = new Error('La suscripción no pertenece a este cliente');
    err.statusCode = 403;
    throw err;
  }
}

// Actualiza (o crea) la fila de subscriptions a partir de un objeto suscripción de Stripe.
async function upsertFromSubscription(supabaseAdmin, subscription, userId) {
  const item      = subscription.items.data[0];
  const periodEnd = item?.current_period_end   ?? subscription.current_period_end;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;

  // Sin este guard, si Stripe no manda el periodo (cambió de sitio entre versiones
  // de la API), `new Date(undefined * 1000).toISOString()` lanza RangeError y tumba
  // el webhook entero con un 500, en vez de guardar la fila sin la fecha.
  if (!periodEnd) {
    console.warn(`[stripe] suscripción ${subscription.id} sin current_period_end; se guarda sin fecha de renovación`);
  }

  const row = {
    stripe_customer_id:     subscription.customer,
    stripe_subscription_id: subscription.id,
    plan:                   item?.price?.id || null,
    status:                 subscription.status,
    current_period_start:   periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end:     periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
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
    console.warn('[stripe] columna faltante en subscriptions, reintentando sin ella:', err.message);
    const rowMin = { ...row };
    delete rowMin.current_period_start;
    delete rowMin.cancel_at_period_end;
    ({ error: err } = await escribir(rowMin));
  }

  if (err) throw new Error(`Supabase upsert error: ${err.message}`);
}


// ¿El cliente tiene ya una forma de pago con la que cobrarle al terminar el mes
// gratis? Desde el 2 oct 2026 el mes gratis empieza SIN tarjeta, así que hay que
// saberlo para avisarle y para enseñarle "Añadir tarjeta". Mira la suscripción,
// el método por defecto del cliente y, por último, si tiene alguna tarjeta guardada.
async function tieneMetodoPago(stripe, customerId, subscriptionId) {
  if (!customerId) return false;
  if (subscriptionId) {
    const s = await stripe.subscriptions.retrieve(subscriptionId);
    if (s.default_payment_method || s.default_source) return true;
  }
  const c = await stripe.customers.retrieve(customerId);
  if (!c || c.deleted) return false;
  if ((c.invoice_settings && c.invoice_settings.default_payment_method) || c.default_source) return true;
  const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
  return !!(pms.data && pms.data.length);
}

module.exports = {
  upsertFromSubscription,
  tieneMetodoPago,
  getStripe,
  getSupabaseAdmin,
  getPriceId,
  getAuthUser,
  getActiveSubscriptionId,
  assertSubscriptionOwnership,
  getSubscriptionPeriod,
  adquirirCandadoSuscripcion,
};
