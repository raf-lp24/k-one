// Graba el vídeo demo (4 oct 2026, área de clientes NUEVA: barra inferior y
// modo entrenamiento serie a serie) con la app REAL:
// abre la web en Chrome headless (Emulation de móvil 390x844), monta el cliente
// de demo de estado-demo-hoy.js (datos inventados, nunca de un cliente real) y
// recorre las pantallas con scroll suave, poniendo un rótulo abajo en cada
// escena. Se captura fotograma a fotograma (determinista) y se monta con ffmpeg.
//
//   node marketing/grabar-demo-oct.mjs [url] [salida.mp4] [dpr]
//     url     por defecto http://localhost:8080/  (sirve la carpeta del proyecto)
//     salida  por defecto marketing/Videos/demo-octubre.mp4
//     dpr     por defecto 2  (780x1688 de vídeo)
//
// El día de la demo se fija en un LUNES (Torso A) para que "Hoy" enseñe una
// sesión de verdad y no un día de descanso. El vídeo de antes (grabar-demo.mjs,
// demo-septiembre.mp4) enseña el área de clientes de antes del 2 oct.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [url = 'http://localhost:8080/', salidaArg, dprArg = '2'] = process.argv.slice(2);
const salida = path.resolve(salidaArg || path.join(AQUI, 'Videos', 'demo-octubre.mp4'));
const DPR = +dprArg, W = 390, H = 844, FPS = 25;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const dirFrames = path.join(process.env.TEMP, 'kone-demo-frames');
fs.rmSync(dirFrames, { recursive: true, force: true });
fs.mkdirSync(dirFrames, { recursive: true });
fs.mkdirSync(path.dirname(salida), { recursive: true });

const PUERTO = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PUERTO,
  '--user-data-dir=' + process.env.TEMP + '/cdp-demo-' + PUERTO,
  'about:blank'
], { stdio: 'ignore' });
const esperar = ms => new Promise(r => setTimeout(r, ms));
const cerrar = () => { try { process.kill(chrome.pid); } catch (e) {} };
process.on('exit', cerrar);

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    wsUrl = lista.find(t => t.type === 'page')?.webSocketDebuggerUrl || null;   // no la background_page
  } catch (e) {}
  if (!wsUrl) await esperar(250);
}
if (!wsUrl) { console.error('Chrome no respondió'); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};

await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
await cmd('Page.enable'); await cmd('Runtime.enable');
// Reloj falso: un lunes a media mañana (antes de que arranque ningún script).
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const RD = Date, off = new RD('2026-10-05T10:30:00').getTime() - RD.now();
  window.Date = class extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } };
})();` });
await cmd('Page.navigate', { url });
await esperar(4000);

// Estado de demo (cliente inventado) + estilos del rótulo.
const estado = fs.readFileSync(path.join(AQUI, 'estado-demo-hoy.js'), 'utf8');
console.error('estado ->', await ev(estado));
// Hoy sin entrenar todavía (el historial de la demo incluye el lunes), con la
// marca anterior del press de banca para que la sesión enseñe "la última vez",
// y la pantalla del panel como pantalla activa para que salga la barra de abajo.
console.error('preparar ->', await ev(`(async () => {
  const hoy = getFechaHoyISO();
  userData.entrenosCompletados = (userData.entrenosCompletados || []).filter(f => f !== hoy);
  userData.historialEntrenos = (userData.historialEntrenos || []).filter(f => f !== hoy);
  Object.keys(localStorage).filter(k => k.startsWith('kone_sesion_')).forEach(k => localStorage.removeItem(k));
  localStorage.setItem('kone_hint_descanso', '1');
  const d = 86400000, f = t => new Date(t).toISOString().slice(0, 10);
  const h = [50, 52.5, 55, 57.5].map((p, i) => ({ fecha: f(Date.now() - (4 - i) * 7 * d), peso: p }));
  userData.pesosEjercicios = Object.assign({}, userData.pesosEjercicios, {
    'press de banca o mancuernas': { nombre: 'Press de banca o mancuernas', peso: 57.5, fecha: h[3].fecha, pesoAnterior: 55, historial: h }
  });
  ['pwaInstallBanner', 'pushInstallBanner'].forEach(id => { const b = document.getElementById(id); if (b) b.remove(); });
  document.getElementById('landing').classList.remove('active');
  document.getElementById('dashboard').classList.add('active');
  buildDashboard(); showSection('hoy'); window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 600));
  return 'ejercicios hoy: ' + document.querySelectorAll('#todayContent .ejercicio-card').length + ' · barra: ' + getComputedStyle(document.querySelector('.tabbar')).display;
})()`));
await ev(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  document.body.style.scrollBehavior = 'auto';
  const st = document.createElement('style');
  st.textContent = \`
    #demoCap { position: fixed; left: 14px; right: 14px; bottom: 92px; z-index: 99999; padding: 13px 16px 14px;
      background: rgba(10,10,10,.92); border: 1px solid rgba(232,73,15,.55); border-left: 4px solid #E8490F; border-radius: 10px;
      font: 700 15.5px/1.35 Inter, system-ui, sans-serif; color: #F4F1EC; letter-spacing: .1px; pointer-events: none; }
    #demoCap small { display: block; margin-top: 3px; font: 500 12.5px/1.35 Inter, sans-serif; color: #BEB7AF; }
    #demoFin { position: fixed; inset: 0; z-index: 100000; background: #0A0A0A; display: none; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; gap: 16px; padding: 30px; pointer-events: none; }
    #demoFin .lg { display: flex; align-items: center; gap: 10px; font: 400 66px/.82 'Bebas Neue', Impact, sans-serif; letter-spacing: 2px; color: #F0EDE8; -webkit-text-stroke: 1.3px currentColor; }
    #demoFin .lg svg { height: 40px; width: auto; }
    #demoFin .lg b { color: #F0571C; font-weight: 400; }
    #demoFin .lema { font: 700 10.5px/1 Inter, sans-serif; letter-spacing: 2.4px; color: #9A968F; margin-top: -6px; }
    #demoFin .t1 { font: 400 30px/1.05 'Bebas Neue', Impact, sans-serif; letter-spacing: 1px; color: #F4F1EC; }
    #demoFin .t2 { font: 500 14px/1.5 Inter, sans-serif; color: #BEB7AF; }
    #demoFin .bt { margin-top: 10px; padding: 14px 26px; background: #D1420E; color: #fff; border-radius: 8px; font: 700 15px Inter, sans-serif; letter-spacing: 1px; }
  \`;
  document.head.appendChild(st);
  const c = document.createElement('div'); c.id = 'demoCap'; c.style.display = 'none'; document.body.appendChild(c);
  const f = document.createElement('div'); f.id = 'demoFin';
  const pesa = '<svg viewBox="0 0 200 170"><polygon fill="#F0EDE8" points="2,85 34,74 34,96"/><rect fill="#F0571C" x="36" y="26" width="22" height="118" rx="4"/><rect fill="#F0571C" x="62" y="2" width="28" height="166" rx="4"/><rect fill="#F0EDE8" x="90" y="79" width="78" height="12"/><polygon fill="#F0571C" stroke="#F0571C" stroke-linejoin="round" points="160,56 198,85 160,114"/></svg>';
  f.innerHTML = '<div class="lg">' + pesa + '<span>K-<b>ONE</b></span></div><div class="lema">NO HAY ATAJOS · HAY PASOS</div><div class="t1">Tu plan de entrenamiento<br>y nutrición, cada semana</div><div class="t2">Gimnasio · Running · Híbrido · Solo nutrición</div><div class="bt">30 DÍAS GRATIS · SIN TARJETA</div><div class="t2">k-one.fit</div>';
  document.body.appendChild(f);
  window.__cap = (t, s, arriba) => { const c = document.getElementById('demoCap'); if (!t) { c.style.display = 'none'; return; } c.style.display = 'block'; c.style.top = arriba ? '64px' : 'auto'; c.style.bottom = arriba ? 'auto' : '92px'; c.innerHTML = t + (s ? '<small>' + s + '</small>' : ''); };
  // Scroll de la página o, dentro de un modal, de su capa desplazable.
  window.__sc = null;
  window.__scrollTo = y => { (window.__sc || window).scrollTo(0, y); };
  window.__y = () => window.__sc ? window.__sc.scrollTop : window.scrollY;
  window.__pos = (sel, margen) => { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent !== null); return e ? Math.max(0, Math.round(e.getBoundingClientRect().top + scrollY - (margen ?? 70))) : -1; };
  window.__posTxt = (txt, margen) => {
    const re = new RegExp(txt, 'i');
    const e = [...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x => x.offsetParent !== null && x.children.length < 3 && x.textContent.trim().length < 60 && re.test(x.textContent));
    return e ? Math.max(0, Math.round(e.getBoundingClientRect().top + scrollY - (margen ?? 70))) : -1;
  };
  // La capa desplazable más alta de un modal abierto (ficha de ejercicio, lista de la compra).
  window.__modalScroller = () => {
    const cand = [...document.querySelectorAll('#modalInfoEjercicio *, .modal-overlay.visible *')].filter(e => e.scrollHeight > e.clientHeight + 80 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && e !== document.body && e !== document.documentElement && e.offsetParent !== null);
    cand.sort((a, b) => b.scrollHeight - a.scrollHeight);
    return cand[0] || null;
  };
  return document.fonts.ready.then(() => 'fuentes listas');
})()`);
await esperar(600);

// ---------------------------------------------------------------- guion
// Cada escena: sección, rótulo y una lista de "paradas" (scroll a un selector o
// a un Y absoluto) con segundos de movimiento y de pausa en cada una.
const ESCENAS = [
  { sec: 'hoy', cap: ['Tu día, de un vistazo', 'la sesión que toca hoy y tus comidas'],
    paradas: [{ y: 0, pausa: 2.6 }, { sel: '#hoyComidas', margen: 90, mueve: 2.2, pausa: 2.2 }] },
  // Modo entrenamiento: se abre desde "Empezar entrenamiento"
  { sec: 'hoy', arriba: true, cap: ['Entrenas serie a serie', 'con el peso de la última vez a la vista'],
    antes: `(async () => { window.scrollTo(0, 0); empezarEntrenamientoHoy(); await new Promise(r => setTimeout(r, 900)); return document.getElementById('sesionModo').classList.contains('abierta'); })()`,
    paradas: [
      { y: 0, pausa: 2.2 },
      { js: `sesKg(2.5)`, pausa: 1.2 },
      { js: `sesMarcar(0)`, pausa: 0.3 }] },
  { sec: 'hoy', arriba: true, cap: ['Y el descanso, cronometrado', 'te avisa cuando toca la siguiente serie'],
    paradas: [{ y: 0, pausa: 2.6 },
      { js: `sesDescansoFin()`, pausa: 0.6 },
      { js: `sesMarcar(1)`, pausa: 0.4 },
      { js: `sesDescansoFin()`, pausa: 1.6 }],
    despues: `(() => { sesCerrar(); Object.keys(localStorage).filter(k => k.startsWith('kone_sesion_')).forEach(k => localStorage.removeItem(k)); })()` },
  { sec: 'semana', cap: ['Tu semana completa', 'cada día con su sesión y sus ejercicios'],
    paradas: [{ y: 0, pausa: 1.6 }, { sel: '.week-day-row.today', margen: 80, mueve: 2.0, pausa: 1.6 }] },
  { sec: 'semana', cap: ['¿No sabes cómo se hace?', 'fotos, músculos y pasos, sin salir de la app'],
    antes: `(async () => { const b = document.querySelector('#section-semana button[onclick*=abrirInfoEjercicio]'); b.click(); await new Promise(r => setTimeout(r, 1500)); window.__sc = window.__modalScroller(); return !!window.__sc; })()`,
    paradas: [{ y: 0, pausa: 2.2 }, { y: 520, mueve: 2.4, pausa: 1.4 }],
    despues: `(() => { window.__sc = null; document.getElementById('modalInfoEjercicio').classList.remove('visible'); })()` },
  { sec: 'nutricion', cap: ['5 opciones por comida', 'con los macros de cada plato'],
    paradas: [{ y: 0, pausa: 1.2 }, { sel: '.meal-block', margen: 80, mueve: 2.2, pausa: 2.0 }, { dy: 560, mueve: 2.4, pausa: 1.6 }] },
  { sec: 'nutricion', cap: ['Tu lista de la compra, automática', 'todo lo de la semana, sumado y por categorías'],
    antes: `(async () => { generarListaCompra(); await new Promise(r => setTimeout(r, 900)); window.__sc = window.__modalScroller(); return !!window.__sc; })()`,
    paradas: [{ y: 0, pausa: 2.2 }, { y: 760, mueve: 2.6, pausa: 1.4 }],
    despues: `(() => { window.__sc = null; document.querySelectorAll('.modal-overlay').forEach(e => e.remove()); })()` },
  { sec: 'checkin', cap: ['Cada semana, tu check-in', 'y el plan siguiente se ajusta a ti'],
    antes: `(() => { try {
      document.getElementById('checkinPeso').value = '78.6'; document.getElementById('checkinCintura').value = '84';
      const pick = (id, i) => { const e = document.querySelectorAll('#' + id + ' > *')[i]; if (e) e.click(); };
      pick('rating-dias', 3); pick('rating-fisico', 2); pick('rating-energia', 3); pick('rating-mente', 2);
    } catch (e) {} })()`,
    paradas: [{ y: 0, pausa: 1.4 }, { y: 430, mueve: 2.0, pausa: 2.2 }] },
  { sec: 'progreso', cap: ['Tu progreso, en números', 'cargas que suben, peso y constancia'],
    antes: `(() => {
      const dia = 86400000, ahora = Date.now(), iso = t => new Date(t).toISOString();
      userData.historialPeso = [76.4, 76.9, 77.3, 77.8, 78.2, 78.5, 78.9, 79].map((p, i) => ({ fecha: iso(ahora - (7 - i) * 7 * dia), peso: p, semana: i + 1 }));
      const serie = (base, paso) => [0, 1, 2, 3, 4, 5].map(i => ({ fecha: new Date(ahora - (5 - i) * 7 * dia).toISOString().slice(0, 10), peso: base + paso * i }));
      const ent = (nombre, base, paso) => { const h = serie(base, paso); const u = h[h.length - 1], a = h[h.length - 2]; return { nombre, peso: u.peso, fecha: u.fecha, pesoAnterior: a.peso, historial: h }; };
      userData.pesosEjercicios = {
        'press de banca o mancuernas': ent('Press de banca', 50, 2.5), 'sentadilla': ent('Sentadilla', 60, 5),
        'remo con barra': ent('Remo con barra', 45, 2.5), 'press militar': ent('Press militar', 30, 2.5)
      };
      showSection('progreso'); return true;
    })()`,
    paradas: [{ y: 0, pausa: 1.2 }, { txt: 'Tu informe semanal', margen: 90, mueve: 2.0, pausa: 2.0 }, { txt: 'Evolución de fuerza', margen: 90, mueve: 2.2, pausa: 2.4 }, { txt: 'Calendario de constancia', margen: 90, mueve: 2.6, pausa: 2.4 }] },
];

let n = 0;
const nombreFrame = i => path.join(dirFrames, 'f' + String(i).padStart(5, '0') + '.jpg');
async function capturar() {
  const s = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: false });
  if (!s.result?.data) throw new Error('fallo al capturar el fotograma ' + n);
  fs.writeFileSync(nombreFrame(n++), Buffer.from(s.result.data, 'base64'));
}
function repetirUltimo(veces) { const ult = nombreFrame(n - 1); for (let i = 0; i < veces; i++) fs.copyFileSync(ult, nombreFrame(n++)); }
const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

let yActual = 0;
async function irA(parada) {
  if (parada.js) {
    await ev(parada.js);
    await esperar(120);
    await capturar();
    if (parada.pausa) repetirUltimo(Math.max(0, Math.round(parada.pausa * FPS) - 1));
    return;
  }
  let destino = parada.y;
  if (parada.sel) destino = await ev(`window.__pos(${JSON.stringify(parada.sel)}, ${parada.margen ?? 70})`);
  if (parada.txt) destino = await ev(`window.__posTxt(${JSON.stringify(parada.txt)}, ${parada.margen ?? 70})`);
  if (parada.dy != null) destino = yActual + parada.dy;
  if (destino == null || destino < 0) { console.error('  ! no encuentro', parada.sel || parada.txt); return; }
  const frames = Math.round((parada.mueve || 0) * FPS);
  for (let f = 1; f <= frames; f++) {
    const y = Math.round(yActual + (destino - yActual) * suave(f / frames));
    await ev(`window.__scrollTo(${y})`);
    await capturar();
  }
  if (!frames) { await ev(`window.__scrollTo(${destino})`); await capturar(); }
  yActual = destino;
  if (parada.pausa) { await capturar(); repetirUltimo(Math.max(0, Math.round(parada.pausa * FPS) - 1)); }
}

const t0 = Date.now();
let secPrev = null;
for (const esc of ESCENAS) {
  if (esc.sec !== secPrev) {
    await ev(`window.__cap(''); showSection(${JSON.stringify(esc.sec)}); window.scrollTo(0,0)`);
    await esperar(700);
    yActual = 0;
    secPrev = esc.sec;
  }
  if (esc.antes) {
    const ok = await ev(esc.antes);
    yActual = 0;
    if (!ok && ok !== undefined) console.error('  ! el "antes" de «' + esc.cap[0] + '» devolvió', ok);
    await esperar(500);
  }
  await ev(`window.__cap(${JSON.stringify(esc.cap[0])}, ${JSON.stringify(esc.cap[1] || '')}, ${!!esc.arriba})`);
  for (const p of esc.paradas) await irA(p);
  if (esc.despues) { await ev(esc.despues); await esperar(400); yActual = await ev('window.__y()'); }
  console.error(`  escena ${esc.sec} «${esc.cap[0]}» · ${n} fotogramas (${Math.round((Date.now() - t0) / 1000)} s)`);
}
// Cierre
await ev(`window.__cap(''); document.getElementById('demoFin').style.display = 'flex'`);
await esperar(300);
await capturar(); repetirUltimo(Math.round(3.2 * FPS) - 1);

console.error(n + ' fotogramas capturados en ' + Math.round((Date.now() - t0) / 1000) + ' s');
ws.close(); cerrar();

// Montaje: H.264 compatible con cualquier navegador/móvil, sin audio.
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dirFrames, 'f%05d.jpg'),
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25',
  '-movflags', '+faststart', '-an', salida], { stdio: 'inherit' });
if (r.status !== 0) { console.error('ffmpeg falló'); process.exit(1); }
console.error('listo: ' + salida + ' (' + (fs.statSync(salida).size / 1048576).toFixed(1) + ' MB, ' + (n / FPS).toFixed(1) + ' s)');
process.exit(0);
