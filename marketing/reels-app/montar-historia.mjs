// Monta el reel de historia (historia.json): escenas de la clienta a pantalla completa
// y, entre medias, su móvil con la app grabada de verdad sobre la misma escena
// desenfocada. Rótulos y cierre de historia.html. Con el servidor local en :8080:
//   node marketing/reels-app/montar-historia.mjs <trabajo> alta=<app.mp4> fuerza=<app.mp4> comidas=<app.mp4>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const [trabajo, ...pares] = process.argv.slice(2);
if (!trabajo) { console.error('uso: node montar-historia.mjs <trabajo> alta=<app.mp4> ...'); process.exit(1); }
const APPS = Object.fromEntries(pares.map(p => p.split('=')));
const cfg = JSON.parse(fs.readFileSync(path.join(AQUI, 'historia.json'), 'utf8'));
const ESCENAS = path.join(RAIZ, 'marketing', 'Videos', 'historia-alta');
fs.mkdirSync(path.join(trabajo, 'tramos'), { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const piezas = path.join(trabajo, 'piezas');
if (!fs.existsSync(path.join(piezas, 'marco.png'))) {
  fs.mkdirSync(piezas, { recursive: true });
  for (const p of ['marco', 'mascara']) {
    execFileSync('node', [path.join(RAIZ, 'marketing', 'cdp-frames.mjs'), 'http://localhost:8080/marketing/reel-piezas.html?reel=ia&pieza=' + p, path.join(piezas, 'tmp'), '0.04', '25', '1080', '1920'], { stdio: 'ignore' });
    fs.renameSync(path.join(piezas, 'tmp', 'f00000.png'), path.join(piezas, p + '.png'));
  }
}
const ESC = 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';
const salidas = [];
let total = 0;
cfg.tramos.forEach((tr, i) => {
  const out = path.join(trabajo, 'tramos', String(i).padStart(2, '0') + '.mp4');
  const d = tr.d || tr.partes.reduce((a, p) => a + p[2], 0);
  total += d;
  if (tr.tipo === 'ia') {
    ff(['-ss', String(tr.ss), '-i', path.join(ESCENAS, tr.clip + '.mp4'), '-t', String(d), '-vf', ESC + ',format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', out]);
  } else if (tr.tipo === 'app') {
    // La app: cada parte recortada y acelerada a su duración, seguidas.
    const app = APPS[tr.app];
    const cortes = tr.partes.map((p, k) => `[1:v]trim=start=${p[0]}:end=${p[1]},setpts=(PTS-STARTPTS)*${(p[2] / (p[1] - p[0])).toFixed(5)},fps=30[p${k}]`).join(';');
    const une = tr.partes.map((_, k) => `[p${k}]`).join('') + `concat=n=${tr.partes.length}:v=1:a=0,scale=610:1320:flags=lanczos,format=rgba,pad=1080:1920:235:450:color=black@0[ap]`;
    const f = `[0:v]${ESC},trim=duration=${d},setpts=PTS-STARTPTS,gblur=sigma=24,eq=brightness=-0.25:saturation=0.8[bg];${cortes};${une};[2:v]format=gray,scale=1080:1920[mk];[ap][mk]alphamerge[apm];[apm][3:v]overlay=0:0:format=auto[movil];[bg][movil]overlay=0:0:format=auto,format=yuv420p[v]`;
    ff(['-stream_loop', '-1', '-i', path.join(ESCENAS, tr.fondo + '.mp4'), '-i', app, '-loop', '1', '-t', String(d), '-i', path.join(piezas, 'mascara.png'), '-loop', '1', '-t', String(d), '-i', path.join(piezas, 'marco.png'),
      '-filter_complex', f, '-map', '[v]', '-t', String(d), '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', out]);
  } else {
    ff(['-f', 'lavfi', '-i', `color=c=0x0A0A0A:s=1080x1920:r=30:d=${d}`, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '17', out]);
  }
  salidas.push(out);
  console.log('tramo ' + i + ' · ' + tr.tipo + ' · ' + d.toFixed(1) + ' s');
});
fs.writeFileSync(path.join(trabajo, 'tramos.txt'), salidas.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(trabajo, 'tramos.txt'), '-c', 'copy', path.join(trabajo, 'base.mp4')]);

const capa = path.join(trabajo, 'capa');
fs.rmSync(capa, { recursive: true, force: true });
execFileSync('node', [path.join(RAIZ, 'marketing', 'cdp-frames.mjs'), 'http://localhost:8080/marketing/reels-app/historia.html', capa, total.toFixed(2), '30', '1080', '1920'], { stdio: 'ignore' });
const salida = path.join(RAIZ, 'marketing', 'publicar', 'videos', cfg.salida);
ff(['-i', path.join(trabajo, 'base.mp4'), '-framerate', '30', '-i', path.join(capa, 'f%05d.png'), '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,fps=30,format=yuv420p,setsar=1[v]', '-map', '[v]', '-t', total.toFixed(2), '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', salida]);
console.log('Listo: ' + salida + ' · ' + total.toFixed(1) + ' s');
