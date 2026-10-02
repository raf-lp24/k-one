// Ejecuta el cron REAL de las 09:00 (GET /api/notify con CRON_SECRET) durante 8 días seguidos con una base de datos,
// Resend y push simulados. Falla si: el cron lanza o escribe errores, repite un email al mismo cliente, manda texto roto o
// sin escapar, no manda el aviso antes del primer cobro (solo a quien está en prueba, sin cancelar y a 3 días o menos),
// no pone al día los planes con el motor actual o la copia de seguridad lleva planes.
//   node scripts/probar-cron.js   (lo pasa npm test y GitHub Actions)
const R = require('path').join(__dirname, '..') + '/';
const fs = require('fs');
const webpush = require(R + 'node_modules/web-push');
const claves = webpush.generateVAPIDKeys();
process.env.CRON_SECRET = 's3cret'; process.env.RESEND_API_KEY = 're_test'; process.env.VAPID_PUBLIC_KEY = claves.publicKey; process.env.VAPID_PRIVATE_KEY = claves.privateKey;
process.env.ADMIN_EMAILS = 'admin@k-one.fit'; process.env.APP_URL = 'https://k-one.fit'; process.env.SUPABASE_URL = 'http://x'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
process.env.STRIPE_PRICE_COMPLETO_MENSUAL = 'price_m';
const { crearMotor } = require(R + 'lib/motor-servidor');
const htmlApp = fs.readFileSync(R + 'index.html', 'utf8');
const motor = crearMotor(htmlApp);

// ---- reloj falso
const RD = Date; let desfase = 0;
global.Date = class extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + desfase); else super(...a); } static now() { return RD.now() + desfase; } };
const dia = 86400000;
const iso = (d) => new RD(RD.now() + d * dia).toISOString();

// ---- base de datos
let semilla = 5; const az = () => { semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const el = a => a[Math.floor(az() * a.length)];
const T = { profiles: [], subscriptions: [], email_log: [], push_subscriptions: [], auditorias_clientes: [], leads: [] };
const base = { edad: '33', sexo: 'Hombre', peso: '80', altura: '178', enfermedad: 'No', lesion: 'No', alergia: 'No', tca: 'No', dieta: 'Como de todo', noComida: '', comidas: '5', tipoPlan: 'Plan completo: entrenamiento + nutrición', objetivo: 'Perder grasa', enfoqueMacros: 'Equilibrado', deporte: 'Gimnasio / Fuerza', diasEntreno: '4 días', tiempoSesion: '45-60 min', nivel: 'Llevo algo de tiempo', lugar: 'Gimnasio', onboardingCompletado: true, historialEntrenos: [] };
const NOMBRES = ['Ana', 'Luis Pérez', '<b>Eva</b>', '', 'María José', null];
function perfil(i, extra = {}) {
  const ud = { ...base, nombre: el(NOMBRES), ...(extra.ud || {}) };
  let plan = null; if (extra.conPlan !== false) { try { plan = motor.generar(ud); plan.motorVersion = extra.motorViejo ? 'viejo000' : plan.motorVersion; } catch (e) {} }
  const p = { id: 'u' + i, nombre: ud.nombre, email: `c${i}@ejemplo.com`, userdata: ud, plan, created_at: iso(extra.alta ?? -30), last_seen: extra.visto === null ? null : iso(extra.visto ?? -1), is_beta: !!extra.premium, beta_expires: extra.premium ? iso(60) : null };
  T.profiles.push(p);
  if (extra.sub) T.subscriptions.push({ user_id: p.id, status: extra.sub, plan: 'price_m', current_period_end: iso(extra.fin ?? 10), cancel_at_period_end: !!extra.cancela });
  if (extra.push) T.push_subscriptions.push({ id: 'ps' + i, user_id: p.id, endpoint: 'https://push.ejemplo/' + i, p256dh: 'p', auth_key: 'a' });
  return p;
}
let n = 0;
perfil(n++, { alta: -1.2, ud: { peso: '', onboardingCompletado: false }, conPlan: false });                 // 24h sin cuestionario
perfil(n++, { alta: -9, sub: null });                                         // 8-9 días sin pagar
const sinTarjeta = perfil(n++, { alta: -1.5, ud: { onboardingCompletado: false } });   // cuestionario hecho, parado en la tarjeta
perfil(n++, { alta: -40, visto: -8, sub: 'active', push: true });             // inactivo 8d
perfil(n++, { alta: -40, visto: -15, sub: 'active' });                        // 15d
perfil(n++, { alta: -40, visto: -22, sub: 'trialing' });                      // 22d
for (let i = 0; i < 6; i++) perfil(n++, { alta: -20, visto: -1, sub: 'active', push: true, motorViejo: true });   // plan con motor viejo
perfil(n++, { alta: -50, visto: -1, sub: 'active', push: true, ud: { noComida: 'pollo' }, motorViejo: true });   // con 'no como' que el plan puede romper
perfil(n++, { alta: -50, visto: -2, sub: 'active', push: true, premium: true });
perfil(n++, { alta: -50, visto: null, sub: 'active', ud: { nombre: null } });
perfil(n++, { alta: -5, sub: 'canceled', ud: { nombre: '' } });
for (let i = 0; i < 25; i++) perfil(n++, { alta: -Math.floor(az() * 90) - 2, visto: -Math.floor(az() * 25), sub: el(['active', 'trialing', 'past_due', 'canceled', null]), push: az() < 0.4, ud: { objetivo: el(['Perder grasa', 'Ganar músculo']), deporte: el(['Gimnasio / Fuerza', 'Running']) } });
perfil(n++, { alta: -28, visto: -1, sub: 'trialing', fin: 2, push: false });            // prueba termina en 2 días -> aviso hoy
perfil(n++, { alta: -20, visto: -1, sub: 'trialing', fin: 10 });                      // en 10 días -> aviso al día 7
perfil(n++, { alta: -28, visto: -1, sub: 'trialing', fin: 2, cancela: true });        // ya canceló -> NO
perfil(n++, { alta: -28, visto: -1, sub: 'trialing', fin: 2, premium: true });        // premium -> NO
perfil(n++, { alta: -28, visto: -1, sub: 'active', fin: 2 });                         // ya paga -> NO
// una con plan roto (null) y una con userdata nulo
T.profiles.push({ id: 'ux', nombre: 'Roto', email: 'roto@e.com', userdata: null, plan: null, created_at: iso(-12), last_seen: iso(-12), is_beta: false, beta_expires: null });
T.profiles.push({ id: 'uy', nombre: 'Roto2', email: 'roto2@e.com', userdata: {}, plan: { motorVersion: 'x' }, created_at: iso(-12), last_seen: iso(-12), is_beta: false, beta_expires: null });

function tabla(nombre) {
  const filas = T[nombre] || (T[nombre] = []);
  let sel = null, filtros = [], orden = null, lim = null, modo = 'select', datos = null;
  const cumple = f => filtros.every(([op, c, v, extra]) => {
    const x = f[c];
    if (op === 'eq') return x === v; if (op === 'neq') return x !== v; if (op === 'in') return v.includes(x);
    if (op === 'gte') return x >= v; if (op === 'lte') return x <= v; if (op === 'gt') return x > v; if (op === 'lt') return x < v;
    if (op === 'is') return v === null ? x == null : x === v;
    if (op === 'not') return extra === 'is' ? !(x == null) : true;
    return true;
  });
  const q = {
    select() { return q; }, order(c, o) { orden = [c, o]; return q; }, limit(n) { lim = n; return q; }, range() { return q; },
    eq(c, v) { filtros.push(['eq', c, v]); return q; }, neq(c, v) { filtros.push(['neq', c, v]); return q; }, in(c, v) { filtros.push(['in', c, v]); return q; },
    gte(c, v) { filtros.push(['gte', c, v]); return q; }, lte(c, v) { filtros.push(['lte', c, v]); return q; }, gt(c, v) { filtros.push(['gt', c, v]); return q; }, lt(c, v) { filtros.push(['lt', c, v]); return q; },
    is(c, v) { filtros.push(['is', c, v]); return q; }, not(c, op, v) { filtros.push(['not', c, v, op]); return q; }, or() { return q; },
    insert(d) { modo = 'insert'; datos = d; return q; }, upsert(d) { modo = 'upsert'; datos = d; return q; }, update(d) { modo = 'update'; datos = d; return q; }, delete() { modo = 'delete'; return q; },
    maybeSingle() { return q.then(r => ({ data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: r.error })); },
    single() { return q.maybeSingle(); },
    then(ok, ko) {
      let r;
      if (modo === 'insert') { const a = Array.isArray(datos) ? datos : [datos]; a.forEach(d => filas.push({ id: 'n' + filas.length, created_at: new RD(RD.now() + desfase).toISOString(), ...d })); r = { data: a, error: null }; }
      else if (modo === 'upsert') { const a = Array.isArray(datos) ? datos : [datos]; a.forEach(d => { const i = filas.findIndex(f => f.user_id === d.user_id); if (i >= 0) filas[i] = { ...filas[i], ...d }; else filas.push(d); }); r = { data: a, error: null }; }
      else if (modo === 'update') { filas.filter(cumple).forEach(f => Object.assign(f, datos)); r = { data: null, error: null }; }
      else if (modo === 'delete') { for (let i = filas.length - 1; i >= 0; i--) if (cumple(filas[i])) filas.splice(i, 1); r = { data: null, error: null }; }
      else { let d = filas.filter(cumple); if (orden) d = [...d].sort((a, b) => (a[orden[0]] > b[orden[0]] ? 1 : -1) * (orden[1] && orden[1].ascending === false ? -1 : 1)); if (lim) d = d.slice(0, lim); r = { data: d.map(x => ({ ...x })), error: null }; }
      return Promise.resolve(r).then(ok, ko);
    },
  };
  return q;
}
const ALMACEN = new Map(); for (const d of ['2026-08-01','2026-08-20','2026-09-20','2026-09-30']) ALMACEN.set('backup-'+d+'.json','viejo');
const fake = { storage: { from: () => ({ upload: async (n, c) => { ALMACEN.set(n, c); return { error: null }; }, list: async () => ({ data: [...ALMACEN.keys()].map(name => ({ name })), error: null }), remove: async (ns) => { ns.forEach(n => ALMACEN.delete(n)); return { error: null }; } }) }, from: tabla, rpc: async () => ({ data: true, error: null }), auth: { admin: { listUsers: async () => ({ data: { users: [] } }) }, getUser: async () => ({ data: { user: null }, error: { message: 'x' } }) } };
const rutaH = require.resolve(R + 'api/_stripeHelpers.js');
require.cache[rutaH] = { id: rutaH, filename: rutaH, loaded: true, exports: { getSupabaseAdmin: () => fake, getAuthUser: async () => null, getStripe: () => ({}), stripe: {} } };

// ---- Resend y push simulados
const enviados = []; const pushes = []; const fallos = [];
const fetchReal = global.fetch;
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('api.resend.com')) { const b = JSON.parse(opts.body); enviados.push({ dia: dias, a: b.to, asunto: b.subject, html: b.html || '' }); return { ok: true, status: 200, json: async () => ({ id: 'x' }), text: async () => '' }; }
  if (u.endsWith('/index.html')) return { ok: true, status: 200, text: async () => htmlApp };
  return fetchReal(url, opts);
};
const rutaWP = require.resolve(R + 'node_modules/web-push');
const wpOriginal = require(rutaWP);
wpOriginal.sendNotification = async (sub, payload) => { pushes.push({ dia: dias, ep: sub.endpoint, payload: JSON.parse(payload) }); return { statusCode: 201 }; };

const handler = require(R + 'api/notify.js');
let dias = 0;
(async () => {
  const logs = []; const cl = console.log, cw = console.warn, ce = console.error;
  for (dias = 0; dias < 8; dias++) {
    desfase = dias * dia + 9 * 3600000 - (RD.now() % dia);        // 09:00 UTC de cada día
    const res = { c: 200, status(c) { this.c = c; return this; }, json(o) { this.o = o; return this; } };
    console.log = (...a) => logs.push('L ' + a.join(' ')); console.warn = (...a) => logs.push('W ' + a.join(' ')); console.error = (...a) => logs.push('E ' + a.join(' '));
    const t0 = RD.now(); let exc = null;
    try { await handler({ method: 'GET', headers: { authorization: 'Bearer s3cret' }, query: {}, socket: {} }, res); } catch (e) { exc = e; }
    console.log = cl; console.warn = cw; console.error = ce;
    const nE = enviados.filter(e => e.dia === dias).length, nP = pushes.filter(p => p.dia === dias).length;
    console.log(`día ${dias} (${new RD(RD.now() + desfase).toLocaleDateString('es-ES', { weekday: 'short' })}): estado ${res.c}${exc ? ' EXCEPCIÓN ' + exc.message : ''} · emails ${nE} · push ${nP} · ${RD.now() - t0} ms · ${JSON.stringify(res.o || {}).slice(0, 90)}`);
  }
  // ---- análisis
  const errores = logs.filter(l => /^E /.test(l) && !/rate-limit/.test(l)); const avisos = [...new Set(logs.filter(l => /^W /.test(l) && !/rate-limit|VAPID|OMITIDO/.test(l)))];
  console.log('\nERRORES en logs:', errores.length ? '\n  ' + [...new Set(errores)].slice(0, 8).join('\n  ') : 'ninguno');
  console.log('AVISOS distintos:', avisos.length ? '\n  ' + avisos.slice(0, 8).map(x => x.slice(0, 160)).join('\n  ') : 'ninguno');
  const porTipo = {}; T.email_log.forEach(e => { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; }); console.log('email_log por tipo:', JSON.stringify(porTipo));
  const dup = {}; T.email_log.forEach(e => { const k = e.tipo + '|' + e.destinatario; dup[k] = (dup[k] || 0) + 1; });
  const repetidos = Object.entries(dup).filter(([k, v]) => v > 1 && !/resumen_semanal|auditoria|aviso_diario|push|digest_admin/.test(k)).slice(0, 8);
  console.log('mismo email al mismo cliente más de una vez en 8 días:', repetidos.length ? repetidos.map(([k, v]) => k + ' ×' + v).join(', ') : 'ninguno');
  const rotos = enviados.filter(e => /undefined|NaN|\[object Object\]|null\b/.test(e.html + e.asunto)); console.log('emails con texto roto:', rotos.length, rotos.slice(0, 3).map(e => e.asunto + ' → ' + (e.html.match(/.{20}(undefined|NaN|\[object|null\b).{15}/) || [''])[0]));
  const sinEsc = enviados.filter(e => /<b>Eva<\/b>/.test(e.html)); console.log('emails con HTML del nombre sin escapar:', sinEsc.length);
  const pc = T.email_log.filter(e => e.tipo === 'aviso_primer_cobro'); console.log('avisos de primer cobro:', pc.length, pc.map(e => e.destinatario + ' [' + e.asunto + ']').join(' | ')); const hpc = enviados.filter(e => /mes gratis termina/.test(e.asunto)); console.log('  emails enviados:', hpc.length, '· menciona 7,99 €:', hpc.every(e => /7,99/.test(e.html)), '· días de envío:', hpc.map(e => e.dia).join(','), '· texto roto:', hpc.some(e => /undefined|NaN/.test(e.html)));
const porDia = {}; pushes.forEach(p => { porDia[p.dia] = (porDia[p.dia] || 0) + 1; });
  const sinTitulo = pushes.filter(p => !p.payload.title || !p.payload.body || /undefined|NaN/.test(p.payload.body + p.payload.title)); console.log('push rotos:', sinTitulo.length, '· ejemplo:', JSON.stringify(pushes[0] && pushes[0].payload));
  const actual = motor.huella(); const conMotorViejo = T.profiles.filter(p => p.plan && p.plan.motorVersion !== actual).length; console.log(`planes con motor anterior tras 8 días: ${conMotorViejo} de ${T.profiles.filter(p => p.plan).length}`);
  const rev = T.profiles.find(p => p.userdata && p.userdata.noComida === 'pollo'); console.log('cliente "no como pollo": plan con pollo =', /pollo/i.test(JSON.stringify(rev.plan.nutricionPorDia)));
  const copias=[...ALMACEN.keys()]; console.log('copias en el bucket al final:', copias.join(', ')); const ult=JSON.parse(ALMACEN.get(copias[copias.length-1])); console.log('última copia: clientes', ult.totalClientes, '· claves', Object.keys(ult).join(','), '· plan dentro de profiles:', ult.profiles.some(p=>'plan' in p), '· KB', Math.round(ALMACEN.get(copias[copias.length-1]).length/1024));
console.log('auditorias_clientes abiertas:', T.auditorias_clientes.length);
  const malos = [];
  if (errores.length) malos.push('errores en los logs del cron');
  if (repetidos.length) malos.push('email repetido al mismo cliente');
  if (rotos.length) malos.push('emails con texto roto');
  if (sinEsc.length) malos.push('emails con HTML sin escapar');
  if (sinTitulo.length) malos.push('push rotos');
  if (pc.length !== 1 || !hpc.every(e => /7,99/.test(e.html))) malos.push('aviso de primer cobro: ' + pc.length + ' enviados (debía ser 1, con el precio)');
  if (conMotorViejo > 1) malos.push(conMotorViejo + ' planes siguen con el motor anterior (solo se admite el cliente sin datos)');
  if (/pollo/i.test(JSON.stringify(rev.plan.nutricionPorDia))) malos.push('el plan de no como pollo sigue llevando pollo');
  if (ult.profiles.some(p => 'plan' in p)) malos.push('la copia de seguridad lleva planes');
  const aSinTarjeta = T.email_log.filter(e => e.destinatario === sinTarjeta.email).map(e => e.tipo);
  console.log('cliente parado en la tarjeta recibe:', aSinTarjeta.join(', ') || 'nada');
  if (!aSinTarjeta.includes('retencion_tarjeta')) malos.push('quien hizo el cuestionario y no metió la tarjeta no recibe el email de la tarjeta');
  if (aSinTarjeta.includes('retencion_dia3')) malos.push('a quien ya hizo el cuestionario se le pide que lo complete');
  console.log('\n' + (malos.length ? '✘ ' + malos.join(' · ') : '✔ Cron correcto'));
  process.exit(malos.length ? 1 : 0);
})().catch(e => { console.log = console.__proto__.log; console.log('FALLO DEL SCRIPT', e.stack); });
