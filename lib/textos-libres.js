// ============================================================================
// TEXTOS LIBRES INTERPRETADOS (1 nov 2026, aprobado por Rafa)
//
// Lo que el cliente escribe a mano («me operaron del menisco», «celíaca»,
// «tomo enalapril») solo lo entendía el motor si usaba sus palabras. Una IA
// (lib/interpretar-textos.js, apagada sin ANTHROPIC_API_KEY) lo lee y lo
// traduce a un VOCABULARIO CERRADO que el motor ya sabe tratar; el resultado
// se guarda en userdata._ia y el motor lo SUMA a lo que el cliente marcó.
//
// Reglas que no se pueden romper:
//  · La IA solo puede AÑADIR restricciones, nunca quitar: lo peor que puede
//    pasar si se equivoca es un plan más prudente de la cuenta.
//  · Solo vale para los textos con los que se generó (_ia.h = huella de los
//    textos): si el cliente los cambia, se ignora hasta volver a preguntar.
//  · Nada fuera del vocabulario llega al motor (se filtra aquí y en el servidor).
//
// COPIA EXACTA en app.js (_IA_VOCAB, _huellaTextosLibres y
// _conTextosInterpretados): scripts/auditar-entreno.js las compara y falla si
// se separan. Jarvis (lib/normalizador-alimentos.js) usa esta para auditar con
// las mismas alergias que ha aplicado el motor.
// ============================================================================

const _IA_VOCAB = {
  lesion: ['rodilla', 'espalda', 'hombro', 'tobillo', 'cadera'],
  alergias: ['gluten', 'lactosa', 'leche', 'frutos secos', 'cacahuete', 'marisco', 'crustaceos', 'moluscos', 'pescado', 'huevo', 'soja', 'sesamo', 'mostaza', 'apio', 'sulfitos', 'altramuz'],
  enfermedades: ['hipertension', 'diabetes', 'cardiaco', 'osteoporosis', 'artrosis'],
};
function _huellaTextosLibres(u) {
  const s = JSON.stringify(['lesionDetalle', 'enfermedadOtra', 'alergiaOtra', 'noComida', 'medicacion', 'operacion'].map(k => String((u && u[k]) || '').trim()));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function _conTextosInterpretados(u) {
  const ia = u && u._ia;
  if (!ia || ia.v !== 1 || ia.h !== _huellaTextosLibres(u)) return u;
  const solo = (lista, vocab) => (Array.isArray(lista) ? lista : []).filter(x => vocab.includes(x));
  const lesion = solo(ia.lesion, _IA_VOCAB.lesion);
  const alergias = solo(ia.alergias, _IA_VOCAB.alergias);
  const enf = solo(ia.enfermedades, _IA_VOCAB.enfermedades);
  if (!lesion.length && !alergias.length && !enf.length) return u;
  const r = { ...u };
  if (lesion.length) r.lesionDetalle = [u.lesionDetalle || '', ...lesion].join(' ').trim();
  if (alergias.length) {
    // La alergia del desplegable es una sola: pasa a «Otra» con todo junto en el
    // texto, que el motor ya reconoce (gluten, lactosa y frutos secos incluidos).
    const marcada = u.alergia && u.alergia !== 'No' && u.alergia !== 'Otra' ? u.alergia : '';
    r.alergia = 'Otra';
    r.alergiaOtra = [marcada, u.alergia === 'Otra' ? (u.alergiaOtra || '') : '', ...alergias].filter(Boolean).join(', ');
  }
  if (enf.length) {
    const ETQ = { hipertension: 'Hipertensión', diabetes: 'Diabetes', cardiaco: 'Problemas cardíacos' };
    const base = u.enfermedad && u.enfermedad !== 'No' ? u.enfermedad : '';
    const otras = enf.filter(x => !ETQ[x]);
    r.enfermedad = [base, ...enf.filter(x => ETQ[x] && !base.includes(ETQ[x])).map(x => ETQ[x]), otras.length && !base.includes('Otra') ? 'Otra' : ''].filter(Boolean).join(' · ');
    if (otras.length) r.enfermedadOtra = [u.enfermedadOtra || '', ...otras].join(' ').trim();
  }
  return r;
}

module.exports = { _IA_VOCAB, _huellaTextosLibres, _conTextosInterpretados };
