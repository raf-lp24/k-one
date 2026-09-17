const { getStripe } = require('./_stripeHelpers');

// Premium concedido a mano desde Jarvis ("Dar premium" o "Invitar cliente").
//
// El premium (profiles.is_beta) y la suscripción de Stripe son dos sistemas
// independientes: marcar a alguien premium NO paraba Stripe. Caso real (17
// sept 2026): un cliente al que se le dio premium seguía con su mes de prueba
// de Stripe corriendo detrás -- Stripe le iba a cobrar 7,99€ al acabarlo, y
// Jarvis lo enseñaba como un cliente de pago más (Renueva, precio, y luego
// "Baja" al cancelarlo a mano). Premium tiene que significar "no paga nada".
//
// Archivo con guion bajo: Vercel no lo cuenta como función (Hobby topa en 12).

// Comentario que viaja en la cancelación: el webhook lo lee para no avisar al
// admin de "Baja de un cliente" cuando la cancelación la ha provocado él mismo
// al darle premium.
const MOTIVO_CANCELACION_PREMIUM = 'premium_kone';

function fechaExpiraPremium() {
  const expira = new Date();
  expira.setFullYear(expira.getFullYear() + 1);
  return expira.toISOString();
}

function premiumVigente(perfil) {
  if (!perfil?.is_beta) return false;
  return !perfil.beta_expires || new Date(perfil.beta_expires) > new Date();
}

// Cancela YA (no al final del periodo) toda suscripción de Stripe que pueda
// llegar a cobrar: en prueba, activa, con pago pendiente... Sin prorrateo ni
// factura final: lo ya cobrado no se devuelve solo, pero no se cobra nada más.
// Nunca lanza: devuelve cuántas canceló y los avisos, para que el admin sepa si
// tiene que rematarlo a mano en el dashboard de Stripe.
async function detenerCobrosStripe(supabaseAdmin, userId) {
  const resultado = { canceladas: 0, avisos: [] };
  const { data: fila } = await supabaseAdmin
    .from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (!fila?.stripe_customer_id) return resultado;
  let stripe;
  try {
    stripe = getStripe();
    const lista = await stripe.subscriptions.list({ customer: fila.stripe_customer_id, status: 'all', limit: 20 });
    const cobrables = lista.data.filter(s => ['trialing', 'active', 'past_due', 'unpaid', 'incomplete'].includes(s.status));
    for (const s of cobrables) {
      try {
        await stripe.subscriptions.cancel(s.id, {
          prorate: false,
          invoice_now: false,
          cancellation_details: { comment: MOTIVO_CANCELACION_PREMIUM }
        });
        resultado.canceladas++;
      } catch (e) {
        if (e.code !== 'resource_missing') resultado.avisos.push(`No se pudo cancelar la suscripción ${s.id} en Stripe: ${e.message}`);
      }
    }
  } catch (e) {
    resultado.avisos.push(`No se pudo consultar Stripe: ${e.message}`);
  }
  return resultado;
}

// Concede 1 año de premium a un perfil existente y para sus cobros de Stripe.
async function concederPremium(supabaseAdmin, userId) {
  const betaExpires = fechaExpiraPremium();
  const { data, error } = await supabaseAdmin.from('profiles')
    .update({ is_beta: true, beta_expires: betaExpires })
    .eq('id', userId).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || !data.length) return { ok: false, noExiste: true };
  const stripe = await detenerCobrosStripe(supabaseAdmin, userId);
  return { ok: true, betaExpires, ...stripe };
}

module.exports = {
  MOTIVO_CANCELACION_PREMIUM,
  fechaExpiraPremium,
  premiumVigente,
  detenerCobrosStripe,
  concederPremium,
};
