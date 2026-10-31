// Graba la app DE VERDAD (móvil 390x844) para el reel «Le digo a mi entrenador con
// IA que no puedo comer gluten» (31 oct 2026, Rafa: vídeos de 25-30 s con la app en
// movimiento). Cliente de demo (marketing/estado-demo-ia.js, datos inventados):
// Hoy → Comidas → abre una receta con gluten → «Cambiar objetivo o deporte» →
// Alergias: Gluten → recalcula → la misma comida ya sin gluten.
// La pantalla de pago del cambio de plan (periodicidad) no sale: se corta.
//
//   node marketing/grabar-reel-celiaco.mjs <carpetaSalida> [url]
// Deja fotogramas JPG, "lista.txt" (ffconcat) y "tiempos.json" (segundo en el que
// empieza cada tramo). Lo monta marketing/montar-reel-celiaco.sh.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [dir, url = 'http://localhost:8080/'] = process.argv.slice(2);
if (!dir) { console.error('uso: node grabar-reel-celiaco.mjs <carpeta> [url]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));

const PUERTO = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-reel-celiaco-' + PUERTO, 'about:blank'
], { stdio: 'ignore' });
process.on('exit', () => { try { process.kill(chrome.pid); } catch (e) {} });
const esperar = ms => new Promise(r => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) {} if (!wsUrl) await esperar(250); }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
const frames = []; let grabando = false; const cortes = new Set();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = m.params;
    if (grabando) {
      fs.writeFileSync(path.join(dir, 'f' + String(frames.length).padStart(5, '0') + '.jpg'), Buffer.from(data, 'base64'));
      frames.push(metadata.timestamp);
    }
    ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId } }));
  }
});
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };

await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
// Lunes 2 nov: el día del relanzamiento (y un día de entreno en la demo).
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date, fijo = new R('2026-11-02T09:30:00').getTime(), t0 = R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fijo + (R.now() - t0)); } static now() { return fijo + (R.now() - t0); } } window.Date = D; })();` });
await cmd('Page.navigate', { url });
await esperar(4000);

const estado = fs.readFileSync(path.join(AQUI, 'estado-demo-ia.js'), 'utf8');
console.log('demo: ' + await ev(`window.__IA = { seccion: 'hoy' }; ${estado}`));
console.log(await ev(`(() => {
  try { localStorage.setItem('kone_hint_descanso', '1'); } catch (e) {}
  document.querySelectorAll('[id*="pwa"], [id*="Pwa"], #pushInstallBanner, #cookieBanner, .cookie-banner').forEach(e => e.remove());
  const st = document.createElement('style');
  st.textContent = '.__tap{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(242,106,54,.35);border:2px solid rgba(242,106,54,.9);pointer-events:none;animation:__tap .55s ease-out forwards}@keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}';
  document.head.appendChild(st);
  // Toque visible y después el clic de verdad (centrado en pantalla si hace falta).
  window.__toca = (el, centrar = true) => { if (!el) return 'no'; if (centrar) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = '__tap'; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 700); setTimeout(() => el.click(), 160); }, centrar ? 420 : 40); return 'ok'; };
  window.__suave = (y) => window.scrollTo({ top: y, behavior: 'smooth' });
  window.__arriba = (el, m = 12) => __suave(el.getBoundingClientRect().top + scrollY - m);
  // La comida del día con gluten (pan, tostada, pasta, avena, tortilla de trigo...).
  window.__conGluten = () => _comidasDelDia(getIndiceDiaHoy()).findIndex(c => /\\bpan\\b|tostad|pasta|avena|trigo|wrap|bocadillo|galleta|bizcocho|copos/i.test(c.nombre + ' ' + ((c.op && c.op.ingredientes) || '')));
  return 'listo';
})()`));
const j = await ev(`__conGluten()`);
console.log('comida con gluten: ' + j + ' · ' + await ev(`(_comidasDelDia(getIndiceDiaHoy())[${j}] || {}).nombre`));
await ev(`(() => { hdTab('ent'); window.scrollTo(0, document.getElementById('hoyDia').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
await esperar(800);

const marcasIdx = {};
let t0 = null;
const marca = (n) => { marcasIdx[n] = frames.length; console.log('  ' + n + ' @ ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
await cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
grabando = true; t0 = Date.now();

marca('hoy');
await esperar(900);
await ev(`__toca(document.querySelector('#hdTabs .hd-tab[data-t="com"]'), false)`); await esperar(1300);
marca('menu');
await ev(`__arriba(document.querySelector('.hn-linea'), 120)`); await esperar(1300);
await ev(`__toca(document.querySelectorAll('#hdPanel .hn-toma')[${j}])`); await esperar(1300);
await ev(`__arriba(document.querySelector('.hn-fila.abierta'), 16)`); await esperar(2300);

marca('cambio');
await ev(`__toca([...document.querySelectorAll('button')].find(b => /Cambiar objetivo o deporte/.test(b.textContent) && b.offsetParent))`); await esperar(1400);
// Dentro de la ventana, hasta «Alergias».
await ev(`(() => { const g = document.getElementById('cp-alergia'); const caja = g.closest('.modal-overlay'); const box = caja.querySelector('.modal-box') || caja; const y = g.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 140; (box.scrollHeight > box.clientHeight ? box : caja).scrollTo({ top: y, behavior: 'smooth' }); return 'ok'; })()`); await esperar(1300);
marca('gluten');
await ev(`__toca([...document.querySelectorAll('#cp-alergia .radio-opt')].find(o => o.textContent.trim() === 'Gluten'), false)`); await esperar(1300);
await ev(`(() => { const b = [...document.querySelectorAll('#cpStep1 .btn-primary')].pop(); b.scrollIntoView({ block: 'center', behavior: 'smooth' }); return 'ok'; })()`); await esperar(900);
// Paso 2 (periodicidad de pago): no sale en el vídeo. Se deja de grabar ANTES del clic
// (el toque se ve, el clic llega a los 200 ms): con 500 ms se colaba medio segundo.
await ev(`__toca([...document.querySelectorAll('#cpStep1 .btn-primary')].pop(), false)`); await esperar(170);
grabando = false;
await esperar(400);
await ev(`(async () => { await guardarCambioPlan(); return 'ok'; })()`);
await esperar(1200);
await ev(`(() => { hdTab('com'); window.scrollTo(0, document.getElementById('hoyDia').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
await esperar(600);
cortes.add(frames.length);
grabando = true;

marca('despues');
await esperar(1300);
await ev(`__arriba(document.querySelector('.hn-linea'), 120)`); await esperar(1600);
await ev(`__toca(document.querySelectorAll('#hdPanel .hn-toma')[${j}])`); await esperar(1300);
await ev(`__arriba(document.querySelector('.hn-fila.abierta'), 16)`); await esperar(800);
marca('receta');
console.log('  después: ' + await ev(`(_comidasDelDia(getIndiceDiaHoy())[${j}] || {}).nombre`) + ' · alergia=' + await ev(`userData.alergia`));
await esperar(2800);
marca('fin');

grabando = false;
const finTs = Date.now() / 1000;
await cmd('Page.stopScreencast');
await esperar(300);

const dur = i => i < frames.length - 1 ? (cortes.has(i + 1) ? 0.04 : Math.max(0.01, Math.min(4, frames[i + 1] - frames[i]))) : Math.max(0.6, Math.min(6, finTs - frames[i]));
const lineas = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) lineas.push(`file 'f${String(i).padStart(5, '0')}.jpg'`, `duration ${dur(i).toFixed(3)}`);
lineas.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(path.join(dir, 'lista.txt'), lineas.join('\n'));
const acum = [0]; for (let i = 0; i < frames.length; i++) acum.push(acum[i] + dur(i));
const tiempos = {};
for (const [n, i] of Object.entries(marcasIdx)) tiempos[n] = +acum[Math.min(i, frames.length)].toFixed(2);
tiempos.total = +acum[frames.length].toFixed(2);
fs.writeFileSync(path.join(dir, 'tiempos.json'), JSON.stringify(tiempos, null, 2));
console.log(frames.length + ' fotogramas · ' + tiempos.total + ' s');
process.exit(0);
