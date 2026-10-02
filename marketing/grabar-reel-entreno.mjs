// Graba la app DE VERDAD en movimiento (móvil 390x844) para el reel del modo
// entrenamiento: Hoy → marcar comidas → Empezar entrenamiento → peso y series con
// el descanso corriendo → valoración → resumen con récords → vuelta a Hoy.
// Cliente de demostración (datos inventados), nunca uno real.
//
//   node marketing/grabar-reel-entreno.mjs <carpetaSalida> [url]
// Deja en la carpeta los fotogramas (JPG), "lista.txt" (ffconcat con la duración
// real de cada uno) y "tiempos.json" (en qué segundo empieza cada tramo, para
// poner los textos al montar).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [dir, url = 'http://localhost:8080/'] = process.argv.slice(2);
if (!dir) { console.error('uso: node grabar-reel-entreno.mjs <carpeta> [url]'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));

const PUERTO = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-reel-' + PUERTO, 'about:blank'
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
      const n = frames.length;
      fs.writeFileSync(path.join(dir, 'f' + String(n).padStart(5, '0') + '.jpg'), Buffer.from(data, 'base64'));
      frames.push(metadata.timestamp);
    }
    ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId } }));
  }
});
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };

await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cmd('Page.navigate', { url });
await esperar(3500);

// Estado de demostración + un historial de cargas para que salgan "la última vez" y récords
console.log(await ev(`(async () => {
  const src = await (await fetch('/marketing/estado-demo-hoy.js')).text(); await eval(src);
  goTo('dashboard');
  document.querySelectorAll('[class*="pwa"], [id*="pwa"], [id*="Pwa"]').forEach(e => e.remove());
  ['hoy','semana','nutricion','checkin','progreso','notas','contacto'].forEach(s => { try { localStorage.setItem('kone_guia_' + s, '1'); } catch (e) {} });
  const hoy = getFechaHoyISO();
  userData.entrenosCompletados = (userData.entrenosCompletados || []).filter(f => f !== hoy);
  userData.historialEntrenos = (userData.historialEntrenos || []).filter(f => f !== hoy);
  userData.encuestaPedidaEntrenos = true; userData.testimonioCompletado = true;
  const hist = (n, kg, s) => { const k = normalizarEjercicio(n); userData.pesosEjercicios[k] = { nombre: n, peso: kg, fecha: '2026-09-25', historial: [{ fecha: '2026-09-18', peso: kg - 2.5, sensacion: 'justo' }, { fecha: '2026-09-25', peso: kg, sensacion: s }] }; };
  userData.pesosEjercicios = {};
  hist('Extensión de cuádriceps', 30, 'facil'); hist('Peso muerto sumo con mancuernas', 20, 'facil');
  hist('Hip thrust a una pierna', 15, 'justo'); hist('Femoral tumbado en máquina', 25, 'justo');
  hist('Step-ups controlados', 10, 'justo'); hist('Gemelos en prensa o máquina', 60, 'justo');
  localStorage.removeItem('kone_sesion_' + hoy);
  buildDashboard(); showSection('hoy'); window.scrollTo(0, 0);
  // Indicador de toque: un círculo naranja donde "pulsa el dedo"
  const st = document.createElement('style');
  st.textContent = '.__tap{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(242,106,54,.35);border:2px solid rgba(242,106,54,.9);pointer-events:none;animation:__tap .55s ease-out forwards}@keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}';
  document.head.appendChild(st);
  window.__toca = (sel, i) => { const els = typeof sel === 'string' ? document.querySelectorAll(sel) : [sel]; const el = els[i || 0]; if (!el) return 'no ' + sel; const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = '__tap'; d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 700); setTimeout(() => el.click(), 180); return 'ok'; };
  return 'estado listo';
})()`));
await esperar(800);

const tiempos = {};
let t0 = null;
const marca = (nombre) => { tiempos[nombre] = (Date.now() - t0) / 1000; console.log('  ' + nombre + ' @ ' + tiempos[nombre].toFixed(1) + 's'); };
await cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
grabando = true; t0 = Date.now();

marca('hoy');
await esperar(2200);
marca('comidas');
await ev(`(() => { const y = document.getElementById('hoyComidas').getBoundingClientRect().top + scrollY - 120; window.scrollTo({ top: y, behavior: 'smooth' }); })()`);
await esperar(1300);
await ev(`__toca('.hc-check', 0)`); await esperar(800);
await ev(`__toca('.hc-check', 1)`); await esperar(1300);
await ev(`window.scrollTo({ top: 0, behavior: 'smooth' })`); await esperar(1200);
marca('empezar');
await ev(`__toca('#todayHeroBtn')`); await esperar(1900);
marca('peso');
await ev(`__toca('.ses-serie.actual .ses-kg button', 1)`); await esperar(650);
await ev(`__toca('.ses-serie.actual .ses-kg button', 1)`); await esperar(900);
marca('series');
await ev(`__toca('.ses-serie.actual .ses-marcar')`); await esperar(2600);
await ev(`__toca('.ses-serie.actual .ses-marcar')`); await esperar(1200);
await ev(`__toca('.ses-serie.actual .ses-marcar')`); await esperar(1100);
await ev(`__toca('.ses-serie.actual .ses-marcar')`); await esperar(1300);
marca('valorar');
await ev(`__toca('.ses-descanso .ses-mini', 1)`); await esperar(700);
await ev(`(() => { const b = [...document.querySelectorAll('.ses-fb-opc button')].find(x => /Justo/.test(x.textContent)); return __toca(b); })()`); await esperar(1500);
marca('siguiente');
await ev(`__toca('#sesPie .btn-primary')`); await esperar(1800);

// El resto de ejercicios se completa sin grabar (si no, sería un minuto de series)
grabando = false;
await ev(`(() => { for (let k = _ses.idx; k < _ses.pasos.length; k++) { if (k > _ses.idx) sesIr(1); const p = _ses.pasos[_ses.idx]; if (p.tipo === 'peso') { sesKgValor(Number(p.kg) || 20); p.hechas.forEach((h, i) => { if (!h) sesMarcar(i); }); sesValorar('justo'); } else if (!p.hechas[0]) sesMarcar(0); } sesDescansoFin(true); _ses.inicio = Date.now() - 58 * 60000; _sesPintar(); document.querySelectorAll('.toast').forEach(t => t.classList.remove('show', 'visible')); return 'ok'; })()`);
await esperar(600);
cortes.add(frames.length);
grabando = true;
await esperar(900);
await ev(`(() => { const st = document.createElement('style'); st.textContent = '.toast{display:none!important}'; document.head.appendChild(st); })()`);
marca('resumen');
await ev(`__toca('#sesPie .btn-primary')`); await esperar(3800);
marca('volver');
await ev(`__toca('#sesPie .btn-primary')`); await esperar(1800);
marca('fin');

grabando = false;
await cmd('Page.stopScreencast');
await esperar(300);

// ffconcat con la duración real de cada fotograma (el screencast solo manda
// fotogramas cuando algo cambia, así que el ritmo no es fijo).
const lineas = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  // Hueco real entre fotogramas (la pantalla quieta también cuenta), salvo el
  // salto donde se pausó la grabación, que se corta en seco.
  const dur = i < frames.length - 1 ? (cortes.has(i + 1) ? 0.04 : Math.max(0.01, Math.min(4, frames[i + 1] - frames[i]))) : 0.6;
  lineas.push(`file 'f${String(i).padStart(5, '0')}.jpg'`, `duration ${dur.toFixed(3)}`);
}
lineas.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(path.join(dir, 'lista.txt'), lineas.join('\n'));
fs.writeFileSync(path.join(dir, 'tiempos.json'), JSON.stringify(tiempos, null, 2));
console.log(frames.length + ' fotogramas · ' + ((frames[frames.length - 1] - frames[0]) || 0).toFixed(1) + ' s de pantalla');
process.exit(0);
