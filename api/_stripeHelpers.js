const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no definida');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
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
    // El plan trimestral se retiró en julio 2026 (bajada de precios).
    mensual: 'STRIPE_PRICE_COMPLETO_MENSUAL',
    anual:   'STRIPE_PRICE_COMPLETO_ANUAL'
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

// C-1: verifica que la suscripción de Stripe pertenece al cliente del usuario autenticado.
// Llama después de stripe.subscriptions.retrieve() en update/cancel/reactivate.
function assertSubscriptionOwnership(subscription, stripeCustomerId) {
  if (subscription.customer !== stripeCustomerId) {
    const err = new Error('La suscripción no pertenece a este cliente');
    err.statusCode = 403;
    throw err;
  }
}

module.exports = {
  getStripe,
  getSupabaseAdmin,
  getPriceId,
  getAuthUser,
  getActiveSubscriptionId,
  assertSubscriptionOwnership,
};
