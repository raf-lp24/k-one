// Prueba del aviso de fin de descanso (tipo 'descanso' en api/notify.js) con
// Supabase y web-push simulados: un aviso que llega, otro que se anula a mitad
// del descanso y no debe llegar, y las validaciones.
//   node scripts/probar-descanso.js   (lo pasa npm test y GitHub Actions)
const R = require('path').join(__dirname, '..') + '/';
process.env.VAPID_PUBLIC_KEY = 'x'; process.env.VAPID_PRIVATE_KEY = 'y';
process.env.SUPABASE_URL = 'http://x'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';

const fichas = new Set();
const pushes = [];
const supa = {
  rpc: async (fn, a) => {
    if (fn !== 'check_rate_limit') return { data: true, error: null };
    if (a.p_limite !== 1) return { data: true, error: null };          // el límite por hora: siempre libre
    const k = a.p_clave + '|' + a.p_ventana;
    if (fichas.has(k)) return { data: false, error: null };
    fichas.add(k); return { data: true, error: null };
  },
  from: () => { const q = { select() { return q; }, eq() { return q; }, delete() { return q; }, then(ok) { return Promise.resolve({ data: [{ id: 's1', endpoint: 'https://push/1', p256dh: 'p', auth_key: 'a' }], error: null }).then(ok); } }; return q; },
};
const rutaH = require.resolve(R + 'api/_stripeHelpers.js');
require.cache[rutaH] = { id: rutaH, filename: rutaH, loaded: true, exports: {
  getSupabaseAdmin: () => supa, getAuthUser: async (req) => (req.headers.authorization ? { id: 'u1', email: 'c@e.com' } : null),
  getStripe: () => ({}), tieneMetodoPago: async () => false,
} };
const wp = require(R + 'node_modules/web-push');
wp.setVapidDetails = () => {};
wp.sendNotification = async (sub, payload) => { pushes.push(JSON.parse(payload)); return { statusCode: 201 }; };

const handler = require(R + 'api/notify.js');
const llamar = (body, auth = true) => new Promise(resolve => {
  const res = { c: 200, status(c) { this.c = c; return this; }, json(o) { resolve({ c: this.c, o }); return this; } };
  handler({ method: 'POST', headers: auth ? { authorization: 'Bearer t' } : {}, body, query: {}, socket: {} }, res);
});

let fallos = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fallos++; };
(async () => {
  const id1 = Date.now() + '-abc123', id2 = (Date.now() + 1) + '-def456';
  console.log('Validaciones');
  ok((await llamar({ tipo: 'descanso', id: id1, segundos: 60 }, false)).c === 401, 'sin sesión → 401');
  ok((await llamar({ tipo: 'descanso', id: 'malo', segundos: 60 })).c === 400, 'id raro → 400');
  ok((await llamar({ tipo: 'descanso', id: id1, segundos: 999 })).c === 400, 'más de 280 s → 400');

  console.log('Un aviso que llega y otro que se anula (5 s de descanso)');
  const t0 = Date.now();
  const llega = llamar({ tipo: 'descanso', id: id1, segundos: 5, titulo: 'Se acabó el descanso', cuerpo: 'Serie 3 de <b>Press</b> · 35 kg. ¡Vamos!' });
  const anulado = llamar({ tipo: 'descanso', id: id2, segundos: 5 });
  await new Promise(r => setTimeout(r, 1500));
  await llamar({ tipo: 'descanso', accion: 'cancelar', id: id2 });
  const [r1, r2] = await Promise.all([llega, anulado]);
  const seg = (Date.now() - t0) / 1000;
  ok(r1.o.enviados === 1 && pushes.length === 1, 'el aviso no anulado se envía (1 push)');
  ok(seg >= 6 && seg < 9, 'llega al acabar el descanso (+1,5 s), no antes: ' + seg.toFixed(1) + ' s');
  ok(r2.o.cancelado === true, 'el anulado no se envía');
  const p = pushes[0] || {};
  ok(p.tag === 'kone-descanso' && p.url === '/?sesion=1', 'etiqueta propia y abre la sesión al tocarla');
  ok(p.title === 'Se acabó el descanso' && !/[<>]/.test(p.body), 'texto limpio, sin < >: ' + p.body);
  console.log('\n' + (fallos ? '✘ ' + fallos + ' fallos' : '✔ Todo bien'));
  process.exit(fallos ? 1 : 0);
})();
