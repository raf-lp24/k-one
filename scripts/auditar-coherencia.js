// Dos preguntas que no se habian hecho nunca:
//  1. ¿El plato PEGA con su toma? Un huevo poche con esparragos y jamon
//     serrano es un entrante o una cena, no un desayuno espanol.
//  2. ¿Los ingredientes pegan con la rama? Salsas grasas, bolleria o
//     fritos en un pool de perdida de grasa.
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
const arr = []; L.forEach((l, i) => { if (/^\s*nutricion = \[\s*$/.test(l)) arr.push(i); });
let fin = arr[2]; while (!/^\s{4}\}\s*$/.test(L[fin])) fin++;
const ramas = [['perder grasa', arr[0], arr[1]], ['ganar musculo', arr[1], arr[2]], ['mantenimiento', arr[2], fin]];

const platos = [];
for (const [rama, ini, e] of ramas) {
  let mo = null;
  for (let k = ini; k < e; k++) {
    const m = /momento:\s*"([^"]+)"/.exec(L[k]);
    if (m) { mo = m[1]; continue; }
    const g = /^\s*op\("([^"]*)",\s*"([^"]*)"/.exec(L[k]);
    if (g && mo) platos.push({ rama, momento: mo, nombre: g[1], ing: g[2], linea: k + 1 });
  }
}

// 1) Platos "de plato" en desayuno o merienda
const DE_COMIDA = /pescado|merluza|bacalao|dorada|lubina|sepia|calamar|gambas|mejillones|boquerones|emperador|bonito|salm[óo]n al horno|salm[óo]n a la|pollo al|pollo a la|pechuga de pollo|pavo al horno|ternera|solomillo|entrecot|lomo de cerdo|cinta de lomo|conejo|alb[óo]ndigas|guiso|estofad|potaje|marmitako|paella|risotto|rissotto|lentejas|garbanzos|jud[íi]as|alubias|pisto|papillote|al vapor|esp[áa]rragos|paella/i;
const TOMA_LIGERA = /Desayuno|Media ma[ñn]ana|Merienda/;
console.log('=== PLATOS DE COMIDA/CENA COLOCADOS EN DESAYUNO, MEDIA MAÑANA O MERIENDA ===');
const fuera = platos.filter(p => TOMA_LIGERA.test(p.momento) && DE_COMIDA.test(p.nombre + ' ' + p.ing));
fuera.forEach(p => console.log('  ' + p.rama.padEnd(14) + p.momento.padEnd(14) + p.nombre));
console.log('  → ' + fuera.length + ' casos\n');

// 2) Ingredientes que chirrian en perdida de grasa
const GRASOS = /salsa c[ée]sar|mayonesa|nata\b|mantequilla|beicon|bacon|choriz|salchich|morcilla|panceta|frito|rebozad|empanad|bolleria|croissant|donut|magdalena|bizcocho|churro|hojaldre|queso curado|queso azul|crema de leche/i;
console.log('=== INGREDIENTES GRASOS O DE BOLLERIA, POR RAMA ===');
for (const rama of ['perder grasa', 'ganar musculo', 'mantenimiento']) {
  const hits = platos.filter(p => p.rama === rama && GRASOS.test(p.ing + ' ' + p.nombre));
  console.log('  ' + rama + ': ' + hits.length);
  hits.forEach(p => console.log('     ' + p.momento.padEnd(14) + p.nombre + '  ::  ' + p.ing.slice(0, 70)));
}

// 3) Nombres que prometen algo que la receta no lleva
console.log('\n=== EL NOMBRE PROMETE ALGO QUE LOS INGREDIENTES NO LLEVAN ===');
const PROMESAS = [[/c[ée]sar/i, /salsa c[ée]sar/i, 'salsa César'], [/carbonara/i, /nata|huevo/i, 'nata o huevo'], [/boloñesa|bolo[ñn]esa/i, /carne|ternera|pavo/i, 'carne']];
for (const p of platos) for (const [enNombre, enIng, que] of PROMESAS) {
  if (enNombre.test(p.nombre) && !enIng.test(p.ing)) console.log('  ' + p.rama.padEnd(14) + p.momento.padEnd(14) + p.nombre + '  → sin ' + que + ': ' + p.ing.slice(0, 60));
}
