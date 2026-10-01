// Prueba del "mes gratis una sola vez por email" (api/_pruebaGratis.js y su uso en
// api/create-checkout-session.js) con Stripe y Supabase simulados.
// node scripts/probar-prueba-gratis.js   (lo pasa npm test y GitHub Actions)
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const { normalizarEmail, huellaEmail } = require(R + 'api/_pruebaGratis.js');

let fallos = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fallos++; };

console.log('Normalización del email (debe coincidir con normalizar_email_prueba() del SQL)');
for (const [entrada, esperado] of [
  ['Cliente@Ejemplo.com', 'cliente@ejemplo.com'],
  ['  cliente@ejemplo.com ', 'cliente@ejemplo.com'],
  ['cliente+otra@ejemplo.com', 'cliente@ejemplo.com'],
  ['c.liente@ejemplo.com', 'c.liente@ejemplo.com'],
  ['C.Li.Ente+k1@GMAIL.com', 'cliente@gmail.com'],
  ['cliente@googlemail.com', 'cliente@gmail.com'],
  ['sinarroba', 'sinarroba'],
]) ok(normalizarEmail(entrada) === esperado, `${JSON.stringify(entrada)} → ${esperado}`);
ok(huellaEmail('Cliente@Gmail.com') === huellaEmail('c.liente+2@gmail.com'), 'misma huella para el mismo buzón de Gmail');
ok(/^[0-9a-f]{64}$/.test(huellaEmail('a@b.c')), 'la huella es SHA-256 en hex, nunca el email');

// ---------- create-checkout-session con todo simulado
function montar({ huellasUsadas = [] } = {}) {
  const llamadas = { sesiones: [] };
  const stripe = {
    customers: { search: async () => ({ data: [] }), create: async () => ({ id: 'cus_nuevo' }) },
    subscriptions: { list: async () => ({ data: [] }) },
    checkout: { sessions: { create: async (p) => { llamadas.sesiones.push(p); return { url: 'https://checkout.stripe.test/s' }; } } },
  };
  const supa = {
    from(t) {
      const q = {
        select() { return q; }, eq(c, v) { q[c] = v; return q; }, or() { return q; }, update() { return q; }, delete() { return q; },
        upsert() { return q; },
        maybeSingle: async () => {
          if (t === 'pruebas_usadas') return { data: huellasUsadas.includes(q.email_hash) ? { email_hash: q.email_hash } : null, error: null };
          if (t === 'subscriptions') return { data: q._leida ? { stripe_customer_id: 'cus_nuevo' } : (q._leida = true, null) };
          return { data: null };
        },
        then(okf, ko) { return Promise.resolve({ data: [{ user_id: 'u1' }], error: null }).then(okf, ko); },
      };
      return q;
    },
  };
  return { stripe, supa, llamadas };
}

async function pedir(m, body) {
  const helpers = R + 'api/_stripeHelpers.js';
  const checkout = R + 'api/create-checkout-session.js';
  delete require.cache[require.resolve(checkout)];
  require.cache[require.resolve(helpers)] = { id: helpers, filename: helpers, loaded: true, exports: {
    getStripe: () => m.stripe, getSupabaseAdmin: () => m.supa,
    getAuthUser: async () => ({ id: 'u1', email: 'C.Liente@gmail.com' }),
    getPriceId: () => 'price_completo_mensual',
  } };
  process.env.APP_URL = 'https://k-one.test';
  const handler = require(checkout);
  let estado = 0, cuerpo = null;
  const res = { status(s) { estado = s; return res; }, json(j) { cuerpo = j; return res; } };
  await handler({ method: 'POST', body }, res);
  return { estado, cuerpo };
}

(async () => {
  const silencio = console.warn; console.warn = () => {}; console.error = () => {};
  const body = { tipoPlan: 'Plan completo: entrenamiento + nutrición', periodicidad: 'mensual' };

  console.log('Email nuevo');
  { const m = montar(); const r = await pedir(m, body);
    ok(r.estado === 200 && r.cuerpo.url, 'devuelve la URL de pago');
    ok(m.llamadas.sesiones[0]?.subscription_data?.trial_period_days === 30, 'con 30 días gratis'); }

  console.log('Email que ya tuvo suscripción (borró la cuenta y vuelve)');
  { const m = montar({ huellasUsadas: [huellaEmail('cliente@gmail.com')] }); const r = await pedir(m, body);
    ok(r.estado === 200 && r.cuerpo.pruebaUsada === true && !r.cuerpo.url, 'primero avisa (pruebaUsada) sin crear ningún pago');
    ok(m.llamadas.sesiones.length === 0, 'no se crea sesión de Stripe sin que acepte'); }
  { const m = montar({ huellasUsadas: [huellaEmail('cliente@gmail.com')] }); const r = await pedir(m, { ...body, aceptoSinPrueba: true });
    ok(r.estado === 200 && r.cuerpo.url, 'si acepta, devuelve la URL de pago');
    ok(m.llamadas.sesiones[0] && !m.llamadas.sesiones[0].subscription_data.trial_period_days, 'y SIN días gratis'); }

  console.log('aceptoSinPrueba no regala nada a un email nuevo');
  { const m = montar(); const r = await pedir(m, { ...body, aceptoSinPrueba: true });
    ok(m.llamadas.sesiones[0]?.subscription_data?.trial_period_days === 30, 'un email nuevo sigue teniendo sus 30 días'); }

  console.warn = silencio;
  console.log('\n' + (fallos ? '✘ ' + fallos + ' fallos' : '✔ Todo bien')); process.exit(fallos ? 1 : 0);
})();
