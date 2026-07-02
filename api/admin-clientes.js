const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

// A-5: sin fallback hardcodeado — fail-closed si ADMIN_EMAILS no está configurada
function getAdmins() {
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.length) throw new Error('ADMIN_EMAILS no configurada en las variables de entorno');
  return admins;
}

// B-1: calcular el mapa MRR una sola vez por instancia de función (no en cada request)
function buildMrrMap() {
  const m = {};
  const add = (id, eur) => { if (id) m[id] = eur; };
  add(process.env.STRIPE_PRICE_COMPLETO_MENSUAL,    19.99);
  add(process.env.STRIPE_PRICE_COMPLETO_TRIMESTRAL, 44.99 / 3);
  add(process.env.STRIPE_PRICE_COMPLETO_ANUAL,      149.99 / 12);
  add(process.env.STRIPE_PRICE_NUTRICION_MENSUAL,   9.99);
  add(process.env.STRIPE_PRICE_OFERTA_MES,          1.99);
  return m;
}
const MRR_MAP = buildMrrMap();

function diasEntre(fechaA, fechaB) {
  if (!fechaA || !fechaB) return null;
  return Math.round((new Date(fechaB) - new Date(fechaA)) / 86400000);
}

function distribucion(arr, campo) {
  const mapa = {};
  arr.forEach(item => {
    const val = item[campo] || 'Desconocido';
    mapa[val] = (mapa[val] || 0) + 1;
  });
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

module.exports = async (req, res) => {
  // A-3: solo POST — GET con PII puede aparecer en logs de CDN/proxy
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // A-4: try/catch global
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // A-5: getAdmins() lanza si ADMIN_EMAILS no está definida
    let admins;
    try {
      admins = getAdmins();
    } catch (e) {
      console.error('[admin-clientes]', e.message);
      return res.status(503).json({ error: 'Panel de administración no disponible' });
    }

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const email = (user.email || '').toLowerCase();
    if (!admins.includes(email)) return res.status(403).json({ error: 'No autorizado' });

    const page = parseInt(req.body?.page) || 0;
    const pageSize = 50;
    const { data: perfiles, error: e1 } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre, email, created_at, userdata, is_beta, beta_expires')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Traer nombres y última sesión de auth.users. last_sign_in_at es el fallback
    // de "última conexión" cuando aún no hay dato de last_seen (heartbeat del front).
    let authNames = {};
    let authLastSignIn = {};
    try {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      (users || []).forEach(u => {
        const n = u.user_metadata?.nombre;
        if (n) authNames[u.id] = n;
        if (u.last_sign_in_at) authLastSignIn[u.id] = u.last_sign_in_at;
      });
    } catch (e) { console.warn('[admin-clientes] listUsers error:', e.message); }

    // Columnas opcionales (last_seen, nota_admin). Consulta defensiva: si aún no existen,
    // se ignora sin romper el panel. last_seen cae a last_sign_in_at; nota_admin queda vacía.
    let lastSeenMap = {};
    let notaMap = {};
    try {
      const ids = (perfiles || []).map(p => p.id);
      if (ids.length) {
        const { data: ls } = await supabaseAdmin.from('profiles').select('id, last_seen, nota_admin').in('id', ids);
        (ls || []).forEach(r => { if (r.last_seen) lastSeenMap[r.id] = r.last_seen; if (r.nota_admin) notaMap[r.id] = r.nota_admin; });
      }
    } catch (e) {
      // Puede que exista last_seen pero no nota_admin (o viceversa). Reintento solo last_seen.
      try {
        const ids = (perfiles || []).map(p => p.id);
        if (ids.length) {
          const { data: ls2 } = await supabaseAdmin.from('profiles').select('id, last_seen').in('id', ids);
          (ls2 || []).forEach(r => { if (r.last_seen) lastSeenMap[r.id] = r.last_seen; });
        }
      } catch (_) { /* ninguna columna opcional existe todavía */ }
    }

    if (e1) {
      // B-4: no exponer el mensaje crudo de Supabase al cliente
      console.error('[admin-clientes] profiles query error:', e1);
      return res.status(500).json({ error: 'Error consultando datos de perfiles' });
    }

    const { data: subs, error: e2 } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, status, plan, current_period_end, current_period_start, cancel_at_period_end, stripe_customer_id');

    if (e2) {
      console.error('[admin-clientes] subscriptions query error:', e2);
      return res.status(500).json({ error: 'Error consultando datos de suscripciones' });
    }

    const subByUser = {};
    (subs || []).forEach(s => { subByUser[s.user_id] = s; });

    const offerPriceId = process.env.STRIPE_PRICE_OFERTA_MES;

    const PRICE_LABELS = {};
    const addLabel = (id, label) => { if (id) PRICE_LABELS[id] = label; };
    addLabel(process.env.STRIPE_PRICE_COMPLETO_MENSUAL,    'Mensual 19,99€');
    addLabel(process.env.STRIPE_PRICE_COMPLETO_TRIMESTRAL, 'Trimestral 44,99€');
    addLabel(process.env.STRIPE_PRICE_COMPLETO_ANUAL,      'Anual 149,99€');
    addLabel(process.env.STRIPE_PRICE_NUTRICION_MENSUAL,   'Nutrición 9,99€');
    addLabel(process.env.STRIPE_PRICE_OFERTA_MES,          'Oferta 1,99€');

    const ahora   = new Date();
    const hace1d  = new Date(ahora.getTime() - 1  * 86400000);
    const hace7d  = new Date(ahora.getTime() - 7  * 86400000);
    const hace14d = new Date(ahora.getTime() - 14 * 86400000);
    const en7d    = new Date(ahora.getTime() + 7  * 86400000);

    let mrr = 0;
    let sumaDiasPago = 0, contadorDiasPago = 0;
    let sumEntrenosActivos = 0, contEntrenosActivos = 0;

    const m = {
      registrados: 0, onboardingCompletado: 0,
      activosPago: 0, enOferta: 0, cancelanAlFinal: 0,
      pagoFallido: 0, sinSuscripcion: 0, cancelados: 0,
      renovacionProximos7d: 0, sinOnboarding14d: 0, ceroEntrenosActivos: 0,
      tasaConversion: 0, tiempoMedioPago: null, mediaEntrenos: 0, mrrEstimado: 0,
      nuevosEstaSemana: 0, nuevosSemanaPasada: 0, nuevosPagosEstaSemana: 0,
    };

    const retencion = { '1': 0, '2': 0, '3': 0, '4+': 0 };

    const clientes = (perfiles || []).map(p => {
      const ud      = p.userdata || {};
      const s       = subByUser[p.id];
      const status  = s?.status || 'none';
      const activo  = ['active', 'trialing'].includes(status);
      const enOferta  = activo && offerPriceId && s?.plan === offerPriceId;
      const cancela   = activo && !!s?.cancel_at_period_end;
      const diasDesdeAlta = diasEntre(p.created_at, ahora);
      const altaDate  = new Date(p.created_at);
      const esNuevo   = altaDate >= hace1d;
      const esSemanaPasada = !esNuevo && altaDate >= hace14d;

      const entrenosTotal = Array.isArray(ud.historialEntrenos)
        ? ud.historialEntrenos.length
        : (Array.isArray(ud.entrenosCompletados) ? ud.entrenosCompletados.length : 0);
      const refSemana = (activo && !p.is_beta && s?.current_period_start)
        ? s.current_period_start : p.created_at;
      const semanaActual = refSemana
        ? Math.max(1, Math.floor((ahora.getTime() - new Date(refSemana).getTime()) / (7 * 86400000)) + 1)
        : (ud.progreso?.semana || 1);
      const renovacion    = s?.current_period_end || p.beta_expires || null;
      const renovaProximo = activo && renovacion && new Date(renovacion) <= en7d && new Date(renovacion) >= ahora;
      const sinOnboarding14d = !ud.onboardingCompletado && diasDesdeAlta >= 14;

      let alerta = 'none', alertaRazon = '';
      if (status === 'past_due')              { alerta = 'red';    alertaRazon = 'Pago fallido'; }
      else if (sinOnboarding14d)              { alerta = 'red';    alertaRazon = '+14 días sin onboarding'; }
      else if (activo && entrenosTotal === 0) { alerta = 'orange'; alertaRazon = 'Activo, 0 entrenos'; }
      else if (cancela)                       { alerta = 'orange'; alertaRazon = 'Cancela al vencer'; }
      else if (renovaProximo && !cancela)     { alerta = 'yellow'; alertaRazon = 'Renueva en 7 días'; }
      else if (activo && entrenosTotal > 0)   { alerta = 'green';  alertaRazon = 'Activo y entrenando'; }

      if (activo && s?.current_period_start && p.created_at) {
        const dias = diasEntre(p.created_at, s.current_period_start);
        if (dias !== null && dias >= 0 && dias <= 365) { sumaDiasPago += dias; contadorDiasPago++; }
      }

      if (activo && s?.current_period_start && new Date(s.current_period_start) >= hace7d) {
        m.nuevosPagosEstaSemana++;
      }

      if (activo && !enOferta) {
        const sem = semanaActual >= 4 ? '4+' : String(semanaActual);
        retencion[sem]++;
      }

      if (activo) { sumEntrenosActivos += entrenosTotal; contEntrenosActivos++; }

      m.registrados++;
      if (ud.onboardingCompletado) m.onboardingCompletado++;
      if (!s || status === 'none')    m.sinSuscripcion++;
      if (activo)    m.activosPago++;
      if (enOferta)  m.enOferta++;
      if (cancela)   m.cancelanAlFinal++;
      if (status === 'past_due') m.pagoFallido++;
      if (status === 'canceled' || status === 'unpaid') m.cancelados++;
      if (renovaProximo) m.renovacionProximos7d++;
      if (sinOnboarding14d) m.sinOnboarding14d++;
      if (activo && entrenosTotal === 0) m.ceroEntrenosActivos++;
      if (activo && !enOferta && MRR_MAP[s.plan]) mrr += MRR_MAP[s.plan];
      if (esNuevo)       m.nuevosEstaSemana++;
      if (esSemanaPasada) m.nuevosSemanaPasada++;

      return {
        id:           p.id,
        isBeta:       !!p.is_beta,
        betaExpires:  p.beta_expires || null,
        nombre:       p.nombre || ud.nombre || authNames[p.id] || '—',
        email:        p.email  || '—',
        alta:         p.created_at,
        diasDesdeAlta,
        esNuevo,
        estado:       status,
        enOferta:     !!enOferta,
        planPrecio:   s?.plan ? (PRICE_LABELS[s.plan] || '—') : '—',
        cancelaAlFinal: cancela,
        renovacion,
        objetivo:     ud.objetivo     || '—',
        deporte:      ud.deporte      || '—',
        tipoPlan:     ud.tipoPlan     || '—',
        lesion:       ud.lesion === 'Sí' || ud.lesion === 'si' || ud.lesion === true,
        lesionDetalle: ud.lesionDetalle || null,
        alergia:      ud.alergia      || null,
        alergiaOtra:  ud.alergiaOtra  || null,
        medicacion:   ud.medicacion   || null,
        peso:         ud.peso || ud.pesoActual || null,
        onboarding:   !!ud.onboardingCompletado,
        entrenosTotal,
        semanaActual,
        ultimaConexion: lastSeenMap[p.id] || authLastSignIn[p.id] || null,
        notaAdmin: notaMap[p.id] || '',
        alerta,
        alertaRazon,
      };
    });

    m.mrrEstimado     = Math.round(mrr * 100) / 100;
    m.tasaConversion  = m.registrados > 0 ? Math.round((m.activosPago / m.registrados) * 100) : 0;
    m.tiempoMedioPago = contadorDiasPago > 0 ? Math.round(sumaDiasPago / contadorDiasPago) : null;
    m.mediaEntrenos   = contEntrenosActivos > 0 ? Math.round((sumEntrenosActivos / contEntrenosActivos) * 10) / 10 : 0;

    const distDeporte  = distribucion(clientes.filter(c => c.deporte  !== '—'), 'deporte');
    const distObjetivo = distribucion(clientes.filter(c => c.objetivo !== '—'), 'objetivo');
    const distPlan     = distribucion(clientes.filter(c => c.tipoPlan !== '—'), 'tipoPlan');

    let leads = [];
    try {
      const { data: leadsData } = await supabaseAdmin
        .from('leads').select('email, created_at').order('created_at', { ascending: false }).limit(50);
      leads = leadsData || [];
    } catch (e) { console.warn('[admin-clientes] leads query error:', e.message); }

    let emailLog = [];
    try {
      const { data: logData } = await supabaseAdmin
        .from('email_log').select('id, tipo, destinatario, asunto, datos, created_at').order('created_at', { ascending: false }).limit(50);
      emailLog = logData || [];
    } catch (e) { console.warn('[admin-clientes] emailLog query error:', e.message); }

    let mensajes = [];
    try {
      const { data: msgData } = await supabaseAdmin
        .from('mensajes_cliente').select('id, nombre, email, asunto, mensaje, respuesta, created_at')
        .order('created_at', { ascending: false }).limit(50);
      mensajes = msgData || [];
    } catch (e) { console.warn('[admin-clientes] mensajes query error:', e.message); }

    return res.status(200).json({ metrics: m, clientes, distDeporte, distObjetivo, distPlan, retencion, leads, emailLog, mensajes });

  } catch (err) {
    console.error('[admin-clientes] error no controlado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
