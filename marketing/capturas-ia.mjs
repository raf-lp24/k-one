// Capturas reales de la app (cliente de demo, datos inventados) para los vídeos
// «tu entrenador personal con IA» (30 oct 2026). Con el servidor local en :8080:
//   node marketing/capturas-ia.mjs            → todas
//   node marketing/capturas-ia.mjs v2-antes   → solo esa
// Deja los PNG (780x1688, móvil a 2x) en marketing/videos-ia/capturas/.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, 'videos-ia', 'capturas');
fs.mkdirSync(SALIDA, { recursive: true });
const ESTADO = fs.readFileSync(path.join(AQUI, 'estado-demo-ia.js'), 'utf8');

const CAPTURAS = {
  // 2 · celíaco
  'v2-antes':   { seccion: 'nutricion', comida: 'Desayuno' },
  'v2-despues': { seccion: 'nutricion', comida: 'Desayuno', cambios: { alergia: 'Gluten', dieta: 'Sin gluten' } },
  // 3 · check-in con poca energía
  'v3-checkin':   { seccion: 'checkin', checkin: { dias: '3', fisico: 'Flojo', energia: '2', mente: 'Regular' }, bajarA: 'fisico' },
  'v3-respuesta': { seccion: 'checkin', checkin: { dias: '3', fisico: 'Flojo', energia: '2', mente: 'Regular' }, enviar: true },
  'v3-antes':     { seccion: 'hoy', bajar: '^PESO MUERTO$', cambios: { progreso: { semana: 2, diasEntrenados: 3, ajuste: 0 } } },
  'v3-despues':   { seccion: 'hoy', bajar: '^PESO MUERTO$', cambios: { progreso: { semana: 2, diasEntrenados: 3, ajuste: -1 } } },
  // 4 · lo que no come
  'v4-comida-antes':   { seccion: 'nutricion', comida: 'Comida' },
  'v4-comida-despues': { seccion: 'nutricion', comida: 'Comida', cambios: { noComida: 'pescado, brócoli' } },
  'v4-cena-antes':     { seccion: 'nutricion', comida: 'Cena' },
  'v4-cena-despues':   { seccion: 'nutricion', comida: 'Cena', cambios: { noComida: 'pescado, brócoli' } },
  // 5 · recetario
  'v5-recetario': { seccion: 'recetario' },
  'v5-receta-1':  { seccion: 'recetario', receta: 'Tallarines de calabacín con boloñesa' },
  'v5-receta-2':  { seccion: 'recetario', receta: 'Merluza con costra de feta' },
};

const pedidas = process.argv.slice(2);
for (const [nombre, cfg] of Object.entries(CAPTURAS)) {
  if (pedidas.length && !pedidas.includes(nombre)) continue;
  const tmp = path.join(SALIDA, '_estado-' + nombre + '.js');
  fs.writeFileSync(tmp, 'window.__IA = ' + JSON.stringify(cfg) + ';\n' + ESTADO);
  const out = path.join(SALIDA, nombre + '.png');
  try {
    const r = execFileSync('node', [path.join(AQUI, 'cdp-shot.mjs'), 'http://localhost:8080/', out, '390', '844', '2', tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(nombre + ': ' + (r || '').trim() + '\n');
  } catch (e) { process.stdout.write(nombre + ': ' + (e.stderr || e.message).toString().trim().split('\n').slice(-2).join(' ') + '\n'); }
  fs.unlinkSync(tmp);
}
