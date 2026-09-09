// Extrae CANT_DEFECTO del index.html para que el validador use EXACTAMENTE la
// misma tabla que la web (si no, mide un texto de ingredientes que el cliente
// nunca ve: "AOVE" a secas suma 0 aqui y 10g alli).
const fs = require('fs');
const L = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('\n');
let i = L.findIndex(l => /const CANT_DEFECTO = \{/.test(l));
const obj = {};
for (i++; i < L.length && !/^\s*\};\s*$/.test(L[i]); i++) {
  const re = /'([^']+)'\s*:\s*'([^']+)'/g; let m;
  while ((m = re.exec(L[i]))) obj[m[1].toLowerCase()] = m[2];
}
module.exports = obj;
if (require.main === module) console.log(Object.keys(obj).length, 'cantidades por defecto');
