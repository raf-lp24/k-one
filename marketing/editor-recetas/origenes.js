// De dónde sale cada receta: `node marketing/editor-recetas/origenes.js` deja origenes.json,
// que extraer.js mete en cada ficha del Recetario. Sale del historial de git (el commit que
// añadió el nombre) y de los informes de Thor. El enlace al post se busca por parecido de
// ingredientes y por eso la ficha dice «post más parecido»; lo comprobado a mano va en MANUAL.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 29 });
const THOR = path.join(RAIZ, 'Thor');
const TRABAJO = path.join(THOR, 'thor', 'instagram', 'trabajo');

// Commits que añadieron recetas, del más antiguo al más nuevo: [commit, de dónde].
const COMMITS = [
  ['1cae627', 'Aprobadas por Rafa'], ['0fd943e', 'Dieta AJ7'], ['11a9499', 'Dieta AJ7'], ['4ece050', 'Dieta AJ7 de 2023'],
  ['72cb073', 'Plan de alimentación MF'], ['698e2a3', '@raulencinass'], ['6b29d4d', '@raulencinass'],
  ['2f5fa47', null], ['e441373', '@valicentif'], ['61ecf0f', null], ['58960bc', null], ['7416e6e', null],
  ['065be03', '@tonigimenex'], ['3c0ed70', '@tonigimenex'], ['649841a', null], ['9b2dd68', '@lu_fitfoodie'],
  ['91015a7', null], ['741c853', 'vikika-o-lu'], ['703869e', null],
];
// Comprobadas a mano el 2 nov 2026. Las seis primeras ya están como en el post.
const IG = (c) => `https://www.instagram.com/reel/${c}/`;
const MANUAL = {
  'Tortitas de calabaza estilo Pumpkin Pie': { cuenta: '@lu_fitfoodie', fecha: '2026-10-29', post: IG('CjWaMNTAjLk'), seguro: true, fiel: true },
  'Tostadas francesas sabor cheesecake de fresas': { cuenta: '@lu_fitfoodie', fecha: '2026-10-29', post: IG('C8qfjtZIzBc'), seguro: true, fiel: true },
  'Muffins salados': { cuenta: '@lu_fitfoodie', fecha: '2026-10-29', post: IG('CVhBPX6AXdT'), seguro: true, fiel: true },
  'Banana Bowl': { cuenta: '@vikikateam', fecha: '2026-10-30', post: IG('Ddq8hL4CsZ-'), seguro: true, fiel: true },
  'Tortita de arándanos': { cuenta: '@lu_fitfoodie', fecha: '2026-10-30', post: IG('Dc4Bo9iB0KH'), seguro: true, fiel: true },
  'Avena sabor tiramisú': { cuenta: '@lu_fitfoodie', fecha: '2026-10-30', post: IG('Db3L79pACWT'), seguro: true, fiel: true },
};

const nombresDe = (c) => [...new Set((git('show', c, '--', 'app.js', 'index.html').match(/^\+\s*op(?:Fija)?\("[^"]+"/gm) || []).map((l) => l.replace(/^\+\s*op(?:Fija)?\("/, '').slice(0, -1)))];
const norm = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const SIN = [[/frutillas?/g, 'fresas'], [/bananas?/g, 'platano'], [/batatas?|camote/g, 'boniato'], [/choclos?|choclitos?/g, 'maiz'], [/pimenton/g, 'pimiento'], [/yogurt|yogourt/g, 'yogur'], [/zapallo/g, 'calabaza'], [/jugo/g, 'zumo']];
const limpiar = (t) => { let s = norm(t); for (const [a, b] of SIN) s = s.replace(a, b); return s; };
const VACIAS = new Set(['con', 'de', 'del', 'la', 'el', 'y', 'en', 'al', 'a', 'los', 'las', 'sin', 'o', 'para', 'sabor', 'estilo', 'casero', 'casera', 'proteico', 'proteica', 'light', 'natural', 'desnatada', 'copos', 'aceite', 'oliva', 'virgen', 'extra', 'sal', 'pimienta']);
const palabras = (t) => [...new Set(limpiar(t).replace(/\d+\s*(g|ml)\b/g, ' ').match(/[a-z]{3,}/g) || [])].filter((w) => !VACIAS.has(w));
const postsDe = (carpeta) => { try { const d = JSON.parse(fs.readFileSync(path.join(TRABAJO, carpeta, 'todo.json'), 'utf8')); return (Array.isArray(d) ? d : Object.values(d)).filter((p) => p.k && (p.alt || p.txt)); } catch (e) { return []; } };
const POSTS = { '@lu_fitfoodie': postsDe('lufitfoodie-instagram'), '@vikikateam': postsDe('vikikateam') };
for (const c of Object.keys(POSTS)) POSTS[c] = POSTS[c].map((p) => { const t = limpiar(p.alt || p.txt); return { k: p.k, t: p.t, texto: t, cab: t.slice(0, 90) }; });
// Lo que más pesa es que el título del post se parezca al nombre; luego, que salgan los ingredientes.
function mejorPost(cuenta, nombre, ingredientes) {
  const nom = palabras(nombre), ing = palabras(ingredientes);
  let mejor = null;
  for (const p of POSTS[cuenta] || []) {
    if (!/necesitas|ingrediente|necesitaras/.test(p.texto)) continue;
    const enCab = nom.filter((w) => p.cab.includes(w)).length / (nom.length || 1);
    const enTxt = ing.filter((w) => p.texto.includes(w)).length / (ing.length || 1);
    const nota = enCab * 0.55 + enTxt * 0.45;
    if (!mejor || nota > mejor.nota) mejor = { k: p.k, tipo: p.t, nota };
  }
  return mejor && mejor.nota >= 0.62 ? (mejor.tipo === 'reel' ? IG(mejor.k) : `https://www.instagram.com/p/${mejor.k}/`) : null;
}
const informes = fs.existsSync(path.join(THOR, 'informes')) ? fs.readdirSync(path.join(THOR, 'informes')).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(THOR, 'informes', f), 'utf8')) : [];
const VIKIKA = informes.find((t) => /^# .*vikikateam/im.test(t)) || '';
const cuentaEnInforme = (nombre) => { const n = norm(nombre); for (const t of informes) for (const l of t.split('\n')) if (norm(l).includes(n)) { const m = l.match(/@[a-z0-9_.]+/i); if (m) return m[0]; } return null; };

const recetas = JSON.parse(fs.readFileSync(path.join(__dirname, 'recetas.json'), 'utf8'));
const ingDe = new Map(recetas.map((r) => [r.nombre, r.ingredientes]));
const salida = {};
for (const [c, de] of COMMITS) {
  const fecha = git('show', '-s', '--format=%ad', '--date=short', c).trim();
  for (const n of nombresDe(c)) {
    if (salida[n] || !ingDe.has(n)) continue;
    let cuenta = de;
    if (de === 'vikika-o-lu') cuenta = norm(VIKIKA).includes(norm(n)) ? '@vikikateam' : '@lu_fitfoodie';
    if (!cuenta) cuenta = cuentaEnInforme(n) || 'Revisión de Instagram';
    const o = { cuenta, fecha };
    const post = POSTS[cuenta] ? mejorPost(cuenta, n, ingDe.get(n)) : null;
    if (post) o.post = post;
    salida[n] = o;
  }
}
Object.assign(salida, MANUAL);
fs.writeFileSync(path.join(__dirname, 'origenes.json'), JSON.stringify(salida, null, 0));
const cuentas = {}; for (const v of Object.values(salida)) cuentas[v.cuenta] = (cuentas[v.cuenta] || 0) + 1;
console.log(Object.keys(salida).length, 'de', recetas.length, 'recetas con origen ·', Object.values(salida).filter((v) => v.post).length, 'con post');
console.log(cuentas);
