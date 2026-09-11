// AGENTE DE AUDITORÍA -- lógica de "¿hay algo en este plan que el cliente no
// puede o no quiere comer?", versión Node para el cron de api/notify.js.
//
// Es un ESPEJO deliberado de lo que hace el motor de index.html al generar
// el plan, no una lógica propia: si el agente usara un criterio distinto al
// del motor, avisaría de cosas que el motor da por buenas (falsos avisos) o
// callaría cosas que el motor quita. Por eso copia, tal cual:
//   · para "no como" + "otra alergia": _expandirAlergenoLibre() y los tokens
//     de filtrarNoComida() (familias solo si el cliente escribe el nombre de
//     la familia entero, sinónimos del mismo alimento, tildes y plurales);
//   · para alergia a gluten/lactosa/frutos secos (y dieta sin gluten/sin
//     lactosa): la RED DE SEGURIDAD del motor -- `neutralizar` + `rastros` --
//     que es la definición exacta de "esto aún lleva el alérgeno".
// La única diferencia a propósito: el motor pasa la red solo por el nombre y
// los ingredientes, y el agente también por los PASOS de la receta, que es
// justo por donde se han colado los fallos (ver index.html, 11 sept 2026).
//
// REGLA: si tocas familias, sinónimos, `neutralizar` o `rastros` en
// index.html, tócalos también aquí -- y viceversa. Los dos sitios llevan una
// nota cruzada. El motor de verdad no se puede requerir desde Node (vive en un
// <script> de 26.000 líneas que necesita el DOM y el recetario cargado).
//
// Comprobado el 11 sept 2026 contra 200 planes reales generados con el motor
// (5 restricciones × 4 objetivos × 5 deportes × 2 tipos de plan): la primera
// versión, que buscaba cada palabra suelta en el JSON entero del plan, daba
// cientos de falsos avisos ("leche sin lactosa", "patatas panadera", las
// notas que explican la dieta...) y hubiera marcado a todo celíaco o
// intolerante todos los días.

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

// Copia exacta de index.html (FAMILIAS_ALIMENTOS).
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

// Copia exacta de index.html (SINONIMOS_ALERGENO).
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

// Copia exacta de index.html (SINONIMOS_MISMO_ALIMENTO, dentro de filtrarNoComida).
const SINONIMOS_MISMO_ALIMENTO = {
  'queso': ['requesón'],
  'gamba': ['langostino'],
  'langostino': ['gamba'],
  'cacahuete': ['crema de cacahuete'],
  'garbanzo': ['hummus'],
  'ternera': ['solomillo']
};

// Copia exacta de index.html (_expandirAlergenoLibre).
function _expandirAlergenoLibre(texto) {
  const tokens = (texto || '').split(_SEPARADOR_ALIMENTOS).map(t => t.trim().toLowerCase()).filter(Boolean);
  const extra = new Set();
  tokens.forEach(t => {
    const tNorm = _normAlimento(t);
    Object.entries(SINONIMOS_ALERGENO).forEach(([clave, miembros]) => {
      if (tNorm === _normAlimento(clave) || miembros.some(m => _normAlimento(m) === tNorm)) {
        miembros.forEach(m => extra.add(m));
      }
    });
  });
  Object.keys(FAMILIAS_ALIMENTOS).forEach(clave => extra.delete(clave));
  return [texto, ...extra].filter(Boolean).join(', ');
}

// Los tokens que filtrarNoComida() de index.html acaba buscando para un texto
// dado. Misma lógica, paso por paso.
function _tokensNoComida(noComidaRaw) {
  const raw = (noComidaRaw || '').trim();
  if (!raw) return [];
  const tokensOriginales = raw.split(_SEPARADOR_ALIMENTOS).map(t => t.trim().toLowerCase()).filter(t => t.length >= 2);
  const todos = new Set(tokensOriginales);
  tokensOriginales.forEach(t => {
    const tNorm = _normAlimento(t);
    for (const [familia, miembros] of Object.entries(FAMILIAS_ALIMENTOS)) {
      const familiaNorm = _normAlimento(familia);
      const esFamiliaEntera = tNorm === familiaNorm;
      const tocaAlgunMiembro = miembros.some(m => {
        const mNorm = _normAlimento(m);
        return mNorm === tNorm || mNorm.includes(tNorm) || tNorm.includes(mNorm);
      });
      if (esFamiliaEntera) { miembros.forEach(m => todos.add(m)); continue; }
      if (tocaAlgunMiembro) miembros.forEach(m => { if (_normAlimento(m) === tNorm) todos.add(m); });
    }
  });
  [...todos].forEach(t => {
    const extra = SINONIMOS_MISMO_ALIMENTO[_normAlimento(t)];
    if (extra) extra.forEach(e => todos.add(e));
  });
  return [...todos];
}

// Copia exacta de `neutralizar` en index.html: borra las formas YA seguras
// ("leche sin lactosa", "harina de arroz"...) antes de buscar rastros.
function _neutralizar(txt) {
  return txt
    .replace(/avena certificada sin gluten/gi, '·')
    .replace(/harina de (arroz|maíz|garbanzos?|almendra)/gi, '·')
    .replace(/(tortitas?|fideos|galletas|tortilla|wrap|pan|tostas?|tostadas?) de (arroz|maíz)/gi, '·')
    .replace(/[\wáéíóúñ]+(\s+[\wáéíóúñ]+)*?\s+sin gluten/gi, '·')
    .replace(/salsa de soja sin gluten \(tamari\)/gi, '·')
    .replace(/yogur de coco[^,]*/gi, '·')
    .replace(/nata de coco/gi, '·')
    .replace(/proteína aislada de suero \(sin lactosa\)/gi, '·')
    .replace(/[\wáéíóúñ]+(\s+[\wáéíóúñ]+)*?\s+sin lactosa/gi, '·')
    .replace(/(leche|bebida) (de (avena|coco|arroz|soja)|vegetal)/gi, '·')
    .replace(/semillas de (calabaza|girasol|lino|chía|sésamo)/gi, '·')
    .replace(/\bpipas\b/gi, '·');
}

// Copia exacta de `rastros` en index.html (con /g para poder recorrerlos).
const RASTROS = {
  'gluten': /\b(pan|panes|panecillos?|tostas?|tostadas?|pasta|macarrones|espaguetis?|fideos|avena|trigo|cebada|centeno|espelta|cuscús|couscous|bulgur|seitán|galletas?|bocadillo|wrap|granola|muesli|harina|lasaña|croquetas?|rebozad\w*|empanad\w*|pizza|pita|bagel|barritas?|multicereal|wassa|cerveza)\b/gi,
  'lactosa': /\b(leches?|quesos?|yogur(t|es|ts)?|requeso?n(es)?|requesón|cottage|natas?|mantequillas?|kéfir(es)?|kefir(es)?|skyrs?|whey|cuajadas?|parmesano|mozzarella|feta|ricotta|burrata|bechamel|helados?|pesto)\b/gi,
  'frutos secos': /\b(nuez|nueces|almendras?|anacardos?|avellanas?|pistachos?|cacahuetes?|piñones?|macadamia|pecanas?|praliné|turrón|mazapán|frutos secos|pesto)\b/gi
};

// Todas las opciones de comida del plan (la base y las de cada día), sin
// repetir. SOLO comida: nunca las notas ni el texto del entreno -- ahí es
// normal leer "tu plan evita el gluten", y eso no es un fallo.
function _opcionesDelPlan(plan) {
  const meals = [...(plan.nutricion || [])];
  (plan.nutricionPorDia || []).forEach(d => { if (Array.isArray(d)) meals.push(...d); });
  const vistas = new Set();
  const out = [];
  for (const m of meals) {
    for (const o of ((m && m.opciones) || [])) {
      if (!o || typeof o.nombre !== 'string') continue;
      const clave = o.nombre + '|' + (o.ingredientes || '') + '|' + (o.pasos || '');
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      out.push(o);
    }
  }
  return out;
}

function _fragmento(texto, idx, largo) {
  const ini = Math.max(0, idx - 45);
  const fin = Math.min(texto.length, idx + largo + 45);
  return (ini > 0 ? '…' : '') + texto.slice(ini, fin).replace(/·/g, '[…]').trim() + (fin < texto.length ? '…' : '');
}

// Revisa UN plan guardado contra lo que el cliente dijo en el cuestionario.
// Devuelve la lista de hallazgos (vacía = todo bien), como mucho 15, cada uno
// con qué palabra, en qué plato, en qué campo, por qué motivo y un trozo del
// texto para poder juzgarlo sin abrir el plan.
function auditarPlan(userData, plan) {
  if (!plan || typeof plan !== 'object') return [];
  const ud = userData || {};
  const dieta = String(ud.dieta || '');
  const alergia = String(ud.alergia || 'No');

  // Mismas condiciones que sinGluten / sinLactosa / sinFrutosSecos del motor.
  const alergenos = [];
  if (dieta.includes('gluten') || alergia.includes('Gluten')) alergenos.push('gluten');
  if (dieta.includes('lactosa') || alergia.includes('Lactosa')) alergenos.push('lactosa');
  if (alergia.includes('Frutos secos')) alergenos.push('frutos secos');

  // Mismo texto que el motor pasa a filtrarNoComida.
  const alergiaLibre = (ud.alergia === 'Otra' && ud.alergiaOtra) ? _expandirAlergenoLibre(ud.alergiaOtra) : '';
  const textoFiltro = [ud.noComida, alergiaLibre].filter(Boolean).join(', ');
  const tokens = _tokensNoComida(textoFiltro);

  if (!alergenos.length && !tokens.length) return [];

  const porClave = new Map();
  const anotar = (motivo, palabra, op, campo, texto, idx) => {
    const clave = motivo + '|' + palabra.toLowerCase() + '|' + op.nombre + '|' + campo;
    const previo = porClave.get(clave);
    if (previo) { previo.veces++; return; }
    porClave.set(clave, {
      motivo, coincidencia: palabra, plato: op.nombre, campo,
      fragmento: _fragmento(texto, idx, palabra.length), veces: 1
    });
  };

  for (const op of _opcionesDelPlan(plan)) {
    if (alergenos.length) {
      // Nombre + ingredientes JUNTOS, exactamente como esSeguro() del motor:
      // "Mini bocadillo de jamón…" es seguro para un celíaco si sus
      // ingredientes dicen "panecillo sin gluten" -- el nombre del plato no
      // repite el "sin gluten". Mirándolos por separado, el agente marcaba
      // 440 bocadillos correctos en 90 planes sin gluten (comprobado el 11
      // sept 2026 generando planes reales).
      const nombre = op.nombre || '';
      const ingr = typeof op.ingredientes === 'string' ? op.ingredientes : '';
      const neutro = _neutralizar(nombre + ' ' + ingr);
      for (const a of alergenos) {
        const re = new RegExp(RASTROS[a].source, 'gi');
        let m;
        while ((m = re.exec(neutro))) {
          const palabra = new RegExp('\\b' + m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          anotar('alergia/dieta: ' + a, m[0], op, palabra.test(nombre) ? 'nombre' : 'ingredientes', neutro, m.index);
        }
      }
      // Los PASOS van aparte: el motor no los mira, y es justo por donde se
      // colaban los fallos ("Tuesta el pan sin gluten de centeno", "mete la
      // leche en la batidora" en un plan sin lactosa).
      if (typeof op.pasos === 'string' && op.pasos) {
        const neutroPasos = _neutralizar(op.pasos);
        for (const a of alergenos) {
          const re = new RegExp(RASTROS[a].source, 'gi');
          let m;
          while ((m = re.exec(neutroPasos))) anotar('alergia/dieta: ' + a, m[0], op, 'pasos', neutroPasos, m.index);
        }
      }
    }
    for (const campo of ['nombre', 'ingredientes', 'pasos']) {
      const texto = op[campo];
      if (!texto || typeof texto !== 'string') continue;
      for (const t of tokens) {
        const re = _reAlimento(t);
        let m;
        while ((m = re.exec(texto))) anotar('no come: ' + t, m[0], op, campo, texto, m.index);
      }
    }
  }
  return [...porClave.values()].sort((a, b) => b.veces - a.veces).slice(0, 15);
}

// Revisa el plan GUARDADO de un cliente y deja su fila de
// auditorias_clientes al día: la crea/actualiza si hay hallazgos y la borra
// si ya no los hay. Lo usan:
//   · api/notify.js, tipo 'auditar_plan': en cuanto un cliente guarda un
//     plan nuevo (registro, cambio de plan, check-in);
//   · api/admin-clientes.js, al pulsar "Regenerar plan" en Jarvis, para que
//     el aviso desaparezca en el momento y no al día siguiente.
// (El cron diario hace lo mismo en bloque, sin esta función, para no leer
// los perfiles uno a uno.)
//
// Devuelve { hallazgos, nuevo }: `nuevo` es true solo si hay hallazgos que
// no estaban ya avisados -- para mandar el aviso al admin UNA vez, no cada
// vez que el cliente vuelve a guardar el mismo plan.
//
// supabase-js NO lanza, devuelve {data, error}: se mira `.error` en cada
// paso y se lanza a mano, para que quien llama lo pueda registrar.
async function auditarYGuardar(supa, userId) {
  const { data: p, error } = await supa.from('profiles')
    .select('id, nombre, email, userdata, plan').eq('id', userId).maybeSingle();
  if (error) throw new Error('profiles: ' + error.message);
  if (!p) return { hallazgos: [], nuevo: false };

  const hallazgos = p.plan ? auditarPlan(p.userdata || {}, p.plan) : [];

  const { data: previa, error: ePrev } = await supa.from('auditorias_clientes')
    .select('hallazgos').eq('user_id', userId).maybeSingle();
  if (ePrev) throw new Error('auditorias_clientes: ' + ePrev.message);

  const firma = h => JSON.stringify((h || []).map(x => [x.motivo, x.coincidencia, x.plato, x.campo]).sort());
  const nuevo = hallazgos.length > 0 && (!previa || firma(previa.hallazgos) !== firma(hallazgos));

  if (hallazgos.length) {
    const { error: eUp } = await supa.from('auditorias_clientes').upsert({
      user_id: userId,
      nombre: p.nombre || (p.userdata && p.userdata.nombre) || '',
      email: p.email || '',
      hallazgos,
      actualizado_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (eUp) throw new Error('guardar auditoría: ' + eUp.message);
  } else if (previa) {
    const { error: eDel } = await supa.from('auditorias_clientes').delete().eq('user_id', userId);
    if (eDel) throw new Error('cerrar auditoría: ' + eDel.message);
  }
  return { hallazgos, nuevo, nombre: p.nombre || '', email: p.email || '' };
}

module.exports = {
  _normTexto, _raizSinPlural, _normAlimento, _reAlimento, _SEPARADOR_ALIMENTOS,
  _expandirAlergenoLibre, _tokensNoComida, _neutralizar, _opcionesDelPlan,
  FAMILIAS_ALIMENTOS, SINONIMOS_ALERGENO, SINONIMOS_MISMO_ALIMENTO, RASTROS,
  auditarPlan, auditarYGuardar
};
