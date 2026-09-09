// Auditoria de los 386 alimentos, uno por uno. Cada plato del recetario saca
// sus calorias y sus macros de aqui, asi que un valor mal contamina todos los
// planes que lo usen.
//
// Se comprueba, para cada alimento:
//  1. Que los macros no sumen mas de 100 g por 100 g de alimento (imposible).
//  2. Que las kcal cuadren con 4p + 4c + 9g. Ojo: la fibra NO aporta 4 kcal/g,
//     asi que en alimentos con mucha fibra la formula da de mas y eso es
//     CORRECTO. Se descuenta la fibra antes de dar nada por malo.
//  3. Que los valores sean plausibles para su categoria (una verdura con 20 g
//     de grasa, una proteina con 60 g de hidratos...).
//  4. Que no haya duplicados con valores distintos: dos claves que son el
//     mismo alimento pero no dicen lo mismo.
const A = require(require('path').join(__dirname,'..','data','alimentos.json'));
const claves = Object.keys(A);
const problemas = { imposible: [], fibra: [], kcal: [], categoria: [], duplicado: [] };

for (const k of claves) {
  const v = A[k];
  const suma = v.p + v.c + v.g;

  // 1) macros que no caben en 100 g
  if (suma > 101) problemas.imposible.push(k + ': P' + v.p + ' + C' + v.c + ' + G' + v.g + ' = ' + suma.toFixed(1) + 'g por 100g');

  // 1b) la fibra es una PARTE de los hidratos: nunca puede ser mayor
  if ((v.f || 0) > v.c + 0.01) problemas.fibra.push(k + ': fibra ' + v.f + 'g > hidratos ' + v.c + 'g');

  // 2) kcal contra la formula, descontando la fibra (que no aporta 4 kcal/g)
  const carbsNetos = Math.max(0, v.c - (v.f || 0));
  const calcNeto = 4 * v.p + 4 * carbsNetos + 9 * v.g;
  const calcBruto = 4 * v.p + 4 * v.c + 9 * v.g;
  // Se da por bueno si cuadra con cualquiera de las dos lecturas
  const mejor = Math.abs(calcNeto - v.kcal) < Math.abs(calcBruto - v.kcal) ? calcNeto : calcBruto;
  if (v.kcal > 5 && Math.abs(mejor - v.kcal) / v.kcal > 0.25) {
    problemas.kcal.push(k + ': dice ' + v.kcal + ' kcal, sus macros dan ' + Math.round(mejor) +
      ' (P' + v.p + ' C' + v.c + ' G' + v.g + ' F' + (v.f || 0) + ')');
  }

  // 3) plausibilidad por categoria
  const c = v.cat;
  if (c === 'Verduras y fruta' && v.g > 12 && !/coco|aceituna|aguacate/i.test(k))
    problemas.categoria.push(k + ' (verdura/fruta) con ' + v.g + 'g de grasa');
  if (c === 'Proteínas' && v.c > 20 && !/rebozad|empanad/i.test(k))
    problemas.categoria.push(k + ' (proteína) con ' + v.c + 'g de hidratos');
  if (c === 'Proteínas' && v.p < 8 && v.kcal > 40)
    problemas.categoria.push(k + ' (proteína) con solo ' + v.p + 'g de proteína');
  if (c === 'Lácteos' && v.p > 30)
    problemas.categoria.push(k + ' (lácteo) con ' + v.p + 'g de proteína');
  if (c === 'Cereales e hidratos' && v.g > 25 && !/granola|muesli|barrita/i.test(k))
    problemas.categoria.push(k + ' (cereal) con ' + v.g + 'g de grasa');
}

// 4) claves distintas con el mismo nombre visible pero valores distintos
const porNombre = new Map();
for (const k of claves) {
  const n = A[k].n;
  const lista = porNombre.get(n) || [];
  lista.push(k); porNombre.set(n, lista);
}
for (const [n, ks] of porNombre) {
  if (ks.length < 2) continue;
  const firmas = new Set(ks.map(k => A[k].kcal + '/' + A[k].p + '/' + A[k].c + '/' + A[k].g));
  if (firmas.size > 1) problemas.duplicado.push(n + ' → ' + ks.map(k => k + '(' + A[k].kcal + ')').join(', '));
}

console.log(claves.length + ' alimentos auditados\n');
for (const [tipo, lista] of Object.entries(problemas)) {
  console.log('== ' + tipo.toUpperCase() + ': ' + lista.length);
  lista.forEach(x => console.log('   ' + x));
  console.log('');
}
