// Copia data/alimentos.json dentro de index.html (entre /*ALIMENTOS*/ y
// /*FIN_ALIMENTOS*/). El motor de planes la necesita SIN esperar a descargarla:
// al generar un plan cuadra las cantidades de cada plato con su etiqueta usando
// los mismos valores que enseña "Ver macros" (ver _conciliarConVerMacros).
//
//   node scripts/incrustar-alimentos.js          -> actualiza index.html
//   node scripts/incrustar-alimentos.js --check  -> falla si no coinciden
//
// Si cambias data/alimentos.json, pasa este script (comprobar-proyecto.js lo vigila).
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const fHtml = path.join(raiz, 'index.html');
const tabla = JSON.stringify(JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'alimentos.json'), 'utf8')));
// El motor vive en app.js desde el 25 oct 2026: se lee y se escribe a través de lib/fuente-app.js.
const fuenteApp = require('../lib/fuente-app');
const html = fuenteApp.leerFuente(raiz);
const re = /\/\*ALIMENTOS\*\/[\s\S]*?\/\*FIN_ALIMENTOS\*\//;
if (!re.test(html)) { console.error('index.html no tiene las marcas /*ALIMENTOS*/ ... /*FIN_ALIMENTOS*/'); process.exit(1); }
const nuevo = '/*ALIMENTOS*/' + tabla + '/*FIN_ALIMENTOS*/';
if (process.argv.includes('--check')) {
  const actual = html.match(re)[0];
  if (actual !== nuevo) { console.error('La tabla incrustada en index.html no coincide con data/alimentos.json: node scripts/incrustar-alimentos.js'); process.exit(1); }
  console.log('tabla de alimentos incrustada al día');
  process.exit(0);
}
fuenteApp.escribirFuente(html.replace(re, () => nuevo), raiz);
console.log('index.html: tabla de alimentos actualizada (' + tabla.length + ' caracteres)');
