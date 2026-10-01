// Borrado de cuenta a petición del propio cliente (RGPD, derecho de supresión).
// Lo llama api/update-subscription.js con `accion: 'eliminar-cuenta'` (no es una función
// nueva: el plan Hobby de Vercel solo admite 12 y ya están ocupadas).
//
// Orden pensado para que un fallo a medias no deje al cliente peor:
//  1. Se cancela YA su suscripción en Stripe. Si eso falla no se borra nada: borrar los
//     datos con un cobro vivo detrás sería peor que no borrar.
//  2. Fotos de progreso y de perfil (Storage), mensajes, historial de emails y lead.
//  3. Por último el usuario de Auth: la base de datos borra en cascada su perfil, plan,
//     suscripción, hitos, avisos push, referidos, canjes y avisos de Thor.
// Si algo falla después del paso 1 se puede reintentar sin problema (todo es idempotente).
//
// Tampoco se borra la huella del email en `pruebas_usadas` (SHA-256, no el email): es lo que
// impide borrar la cuenta y registrarse otra vez para repetir el mes gratis.
//
// Lo que NO se borra: los datos de facturación que guarda Stripe (obligación fiscal, así lo
// dice la política de privacidad) y las opiniones ya publicadas con consentimiento (no llevan
// enlace a la cuenta; se retiran escribiendo a k.one.fit26@gmail.com).
const { MOTIVO_CUENTA_ELIMINADA } = require('./_premium');
const { marcarPruebaUsada } = require('./_pruebaGratis');

const ESTADOS_VIVOS = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

async function eliminarCuenta({ stripe, supabaseAdmin, user, confirmacion, avisarAdmin, log = console }) {
  if (String(confirmacion || '').trim().toUpperCase() !== 'ELIMINAR') {
    return { status: 400, body: { error: 'Escribe ELIMINAR para confirmar.' } };
  }
  const email = String(user.email || '').toLowerCase();
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email)) {
    return { status: 403, body: { error: 'Las cuentas de administrador no se eliminan desde aquí.' } };
  }

  // 1. Stripe
  try {
    const { data: sub } = await supabaseAdmin.from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).maybeSingle();
    if (sub && sub.stripe_customer_id) {
      const lista = await stripe.subscriptions.list({ customer: sub.stripe_customer_id, status: 'all', limit: 20 });
      for (const s of lista.data) {
        if (ESTADOS_VIVOS.includes(s.status)) {
          await stripe.subscriptions.cancel(s.id, { cancellation_details: { comment: MOTIVO_CUENTA_ELIMINADA } });
        }
      }
      // Si ya tuvo suscripción, su email no vuelve a tener mes gratis al registrarse
      // de nuevo (ver _pruebaGratis.js). Lo único que queda es una huella del email.
      if (lista.data.some(s => s.status !== 'incomplete_expired')) await marcarPruebaUsada(supabaseAdmin, email, log);
    }
  } catch (e) {
    log.error('[eliminar-cuenta] Stripe:', e.message);
    return { status: 502, body: { error: 'No hemos podido cancelar tu suscripción, así que no se ha borrado nada. Inténtalo de nuevo en un momento o escríbenos a k.one.fit26@gmail.com.' } };
  }

  // 2. Datos que no se borran solos con la cuenta (cada uno por separado: uno que falle no impide el resto)
  const pendientes = [];
  try {
    const { data: archivos } = await supabaseAdmin.storage.from('fotos-progreso').list(user.id, { limit: 1000 });
    const rutas = (archivos || []).map(a => `${user.id}/${a.name}`);
    if (rutas.length) await supabaseAdmin.storage.from('fotos-progreso').remove(rutas);
  } catch (e) { pendientes.push('fotos: ' + e.message); }
  for (const [tabla, col, valor] of [['mensajes_cliente', 'user_id', user.id], ['email_log', 'destinatario', email], ['leads', 'email', email]]) {
    try {
      const r = await supabaseAdmin.from(tabla).delete().eq(col, valor);
      if (r && r.error) pendientes.push(tabla + ': ' + r.error.message);
    } catch (e) { pendientes.push(tabla + ': ' + e.message); }
  }

  // 3. Usuario de Auth (la cascada borra el resto)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) {
    log.error('[eliminar-cuenta] deleteUser:', error.message);
    return { status: 500, body: { error: 'No hemos podido terminar el borrado. No pasa nada: inténtalo otra vez o escríbenos y lo hacemos nosotros.' } };
  }
  if (pendientes.length) log.warn('[eliminar-cuenta] borrado con avisos:', pendientes.join(' | '));
  try { if (avisarAdmin) await avisarAdmin({ title: 'K-ONE · Cuenta eliminada', body: 'Un cliente ha eliminado su cuenta y sus datos.', url: '/' }); } catch (_) {}
  return { status: 200, body: { ok: true } };
}

module.exports = { eliminarCuenta };
