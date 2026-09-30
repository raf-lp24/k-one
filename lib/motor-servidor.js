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

function crearMotor(html) {
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
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(codigo, ctx, { timeout: 20000, filename: 'index.html' });
  if (typeof ctx.buildPlanFromData !== 'function') throw new Error('buildPlanFromData no encontrado en index.html');
  const correr = (src, vars) => { ctx.__in = vars; return vm.runInContext(src, ctx, { timeout: 20000 }); };
  return {
    // Huella del motor actual (la misma que calcula la app).
    huella: () => correr('_huellaMotor()'),
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
  const url = (appUrl || process.env.APP_URL || 'https://k-one.fit').replace(/\/$/, '') + '/index.html';
  const r = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error('no se pudo leer ' + url + ': ' + r.status);
  const motor = crearMotor(await r.text());
  _cache = { motor, en: Date.now() };
  return motor;
}

// Regenera y GUARDA el plan de un cliente con el motor actual. Devuelve true si
// lo ha cambiado. No toca clientes sin datos básicos ni planes ya al día.
async function actualizarPlanCliente(supa, perfil, motor, { forzar = false } = {}) {
  const ud = perfil.userdata || {};
  if (!ud.peso || !ud.altura || !ud.edad) return false;
  const huella = motor.huella();
  if (!forzar && perfil.plan && perfil.plan.motorVersion === huella) return false;
  const nuevo = motor.generar(ud);
  // Mismo motor y mismos platos: no hay nada que escribir.
  if (perfil.plan && JSON.stringify(perfil.plan.nutricionPorDia) === JSON.stringify(nuevo.nutricionPorDia)
      && JSON.stringify(perfil.plan.semana) === JSON.stringify(nuevo.semana)
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

module.exports = { crearMotor, obtenerMotor, actualizarPlanCliente, conservarElecciones };
