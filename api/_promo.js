// ============================================================================
//  CÓDIGOS PROMOCIONALES — lógica de servidor
//
//  El navegador NUNCA decide un descuento: solo guarda en el perfil el código
//  que escribió el cliente. Aquí se vuelve a validar y se canjea contra la base
//  de datos antes de crear el pago en Stripe.
//
//  El "mes gratis" se aplica como periodo de prueba de Stripe (trial), no como
//  cupón del 100%: así el cliente recibe exactamente un mes, sea su plan
//  mensual, trimestral o anual (un 100% de descuento en el plan anual le
//  habría regalado el año completo).
//
//  Va en un fichero con guion bajo a propósito: Vercel ignora estos ficheros y
//  no cuentan como función serverless (el plan Hobby solo admite 12).
// ============================================================================

// Cupón reutilizable para los códigos de tipo descuento_pct.
async function ensureCoupon(stripe, pct) {
  const id = `KONE_PROMO_${pct}`;
  try {
    return await stripe.coupons.retrieve(id);
  } catch (e) {
    return await stripe.coupons.create({
      id,
      percent_off: pct,
      duration: 'once',
      name: `K-ONE · Código promocional (${pct}%)`,
    });
  }
}

/**
 * Resuelve el beneficio que le corresponde al usuario por su código promocional.
 *
 * @param {object}  o.supabaseAdmin  cliente con service role
 * @param {object}  o.stripe
 * @param {string}  o.userId
 * @param {boolean} o.tieneHistorial  si el cliente ya tuvo alguna suscripción
 * @returns {Promise<null | {tipo:string, valor:number, codigo:string, trialDays?:number, couponId?:string}>}
 */
async function resolverBeneficioPromo({ supabaseAdmin, stripe, userId, tieneHistorial }) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('codigo_promo')
    .eq('id', userId)
    .maybeSingle();

  const codigo = (profile?.codigo_promo || '').trim().toUpperCase();
  if (!codigo) return null;

  // Las promociones de bienvenida son para clientes nuevos. Si ya tuvo una
  // suscripción antes, no se aplica (evita cancelar y volver para repetir).
  if (tieneHistorial) return null;

  const { data: res, error } = await supabaseAdmin.rpc('canjear_codigo_promo', {
    p_codigo: codigo,
    p_user_id: userId,
  });
  // Si la migración de códigos no está aplicada todavía, la RPC no existe: se
  // sigue sin promoción en lugar de romper el pago.
  if (error || !res || !res.ok) {
    if (error) console.warn('[promo] no se pudo canjear:', error.message);
    return null;
  }

  if (res.tipo === 'mes_gratis') {
    return { tipo: 'mes_gratis', valor: res.valor, codigo, trialDays: res.valor };
  }
  if (res.tipo === 'descuento_pct') {
    const coupon = await ensureCoupon(stripe, res.valor);
    return { tipo: 'descuento_pct', valor: res.valor, codigo, couponId: coupon.id };
  }
  return null;
}

module.exports = { resolverBeneficioPromo };
