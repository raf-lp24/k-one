// ============================================================================
// AUDITORÍA FIJA DE NUTRICIÓN (1 nov 2026)
//
// Lo que se comprobó a mano el 1 nov 2026 y no puede volver a romperse sin
// que salte aquí. Genera planes reales con el MISMO motor que la app y busca
// con listas PROPIAS (no las tablas del motor: un filtro no se audita a sí
// mismo) en nombre, ingredientes y pasos de cada opción servida.
//
//  1. Alergias e intolerancias escritas de muchas formas (14 alérgenos, frases,
//     siglas, sin tildes) en el desplegable, «Otra alergia», «No como» y dieta.
//  2. Cada alimento de data/alimentos.json como «no como».
//  3. Enfermedades: tensión alta sin curados ni salsa de soja con sal;
//     diabetes sin miel, mermelada, sirope ni dátil.
//  4. Seguridad del déficit: bajo peso, carrera en ≤ 14 días, mucho volumen.
//  5. Hidratos por día: el total semanal no se mueve y la tirada larga lleva
//     más que el rodaje suave.
//  6. Grasa mínima en los platos que no son repostaje, bebida ni ración fija.
//  7. Textos rotos que dejan las sustituciones.
//
// Uso: node scripts/auditar-filtros.js  (entra en `npm test`; sale con código 1
// si algo falla). Tarda ~1 min.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { crearMotor } = require('../lib/motor-servidor');
const motor = crearMotor(require('../lib/fuente-app').leerFuente());
const PASOS = motor.pasosReceta();

const BASE = { edad: '35', sexo: 'Hombre', peso: '78', altura: '178', enfermedad: 'No', enfermedadOtra: '', lesion: 'No', lesionDetalle: '', alergia: 'No', alergiaOtra: '', tca: 'No', jornada: 'Mezcla de pie y sentado', estres: 'Medio', sueno: '7-8 horas', dieta: 'Como de todo', noComida: '', comidas: '5', cocina: 'Casi siempre en casa', objetivo: 'Perder grasa', enfoqueMacros: 'Equilibrado', evento: '', eventoFecha: '', tipoPlan: 'Plan completo: entrenamiento + nutrición', deporte: 'Running', diasEntreno: '4 días', tiempoSesion: '45-60 min', horaEntreno: 'tarde', nivel: 'Llevo algo de tiempo', lugar: 'Gimnasio', diasEntrenoSolo: [], actividadSolo: '' };
const PERFILES = [
  { objetivo: 'Perder grasa', deporte: 'Running', horaEntreno: 'manana' },
  { objetivo: 'Ganar músculo', deporte: 'Gimnasio / Fuerza', sexo: 'Mujer', peso: '60', altura: '165' },
  { objetivo: 'Preparar una competición', tipoPlan: 'Solo nutrición, sin entrenamiento', deporte: 'Hyrox', diasEntrenoSolo: [0, 2, 4], actividadSolo: 'Intenso (5+ días/semana)' },
];
const gen = u => motor.generar({ ...BASE, ...u });
const N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function opciones(plan) {
  const out = new Map();
  [...(plan.nutricion || []), ...[].concat(...(plan.nutricionPorDia || []))].forEach(t => (t.opciones || []).forEach(o => {
    out.set(t.momento + '|' + o.nombre + '|' + o.ingredientes, { momento: t.momento, nombre: o.nombre || '', ing: o.ingredientes || '', pasos: o.pasos || PASOS[o.nombre] || '', prep: o.prep || '', o });
  }));
  return [...out.values()];
}
const fallos = [];
const falla = (seccion, txt) => { if (fallos.filter(f => f.startsWith(seccion)).length < 12) fallos.push(seccion + ' · ' + txt); else fallos.push(seccion); };
const w = x => new RegExp('(?<![a-zñ])(?:' + x + ')(?![a-zñ])', 'g');

// ── 1. ALERGIAS ────────────────────────────────────────────────────────────
// ok: lo que va justo detrás y hace seguro el alimento; antes: lo que va justo delante.
const G = {
  gluten: { re: w('trigo|pan|panes|pasta|pastas|macarrones?|espaguetis?|fideos?|lasana|harinas?|avena|cebada|centeno|espelta|cuscus|bulgur|seitan|galletas?|cereales|croutons?|picatostes?|pizzas?|noquis?|rebozad[oa]s?|empanad[oa]s?|salsa (?:de )?soja|\\d+ ?ml soja|cerveza|muesli|granola|biscotes?|tostas?|tostadas?|pita|bagel|copos de maiz|barritas?|semola|tortillas? de trigo'),
    ok: /^[^,.;()]{0,45}(sin gluten|certificad|de maiz|de arroz|de garbanzo|de boniato|de patata|de coco|de almendra|tamari|de calabac|de brocoli|de coliflor|de huevo|de lenteja|de quinoa|de trigo sarraceno|de tofu)/, antes: /(tamari|sin gluten|de arroz|de maiz|arroz|maiz)\s*$/ },
  lactosa: { re: w('leche|leches|yogur|yogures|yogurt|quesos?|requeson|nata|mantequilla|kefir|cottage|mozzarella|parmesano|feta|ricotta|burrata|mascarpone|skyr|natillas|bechamel|manchego'),
    ok: /^[^,.;]{0,40}(sin lactosa|de avena|de soja|de almendra|de coco|de arroz|vegetal)/, antes: /(sin lactosa|bebida|vegetal|de coco)[^,.]{0,15}$/ },
  leche: { re: w('leche|leches|yogur|yogures|yogurt|quesos?|requeson|nata|mantequilla|kefir|cottage|mozzarella|parmesano|feta|ricotta|skyr|whey|caseina|proteina aislada|proteina isolada'),
    ok: /^[^,.;]{0,12}(de avena|de soja|de almendra|de coco|de arroz|vegetal)/, antes: /(bebida|vegetal)[^,.]{0,10}$/ },
  huevo: { re: w('huevos?|claras?|yemas?|revuelto|mayonesa|merengue'), antes: /(tofu)[^,.]{0,8}$/ },
  frutosSecos: { re: w('almendras?|nuez|nueces|avellanas?|anacardos?|pistachos?|pinon(?:es)?|macadamias?|pecanas?|mazapan|turron|frutos secos'), ok: /^[^,.;]{0,6}(moscada)/ },
  cacahuete: { re: w('cacahuetes?|mani') },
  crustaceos: { re: w('gambas?|langostinos?|cangrejos?|surimi|bogavante|langosta|cigalas?') },
  moluscos: { re: w('mejillon(?:es)?|almejas?|calamar(?:es)?|pulpos?|sepias?|chipirones|berberechos?|navajas?|vieiras?|ostras?') },
  pescado: { re: w('pescados?|salmon(?:es)?|atun(?:es)?|merluzas?|bacalao|lubinas?|doradas?|sardinas?|caballas?|boquerones|anchoas?|rape|emperador|pez espada|truchas?|lenguado|bonito|rodaballo|mero') },
  soja: { re: w('soja|tofu|tempeh|edamame|miso|tamari') },
  sesamo: { re: w('sesamo|tahini|hummus') },
  sulfitos: { re: w('vino|vinagre|pasas|orejones|pepinillos?|encurtidos?') },
  melocoton: { re: w('melocoton(?:es)?|nectarinas?') },
};
// El nombre «Wrap…» o «tallarines» vale si el ingrediente es de maíz o de arroz.
const exentoGluten = (op, ctx) => /wrap|tallarines|fideos/.test(ctx) && /(tortillas? de maiz|de arroz|sin gluten)/.test(N(op.ing));
function busca(g, op) {
  for (const campo of ['nombre', 'ing', 'pasos']) {
    const t = N(op[campo]); const re = new RegExp(G[g].re.source, 'g'); let m;
    while ((m = re.exec(t))) {
      const d = t.slice(m.index + m[0].length, m.index + m[0].length + 50), an = t.slice(Math.max(0, m.index - 30), m.index);
      if (G[g].ok && G[g].ok.test(d)) continue; if (G[g].antes && G[g].antes.test(an)) continue;
      const ctx = t.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25);
      if (g === 'gluten' && exentoGluten(op, ctx)) continue;
      return `${op.nombre} [${campo}] «${ctx}»`;
    }
  }
  return null;
}
const FORMAS = {
  gluten: ['gluten', 'celíaca', 'celiaquia', 'Soy celiaco', 'sin TACC', 'trigo', 'intolerancia al gluten'],
  lactosa: ['lactosa', 'intolerancia a la lactosa'],
  leche: ['leche', 'lácteos', 'APLV', 'caseína', 'proteína de la leche'],
  huevo: ['huevo', 'alergia al huevo', 'ovoproductos'],
  frutosSecos: ['frutos secos', 'frutos de cáscara', 'nueces'],
  cacahuete: ['cacahuete', 'maní'],
  crustaceos: ['crustáceos', 'marisco'], moluscos: ['moluscos', 'marisco'],
  pescado: ['pescado', 'anisakis', 'pescado y marisco'],
  soja: ['soja', 'soya', 'tofu'], sesamo: ['sésamo', 'ajonjolí'], sulfitos: ['sulfitos'], melocoton: ['melocotón', 'LTP'],
};
const CASOS = [];
for (const g in FORMAS) for (const t of FORMAS[g]) CASOS.push([g, { alergia: 'Otra', alergiaOtra: t }]);
// «No como» con frases de alergia (en «no como», «leche» a secas es un gusto: solo la leche).
for (const [g, t] of [['gluten', 'gluten'], ['leche', 'alergia a la leche'], ['leche', 'leche y derivados'], ['leche', 'APLV'], ['huevo', 'huevo'], ['frutosSecos', 'frutos secos'], ['pescado', 'no me gusta el pescado'], ['crustaceos', 'marisco'], ['soja', 'soja'], ['sulfitos', 'sulfitos']]) CASOS.push([g, { noComida: t }]);
CASOS.push(['gluten', { alergia: 'Gluten' }], ['gluten', { dieta: 'Sin gluten' }], ['lactosa', { alergia: 'Lactosa' }], ['lactosa', { dieta: 'Sin lactosa' }], ['frutosSecos', { alergia: 'Frutos secos' }],
  ['huevo', { alergia: 'Otra', alergiaOtra: 'huevo y soja' }], ['soja', { alergia: 'Otra', alergiaOtra: 'huevo y soja' }],
  ['gluten', { alergia: 'Otra', alergiaOtra: 'soy celiaca e intolerante a la lactosa' }], ['lactosa', { alergia: 'Otra', alergiaOtra: 'soy celiaca e intolerante a la lactosa' }]);
let nPlanes = 0;
for (const [g, c] of CASOS) {
  for (const pf of PERFILES.slice(0, 2)) {
    const plan = gen({ ...pf, ...c }); nPlanes++;
    for (const op of opciones(plan)) { const h = busca(g, op); if (h) { falla('alergia ' + g + ' ' + JSON.stringify(c), h); break; } }
  }
}

// ── 2. CADA ALIMENTO COMO «NO COMO» ────────────────────────────────────────
{
  const ali = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'alimentos.json'), 'utf8'));
  const sing = x => x.length > 4 && /es$/.test(x) && !/(ques|ces)$/.test(x) ? x.slice(0, -2) : (x.length > 3 && /s$/.test(x) ? x.slice(0, -1) : x);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const NO_ES = [/leche de coco|nata de coco|bebida de \w+|yogur de (soja|coco)|postre de soja/, /(semillas|pipas) de calabaza/, /tortillas? de (trigo|maiz)|tortilla integral/, /panadera|panceta|panecillo/, /nuez moscada/, /sin gluten|sin lactosa/, /harina de (arroz|maiz|garbanzo)/, /agua de coco/];
  for (const k of Object.keys(ali.alimentos || ali)) {
    const re = new RegExp('(?<![a-zñ])' + N(k).split(/\s+/).map(p => esc(sing(p)) + '(?:s|es)?').join('\\s+(?:de\\s+)?') + '(?![a-zñ])', 'g');
    const plan = gen({ ...PERFILES[0], noComida: k }); nPlanes++;
    fuera: for (const op of opciones(plan)) for (const f of ['nombre', 'ing', 'pasos']) {
      const t = N(op[f]); re.lastIndex = 0; let m;
      while ((m = re.exec(t))) { const ctx = t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20); if (NO_ES.some(x => x.test(ctx))) continue; falla('no como «' + k + '»', `${op.nombre} [${f}] «${ctx}»`); break fuera; }
    }
  }
}

// ── 3. ENFERMEDADES ────────────────────────────────────────────────────────
for (const pf of PERFILES) {
  for (const op of opciones(gen({ ...pf, enfermedad: 'Hipertensión' }))) {
    const t = N(op.nombre + ' ' + op.ing);
    const m = t.match(/(?<![a-z])(jamon serrano|jamon iberico|salmon ahumado|lomo embuchado|cecina|chorizo|salchichon|anchoas?|bacon|panceta)(?![a-z])/) || t.match(/salsa (?:de )?soja(?! baja| sin gluten)|\d+ ?ml soja(?! texturizada)/);
    if (m) falla('tensión alta', `${op.nombre} «${m[0]}»`);
  }
  for (const op of opciones(gen({ ...pf, enfermedad: 'Diabetes' }))) {
    const m = N(op.nombre + ' ' + op.ing + ' ' + op.pasos).match(/(?<![a-z])(miel|mermelada|sirope|datil(?:es)?|agave)(?![a-z])/);
    if (m) falla('diabetes', `${op.nombre} «${m[0]}»`);
  }
}

// ── 4. SEGURIDAD DEL DÉFICIT ───────────────────────────────────────────────
{
  const fecha = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const p1 = gen({ sexo: 'Mujer', peso: '45', altura: '170', deporte: 'Running', diasEntreno: '5+ días', objetivo: 'Perder grasa', ajusteCalorico: -200 }); nPlanes++;
  if (p1.kcalObj < p1.tdee) falla('déficit', `bajo peso (IMC 15,6) con déficit: ${p1.kcalObj} < ${p1.tdee}`);
  const p2 = gen({ sexo: 'Mujer', peso: '60', altura: '165', deporte: 'Running', diasEntreno: '5+ días', objetivo: 'Perder grasa', evento: '10K', eventoFecha: fecha(10) }); nPlanes++;
  if (p2.kcalObj < p2.tdee) falla('déficit', `carrera en 10 días con déficit: ${p2.kcalObj} < ${p2.tdee}`);
  const p3 = gen({ sexo: 'Hombre', peso: '80', altura: '178', deporte: 'Running', diasEntreno: '5+ días', tiempoSesion: 'Más de 90 min', objetivo: 'Perder grasa' }); nPlanes++;
  if (p3.kcalObj < p3.tdee * 0.88) falla('déficit', `8 h/semana con déficit del ${Math.round((1 - p3.kcalObj / p3.tdee) * 100)} % (máx. 12 %)`);
}

// ── 5. HIDRATOS POR DÍA ────────────────────────────────────────────────────
for (const u of [{ deporte: 'Running', diasEntreno: '5+ días', tiempoSesion: '60-90 min', objetivo: 'Preparar una competición', nivel: 'Avanzado' }, { deporte: 'Gimnasio / Fuerza', objetivo: 'Ganar músculo' }, PERFILES[2]]) {
  const p = gen(u); nPlanes++;
  const suma = (p.carbsObjPorDia || []).reduce((a, b) => a + b, 0);
  if (Math.abs(suma - p.carbsObj * 7) > 7) falla('ciclado', `${u.deporte}: la semana suma ${suma} g y debería sumar ${p.carbsObj * 7} g`);
  if (u.deporte === 'Running') {
    const idx = re => (p.semana || []).findIndex(d => re.test(d.resumen || ''));
    const larga = idx(/tirada larga/i), suave = idx(/recovery|easy|suave/i);
    if (larga >= 0 && suave >= 0 && p.carbsObjPorDia[larga] <= p.carbsObjPorDia[suave]) falla('ciclado', `la tirada larga (${p.carbsObjPorDia[larga]} g) no lleva más hidratos que el rodaje suave (${p.carbsObjPorDia[suave]} g)`);
  }
  if (u.tipoPlan && !p.cicloCarbs) falla('ciclado', '«solo nutrición» con días de entreno no cicla');
}

// ── 6. GRASA MÍNIMA ────────────────────────────────────────────────────────
{
  const EXENTO = /pre-?entreno|post-?entreno|antes de|despu[ée]s de entrenar|recuperaci[óo]n|pre-?wod|post-?wod|pre-?carrera|post-?carrera|smoothie|batido|caf[eé]|zumo|gelatina|bebida/i;
  let n = 0, bajos = [];
  for (const pf of PERFILES.slice(0, 2)) for (const op of opciones(gen(pf))) {
    const k = parseInt(op.o.kcal, 10) || 0, g = parseInt(op.o.grasa, 10) || 0;
    if (k < 250 || op.o.racionFija || EXENTO.test(op.nombre + ' ' + op.prep)) continue;
    n++; if (g * 9 / k < 0.10) bajos.push(`${op.nombre} (${Math.round(g * 9 / k * 100)} %)`);
  }
  // Tolerancia: el escalado final puede dejar alguno rozando; más de un 2 % es que la regla se ha roto.
  if (bajos.length > Math.max(2, n * 0.02)) falla('grasa mínima', `${bajos.length} de ${n} platos por debajo del 10 % de grasa: ${bajos.slice(0, 4).join(', ')}`);
}

// ── 7. TEXTOS ROTOS ────────────────────────────────────────────────────────
{
  const ROTO = [[/(?<![a-záéíóúñ])([a-záéíóúñ]{3,})\s+\1(?![a-záéíóúñ])/i, 'palabra repetida'], [/\bde (?:arroz|soja|maíz) de (?:arroz|soja|maíz)\b/i, '«de X de X»'],
    [/\s,|,,|\(\s*\)|\s\./, 'puntuación rota'], [/undefined|\bNaN\b|\[object/, 'texto de programa'], [/sin lactosa sin lactosa|sin gluten sin gluten/i, 'calificativo doble'],
    [/(?<![a-záéíóúñ])(el|la|los|las)\s+(por|y|,|\.)(?![a-záéíóúñ])/i, 'artículo huérfano'], [/\bcon\s+(?:mézcla|espolvorea|cierra|sirve)/i, 'conector colgando']];
  const casos = [{}, { alergia: 'Lactosa' }, { noComida: 'lácteos' }, { noComida: 'huevo' }, { noComida: 'carne' }, { alergia: 'Otra', alergiaOtra: 'huevo y soja' }, { alergia: 'Otra', alergiaOtra: 'sésamo' }, { enfermedad: 'Diabetes' }, { noComida: 'tomate' }];
  for (const c of casos) for (const op of opciones(gen({ ...PERFILES[0], ...c }))) for (const f of ['nombre', 'ing', 'pasos']) for (const [re, que] of ROTO) {
    const m = op[f].match(re); if (m) { falla('texto roto ' + JSON.stringify(c), `${que}: ${op.nombre} [${f}] «${op[f].slice(Math.max(0, m.index - 30), m.index + 40)}»`); }
  }
}

// ── RESULTADO ──────────────────────────────────────────────────────────────
const unicos = [...new Set(fallos)];
if (unicos.length) {
  console.log(`\n✘ auditar-filtros: ${unicos.length} fallos (${nPlanes} planes)`);
  unicos.slice(0, 40).forEach(f => console.log('   ' + f));
  process.exit(1);
}
console.log(`✔ auditar-filtros: alergias, «no como», enfermedades, déficit, hidratos, grasa y textos sin fallos (${nPlanes} planes)`);
