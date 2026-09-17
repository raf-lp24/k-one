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
    const cobrables = lista.data.filter(s => ESTADOS_COBRABLES.includes(s.status));
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

const ESTADOS_COBRABLES = ['trialing', 'active', 'past_due', 'unpaid', 'incomplete'];

// Pone al día, de una vez, lo que quedó mal antes de este arreglo. Corre al
// abrir Jarvis (api/admin-clientes.js), así que no hace falta tocar la base
// de datos a mano:
//  1. Emails invitados desde Jarvis que YA tienen cuenta (la invitación no se
//     canjeaba nunca, ver syncProfileFromSupabase): premium concedido ya.
//  2. Premium vigente con una suscripción de Stripe que aún puede cobrar
//     (premium dado antes de que "Dar premium" cancelara Stripe): cancelada.
// Idempotente: la segunda vez no encuentra nada que hacer. Nunca lanza.
async function reconciliarPremium(supabaseAdmin) {
  const out = { aplicadas: [], pendientes: [], stripeCanceladas: 0, avisos: [] };
  const yaRevisados = new Set(); // Stripe ya cortado en el paso 1: no repetir en el 2
  try {
    const { data: invs, error } = await supabaseAdmin
      .from('invitaciones_premium').select('email, created_at').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    for (const inv of invs || []) {
      const email = (inv.email || '').trim().toLowerCase();
      if (!email) continue;
      const patron = email.replace(/[\\%_]/g, c => '\\' + c);
      const { data: perfiles } = await supabaseAdmin
        .from('profiles').select('id, is_beta, beta_expires').ilike('email', patron).limit(1);
      const perfil = perfiles && perfiles[0];
      if (!perfil) { out.pendientes.push({ email, creada: inv.created_at }); continue; }
      // Si ya era premium vigente no se le reinicia la caducidad: solo se
      // limpia la invitación (Stripe lo cubre el paso 2).
      if (!premiumVigente(perfil)) {
        const r = await concederPremium(supabaseAdmin, perfil.id);
        if (!r.ok) { out.avisos.push(`No se pudo dar premium a ${email}: ${r.error || 'perfil no encontrado'}`); continue; }
        out.stripeCanceladas += r.canceladas;
        out.avisos.push(...r.avisos);
        yaRevisados.add(perfil.id);
      }
      await supabaseAdmin.from('invitaciones_premium').delete().eq('email', inv.email);
      out.aplicadas.push(email);
    }
  } catch (e) {
    out.avisos.push(`Invitaciones premium: ${e.message}`);
  }
  try {
    const { data: premiums, error } = await supabaseAdmin
      .from('profiles').select('id, email, is_beta, beta_expires').eq('is_beta', true);
    if (error) throw new Error(error.message);
    const vigentes = (premiums || []).filter(premiumVigente);
    if (vigentes.length) {
      const { data: subs } = await supabaseAdmin
        .from('subscriptions').select('user_id, status').in('user_id', vigentes.map(p => p.id));
      for (const s of subs || []) {
        if (!ESTADOS_COBRABLES.includes(s.status) || yaRevisados.has(s.user_id)) continue;
        const r = await detenerCobrosStripe(supabaseAdmin, s.user_id);
        out.stripeCanceladas += r.canceladas;
        out.avisos.push(...r.avisos);
      }
    }
  } catch (e) {
    out.avisos.push(`Stripe de clientes premium: ${e.message}`);
  }
  return out;
}

module.exports = {
  reconciliarPremium,
  MOTIVO_CANCELACION_PREMIUM,
  fechaExpiraPremium,
  premiumVigente,
  detenerCobrosStripe,
  concederPremium,
};
