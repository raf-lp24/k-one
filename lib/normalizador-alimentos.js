// AGENTE DE AUDITORÍA -- "¿hay algo en este plan que el cliente no puede o no
// quiere comer?", versión Node para api/notify.js y api/admin-clientes.js.
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
// index.html, tócalos también aquí -- y viceversa. No hace falta acordarse:
// scripts/auditoria-completa.js (sección 5) compara las dos copias y FALLA si
// se separan. El motor de verdad no se puede requerir desde Node (vive en un
// <script> de 26.000 líneas que necesita el DOM y el recetario cargado).
//
// Comprobado el 11 sept 2026 contra 420 planes reales generados con el motor
// (14 restricciones × 3 objetivos × 5 deportes × 2 tipos de plan): 0 avisos
// en planes correctos. La primera versión, que buscaba cada palabra suelta en
// el JSON entero del plan, daba cientos ("leche sin lactosa", "patatas
// panadera", las notas que explican la dieta...).

function _normTexto(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function _raizSinPlural(t) {
  if (t.length > 4 && /es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && /s$/.test(t)) return t.slice(0, -1);
  return t;
}

const _normAlimento = t => _raizSinPlural(_normTexto(t));

// Copia exacta de index.html (_SEPARADOR_ALIMENTOS).
const _SEPARADOR_ALIMENTOS = /[,;/+]+|\s+(?:y|e|o|ni)\s+/i;

// Copia exacta de index.html (_EQUIV_TILDE y _reAlimento).
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

// Los tokens que filtrarNoComida() de index.html acaba buscando para un
// texto, cada uno con la palabra que ESCRIBIÓ el cliente y lo originó (para
// que el aviso diga "no come: espárragos" y no la variante interna que casó).
// Misma lógica que el motor, paso por paso y en el mismo orden.
function _tokensConOrigen(noComidaRaw) {
  const raw = (noComidaRaw || '').trim();
  if (!raw) return [];
  const originales = raw.split(_SEPARADOR_ALIMENTOS).map(t => t.trim().toLowerCase()).filter(t => t.length >= 2);
  const origen = new Map();
  const add = (t, o) => { if (!origen.has(t)) origen.set(t, o); };
  originales.forEach(t => add(t, t));
  originales.forEach(t => {
    const tNorm = _normAlimento(t);
    for (const [familia, miembros] of Object.entries(FAMILIAS_ALIMENTOS)) {
      const familiaNorm = _normAlimento(familia);
      const esFamiliaEntera = tNorm === familiaNorm;
      const tocaAlgunMiembro = miembros.some(m => {
        const mNorm = _normAlimento(m);
        return mNorm === tNorm || mNorm.includes(tNorm) || tNorm.includes(mNorm);
      });
      if (esFamiliaEntera) { miembros.forEach(m => add(m, t)); continue; }
      if (tocaAlgunMiembro) miembros.forEach(m => { if (_normAlimento(m) === tNorm) add(m, t); });
    }
  });
  [...origen.keys()].forEach(t => {
    const extra = SINONIMOS_MISMO_ALIMENTO[_normAlimento(t)];
    if (extra) extra.forEach(e => add(e, origen.get(t)));
  });
  return [...origen.entries()].map(([token, o]) => ({ token, origen: o }));
}

function _tokensNoComida(noComidaRaw) {
  return _tokensConOrigen(noComidaRaw).map(x => x.token);
}

// Copia exacta de `neutralizar` en index.html: las formas YA seguras ("leche
// sin lactosa", "harina de arroz"...) que se borran antes de buscar rastros.
// Mismo orden, mismos patrones: el motor las cambia todas por '·'.
const NEUTRALIZAR = [
  /avena certificada sin gluten/gi,
  /harina de (arroz|maíz|garbanzos?|almendra)/gi,
  /(tortitas?|fideos|galletas|tortilla|wrap|pan|tostas?|tostadas?) de (arroz|maíz)/gi,
  /[\wáéíóúñ]+(\s+[\wáéíóúñ]+)*?\s+sin gluten/gi,
  /salsa de soja sin gluten \(tamari\)/gi,
  /yogur de coco[^,]*/gi,
  /nata de coco/gi,
  /proteína aislada de suero \(sin lactosa\)/gi,
  /[\wáéíóúñ]+(\s+[\wáéíóúñ]+)*?\s+sin lactosa/gi,
  /(leche|bebida) (de (avena|coco|arroz|soja)|vegetal)/gi,
  /semillas de (calabaza|girasol|lino|chía|sésamo)/gi,
  /\bpipas\b/gi
];

// Exactamente como el motor (cada forma segura -> '·').
function _neutralizar(txt) {
  return NEUTRALIZAR.reduce((t, re) => t.replace(re, '·'), txt);
}

// Igual, pero cambia cada forma segura por tantos '·' como letras tenía: el
// texto conserva la longitud, así que la posición de cada rastro coincide con
// la del texto ORIGINAL. Sirve para decir en qué campo está (nombre o
// ingredientes, que se revisan juntos) y para enseñar el trozo real del plato
// en el aviso, no uno lleno de marcas. Para detectar es lo mismo que la
// versión del motor: '·' no es letra ni espacio, así que un '·' o diez cortan
// igual las cadenas de palabras de los patrones.
function _neutralizarAlineado(txt) {
  return NEUTRALIZAR.reduce((t, re) => t.replace(re, m => '·'.repeat(m.length)), txt);
}

// Copia exacta de `rastros` en index.html (aquí con /g para poder recorrerlos).
const RASTROS = {
  'gluten': /\b(pan|panes|panecillos?|tostas?|tostadas?|pasta|macarrones|espaguetis?|fideos|avena|trigo|cebada|centeno|espelta|cuscús|couscous|bulgur|seitán|galletas?|bocadillo|wrap|granola|muesli|harina|lasaña|croquetas?|rebozad\w*|empanad\w*|pizza|pita|bagel|barritas?|multicereal|wassa|cerveza)\b/gi,
  'lactosa': /\b(leches?|quesos?|yogur(t|es|ts)?|requeso?n(es)?|requesón|cottage|natas?|mantequillas?|kéfir(es)?|kefir(es)?|skyrs?|whey|cuajadas?|parmesano|mozzarella|feta|ricotta|burrata|bechamel|helados?|pesto)\b/gi,
  'frutos secos': /\b(nuez|nueces|almendras?|anacardos?|avellanas?|pistachos?|cacahuetes?|piñones?|macadamia|pecanas?|praliné|turrón|mazapán|frutos secos|pesto)\b/gi
};

// Las opciones de comida del plan, sin repetir, con cuántas veces sale cada
// una (en los 7 días, o en el menú base si el plan no tiene reparto por día).
// SOLO comida: nunca las notas ni el texto del entreno -- ahí es normal leer
// "tu plan evita el gluten", y eso no es un fallo.
function _opcionesDelPlan(plan) {
  const porDia = (plan.nutricionPorDia || []).filter(Array.isArray);
  const listas = porDia.length ? porDia : [plan.nutricion || []];
  const base = plan.nutricion || [];
  const mapa = new Map();
  const meter = (m, cuenta) => {
    for (const o of ((m && m.opciones) || [])) {
      if (!o || typeof o.nombre !== 'string') continue;
      const clave = o.nombre + '|' + (o.ingredientes || '') + '|' + (o.pasos || '');
      const previo = mapa.get(clave);
      if (previo) previo.veces += cuenta;
      else mapa.set(clave, { o, veces: cuenta });
    }
  };
  listas.forEach(dia => dia.forEach(m => meter(m, 1)));
  // El menú base también se revisa, aunque no sume veces si ya hay días.
  if (porDia.length) base.forEach(m => meter(m, 0));
  return [...mapa.values()].map(x => ({ o: x.o, veces: Math.max(1, x.veces) }));
}

function _fragmento(texto, idx, largo) {
  const ini = Math.max(0, idx - 45);
  const fin = Math.min(texto.length, idx + largo + 45);
  return (ini > 0 ? '…' : '') + texto.slice(ini, fin).trim() + (fin < texto.length ? '…' : '');
}

// Revisa UN plan guardado contra lo que el cliente dijo en el cuestionario.
// Devuelve la lista de hallazgos (vacía = todo bien), como mucho 15, cada uno
// con qué palabra, en qué plato, en qué campo, por qué motivo, cuántas veces
// sale el plato y el trozo real de texto para juzgarlo sin abrir el plan.
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

  // Mismo texto que el motor pasa a filtrarNoComida (no como + otra alergia),
  // pero separado para que el aviso diga de cuál de los dos viene.
  const alergiaLibre = (ud.alergia === 'Otra' && ud.alergiaOtra) ? _expandirAlergenoLibre(ud.alergiaOtra) : '';

  // Las regex se compilan UNA vez por plan (antes: una vez por plato, campo
  // y token -- miles por plan con una familia entera como "verduras").
  const reAlergenos = alergenos.map(a => ['alergia/dieta: ' + a, new RegExp(RASTROS[a].source, 'gi')]);
  const reNoComida = [];
  const tokensVistos = new Set();
  const meterTokens = (lista, motivoDe) => lista.forEach(({ token, origen }) => {
    if (tokensVistos.has(token)) return;
    tokensVistos.add(token);
    reNoComida.push([motivoDe(origen), _reAlimento(token)]);
  });
  meterTokens(_tokensConOrigen(ud.noComida), o => 'no come: ' + o);
  if (alergiaLibre) meterTokens(_tokensConOrigen(alergiaLibre), () => 'otra alergia: ' + ud.alergiaOtra);

  if (!reAlergenos.length && !reNoComida.length) return [];

  // Se agrupa por palabra + plato + campo. Una misma palabra la cazan a menudo
  // varios tokens a la vez ("esparragos" se expande a "espárrago" y
  // "esparrago"), y antes eso sacaba el MISMO hallazgo tres veces.
  const porClave = new Map();
  const anotar = (motivo, palabra, op, campo, idx, veces) => {
    const clave = _normTexto(palabra) + '|' + op.nombre + '|' + campo;
    const previo = porClave.get(clave);
    if (previo) { previo.motivos.add(motivo); return; }
    porClave.set(clave, {
      motivos: new Set([motivo]), coincidencia: palabra, plato: op.nombre, campo,
      fragmento: _fragmento(op[campo], idx, palabra.length), veces
    });
  };

  for (const { o: op, veces } of _opcionesDelPlan(plan)) {
    const nombre = typeof op.nombre === 'string' ? op.nombre : '';
    const ingr = typeof op.ingredientes === 'string' ? op.ingredientes : '';
    const pasos = typeof op.pasos === 'string' ? op.pasos : '';
    if (reAlergenos.length) {
      // Nombre + ingredientes JUNTOS, exactamente como esSeguro() del motor:
      // "Mini bocadillo de jamón…" es seguro para un celíaco si sus
      // ingredientes dicen "panecillo sin gluten" -- el nombre del plato no
      // repite el "sin gluten". Neutralizado alineado: la posición del
      // rastro dice si está en el nombre o en los ingredientes.
      const junto = _neutralizarAlineado(nombre + ' ' + ingr);
      for (const [motivo, re] of reAlergenos) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(junto))) {
          if (m.index < nombre.length) anotar(motivo, m[0], op, 'nombre', m.index, veces);
          else anotar(motivo, m[0], op, 'ingredientes', m.index - nombre.length - 1, veces);
        }
      }
      // Los PASOS van aparte: el motor no los mira, y es justo por donde se
      // colaban los fallos ("Tuesta el pan sin gluten de centeno", "mete la
      // leche en la batidora" en un plan sin lactosa).
      if (pasos) {
        const np = _neutralizarAlineado(pasos);
        for (const [motivo, re] of reAlergenos) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(np))) anotar(motivo, m[0], op, 'pasos', m.index, veces);
        }
      }
    }
    for (const [campo, texto] of [['nombre', nombre], ['ingredientes', ingr], ['pasos', pasos]]) {
      if (!texto) continue;
      for (const [motivo, re] of reNoComida) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(texto))) anotar(motivo, m[0], op, campo, m.index, veces);
      }
    }
  }
  return [...porClave.values()]
    .map(x => ({ motivo: [...x.motivos].join(' · '), coincidencia: x.coincidencia, plato: x.plato, campo: x.campo, fragmento: x.fragmento, veces: x.veces }))
    .sort((a, b) => b.veces - a.veces)
    .slice(0, 15);
}

// Huella de un conjunto de hallazgos para saber si son "los mismos de antes":
// sin el motivo (su texto puede cambiar sin que cambie el fallo) ni las veces.
function firmaHallazgos(h) {
  return JSON.stringify((h || []).map(x => [_normTexto(x.coincidencia), x.plato, x.campo]).sort());
}

// Revisa el plan GUARDADO de un cliente y deja su fila de
// auditorias_clientes al día: la crea/actualiza si hay hallazgos y la borra
// si ya no los hay. Lo usan:
//   · api/notify.js, tipo 'auditar_plan': en cuanto un cliente guarda un
//     plan nuevo (registro, cambio de plan, check-in);
//   · api/admin-clientes.js, al pulsar "Regenerar plan" en Jarvis, para que
//     el aviso desaparezca en el momento y no al día siguiente.
// (El cron diario hace lo mismo en bloque, con auditarPlan + firmaHallazgos,
// para no leer los perfiles de uno en uno.)
//
// Devuelve { hallazgos, nuevo }: `nuevo` es true solo si hay hallazgos que
// no estaban ya avisados -- para avisar al admin UNA vez, no cada vez que el
// cliente vuelve a guardar el mismo plan.
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

  const nuevo = hallazgos.length > 0 && (!previa || firmaHallazgos(previa.hallazgos) !== firmaHallazgos(hallazgos));

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
  _normTexto, _raizSinPlural, _normAlimento, _reAlimento, _SEPARADOR_ALIMENTOS, _EQUIV_TILDE,
  _expandirAlergenoLibre, _tokensNoComida, _tokensConOrigen,
  NEUTRALIZAR, _neutralizar, _neutralizarAlineado, _opcionesDelPlan,
  FAMILIAS_ALIMENTOS, SINONIMOS_ALERGENO, SINONIMOS_MISMO_ALIMENTO, RASTROS,
  auditarPlan, firmaHallazgos, auditarYGuardar
};
