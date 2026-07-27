const { getActiveSubscriptionId } = require('./_stripeHelpers');
const { contarHitosVerificados } = require('./_hitos');

// Recompensas por niveles de hitos: % de descuento en la SIGUIENTE cuota
// (cupón percent_off de un solo uso → escala con el plan del cliente, sea
// mensual, trimestral o anual). Una sola vez por nivel y por cliente; el
// cerrojo que impide el doble canje vive en la tabla hitos_canjes de
// Supabase (clave primaria user_id+nivel), que el navegador no puede tocar.
//
// `semanasMin` es un refuerzo: aunque los hitos ya se recalculan acotados por
// la antigüedad real de la cuenta, ningún premio se entrega antes de ese tiempo.
const NIVELES_PREMIO = {
  fuego:  { min: 15, pct: 10, semanasMin: 4 },
  hierro: { min: 22, pct: 20, semanasMin: 12 },
};

// Crea (si no existe) y devuelve el cupón reutilizable de un nivel.
async function ensureCoupon(stripe, pct) {
  const id = `KONE_HITOS_${pct}`;
  try {
    return await stripe.coupons.retrieve(id);
  } catch (e) {
    return await stripe.coupons.create({
      id,
      percent_off: pct,
      duration: 'once',
      name: `K-ONE · Recompensa hitos (${pct}%)`,
    });
  }
}

/**
 * Canjea la recompensa de un nivel de hitos.
 * Devuelve { status, body } para que el endpoint lo reenvíe tal cual.
 */
async function canjearNivelHitos({ stripe, supabaseAdmin, user, nivel }) {
  const premio = NIVELES_PREMIO[nivel];
  if (!premio) return { status: 400, body: { error: 'Nivel no válido' } };

  // Los hitos se RECALCULAN aquí; nunca se usa el mapa `hitos` del cliente.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('userdata')
    .eq('id', user.id)
    .maybeSingle();
  const userdata = profile?.userdata || {};

  // Referidos pagados: de la tabla que escribe el webhook, no del navegador.
  const { count: referidosPagados } = await supabaseAdmin
    .from('referidos')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)
    .eq('estado', 'pagado');

  const verif = contarHitosVerificados(userdata, user.created_at, referidosPagados || 0);

  if (verif.semanas < premio.semanasMin) {
    return { status: 400, body: { error: `Este nivel necesita al menos ${premio.semanasMin} semanas de cuenta (llevas ${verif.semanas})` } };
  }
  if (verif.total < premio.min) {
    return { status: 400, body: { error: `Este nivel se desbloquea con ${premio.min} hitos verificados (llevas ${verif.total})` } };
  }

  // Suscripción activa del usuario
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return { status: 404, body: { error: 'No tienes una suscripción activa asociada' } };
  }
  const subId = await getActiveSubscriptionId(stripe, sub);
  if (!subId) {
    return { status: 404, body: { error: 'No se encontró una suscripción activa' } };
  }

  // Cerrojo atómico contra doble canje: la clave primaria (user_id, nivel) de
  // hitos_canjes solo deja ganar a la primera petición. Si dos peticiones
  // casi simultáneas (doble clic, dos pestañas) llegan aquí, la segunda choca
  // contra la clave duplicada (código 23505) y se rechaza — a diferencia de
  // leer primero customer.metadata, que tiene una ventana de carrera real.
  const { error: lockError } = await supabaseAdmin
    .from('hitos_canjes')
    .insert({ user_id: user.id, nivel });
  if (lockError) {
    if (lockError.code === '23505') {
      return { status: 409, body: { error: 'Ya has canjeado la recompensa de este nivel' } };
    }
    throw lockError;
  }

  // Aplicar el cupón a la suscripción (descuenta la próxima factura).
  // `discounts` es el parámetro nuevo (descuentos múltiples); en versiones de
  // API anteriores sólo existe `coupon`. Se intenta el nuevo y se cae al clásico.
  const coupon = await ensureCoupon(stripe, premio.pct);
  try {
    await stripe.subscriptions.update(subId, { discounts: [{ coupon: coupon.id }] });
  } catch (e) {
    if (e && /unknown parameter|discounts/i.test(e.message || '')) {
      await stripe.subscriptions.update(subId, { coupon: coupon.id });
    } else {
      throw e;
    }
  }

  // Registrar el nivel también en Stripe (solo visibilidad en el dashboard;
  // hitos_canjes es la fuente de verdad que impide el doble canje).
  try {
    const customer = await stripe.customers.retrieve(sub.stripe_customer_id);
    const reclamados = (customer.metadata?.kone_hitos_niveles || '').split(',').filter(Boolean);
    await stripe.customers.update(sub.stripe_customer_id, {
      metadata: { ...customer.metadata, kone_hitos_niveles: [...new Set([...reclamados, nivel])].join(',') },
    });
  } catch (e) {
    console.error('[canjear-hito] no se pudo anotar metadata en Stripe (no crítico):', e.message);
  }

  console.log(`[canjear-hito] ${user.id} canjeó nivel ${nivel} (${premio.pct}% en próxima cuota) — ${verif.total} hitos verificados, ${verif.semanas} semanas`);
  return { status: 200, body: { ok: true, pct: premio.pct, hitosVerificados: verif.total } };
}

module.exports = { canjearNivelHitos, NIVELES_PREMIO };
