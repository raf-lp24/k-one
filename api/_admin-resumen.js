// RESUMEN DE SOLO LECTURA PARA THOR (12 oct 2026).
//
// Thor (el agente de K-ONE que hace la ronda semanal) no puede mirar Stripe ni
// Supabase: las claves solo viven en Vercel. Este endpoint le da lo mínimo para
// los puntos 8-10 de su ronda (pagos fallidos y bajas, altas nuevas, lo que dicen
// los clientes) SIN datos personales: solo contadores. Ni nombres, ni emails, ni
// textos de mensajes, ni planes de nadie.
//
// Se llama como /api/admin?fn=resumen (cuenta dentro de api/admin.js: no suma
// funciones, el tope de Vercel Hobby es 12). No usa la sesión de admin: lleva una
// clave propia (THOR_API_KEY en Vercel) que solo permite LEER este resumen, así
// que si se filtrara no da acceso a Jarvis ni a ningún dato de cliente.
//   curl -s -X POST -H "x-thor-key: $THOR_API_KEY" "https://k-one.fit/api/admin?fn=resumen"
//
// Sin THOR_API_KEY en Vercel el endpoint responde 503 y no hace nada.
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');
const { motivoDeMensaje, ETIQUETAS } = require('./_motivoBaja');

const DIA = 86400000;
const h = s => crypto.createHash('sha256').update(String(s)).digest();

function claveValida(req) {
  const esperada = process.env.THOR_API_KEY || '';
  const recibida = String(req.headers['x-thor-key'] || '');
  // Hashes de la misma longitud: timingSafeEqual nunca lanza.
  return !!esperada && !!recibida && crypto.timingSafeEqual(h(recibida), h(esperada));
}

function contar(lista, f) {
  const r = {};
  for (const x of lista) { const k = f(x); if (k) r[k] = (r[k] || 0) + 1; }
  return r;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.THOR_API_KEY) return res.status(503).json({ error: 'Resumen no disponible: falta THOR_API_KEY' });
  if (!claveValida(req)) return res.status(401).json({ error: 'No autorizado' });

  try {
    const sb = getSupabaseAdmin();
    const ahora = new Date();
    const hace7 = new Date(ahora - 7 * DIA), hace14 = new Date(ahora - 14 * DIA), hace30 = new Date(ahora - 30 * DIA);
    const en7 = new Date(+ahora + 7 * DIA);

    // Perfiles: solo los campos sueltos que hacen falta (no el userdata entero, que lleva el plan).
    const { data: perfiles, error: e1 } = await sb.from('profiles')
      .select('id, created_at, is_beta, beta_expires, origen:userdata->_origen, cuenta:userdata->_cuenta, onb:userdata->onboardingCompletado, entrenos:userdata->historialEntrenos')
      .order('created_at', { ascending: false }).limit(2000);
    if (e1) { console.error('[resumen] profiles:', e1.message); return res.status(500).json({ error: 'Error leyendo perfiles' }); }

    const { data: subs, error: e2 } = await sb.from('subscriptions')
      .select('user_id, status, cancel_at_period_end, current_period_end');
    if (e2) { console.error('[resumen] subscriptions:', e2.message); return res.status(500).json({ error: 'Error leyendo suscripciones' }); }
    const subPorUsuario = {};
    (subs || []).forEach(s => { subPorUsuario[s.user_id] = s; });

    // Última conexión: columna opcional.
    const vistoMap = {};
    try {
      const r = await sb.from('profiles').select('id, last_seen').not('last_seen', 'is', null).limit(2000);
      if (!r.error) (r.data || []).forEach(x => { vistoMap[x.id] = x.last_seen; });
    } catch (e) { /* sin last_seen todavía */ }

    const filas = (perfiles || []).map(p => {
      const premium = !!p.is_beta && (!p.beta_expires || new Date(p.beta_expires) > ahora);
      const s = premium ? null : subPorUsuario[p.id];
      const estado = premium ? 'premium' : (s ? s.status : 'sin_suscripcion');
      const entrenos = Array.isArray(p.entrenos) ? p.entrenos.length : 0;
      const o = (p.origen && typeof p.origen === 'object') ? p.origen : null;
      return {
        alta: new Date(p.created_at), estado, entrenos,
        cancela: !!(s && s.cancel_at_period_end && ['active', 'trialing'].includes(s.status)),
        finPeriodo: s && s.current_period_end ? new Date(s.current_period_end) : null,
        onb: !!p.onb,
        origen: o && o.fuente ? `${String(o.fuente).slice(0, 30)}${o.medio ? '/' + String(o.medio).slice(0, 20) : ''}` : 'sin_origen',
        motivo: p.cuenta && p.cuenta.motivoBaja ? String(p.cuenta.motivoBaja).slice(0, 40) : null,
        visto: vistoMap[p.id] ? new Date(vistoMap[p.id]) : null,
      };
    });

    const altas7 = filas.filter(f => f.alta >= hace7), altas7ant = filas.filter(f => f.alta < hace7 && f.alta >= hace14);
    const enPrueba = filas.filter(f => f.estado === 'trialing');

    // Buzón: solo cuántos y cuántos sin contestar, nunca el texto.
    let buzon = { ultimos7d: null, sinRespuesta: null, bajasPorMotivoStripe: {} };
    try {
      const r = await sb.from('mensajes_cliente').select('mensaje, respuesta, created_at').gte('created_at', hace30.toISOString()).limit(500);
      if (!r.error) {
        const ms = r.data || [];
        buzon.ultimos7d = ms.filter(m => new Date(m.created_at) >= hace7).length;
        buzon.sinRespuesta = ms.filter(m => !m.respuesta).length;
        // Los motivos de baja que deja el webhook de Stripe en el Buzón (solo el código del motivo).
        // El texto puede llevar un comentario libre del cliente: solo se cuenta la etiqueta conocida.
        const etiquetas = Object.values(ETIQUETAS);
        buzon.bajasPorMotivoStripe = contar(ms, m => { const x = motivoDeMensaje(m.mensaje); if (!x) return null; return etiquetas.find(e => x.startsWith(e)) || 'Otro'; });
      }
    } catch (e) { /* tabla no disponible */ }

    let avisosAuditor = null;
    try {
      const r = await sb.from('auditorias_clientes').select('user_id', { count: 'exact', head: true });
      if (!r.error) avisosAuditor = r.count;
    } catch (e) { /* sin migrar */ }

    let leads7d = null;
    try {
      const r = await sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', hace7.toISOString());
      if (!r.error) leads7d = r.count;
    } catch (e) { /* sin tabla */ }

    return res.status(200).json({
      generado: ahora.toISOString(),
      nota: 'Solo contadores. Sin nombres, emails ni textos.',
      clientes: {
        total: filas.length,
        porEstado: contar(filas, f => f.estado),
        cancelanAlFinal: filas.filter(f => f.cancela).length,
        pagoFallido: filas.filter(f => f.estado === 'past_due').length,
        canceladosOImpagados: filas.filter(f => ['canceled', 'unpaid'].includes(f.estado)).length,
        onboardingCompletado: filas.filter(f => f.onb).length,
      },
      altas: {
        hoy: filas.filter(f => f.alta >= new Date(ahora - DIA)).length,
        ultimos7d: altas7.length,
        semanaAnterior: altas7ant.length,
        ultimos30dPorOrigen: contar(filas.filter(f => f.alta >= hace30), f => f.origen),
      },
      mesGratis: {
        enPrueba: enPrueba.length,
        acabanEn7d: enPrueba.filter(f => f.finPeriodo && f.finPeriodo <= en7 && f.finPeriodo >= ahora).length,
        conCeroEntrenos: enPrueba.filter(f => f.entrenos === 0).length,
        conUnEntrenoOMenos: enPrueba.filter(f => f.entrenos <= 1).length,
        sinEntrarEn7d: enPrueba.filter(f => !f.visto || f.visto < hace7).length,
        // Pruebas ya decididas: pagó o no pagó.
        pruebasTerminadas: filas.filter(f => ['active', 'past_due', 'canceled', 'unpaid'].includes(f.estado)).length,
        pagando: filas.filter(f => f.estado === 'active').length,
      },
      bajas: { motivosDeLaApp: contar(filas, f => f.motivo), ...buzon },
      avisosDelAuditor: avisosAuditor,
      leadsUltimos7d: leads7d,
    });
  } catch (err) {
    console.error('[resumen] error:', err);
    capturarError(err, { fn: 'resumen' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
