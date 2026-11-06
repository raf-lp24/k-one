// ============================================================================
// FUENTE DE LA APP: index.html + app.js (25 oct 2026)
//
// El código de la app (motor de planes incluido) vivía dentro de un <script> de
// index.html y viajaba en la portada a cada visitante (342 KB comprimidos). Ahora
// está en /app.js y la portada solo lleva <script src="/app.js"></script> en el
// mismo sitio (sin defer: se ejecuta en el mismo orden que antes).
//
// Muchas herramientas (auditores, tests, el motor del servidor) buscan cosas
// dentro de "index.html". Para no cambiarlas todas, `juntar()` vuelve a meter
// app.js en su sitio y devuelve EXACTAMENTE el index.html de antes, y `separar()`
// hace lo contrario (lo usa incrustar-alimentos.js, que escribe en el motor).
// ============================================================================
const fs = require('fs');
const path = require('path');

const ETIQUETA = '<script src="/app.js"></script>';
const RAIZ = path.join(__dirname, '..');

// html (index.html ligero) + codigo (app.js) → el index.html de siempre.
function juntar(html, codigo) {
  const i = html.indexOf(ETIQUETA);
  if (i < 0) return html; // index.html antiguo, con el código dentro
  return html.slice(0, i) + '<script>' + codigo + '</script>' + html.slice(i + ETIQUETA.length);
}

// El index.html de siempre → { html, codigo }. El script de la app es, con
// diferencia, el <script> en línea más grande de la página.
function separar(completo) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, mayor = null;
  while ((m = re.exec(completo))) if (!mayor || m[1].length > mayor.len) mayor = { ini: m.index, fin: m.index + m[0].length, codigo: m[1], len: m[1].length };
  if (!mayor || mayor.len < 500000) throw new Error('No encuentro el script de la app en index.html');
  return { html: completo.slice(0, mayor.ini) + ETIQUETA + completo.slice(mayor.fin), codigo: mayor.codigo };
}

// Lee la app del disco tal y como estaba antes de separarla.
function leerFuente(raiz = RAIZ) {
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const fApp = path.join(raiz, 'app.js');
  return fs.existsSync(fApp) ? juntar(html, fs.readFileSync(fApp, 'utf8')) : html;
}

// Escribe un index.html "completo" repartiéndolo entre index.html y app.js.
function escribirFuente(completo, raiz = RAIZ) {
  const { html, codigo } = separar(completo);
  fs.writeFileSync(path.join(raiz, 'index.html'), html);
  fs.writeFileSync(path.join(raiz, 'app.js'), codigo);
}

module.exports = { ETIQUETA, juntar, separar, leerFuente, escribirFuente };
