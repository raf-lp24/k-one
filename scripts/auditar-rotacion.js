#!/usr/bin/env node
/*
 * AUDITOR DE LA TABLA DE ROTACIÓN (ALTERNATIVAS_EJERCICIO)
 * ========================================================
 *
 * Por qué existe. La rotación cambia el NOMBRE de un ejercicio por el de otro
 * sin mirar el resto de la frase ni lo que ese ejercicio significa. De ahí han
 * salido, uno detrás de otro, fallos que llegaron a clientes reales:
 *
 *   · peso muerto rumano  -> Hip thrust            (isquios cambiados por glúteo:
 *                                                   la semana se quedó en 0,9
 *                                                   series de isquio)
 *   · hip thrust          -> Abductores en máquina (extensión de cadera cambiada
 *                                                   por abducción)
 *   · prensa de piernas   -> Aductores en máquina  (el aductor no es el cuádriceps)
 *   · elevaciones lat.    -> Elevaciones frontales (deltoides medio cambiado por
 *                                                   anterior, que ya iba saturado)
 *   · press banca         -> Press militar         (el día de PECHO sin ningún
 *                                                   press horizontal)
 *   · plancha 3x30s       -> Rueda abdominal 3x30s (una rueda abdominal "durante
 *                                                   30 segundos")
 *   · A-skips 3x20m       -> Comba 3x20m           (saltar a la comba 20 metros)
 *   · copenhagen 3x15s    -> Pallof press 3x15s    (el pallof va por repeticiones)
 *
 * Todos son el MISMO fallo: la alternativa no comparte con el ejercicio que
 * sustituye o bien el músculo, o bien el patrón de movimiento, o bien la unidad
 * en que se mide. Este script comprueba las tres cosas de una vez, para que el
 * siguiente no haga falta encontrarlo mirando planes a mano.
 *
 * Cómo lo comprueba. Con tablas PROPIAS, escritas aquí y a mano -- no reutiliza
 * ninguna del motor. Auditar el filtro con las tablas del propio filtro es no
 * auditar nada: si la clasificación del motor está mal, el auditor repetiría el
 * mismo error y daría el visto bueno.
 *
 *   node scripts/auditar-rotacion.js
 *
 * Sale con código 1 si encuentra algún fallo, para poder encadenarlo.
 */

const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'index.html');

// ──────────────────────────────────────────────────────────────────────────
// 1 · EXTRAER LA TABLA DEL index.html
// ──────────────────────────────────────────────────────────────────────────
function extraerTabla() {
  const lineas = fs.readFileSync(INDEX, 'utf8').split(/\r?\n/);
  const desde = lineas.findIndex(l => l.includes('const ALTERNATIVAS_EJERCICIO = ['));
  if (desde < 0) throw new Error('No encuentro ALTERNATIVAS_EJERCICIO en index.html');
  // La tabla se cierra con una linea que es solo "];" a su nivel de indentado.
  let hasta = -1;
  for (let i = desde + 1; i < lineas.length; i++) {
    if (/^\s{0,4}\];\s*$/.test(lineas[i])) { hasta = i; break; }
  }
  if (hasta < 0) throw new Error('No encuentro el cierre de la tabla');
  const literal = lineas.slice(desde, hasta + 1).join('\n')
    .replace('const ALTERNATIVAS_EJERCICIO = ', '')
    .replace(/;\s*$/, '');
  // eslint-disable-next-line no-eval
  return eval(literal);
}
// ──────────────────────────────────────────────────────────────────────────
// 2 · NOMBRE LEGIBLE A PARTIR DE LA REGEX DE CADA REGLA
// ──────────────────────────────────────────────────────────────────────────
// La regla se identifica por su regex; para clasificarla necesitamos un nombre
// de ejercicio de verdad. Se reconstruye la primera rama de la alternancia,
// quitando la sintaxis de regex y los grupos opcionales (que son material o
// variantes, no el ejercicio).
// Unidades REALES con que cada ejercicio aparece escrito en las plantillas.
// No se pueden deducir del nombre: el mismo "dead bug" se escribe "3x30s" en
// las plantillas de gimnasio y "3x10/lado" en las de running, y las dos son
// correctas. Lo que no puede pasar es que la alternativa no admita NINGUNA de
// las unidades con que se escribe el ejercicio al que sustituye.
function unidadesEnPlantillas() {
  const todo = fs.readFileSync(INDEX, 'utf8');
  // Solo el bloque donde se construyen las semanas: los comentarios del motor
  // citan ejemplos de fallos ("Comba 3x20m") y el escáner se los creía.
  const src = todo.slice(todo.indexOf('let semana = [];'), todo.indexOf('// fin if (!soloDieta)'));
  const mapa = new Map();
  // Las plantillas escriben las series interpoladas ("dead bug ${sVol}×30s").
  // Sin convertir eso en un número, el escáner se dejaba fuera la mitad de los
  // ejercicios y creía que el dead bug solo se escribe por repeticiones.
  const texto = src.replace(/\$\{[^}]*\}/g, '3');
  const re = /([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\- ]{2,42}?)\s(\d+)\s*[x×]\s*(\d+)\s*(s\b|seg\b|m\b|min\b)?/g;
  let m;
  while ((m = re.exec(texto))) {
    const nombre = m[1].replace(/^.*?(?:·|,|\+|:)\s*/, '').trim().toLowerCase();
    if (nombre.length < 3) continue;
    const uni = (m[4] || 'reps').toLowerCase().replace('seg', 's');
    if (!mapa.has(nombre)) mapa.set(nombre, new Set());
    mapa.get(nombre).add(uni);
  }
  return mapa;
}
// Una regla puede cazar varios nombres ("/wall balls?|thrusters?/"). Se
// reconstruyen TODAS las ramas: clasificar solo por la primera daba avisos
// falsos en reglas cuya primera rama es código muerto (snatch, muscle-ups...)
// mientras la rama viva era otra.
function nombresDeRegex(re) {
  let s = re.source;
  s = s.replace(/\(\?[!=:][^)]*\)/g, '');        // lookaheads
  s = s.replace(/\([^()]*\)\?/g, '');            // grupos opcionales enteros
  // partir por las alternancias de nivel superior
  const ramas = [];
  let prof = 0, act = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { act += c + (s[i + 1] || ''); i++; continue; }
    if (c === '(' || c === '[') { prof++; act += c; continue; }
    if (c === ')' || c === ']') { prof--; act += c; continue; }
    if (c === '|' && prof === 0) { ramas.push(act); act = ''; continue; }
    act += c;
  }
  ramas.push(act);
  return ramas.map(r => r
    .replace(/\(|\)/g, '')
    .replace(/\[([A-Za-zÁÉÍÓÚáéíóú])[A-Za-zÁÉÍÓÚáéíóú]*\]/g, '$1')
    .replace(/\\b|\\s\*|\\s\+|\\s|\\/g, ' ')
    .replace(/([a-záéíóúñ])\?/gi, '$1')
    .replace(/\?|\+|\*/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase()
  ).flatMap(r => r.split('|'))            // alternancias que iban dentro de un grupo
    .map(r => r.trim()).filter(Boolean);
}
// ──────────────────────────────────────────────────────────────────────────
// 3 · CLASIFICACIÓN PROPIA: MÚSCULO, PATRÓN Y UNIDAD
// ──────────────────────────────────────────────────────────────────────────
// Orden importante: gana la primera que casa, así que lo específico va antes.
const MUSCULO = [
  [/rueda abdominal|plancha|dead bug|bird dog|hollow|pallof|russian twist|superman|tijeras|copenhagen|elevaci[oó]n de piernas|abdominal/i, 'core'],
  [/a-skips|b-skips|high knees|butt kicks|strides|drills?/i, 'drill-carrera'],
  [/farmer carry|suitcase|overhead carry|sled/i, 'carry'],
  [/sprint|comba|burpee|mountain climber|escalador|salto del patinador|box jump|step-ups explosivos|cinta|bici|el[íi]ptica|assault|air bike|remo suave|remo o bici|caminata|thruster|wall ball|snatch|clean/i, 'cardio'],
  [/gemelos/i, 'gemelos'],
  [/aductor/i, 'aductores'],
  [/abductor/i, 'gluteo-medio'],
  [/hip thrust|puente de gl[uú]teo|patada de gl[uú]teo/i, 'gluteo'],
  [/femoral|peso muerto rumano|buenos d[ií]as/i, 'isquios'],
  [/peso muerto|deadlift/i, 'cadena-posterior'],
  [/sentadilla|prensa|zancada|step[- ]?up|b[uú]lgara|hack|extensi[oó]n de cu[aá]driceps|split squat|pistol/i, 'cuadriceps'],
  [/extensi[oó]n de tr[ií]ceps|press franc[eé]s|patada de tr[ií]ceps|copa de tr[ií]ceps|press cerrado|fondos en banco/i, 'triceps'],
  [/curl/i, 'biceps'],
  [/press militar|press de hombro|press arnold|elevaciones laterales|elevaciones frontales|elevaciones en polea|p[aá]jaros/i, 'hombro'],
  [/face pull|retracci[oó]n escapular|encogimiento/i, 'espalda-alta'],
  [/jal[oó]n|domin|remo|australiano|pullover|muscle[- ]?up|dead hang/i, 'espalda'],
  [/press|apertura|cruces|contractor|flexion|fondos en paralelas/i, 'pecho'],
];

const PATRON = [
  [/rueda abdominal|plancha frontal|plancha invertida|plancha con|^plancha$|dead bug|bird dog|hollow|superman|tijeras|elevaci[oó]n de piernas|abdominal/i, 'core-antiextension'],
  [/plancha lateral|pallof|russian twist|copenhagen/i, 'core-lateral'],
  [/a-skips|b-skips|high knees|butt kicks|strides/i, 'drill'],
  [/farmer carry|suitcase|overhead carry|sled/i, 'carry'],
  [/sprint|comba|burpee|mountain climber|escalador|patinador|box jump|cinta|bici|el[íi]ptica|assault|air bike|remo suave|remo o bici|caminata/i, 'cardio'],
  [/gemelos/i, 'aislamiento'],
  [/hip thrust|puente de gl[uú]teo|patada de gl[uú]teo/i, 'extension-cadera'],
  [/peso muerto|buenos d[ií]as|deadlift|clean|snatch/i, 'bisagra'],
  [/femoral/i, 'aislamiento'],
  [/sentadilla|prensa|zancada|step[- ]?up|b[uú]lgara|hack|split squat|pistol/i, 'rodilla'],
  [/extensi[oó]n de cu[aá]driceps|curl|elevaciones (laterales|frontales)|elevaciones en polea|p[aá]jaros|apertura|cruces|contractor|face pull|retracci[oó]n|encogimiento|patada de tr[ií]ceps|extensi[oó]n de tr[ií]ceps|press franc[eé]s|copa de/i, 'aislamiento'],
  [/press militar|press de hombro|press arnold|push press/i, 'empuje-vertical'],
  [/jal[oó]n|domin|muscle[- ]?up|dead hang/i, 'traccion-vertical'],
  [/remo|australiano/i, 'traccion-horizontal'],
  [/press|flexion|fondos/i, 'empuje-horizontal'],
];

// Unidad en que se escribe el ejercicio en las plantillas.
const UNIDAD = [
  [/plancha|hollow|copenhagen|superman|dead hang|equilibrio en una pierna|bird dog/i, 's'],
  [/a-skips|b-skips|high knees|butt kicks|strides|farmer carry|suitcase|overhead carry|sled/i, 'm'],
  [/cinta|bici|el[íi]ptica|assault|air bike|remo suave|remo o bici|caminata/i, 'min'],
  [/./, 'reps'],
];

const clasifica = (tabla, nombre, porDefecto) => {
  for (const [re, val] of tabla) if (re.test(nombre)) return val;
  return porDefecto;
};
const musculoDe = n => clasifica(MUSCULO, n, 'desconocido');
const patronDe  = n => clasifica(PATRON, n, 'desconocido');
// Unos pocos ejercicios se prescriben correctamente de las dos formas: el bird
// dog, el superman y el dead bug se ven tanto "3×30s" (aguantando) como
// "3×10/lado" (por repeticiones), y las dos son válidas. Para estos, la unidad
// no es un dato único sino un conjunto, y basta con que haya algo en común.
const AMBIGUOS = /bird dog|superman|dead bug|equilibrio en una pierna|puente de gl[uú]teo/i;
const unidadesDe = n => AMBIGUOS.test(n) ? ['s', 'reps'] : [clasifica(UNIDAD, n, 'reps')];

// ──────────────────────────────────────────────────────────────────────────
// 4 · EXCEPCIONES JUSTIFICADAS
// ──────────────────────────────────────────────────────────────────────────
// Parejas que el clasificador marca distintas pero que un entrenador acepta.
// Cada una con su motivo: si no hay motivo escrito, es un fallo, no una excepción.
const ACEPTADAS = [
  { de: 'peso muerto', a: 'Peso muerto rumano',
    motivo: 'variantes del mismo levantamiento; ambas son bisagra de cadera' },
  { de: 'peso muerto rumano', a: 'Femoral tumbado en máquina',
    motivo: 'mismo músculo (isquios); se acepta perder la bisagra porque hay otra en el día' },
  { de: 'peso muerto rumano', a: 'Curl femoral sentado en máquina',
    motivo: 'mismo músculo (isquios); ídem' },
  { de: 'curl femoral', a: 'Peso muerto rumano',
    motivo: 'mismo músculo (isquios), sube de aislamiento a básico' },
  { de: 'curl femoral', a: 'Hip thrust',
    motivo: 'cadena posterior; el hueco de femoral admite extensión de cadera' },
  { de: 'hip thrust', a: 'Peso muerto rumano',
    motivo: 'ambos son cadera cargada; el rumano añade isquios' },
  { de: 'fondos en paralelas', a: 'Press banca con mancuernas',
    motivo: 'los fondos son empuje de pecho; el press horizontal es su equivalente directo' },
  { de: 'fondos en paralelas', a: 'Press cerrado',
    motivo: 'ídem, con más énfasis de tríceps como los propios fondos' },
  { de: 'extension de triceps', a: 'Press cerrado',
    motivo: 'el press cerrado es el básico de tríceps; se acepta subir de aislamiento a compuesto' },
  { de: 'press francés', a: 'Fondos en banco',
    motivo: 'los dos son tríceps; uno aislado y otro con el propio peso' },
  { de: 'extension de triceps', a: 'Fondos en banco',
    motivo: 'tríceps con el propio peso en vez de aislado en polea; mismo músculo' },
  { de: 'femoral tumbado', a: 'Peso muerto rumano',
    motivo: 'mismo músculo (isquios), sube de aislamiento a básico' },
  { de: 'femoral tumbado', a: 'Hip thrust',
    motivo: 'cadena posterior; el hueco de femoral admite extensión de cadera' },
  { de: 'thruster', a: 'Sentadilla goblet + press de hombro',
    motivo: 'es la descomposición del thruster' },
  { de: 'copenhagen plank', a: 'Plancha lateral',
    motivo: 'mismo core lateral, versión más accesible' },
  { de: 'copenhagen plank', a: 'Bird dog',
    motivo: 'core antiextensión como regresión del copenhagen; ambos se aguantan por tiempo' },
  { de: 'russian twist', a: 'Rueda abdominal',
    motivo: 'core por repeticiones; se acepta cambiar rotación por antiextensión' },
  { de: 'russian twist', a: 'Tijeras',
    motivo: 'ídem' },
  { de: 'burpees', a: 'Cinta con inclinación a paso rápido',
    motivo: 'el hueco es acondicionamiento; se cambia a bajo impacto a propósito' },
  { de: 'burpees', a: 'Remo o bici suave 5 min',
    motivo: 'ídem' },
  { de: 'burpees', a: 'Mountain climbers',
    motivo: 'acondicionamiento equivalente sin salto' },
  { de: 'box jumps', a: 'Cinta con inclinación a paso rápido',
    motivo: 'acondicionamiento de bajo impacto como alternativa al salto' },
  { de: 'box jumps', a: 'Comba saltos simples',
    motivo: 'salto de menor altura, mismo estímulo' },
  { de: 'box jumps', a: 'Step-ups explosivos',
    motivo: 'mismo patrón de rodilla explosivo sin fase de vuelo' },
  { de: 'double unders', a: 'Cinta con inclinación a paso rápido',
    motivo: 'acondicionamiento de bajo impacto' },
  { de: 'double unders', a: 'Bici estática suave',
    motivo: 'ídem' },
  { de: 'double unders', a: 'Remo suave 5 min',
    motivo: 'ídem' },
  { de: 'mountain climbers', a: 'Burpees',
    motivo: 'acondicionamiento equivalente' },
  { de: 'mountain climbers', a: 'Cinta con inclinación a paso rápido',
    motivo: 'ídem, bajo impacto' },
  { de: 'mountain climbers', a: 'Escaladores',
    motivo: 'es el mismo ejercicio con su nombre en español' },
  { de: 'mountain climbers', a: 'Salto del patinador',
    motivo: 'acondicionamiento equivalente' },
  { de: 'kettlebell swings', a: 'Hip thrust con mancuerna',
    motivo: 'extensión de cadera, que es lo que entrena el swing' },
  { de: 'kettlebell swings', a: 'Peso muerto rumano con kettlebell',
    motivo: 'bisagra de cadera con el mismo material' },
  { de: 'wall balls', a: 'Thrusters con mancuernas',
    motivo: 'mismo movimiento sin el balón' },
  { de: 'wall balls', a: 'Sentadilla + press de hombro',
    motivo: 'es la descomposición del wall ball' },
  { de: 'thrusters', a: 'Wall balls',
    motivo: 'mismo movimiento con balón' },
  { de: 'thrusters', a: 'Sentadilla goblet + press de hombro',
    motivo: 'descomposición del thruster' },
  { de: 'sled push', a: 'Farmer carry',
    motivo: 'los dos son desplazamiento con carga' },
  { de: 'sled push', a: 'Zancadas cargadas con mancuernas',
    motivo: 'pierna con carga en desplazamiento' },
  { de: 'sled pull', a: 'Farmer carry',
    motivo: 'desplazamiento con carga' },
  { de: 'sled pull', a: 'Remo con banda de resistencia',
    motivo: 'tracción horizontal, que es lo que hace el sled pull' },
  { de: 'farmer carry', a: 'Zancadas cargadas con mancuernas',
    motivo: 'pierna con carga en desplazamiento' },
  { de: 'sandbag lunges', a: 'Zancadas con mancuernas',
    motivo: 'mismo ejercicio con otro material' },
  { de: 'sandbag lunges', a: 'Step-ups con mancuernas',
    motivo: 'pierna unilateral con carga' },
  { de: 'pistol squat', a: 'Step-ups con mancuernas',
    motivo: 'regresión unilateral del pistol' },
  { de: 'pistol squat', a: 'Sentadilla búlgara',
    motivo: 'ídem' },
  { de: 'muscle-ups', a: 'Dominadas + fondos en banco',
    motivo: 'es la descomposición del muscle-up' },
  { de: 'muscle-ups', a: 'Dominadas explosivas',
    motivo: 'la mitad de tracción del muscle-up' },
  { de: 'dead hang', a: 'Remo en polea baja',
    motivo: 'hueco de agarre/espalda; el remo lo cubre con carga' },
  { de: 'a-skips b-skips', a: 'High knees',
    motivo: 'drill de carrera, misma unidad en metros' },
  { de: 'a-skips b-skips', a: 'Butt kicks',
    motivo: 'ídem' },
  { de: 'face pull', a: 'Remo en polea con agarre ancho',
    motivo: 'los dos trabajan deltoides posterior y espalda alta' },
  { de: 'pájaros', a: 'Face pull',
    motivo: 'deltoides posterior, mismo objetivo' },
  { de: 'pájaros', a: 'Elevaciones laterales con mancuernas',
    motivo: 'hueco de deltoides accesorio; se acepta lateral por posterior' },
  { de: 'cruces en polea', a: 'Press inclinado con mancuernas',
    motivo: 'el hueco es de pecho; se acepta subir de aislamiento a básico' },
  { de: 'prensa de piernas', a: 'Zancadas con mancuernas',
    motivo: 'cuádriceps, versión unilateral' },
  { de: 'prensa de piernas', a: 'Extensión de cuádriceps',
    motivo: 'mismo músculo, aislado' },
  { de: 'sentadilla trasera', a: 'Prensa de piernas',
    motivo: 'cuádriceps en máquina como alternativa a la sentadilla libre' },
  { de: 'zancadas', a: 'Step-ups con mancuernas',
    motivo: 'pierna unilateral' },
  { de: 'elevaciones laterales', a: 'Elevaciones en polea',
    motivo: 'mismo ejercicio en polea' },
];

const sinTilde = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const esAceptada = (de, a) => ACEPTADAS.find(x => {
  const d1 = sinTilde(de), d2 = sinTilde(x.de);
  const coincideOrigen = d1.includes(d2) || d2.includes(d1);
  return coincideOrigen && sinTilde(a) === sinTilde(x.a);
});

// ──────────────────────────────────────────────────────────────────────────
// 5 · AUDITORÍA
// ──────────────────────────────────────────────────────────────────────────
function main() {
  const tabla = extraerTabla();
  const fallos = [];
  const avisos = [];
  const muertas = [];

  const unidadesReales = unidadesEnPlantillas();
  // Unidades con que se escribe de verdad lo que caza cada regla.
  const unidadesDeRegla = regex => {
    const u = new Set();
    for (const [nombre, unis] of unidadesReales) {
      if (regex.test(nombre)) unis.forEach(x => u.add(x));
    }
    return u;
  };

  // Texto de las plantillas de entrenamiento, para saber qué reglas siguen vivas.
  const htm = fs.readFileSync(INDEX, 'utf8');
  const plantillas = htm.slice(htm.indexOf('let semana = [];'), htm.indexOf('// fin if (!soloDieta)')).toLowerCase();

  for (const [regex, alternativas] of tabla) {
    // Se prueba la REGEX contra el texto real de las plantillas, y se clasifica
    // exactamente el nombre que la plantilla escribe. Reconstruir el nombre a
    // partir de la regex fallaba con tildes ("b[uú]lgara"), grupos opcionales
    // ("remo (con )?barra") y alternancias anidadas.
    const enPlantilla = plantillas.match(regex);
    if (!enPlantilla) {
      muertas.push(nombresDeRegex(regex)[0] + '  (regex ' + regex + ')');
      continue;
    }
    const origen = enPlantilla[0].trim();
    const mO = musculoDe(origen), pO = patronDe(origen);
    const uReales = unidadesDeRegla(regex);

    if (mO === 'desconocido') {
      avisos.push(`sin clasificar: "${origen}" (regex ${regex}) — añádelo a las tablas del auditor`);
    }

    for (const alt of alternativas) {
      const mA = musculoDe(alt), pA = patronDe(alt), uA = unidadesDe(alt);
      // La lista de excepciones es la única puerta de salida, y vale para las
      // tres comprobaciones: hay cambios de unidad legítimos (un farmer carry
      // medido en metros por unas zancadas cargadas, que también se hacen por
      // distancia). Lo que no vale es un cambio sin motivo escrito.
      if (esAceptada(origen, alt)) continue;

      // La unidad solo se comprueba si sabemos cómo se escribe de verdad el
      // ejercicio original en alguna plantilla. Si no aparece con cantidad
      // (va dentro de un circuito en prosa, por ejemplo), no hay nada que
      // comparar y afirmarlo sería inventarse un fallo.
      if (uReales.size && !uA.some(u => uReales.has(u))) {
        fallos.push({ tipo: 'UNIDAD', origen, alt,
          det: `se escribe en "${[...uReales].join('/')}" y la alternativa va en "${uA.join('/')}"` });
        continue;
      }
      if (mO !== mA && mO !== 'desconocido' && mA !== 'desconocido') {
        fallos.push({ tipo: 'MÚSCULO', origen, alt, det: `${mO} -> ${mA}` });
        continue;
      }
      if (pO !== pA && pO !== 'desconocido' && pA !== 'desconocido') {
        fallos.push({ tipo: 'PATRÓN', origen, alt, det: `${pO} -> ${pA}` });
      }
    }
  }

  const L = s => console.log(s);
  L('');
  L('═'.repeat(72));
  L('  AUDITOR DE LA TABLA DE ROTACIÓN');
  L('═'.repeat(72));
  L(`  ${tabla.length} reglas, ${tabla.reduce((n, r) => n + r[1].length, 0)} alternativas`);
  L('');

  if (muertas.length) {
    L('  REGLAS MUERTAS (ninguna plantilla escribe ya ese ejercicio).');
    L('  No hacen daño hoy, pero si alguien reintroduce el nombre heredará sus');
    L('  alternativas sin que nadie las haya revisado. Bórralas o revísalas.');
    muertas.forEach(a => L('   · ' + a));
    L('');
  }
  if (avisos.length) {
    L('  AVISOS');
    avisos.forEach(a => L('   · ' + a));
    L('');
  }

  if (!fallos.length) {
    L('  ✔ Sin fallos: cada alternativa comparte músculo, patrón y unidad con');
    L('    el ejercicio que sustituye (o está en la lista de excepciones');
    L('    justificadas, con su motivo escrito).');
    L('');
    return 0;
  }

  L(`  ✖ ${fallos.length} alternativa(s) con problema:`);
  L('');
  for (const f of fallos) {
    L(`   [${f.tipo}] "${f.origen}" -> "${f.alt}"`);
    L(`            ${f.det}`);
  }
  L('');
  L('  Una alternativa de rotación tiene que trabajar el MISMO músculo, con el');
  L('  MISMO patrón de movimiento, y medirse en la MISMA unidad que el ejercicio');
  L('  al que sustituye. Si el cambio está justificado, añádelo a ACEPTADAS con');
  L('  su motivo — la lista es la documentación de por qué se acepta.');
  L('');
  return 1;
}

process.exit(main());
