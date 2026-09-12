// AUDITORÍA COMPLETA de la nutrición y el entrenamiento de K-ONE.
//
// Reúne en un solo informe todas las comprobaciones que se hacen sobre el
// archivo: la tabla de alimentos uno por uno, el recetario plato a plato y la
// estructura de los planes. Lo que necesita ejecutar el motor (generar planes
// reales) se comprueba aparte, en el navegador.
//
//   node scripts/auditoria-completa.js
//
// No modifica nada: solo mide y avisa. Cada bloque termina en OK o en la
// lista de lo que falla.
const path = require('path');
const fs = require('fs');
const A = require('../data/alimentos.json');
const { analizar, buscarAlimento, ponerCantidades } = require('./validar-recetas');

const RUTA = path.join(__dirname, '..', 'index.html');
const TXT = fs.readFileSync(RUTA, 'utf8');
const L = TXT.split(/\r?\n/);

let fallos = 0, avisos = 0;
const sec = t => console.log('\n' + '═'.repeat(72) + '\n  ' + t + '\n' + '═'.repeat(72));
const ok = t => console.log('  ✔ ' + t);
const mal = (t, lista = []) => { fallos++; console.log('  ✘ ' + t); lista.slice(0, 10).forEach(x => console.log('       ' + x)); if (lista.length > 10) console.log('       … y ' + (lista.length - 10) + ' más'); };
const nota = (t, lista = []) => { avisos++; console.log('  ! ' + t); lista.slice(0, 8).forEach(x => console.log('       ' + x)); };

// ═══════════════════════ 1 · TABLA DE ALIMENTOS ═══════════════════════
sec('1 · TABLA DE ALIMENTOS (' + Object.keys(A).length + ' entradas)');

const imposibles = [], fibraMal = [], kcalMal = [], catMal = [], negativos = [], sinNombre = [];
for (const [k, v] of Object.entries(A)) {
  if (!v.n || typeof v.kcal !== 'number' || typeof v.p !== 'number' || typeof v.c !== 'number' || typeof v.g !== 'number' || !v.cat) sinNombre.push(k);
  if (v.p < 0 || v.c < 0 || v.g < 0 || v.kcal < 0 || (v.f || 0) < 0) negativos.push(k);
  if (v.p + v.c + v.g > 101) imposibles.push(k + ': P' + v.p + '+C' + v.c + '+G' + v.g + ' = ' + (v.p + v.c + v.g).toFixed(1) + 'g/100g');
  if ((v.f || 0) > v.c + 0.01) fibraMal.push(k + ': fibra ' + v.f + ' > hidratos ' + v.c);
  const neto = 4 * v.p + 4 * Math.max(0, v.c - (v.f || 0)) + 9 * v.g;
  const bruto = 4 * v.p + 4 * v.c + 9 * v.g;
  const mejor = Math.abs(neto - v.kcal) < Math.abs(bruto - v.kcal) ? neto : bruto;
  if (v.kcal > 5 && Math.abs(mejor - v.kcal) / v.kcal > 0.25) kcalMal.push(k + ': ' + v.kcal + ' kcal vs ' + Math.round(mejor) + ' segun sus macros');
  if (v.cat === 'Verduras y fruta' && v.g > 12 && !/coco|aceituna|aguacate/i.test(k)) catMal.push(k + ' (verdura/fruta) con ' + v.g + 'g de grasa');
  if (v.cat === 'Proteínas' && v.p < 8 && v.kcal > 40) catMal.push(k + ' (proteína) con solo ' + v.p + 'g de proteína');
}
// duplicados: mismo nombre visible, valores distintos
const porNombre = new Map();
for (const k of Object.keys(A)) { const l = porNombre.get(A[k].n) || []; l.push(k); porNombre.set(A[k].n, l); }
const dups = [];
for (const [n, ks] of porNombre) {
  if (ks.length < 2) continue;
  const firmas = new Set(ks.map(k => A[k].kcal + '/' + A[k].p + '/' + A[k].c + '/' + A[k].g));
  if (firmas.size > 1) dups.push(n + ' → ' + ks.map(k => k + '(' + A[k].kcal + ')').join(', '));
}

sinNombre.length ? mal(sinNombre.length + ' entradas incompletas', sinNombre) : ok('todas las entradas tienen nombre, macros y categoría');
negativos.length ? mal(negativos.length + ' con valores negativos', negativos) : ok('ningún valor negativo');
imposibles.length ? mal(imposibles.length + ' con más de 100 g de macros por 100 g', imposibles) : ok('ningún alimento supera los 100 g de macros por 100 g');
fibraMal.length ? mal(fibraMal.length + ' con más fibra que hidratos', fibraMal) : ok('la fibra nunca supera a los hidratos');
dups.length ? mal(dups.length + ' duplicados con valores distintos', dups) : ok('ningún alimento repetido con valores distintos');
kcalMal.length ? nota(kcalMal.length + ' con kcal que no cuadran (revisar: la fibra y el alcohol lo justifican)', kcalMal) : ok('las kcal cuadran con los macros en todos');
catMal.length ? nota(catMal.length + ' con valores raros para su categoría', catMal) : ok('valores plausibles para su categoría');

// ═══════════════════════ 2 · RECETARIO ═══════════════════════
const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
let fin = arr[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [['perder grasa', arr[0], arr[1]], ['ganar músculo', arr[1], arr[2]], ['mantenimiento', arr[2], fin]];
const platos = [];
for (const [rama, ini, e] of ramas) {
  let mo = null;
  for (let k = ini; k < e; k++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[k]);
    if (m) { mo = m[1]; continue; }
    const g = /^\s*op\("([^"]*)",\s*"([^"]*)",\s*"(\d+) kcal",\s*"(\d+)g prot",\s*"(\d+)g carbs",\s*"(\d+)g grasa"/.exec(L[k]);
    if (g && mo) platos.push({ rama, momento: mo, nombre: g[1], ing: g[2], kcal: +g[3], p: +g[4], c: +g[5], g: +g[6], linea: k + 1 });
  }
}
sec('2 · RECETARIO (' + platos.length + ' opciones en 15 pools)');

// 2a · tamaño de los pools
const pools = {};
platos.forEach(p => { const k = p.rama + ' · ' + p.momento; pools[k] = (pools[k] || 0) + 1; });
const tam = Object.values(pools);
const desiguales = Object.entries(pools).filter(([, n]) => n < Math.max(...tam) - 2);
desiguales.length ? nota('pools con menos opciones que el resto', desiguales.map(([k, n]) => k + ': ' + n))
                  : ok('los 15 pools están parejos (' + Math.min(...tam) + '-' + Math.max(...tam) + ' opciones)');

// 2b · ingredientes que no resuelven
const sinResolver = [];
let frases = 0;
for (const p of platos) {
  for (const txt of ponerCantidades(p.ing).split(',')) {
    const t = txt.trim(); if (!t) continue;
    const q = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b\s*(.+)$/i);
    const resto = q ? q[3] : (t.match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.*)$/) || [])[2];
    if (!resto) continue;
    frases++;
    if (!buscarAlimento(resto)) sinResolver.push(p.nombre + ' :: ' + t);
  }
}
sinResolver.length ? mal(sinResolver.length + ' de ' + frases + ' ingredientes no encuentran alimento', sinResolver)
                   : ok('los ' + frases + ' ingredientes resuelven contra la tabla');

// 2c · etiqueta vs ingredientes
const desviadas = platos.map(p => ({ p, dev: (analizar(p.ing).kcal - p.kcal) / p.kcal })).filter(x => Math.abs(x.dev) > 0.15);
const pct = Math.round((1 - desviadas.length / platos.length) * 100);
pct >= 80 ? ok(pct + '% de los platos tienen la etiqueta a menos del 15% de sus ingredientes')
          : nota('solo el ' + pct + '% cuadra a menos del 15%', desviadas.slice(0, 8).map(x => Math.round(x.dev * 100) + '% · ' + x.p.nombre));

// 2d · macros coherentes con la etiqueta
const formulaMal = platos.filter(p => Math.abs(p.kcal - (4 * p.p + 4 * p.c + 9 * p.g)) > 12);
formulaMal.length ? mal(formulaMal.length + ' con kcal que no salen de 4p+4c+9g', formulaMal.map(p => p.nombre + ': ' + p.kcal + ' vs ' + (4 * p.p + 4 * p.c + 9 * p.g)))
                  : ok('las kcal de todos los platos salen de sus propios macros');

// 2e · platos en la toma equivocada
const DE_COMIDA = /pescado|merluza|bacalao|dorada|lubina|sepia|calamar|gambas|mejillones|boquerones|emperador|bonito|salm[óo]n al horno|pollo al horno|pechuga de pollo|pavo al horno|ternera|solomillo|entrecot|lomo de cerdo|cinta de lomo|conejo|alb[óo]ndigas|guiso|estofad|potaje|marmitako|paella|risotto|lentejas|garbanzos|jud[íi]as|alubias|pisto|papillote/i;
const fueraDeSitio = platos.filter(p => /Desayuno|Media ma[ñn]ana|Merienda/.test(p.momento) && DE_COMIDA.test(p.nombre));
fueraDeSitio.length ? mal(fueraDeSitio.length + ' platos de comida o cena colocados en desayuno o snack', fueraDeSitio.map(p => p.rama + ' · ' + p.momento + ' · ' + p.nombre))
                    : ok('ningún plato de comida o cena está puesto como desayuno o snack');

// 2f · salsas
const SALSA_OK = /caser[oa]|0%|natural/i;
const salsasMal = [];
for (const p of platos) for (const t of p.ing.split(',')) {
  const s2 = t.trim();
  if (/guacamole|hummus|salsa de yogur|salsa teriyaki|pesto|mayonesa|k[ée]tchup|salsa barbacoa|salsa c[ée]sar/i.test(s2) && !SALSA_OK.test(s2)) salsasMal.push(p.nombre + ' :: ' + s2);
}
salsasMal.length ? mal(salsasMal.length + ' salsas que no son caseras ni 0%', salsasMal)
                 : ok('todas las salsas del recetario son caseras o 0%');

// 2g · nombres que prometen lo que no llevan
const promesas = [];
for (const p of platos) {
  if (/c[ée]sar/i.test(p.nombre) && !/salsa c[ée]sar/i.test(p.ing)) promesas.push(p.nombre + ' → sin salsa César');
  if (/carbonara/i.test(p.nombre) && !/huevo|nata/i.test(p.ing)) promesas.push(p.nombre + ' → sin huevo ni nata');
  if (/bolo[ñn]esa/i.test(p.nombre) && !/carne|ternera|pavo/i.test(p.ing)) promesas.push(p.nombre + ' → sin carne');
}
promesas.length ? mal(promesas.length + ' nombres que prometen algo que la receta no lleva', promesas)
                : ok('ningún nombre promete un ingrediente que la receta no tiene');

// 2h · pasos de preparación
const conPasos = new Set([...TXT.slice(TXT.indexOf('const RECETA_PASOS')).matchAll(/^\s*"([^"]+)":/gm)].map(m => m[1]));
const nombres = [...new Set(platos.map(p => p.nombre))];
const sinPasos = nombres.filter(n => !conPasos.has(n));
const pctPasos = Math.round((1 - sinPasos.length / nombres.length) * 100);
console.log('  · ' + pctPasos + '% de las recetas tienen pasos escritos a mano (' + sinPasos.length + ' usan el texto genérico)');

// ═══════════════════════ 3 · REPARTO Y CALIDAD POR OBJETIVO ═══════════════════════
sec('3 · REPARTO DEL DÍA Y CALIDAD POR OBJETIVO');
const VERDURA = /lechuga|tomate|pepino|pimiento|calabac[íi]n|berenjena|espinaca|br[óo]coli|jud[íi]as verdes|zanahoria|cebolla|champi[ñn]on|esp[áa]rrago|r[úu]cula|can[óo]nigos|ensalada|verduras|puerro|coliflor|coles de bruselas|alcachofa|calabaza|apio|guisantes|setas|acelga|escarola|menestra|pisto|grelos/i;
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const [rama] of ramas) {
  const dela = platos.filter(p => p.rama === rama);
  const tomas = {};
  dela.forEach(p => { (tomas[p.momento] = tomas[p.momento] || []).push(p); });
  const totalKcal = Object.values(tomas).reduce((s, l) => s + med(l.map(x => x.kcal)), 0);
  const totalProt = Object.values(tomas).reduce((s, l) => s + med(l.map(x => x.p)), 0);
  const fibra = Object.values(tomas).reduce((s, l) => s + med(l.map(x => analizar(x.ing).f)), 0);
  const pctProt = Math.round(totalProt * 4 / totalKcal * 100);
  const comida = tomas['Comida'] ? med(tomas['Comida'].map(x => x.kcal)) : 0;
  const cena = tomas['Cena'] ? med(tomas['Cena'].map(x => x.kcal)) : 0;
  const verdComida = tomas['Comida'] ? Math.round(tomas['Comida'].filter(p => VERDURA.test(p.ing)).length / tomas['Comida'].length * 100) : 0;
  const verdCena = tomas['Cena'] ? Math.round(tomas['Cena'].filter(p => VERDURA.test(p.ing)).length / tomas['Cena'].length * 100) : 0;
  console.log('\n  ' + rama.toUpperCase() + ': ' + totalKcal + ' kcal · ' + totalProt + 'g prot (' + pctProt + '% de las kcal) · ' + fibra.toFixed(1) + 'g de fibra');
  console.log('     comida ' + comida + ' kcal vs cena ' + cena + ' kcal · verdura: comida ' + verdComida + '%, cena ' + verdCena + '%');
  if (rama === 'perder grasa') {
    comida > cena ? ok('   en déficit la comida pesa más que la cena, como debe ser') : mal('   en déficit la cena pesa igual o más que la comida');
    pctProt >= 30 ? ok('   proteína alta para un déficit (' + pctProt + '%)') : mal('   proteína baja para un déficit: ' + pctProt + '%');
    verdComida >= 90 && verdCena >= 90 ? ok('   verdura en casi todas las comidas y cenas') : nota('   falta verdura en comidas o cenas');
    fibra >= 25 ? ok('   fibra en el rango recomendado') : nota('   fibra por debajo de lo recomendado (25-30g): ' + fibra.toFixed(1) + 'g');
  }
  if (rama === 'ganar músculo') {
    totalProt >= 150 ? ok('   proteína suficiente para ganancia (' + totalProt + 'g)') : mal('   proteína baja para ganancia: ' + totalProt + 'g');
  }
}

// ═══════════════════════ 4 · ENTRENAMIENTO ═══════════════════════
sec('4 · ENTRENAMIENTO (estructura en el archivo)');
const fichas = require('../data/ejercicios-info.json');
const nFichas = Object.keys(fichas).length;
const conAcento = Object.keys(fichas).filter(k => /[áéíóúñ]/i.test(k));
conAcento.length ? mal(conAcento.length + ' fichas con acentos en la clave (el buscador compara sin acentos y no las encuentra)', conAcento)
                 : ok(nFichas + ' fichas de ejercicio, ninguna con acentos en la clave');
const fotos = fs.existsSync(path.join(__dirname, '..', 'data', 'ej-img')) ? fs.readdirSync(path.join(__dirname, '..', 'data', 'ej-img')).length : 0;
console.log('  · ' + fotos + ' fotos de ejercicio en data/ej-img');
const sinPasosFicha = Object.entries(fichas).filter(([, v]) => !v || (!v.pasos && !v.como && !v.desc && !v.d));
sinPasosFicha.length ? nota(sinPasosFicha.length + ' fichas sin descripción', sinPasosFicha.slice(0, 5).map(x => x[0])) : ok('todas las fichas tienen contenido');

// ═══════════════════════ 5 · AGENTE DE AUDITORÍA ═══════════════════════
// lib/normalizador-alimentos.js (el agente que revisa los planes guardados)
// COPIA tablas y patrones del motor, porque desde Node no se puede requerir
// index.html. Si alguien toca una copia y no la otra, el agente empezaría a
// avisar de cosas que el motor da por buenas (o a callar las que quita) sin
// que nadie se enterase. Aquí se comparan las dos y FALLA si se separan.
sec('5 · AGENTE DE AUDITORÍA (lib/normalizador-alimentos.js)');
const AG = require('../lib/normalizador-alimentos');

// Trozo "{ ... }" que empieza en `desde`, contando llaves.
const _bloqueLlaves = (desde) => {
  const j = TXT.indexOf('{', desde);
  if (desde < 0 || j < 0) return null;
  let prof = 0;
  for (let k = j; k < TXT.length; k++) {
    if (TXT[k] === '{') prof++;
    else if (TXT[k] === '}' && --prof === 0) return TXT.slice(j, k + 1);
  }
  return null;
};
const _objetoMotor = (nombre, ...deps) => {
  const src = _bloqueLlaves(TXT.indexOf('const ' + nombre + ' = {'));
  if (!src) return null;
  return new Function(...deps.map(d => d[0]), 'return (' + src + ');')(...deps.map(d => d[1]));
};
const _mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const desincronizados = [];

const famMotor = _objetoMotor('FAMILIAS_ALIMENTOS');
if (!_mismo(famMotor, AG.FAMILIAS_ALIMENTOS)) desincronizados.push('FAMILIAS_ALIMENTOS');
const sinMotor = famMotor && _objetoMotor('SINONIMOS_ALERGENO', ['FAMILIAS_ALIMENTOS', famMotor]);
if (!_mismo(sinMotor, AG.SINONIMOS_ALERGENO)) desincronizados.push('SINONIMOS_ALERGENO');
if (!_mismo(_objetoMotor('SINONIMOS_MISMO_ALIMENTO'), AG.SINONIMOS_MISMO_ALIMENTO)) desincronizados.push('SINONIMOS_MISMO_ALIMENTO');
const equivMotor = _objetoMotor('_EQUIV_TILDE');
if (!_mismo(equivMotor, AG._EQUIV_TILDE)) desincronizados.push('_EQUIV_TILDE');

const sepMotor = (TXT.match(/const _SEPARADOR_ALIMENTOS = \/(.+)\/([a-z]*);/) || [])[1];
if (sepMotor !== AG._SEPARADOR_ALIMENTOS.source) desincronizados.push('_SEPARADOR_ALIMENTOS');

// neutralizar: la cadena de .replace(/…/gi, '·') del motor, patrón a patrón.
{
  const ini = TXT.indexOf('const neutralizar = (txt) => txt');
  const lineas = ini < 0 ? [] : TXT.slice(ini).split(/\r?\n/).slice(1);
  const pats = [];
  for (const l of lineas) {
    const m = l.match(/^\s*\.replace\(\/(.+)\/([a-z]*), '·'\)\s*(;?)\s*$/);
    if (!m) break;
    pats.push(m[1] + '/' + m[2]);
    if (m[3]) break;
  }
  const deLib = AG.NEUTRALIZAR.map(re => re.source + '/' + re.flags);
  if (!pats.length || !_mismo(pats, deLib)) desincronizados.push('neutralizar (' + pats.length + ' patrones en el motor, ' + deLib.length + ' en el agente)');
}

// rastros: los tres patrones de la red de seguridad, en el orden del motor.
{
  const pats = [...TXT.matchAll(/rastros\.push\(\/(.+)\/[a-z]*\);/g)].map(m => m[1]);
  const deLib = ['gluten', 'lactosa', 'frutos secos'].map(k => AG.RASTROS[k].source);
  if (!_mismo(pats, deLib)) desincronizados.push('rastros');
}

// _normTexto / _raizSinPlural / _reAlimento: se ejecutan las del MOTOR y se
// comparan resultados con las del agente sobre palabras de muestra.
{
  const fn = n => _bloqueLlaves(TXT.indexOf('function ' + n + '('));
  const src = ['_normTexto', '_raizSinPlural', '_reAlimento'].map(n => 'function ' + n + TXT.slice(TXT.indexOf('function ' + n + '(') + ('function ' + n).length, TXT.indexOf('{', TXT.indexOf('function ' + n + '('))) + fn(n)).join('\n');
  let motor = null;
  try { motor = new Function('_EQUIV_TILDE', src + '\nreturn { _normTexto, _raizSinPlural, _reAlimento };')(equivMotor); } catch (e) {}
  const muestra = ['espárragos', 'Huevas', 'maiz', 'quinoa', 'nueces', 'piñones', 'queso fresco', 'Mejillones', 'judías', 'atún', 'Lácteos'];
  const iguales = motor && muestra.every(w =>
    motor._normTexto(w) === AG._normTexto(w) &&
    motor._raizSinPlural(motor._normTexto(w)) === AG._raizSinPlural(AG._normTexto(w)) &&
    motor._reAlimento(w).source === AG._reAlimento(w).source);
  if (!iguales) desincronizados.push('_normTexto/_raizSinPlural/_reAlimento');
}

desincronizados.length
  ? mal(desincronizados.length + ' piezas del agente ya no coinciden con el motor (copia la versión de index.html a lib/normalizador-alimentos.js)', desincronizados)
  : ok('el agente usa exactamente las mismas tablas, patrones y normalización que el motor');

// 5b · casos conocidos: los que DEBEN saltar saltan, y los correctos no.
{
  const plan = (nombre, ingredientes, pasos) => ({ nutricion: [{ momento: 'Desayuno', opciones: [{ nombre, ingredientes, pasos }] }] });
  const casos = [
    ['lactosa, queso a secas', { alergia: 'Lactosa' }, plan('Tostada con queso curado', '1 tosta, 30g queso curado', 'Pon el queso encima.'), true],
    ['lactosa, todo sin lactosa', { alergia: 'Lactosa' }, plan('Tostada con queso curado sin lactosa', '1 tosta, 30g queso curado sin lactosa, 200ml leche sin lactosa', 'Pon el queso curado sin lactosa encima.'), false],
    ['lactosa, yogur de coco y bebida de avena', { alergia: 'Lactosa' }, plan('Yogur de coco (sin lactosa) con fruta', '200g yogur de coco (sin lactosa), 200ml bebida de avena', 'Mezcla el yogur de coco con la fruta.'), false],
    ['sin lactosa, leche suelta en los pasos', { dieta: 'Sin lactosa' }, plan('Batido de caseína', '200ml leche sin lactosa, proteína aislada de suero (sin lactosa)', 'Mete la leche en la batidora. Bate 30 segundos. Añade la proteína aislada de suero (sin lactosa).'), true],
    ['gluten, pan sin gluten de centeno', { alergia: 'Gluten' }, plan('Tostada', '2 rebanadas de pan sin gluten', 'Tuesta el pan sin gluten de centeno. Añade tomate.'), true],
    ['gluten, bocadillo con panecillo sin gluten', { alergia: 'Gluten' }, plan('Mini bocadillo de jamón con tomate', '1 panecillo sin gluten, 30g jamón, tomate', 'Abre el panecillo sin gluten y rellena.'), false],
    ['gluten, bocadillo con pan normal', { alergia: 'Gluten' }, plan('Bocadillo de jamón', '1 barra de pan, 30g jamón', 'Abre el pan.'), true],
    ['sin gluten, patatas panadera', { dieta: 'Sin gluten' }, plan('Merluza con patatas panadera', '200g merluza, 200g patata panadera', 'Hornea las patatas panadera 20 min.'), false],
    ['gluten, harina y fideos de arroz', { alergia: 'Gluten' }, plan('Fideos de arroz con pollo', '100g fideos de arroz, harina de arroz', 'Cuece los fideos de arroz.'), false],
    ['no come espárragos (sin tilde) y la receta la lleva', { noComida: 'Espinacas, esparragos, maiz, tataki, huevas, quinoa' }, plan('Pollo con espárragos', '180g pollo, 150g espárragos trigueros', 'Saltea los espárragos.'), true],
    ['no come leche: no es toda la familia', { noComida: 'leche' }, plan('Yogur natural con fruta', '150g yogur natural, 1 manzana', 'Mezcla.'), false],
    ['otra alergia marisco, gambas', { alergia: 'Otra', alergiaOtra: 'marisco' }, plan('Pasta con gambas', '100g pasta, 100g gambas', 'Saltea las gambas.'), true],
    ['frutos secos, nueces en los pasos', { alergia: 'Frutos secos' }, plan('Yogur con fruta', '150g yogur, 1 pera, semillas de calabaza', 'Trocea la pera y añade las nueces.'), true],
    ['sin restricciones', {}, plan('Tostada con queso', '1 tosta, 30g queso', 'Pon el queso.'), false],
    ['sin plan', { alergia: 'Lactosa' }, null, false],
  ];
  const fallan = casos.filter(([, ud, p, espera]) => (AG.auditarPlan(ud, p).length > 0) !== espera).map(c => (c[3] ? 'NO salta: ' : 'salta sin motivo: ') + c[0]);
  // Una palabra = un aviso por sitio, aunque la cacen varias variantes internas.
  const esp = AG.auditarPlan({ noComida: 'esparragos' }, plan('Pollo con espárragos', '150g espárragos trigueros', 'Saltea los espárragos.'));
  if (esp.length !== 3) fallan.push('"espárragos" repetido: ' + esp.length + ' avisos en 3 sitios (nombre, ingredientes, pasos)');
  fallan.length ? mal(fallan.length + ' casos conocidos del agente fallan', fallan)
                : ok('los ' + casos.length + ' casos conocidos del agente dan lo esperado, sin avisos repetidos');
}

// ═══════════════════════ RESUMEN ═══════════════════════
sec('RESUMEN');
console.log('  ' + (fallos === 0 ? '✔ Sin fallos.' : '✘ ' + fallos + ' comprobaciones falladas.') + '  ' + (avisos ? avisos + ' avisos para revisar.' : 'Sin avisos.'));
console.log('\n  Lo que NO cubre este script (hay que probarlo generando planes en el');
console.log('  navegador): filtros de lesión y alérgeno sobre planes reales, escalado');
console.log('  de raciones, repostaje por día de entreno y diferencias por objetivo.');
process.exit(fallos ? 1 : 0);
