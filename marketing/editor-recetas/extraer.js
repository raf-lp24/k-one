// Saca TODAS las recetas de app.js a datos para el editor de recetas (2 nov 2026).
// Lee el recetario sin tocarlo y calcula los macros con validar-recetas, los mismos
// que ve el cliente en «Ver macros».
//   node marketing/editor-recetas/extraer.js <carpetaSalida>
// Deja recetas.json (una fila por receta distinta, con dónde aparece) y alimentos.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const { analizar, ALIM } = require(path.join(RAIZ, 'scripts', 'validar-recetas'));
const salida = process.argv[2];
if (!salida) { console.error('uso: node extraer.js <carpetaSalida>'); process.exit(1); }
const L = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8').split(/\r?\n/);

// Argumentos de op("a", "b", ...): cadenas con comillas dobles o simples.
const cadenas = (s) => { const out = []; const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g; let m; while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]); return out; };
const num = (s) => { const m = /-?\d+(?:[.,]\d+)?/.exec(s || ''); return m ? parseFloat(m[0].replace(',', '.')) : 0; };

const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
if (arr.length !== 3) throw new Error('se esperaban 3 ramas y hay ' + arr.length);
const RAMAS = ['Perder grasa', 'Ganar músculo', 'Mantenimiento'];
const iniExtras = L.findIndex(l => /PLATOS EXTRA POR DEPORTE/.test(l));
const finExtras = L.findIndex((l, i) => i > iniExtras && /RESTRICCIONES POR ALERGIA/.test(l));
const iniSeguros = L.findIndex(l => /const platosSeguros = \(momento\)/.test(l));

const filas = new Map();
function anota(fn, args, ap, linea) {
  const [nombre, ingredientes, kcal, p, c, g, prep] = args;
  const clave = nombre + '|' + ingredientes;
  if (!filas.has(clave)) filas.set(clave, { nombre, ingredientes, prep: prep || '', et: { kcal: num(kcal), p: num(p), c: num(c), g: num(g) }, fija: fn === 'opFija', ap: [], lineas: [] });
  const f = filas.get(clave);
  f.ap.push(ap); f.lineas.push(linea + 1);
  if (fn === 'opFija') f.fija = true;
}
const esOp = (l) => /^\s*(op|opFija)\(\s*["']/.exec(l);

// 0) Repostaje: solo se fuerzan el día real de tirada larga, series o WOD.
const iniFueling = L.findIndex(l => /let fuelingPreCarrera = \[/.test(l));
const FUEL = { fuelingPreCarrera: 'Antes de correr', fuelingPostCarrera: 'Después de correr', fuelingPreWod: 'Antes de entrenar', fuelingPostWod: 'Después de entrenar' };
{
  let cual = null;
  for (let i = iniFueling; i < iniExtras; i++) {
    const m = /let (fueling\w+) = \[/.exec(L[i]);
    if (m) { cual = FUEL[m[1]]; continue; }
    const o = esOp(L[i]);
    if (o && cual) { const a = cadenas(L[i]); if (a.length >= 7) anota(o[1], a, { r: 'Repostaje', m: cual }, i); }
  }
}

// 1) Las tres ramas: rama × toma.
for (let r = 0; r < 3; r++) {
  const fin = r < 2 ? arr[r + 1] : iniFueling;
  let momento = null;
  for (let i = arr[r]; i < fin; i++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[i]);
    if (m) { momento = m[1]; continue; }
    const o = esOp(L[i]);
    if (o && momento) { const a = cadenas(L[i]); if (a.length >= 7) anota(o[1], a, { r: RAMAS[r], m: momento }, i); }
  }
}

// 2) Platos extra por deporte: el destino sale de las líneas push que los usan.
const DEP = { 'esRunner || esHyrox': 'Running e Hyrox', 'esGimnasio || esCrossfit': 'Gimnasio y CrossFit', 'esCombinacion': 'Híbrido' };
let grupo = null, destino = [], pool = [];
for (let i = iniExtras; i < finExtras; i++) {
  const d = /^\s*if \((es[^)]*)\) \{/.exec(L[i]);
  if (d && DEP[d[1]]) { grupo = DEP[d[1]]; pool = []; destino = []; continue; }
  if (!grupo) continue;
  const u = /m\.momento === '([^']+)'(?: \|\| m\.momento === '([^']+)')?\) m\.opciones\.push\((.*)$/.exec(L[i]);
  if (u) {
    const tomas = [u[1], u[2]].filter(Boolean);
    if (/\.\.\.extras/.test(u[3])) {
      const n = +(/slice\(0, (\d+)\)/.exec(u[3]) || [])[1] || pool.length;
      pool.slice(0, n).forEach(([a, k, fn]) => tomas.forEach(t => anota(fn, a, { r: 'Extra: ' + grupo, m: t }, k)));
      destino = [];
    } else destino = tomas;
    continue;
  }
  const o = esOp(L[i]);
  if (o) {
    const a = cadenas(L[i]);
    if (a.length < 7) continue;
    if (destino.length) destino.forEach(t => anota(o[1], a, { r: 'Extra: ' + grupo, m: t }, i));
    else pool.push([a, i, o[1]]);
  } else if (/^\s*\);\s*$/.test(L[i])) destino = [];
}

// 3) Menú de reserva para alérgicos.
{
  let momento = null, n = 0;
  for (let i = iniSeguros; i < L.length && n < 40; i++) {
    const m = /(Desayuno|Media mañana|Comida|Merienda|Cena)/.exec(L[i]);
    if (m && !esOp(L[i])) momento = m[1];
    const o = esOp(L[i]);
    if (o) { const a = cadenas(L[i]); if (a.length >= 7) { anota(o[1], a, { r: 'Reserva alérgicos', m: momento || 'Comida' }, i); n++; } }
    if (i > iniSeguros && /^\s*return \{ \.\.\.m/.test(L[i])) break;
  }
}

// Avisos de verdad, medidos.
const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const lista = [...filas.values()];
lista.forEach((f, i) => {
  f.id = 'r' + String(i + 1).padStart(4, '0');
  const a = analizar(f.ingredientes);
  // Igual que scripts/componer.js: 4p + 4c + 9g con los gramos ya redondeados.
  f.calc = { kcal: Math.round(a.p) * 4 + Math.round(a.c) * 4 + Math.round(a.g) * 9, p: Math.round(a.p), c: Math.round(a.c), g: Math.round(a.g), f: Math.round(a.f) };
  f.avisos = [];
  if (a.sinDatos.length) f.avisos.push({ t: 'alimento', x: 'No encuentro en la tabla: ' + a.sinDatos.join(', ') });
  const dif = f.et.kcal ? Math.abs(f.calc.kcal - f.et.kcal) / f.et.kcal : 0;
  if (dif > 0.15 && !a.sinDatos.length) f.avisos.push({ t: 'macros', x: 'La etiqueta dice ' + f.et.kcal + ' kcal y sus ingredientes suman ' + f.calc.kcal });
  if (/batido/i.test(f.nombre) && /canela/i.test(f.ingredientes)) f.avisos.push({ t: 'criterio', x: 'Batido con canela (criterio de la app: batidos sin canela)' });
  f._ing = new Set(f.ingredientes.split(',').map(t => norm(t).replace(/^[\d.,/\s]*(g|gr|ml)?\s*/, '').trim()).filter(Boolean));
});
// Casi iguales: dos nombres distintos con al menos el 75 % de los ingredientes en común.
for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
  const a = lista[i], b = lista[j];
  if (a.nombre === b.nombre) { (a.mismoNombre = a.mismoNombre || []).push(b.id); (b.mismoNombre = b.mismoNombre || []).push(a.id); continue; }
  const comunes = [...a._ing].filter(x => b._ing.has(x)).length;
  if (comunes >= 3 && comunes / Math.max(a._ing.size, b._ing.size) >= 0.75) { (a.parecidas = a.parecidas || []).push(b.id); (b.parecidas = b.parecidas || []).push(a.id); }
}
lista.forEach(f => {
  delete f._ing;
  f.ap = [...new Map(f.ap.map(x => [x.r + '|' + x.m, x])).values()];
  if (f.parecidas) f.avisos.push({ t: 'parecida', x: 'Casi igual que ' + f.parecidas.length + (f.parecidas.length === 1 ? ' receta más' : ' recetas más') });
  if (f.mismoNombre) f.avisos.push({ t: 'variantes', x: 'Hay ' + (f.mismoNombre.length + 1) + ' versiones con este nombre' });
});
fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, 'recetas.json'), JSON.stringify(lista));
fs.writeFileSync(path.join(salida, 'alimentos.json'), JSON.stringify({ alim: ALIM, cant: require(path.join(RAIZ, 'scripts', 'cant-defecto')) }));
const cuenta = {}; lista.forEach(f => f.avisos.forEach(a => { cuenta[a.t] = (cuenta[a.t] || 0) + 1; }));
const porRama = {}; lista.forEach(f => f.ap.forEach(a => { const k = a.r + ' · ' + a.m; porRama[k] = (porRama[k] || 0) + 1; }));
console.log(lista.length + ' recetas distintas ·', new Set(lista.map(f => f.nombre)).size, 'nombres ·', lista.reduce((s, f) => s + f.lineas.length, 0), 'apariciones');
console.log('avisos', cuenta);
console.log(porRama);
