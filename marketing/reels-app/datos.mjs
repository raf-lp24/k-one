// Saca los datos de un guion como variables de shell (lo usa montar.sh).
import { GUIONES } from './guiones.mjs';
const g = GUIONES[process.argv[2]];
if (!g) { console.error('guion desconocido: ' + process.argv[2]); process.exit(1); }
console.log('SALIDA=' + JSON.stringify(g.salida));
console.log('LENTO=' + (g.lento || 1.12));
console.log('GANCHO=' + JSON.stringify(g.gancho.join(' ')));
console.log('FONDO=' + JSON.stringify(g.fondo.join(' ')));
