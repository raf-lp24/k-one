// Criterio que hay que cumplir y que nunca se habia comprobado:
//  · En DEFICIT: comida mas contundente que la cena, proteina alta y verdura
//    presente (sacia y aporta fibra con pocas calorias).
//  · En SUPERAVIT: mas proteina y mas cantidad, repartida.
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
let fin = arr[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [['perder grasa', arr[0], arr[1]], ['ganar musculo', arr[1], arr[2]], ['mantenimiento', arr[2], fin]];

const VERDURA = /lechuga|tomate|pepino|pimiento|calabac[íi]n|berenjena|espinaca|br[óo]coli|jud[íi]as verdes|zanahoria|cebolla|championes|champi[ñn]on|esp[áa]rrago|r[úu]cula|canonigos|can[óo]nigos|ensalada|verduras|puerro|coliflor|coles de bruselas|alcachofa|calabaza|apio|guisantes|setas|acelga|escarola|menestra|pisto/i;

for (const [rama, ini, e] of ramas) {
  let mo = null; const porToma = {};
  for (let k = ini; k < e; k++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[k]);
    if (m) { mo = m[1]; porToma[mo] = porToma[mo] || { k: [], p: [], verd: 0, n: 0 }; continue; }
    const g = /^\s*op\("([^"]*)",\s*"([^"]*)",\s*"(\d+) kcal",\s*"(\d+)g prot"/.exec(L[k]);
    if (!g || !mo) continue;
    const t = porToma[mo];
    t.k.push(+g[3]); t.p.push(+g[4]); t.n++;
    if (VERDURA.test(g[2])) t.verd++;
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const total = Object.values(porToma).reduce((s, t) => s + med(t.k), 0);
  console.log('\n===== ' + rama.toUpperCase());
  for (const [m, t] of Object.entries(porToma)) {
    console.log('  ' + m.padEnd(14) +
      String(med(t.k)).padStart(4) + ' kcal (' + String(Math.round(med(t.k) / total * 100)).padStart(2) + '% del día)' +
      ' · ' + String(med(t.p)).padStart(3) + 'g prot' +
      ' · verdura en ' + String(Math.round(t.verd / t.n * 100)).padStart(3) + '% de las opciones');
  }
  const prot = Object.values(porToma).reduce((s, t) => s + med(t.p), 0);
  console.log('  --> día tipo: ' + total + ' kcal · ' + prot + 'g prot (' + Math.round(prot * 4 / total * 100) + '% de las kcal)');
}
