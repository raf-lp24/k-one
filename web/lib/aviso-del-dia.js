// Texto del aviso diario al móvil: QUÉ le toca hoy a este cliente según su
// propio plan guardado (el mismo `profiles.plan` que pinta la app).
//
// Por qué existe (15 sept 2026, reportado por el usuario: "las notificaciones
// no salen sincronizadas con lo que te toca entrenar"). El aviso ya leía el día
// correcto del plan, pero contaba mal lo que había en él:
//   1. Mandaba el `resumen` interno de la plantilla tal cual: "Upper A ·
//      Empuje + tirón", "Pull · Espalda, bíceps, manguito", "Full Body B ·
//      Peso muerto y verticales". El cliente que entrena pecho el lunes no
//      leía "pecho" en ningún sitio.
//   2. Si llevaba 7+ días sin abrir la app, el texto del día se SUSTITUÍA por
//      "X días sin entrenar, hoy es buen día para retomarlo" -- también en
//      los días de descanso, contradiciendo al plan.
//
// Ahora los músculos salen de la cabecera del propio día ("Pectoral, tríceps,
// hombro anterior · Press banca 4×6, ..."), que es fija por plantilla y no
// cambia con la rotación de ejercicios ni con la adaptación por lesión o
// material. Los días sin músculos (running, metcon, zona 2) usan su resumen,
// que es exactamente el título que ve el cliente en la app.
//
// Función pura, sin red ni base de datos, para poder probarla contra planes
// reales generados por el motor.

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Orden fijo de salida: así "Pecho, espalda, hombros, brazos" y
// "Dorsal, trapecio, bíceps" se leen siempre igual, venga como venga escrito.
// "hombro anterior" NO cuenta como hombros a propósito: en el día de pecho es
// trabajo indirecto, y el cliente espera leer "pecho y tríceps", que es como
// se titula ese día en la app.
const MUSCULOS = [
  [/\bpecho\b|pectoral/i, 'pecho'],
  [/espalda|dorsal/i, 'espalda'],
  [/\bhombros\b|deltoides/i, 'hombros'],
  [/pierna|cu[aá]driceps|isquio/i, 'pierna'],
  [/gl[uú]teo/i, 'glúteos'],
  [/b[ií]ceps/i, 'bíceps'],
  [/tr[ií]ceps/i, 'tríceps'],
  [/\bbrazos\b/i, 'brazos'],
  [/\bcore\b/i, 'core'],
];

function _unirConY(lista) {
  if (lista.length <= 1) return lista.join('');
  return lista.slice(0, -1).join(', ') + ' y ' + lista[lista.length - 1];
}

function _mayuscula(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// Siglas ("VO2máx", "RDL") se dejan como están: "vO2máx" no se lee.
function _minuscula(s) { return s && !/^[A-ZÁÉÍÓÚÑ0-9]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

// Separa "Cabecera · resto". Solo cuenta como cabecera un rótulo corto y sin
// cifras: en muchos días de CrossFit o de series el detalle empieza
// directamente por el trabajo ("Calentamiento: 10 min...") y eso no es un
// rótulo, aunque más adelante aparezca un " · ".
function _partirDetalle(detalle) {
  const i = (detalle || '').indexOf(' · ');
  if (i < 0) return { cabecera: '', cuerpo: detalle || '' };
  const cabecera = detalle.slice(0, i).trim();
  // "Zona 2" SÍ es rótulo (lleva cifra pero es corta); "25 min total: 15 min
  // zona 2 + 5×400m" no lo es.
  if (cabecera.length > 50 || /[×:]|\bmin\b|\d{2,}/.test(cabecera)) return { cabecera: '', cuerpo: detalle };
  return { cabecera, cuerpo: detalle.slice(i + 3) };
}

// "pecho, hombros y tríceps", "cuerpo completo", o '' si el día no es de
// grupos musculares.
function _musculosDelDia(dia) {
  const { cabecera } = _partirDetalle(dia.detalle);
  const fuente = cabecera || '';
  if (/cuerpo completo|full body/i.test(fuente) || /^full body/i.test(dia.resumen || '')) return 'cuerpo completo';
  const hallados = MUSCULOS.filter(([re]) => re.test(fuente)).map(([, nombre]) => nombre);
  // "pierna y glúteos" ya dice lo que es; con más de cuatro grupos el aviso
  // deja de leerse de un vistazo (Upper: pecho, espalda, hombros y brazos es
  // el máximo real que sale de las plantillas).
  return _unirConY(hallados.slice(0, 4));
}

// Lo que se lee en el título: los músculos si el día los tiene, si no el
// resumen tal cual lo enseña la app.
function queTocaEnDia(dia) {
  if (!dia) return '';
  if (dia.tipo === 'Descanso') return 'descanso';
  return _musculosDelDia(dia) || (dia.resumen || '').trim();
}

// Los ejercicios de fuerza del día, en orden: "press banca", "press inclinado
// con mancuernas"... Solo cuenta lo que lleva series×repeticiones, así que ni
// el remate de cardio ("Burpees 10 min interválico...") ni las notas técnicas
// entre paréntesis se cuelan como ejercicio.
function _ejerciciosDelDia(dia) {
  const { cuerpo } = _partirDetalle(dia.detalle);
  const sinParens = cuerpo.replace(/\([^()]*\)/g, '');
  return sinParens
    .split(/,\s+|\s\+\s/)
    .map(t => t.trim())
    .filter(t => /\d+\s*×\s*\d/.test(t) && !/interv[aá]lico|rondas|\bmin\b/i.test(t))
    .map(t => t.replace(/^(cierre|post-cardio|post):\s*/i, '').replace(/\s*\d+\s*×.*$/, '').trim())
    .filter(Boolean)
    .map(_minuscula);
}

// La frase del trabajo principal de un día sin ejercicios de series (rodaje,
// zona 2, metcon), cortada a lo que cabe en la notificación. Se salta el
// calentamiento y la vuelta a la calma: en un día de series el detalle empieza
// por "Calentamiento: 10 min trote + drills", y eso no dice qué toca hoy.
// Los paréntesis técnicos ("(RPE 3-4)") se quitan, salvo los que forman parte
// de la propia serie ("8×(1 min fuerte / 2 min suave)"), que llevan barra.
function _primeraFrase(dia) {
  const { cuerpo } = _partirDetalle(dia.detalle);
  const frases = cuerpo.split(/\.\s+/).map(f => f.trim()).filter(Boolean);
  const principal = frases.findIndex(x => !/^(calentamiento|enfriamiento|post|al acabar|estiramientos)\b/i.test(x));
  const inicio = principal >= 0 ? principal : 0;
  let f = frases[inicio] || '';
  // "Tirada larga · 80-100 min. Primera mitad a zona 2 suave..." -- la primera
  // frase sola ("80-100 min.") no dice nada: se junta con la siguiente.
  if (f.length < 25 && frases[inicio + 1]) f += '. ' + frases[inicio + 1];
  f = f.replace(/\s*\((?![^()]*\/)[^()]*\)/g, '').trim();
  if (f.length > 110) f = f.slice(0, 110).replace(/[\s,;:+]+\S*$/, '') + '…';
  return f;
}

/**
 * @param {object} p
 * @param {object} p.plan          plan guardado del cliente (profiles.plan)
 * @param {number} p.idx           día de hoy, lunes = 0 (calendario de Madrid)
 * @param {string} [p.nombre]      nombre de pila del cliente
 * @param {number} [p.diasSinEntrar] días desde la última vez que abrió la app
 * @returns {{title: string, body: string, tipo: string}|null}
 *          null si el plan no trae semana: el que llama decide el genérico.
 */
function avisoDelDia({ plan, idx, nombre, diasSinEntrar }) {
  const nombreDia = DIAS[idx] || '';
  const coma = nombre ? `, ${nombre}` : '';
  const semana = (plan && Array.isArray(plan.semana)) ? plan.semana : [];

  if (plan && (plan.soloDieta || !semana.length)) {
    const frases = [
      `Tus comidas de hoy ya están listas${coma}.`,
      `Hoy toca cuidar la alimentación${coma}. Tienes tu menú preparado.`,
      `Tu plan de comidas de hoy te espera${coma}.`
    ];
    return { title: `K-ONE · ${nombreDia}`, body: frases[Math.floor(Math.random() * frases.length)], tipo: 'nutricion' };
  }

  const hoy = semana[idx];
  if (!hoy) return null;

  // La ausencia ya no sustituye al contenido del día: se añade delante. Antes
  // un cliente que llevaba una semana sin abrir la app recibía "Hoy es buen día
  // para retomarlo" también el día que su plan dice que descanse.
  const d = Math.round(diasSinEntrar || 0);
  const ausencia = d >= 21 ? `Tres semanas fuera${coma}. `
    : d >= 7 ? `${d} días sin entrar${coma}. `
    : '';
  const saludo = ausencia ? '' : coma;

  if (hoy.tipo === 'Descanso') {
    // Mañana: el día de descanso es justo cuando al cliente le sirve saber
    // qué viene, y es lo que convierte el aviso en algo más que un "descansa".
    const manana = semana[(idx + 1) % 7];
    // Dentro de una frase el "·" de los resúmenes se lee raro ("Mañana toca
    // fuerza · Tren superior"): pasa a "fuerza: tren superior".
    const queManana = manana && manana.tipo !== 'Descanso'
      ? _minuscula(queTocaEnDia(manana).replace(/\s·\s(\S)/g, (m, c) => ': ' + _minuscula(c)))
      : '';
    const cola = queManana ? ` Mañana toca ${queManana}.` : ' Recuperar también es entrenar.';
    return {
      title: `${nombreDia}: Descanso`,
      body: `${ausencia}Hoy toca descansar${saludo}.${cola}`,
      tipo: 'descanso'
    };
  }

  const queToca = queTocaEnDia(hoy);
  const ejercicios = _ejerciciosDelDia(hoy);
  let cuerpo;
  if (ejercicios.length >= 2) {
    const resto = ejercicios.length - 2;
    cuerpo = `Empiezas con ${ejercicios[0]} y ${ejercicios[1]}` +
      (resto > 0 ? `, y ${resto} ${resto === 1 ? 'ejercicio' : 'ejercicios'} más.` : '.');
  } else if (ejercicios.length === 1) {
    cuerpo = `Hoy toca ${ejercicios[0]}.`;
  } else {
    cuerpo = _mayuscula(_primeraFrase(hoy));
    if (cuerpo && !/[.…]$/.test(cuerpo)) cuerpo += '.';
  }
  const apertura = ausencia ? `${ausencia}Vuelve con esta. ` : (nombre ? `${nombre}, a por ello. ` : '');
  // Dos puntos y no "·": varios resúmenes ya llevan su propio punto medio
  // ("Easy run · Zona 2") y el título quedaba "Lunes · Easy run · Zona 2".
  return {
    title: `${nombreDia}: ${_mayuscula(queToca)}`,
    body: `${apertura}${cuerpo}`.trim(),
    tipo: 'entreno'
  };
}

if (typeof module !== 'undefined') module.exports = { avisoDelDia, queTocaEnDia, DIAS };
