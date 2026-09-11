// Normalizador de nombres de alimento -- versión Node, para usar SERVIDOR
// ADENTRO (el auditor automático de api/notify.js). Es un espejo deliberado
// de las mismas funciones que ya existen en index.html (_normTexto,
// _raizSinPlural, _normAlimento, _reAlimento, FAMILIAS_ALIMENTOS,
// SINONIMOS_ALERGENO): el motor de verdad vive en el navegador (usa
// buildPlanFromData, que hace falta el DOM y todo el recetario cargado), así
// que no se puede requerir directamente desde una función de Vercel.
//
// REGLA: si tocas la lógica de acentos/plurales o las familias de alérgenos
// en index.html, toca TAMBIÉN este archivo -- y viceversa. Es la MISMA regla
// de producto fijada el 10 sept 2026 ("con tilde o sin tilde, da igual"),
// solo que aquí vive una segunda vez porque el runtime es distinto (Node vs
// navegador). Dos copias controladas y con esta nota cruzada es mejor que
// intentar compartir un módulo entre un <script> de 26.000 líneas y una
// función serverless -- eso sí sería el enésimo sitio suelto que se
// desincroniza sin que nadie se entere.

function _normTexto(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function _raizSinPlural(t) {
  if (t.length > 4 && /es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && /s$/.test(t)) return t.slice(0, -1);
  return t;
}

const _normAlimento = t => _raizSinPlural(_normTexto(t));

const _SEPARADOR_ALIMENTOS = /[,;/+]+|\s+(?:y|e|o|ni)\s+/i;

const _EQUIV_TILDE = { a: '[aáàä]', e: '[eéèë]', i: '[iíìï]', o: '[oóòö]', u: '[uúùü]', n: '[nñ]', c: '[cç]' };
function _reAlimento(token) {
  const raiz = _raizSinPlural(_normTexto(token));
  const cuerpo = raiz
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[aeiounc]/g, ch => _EQUIV_TILDE[ch] || ch);
  return new RegExp('\\b' + cuerpo + '[a-záéíóúüñ]*', 'gi');
}

// Copia exacta de index.html (línea ~12475 a fecha de este archivo).
const FAMILIAS_ALIMENTOS = {
  'pescado': ['salmón','salmon','merluza','lubina','bacalao','dorada','atún','atun','sardina','sardinas','caballa','trucha','rape','pez espada','anchoa','anchoas','boquerón','boquerones','rodaballo','lenguado','gallo'],
  'marisco': ['gambas','langostinos','mejillon','mejillón','mejillones','almejas','calamar','calamares','pulpo','sepia','vieira','vieiras','cangrejo','langosta','cigalas','bogavante','berberechos','surimi'],
  'carne roja': ['ternera','buey','cordero','cerdo','solomillo','entrecot','costillas','chuletón'],
  'cerdo': ['jamón','jamon','lomo','bacon','panceta','chorizo','salchichón','salchichon','cerdo','morcilla','butifarra'],
  'lácteos': ['leche','yogur','queso','requesón','requeson','kéfir','kefir','nata','mantequilla','cottage','queso batido','queso fresco','skyr'],
  'frutos secos': ['nueces','almendras','avellanas','cacahuete','cacahuetes','pistachos','anacardos','piñones','pinones','macadamia'],
  'legumbres': ['garbanzos','lentejas','judías','judias','alubias','habas','guisantes','edamame','soja'],
  'verduras': ['brócoli','brocoli','espinacas','espinaca','lechuga','rúcula','rucula','calabacín','calabacin','berenjena','pimiento','pepino','tomate','cebolla','zanahoria','espárrago','esparrago','alcachofa','champiñón','champiñon','setas','apio','puerro','col','repollo','coliflor','calabaza'],
  'frutas': ['plátano','platano','manzana','pera','naranja','mandarina','fresa','fresas','frambuesa','frambuesas','arándanos','arandanos','kiwi','piña','sandía','sandia','melón','melon','mango','uva','uvas','cereza','cerezas','higo','higos','melocotón','melocoton','ciruela'],
  'huevos': ['huevo','huevos','tortilla','revuelto','claras'],
  'gluten': ['pan','pasta','trigo','cebada','centeno','galletas','cereales','harina','fideos','cuscús','cuscus','seitán','seitan','granola','muesli','bulgur'],
};

// Copia exacta de index.html (línea ~12642).
const SINONIMOS_ALERGENO = {
  'huevo': ['huevo', 'clara', 'claras'],
  'leche': FAMILIAS_ALIMENTOS['lácteos'],
  'lacteos': FAMILIAS_ALIMENTOS['lácteos'],
  'lactosa': FAMILIAS_ALIMENTOS['lácteos'],
  'marisco': FAMILIAS_ALIMENTOS['marisco'],
  'pescado': FAMILIAS_ALIMENTOS['pescado'],
  'frutos secos': FAMILIAS_ALIMENTOS['frutos secos'],
  'gluten': FAMILIAS_ALIMENTOS['gluten'],
  'cerdo': FAMILIAS_ALIMENTOS['cerdo'],
  'legumbres': FAMILIAS_ALIMENTOS['legumbres'],
  'soja': ['soja', 'edamame'],
};

// Expande "no como" (texto libre) + "alergia" (radio + texto libre de
// "Otra") a la lista completa y normalizada de tokens prohibidos para un
// cliente. Es la versión SIMPLIFICADA de filtrarNoComida()/
// _expandirAlergenoLibre() de index.html -- aquí no hace falta reconstruir
// el plan (ya está generado y guardado), solo necesitamos la lista de
// palabras que NO deberían aparecer en él.
function alimentosProhibidos(userData) {
  const tokens = new Set();
  const raw = [];
  if (userData.noComida) raw.push(...String(userData.noComida).split(_SEPARADOR_ALIMENTOS));
  if (userData.alergia && userData.alergia !== 'No' && userData.alergia !== 'Otra') raw.push(userData.alergia);
  if (userData.alergiaOtra) raw.push(...String(userData.alergiaOtra).split(_SEPARADOR_ALIMENTOS));

  raw.map(t => t.trim().toLowerCase()).filter(Boolean).forEach(t => {
    tokens.add(t);
    const tNorm = _normAlimento(t);
    // ¿Es el nombre de una familia entera? ("lacteos", con o sin tilde)
    for (const [familia, miembros] of Object.entries(FAMILIAS_ALIMENTOS)) {
      if (_normAlimento(familia) === tNorm) miembros.forEach(m => tokens.add(m));
    }
    // ¿Es un sinónimo de alérgeno? ("lactosa" -> toda la familia lácteos)
    for (const [clave, miembros] of Object.entries(SINONIMOS_ALERGENO)) {
      if (_normAlimento(clave) === tNorm) miembros.forEach(m => tokens.add(m));
    }
  });
  return [...tokens].filter(t => t.length >= 2);
}

// Busca cada token prohibido dentro del texto (el plan entero, ya
// stringificado) y devuelve los que SÍ aparecen -- con la palabra exacta que
// hizo match, para que el aviso en Jarvis diga algo concreto y no solo "hay
// un problema".
function escanearProhibidos(texto, tokens) {
  const encontrados = [];
  for (const t of tokens) {
    const m = texto.match(_reAlimento(t));
    if (m && m.length) encontrados.push({ token: t, coincidencia: m[0] });
  }
  return encontrados;
}

module.exports = {
  _normTexto, _raizSinPlural, _normAlimento, _reAlimento, _SEPARADOR_ALIMENTOS,
  FAMILIAS_ALIMENTOS, SINONIMOS_ALERGENO,
  alimentosProhibidos, escanearProhibidos
};
