// ============================================================================
// RECÁLCULO DE HITOS EN SERVIDOR
//
// El objeto `userdata` de profiles lo escribe el navegador, así que su mapa
// `hitos` no es de fiar para dar dinero. Aquí se recalculan los hitos desde
// cero a partir de los datos crudos, pero ACOTANDO cada señal con límites que
// solo conoce el backend:
//
//   · la antigüedad real de la cuenta (Supabase Auth, no manipulable)
//   · los referidos pagados (tabla `referidos`, la escribe el webhook)
//   · las fechas de entreno se validan: sin futuros, sin anteriores al alta
//     y sin duplicados del mismo día
//
// Así, inflar el JSON del perfil no basta: para llegar a los niveles con
// premio hay que dejar pasar semanas reales Y estar pagando la suscripción.
// ============================================================================

const DIA_MS = 86400000;

// Fechas de entreno válidas y únicas (formato YYYY-MM-DD), dentro del periodo
// que va del alta de la cuenta a hoy. Devuelve un Set ordenable.
function fechasEntrenoValidas(userdata, altaMs) {
  const hoyMs = Date.now();
  const raw = Array.isArray(userdata.historialEntrenos) ? userdata.historialEntrenos : [];
  const validas = new Set();
  for (const f of raw) {
    if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    const t = Date.parse(f + 'T12:00:00Z');
    if (isNaN(t)) continue;
    if (t > hoyMs + DIA_MS) continue;          // no se entrena en el futuro
    if (t < altaMs - DIA_MS) continue;          // ni antes de tener cuenta
    validas.add(f);
  }
  return validas;
}

// Racha de días consecutivos, con la misma lógica que la web pero sobre las
// fechas ya validadas.
function rachaDesdeFechas(setFechas) {
  if (setFechas.size === 0) return 0;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cursor = new Date();
  if (!setFechas.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
  let racha = 0;
  while (setFechas.has(iso(cursor))) {
    racha++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

/**
 * Recalcula los hitos conseguidos de forma verificable.
 * @param {object} userdata         profiles.userdata (datos del cliente)
 * @param {string} createdAt        fecha de alta real (auth user.created_at)
 * @param {number} referidosPagados nº de referidos pagados (tabla referidos)
 * @returns {{claves: string[], total: number, semanas: number, entrenos: number}}
 */
// Hitos que exigen entrenar con nosotros (sesiones, rachas, cargas). Un cliente de
// solo nutrición no puede conseguirlos: no cuentan para él, y sus umbrales de
// nivel se escalan a los hitos que sí puede conseguir (ver NIVELES_PREMIO_SOLO
// en _hitosReward.js). Misma lista que HITOS_SOLO_EXCLUIDOS en index.html.
const HITOS_ENTRENO = [
  'primer_entreno', 'tres_entrenos', 'diez_entrenos', 'racha5', 'la_vuelta', 'veinte_entrenos',
  'racha14', 'cincuenta', 'cien', 'doscientos', 'primer_feedback_entreno', 'primer_peso',
  'progresion_peso', 'diez_pct_fuerte', 'cinco_ejercicios_reg', 'racha21', 'racha30', 'trescientos',
];

function contarHitosVerificados(userdata, createdAt, referidosPagados, soloNutricion) {
  const u = userdata || {};
  const altaMs = Date.parse(createdAt) || Date.now();
  const semanasReales = Math.floor((Date.now() - altaMs) / (7 * DIA_MS)) + 1;

  // La semana del plan nunca puede ir por delante de la antigüedad real.
  const semanas = Math.max(1, Math.min(Number(u.progreso?.semana) || 1, semanasReales));

  // Entrenos: se cuentan las fechas válidas y únicas; además no puede haber
  // más entrenos que días transcurridos desde el alta.
  const fechas = fechasEntrenoValidas(u, altaMs);
  const diasDesdeAlta = Math.max(1, Math.floor((Date.now() - altaMs) / DIA_MS) + 1);
  // OJO: nunca usar userData.entrenosCompletados como fallback aquí — es un array
  // que escribe el navegador sin pasar por el servidor, y un cliente podría
  // rellenarlo a mano para fabricar hitos falsos. Solo cuentan las fechas
  // verificadas de historialEntrenos, aunque sean 0.
  const totalEntrenos = Math.min(fechas.size, diasDesdeAlta);
  const racha = Math.min(rachaDesdeFechas(fechas), diasDesdeAlta);

  // Fotos: como mucho una por mes transcurrido (+1 de margen).
  const fotosObj = (() => {
    if (!u.fotosProgreso) return {};
    if (Array.isArray(u.fotosProgreso)) {
      const o = {}; u.fotosProgreso.forEach((f, i) => { if (f) o[i + 1] = f; }); return o;
    }
    return u.fotosProgreso;
  })();
  const mesesDesdeAlta = Math.floor(diasDesdeAlta / 30) + 1;
  const numFotos = Math.min(Object.values(fotosObj).filter(Boolean).length, mesesDesdeAlta);

  // historial[].fecha se valida con el mismo criterio que historialEntrenos
  // (dentro de [alta, hoy]) -- sin esto, primer_peso/progresion_peso/
  // diez_pct_fuerte/cinco_ejercicios_reg se sacaban con un solo UPDATE a
  // userdata vía REST (con el propio JWT del cliente), sin haber registrado
  // ningún peso real: `pesosEjercicios` solo necesitaba tener claves, y las
  // comparaciones de progresión no comprobaban fecha alguna.
  const fechaValida = (f, altaMs) => {
    if (!f) return false;
    const t = Date.parse(f);
    if (isNaN(t)) return false;
    return t <= Date.now() + DIA_MS && t >= altaMs - DIA_MS;
  };
  const pesos   = (u.pesosEjercicios && typeof u.pesosEjercicios === 'object') ? u.pesosEjercicios : {};
  const hist    = (e) => (e && Array.isArray(e.historial)) ? e.historial.filter(x => x && fechaValida(x.fecha, altaMs)) : [];
  const pesosConHistorialValido = Object.values(pesos).filter(e => hist(e).length >= 1);
  const nPesos  = pesosConHistorialValido.length;
  const subio   = pesosConHistorialValido.some(e => { const h = hist(e); return h.length >= 2 && Math.max(...h.map(x => Number(x.peso) || 0)) > (Number(h[0].peso) || 0); });
  const subio10 = pesosConHistorialValido.some(e => { const h = hist(e); return h.length >= 2 && Number(h[0].peso) > 0 && Math.max(...h.map(x => Number(x.peso) || 0)) >= Number(h[0].peso) * 1.10; });

  const numNotas = Array.isArray(u.notas) ? u.notas.length : 0;

  // Kilos hacia el objetivo: antes salía de u.peso/u.pesoActual, dos números
  // sueltos sin ningún histórico -- se podían fijar a cualquier valor con un
  // solo UPDATE. Ahora sale de historialPeso (registrado en cada check-in
  // semanal, ver index.html), acotado a entradas con fecha válida: el primer
  // y el último valor verificado marcan el "antes" y el "después".
  const kilos = (() => {
    const histPeso = (Array.isArray(u.historialPeso) ? u.historialPeso : [])
      .filter(x => x && Number(x.peso) > 0 && fechaValida(x.fecha, altaMs))
      .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
    if (histPeso.length < 2) return 0;
    const ini = Number(histPeso[0].peso), act = Number(histPeso[histPeso.length - 1].peso);
    const o = u.objetivo || '';
    if (o.includes('Perder') || o.includes('grasa')) return ini - act;
    if (o.includes('Ganar') || o.includes('músculo')) return act - ini;
    return 0;
  })();

  // Semanas con los 7 días de comida confirmados: contador que escribe el cliente,
  // acotado por las semanas reales de cuenta (como el resto de señales).
  const semNutri = Math.min(Math.max(0, Math.floor(Number(u.semanasNutricionCompletas) || 0)), semanasReales);

  // Pesajes: entradas de historialPeso con fecha válida, una por día como mucho.
  const pesajes = new Set(
    (Array.isArray(u.historialPeso) ? u.historialPeso : [])
      .filter(x => x && Number(x.peso) > 0 && fechaValida(x.fecha, altaMs))
      .map(x => String(x.fecha).slice(0, 10))
  ).size;

  // "La vuelta": una racha de 5+ días ya cerrada y, después, otra vez a entrenar.
  // Mismo criterio que _huboVueltaTrasRacha() de index.html, sobre fechas validadas.
  const huboVuelta = (() => {
    const orden = [...fechas].sort();
    if (orden.length < 2) return false;
    const largos = [];
    let ini = 0;
    for (let i = 1; i <= orden.length; i++) {
      const seguido = i < orden.length && (Date.parse(orden[i] + 'T12:00:00Z') - Date.parse(orden[i - 1] + 'T12:00:00Z')) === DIA_MS;
      if (!seguido) { largos.push(i - ini); ini = i; }
    }
    return largos.slice(0, -1).some(len => len >= 5);
  })();

  // Descuento por referidos: de la tabla `referidos`, no del cliente.
  const descuentoRef = Math.min((referidosPagados || 0) * 5, 15);

  const reglas = {
    primer_entreno:       totalEntrenos >= 1,
    tres_entrenos:        totalEntrenos >= 3,
    semana1:              semanas >= 2,
    primer_foto:          numFotos >= 1,
    diez_entrenos:        totalEntrenos >= 10,
    racha5:               racha >= 5,
    mes1:                 semanas >= 5,
    veinte_entrenos:      totalEntrenos >= 20,
    mes2:                 semanas >= 9,
    racha14:              racha >= 14,
    mes3:                 semanas >= 13,
    cincuenta:            totalEntrenos >= 50,
    mes6:                 semanas >= 27,
    cien:                 totalEntrenos >= 100,
    un_anio:              semanas >= 53,
    doscientos:           totalEntrenos >= 200,
    primer_lista_compra:  !!u.listaCompraGenerada,
    primer_checkin:       semanas >= 2,
    primer_amigo:         descuentoRef >= 5,
    tres_amigos:          descuentoRef >= 15,
    primer_peso:          nPesos >= 1,
    progresion_peso:      subio,
    diez_pct_fuerte:      subio10,
    cinco_ejercicios_reg: nPesos >= 5,
    racha21:              racha >= 21,
    racha30:              racha >= 30,
    fotos3:               numFotos >= 3,
    fotos6:               numFotos >= 6,
    kilo1:                kilos >= 1,
    kilo5:                kilos >= 5,
    nota1:                numNotas >= 1,
    notas10:              numNotas >= 10,
    trescientos:          totalEntrenos >= 300,
    dos_anios:            semanas >= 105,
    testimonio_dejado:    !!u.testimonio,
    // Estos siete los enseñaba el cliente pero el servidor no los reconocía, así
    // que no contaban para los niveles con descuento (30 sept 2026).
    semana_nutricion_completa: semNutri >= 1,
    mes_nutricion:        semNutri >= 4,
    kilo10:               kilos >= 10,
    constancia_bascula:   pesajes >= 8,
    progreso_compartido:  !!u.progresoCompartido,
    primer_feedback_entreno: Array.isArray(u.variantPreferences) && u.variantPreferences.length >= 1,
    la_vuelta:            huboVuelta,
  };
  if (soloNutricion) HITOS_ENTRENO.forEach(k => { delete reglas[k]; });

  const claves = Object.keys(reglas).filter(k => reglas[k]);
  return { claves, total: claves.length, semanas, entrenos: totalEntrenos, racha };
}

module.exports = { contarHitosVerificados, HITOS_ENTRENO };
