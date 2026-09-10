// Renderiza una animacion HTML a secuencia de PNG hablando CDP con Chrome.
// La pagina expone render(t); aqui se llama fotograma a fotograma y se captura,
// asi que el resultado es determinista (con animaciones CSS el fotograma
// dependeria de cuando dispare la captura).
//
//   node cdp-frames.mjs <url> <carpetaSalida> <duracionSeg> [fps] [ancho] [alto]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [url, dir, durS, fpsS = '25', anchoS = '1080', altoS = '1920'] = process.argv.slice(2);
if (!url || !dir || !durS) { console.error('uso: node cdp-frames.mjs <url> <dir> <dur> [fps] [w] [h]'); process.exit(1); }
const dur = +durS, fps = +fpsS, ancho = +anchoS, alto = +altoS;
const total = Math.round(dur * fps);
fs.mkdirSync(dir, { recursive: true });

const PUERTO = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PUERTO,
  '--user-data-dir=' + process.env.TEMP + '/cdp-frames-' + PUERTO,
  'about:blank'
], { stdio: 'ignore' });
const esperar = ms => new Promise(r => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    // El primer target puede ser una background_page: hay que coger type 'page'.
    wsUrl = lista.find(t => t.type === 'page')?.webSocketDebuggerUrl || null;
  } catch (e) {}
  if (!wsUrl) await esperar(250);
}
if (!wsUrl) { console.error('Chrome no respondio'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });
// Fondo transparente en la captura: sin esto Chrome pinta blanco debajo.
 await cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
 await cmd('Page.enable');
await cmd('Runtime.enable');
await cmd('Page.navigate', { url });
await cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
// Antes esto era un `esperar(4000)` a secas y era una loteria: si Google Fonts
// tardaba un pelin mas, TODOS los fotogramas salian con la tipografia de
// reserva en vez de Bebas Neue, y no te enterabas hasta ver el video montado
// (paso de verdad, con un render de 913 fotogramas ya hecho). Si la pagina
// expone `window.listo` -- una promesa que resuelve cuando sus fuentes e
// imagenes estan listas -- se espera a ESO, que es exacto. El sleep queda solo
// como red para paginas que no la expongan.
// Ojo: Page.navigate vuelve ANTES de que la pagina haya ejecutado sus scripts,
// asi que preguntar por window.listo en ese instante siempre da "sin-listo".
// Hay que esperar a que APAREZCA y luego esperar a que resuelva.
const rListo = await cmd('Runtime.evaluate', {
  expression: `(async () => {
    for (let i = 0; i < 80 && !(window.listo instanceof Promise); i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    if (!(window.listo instanceof Promise)) return 'sin-listo';
    await window.listo;
    return 'listo';
  })()`,
  awaitPromise: true, returnByValue: true
});
if (rListo.result?.result?.value === 'listo') {
  console.error('  pagina lista (window.listo)');
  await esperar(400);
} else {
  await esperar(4000);
}

const t0 = Date.now();
for (let f = 0; f < total; f++) {
  const t = f / fps;
  await cmd('Runtime.evaluate', { expression: `render(${t})` });
  const shot = await cmd('Page.captureScreenshot', { format: 'png' });
  if (!shot.result?.data) { console.error('fallo al capturar el fotograma ' + f); process.exit(1); }
  fs.writeFileSync(path.join(dir, 'f' + String(f).padStart(5, '0') + '.png'), Buffer.from(shot.result.data, 'base64'));
  if (f % 25 === 0) console.error('  ' + f + '/' + total + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
}
console.error(total + ' fotogramas en ' + Math.round((Date.now() - t0) / 1000) + 's');
ws.close();
try { process.kill(chrome.pid); } catch (e) {}
process.exit(0);
