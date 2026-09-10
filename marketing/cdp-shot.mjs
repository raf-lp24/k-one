// Captura una URL a PNG hablando CDP directo con el Chrome instalado, sin
// Playwright. Usa Emulation.setDeviceMetricsOverride para poder pedir anchos
// de movil: Chrome headless en Windows no baja de ~504px de ventana real,
// pero la emulacion de dispositivo si.
//
//   node cdp-shot.mjs <url> <salida.png> [ancho] [alto] [dpr] [jsExtra]
//
// jsExtra: ruta a un .js que se evalua en la pagina antes de capturar (para
// preparar el estado: cerrar banners, abrir el menu, inyectar un usuario...).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [url, salida, anchoS = '390', altoS = '844', dprS = '3', jsExtraPath] = process.argv.slice(2);
if (!url || !salida) { console.error('uso: node cdp-shot.mjs <url> <salida.png> [ancho] [alto] [dpr] [js]'); process.exit(1); }
const ancho = +anchoS, alto = +altoS, dpr = +dprS;
const PUERTO = 9333 + Math.floor(Math.random() * 200);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PUERTO,
  '--user-data-dir=' + process.env.TEMP + '/cdp-kone-' + PUERTO,
  'about:blank'
], { stdio: 'ignore' });

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function conectar() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
      const lista = await r.json();
      // IMPORTANTE: el primero de la lista puede ser una background_page de
      // una extension; conectar a ese cuelga el script sin dar error.
      const pagina = lista.find(t => t.type === 'page');
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch (e) { /* aun no levanta */ }
    await esperar(250);
  }
  throw new Error('Chrome no respondio en 15s');
}

const wsUrl = await conectar();
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pendientes = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
});
const cmd = (method, params = {}) => new Promise(res => {
  const i = ++id;
  pendientes.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

await cmd('Emulation.setDeviceMetricsOverride', {
  width: ancho, height: alto, deviceScaleFactor: dpr, mobile: ancho < 768
});
await cmd('Page.enable');
await cmd('Runtime.enable');
await cmd('Page.navigate', { url });
await esperar(3500);
if (jsExtraPath) {
  const expression = fs.readFileSync(jsExtraPath, 'utf8');
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails || r.result?.result?.subtype === 'error') console.error('js extra fallo:', JSON.stringify(r.result).slice(0, 300));
  else console.error('js extra ->', JSON.stringify(r.result?.result?.value ?? '').slice(0, 200));
  await esperar(1500);
}
const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(salida, Buffer.from(shot.result.data, 'base64'));
console.error('guardado ' + salida + ' (' + ancho + 'x' + alto + ' @' + dpr + 'x)');

ws.close();
// Solo este Chrome, por PID: nunca taskkill /IM chrome.exe, que mata tambien
// el navegador del usuario.
try { process.kill(chrome.pid); } catch (e) {}
process.exit(0);
