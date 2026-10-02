// Mide lo que tarda en verse la portada en un móvil normal con red lenta.
//   node marketing/medir-velocidad.mjs [url] [veces]
// Emula un móvil (390x844), 4G lento (1,6 Mbps, 150 ms) y CPU 4 veces más lenta,
// como hace Lighthouse en móvil. Devuelve la mediana de FCP, LCP, DOMContentLoaded,
// load y el tiempo hasta que el JS de la app está listo, además de los bytes.
import { spawn } from 'node:child_process';

const url = process.argv[2] || 'https://k-one.fit/';
const veces = +(process.argv[3] || 3);
const PUERTO = 9600 + Math.floor(Math.random() * 200);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + process.env.TEMP + '/cdp-vel-' + PUERTO, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { process.kill(chrome.pid); } catch (e) {} });
const esperar = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const t = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find(t => t.type === 'page'); if (t) ws = t.webSocketDebuggerUrl; } catch (e) {} if (!ws) await esperar(250); }
const sock = new WebSocket(ws); await new Promise(r => sock.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map(); const eventos = [];
sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m); });
const cmd = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;

await cmd('Page.enable'); await cmd('Network.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await cmd('Emulation.setCPUThrottlingRate', { rate: 4 });
await cmd('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__m = { fcp: 0, lcp: 0 };
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') __m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver(l => { const e = l.getEntries(); if (e.length) __m.lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
` });

const res = [];
for (let v = 0; v < veces; v++) {
  await cmd('Network.clearBrowserCache'); await cmd('Network.setCacheDisabled', { cacheDisabled: true });
  eventos.length = 0;
  await cmd('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'm=' + Date.now() });
  for (let i = 0; i < 240; i++) { if (eventos.some(e => e.method === 'Page.loadEventFired')) break; await esperar(250); }
  await esperar(2500);
  const r = await ev(`(() => { const n = performance.getEntriesByType('navigation')[0]; const rs = performance.getEntriesByType('resource');
    const kb = Math.round((n.transferSize + rs.reduce((a, x) => a + (x.transferSize || 0), 0)) / 1024);
    return { fcp: Math.round(__m.fcp), lcp: Math.round(__m.lcp), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), htmlKB: Math.round(n.transferSize / 1024), totalKB: kb }; })()`);
  res.push(r);
  console.log(`vez ${v + 1}:`, JSON.stringify(r));
}
const med = k => { const a = res.map(r => r[k]).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
console.log(`\nMEDIANA · FCP ${med('fcp')} ms · LCP ${med('lcp')} ms · DOMContentLoaded ${med('dcl')} ms · load ${med('load')} ms · HTML ${med('htmlKB')} KB · total ${med('totalKB')} KB`);
process.exit(0);
