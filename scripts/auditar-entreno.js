// ============================================================================
// AUDITORÍA FIJA DE ENTRENAMIENTO (1 nov 2026)
//
// Lo que se comprobó a mano el 1 nov 2026 y no puede volver a romperse sin
// que salte aquí. Genera planes reales con el MISMO motor que la app, SOLO con
// combinaciones que ofrece el formulario (Running: aire libre o cinta; Híbrido:
// gimnasio + exterior o casa), y busca con listas PROPIAS:
//
//  1. Lesiones marcadas y escritas a mano (rodilla, menisco, lumbalgia, hernia,
//     manguito, tobillo, fascitis, periostitis...): nada de saltos, sprints ni
//     los ejercicios que cargan la zona; tampoco en el título del día.
//  2. Osteoporosis o artrosis en «Otra enfermedad»: sin saltos.
//  3. Tensión alta y corazón: sin HIIT, sprints, tabata ni metcons.
//  4. Material: en casa nada de máquinas ni poleas; sin material, ni pesas.
//  5. Principiante: nada de movimientos avanzados.
//  6. Semana de carrera: «Día de carrera» el día que toca, víspera suave y
//     sin fuerza, saltos ni tirada larga de 2 a 7 días antes.
//  7. Días pedidos, días repetidos, ejercicio repetido en la sesión, títulos
//     en inglés y textos rotos.
//  8. El plan lleva la semana y el lunes con que se generó (la app lo rehace
//     al cambiar de semana).
//
// Uso: node scripts/auditar-entreno.js  (entra en `npm test`; sale con código 1
// si algo falla). Tarda ~45 s.
// ============================================================================
const { crearMotor } = require('../lib/motor-servidor');
const motor = crearMotor(require('../lib/fuente-app').leerFuente());

const BASE = { edad: '35', sexo: 'Hombre', peso: '78', altura: '178', enfermedad: 'No', enfermedadOtra: '', lesion: 'No', lesionDetalle: '', alergia: 'No', alergiaOtra: '', tca: 'No', dieta: 'Como de todo', noComida: '', comidas: '5', objetivo: 'Perder grasa', enfoqueMacros: 'Equilibrado', evento: '', eventoFecha: '', tipoPlan: 'Plan completo: entrenamiento + nutrición', deporte: 'Running', diasEntreno: '4 días', tiempoSesion: '45-60 min', horaEntreno: 'tarde', nivel: 'Llevo algo de tiempo', lugar: 'Al aire libre' };
const gen = u => motor.generar({ ...BASE, ...u });
const N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let sem = 11;
const azar = () => { sem = (sem * 1103515245 + 12345) % 2147483648; return sem / 2147483648; };
const el = arr => arr[Math.floor(azar() * arr.length)];

const LUGAR = { 'Gimnasio / Fuerza': ['Gimnasio', 'En casa con material', 'En casa sin material'], 'Running': ['Al aire libre', 'Cinta / Interior'], 'Híbrido': ['Gimnasio + exterior', 'En casa con material'] };
const OP = {
  deporte: ['Gimnasio / Fuerza', 'Gimnasio / Fuerza', 'Running', 'Híbrido'],
  nivel: ['Principiante, empiezo desde cero', 'Llevo algo de tiempo', 'Avanzado'], dias: ['2 días', '3 días', '4 días', '5+ días'],
  tiempo: ['15-20 min (exprés)', '30-45 min', '45-60 min', '60-90 min', 'Más de 90 min'],
  objetivo: ['Perder grasa', 'Ganar músculo', 'Mejorar resistencia', 'Preparar una competición', 'Sentirme mejor en general', 'Ganar fuerza'],
  lesion: [['No', ''], ['No', ''], ['Rodilla', ''], ['Espalda', ''], ['Hombro', ''],
    ['Otra', 'me duele la rodilla al bajar escaleras'], ['Otra', 'rotura de menisco'], ['Otra', 'condromalacia rotuliana'],
    ['Otra', 'hernia discal lumbar'], ['Otra', 'lumbalgia'], ['Otra', 'tendinitis en el hombro derecho'], ['Otra', 'manguito rotador'],
    ['Otra', 'esguince de tobillo'], ['Otra', 'fascitis plantar'], ['Otra', 'periostitis tibial'], ['Otra', 'dolor de cadera']],
  enfermedad: [['No', ''], ['No', ''], ['Problemas cardíacos', ''], ['Hipertensión', ''], ['Diabetes', ''], ['Otra', 'asma'], ['Otra', 'osteoporosis'], ['Otra', 'artrosis']],
  semana: [1, 2, 3, 4, 5, 8, 11],
};
const B = '(?<![a-z])';
const CHK = {
  casa: new RegExp(B + '(maquina|polea|prensa|multipower|smith|jalon(?! con banda)|barra z|contractora|hack|cinta(?! elastica)|eliptica|ergometro|banco scott|predicador|assault|ski ?erg|trineo)'),
  sinmat: new RegExp(B + '(mancuernas?|kettlebell|pesa rusa|barra(?! de cocina)|bandas?|goma elastica|disco|trx|lastre)'),
  rodilla: new RegExp(B + '(saltos?(?! a la comba suave)|saltad|pliometr|burpees?|box jump|jump|pistol|skipping|comba|sprints?|tuck|zancadas? con salto|sentadilla profunda)'),
  // Caminar en cuesta no es impacto; correr en cuestas en Running se queda (es su deporte).
  impacto: new RegExp(B + '(saltos?|saltad|pliometr|burpees?|box jump|jump|comba|sprints?)'),
  espalda: new RegExp(B + '(peso muerto(?! rumano con mancuernas)|buenos dias|good morning|sentadilla (?:trasera )?con barra|remo con barra|swing|cargadas? de potencia|clean|snatch|thruster|hiperextension)'),
  hombro: new RegExp(B + '(press (?:militar|de hombros?|arnold|por encima|tras nuca)|fondos|dips|remo al menton|pino|handstand|push press|snatch|muscle.?up|press de banca con barra|pull.?over)'),
  principiante: new RegExp(B + '(pistol|muscle.?up|nordic|nordico|handstand|pino|snatch|dragon flag|front lever|l-sit|dominadas lastradas|clean)'),
  corazon: new RegExp(B + '(sprints?|hiit|tabata|al maximo|a tope|rpe ?(?:9|10)|fartlek|cuestas? (?:fuertes|a tope)|metcon|amrap|emom)'),
  texto: /(?<![a-záéíóúñ])([a-záéíóúñ]{3,})\s+\1(?![a-záéíóúñ])|undefined|NaN|\[object|mancuernass|con mancuernas? con (?:barra|polea|m[aá]quina)|en m[aá]quina con mancuernas|\(\s*\)|,,|\s,|\.\.(?!\.)/,
  ingles: /\b(easy run|recovery run|long run|tempo run)\b/i,
};
const EXENTO = /sin salto|\(sin |evita|nada de|sin impacto|no hagas|sustituye|en lugar de|en vez de/;

const fallos = [];
const falla = (seccion, txt) => { if (fallos.filter(f => f.startsWith(seccion)).length < 10) fallos.push(seccion + ' · ' + txt); else fallos.push(seccion); };
let nPlanes = 0;

// ── 1-5 y 7: barrido ──
for (let i = 0; i < 900; i++) {
  const [lesion, lesionDetalle] = el(OP.lesion); const [enfermedad, enfermedadOtra] = el(OP.enfermedad);
  const deporte = el(OP.deporte);
  const u = { deporte, lugar: el(LUGAR[deporte]), nivel: el(OP.nivel), diasEntreno: el(OP.dias), tiempoSesion: el(OP.tiempo), objetivo: el(OP.objetivo), lesion, lesionDetalle, enfermedad, enfermedadOtra, progreso: { semana: el(OP.semana), diasEntrenados: 0, ajuste: 0 }, sexo: el(['Hombre', 'Mujer']), edad: String(18 + Math.floor(azar() * 60)) };
  if (deporte === 'Running' && /Ganar m|Ganar fuerza/.test(u.objetivo)) u.objetivo = 'Mejorar resistencia';
  let p; try { p = gen(u); } catch (e) { falla('excepción', e.message); continue; }
  nPlanes++;
  const quien = `${u.deporte}/${u.lugar}/${u.nivel.split(',')[0]}/${u.objetivo}/lesión ${u.lesion}${lesionDetalle ? ' «' + lesionDetalle + '»' : ''}/${u.enfermedad}${enfermedadOtra ? ' «' + enfermedadOtra + '»' : ''}/${u.edad} años/sem ${u.progreso.semana}`;
  if (p.semanaPlan !== u.progreso.semana || !/^\d{4}-\d\d-\d\d$/.test(p.lunesPlan || '')) falla('semana del plan', `semanaPlan=${p.semanaPlan} lunesPlan=${p.lunesPlan} (${quien})`);
  const pedidos = Math.min(5, parseInt(u.diasEntreno, 10));
  const entreno = (p.semana || []).filter(d => d.tipo !== 'Descanso').length;
  if (Math.abs(entreno - pedidos) > 1) falla('días pedidos', `pide ${u.diasEntreno}, tiene ${entreno} (${quien})`);
  const L = N(u.lesion + ' ' + lesionDetalle);
  const zonas = {
    rodilla: /rodilla|menisco|rotulian|condromalacia/.test(L),
    impacto: /tobillo|fascitis|plantar|periostitis|tibial|cadera/.test(L) || /osteoporosis|artrosis/.test(enfermedadOtra),
    espalda: /espalda|lumbar|hernia|lumbalgia/.test(L),
    hombro: /hombro|manguito/.test(L),
    casa: /casa/i.test(u.lugar), sinmat: /sin material/i.test(u.lugar),
    principiante: /Principiante/.test(u.nivel), corazon: /card|Hiper/.test(u.enfermedad),
  };
  const vistos = new Map();
  for (const d of p.semana || []) {
    if (d.tipo === 'Descanso') continue;
    const tr = N(d.detalle), tit = N(d.resumen);
    if (!d.detalle || d.detalle.length < 25) falla('día vacío', `${d.dia}: ${d.resumen} (${quien})`);
    if (vistos.has(d.detalle) && d.detalle.length > 60) falla('dos días iguales', `${d.dia} = ${vistos.get(d.detalle)} (${quien})`);
    vistos.set(d.detalle, d.dia);
    for (const [k, activo] of Object.entries(zonas)) {
      if (!activo) continue;
      // Running con perfil sin impacto: la carrera sigue (sprints y cuestas son su deporte).
      if (k === 'impacto' && u.deporte === 'Running' && d.etiqueta !== 'Fortalecimiento') continue;
      const mt = tit.match(CHK[k]); if (mt) falla(k + ' (título)', `${d.dia}: «${d.resumen}» (${quien})`);
      const m = tr.match(CHK[k]);
      if (m && !EXENTO.test(tr.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)))
        falla(k, `${d.dia}: «…${d.detalle.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)}…» (${quien})`);
    }
    const full = d.resumen + ' · ' + d.detalle;
    const mx = full.match(CHK.texto); if (mx) falla('texto roto', `«${mx[0]}» en ${d.dia}: ${full.slice(Math.max(0, mx.index - 40), mx.index + 40)} (${quien})`);
    if (CHK.ingles.test(d.resumen)) falla('título en inglés', `${d.dia}: «${d.resumen}» (${quien})`);
    const ejer = d.detalle.split(' · ').slice(1).join(' · ').split(/,\s*(?![^()]*\))/).map(x => N(x).replace(/\d+\s*[×x]\s*\d+.*$/, '').replace(/\(.*?\)/g, '').trim()).filter(x => x.length > 4);
    const rep = ejer.find((x, j) => ejer.indexOf(x) !== j); if (rep) falla('ejercicio repetido', `${d.dia}: ${rep} (${quien})`);
  }
}

// ── 6: semana de carrera. El motor cuenta desde HOY, así que se prueba con el
// reloj puesto en cada día de una semana (lunes 2 a domingo 8 nov 2026, 10:00) y
// la carrera de 0 a 13 días después: así sale en cualquier posición de la semana.
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
for (let hoyIdx = 0; hoyIdx < 7; hoyIdx++) {
 const hoy = new Date(2026, 10, 2 + hoyIdx, 10, 0, 0);
 const motorDia = crearMotor(require('../lib/fuente-app').leerFuente(), { ahora: hoy.getTime() });
 for (const nivel of ['Principiante, empiezo desde cero', 'Avanzado']) {
  for (let k = 0; k <= 13; k++) {
    const f = new Date(hoy); f.setDate(f.getDate() + k);
    const p = motorDia.generar({ ...BASE, nivel, diasEntreno: '5+ días', tiempoSesion: '60-90 min', objetivo: 'Preparar una competición', evento: 'Media maratón', eventoFecha: iso(f), progreso: { semana: 3, diasEntrenados: 0, ajuste: 0 } });
    nPlanes++;
    if (p.diasParaEvento !== k) falla('semana de carrera', `diasParaEvento=${p.diasParaEvento}, esperaba ${k}`);
    (p.semana || []).forEach((d, i) => {
      const falta = k - (i - hoyIdx);
      const ctx = `${nivel.split(',')[0]}, carrera en ${k} días, ${d.dia} (faltan ${falta}): «${d.resumen}»`;
      if (falta === 0 && !/^Día de carrera/.test(d.resumen)) falla('semana de carrera', 'el día de la carrera no lo dice: ' + ctx);
      if (falta !== 0 && /^Día de carrera/.test(d.resumen)) falla('semana de carrera', '«Día de carrera» en otro día: ' + ctx);
      if (falta === 1 && d.tipo !== 'Descanso') falla('semana de carrera', 'la víspera no es suave: ' + ctx);
      if (falta >= 2 && falta <= 7 && (d.etiqueta === 'Fortalecimiento' || /pliometr|tirada larga|umbral|series/i.test(d.resumen)))
        falla('semana de carrera', 'fuerza, saltos o carga a pocos días: ' + ctx);
    });
  }
 }
}

const unicos = [...new Set(fallos)];
if (unicos.length) {
  console.log(`\n✘ auditar-entreno: ${unicos.length} fallos (${nPlanes} planes)`);
  unicos.forEach(f => console.log('   ' + f));
  process.exit(1);
}
console.log(`✔ auditar-entreno: lesiones, impacto, material, nivel, corazón, semana de carrera y textos sin fallos (${nPlanes} planes)`);
