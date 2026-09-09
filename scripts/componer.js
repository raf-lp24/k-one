// Genera la linea op(...) de una receta con los macros CALCULADOS de sus
// propios ingredientes, en vez de escritos a ojo. Asi la etiqueta cuadra con
// lo que el cliente ve en "Ver macros" desde el primer dia -- que es justo lo
// que falla en 64 de las recetas antiguas.
// Avisa si algun ingrediente no resuelve contra alimentos.json o si va sin
// cantidad sin ser una especia.
const { analizar } = require('./validar-recetas');
// Los condimentos llegan con su numero delante ("3 dientes de ajo"), asi que
// el ancla tiene que dejar pasar la cantidad.
const CERO = /^(\d+(?:[.,]\d+)?(?:\/\d+)?\s+)?(canela|pimienta|sal|or[ée]gano|perejil|albahaca|cilantro|eneldo|menta|hierbabuena|estragón|salvia|cebollino|romero|tomillo|pimentón|piment[óo]n dulce|curry|cúrcuma|azafr[áa]n|guindilla|comino|ajo|dientes de ajo|diente de ajo|ajo picado|ajo laminado|lim[óo]n|lima|hierbas|especias|zumo|ralladura|vinagre|hielo|caf[ée]|agua|laurel|nuez moscada|sal y pimienta|sal en escamas|sal marina|sal gruesa|pimienta negra|.*al gusto)$/i;

function componer(nombre, ingredientes, prep) {
  const a = analizar(ingredientes);
  const p = Math.round(a.p), c = Math.round(a.c), g = Math.round(a.g);
  const kcal = Math.round(p * 4 + c * 4 + g * 9);
  const avisos = [];
  a.sinDatos.forEach(t => avisos.push('NO RESUELVE: ' + t));
  a.sinCantidad.filter(t => !CERO.test(t.trim())).forEach(t => avisos.push('sin cantidad: ' + t));
  const dev = Math.abs(kcal - a.kcal) / a.kcal;
  if (dev > 0.08) avisos.push('etiqueta ' + kcal + ' vs suma ' + Math.round(a.kcal) + ' (' + Math.round(dev * 100) + '%)');
  return {
    linea: `            op("${nombre}", "${ingredientes}", "${kcal} kcal", "${p}g prot", "${c}g carbs", "${g}g grasa", "${prep}"),`,
    kcal, p, c, g, fibra: a.f, avisos
  };
}
module.exports = { componer };
