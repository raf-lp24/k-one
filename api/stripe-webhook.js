const { getStripe, getSupabaseAdmin } = require('./_stripeHelpers');

// Vercel necesita el cuerpo de la petición sin parsear para verificar la firma de Stripe.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Actualiza (o crea) la fila de subscriptions a partir de un objeto suscripción de Stripe.
async function upsertFromSubscription(supabaseAdmin, subscription, userId) {
  const item      = subscription.items.data[0];
  const periodEnd = item?.current_period_end   ?? subscription.current_period_end;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;

  // Sin este guard, si Stripe no manda el periodo (cambió de sitio entre versiones
  // de la API), `new Date(undefined * 1000).toISOString()` lanza RangeError y tumba
  // el webhook entero con un 500, en vez de guardar la fila sin la fecha.
  if (!periodEnd) {
    console.warn(`[stripe-webhook] suscripción ${subscription.id} sin current_period_end; se guarda sin fecha de renovación`);
  }

  const row = {
    stripe_customer_id:     subscription.customer,
    stripe_subscription_id: subscription.id,
    plan:                   item?.price?.id || null,
    status:                 subscription.status,
    current_period_start:   periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end:     periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end:   !!subscription.cancel_at_period_end
  };

  async function escribir(r) {
    if (userId) {
      return supabaseAdmin.from('subscriptions').upsert({ user_id: userId, ...r }, { onConflict: 'user_id' });
    }
    return supabaseAdmin.from('subscriptions').update(r).eq('stripe_customer_id', subscription.customer);
  }

  let { error: err } = await escribir(row);

  // M-3: loggear el error ANTES del fallback para que aparezca en los logs de Vercel
  if (err && err.message && /current_period_start|cancel_at_period_end/.test(err.message)) {
    console.warn('[stripe-webhook] columna faltante en subscriptions, reintentando sin ella:', err.message);
    const rowMin = { ...row };
    delete rowMin.current_period_start;
    delete rowMin.cancel_at_period_end;
    ({ error: err } = await escribir(rowMin));
  }

  if (err) throw new Error(`Supabase upsert error: ${err.message}`);
}

// Sincroniza el estado del cliente eligiendo SIEMPRE su mejor suscripción activa.
// Evita que un evento de cancelación de una suscripción vieja quite el acceso si ya
// tiene una nueva activa (p. ej. renovación anticipada o cambio de plan).
async function syncCustomerFromStripe(stripe, supabaseAdmin, customerId, fallbackSub) {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const subs = list.data;
  const activaSinCancelar = subs.find(s => ['active', 'trialing'].includes(s.status) && !s.cancel_at_period_end);
  const activa   = subs.find(s => ['active', 'trialing'].includes(s.status));
  const elegida  = activaSinCancelar || activa || fallbackSub || subs[0];
  if (elegida) await upsertFromSubscription(supabaseAdmin, elegida, null);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Método no permitido');
  }

  // A-4: try/catch global
  try {
    const stripe       = getStripe();
    const supabaseAdmin = getSupabaseAdmin();

    const rawBody = await readRawBody(req);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Firma inválida: ${err.message}`);
    }

    // C-3: idempotencia — si este event.id ya fue procesado devolvemos 200 inmediatamente.
    // Requiere la tabla webhook_events en Supabase (ver supabase/schema.sql).
    const { error: dupErr } = await supabaseAdmin
      .from('webhook_events')
      .insert({ event_id: event.id, type: event.type });

    if (dupErr?.code === '23505') {
      // Duplicado conocido: Stripe reenvió el evento, ya fue procesado
      return res.status(200).json({ received: true, duplicate: true });
    }
    if (dupErr) {
      // La tabla puede no existir aún — loggeamos pero NO bloqueamos el procesamiento
      console.warn('[stripe-webhook] webhook_events insert error (no bloqueante):', dupErr.message);
    }

    // Si el procesamiento falla, hay que BORRAR la marca de idempotencia antes de
    // devolver el 500. Si no, Stripe reintenta el evento, se choca con la fila que
    // ya existe, recibe un 200 "duplicate" y el evento se pierde para siempre: un
    // fallo pasajero de Supabase o de Stripe dejaba a un cliente que acaba de
    // pagar sin su fila en `subscriptions` (sin acceso) y sin forma de recuperarlo.
    const soltarMarcaIdempotencia = async () => {
      if (dupErr) return; // no se llegó a insertar, no hay nada que soltar
      try {
        await supabaseAdmin.from('webhook_events').delete().eq('event_id', event.id);
      } catch (e) {
        console.error('[stripe-webhook] no se pudo soltar la marca de idempotencia:', e.message);
      }
    };

    try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId  = session.client_reference_id || session.metadata?.supabase_user_id;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Oferta 1,99€: al terminar el primer mes pasa al plan que eligió el cliente
        // en el paywall (tipoPlan + periodicidad viajan en el metadata de la sesión).
        // Solo nutrición → 4,99€/mes. Completo → 7,99€/mes o 14,99€/trimestre.
        if (session.metadata?.oferta === 'si') {
          const esNutricion  = (session.metadata?.tipoPlan || '').includes('Solo nutrición');
          const esTrimestral = (session.metadata?.periodicidad || '') === 'trimestral';
          const siguientePriceId = esNutricion
            ? process.env.STRIPE_PRICE_NUTRICION_MENSUAL
            : (esTrimestral
                ? (process.env.STRIPE_PRICE_COMPLETO_TRIMESTRAL || process.env.STRIPE_PRICE_COMPLETO_MENSUAL)
                : process.env.STRIPE_PRICE_COMPLETO_MENSUAL);
          if (siguientePriceId) {
            try {
              await stripe.subscriptionSchedules.create({
                from_subscription: subscription.id,
                phases: [
                  {
                    items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
                    start_date: subscription.current_period_start,
                    end_date: subscription.current_period_end,
                  },
                  {
                    // Última fase SIN end_date ni iterations: así se renueva de forma
                    // indefinida. Ojo: no poner `iterations: null` — Stripe lo serializa
                    // como entero vacío y rechaza la llamada, y entonces el cliente se
                    // quedaría pagando 1,99€ para siempre sin que nadie se diera cuenta.
                    items: [{ price: siguientePriceId, quantity: 1 }],
                  }
                ],
              });
              console.log(`[stripe-webhook] Schedule creado: tras el mes de oferta pasa a ${siguientePriceId}`);
            } catch (schedErr) {
              // Si esto falla, el cliente seguiría al precio de la oferta indefinidamente
              // y antes solo quedaba constancia en los logs de Vercel, que nadie mira a
              // diario. Avisamos por email al admin para que lo corrija a mano en Stripe.
              console.error('[stripe-webhook] FALLO creando el schedule oferta→plan. El cliente se quedará a 1,99€ hasta que se corrija a mano:', schedErr.message);
              try {
                const { enviarEmail, ADMIN_EMAIL } = require('./notify');
                const apiKey = process.env.RESEND_API_KEY;
                if (apiKey) {
                  await enviarEmail(apiKey, {
                    from: 'K-ONE <equipo@k-one.fit>',
                    to: ADMIN_EMAIL,
                    subject: '⚠️ Fallo al programar el cambio de plan tras la oferta 1,99€',
                    html: `<p>No se pudo crear el subscriptionSchedule para el customer <b>${session.customer}</b> (subscription <b>${subscription.id}</b>).</p>
                           <p>Este cliente se quedará pagando 1,99€/mes de forma indefinida hasta que se corrija manualmente en el dashboard de Stripe.</p>
                           <p>Plan al que debía pasar: <b>${siguientePriceId}</b></p>
                           <p>Error: <code>${(schedErr.message || '').replace(/</g,'&lt;')}</code></p>`,
                  });
                }
              } catch (mailErr) {
                console.error('[stripe-webhook] además falló el aviso por email:', mailErr.message);
              }
            }
          }
        }

        await upsertFromSubscription(supabaseAdmin, subscription, userId);

        // REFERIDOS: si este usuario fue referido, acreditar 5€ al referrer (max 15€)
        // PAUSADO (2026-08): ver el mismo aviso en index.html (cargarReferidos). Se
        // deja de acreditar el descuento mientras el mes gratis está abierto a todo
        // el mundo; para reactivar, quitar el "if (false &&" de aquí.
        if (false && userId) {
          try {
            const { data: ref } = await supabaseAdmin.from('referidos')
              .select('id, referrer_id')
              .eq('referido_id', userId)
              .eq('estado', 'pendiente')
              .maybeSingle();
            if (ref) {
              await supabaseAdmin.from('referidos').update({ estado: 'pagado', pagado_at: new Date().toISOString() }).eq('id', ref.id);
              const { data: profile } = await supabaseAdmin.from('profiles')
                .select('descuento_referidos')
                .eq('id', ref.referrer_id)
                .maybeSingle();
              const actual = profile?.descuento_referidos || 0;
              if (actual < 15) {
                const nuevo = Math.min(actual + 5, 15);
                await supabaseAdmin.from('profiles').update({ descuento_referidos: nuevo }).eq('id', ref.referrer_id);
                console.log(`[stripe-webhook] Referido acreditado: +5€ a ${ref.referrer_id} (total: ${nuevo}€)`);
              }
            }
          } catch (refErr) {
            console.error('[stripe-webhook] Error procesando referido:', refErr.message);
          }
        }

        break;
      }
      case 'customer.subscription.updated': {
        const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
        await syncCustomerFromStripe(stripe, supabaseAdmin, subscription.customer, subscription);
        const prev = event.data.previous_attributes;

        // REFERIDOS: aplicar el descuento acumulado en la siguiente cuota del referrer.
        // Se usa un crédito en el SALDO del cliente (customer balance): Stripe lo aplica
        // automáticamente a la próxima factura. Es mucho más fiable que crear un cupón y
        // engancharlo a una factura "upcoming" (que no tiene id estable y suele fallar).
        if (subscription.status === 'active' && prev?.current_period_start) {
          try {
            // Resolver el usuario de Supabase: por metadata (suscripciones nuevas) o,
            // como fallback, por stripe_customer_id (suscripciones antiguas sin metadata).
            let refUserId = subscription.metadata?.supabase_user_id;
            if (!refUserId) {
              const { data: sub } = await supabaseAdmin.from('subscriptions')
                .select('user_id').eq('stripe_customer_id', subscription.customer).maybeSingle();
              refUserId = sub?.user_id;
            }
            if (refUserId) {
              const { data: prof } = await supabaseAdmin.from('profiles')
                .select('descuento_referidos')
                .eq('id', refUserId)
                .maybeSingle();
              const descuento = prof?.descuento_referidos || 0;
              if (descuento > 0) {
                await stripe.customers.createBalanceTransaction(subscription.customer, {
                  amount: -Math.round(descuento * 100), // negativo = crédito a favor del cliente
                  currency: 'eur',
                  description: `Descuento referidos K-ONE (${descuento}€)`
                });
                await supabaseAdmin.from('profiles').update({ descuento_referidos: 0 }).eq('id', refUserId);
                console.log(`[stripe-webhook] Crédito referidos ${descuento}€ aplicado al saldo de ${subscription.customer}`);
              }
            }
          } catch (discErr) {
            console.error('[stripe-webhook] Error aplicando descuento referidos:', discErr.message);
          }
        }

        if (subscription.status === 'active' && prev?.current_period_start) {
          try {
            let prof = null;
            if (subscription.metadata?.supabase_user_id) {
              const { data } = await supabaseAdmin.from('profiles')
                .select('nombre, email, userdata')
                .eq('id', subscription.metadata.supabase_user_id)
                .maybeSingle();
              prof = data;
            }
            if (!prof) {
              const { data: sub } = await supabaseAdmin.from('subscriptions')
                .select('user_id').eq('stripe_customer_id', subscription.customer).maybeSingle();
              if (sub?.user_id) {
                const { data } = await supabaseAdmin.from('profiles')
                  .select('nombre, email, userdata').eq('id', sub.user_id).maybeSingle();
                prof = data;
              }
            }
            if (prof?.email) {
              const ud = prof.userdata || {};
              const entrenos = String(Array.isArray(ud.historialEntrenos) ? ud.historialEntrenos.length : 0);
              const racha = String(ud.progreso?.mejorRacha || ud.progreso?.rachaActual || 0);
              const semana = String(ud.progreso?.semana || 1);
              const primerNombre = (prof.nombre || '').split(' ')[0] || 'Crack';
              const APP_URL = process.env.APP_URL || 'https://k-one.fit';
              const ADMIN_EMAIL = 'k.one.fit26@gmail.com';
              const apiKey = process.env.RESEND_API_KEY;
              if (apiKey) {
                fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: 'K-ONE <equipo@k-one.fit>',
                    to: [prof.email],
                    reply_to: ADMIN_EMAIL,
                    subject: `${primerNombre}, la constancia es tu mejor ejercicio — K-ONE`,
                    html: `<div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0"><div style="max-width:560px;margin:0 auto"><div style="background:#E8490F;padding:24px;text-align:center"><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div></div><div style="padding:32px 28px 0;text-align:center"><div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:rgba(232,73,15,0.12);font-size:28px;margin-bottom:12px">&#127942;</div><h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">La constancia es tu mejor ejercicio</h1></div><div style="padding:0 28px"><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${primerNombre}</span>,</p><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Tu suscripción se ha renovado y eso dice mucho de ti. La mayoría abandona después del primer mes — <span style="color:#F0EDE8;font-weight:500">tú has decidido seguir</span>. Esa disciplina vale más que cualquier plan de entrenamiento.</p><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Mira lo que has conseguido hasta ahora:</p><div style="background:#141414;border-radius:10px;padding:18px 20px;margin:0 0 18px"><div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:12px">TU PROGRESO</div><table style="width:100%;border-collapse:collapse;text-align:center"><tr><td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#27ae60">${entrenos}</div><div style="font-size:11px;color:#888;margin-top:2px">Entrenos</div></td><td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#E8490F">${racha}</div><div style="font-size:11px;color:#888;margin-top:2px">Mejor racha</div></td><td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#F0EDE8">S${semana}</div><div style="font-size:11px;color:#888;margin-top:2px">Semana</div></td></tr></table></div><div style="background:#141414;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 24px"><p style="margin:0;font-size:13px;color:#b5b2ad;line-height:1.6"><span style="color:#F0EDE8;font-weight:500">Nuevo mes, nuevo reto.</span> Tu plan se ha actualizado según tu progreso — entrenamiento y nutrición recalculados. No entrenas como el primer día porque ya no eres el del primer día.</p></div></div><div style="padding:0 28px 28px;text-align:center"><a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">VER MI NUEVO PLAN</a></div><div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center"><p style="color:#555;font-size:13px;margin:0">Equipo de K-<span style="color:#E8490F;font-weight:600">ONE</span></p></div></div></div>`
                  })
                }).catch(e => console.warn('[stripe-webhook] renovacion email error:', e.message));
                supabaseAdmin.from('email_log').insert({ tipo: 'renovacion', destinatario: prof.email, asunto: `${primerNombre}, la constancia es tu mejor ejercicio`, datos: JSON.stringify({ nombre: prof.nombre, entrenos, racha, semana, resumen: `Renovación: ${entrenos} entrenos, racha ${racha}, semana ${semana}.` }) }).then(() => {}).catch(() => {});
              }
            }
          } catch (e) { console.warn('[stripe-webhook] renovacion error:', e.message); }
        }

        // Aviso al CLIENTE cuando el cobro falla (status pasa a past_due).
        // Antes solo se enteraba el admin (digest interno) -- el cliente
        // dependía enteramente de los reintentos/emails automáticos de
        // Stripe (fuera de nuestro control) para saber que su tarjeta
        // falló. Solo se envía en la TRANSICIÓN a past_due (prev.status
        // existe y era distinto), no en cada webhook mientras sigue en
        // past_due -- si no, Stripe podría mandar varios "updated"
        // seguidos y el cliente recibiría el mismo aviso repetido.
        if (subscription.status === 'past_due' && prev?.status && prev.status !== 'past_due') {
          try {
            let prof = null;
            if (subscription.metadata?.supabase_user_id) {
              const { data } = await supabaseAdmin.from('profiles')
                .select('nombre, email').eq('id', subscription.metadata.supabase_user_id).maybeSingle();
              prof = data;
            }
            if (!prof) {
              const { data: sub } = await supabaseAdmin.from('subscriptions')
                .select('user_id').eq('stripe_customer_id', subscription.customer).maybeSingle();
              if (sub?.user_id) {
                const { data } = await supabaseAdmin.from('profiles')
                  .select('nombre, email').eq('id', sub.user_id).maybeSingle();
                prof = data;
              }
            }
            if (prof?.email) {
              const primerNombre = (prof.nombre || '').split(' ')[0] || 'Hola';
              const APP_URL = process.env.APP_URL || 'https://k-one.fit';
              const ADMIN_EMAIL = 'k.one.fit26@gmail.com';
              const apiKey = process.env.RESEND_API_KEY;
              if (apiKey) {
                fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: 'K-ONE <equipo@k-one.fit>',
                    to: [prof.email],
                    reply_to: ADMIN_EMAIL,
                    subject: `${primerNombre}, no hemos podido cobrar tu suscripción K-ONE`,
                    html: `<div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0"><div style="max-width:560px;margin:0 auto"><div style="background:#E8490F;padding:24px;text-align:center"><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div></div><div style="padding:32px 28px 0"><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${primerNombre}</span>,</p><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hemos intentado cobrar tu suscripción y el pago no se ha completado (tarjeta caducada, fondos insuficientes, o el banco lo ha rechazado). Sigues teniendo acceso a tu plan mientras lo intentamos de nuevo, pero si no se resuelve pronto tu acceso se pausará.</p><p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Actualiza tu método de pago para que no se interrumpa nada:</p></div><div style="padding:0 28px 28px;text-align:center"><a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">ACTUALIZAR MI PAGO</a></div><div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center"><p style="color:#555;font-size:13px;margin:0">Equipo de K-<span style="color:#E8490F;font-weight:600">ONE</span></p></div></div></div>`
                  })
                }).catch(e => console.warn('[stripe-webhook] pago-fallido email error:', e.message));
                supabaseAdmin.from('email_log').insert({ tipo: 'pago_fallido', destinatario: prof.email, asunto: `${primerNombre}, no hemos podido cobrar tu suscripción K-ONE`, datos: JSON.stringify({ nombre: prof.nombre }) }).then(() => {}).catch(() => {});
              }
            }
          } catch (e) { console.warn('[stripe-webhook] pago-fallido error:', e.message); }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
        await syncCustomerFromStripe(stripe, supabaseAdmin, subscription.customer, subscription);
        break;
      }
      default:
        break;
    }
    } catch (procErr) {
      await soltarMarcaIdempotencia();
      throw procErr;
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[stripe-webhook] error no controlado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
