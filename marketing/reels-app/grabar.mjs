// Graba la app DE VERDAD (móvil 390x844) siguiendo un guion de guiones.mjs, con el
// cliente de demo (marketing/estado-demo-ia.js, datos inventados) y toques visibles.
//   node marketing/reels-app/grabar.mjs <guion> <carpetaSalida> [url]
// Deja fotogramas JPG, "lista.txt" (ffconcat con la duración real de cada uno) y
// "tiempos.json" (segundo del vídeo en el que empieza cada marca). Monta montar.sh.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIONES } from './guiones.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [nombre, dir, url = 'http://localhost:8080/'] = process.argv.slice(2);
const G = GUIONES[nombre];
if (!G || !dir) { console.error('uso: node grabar.mjs <' + Object.keys(GUIONES).join('|') + '> <carpeta> [url]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));

const PUERTO = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-reel-app-' + PUERTO, 'about:blank'
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
const ev = async (e) => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };

await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date, fijo = new R('${G.fecha}').getTime(), t0 = R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fijo + (R.now() - t0)); } static now() { return fijo + (R.now() - t0); } } window.Date = D; })();` });
await cmd('Page.navigate', { url });
await esperar(4000);

const estado = fs.readFileSync(path.join(AQUI, '..', 'estado-demo-ia.js'), 'utf8');
console.log('demo: ' + await ev(`window.__IA = { seccion: 'hoy', cambios: ${JSON.stringify(G.cambios || {})} }; ${estado}`));
console.log(await ev(`(() => {
  try { localStorage.setItem('kone_hint_descanso', '1'); } catch (e) {}
  // El aviso de «¿actualizamos tu plan?» es por la fecha de alta de la demo: en el vídeo no pinta nada.
  ['bannerRecalculo', 'pushInstallBanner', 'pwaInstallBanner', 'cookieBanner'].forEach(i => { const e = document.getElementById(i); if (e) e.style.setProperty('display', 'none', 'important'); });
  const st = document.createElement('style');
  st.textContent = '.__tap{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(242,106,54,.35);border:2px solid rgba(242,106,54,.9);pointer-events:none;animation:__tap .55s ease-out forwards}@keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}} #bannerRecalculo{display:none!important}';
  document.head.appendChild(st);
  window.__toca = (el, centrar = true) => { if (!el) return 'no'; if (centrar) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = '__tap'; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 700); setTimeout(() => el.click(), 160); }, centrar ? 420 : 40); return 'ok'; };
  window.__arriba = (el, m = 12) => { if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - m, behavior: 'smooth' }); return el ? 'ok' : 'no'; };
  // Escribe como una persona, letra a letra (con «input» para los buscadores).
  window.__escribe = (el, texto, ms = 90, input = false) => new Promise(res => { el.focus(); el.value = ''; let k = 0; const t = setInterval(() => { el.value = texto.slice(0, ++k); if (input) el.dispatchEvent(new Event('input', { bubbles: true })); if (k >= texto.length) { clearInterval(t); el.dispatchEvent(new Event('change', { bubbles: true })); res('ok'); } }, ms); });
  return 'listo';
})()`));

const marcasIdx = {};
let t0 = null;
const h = {
  ev, espera: esperar,
  log: s => console.log('  ' + s),
  grabar: async () => { await cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 }); grabando = true; t0 = Date.now(); },
  marca: n => { marcasIdx[n] = frames.length; console.log('  ' + n + ' @ ' + ((Date.now() - (t0 || Date.now())) / 1000).toFixed(1) + 's'); },
  pausa: () => { grabando = false; },
  sigue: () => { cortes.add(frames.length); grabando = true; }
};
await G.pasos(h);

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
