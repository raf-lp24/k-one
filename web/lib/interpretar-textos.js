// ============================================================================
// IA QUE LEE LOS TEXTOS LIBRES DEL CUESTIONARIO (1 nov 2026, aprobado por Rafa)
//
// Traduce lo que el cliente escribió a mano a un vocabulario cerrado
// (lib/textos-libres.js). APAGADA mientras no exista ANTHROPIC_API_KEY en
// Vercel: interpretarTextos() devuelve null y todo sigue como siempre.
//
// Qué se envía a Anthropic: SOLO los seis textos libres (lesión, otra
// enfermedad, otra alergia, «no como», medicación y operaciones). Ni nombre,
// ni email, ni peso, ni ningún identificador.
//
// La IA no hace el plan ni elige platos o ejercicios: solo marca categorías
// que el motor ya trata, y solo puede AÑADIR restricciones (ver textos-libres).
// ============================================================================
const Anthropic = require('@anthropic-ai/sdk');
const { _IA_VOCAB, _huellaTextosLibres } = require('./textos-libres');

const CAMPOS = { lesionDetalle: 'Lesión o molestia', enfermedadOtra: 'Otra enfermedad', alergiaOtra: 'Otra alergia o intolerancia', noComida: 'Alimentos que no come', medicacion: 'Medicación', operacion: 'Operaciones' };

const SISTEMA = `Clasificas los textos libres que escribe un cliente en el cuestionario de una app de entrenamiento y nutrición en España. El texto puede tener faltas, abreviaturas, nombres comerciales de medicamentos o lenguaje coloquial.

Devuelve SOLO las categorías que el texto indica de forma clara, directamente o por deducción médica evidente:
- lesion: zona lesionada, operada o con dolor (menisco, ligamento cruzado o rótula = rodilla; hernia discal, lumbalgia o ciática = espalda; manguito rotador o luxación de hombro = hombro; esguince, fascitis plantar, Aquiles o periostitis = tobillo; prótesis de cadera o artrosis de cadera = cadera).
- alergias: alergias o intolerancias alimentarias (celiaquía = gluten; intolerancia a la lactosa = lactosa; alergia a la proteína de la leche o APLV = leche; gambas, langostinos o cangrejo = crustaceos; mejillones, calamar o pulpo = moluscos; anisakis = pescado).
- enfermedades: tensión alta o fármacos para ella (enalapril, losartán, amlodipino...) = hipertension; diabetes o fármacos para ella (metformina, insulina...) = diabetes; problemas de corazón, arritmia, infarto, stent, anticoagulantes por el corazón o betabloqueantes por el corazón = cardiaco; osteoporosis u osteopenia = osteoporosis; artrosis = artrosis.

Reglas: si algo no encaja en ninguna categoría, no lo pongas. No marques una alergia solo porque un alimento no le guste. Un «no» o un texto vacío no es nada. Ante la duda razonable sobre algo de salud que sí aparece en el texto, márcalo: el plan solo se vuelve más prudente.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    lesion: { type: 'array', items: { type: 'string', enum: _IA_VOCAB.lesion } },
    alergias: { type: 'array', items: { type: 'string', enum: _IA_VOCAB.alergias } },
    enfermedades: { type: 'array', items: { type: 'string', enum: _IA_VOCAB.enfermedades } },
  },
  required: ['lesion', 'alergias', 'enfermedades'],
  additionalProperties: false,
};

const iaActiva = () => !!process.env.ANTHROPIC_API_KEY;

// Devuelve { v, h, lesion, alergias, enfermedades, fecha } listo para guardar en
// userdata._ia, o null si está apagada, no hay nada escrito o algo falla (en ese
// caso el plan sigue exactamente como sin IA).
async function interpretarTextos(userData, { cliente } = {}) {
  if (!cliente && !iaActiva()) return null;
  const u = userData || {};
  const textos = Object.entries(CAMPOS)
    .map(([k, etq]) => [etq, String(u[k] || '').trim().slice(0, 500)])
    .filter(([, t]) => t && !/^(no|ninguna?|nada|-)$/i.test(t));
  const h = _huellaTextosLibres(u);
  const vacio = { v: 1, h, lesion: [], alergias: [], enfermedades: [], fecha: new Date().toISOString() };
  if (!textos.length) return vacio;
  const client = cliente || new Anthropic({ timeout: 20000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: textos.map(([etq, t]) => `${etq}: ${t}`).join('\n') }],
  });
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
  const bloque = (res.content || []).find(b => b.type === 'text');
  if (!bloque) return null;
  let datos;
  try { datos = JSON.parse(bloque.text); } catch (e) { return null; }
  // Doble filtro: aunque el esquema ya lo obliga, nada fuera del vocabulario.
  const solo = (lista, vocab) => [...new Set((Array.isArray(lista) ? lista : []).filter(x => vocab.includes(x)))];
  return { ...vacio, lesion: solo(datos.lesion, _IA_VOCAB.lesion), alergias: solo(datos.alergias, _IA_VOCAB.alergias), enfermedades: solo(datos.enfermedades, _IA_VOCAB.enfermedades) };
}

module.exports = { interpretarTextos, iaActiva, CAMPOS };
