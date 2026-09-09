// Regla del usuario: si hay salsa, o es CERO o es CASERA. Nada de bote.
// Se listan todas las salsas y aderezos que aparecen en el recetario y si
// estan marcados como caseros / 0% o no.
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
let fin = arr[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [['perder grasa', arr[0], arr[1]], ['ganar musculo', arr[1], arr[2]], ['mantenimiento', arr[2], fin]];

const SALSA = /salsa[s]? [a-záéíóúñ ]+|mayonesa|k[ée]tchup|ketchup|mostaza|pesto|guacamole|hummus|tomate frito|alioli|barbacoa|teriyaki|c[ée]sar|tzatziki|vinagreta|aderezo/gi;
const cuenta = new Map();
for (const [rama, ini, e] of ramas) {
  let mo = null;
  for (let k = ini; k < e; k++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[k]);
    if (m) { mo = m[1]; continue; }
    const g = /^\s*op\("([^"]*)",\s*"([^"]*)"/.exec(L[k]);
    if (!g || !mo) continue;
    for (const trozo of g[2].split(',')) {
      const t = trozo.trim();
      const s = t.match(SALSA);
      if (!s) continue;
      const clave = t.replace(/^\d+(?:[.,]\d+)?\s*(g|ml)?\s*/i, '').trim().toLowerCase();
      const e2 = cuenta.get(clave) || { n: 0, ramas: new Set(), ok: /casero|casera|0%|natural|al gusto/i.test(clave) };
      e2.n++; e2.ramas.add(rama);
      cuenta.set(clave, e2);
    }
  }
}
const filas = [...cuenta.entries()].sort((a, b) => b[1].n - a[1].n);
console.log('=== SALSAS Y ADEREZOS DEL RECETARIO ===\n');
console.log('-- MARCADAS COMO CASERAS / 0% --');
filas.filter(f => f[1].ok).forEach(([k, v]) => console.log('  ' + String(v.n).padStart(3) + ' · ' + k + '   [' + [...v.ramas].join(', ') + ']'));
console.log('\n-- SIN MARCAR (podrian entenderse como de bote) --');
filas.filter(f => !f[1].ok).forEach(([k, v]) => console.log('  ' + String(v.n).padStart(3) + ' · ' + k + '   [' + [...v.ramas].join(', ') + ']'));
