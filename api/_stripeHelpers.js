const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const SUPABASE_URL = 'https://rfdrqbnzceudwclagjvp.supabase.co';

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Mapea el tipo de plan + periodicidad elegidos en la app al Price ID de Stripe
// configurado como variable de entorno en Vercel.
const PRICE_ENV_MAP = {
  'Plan completo: entrenamiento + nutrición': {
    mensual: 'STRIPE_PRICE_COMPLETO_MENSUAL',
    trimestral: 'STRIPE_PRICE_COMPLETO_TRIMESTRAL',
    anual: 'STRIPE_PRICE_COMPLETO_ANUAL'
  },
  'Solo nutrición, sin entrenamiento': {
    mensual: 'STRIPE_PRICE_NUTRICION_MENSUAL'
  }
};

function getPriceId(tipoPlan, periodicidad) {
  const envVar = (PRICE_ENV_MAP[tipoPlan] || PRICE_ENV_MAP['Plan completo: entrenamiento + nutrición'])[periodicidad];
  return envVar ? process.env[envVar] : null;
}

// Extrae y valida el usuario de Supabase a partir del token del header Authorization.
async function getAuthUser(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

module.exports = { getStripe, getSupabaseAdmin, getPriceId, getAuthUser };
