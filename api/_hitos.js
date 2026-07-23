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
function contarHitosVerificados(userdata, createdAt, referidosPagados) {
  const u = userdata || {};
  const altaMs = Date.parse(createdAt) || Date.now();
  const semanasReales = Math.floor((Date.now() - altaMs) / (7 * DIA_MS)) + 1;

  // La semana del plan nunca puede ir por delante de la antigüedad real.
  const semanas = Math.max(1, Math.min(Number(u.progreso?.semana) || 1, semanasReales));

  // Entrenos: se cuentan las fechas válidas y únicas; además no puede haber
  // más entrenos que días transcurridos desde el alta.
  const fechas = fechasEntrenoValidas(u, altaMs);
  const diasDesdeAlta = Math.max(1, Math.floor((Date.now() - altaMs) / DIA_MS) + 1);
  const listaEntrenos = Array.isArray(u.entrenosCompletados) ? u.entrenosCompletados.length : 0;
  const totalEntrenos = Math.min(Math.max(fechas.size, 0) || listaEntrenos, diasDesdeAlta);
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

  const pesos   = (u.pesosEjercicios && typeof u.pesosEjercicios === 'object') ? u.pesosEjercicios : {};
  const nPesos  = Object.keys(pesos).length;
  const hist    = (e) => (e && Array.isArray(e.historial)) ? e.historial : null;
  const subio   = Object.values(pesos).some(e => { const h = hist(e); return h && h.length >= 2 && Math.max(...h.map(x => Number(x.peso) || 0)) > (Number(h[0].peso) || 0); });
  const subio10 = Object.values(pesos).some(e => { const h = hist(e); return h && h.length >= 2 && Number(h[0].peso) > 0 && Math.max(...h.map(x => Number(x.peso) || 0)) >= Number(h[0].peso) * 1.10; });

  const numNotas = Array.isArray(u.notas) ? u.notas.length : 0;

  // Kilos hacia el objetivo (mismo criterio que la web)
  const kilos = (() => {
    const ini = parseFloat(u.peso), act = parseFloat(u.pesoActual || u.peso);
    if (!ini || !act) return 0;
    const o = u.objetivo || '';
    if (o.includes('Perder') || o.includes('grasa')) return ini - act;
    if (o.includes('Ganar') || o.includes('músculo')) return act - ini;
    return 0;
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
  };

  const claves = Object.keys(reglas).filter(k => reglas[k]);
  return { claves, total: claves.length, semanas, entrenos: totalEntrenos, racha };
}

module.exports = { contarHitosVerificados };
