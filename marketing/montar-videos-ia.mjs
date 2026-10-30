// Monta los vídeos 14-17 «tu entrenador personal con IA» (30 oct 2026) con las
// capturas de marketing/capturas-ia.mjs y las diapositivas de reel-ia.html.
// Con el servidor local en :8080:   node marketing/montar-videos-ia.mjs [14 15 16 17]
// Cada diapositiva lleva un zoom lento y entre ellas un fundido; al final, el cierre.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TRABAJO = path.join(AQUI, 'videos-ia', 'diapositivas');
const SALIDA = path.join(AQUI, 'publicar', 'videos');
fs.mkdirSync(TRABAJO, { recursive: true });

const VIDEOS = {
  14: { archivo: '14-le-digo-a-la-ia-que-soy-celiaco.mp4', diapos: [
    { img: 'v2-antes', eye: 'Mi desayuno de hoy', tit: 'Le digo a la IA<br>que soy celíaco', tag: 'ANTES' },
    { img: 'v2-despues', eye: 'En un segundo', tit: 'Cambia todo<br>el menú', tag: 'SIN GLUTEN' },
    { img: 'v2-despues', eye: 'Sin pedírselo', tit: 'Tostadas y avena<br>sin gluten', tag: 'SIN GLUTEN' },
  ] },
  15: { archivo: '15-le-digo-a-la-ia-que-vengo-reventado.mp4', diapos: [
    { img: 'v3-checkin', eye: 'Domingo · check-in', tit: 'Le digo a la IA<br>que vengo reventado' },
    { img: 'v3-respuesta', eye: 'Me contesta', tit: 'Baja el volumen<br>de mi semana' },
    { img: 'v3-antes', eye: 'Peso muerto', tit: 'Antes:<br>5 series', tag: 'ANTES' },
    { img: 'v3-despues', eye: 'La semana que viene', tit: '4 series.<br>Para que recupere', tag: 'DESPUÉS' },
  ] },
  16: { archivo: '16-no-como-pescado-ni-brocoli.mp4', diapos: [
    { img: 'v4-comida-antes', eye: 'No como pescado ni brócoli', tit: 'A ver qué hace<br>la IA', tag: 'ANTES' },
    { img: 'v4-comida-despues', eye: 'Pollo con arroz y brócoli', tit: 'Ahora es<br>con coliflor', tag: 'DESPUÉS' },
    { img: 'v4-cena-antes', eye: 'Mi cena', tit: 'Merluza<br>al vapor', tag: 'ANTES' },
    { img: 'v4-cena-despues', eye: 'Mismas calorías', tit: 'Pavo al vapor<br>con verduras', tag: 'DESPUÉS' },
  ] },
  17: { archivo: '17-mas-de-1100-recetas.mp4', diapos: [
    { img: 'v5-recetario', eye: 'Más de 1.100 recetas', tit: 'La IA te elige<br>5 para cada comida' },
    { img: 'v5-receta-1', eye: 'Con tus cantidades', tit: 'Tallarines de calabacín<br>con boloñesa' },
    { img: 'v5-receta-2', eye: 'Paso a paso', tit: 'Merluza con<br>costra de feta' },
  ] },
};

const DUR = 3.2, FADE = 0.4, FPS = 30;
const foto = (url, out) => execFileSync('node', [path.join(AQUI, 'cdp-shot.mjs'), url, out, '1080', '1920', '1', path.join(AQUI, 'mascotas', 'esperar-3d.js')], { stdio: 'ignore' });
const base = 'http://localhost:8080/marketing/reel-ia.html';
const finalPng = path.join(TRABAJO, 'final.png');
if (!fs.existsSync(finalPng)) foto(base + '?pieza=final', finalPng);

const pedidos = process.argv.slice(2).map(Number);
for (const [n, v] of Object.entries(VIDEOS)) {
  if (pedidos.length && !pedidos.includes(+n)) continue;
  const pngs = v.diapos.map((d, i) => {
    const out = path.join(TRABAJO, n + '-' + i + '.png');
    const qs = new URLSearchParams({ img: d.img, eye: d.eye, tit: d.tit, tag: d.tag || '' }).toString();
    foto(base + '?' + qs, out);
    return out;
  });
  pngs.push(finalPng);
  // Zoom lento (1 → 1,035) en cada diapositiva y fundido entre ellas.
  const frames = Math.round(DUR * FPS);
  // Una sola imagen por entrada: zoompan ya saca d fotogramas de cada una (con -loop salían minutos).
  const ins = pngs.flatMap(p => ['-i', p]);
  let f = pngs.map((_, i) => `[${i}:v]scale=1080:1920,zoompan=z='1+0.035*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},format=yuv420p,setsar=1[s${i}]`).join(';');
  let prev = 's0', t = DUR - FADE;
  for (let i = 1; i < pngs.length; i++) {
    f += `;[${prev}][s${i}]xfade=transition=fade:duration=${FADE}:offset=${t.toFixed(2)}[x${i}]`;
    prev = 'x' + i; t += DUR - FADE;
  }
  const out = path.join(SALIDA, v.archivo);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', f, '-map', '[' + prev + ']', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('Listo: ' + v.archivo);
}
