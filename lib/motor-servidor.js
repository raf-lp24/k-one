// ============================================================================
// MOTOR EN EL SERVIDOR (30 sept 2026)
//
// El motor de planes (buildPlanFromData) vive en el <script> de index.html y
// hasta ahora solo corría en el navegador del cliente: si arreglábamos un
// filtro (alergias, sal...), el plan guardado de un cliente no se ponía al día
// hasta que ese cliente abría la app, y mientras tanto podía ver platos que nos
// había dicho que no puede comer.
//
// Aquí se ejecuta ESE MISMO código (no una copia) dentro de un contexto aislado
// de Node, con un "navegador" de mentira: cualquier cosa del DOM, de Supabase o
// de la red devuelve un objeto inerte que no hace nada. Así el servidor puede
// regenerar un plan exactamente igual que lo haría la app.
//
// El código se lee de la web publicada (APP_URL/index.html), así que siempre es
// la última versión desplegada.
// ============================================================================
const vm = require('vm');

// Objeto "hace-de-todo": se puede llamar, construir, leer y escribir sin que
// pase nada. Sustituye al DOM, a Supabase y a cualquier API del navegador.
function _inerte() {
  const f = function () { return proxy; };
  const proxy = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;             // no es una promesa
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      if (k === 'style' || k === 'dataset' || k === 'classList') return proxy;
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
    has() { return true; },
  });
  return proxy;
}

function _extraerScript(html) {
  // El navegador convierte los CRLF del HTML en LF al leer el <script>: igual aquí,
  // o la huella del motor no coincidiría con la de la app.
  html = html.replace(/\r\n?/g, '\n');
  const bloques = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!bloques.length) throw new Error('index.html sin <script>');
  // El del motor es, con diferencia, el más grande.
  return bloques.sort((a, b) => b.length - a.length)[0];
}

// `ahora` (opcional, ms): fija el reloj del motor, para probar la semana de
// carrera con la carrera en cualquier día de la semana (scripts/auditar-entreno.js).
function crearMotor(html, { ahora } = {}) {
  // index.html ligero (código en /app.js desde el 25 oct 2026): en local se completa
  // con el app.js de al lado, así `crearMotor(fs.readFileSync('index.html'))` sigue
  // valiendo. En el servidor ya llega completo desde obtenerMotor().
  const { ETIQUETA, juntar } = require('./fuente-app');
  if (html.includes(ETIQUETA)) {
    const fApp = require('path').join(__dirname, '..', 'app.js');
    if (!require('fs').existsSync(fApp)) throw new Error('index.html sin el código de la app: falta app.js');
    html = juntar(html, require('fs').readFileSync(fApp, 'utf8'));
  }
  const codigo = _extraerScript(html);
  const almacen = new Map();
  const localStorage = {
    getItem: k => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => { almacen.set(k, String(v)); },
    removeItem: k => { almacen.delete(k); },
    clear: () => almacen.clear(),
    key: i => [...almacen.keys()][i] || null,
    get length() { return almacen.size; },
  };
  const nada = _inerte();
  const sandbox = {
    console: { log() {}, info() {}, debug() {}, warn() {}, error() {} },
    localStorage, sessionStorage: localStorage,
    document: nada, navigator: nada, screen: nada, history: nada,
    location: { hostname: 'k-one.fit', href: 'https://k-one.fit/', origin: 'https://k-one.fit', pathname: '/', search: '', hash: '', reload() {} },
    supabase: nada, gtag: () => {}, dataLayer: [],
    fetch: () => new Promise(() => {}),
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    IntersectionObserver: function () { return nada; }, MutationObserver: function () { return nada; },
    ResizeObserver: function () { return nada; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }),
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    Notification: nada, caches: nada, indexedDB: nada, Event: function () {}, CustomEvent: function () {},
    getComputedStyle: () => nada, scrollTo: () => {}, alert: () => {}, confirm: () => true,
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
    atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
    Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
    // El reloj del proceso (1 nov 2026): en producción es el mismo, y así el
    // cron simulado (scripts/probar-cron.js) mueve también el «hoy» del motor
    // (lunes del plan, semana de carrera) y no solo el del cron.
    Date,
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  if (Number.isFinite(ahora)) {
    vm.runInContext(`(() => { const R = Date, T = ${ahora};
      class F extends R { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
      globalThis.Date = F; })()`, ctx);
  }
  vm.runInContext(codigo, ctx, { timeout: 20000, filename: 'index.html' });
  if (typeof ctx.buildPlanFromData !== 'function') throw new Error('buildPlanFromData no encontrado en index.html');
  const correr = (src, vars) => { ctx.__in = vars; return vm.runInContext(src, ctx, { timeout: 20000 }); };
  return {
    // Huella del motor actual (la misma que calcula la app).
    huella: () => correr('_huellaMotor()'),
    // Pasos de receta por nombre (RECETA_PASOS), para auditar también la
    // preparación de los platos que no traen `pasos` propios (scripts/auditar-filtros.js).
    pasosReceta: () => JSON.parse(correr('JSON.stringify(RECETA_PASOS)')),
    // Genera el plan de un cliente. `userData` es profiles.userdata tal cual.
    generar(userData) {
      localStorage.removeItem('k1_current_user'); // la semana sale de userData.progreso
      return JSON.parse(correr('userData = JSON.parse(__in); JSON.stringify(buildPlanFromData(userData))', JSON.stringify(userData || {})));
    },
  };
}

// Conserva lo que el cliente ya había elegido esa semana (igual que
// _actualizarPlanAlMotor de index.html): las elecciones van por índice, así que
// se vuelven a buscar por NOMBRE; si un plato ya no existe, esa toma vuelve a la
// primera opción y el día deja de estar confirmado.
function conservarElecciones(userData, viejo, nuevo) {
  const u = { ...userData };
  const sem = Array.isArray(u.comidasSemana) && u.comidasSemana.length === 7 ? u.comidasSemana : null;
  if (!sem || !viejo || !Array.isArray(viejo.nutricionPorDia) || !Array.isArray(nuevo.nutricionPorDia)) return u;
  const conf = Array.isArray(u.diasConfirmados) && u.diasConfirmados.length === 7 ? [...u.diasConfirmados] : null;
  u.comidasSemana = sem.map((idxs, d) => {
    const tomasV = viejo.nutricionPorDia[d] || [], tomasN = nuevo.nutricionPorDia[d] || [];
    let cambio = false;
    const res = tomasN.map(mN => {
      const posV = tomasV.findIndex(x => x.momento === mN.momento);
      const mV = posV >= 0 ? tomasV[posV] : null;
      const iV = posV >= 0 && Array.isArray(idxs) ? (idxs[posV] || 0) : 0;
      const nombre = mV && mV.opciones && mV.opciones[iV] ? mV.opciones[iV].nombre : null;
      const iN = nombre ? (mN.opciones || []).findIndex(o => o.nombre === nombre) : -1;
      if (iN < 0) { cambio = true; return 0; }
      return iN;
    });
    if (cambio && conf) conf[d] = false;
    return res;
  });
  if (conf) u.diasConfirmados = conf;
  return u;
}

// Un motor por instancia de la función (se reutiliza entre peticiones), y se
// vuelve a leer la web cada 10 minutos por si hay un despliegue nuevo.
let _cache = null;
async function obtenerMotor(appUrl) {
  if (_cache && Date.now() - _cache.en < 10 * 60 * 1000) return _cache.motor;
  const base = (appUrl || process.env.APP_URL || 'https://k-one.fit').replace(/\/$/, '');
  const url = base + '/index.html';
  const r = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error('no se pudo leer ' + url + ': ' + r.status);
  let html = await r.text();
  // Desde el 25 oct 2026 el código de la app está en /app.js (ver lib/fuente-app.js):
  // se descarga y se vuelve a meter en su sitio, igual que lo ve el navegador.
  const { ETIQUETA, juntar } = require('./fuente-app');
  if (html.includes(ETIQUETA)) {
    const ra = await fetch(base + '/app.js', { headers: { 'Cache-Control': 'no-cache' } });
    if (!ra.ok) throw new Error('no se pudo leer ' + base + '/app.js: ' + ra.status);
    html = juntar(html, await ra.text());
  }
  const motor = crearMotor(html);
  _cache = { motor, en: Date.now() };
  return motor;
}

// SEMANA DEL PLAN (1 nov 2026), igual que getSemanaActual() de la app: se
// cuenta desde el inicio del período de Stripe si paga, y si no desde que se
// registró. `perfil` lleva userdata, created_at, is_beta y beta_expires; `sub`
// es su fila de subscriptions (o null). Así el cron rehace el entreno al
// cambiar de semana aunque el cliente no abra la app, y el aviso del día no
// anuncia la sesión de la semana anterior.
function semanaDelCliente(perfil, sub, ahora = Date.now()) {
  const ud = perfil.userdata || {};
  const esBeta = !!perfil.is_beta && !(perfil.beta_expires && new Date(perfil.beta_expires).getTime() < ahora);
  const activa = (!!sub && ['active', 'trialing'].includes(sub.status)) || esBeta;
  const ref = (activa && !esBeta && sub && sub.current_period_start)
    ? sub.current_period_start
    : ((ud._cuenta && ud._cuenta.creado) || perfil.created_at);
  if (!ref) return (ud.progreso && ud.progreso.semana) || 1;
  const dias = (ahora - new Date(ref).getTime()) / 86400000;
  return Math.max(1, Math.floor(dias / 7) + 1);
}

// Lunes de esta semana en España (AAAA-MM-DD), el mismo `lunesPlan` que guarda el motor.
function lunesMadrid(ahora = Date.now()) {
  const d = new Date(new Date(ahora).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ¿El plan guardado es de otra semana? Los planes de antes del 1 nov 2026 no
// llevan semanaPlan/lunesPlan: esos se rehacen igual por la huella del motor.
function planDeOtraSemana(plan, semana, ahora = Date.now()) {
  return !!plan && (plan.semanaPlan !== semana || plan.lunesPlan !== lunesMadrid(ahora));
}

// Regenera y GUARDA el plan de un cliente con el motor actual. Devuelve true si
// lo ha cambiado. No toca clientes sin datos básicos ni planes ya al día.
// `semana` (opcional, de semanaDelCliente): si el plan es de otra semana, se
// rehace con esa semana aunque el motor sea el mismo. No se escribe en
// userdata.progreso: la app la recalcula al abrir y así no se pisa nada.
async function actualizarPlanCliente(supa, perfil, motor, { forzar = false, semana = null } = {}) {
  const ud = perfil.userdata || {};
  if (!ud.peso || !ud.altura || !ud.edad) return false;
  const huella = motor.huella();
  const otraSemana = semana !== null && planDeOtraSemana(perfil.plan, semana);
  if (!forzar && !otraSemana && perfil.plan && perfil.plan.motorVersion === huella) return false;
  const udGen = semana !== null ? { ...ud, progreso: { diasEntrenados: 0, ajuste: 0, ...(ud.progreso || {}), semana } } : ud;
  const nuevo = motor.generar(udGen);
  // Mismo motor, misma semana y mismos platos: no hay nada que escribir.
  if (perfil.plan && JSON.stringify(perfil.plan.nutricionPorDia) === JSON.stringify(nuevo.nutricionPorDia)
      && JSON.stringify(perfil.plan.semana) === JSON.stringify(nuevo.semana)
      && perfil.plan.semanaPlan === nuevo.semanaPlan && perfil.plan.lunesPlan === nuevo.lunesPlan
      && perfil.plan.motorVersion === huella) return false;
  // Lo generó el servidor: si la app abierta del cliente es de una versión
  // anterior, verá esta marca y recargará la página en vez de "rebajar" el plan.
  nuevo.motorServidor = huella;
  const udNuevo = conservarElecciones(ud, perfil.plan, nuevo);
  // userdata solo se escribe si cambian sus elecciones de comida: así no se pisa
  // nada que el cliente esté guardando a la vez (pesos, check-in...).
  const cambiaUd = JSON.stringify(udNuevo.comidasSemana) !== JSON.stringify(ud.comidasSemana)
    || JSON.stringify(udNuevo.diasConfirmados) !== JSON.stringify(ud.diasConfirmados);
  const cambios = { plan: nuevo, saved_at: new Date().toISOString() };
  if (cambiaUd) cambios.userdata = udNuevo;
  const { error } = await supa.from('profiles').update(cambios).eq('id', perfil.id);
  if (error) throw new Error('guardando plan: ' + error.message);
  perfil.userdata = udNuevo; perfil.plan = nuevo;
  return true;
}

module.exports = { crearMotor, obtenerMotor, actualizarPlanCliente, conservarElecciones, semanaDelCliente, lunesMadrid, planDeOtraSemana };
