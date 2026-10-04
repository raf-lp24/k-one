// Genera los iconos de K-ONE (PWA, iOS, favicon) con la tipografía de la marca:
// "K-" en blanco hueso y "ONE" en naranja brasa, sobre negro, apilado para llenar el cuadrado.
// Cuadrados a sangre completa (sin esquinas transparentes): Android e iOS aplican su propia máscara.
//
//   node marketing/generar-iconos.mjs        (escribe en la raíz del proyecto)
//   node marketing/generar-iconos.mjs prueba (escribe en %TEMP%/kone-iconos, sin tocar nada)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const salida = process.argv[2] === 'prueba' ? path.join(process.env.TEMP, 'kone-iconos') : path.join(AQUI, '..');
fs.mkdirSync(salida, { recursive: true });
const ICONOS = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon.png', 64]];

// 4 oct 2026: la mancuerna con flecha del logo de la portada va delante de "K-"
// (como en la cabecera), en lugar de la raya naranja que había debajo.
const PESA = '<svg viewBox="0 0 200 170"><polygon fill="#F0EDE8" points="2,85 34,74 34,96"/><rect fill="#F0571C" x="36" y="26" width="22" height="118" rx="4"/><rect fill="#F0571C" x="62" y="2" width="28" height="166" rx="4"/><rect fill="#F0EDE8" x="90" y="79" width="78" height="12"/><polygon fill="#F0571C" stroke="#F0571C" stroke-linejoin="round" points="160,56 198,85 160,114"/></svg>';
const HTML = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=block">
<style>
  html, body { margin: 0; width: 100vmin; height: 100vmin; background: #0A0A0A; overflow: hidden; }
  .c { width: 100vmin; height: 100vmin; display: flex; flex-direction: column; align-items: center; justify-content: center;
       font-family: 'Bebas Neue', Impact, sans-serif; font-size: 40vmin; line-height: .8; letter-spacing: .03em; -webkit-text-stroke: .02em currentColor; }
  .f { display: flex; align-items: center; gap: .1em; }
  .f svg { height: .56em; width: auto; aspect-ratio: 200 / 170; margin-top: -.08em; }
  .k { color: #F0EDE8; }
  .o { color: #F0571C; }
</style>
<div class="c"><div class="f">${PESA}<span class="k">K-</span></div><div class="o">ONE</div></div>`;

const PUERTO = 9600 + Math.floor(Math.random() * 90);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-iconos-' + PUERTO, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { process.kill(chrome.pid); } catch (e) {} });
const esperar = ms => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) {} if (!wsUrl) await esperar(250); }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Page.enable'); await cmd('Runtime.enable');
for (const [nombre, px] of ICONOS) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(HTML) });
  await esperar(1500);
  const ok = (await cmd('Runtime.evaluate', { expression: `document.fonts.ready.then(() => document.fonts.check("40px 'Bebas Neue'"))`, awaitPromise: true, returnByValue: true })).result?.result?.value;
  if (!ok) { console.error('la tipografía Bebas Neue no cargó (¿sin internet?)'); process.exit(1); }
  const shot = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: px, height: px, scale: 1 } });
  fs.writeFileSync(path.join(salida, nombre), Buffer.from(shot.result.data, 'base64'));
  console.log('✔ ' + nombre + ' (' + px + '×' + px + ')');
}
process.exit(0);
