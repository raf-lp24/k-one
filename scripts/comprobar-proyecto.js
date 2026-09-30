// Comprobaciones de estructura que ya nos han roto producción o la web pública:
//   - Vercel Hobby admite 12 funciones: la 13ª rompe TODOS los despliegues.
//   - Un error de sintaxis en api/ o lib/ tumba esa función en silencio.
//   - vercel.json / manifest.json / los JSON-LD de index.html deben ser JSON válido.
//   - Las preguntas frecuentes visibles y las del JSON-LD (lo que leen Google y las
//     IA) llevaban desincronizadas: deben coincidir palabra por palabra.
//   - Ningún id repetido en index.html, y que sw.js siga teniendo CACHE_NAME.
//   - Los precios de la landing, los términos y llms.txt no se contradicen.
// Uso: node scripts/comprobar-proyecto.js   (lo ejecuta GitHub Actions en cada subida)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const raiz = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n?/g, '\n');
let fallos = 0;
const ok = m => console.log('  ✔ ' + m);
const mal = m => { fallos++; console.log('  ✘ ' + m); };

// 1. Funciones de Vercel
const funciones = fs.readdirSync(path.join(raiz, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
funciones.length <= 12
  ? ok(`${funciones.length} funciones en api/ (límite de Vercel Hobby: 12)`)
  : mal(`${funciones.length} funciones en api/: el plan Hobby admite 12, el despliegue fallaría`);

// 2. Sintaxis de api/ y lib/
for (const dir of ['api', 'lib']) {
  for (const f of fs.readdirSync(path.join(raiz, dir)).filter(x => x.endsWith('.js'))) {
    try { new vm.Script(leer(path.join(dir, f)), { filename: f }); }
    catch (e) { mal(`${dir}/${f} no compila: ${e.message}`); }
  }
}
ok('api/ y lib/ compilan (comprobado)');

// 3. JSON válidos
for (const f of ['vercel.json', 'manifest.json', 'package.json']) {
  try { JSON.parse(leer(f)); ok(f + ' es JSON válido'); } catch (e) { mal(`${f} no es JSON válido: ${e.message}`); }
}
const html = leer('index.html');
const bloquesLD = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
const ld = [];
bloquesLD.forEach((b, i) => { try { ld.push(JSON.parse(b)); } catch (e) { mal(`JSON-LD nº ${i + 1} de index.html no es JSON válido: ${e.message}`); } });
ok(`${ld.length} bloques JSON-LD válidos`);

// 4. FAQ visible = FAQPage del JSON-LD
const norm = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/[“”"']/g, '').trim();
const grafo = ld.flatMap(x => x['@graph'] || [x]);
const faq = grafo.find(x => x['@type'] === 'FAQPage');
if (!faq) mal('no hay FAQPage en el JSON-LD');
else {
  const visibles = [...html.matchAll(/<summary class="faq-q">([\s\S]*?)<\/summary>\s*<p class="faq-a">([\s\S]*?)<\/p>/g)].map(m => [norm(m[1]), norm(m[2])]);
  const datos = faq.mainEntity.map(q => [norm(q.name), norm(q.acceptedAnswer.text)]);
  if (visibles.length !== datos.length) mal(`FAQ: ${visibles.length} preguntas visibles y ${datos.length} en el JSON-LD`);
  else {
    const difieren = visibles.filter((v, i) => v[0] !== datos[i][0] || v[1] !== datos[i][1]).map(v => v[0]);
    difieren.length ? mal('FAQ desincronizada (visible ≠ JSON-LD): ' + difieren.join(' | ')) : ok(`las ${visibles.length} preguntas frecuentes coinciden con el JSON-LD`);
  }
}

// 5. ids repetidos (solo los que están escritos en el HTML, no los que crea JS)
const ids = [...html.matchAll(/\sid="([^"$`{}]+)"/g)].map(m => m[1]);
const repetidos = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
repetidos.length ? mal('ids repetidos en index.html: ' + repetidos.slice(0, 10).join(', ')) : ok(`${ids.length} ids, ninguno repetido`);

// 6. Service worker
/const CACHE_NAME\s*=\s*'kone-v\d+'/.test(leer('sw.js')) ? ok('sw.js tiene CACHE_NAME') : mal('sw.js sin CACHE_NAME "kone-vN"');

// 7. Precios coherentes entre landing, términos, FAQ y llms.txt
const precios = { 'mensual 7,99': '7,99', 'trimestral 14,99': '14,99', 'solo nutrición 4,99': '4,99' };
for (const [nombre, p] of Object.entries(precios)) {
  const enHtml = html.includes(p + '€');
  const enLlms = leer('llms.txt').includes(p.replace(',', ',') + ' €') || leer('llms.txt').includes(p + '€');
  enHtml && enLlms ? ok(`precio ${nombre} en landing y llms.txt`) : mal(`precio ${nombre}: landing=${enHtml} llms.txt=${enLlms}`);
}
const t33 = (html.match(/3\.3\. Precios[\s\S]{0,900}/) || [''])[0];
/14,99/.test(t33) ? ok('Términos 3.3 incluye el trimestral') : mal('Términos 3.3 no menciona el plan trimestral 14,99 €');

// 7b. La tabla de alimentos incrustada en index.html (la usa el motor para que
// las cantidades cuadren con "Ver macros") es una copia exacta de data/alimentos.json.
{
  const m = html.match(/\/\*ALIMENTOS\*\/([\s\S]*?)\/\*FIN_ALIMENTOS\*\//);
  const fuente = JSON.stringify(JSON.parse(leer('data/alimentos.json')));
  !m ? mal('index.html sin la tabla de alimentos incrustada (/*ALIMENTOS*/)')
    : m[1] === fuente ? ok('tabla de alimentos incrustada = data/alimentos.json')
    : mal('la tabla incrustada no coincide con data/alimentos.json: node scripts/incrustar-alimentos.js');
}

// 8. Páginas por tema: existen, tienen su canonical, título/descripción de tamaño
// razonable, una ruta limpia en vercel.json y entrada en el sitemap.
{
  const vj = JSON.parse(leer('vercel.json'));
  const sitemap = leer('sitemap.xml');
  for (const [ruta, archivo] of [['/running', 'running.html'], ['/gimnasio', 'gimnasio.html'], ['/hibrido', 'hibrido.html'], ['/solo-nutricion', 'solo-nutricion.html']]) {
    if (!fs.existsSync(path.join(raiz, archivo))) { mal('falta ' + archivo + ' (node scripts/generar-paginas.js)'); continue; }
    const h = leer(archivo);
    const title = (h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const canon = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
    const rew = (vj.rewrites || []).some(r => r.source === ruta && r.destination === '/' + archivo);
    const problemas = [];
    if (canon !== 'https://k-one.fit' + ruta) problemas.push('canonical=' + canon);
    if (title.length < 20 || title.length > 65) problemas.push('título de ' + title.length + ' caracteres');
    if (desc.length < 80 || desc.length > 160) problemas.push('descripción de ' + desc.length + ' caracteres');
    if (!rew) problemas.push('sin rewrite en vercel.json');
    if (!sitemap.includes('<loc>https://k-one.fit' + ruta + '</loc>')) problemas.push('no está en sitemap.xml');
    if ((h.match(/<h1[ >]/g) || []).length !== 1) problemas.push('no tiene exactamente un h1');
    problemas.length ? mal(archivo + ': ' + problemas.join(', ')) : ok(archivo + ' correcta (' + ruta + ')');
  }
}

console.log('\n' + (fallos ? '✘ ' + fallos + ' comprobaciones falladas' : '✔ Proyecto correcto'));
process.exit(fallos ? 1 : 0);
