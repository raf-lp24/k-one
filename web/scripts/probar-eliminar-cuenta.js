// Prueba del borrado de cuenta (api/_eliminarCuenta.js) con Stripe y Supabase simulados:
// confirmación, protección de administradores, orden de los pasos y fallos a medias.
// node scripts/probar-eliminar-cuenta.js   (lo pasa npm test y GitHub Actions)
const R = require('path').join(__dirname, '..') + '/';
process.env.ADMIN_EMAILS = 'admin@k-one.fit';
const { eliminarCuenta } = require(R + 'api/_eliminarCuenta.js');
const silencio = { error() {}, warn() {} };
function montar({ stripeFalla = false, deleteUserFalla = false, tablaFalla = null, conSub = true } = {}) {
  const acciones = [];
  const stripe = { subscriptions: {
    list: async ({ customer }) => { acciones.push('stripe.list ' + customer); return { data: [{ id: 'sub_1', status: 'active' }, { id: 'sub_2', status: 'canceled' }, { id: 'sub_3', status: 'trialing' }] }; },
    cancel: async (id, o) => { if (stripeFalla) throw new Error('stripe caído'); acciones.push('stripe.cancel ' + id + ' ' + o.cancellation_details.comment); return {}; } } };
  const supa = {
    from: t => {
      const q = { _t: t, select() { return q; }, eq(c, v) { q._c = c; q._v = v; return q; }, maybeSingle: async () => ({ data: t === 'subscriptions' && conSub ? { stripe_customer_id: 'cus_1' } : null }),
        delete() { q._del = true; return q; }, upsert: async (fila) => { acciones.push(`upsert ${t} ${fila.email_hash}`); return { error: null }; }, then(ok, ko) { acciones.push(`delete ${t} ${q._c}=${q._v}`); return Promise.resolve(tablaFalla === t ? { error: { message: 'boom' } } : { error: null }).then(ok, ko); } };
      return q;
    },
    storage: { from: () => ({ list: async (carpeta) => { acciones.push('storage.list ' + carpeta); return { data: [{ name: 'mes-1.jpg' }, { name: 'perfil.jpg' }] }; }, remove: async (r) => { acciones.push('storage.remove ' + r.join(',')); return {}; } }) },
    auth: { admin: { deleteUser: async (id) => { acciones.push('auth.deleteUser ' + id); return { error: deleteUserFalla ? { message: 'fallo' } : null }; } } },
  };
  return { stripe, supa, acciones };
}
let fallos = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fallos++; };
(async () => {
  const user = { id: 'u1', email: 'Cliente@Ejemplo.com' };
  console.log('Sin confirmación / confirmación mala');
  for (const c of [undefined, '', 'eliminar ya', 'borrar']) { const m = montar(); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: c, log: silencio }); ok(r.status === 400 && m.acciones.length === 0, `confirmacion=${JSON.stringify(c)} → ${r.status}, sin tocar nada`); }
  console.log('Administrador'); { const m = montar(); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user: { id: 'a', email: 'ADMIN@k-one.fit' }, confirmacion: 'ELIMINAR', log: silencio }); ok(r.status === 403 && m.acciones.length === 0, 'cuenta admin → 403 y no toca nada'); }
  console.log('Caso normal (con " eliminar " en minúsculas y espacios)'); { const m = montar(); let avisos = 0; const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: ' eliminar ', avisarAdmin: async () => { avisos++; }, log: silencio });
    ok(r.status === 200 && r.body.ok, '200 ok'); ok(m.acciones.filter(a => a.startsWith('stripe.cancel')).length === 2, 'cancela las 2 suscripciones vivas (active y trialing), no la cancelada');
    ok(m.acciones.some(a => a.includes('cuenta_eliminada')), 'marca la cancelación para que el webhook no avise de "baja"');
    ok(m.acciones.includes('storage.remove u1/mes-1.jpg,u1/perfil.jpg'), 'borra fotos de su carpeta'); ok(m.acciones.includes('delete mensajes_cliente user_id=u1') && m.acciones.includes('delete email_log destinatario=cliente@ejemplo.com') && m.acciones.includes('delete leads email=cliente@ejemplo.com'), 'borra mensajes, emails y lead (email en minúsculas)');
    const { huellaEmail } = require(R + 'api/_pruebaGratis.js');
    ok(m.acciones.includes('upsert pruebas_usadas ' + huellaEmail('cliente@ejemplo.com')), 'anota la huella del email: no repite mes gratis si se registra otra vez');
    ok(m.acciones[m.acciones.length - 1] === 'auth.deleteUser u1', 'el usuario de Auth se borra el último'); ok(avisos === 1, 'avisa al admin una vez (sin datos personales)'); }
  console.log('Stripe falla → no se borra nada'); { const m = montar({ stripeFalla: true }); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: 'ELIMINAR', log: silencio }); ok(r.status === 502 && !m.acciones.some(a => a.startsWith('delete') || a.startsWith('auth') || a.startsWith('storage.remove')), '502 y ningún dato borrado'); }
  console.log('Sin suscripción (cliente que nunca pagó)'); { const m = montar({ conSub: false }); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: 'ELIMINAR', log: silencio }); ok(r.status === 200 && !m.acciones.some(a => a.startsWith('stripe')), '200 sin llamar a Stripe'); ok(!m.acciones.some(a => a.startsWith('upsert pruebas_usadas')), 'sin suscripción previa no se anota la huella (no llegó a usar el mes gratis)'); }
  console.log('Una tabla secundaria falla → se borra igual la cuenta'); { const m = montar({ tablaFalla: 'email_log' }); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: 'ELIMINAR', log: silencio }); ok(r.status === 200 && m.acciones.includes('auth.deleteUser u1'), '200 y borra el usuario'); }
  console.log('deleteUser falla → error claro y reintentable'); { const m = montar({ deleteUserFalla: true }); const r = await eliminarCuenta({ stripe: m.stripe, supabaseAdmin: m.supa, user, confirmacion: 'ELIMINAR', log: silencio }); ok(r.status === 500 && /inténtalo otra vez/.test(r.body.error), '500 con mensaje para el cliente'); }
  console.log('\n' + (fallos ? '✘ ' + fallos + ' fallos' : '✔ Todo bien')); process.exit(fallos ? 1 : 0);
})();
