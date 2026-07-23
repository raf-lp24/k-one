const { getStripe, getSupabaseAdmin, getAuthUser, getActiveSubscriptionId } = require('./_stripeHelpers');
const { contarHitosVerificados } = require('./_hitos');

// Recompensas por niveles de hitos: % de descuento en la SIGUIENTE cuota
// (cupón percent_off de un solo uso → escala solo con el plan del cliente,
// sea mensual, trimestral o anual). Una sola vez por nivel y por cliente;
// el registro de niveles ya cobrados vive en la metadata del customer de
// Stripe (server-side, el cliente no puede tocarla).
//
// `semanasMin` es un refuerzo: aunque los hitos ya se recalculan acotados por
// la antigüedad real, ningún premio se entrega antes de ese tiempo de cuenta.
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const stripe        = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const nivel = (req.body && req.body.nivel) || '';
    const premio = NIVELES_PREMIO[nivel];
    if (!premio) return res.status(400).json({ error: 'Nivel no válido' });

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
      return res.status(400).json({
        error: `Este nivel necesita al menos ${premio.semanasMin} semanas de cuenta (llevas ${verif.semanas})`
      });
    }
    if (verif.total < premio.min) {
      return res.status(400).json({
        error: `Este nivel se desbloquea con ${premio.min} hitos verificados (llevas ${verif.total})`
      });
    }

    // Suscripción activa del usuario
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!sub?.stripe_customer_id) {
      return res.status(404).json({ error: 'No tienes una suscripción activa asociada' });
    }
    const subId = await getActiveSubscriptionId(stripe, sub);
    if (!subId) {
      return res.status(404).json({ error: 'No se encontró una suscripción activa' });
    }

    // ¿Ya cobró este nivel? (metadata del customer de Stripe = fuente de verdad)
    const customer = await stripe.customers.retrieve(sub.stripe_customer_id);
    const reclamados = (customer.metadata?.kone_hitos_niveles || '').split(',').filter(Boolean);
    if (reclamados.includes(nivel)) {
      return res.status(409).json({ error: 'Ya has canjeado la recompensa de este nivel' });
    }

    // Aplicar el cupón a la suscripción (descuenta la próxima factura)
    const coupon = await ensureCoupon(stripe, premio.pct);
    // `discounts` es el parámetro nuevo (descuentos múltiples); en versiones de API
    // anteriores solo existe `coupon`. Se intenta el nuevo y se cae al clásico.
    try {
      await stripe.subscriptions.update(subId, { discounts: [{ coupon: coupon.id }] });
    } catch (e) {
      if (e && /unknown parameter|discounts/i.test(e.message || '')) {
        await stripe.subscriptions.update(subId, { coupon: coupon.id });
      } else {
        throw e;
      }
    }

    // Registrar el nivel como cobrado
    await stripe.customers.update(sub.stripe_customer_id, {
      metadata: { ...customer.metadata, kone_hitos_niveles: [...reclamados, nivel].join(',') },
    });

    console.log(`[claim-hito-reward] ${user.id} canjeó nivel ${nivel} (${premio.pct}% en próxima cuota) — ${verif.total} hitos verificados, ${verif.semanas} semanas`);
    return res.status(200).json({ ok: true, pct: premio.pct, hitosVerificados: verif.total });

  } catch (err) {
    console.error('[claim-hito-reward] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
