const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

// Panel de administración ("cerebro"): devuelve métricas agregadas y la lista de
// clientes. SOLO accesible para los correos de la allowlist de admin.
//
// Seguridad: se valida el JWT de Supabase del que llama y se comprueba que su email
// está en ADMIN_EMAILS (variable de entorno, separada por comas) o, por defecto, en
// la lista de abajo. La consulta usa la service-role key (solo backend), así que se
// salta RLS y puede leer todos los clientes — por eso el control de acceso es crítico.
const ADMIN_FALLBACK = ['azuqueca1@hotmail.com'];

function getAdmins() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : ADMIN_FALLBACK.map(e => e.toLowerCase());
}

// Mapa precio de Stripe -> ingreso mensual equivalente (MRR), para estimar ingresos.
function getMrrMap() {
  const m = {};
  const add = (id, eur) => { if (id) m[id] = eur; };
  add(process.env.STRIPE_PRICE_COMPLETO_MENSUAL, 14.99);
  add(process.env.STRIPE_PRICE_COMPLETO_TRIMESTRAL, 35.99 / 3);
  add(process.env.STRIPE_PRICE_COMPLETO_ANUAL, 99.99 / 12);
  add(process.env.STRIPE_PRICE_NUTRICION_MENSUAL, 6.99);
  add(process.env.STRIPE_PRICE_OFERTA_MES, 0.99);
  return m;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const user = await getAuthUser(req, supabaseAdmin);
  if (!user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const email = (user.email || '').toLowerCase();
  if (!getAdmins().includes(email)) {
    res.status(403).json({ error: 'No autorizado' });
    return;
  }

  // Perfiles + suscripciones (service-role: lee todo).
  const { data: perfiles, error: e1 } = await supabaseAdmin
    .from('profiles')
    .select('id, nombre, email, created_at, userdata')
    .order('created_at', { ascending: false });
  if (e1) { res.status(500).json({ error: e1.message }); return; }

  const { data: subs, error: e2 } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, status, plan, current_period_end, cancel_at_period_end');
  if (e2) { res.status(500).json({ error: e2.message }); return; }

  const subByUser = {};
  (subs || []).forEach(s => { subByUser[s.user_id] = s; });

  const offerPriceId = process.env.STRIPE_PRICE_OFERTA_MES;
  const mrrMap = getMrrMap();

  let mrr = 0;
  const m = { registrados: 0, onboardingCompletado: 0, activosPago: 0, enOferta: 0, cancelanAlFinal: 0, pagoFallido: 0, sinSuscripcion: 0, cancelados: 0 };

  const clientes = (perfiles || []).map(p => {
    const ud = p.userdata || {};
    const s = subByUser[p.id];
    const status = s?.status || 'none';
    const activo = ['active', 'trialing'].includes(status);
    const enOferta = activo && offerPriceId && s?.plan === offerPriceId;
    const cancela = activo && !!s?.cancel_at_period_end;

    m.registrados++;
    if (ud.onboardingCompletado) m.onboardingCompletado++;
    if (!s || status === 'none') m.sinSuscripcion++;
    if (activo) m.activosPago++;
    if (enOferta) m.enOferta++;
    if (cancela) m.cancelanAlFinal++;
    if (status === 'past_due') m.pagoFallido++;
    if (status === 'canceled' || status === 'unpaid') m.cancelados++;
    if (activo && !enOferta && mrrMap[s.plan]) mrr += mrrMap[s.plan];

    return {
      nombre: p.nombre || '—',
      email: p.email || '—',
      alta: p.created_at,
      estado: status,
      enOferta,
      cancelaAlFinal: cancela,
      renovacion: s?.current_period_end || null,
      objetivo: ud.objetivo || '—',
      deporte: ud.deporte || '—',
      tipoPlan: ud.tipoPlan || '—',
      onboarding: !!ud.onboardingCompletado
    };
  });

  m.mrrEstimado = Math.round(mrr * 100) / 100;

  res.status(200).json({ metrics: m, clientes });
};
