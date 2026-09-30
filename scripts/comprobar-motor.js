// Comprobación automática del motor de planes: genera cientos de planes con
// combinaciones distintas de cuestionario (deporte, objetivo, alergias,
// enfermedades, lesiones, dieta, "no como"...) usando el MISMO código de
// index.html que ejecuta el servidor (lib/motor-servidor.js), y falla si:
//   - el motor lanza una excepción,
//   - el plan sale incompleto (días, tomas, platos sin nombre o sin kcal),
//   - Thor (auditarPlan) encuentra un alimento que ese cliente no puede comer.
//
// Uso:   node scripts/comprobar-motor.js [n]      (n = planes al azar, 600 por defecto)
// Lo ejecuta GitHub Actions en cada subida (.github/workflows/comprobar.yml).
// No modifica nada. Semilla fija: si falla, el mismo caso vuelve a fallar.
const fs = require('fs');
const path = require('path');
const { crearMotor } = require('../lib/motor-servidor');
const { auditarPlan } = require('../lib/normalizador-alimentos');
const { analizar } = require('./validar-recetas');
const verMacros = { total: 0, fuera: 0 };

const N = parseInt(process.argv[2], 10) || 600;
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const motor = crearMotor(html);

// Generador con semilla (mulberry32): mismos casos en cada ejecución.
let semilla = 20260930;
function azar() {
  semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const elige = arr => arr[Math.floor(azar() * arr.length)];

const OP = {
  sexo: ['Hombre', 'Mujer'],
  enfermedad: ['No', 'No', 'No', 'Diabetes', 'Hipertensión', 'Problemas cardíacos', 'Otra'],
  lesion: ['No', 'No', 'No', 'Rodilla', 'Espalda', 'Hombro', 'Otra'],
  alergia: ['No', 'No', 'Gluten', 'Lactosa', 'Frutos secos', 'Otra'],
  dieta: ['Como de todo', 'Como de todo', 'Sin gluten', 'Sin lactosa'],
  noComida: ['', '', '', 'pescado azul, coliflor', 'huevo', 'atún, brócoli, garbanzos', 'cerdo'],
  comidas: ['5', '5', '5', '4', '3', '2'],
  objetivo: ['Perder grasa', 'Ganar músculo', 'Mejorar resistencia', 'Preparar una competición', 'Sentirme mejor en general', 'Ganar fuerza'],
  enfoque: ['Equilibrado', 'Alto en proteína', 'Bajo en carbohidratos', 'Flexible / sin restricciones'],
  deporteCompleto: ['Gimnasio / Fuerza', 'Running', 'Híbrido'],
  deporteSolo: ['No especificado', 'Gimnasio / Fuerza', 'Running', 'Hyrox', 'CrossFit', 'Híbrido'],
  dias: ['2 días', '3 días', '4 días', '5+ días'],
  tiempo: ['15-20 min (exprés)', '30-45 min', '45-60 min', '60-90 min', 'Más de 90 min'],
  nivel: ['Principiante, empiezo desde cero', 'Llevo algo de tiempo', 'Avanzado'],
  lugar: ['Gimnasio', 'En casa con material'],
  actividad: ['No entreno / muy poca actividad', 'Ligero (1-2 días/semana)', 'Moderado (3-4 días/semana)', 'Intenso (5+ días/semana)'],
  hora: ['', 'manana', 'mediodia', 'tarde', 'noche', 'varia'],
  jornada: ['Sentado todo el día', 'Mezcla de pie y sentado', 'De pie casi todo el día', 'Trabajo físico intenso'],
};

function perfilAzar() {
  const solo = azar() < 0.35;
  const sexo = elige(OP.sexo);
  const u = {
    edad: String(18 + Math.floor(azar() * 62)),
    sexo,
    peso: String(sexo === 'Hombre' ? 55 + Math.floor(azar() * 70) : 45 + Math.floor(azar() * 60)),
    altura: String(sexo === 'Hombre' ? 160 + Math.floor(azar() * 40) : 150 + Math.floor(azar() * 35)),
    enfermedad: elige(OP.enfermedad), enfermedadOtra: '',
    lesion: elige(OP.lesion), lesionDetalle: '',
    alergia: elige(OP.alergia), alergiaOtra: '',
    tca: azar() < 0.05 ? 'Sí' : 'No',
    operacion: '', medicacion: '', trabajo: '',
    jornada: elige(OP.jornada), estres: 'Medio', sueno: '7-8 horas',
    dieta: elige(OP.dieta), noComida: elige(OP.noComida),
    comidas: elige(OP.comidas), cocina: 'Casi siempre en casa',
    objetivo: elige(OP.objetivo), enfoqueMacros: elige(OP.enfoque),
    evento: '', eventoFecha: '',
    tipoPlan: solo ? 'Solo nutrición, sin entrenamiento' : 'Plan completo: entrenamiento + nutrición',
    deporte: solo ? elige(OP.deporteSolo) : elige(OP.deporteCompleto),
    diasEntreno: elige(OP.dias), tiempoSesion: elige(OP.tiempo),
    horaEntreno: elige(OP.hora),
    diasEntrenoSolo: solo ? [0, 2, 4].slice(0, 1 + Math.floor(azar() * 3)) : [],
    nivel: elige(OP.nivel), lugar: elige(OP.lugar),
    actividadSolo: solo ? elige(OP.actividad) : '',
    marcaDistancia: '', marcaTiempo: '',
  };
  if (u.alergia === 'Otra') u.alergiaOtra = elige(['marisco', 'huevo', 'soja']);
  if (u.enfermedad === 'Otra') u.enfermedadOtra = 'colesterol alto';
  if (u.lesion === 'Otra') u.lesionDetalle = 'tendinitis en el codo';
  return u;
}

// Casos fijos que no pueden faltar (los fallos reales que ya nos han llegado).
function casosFijos() {
  const base = () => ({ ...perfilAzar(), noComida: '', alergia: 'No', enfermedad: 'No', lesion: 'No', dieta: 'Como de todo', comidas: '5', tca: 'No' });
  const con = extra => ({ ...base(), ...extra });
  return [
    con({ enfermedad: 'Hipertensión', objetivo: 'Perder grasa' }),
    con({ enfermedad: 'Hipertensión', tipoPlan: 'Solo nutrición, sin entrenamiento', deporte: 'No especificado', actividadSolo: 'No entreno / muy poca actividad' }),
    con({ enfermedad: 'Problemas cardíacos', deporte: 'Running', tipoPlan: 'Plan completo: entrenamiento + nutrición' }),
    con({ enfermedad: 'Diabetes', deporte: 'Híbrido', tipoPlan: 'Plan completo: entrenamiento + nutrición' }),
    con({ alergia: 'Gluten', dieta: 'Sin gluten' }),
    con({ alergia: 'Lactosa', dieta: 'Sin lactosa' }),
    con({ alergia: 'Frutos secos' }),
    con({ alergia: 'Otra', alergiaOtra: 'marisco' }),
    con({ noComida: 'pescado azul, coliflor, atún' }),
    con({ tca: 'Sí', objetivo: 'Perder grasa' }),
    con({ comidas: '2' }), con({ comidas: '3' }), con({ comidas: '4' }),
    con({ tipoPlan: 'Solo nutrición, sin entrenamiento', deporte: 'CrossFit', actividadSolo: 'Intenso (5+ días/semana)', diasEntrenoSolo: [0, 1, 3, 4, 5], horaEntreno: 'tarde' }),
    con({ tipoPlan: 'Solo nutrición, sin entrenamiento', deporte: 'Hyrox', actividadSolo: 'Moderado (3-4 días/semana)', diasEntrenoSolo: [1, 3, 5], horaEntreno: 'manana' }),
  ];
}

function revisar(u) {
  const fallos = [];
  let plan;
  try { plan = motor.generar(u); } catch (e) { return ['el motor lanzó una excepción: ' + e.message]; }
  const dias = plan.nutricionPorDia;
  if (!Array.isArray(dias) || dias.length !== 7) fallos.push('nutricionPorDia no tiene 7 días');
  else {
    dias.forEach((tomas, d) => {
      if (!Array.isArray(tomas) || tomas.length < 2) { fallos.push(`día ${d + 1}: menos de 2 tomas`); return; }
      tomas.forEach(t => {
        if (!t.opciones || !t.opciones.length) fallos.push(`día ${d + 1}, ${t.momento}: toma sin opciones`);
        (t.opciones || []).forEach(o => {
          if (!o.nombre) fallos.push(`día ${d + 1}, ${t.momento}: plato sin nombre`);
          // Las cifras son texto ("579 kcal", "47g prot"): se lee el número.
          const num = v => parseFloat(String(v || '').replace(',', '.'));
          if (!(num(o.kcal) > 0)) fallos.push(`día ${d + 1}, ${t.momento}, «${o.nombre}»: sin kcal`);
          if (!(num(o.prot) >= 0) || !(num(o.carbs) >= 0) || !(num(o.grasa) >= 0)) fallos.push(`día ${d + 1}, ${t.momento}, «${o.nombre}»: faltan macros`);
          if (!o.ingredientes) fallos.push(`día ${d + 1}, ${t.momento}, «${o.nombre}»: sin ingredientes`);
          // "0,5 scoop" se parte en "0" y "5 scoop" (la lista va separada por comas).
          else if (o.ingredientes.split(',').some(x => /^\s*\d+\s*$/.test(x))) fallos.push(`«${o.nombre}»: una cantidad partida por una coma (${o.ingredientes})`);
          // Lo que verá el cliente en "Ver macros": suma de ingredientes frente a la etiqueta.
          else {
            const a = analizar(o.ingredientes);
            if (!a.sinDatos.length && a.kcal >= 80) { verMacros.total++; if (Math.abs(num(o.kcal) / a.kcal - 1) > 0.15) verMacros.fuera++; }
          }
        });
      });
    });
  }
  if (!plan.motorVersion) fallos.push('el plan no lleva motorVersion');
  if (!plan.soloDieta && (!Array.isArray(plan.semana) || plan.semana.length !== 7)) fallos.push('el plan completo no tiene 7 días de semana');
  if (!(plan.kcalObj > 1000 && plan.kcalObj < 6000)) fallos.push('kcal objetivo fuera de rango: ' + plan.kcalObj);
  try {
    const hallazgos = auditarPlan(u, plan);
    hallazgos.slice(0, 3).forEach(h => fallos.push(`Thor: ${h.coincidencia} en «${h.plato}» (${h.motivo})`));
  } catch (e) { fallos.push('auditarPlan lanzó: ' + e.message); }
  return fallos;
}

const casos = [...casosFijos(), ...Array.from({ length: N }, perfilAzar)];
let malos = 0;
const t0 = Date.now();
casos.forEach((u, i) => {
  const f = revisar(u);
  if (f.length) {
    malos++;
    if (malos <= 8) {
      console.log(`\n✘ caso ${i + 1}/${casos.length}: ${u.tipoPlan.startsWith('Solo') ? 'SOLO NUTRICIÓN' : 'COMPLETO'} · ${u.deporte} · ${u.objetivo} · enf=${u.enfermedad} · alergia=${u.alergia}${u.alergiaOtra ? '(' + u.alergiaOtra + ')' : ''} · dieta=${u.dieta} · noComida="${u.noComida}" · comidas=${u.comidas}`);
      f.slice(0, 4).forEach(x => console.log('    - ' + x));
    }
  }
});
console.log(`\n${casos.length} planes generados en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${malos === 0 ? '✔ todos correctos' : '✘ ' + malos + ' con fallos'}`);
// "Ver macros" le dice al cliente si las cantidades suman lo que pone el plato:
// hasta el 30 sept 2026 no cuadraba en el 45 % de los platos (ver
// _conciliar en index.html). Se tolera un 10 % (medidas caseras, redondeos).
const pctFuera = verMacros.total ? verMacros.fuera / verMacros.total : 0;
const verMacrosMal = pctFuera > 0.10;
console.log(`${verMacrosMal ? '✘' : '✔'} "Ver macros" cuadra con la etiqueta (±15 %) en el ${(100 - pctFuera * 100).toFixed(1)} % de ${verMacros.total} platos (mínimo 90 %)`);
process.exit(malos || verMacrosMal ? 1 : 0);
