// Reimplementa _buscarAlimento/_gramosDeUnidad de index.html para poder juzgar
// una receta ANTES de meterla: cuantos ingredientes resuelven contra
// alimentos.json y cuanto se desvia la suma real de las kcal declaradas.
// Es la misma comprobacion que ve el cliente al pulsar "Ver macros".
const fs = require('fs');
const RAIZ = 'C:/Users/Usuario/Desktop/Rafa Personl/Proyetos/Fragua';
const ALIM = JSON.parse(fs.readFileSync(RAIZ + '/data/alimentos.json', 'utf8'));
const CLAVES = Object.keys(ALIM).sort((a, b) => b.length - a.length);
const CANT_DEFECTO = require('./cant-defecto');

// Misma funcion que index.html: rellena la cantidad de lo que va suelto
// ("AOVE" -> "10g AOVE"). Sin esto se mide un texto que el cliente no ve.
function ponerCantidades(texto) {
  return texto.split(',').map(x => {
    const t = x.trim();
    if (!t) return t;
    if (/^d|^(un|una|medio|media)/i.test(t)) return t;
    const def = CANT_DEFECTO[t.toLowerCase()];
    return def ? def + ' ' + t : t;
  }).join(', ');
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function buscarAlimento(texto) {
  const limpio = texto.replace(/\(.*?\)/g, '')
    .replace(/\bsin lactosa\b/gi, '')
    .replace(/\bpequeñ[oa]s?\b/gi, '')
    .replace(/\s+/g, ' ');
  const t = norm(limpio);
  const k = CLAVES.find(c => t.includes(norm(c)));
  return k ? { clave: k, ...ALIM[k] } : null;
}

const PESO_UNIDAD = [
  [/pl[áa]tano/i, 120], [/huevos?\b/i, 55], [/claras?\b/i, 33], [/kiwis?\b/i, 75],
  [/manzana|pera\b/i, 180], [/naranja/i, 180], [/aguacate/i, 200], [/tomate/i, 120],
  [/tosta|rebanada|reba[ñn]ada/i, 30], [/panecillo/i, 60], [/tortita|torta de arroz|tortas de arroz/i, 9],
  [/scoop/i, 30], [/cda|cucharada sopera|cucharada\b/i, 15], [/cdta|cucharadita/i, 5],
  [/pu[ñn]ado/i, 25], [/loncha/i, 20], [/yogur/i, 125], [/vaso/i, 200],
  [/latas?\b/i, 80],
  [/zanahorias?/i, 80], [/mandarinas?/i, 90], [/berenjenas?/i, 250],
  [/calabac[íi]n(es)?/i, 200], [/mangos?\b/i, 200], [/boniatos?/i, 150],
  [/pimientos?/i, 120], [/champi[ñn]on(es)?/i, 20], [/rama de apio|ramas de apio/i, 40],
  [/tortillas? (integral|de trigo|de ma[íi]z)/i, 40], [/d[áa]tiles?/i, 8],
  [/higos?\b/i, 50], [/ciruelas?/i, 60], [/melocot[óo]n(es)?/i, 150], [/granadas?/i, 180],
  [/pieza|unidad/i, 100]
];
function gramosDeUnidad(texto) {
  const m = texto.trim().match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.*)$/);
  if (!m) return null;
  let n;
  if (m[1].includes('/')) { const [a, b] = m[1].split('/').map(Number); n = b ? a / b : null; }
  else n = parseFloat(m[1].replace(',', '.'));
  if (!n) return null;
  const hit = PESO_UNIDAD.find(([re]) => re.test(m[2]));
  return hit ? { gramos: Math.round(n * hit[1]), resto: m[2] } : null;
}

// Devuelve {kcal, prot, carbs, grasa, fibra, sinCantidad:[], sinDatos:[]}
function analizar(ingredientes) {
  const r = { kcal: 0, p: 0, c: 0, g: 0, f: 0, sinCantidad: [], sinDatos: [] };
  for (const txt of ponerCantidades(ingredientes).split(',')) {
    const t = txt.trim();
    let gramos = null, resto = null;
    const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b\s*(.+)$/i);
    if (m) { gramos = parseFloat(m[1].replace(',', '.')); resto = m[3]; }
    else { const u = gramosDeUnidad(t); if (u) { gramos = u.gramos; resto = u.resto; } }
    if (gramos === null) { r.sinCantidad.push(t); continue; }
    const al = buscarAlimento(resto);
    if (!al) { r.sinDatos.push(t); continue; }
    const f = gramos / 100;
    r.kcal += al.kcal * f; r.p += al.p * f; r.c += al.c * f; r.g += al.g * f; r.f += (al.f || 0) * f;
  }
  for (const k of ['kcal', 'p', 'c', 'g', 'f']) r[k] = Math.round(r[k] * 10) / 10;
  return r;
}

module.exports = { analizar, buscarAlimento, ponerCantidades, ALIM };

if (require.main === module) {
  // Linea base sobre TODAS las op() del archivo.
  const L = fs.readFileSync(RAIZ + '/index.html', 'utf8').split('\n');
  const re = /^\s*op\("([^"]*)",\s*"([^"]*)",\s*"(\d+) kcal"/;
  let total = 0, ok = 0, frases = 0, resueltas = 0, desviadas = [];
  for (const l of L) {
    const m = re.exec(l);
    if (!m) continue;
    total++;
    const a = analizar(m[2]);
    const nFrases = m[2].split(',').length;
    frases += nFrases;
    resueltas += nFrases - a.sinDatos.length;
    const dec = +m[3];
    const dev = Math.abs(a.kcal - dec) / dec;
    if (dev <= 0.15) ok++; else desviadas.push([Math.round(dev * 100), dec, Math.round(a.kcal), m[1]]);
  }
  console.log(total, 'recetas ·', ok, 'con kcal dentro del 15% (' + Math.round(ok / total * 100) + '%)');
  console.log(frases, 'frases de ingrediente ·', Math.round(resueltas / frases * 100) + '% resuelven contra alimentos.json');
  console.log('\nPeores desviaciones:');
  desviadas.sort((a, b) => b[0] - a[0]).slice(0, 12).forEach(d => console.log('  ' + d[0] + '% · declara ' + d[1] + ' suma ' + d[2] + ' · ' + d[3]));
}
