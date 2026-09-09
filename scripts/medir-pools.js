// Cuenta opciones por (rama calorica x momento). Los limites se sacan de las
// tres lineas "nutricion = [" en vez de numeros de linea fijos, que se quedan
// obsoletos en cuanto se inserta una receta.
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
const arranques = [];
L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arranques.push(i); });
let fin = arranques[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [
  ['perder grasa', arranques[0], arranques[1]],
  ['ganar musculo', arranques[1], arranques[2]],
  ['mantenimiento', arranques[2], fin]
];
const filas = [];
for (const [nombre, ini, end] of ramas) {
  let momento = null, n = 0;
  for (let i = ini; i < end; i++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[i]);
    if (m) { if (momento) filas.push([nombre, momento, n]); momento = m[1]; n = 0; }
    else if (momento && /^\s*op\(/.test(L[i])) n++;
  }
  if (momento) filas.push([nombre, momento, n]);
}
filas.sort((a, b) => a[2] - b[2]);
for (const [r, mo, c] of filas) console.log(String(c).padStart(3), '·', r.padEnd(14), mo);
console.log('---', filas.reduce((s, f) => s + f[2], 0), 'opciones en total');
