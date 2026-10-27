// Graba la app DE VERDAD (móvil 390x844) para el reel «Le pido un plan a K-ONE»
// (27 oct 2026): portada → Empieza gratis → cuestionario de 6 pasos → adelanto
// del plan. Se rellena como lo haría alguien de verdad (toques visibles), con una
// persona de ejemplo inventada. NO se crea cuenta: el reel acaba en el adelanto,
// que se ve antes de registrarse.
//
//   node marketing/grabar-reel-plan.mjs <carpetaSalida> [url]
// Deja en la carpeta los fotogramas (JPG), "lista.txt" (ffconcat con la duración
// real de cada uno) y "tiempos.json" (en qué segundo empieza cada tramo, para
// poner los textos al montar). Lo monta marketing/montar-reel-plan.sh.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [dir, url = 'http://localhost:8080/'] = process.argv.slice(2);
if (!dir) { console.error('uso: node grabar-reel-plan.mjs <carpeta> [url]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));

const PUERTO = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-reel-plan-' + PUERTO, 'about:blank'
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
// Lunes: el adelanto enseña la primera sesión de la semana.
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date, fijo = new R('2026-10-26T09:30:00').getTime(), t0 = R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fijo + (R.now() - t0)); } static now() { return fijo + (R.now() - t0); } } window.Date = D; })();` });
await cmd('Page.navigate', { url });
await esperar(4000);

console.log(await ev(`(() => {
  try { localStorage.clear(); } catch (e) {}
  document.querySelectorAll('[class*="pwa"], [id*="pwa"], [id*="Pwa"], #cookieBanner, .cookie-banner, [id*="cookie"]').forEach(e => e.remove());
  const st = document.createElement('style');
  st.textContent = '.__tap{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(242,106,54,.35);border:2px solid rgba(242,106,54,.9);pointer-events:none;animation:__tap .55s ease-out forwards}@keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}} .toast{display:none!important}';
  document.head.appendChild(st);
  // Toque visible y después el clic de verdad.
  window.__toca = (el) => { if (!el) return 'no'; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = '__tap'; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 700); setTimeout(() => el.click(), 160); }, 380); return 'ok'; };
  window.__opc = (idGrupo, texto) => __toca([...document.querySelectorAll('#' + idGrupo + ' .radio-opt')].find(o => o.textContent.trim().startsWith(texto)));
  window.__visible = () => [...document.querySelectorAll('.form-block.active button')].find(b => /Siguiente|Generar/.test(b.textContent));
  return 'listo';
})()`));

const tiempos = {};
let t0 = null;
// Se apunta el fotograma en el que empieza cada tramo; al final se pasa a segundos
// del vídeo ya montado (sin el trozo cortado de «generando»).
const marcasIdx = {};
const marca = (n) => { marcasIdx[n] = frames.length; console.log('  ' + n + ' @ ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); };
await cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
grabando = true; t0 = Date.now();

marca('portada');
await esperar(1600);
await ev(`__toca([...document.querySelectorAll('button')].find(b => /Empieza gratis/i.test(b.textContent) && b.offsetParent))`); await esperar(1500);
await ev(`__toca([...document.querySelectorAll('#bienvenida button')].find(b => /Empezar el cuestionario/.test(b.textContent)))`); await esperar(1300);

marca('datos');
await ev(`(() => { window.scrollTo(0, 0); return 'ok'; })()`);
for (let i = 0; i < 3; i++) { await ev(`__toca([...document.querySelectorAll('button')].find(b => (b.getAttribute('onclick') || '') === "stepVal('edad',1)"))`); await esperar(520); }
await ev(`(() => { const s = document.getElementById('sexo'); __toca(s); setTimeout(() => { s.value = 'Mujer'; s.dispatchEvent(new Event('change', { bubbles: true })); }, 700); return 'ok'; })()`); await esperar(1300);
for (let i = 0; i < 2; i++) { await ev(`__toca([...document.querySelectorAll('button')].find(b => (b.getAttribute('onclick') || '') === "stepVal('peso',-1)"))`); await esperar(520); }
await ev(`__toca(__visible())`); await esperar(1300);

marca('salud');
for (const g of ['enfermedad', 'lesion', 'alergia', 'tca']) { await ev(`__opc('${g}', 'No')`); await esperar(750); }
await ev(`__toca(__visible())`); await esperar(1200);
await ev(`__toca(__visible())`); await esperar(1200); // bloque 3: preguntas opcionales

marca('comida');
await ev(`__opc('dieta', 'Como de todo')`); await esperar(800);
await ev(`__opc('comidas', '5 comidas')`); await esperar(900);
await ev(`__toca(__visible())`); await esperar(1200);

marca('objetivo');
await ev(`__opc('tipoPlan', 'Plan completo')`); await esperar(800);
await ev(`__opc('objetivo', 'Sentirme mejor')`); await esperar(1000);
await ev(`__toca(__visible())`); await esperar(1200);

marca('entreno');
await ev(`__opc('deporte', 'Gimnasio')`); await esperar(800);
await ev(`__opc('diasEntreno', '3 días')`); await esperar(750);
await ev(`__opc('tiempoSesion', '45-60')`); await esperar(750);
await ev(`__opc('nivel', 'Llevo algo')`); await esperar(750);
await ev(`__opc('lugar', 'Gimnasio')`); await esperar(900);
marca('generar');
await ev(`__toca(__visible())`); await esperar(3000);
// La pantalla de «generando» dura varios segundos: se graban solo los primeros
// 3 s y se corta en seco hasta que aparece el plan.
grabando = false;
let pantalla = '';
for (let i = 0; i < 80; i++) {
  pantalla = await ev(`(document.querySelector('.screen.active') || {}).id || ''`);
  if (pantalla && pantalla !== 'formulario' && pantalla !== 'generando' && !/loading|cargando/i.test(pantalla)) break;
  await esperar(250);
}
await esperar(900);
console.log('  pantalla tras generar: ' + pantalla);
await ev(`window.scrollTo(0, 0)`); await esperar(300);
cortes.add(frames.length);
grabando = true;
await esperar(1200);

marca('adelanto');
await esperar(1800);
console.log("  scroll adelanto: " + await ev(`(() => { const et = [...document.querySelectorAll('#registro div')].find(e => e.children.length === 0 && /TU PLAN, CON TUS RESPUESTAS/.test(e.textContent)); if (!et) return 'sin adelanto'; const y = et.getBoundingClientRect().top + scrollY - 110; window.scrollTo({ top: y, behavior: 'smooth' }); return "ok " + Math.round(y) + " de " + document.documentElement.scrollHeight; })()`));
await esperar(1200);
marca('comidas');
await esperar(3200);
marca('fin');

grabando = false;
const finTs = Date.now() / 1000; // la pantalla quieta del final también cuenta
await cmd('Page.stopScreencast');
await esperar(300);

const lineas = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  // El salto donde se pausó la grabación se corta en seco.
  const dur = i < frames.length - 1 ? (cortes.has(i + 1) ? 0.04 : Math.max(0.01, Math.min(4, frames[i + 1] - frames[i]))) : Math.max(0.6, Math.min(6, finTs - frames[i]));
  lineas.push(`file 'f${String(i).padStart(5, '0')}.jpg'`, `duration ${dur.toFixed(3)}`);
}
lineas.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(path.join(dir, 'lista.txt'), lineas.join('\n'));
const acum = [0]; for (let i = 0; i < frames.length; i++) { const dur = i < frames.length - 1 ? (cortes.has(i + 1) ? 0.04 : Math.max(0.01, Math.min(4, frames[i + 1] - frames[i]))) : Math.max(0.6, Math.min(6, finTs - frames[i])); acum.push(acum[i] + dur); }
for (const [n, i] of Object.entries(marcasIdx)) tiempos[n] = +acum[Math.min(i, frames.length)].toFixed(2);
tiempos.total = +acum[frames.length].toFixed(2);
fs.writeFileSync(path.join(dir, 'tiempos.json'), JSON.stringify(tiempos, null, 2));
console.log(frames.length + ' fotogramas · ' + ((frames[frames.length - 1] - frames[0]) || 0).toFixed(1) + ' s de pantalla');
process.exit(0);
