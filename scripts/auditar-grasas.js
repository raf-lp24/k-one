// Calidad de macros por plato, que es lo que pide el usuario: cuanta grasa
// lleva cada opcion respecto a sus calorias, y cuanta fibra.
// Criterio: en DEFICIT una opcion con mas del 45% de sus kcal en grasa es
// densa y sacia poco por caloria. La fibra es lo contrario: sacia y casi no
// suma. Se mira por rama.
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
const { analizar } = require('./validar-recetas');
const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
let fin = arr[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [['perder grasa', arr[0], arr[1]], ['ganar musculo', arr[1], arr[2]], ['mantenimiento', arr[2], fin]];

for (const [rama, ini, e] of ramas) {
  let mo = null; const platos = [];
  for (let k = ini; k < e; k++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[k]);
    if (m) { mo = m[1]; continue; }
    const g = /^\s*op\("([^"]*)",\s*"([^"]*)",\s*"(\d+) kcal",\s*"(\d+)g prot",\s*"(\d+)g carbs",\s*"(\d+)g grasa"/.exec(L[k]);
    if (!g || !mo) continue;
    const kcal = +g[3], grasa = +g[6];
    platos.push({ mo, nombre: g[1], ing: g[2], kcal, grasa, pctGrasa: Math.round(grasa * 9 / kcal * 100), fibra: analizar(g[2]).f });
  }
  const fibraDia = {};
  platos.forEach(p => { (fibraDia[p.mo] = fibraDia[p.mo] || []).push(p.fibra); });
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const fibraTotal = Object.values(fibraDia).reduce((s, a) => s + med(a), 0);
  console.log('\n===== ' + rama.toUpperCase() + ' · fibra del dia tipo: ' + fibraTotal.toFixed(1) + 'g');
  const altos = platos.filter(p => p.pctGrasa > 45).sort((a, b) => b.pctGrasa - a.pctGrasa);
  console.log('  ' + altos.length + ' de ' + platos.length + ' opciones con mas del 45% de kcal en grasa');
  altos.slice(0, 8).forEach(p => console.log('     ' + String(p.pctGrasa).padStart(2) + '% grasa · ' + p.mo.padEnd(14) + p.nombre));
}
