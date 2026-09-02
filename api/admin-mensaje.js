const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');
// require('./notify') es solo un import de módulo (reutiliza enviarEmail),
// no crea una función serverless nueva -- no cuenta para el límite de
// Vercel (ya en 12/12), igual que ya hace stripe-webhook.js.
const { enviarEmail } = require('./notify');

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const admin = await getAuthUser(req, supabaseAdmin);
    if (!admin) return res.status(401).json({ error: 'No autenticado' });

    const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(admin.email.toLowerCase())) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { id, accion, userId } = req.body || {};
    if (!accion) return res.status(400).json({ error: 'accion requerida' });

    // supabase-js no lanza en errores de query (devuelve {data, error}), y un
    // eq()/in() que no coincide con ninguna fila también devuelve {error:null}
    // -- sin comprobar el número de filas afectadas (.select('id') + longitud),
    // un id/ids ya borrado o mal escrito devolvía igualmente {ok:true} y el
    // admin creía haber actualizado o borrado algo que en realidad no existía.
    if (accion === 'gestionado') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { data, error: e } = await supabaseAdmin.from('mensajes_cliente').update({ respuesta: 'Gestionado' }).eq('id', id).select('id');
      if (e) { console.error('[admin-mensaje] gestionado error:', e.message); return res.status(500).json({ error: 'Error actualizando mensaje' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ese mensaje' });
    } else if (accion === 'responder_mensaje') {
      // Guarda la respuesta como un mensaje más del hilo (mensajes_respuestas)
      // -- así el cliente la ve dentro de la app, como conversación -- y
      // ADEMÁS manda el email de siempre, en paralelo. Antes el botón
      // "Responder" solo abría Gmail con un correo suelto que nunca quedaba
      // guardado en ningún sitio.
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const texto = (req.body?.texto ?? '').toString().trim().slice(0, 5000);
      if (!texto) return res.status(400).json({ error: 'texto requerido' });

      const { data: mensaje, error: eGet } = await supabaseAdmin
        .from('mensajes_cliente').select('id, nombre, email, asunto').eq('id', id).maybeSingle();
      if (eGet) { console.error('[admin-mensaje] responder_mensaje get error:', eGet.message); return res.status(500).json({ error: 'Error leyendo el mensaje' }); }
      if (!mensaje) return res.status(404).json({ error: 'No existe ese mensaje' });

      const { error: eIns } = await supabaseAdmin
        .from('mensajes_respuestas').insert({ mensaje_id: id, autor: 'admin', texto });
      if (eIns) { console.error('[admin-mensaje] responder_mensaje insert error:', eIns.message); return res.status(500).json({ error: 'Error guardando la respuesta' }); }

      // Marca el hilo como gestionado igual que el botón "Gestionado" -- una
      // respuesta real siempre cuenta como gestionado, no hace falta pulsar
      // los dos botones para que desaparezca de "pendientes".
      const { error: eUpd } = await supabaseAdmin.from('mensajes_cliente').update({ respuesta: 'Gestionado' }).eq('id', id);
      if (eUpd) console.warn('[admin-mensaje] responder_mensaje: no se pudo marcar gestionado:', eUpd.message);

      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        try {
          // "asunto" lo escribe el cliente desde un desplegable en la UI, pero
          // el insert real es un supabase.insert() directo desde el navegador
          // (RLS solo comprueba user_id, no el contenido) -- a diferencia de
          // "texto" (acotado arriba con .slice(0,5000)), esto viajaba tal
          // cual al Subject del email. Quita saltos de línea (por higiene,
          // aunque Resend recibe JSON y no texto crudo de cabeceras) y lo
          // acota a una longitud razonable para un asunto.
          const asuntoSeguro = (mensaje.asunto || '').replace(/[\r\n]+/g, ' ').slice(0, 150);
          await enviarEmail(apiKey, {
            from: 'K-ONE <equipo@k-one.fit>',
            reply_to: 'k.one.fit26@gmail.com',
            to: mensaje.email,
            subject: `Re: ${asuntoSeguro} — K-ONE`,
            html: `
              <div style="background:#0b0b0b;padding:32px 20px;font-family:Arial,sans-serif;color:#e0e0e0">
                <div style="max-width:520px;margin:0 auto">
                  <div style="margin-bottom:20px">
                    <span style="font-size:22px;font-weight:800;color:#fff">K-<span style="color:#E8490F">ONE</span></span>
                  </div>
                  <p style="margin:0 0 16px;color:#e0e0e0">Hola ${escHtml(mensaje.nombre)},</p>
                  <div style="background:#141414;border-left:3px solid #E8490F;padding:18px 22px;margin-bottom:16px">
                    <p style="margin:0;color:#e0e0e0;line-height:1.6;font-size:14px;white-space:pre-wrap">${escHtml(texto)}</p>
                  </div>
                  <p style="color:#888;font-size:12px;margin:0 0 4px">También puedes ver y seguir esta conversación desde la app, en Contacto.</p>
                  <p style="color:#555;font-size:11px;margin:0">Responde a este email si quieres contestarnos directamente.</p>
                </div>
              </div>
            `
          });
        } catch (mailErr) {
          console.error('[admin-mensaje] responder_mensaje email error:', mailErr.message);
          // No es un fallo del "responder": la respuesta ya quedó guardada y
          // visible en la app aunque el email fallase. Se avisa sin romper.
        }
      } else {
        console.warn('[admin-mensaje] RESEND_API_KEY no configurada, email de respuesta no enviado');
      }
    } else if (accion === 'eliminar') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { data, error: e } = await supabaseAdmin.from('mensajes_cliente').delete().eq('id', id).select('id');
      if (e) { console.error('[admin-mensaje] eliminar error:', e.message); return res.status(500).json({ error: 'Error eliminando mensaje' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ese mensaje' });
    } else if (accion === 'mensajes_masivo_gestionado') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
      if (!ids.length) return res.status(400).json({ error: 'ids requerido' });
      const { data, error: e } = await supabaseAdmin.from('mensajes_cliente').update({ respuesta: 'Gestionado' }).in('id', ids).select('id');
      if (e) { console.error('[admin-mensaje] mensajes_masivo_gestionado error:', e.message); return res.status(500).json({ error: 'Error actualizando mensajes' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ninguno de esos mensajes' });
    } else if (accion === 'eliminar_mensajes_masivo') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
      if (!ids.length) return res.status(400).json({ error: 'ids requerido' });
      const { data, error: e } = await supabaseAdmin.from('mensajes_cliente').delete().in('id', ids).select('id');
      if (e) { console.error('[admin-mensaje] eliminar_mensajes_masivo error:', e.message); return res.status(500).json({ error: 'Error eliminando mensajes' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ninguno de esos mensajes' });
    } else if (accion === 'eliminar_leads_masivo') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
      if (!ids.length) return res.status(400).json({ error: 'ids requerido' });
      const { data, error: e } = await supabaseAdmin.from('leads').delete().in('id', ids).select('id');
      if (e) { console.error('[admin-mensaje] eliminar_leads_masivo error:', e.message); return res.status(500).json({ error: 'Error eliminando leads' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ninguno de esos leads' });
    } else if (accion === 'eliminar_email') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { data, error: e } = await supabaseAdmin.from('email_log').delete().eq('id', id).select('id');
      if (e) { console.error('[admin-mensaje] eliminar_email error:', e.message); return res.status(500).json({ error: 'Error eliminando email' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ese email' });
    } else if (accion === 'eliminar_emails_masivo') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
      if (!ids.length) return res.status(400).json({ error: 'ids requerido' });
      const { data, error: e } = await supabaseAdmin.from('email_log').delete().in('id', ids).select('id');
      if (e) { console.error('[admin-mensaje] eliminar_emails_masivo error:', e.message); return res.status(500).json({ error: 'Error eliminando emails' }); }
      if (!data || !data.length) return res.status(404).json({ error: 'No existe ninguno de esos emails' });
    } else if (accion === 'email_gestionado') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { data: row } = await supabaseAdmin.from('email_log').select('datos').eq('id', id).single();
      let datos = {};
      try { datos = typeof row?.datos === 'string' ? JSON.parse(row.datos) : (row?.datos || {}); } catch(e) {}
      datos.gestionado = true;
      datos.gestionado_at = new Date().toISOString();
      const { error: e } = await supabaseAdmin.from('email_log').update({ datos: JSON.stringify(datos) }).eq('id', id);
      if (e) { console.error('[admin-mensaje] email_gestionado error:', e.message); return res.status(500).json({ error: 'Error marcando email' }); }
    } else if (accion === 'guardar_nota') {
      if (!userId) return res.status(400).json({ error: 'userId requerido' });
      const nota = (req.body?.nota ?? '').toString().slice(0, 2000);
      const { error: e } = await supabaseAdmin.from('profiles').update({ nota_admin: nota }).eq('id', userId);
      if (e) { console.error('[admin-mensaje] guardar_nota error:', e.message); return res.status(500).json({ error: 'No se pudo guardar la nota (¿falta la columna nota_admin?)' }); }
    } else if (accion === 'borrar_cliente') {
      if (!userId) return res.status(400).json({ error: 'userId requerido' });
      if (userId === admin.id) return res.status(400).json({ error: 'No puedes borrar tu propia cuenta' });
      const { data: perfilBorrar } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).maybeSingle();
      const emailBorrar = perfilBorrar?.email || null;
      const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_subscription_id, stripe_customer_id').eq('user_id', userId).maybeSingle();
      // Avisos de limpieza incompleta en Stripe: antes se tragaban en silencio
      // (solo console.warn, invisible salvo mirando los logs de Vercel). Si el
      // Customer de Stripe no se llega a borrar, se queda con su historial de
      // suscripción real -- inofensivo mientras nadie lo reutilice, pero si
      // alguna vez se busca ese Customer por email en vez de por
      // supabase_user_id (o Stripe cambia de comportamiento), un cliente que
      // se registre de nuevo con el mismo email podría heredar ese historial y
      // perder la elegibilidad para la oferta/código de bienvenida sin que
      // nadie entienda por qué. Se avisa al admin en la propia respuesta para
      // que sepa que tiene que borrar el Customer a mano en el dashboard de
      // Stripe si esto ocurre.
      const avisos = [];
      // Stripe devuelve code:'resource_missing' cuando el objeto (suscripción o
      // Customer) ya no existe ahí -- no es un fallo del borrado, es que ya no
      // había nada que borrar (se borró antes, o el ID en Supabase estaba
      // desactualizado). En ese caso no hay ningún aviso real que dar: decirle
      // al admin "bórralo a mano en el dashboard" sobre algo que Stripe dice
      // que no existe es una instrucción imposible de seguir y solo confunde.
      if (sub?.stripe_subscription_id) {
        try {
          const { getStripe } = require('./_stripeHelpers');
          await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
        } catch (stripeErr) {
          if (stripeErr.code !== 'resource_missing') {
            console.warn('[admin-mensaje] stripe cancel error:', stripeErr.message);
            avisos.push(`No se pudo cancelar la suscripción de Stripe (${sub.stripe_subscription_id}): ${stripeErr.message}`);
          }
        }
      }
      // Cancelar la suscripción NO borra el Customer de Stripe: el email se
      // quedaba "colgado" ahí para siempre, así que un cliente borrado desde
      // Jarvis podía toparse luego con un Customer huérfano en Stripe si
      // volvía a registrarse. Se borra también aquí.
      if (sub?.stripe_customer_id) {
        try {
          const { getStripe } = require('./_stripeHelpers');
          await getStripe().customers.del(sub.stripe_customer_id);
        } catch (stripeErr) {
          if (stripeErr.code !== 'resource_missing') {
            console.warn('[admin-mensaje] stripe customer delete error:', stripeErr.message);
            avisos.push(`No se pudo borrar el Customer de Stripe (${sub.stripe_customer_id}): ${stripeErr.message}. Bórralo a mano en el dashboard de Stripe.`);
          }
        }
      }
      // Se borra el usuario de Auth ANTES que profiles/subscriptions (a propósito:
      // antes se borraban esas dos tablas primero y, si el borrado de Auth fallaba
      // después, la función devolvía 500 pero el perfil y la suscripción ya
      // estaban borrados -- quedaba una cuenta de Auth huérfana, sin perfil, que
      // podía seguir logueándose y rompía cualquier parte de la app que asume que
      // el perfil existe). profiles y subscriptions tienen FK a auth.users con
      // "on delete cascade", así que borrar primero el usuario de Auth ya las
      // limpia solas; los deletes explícitos de abajo quedan como red de
      // seguridad (no fallan si la fila ya no existe).
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) {
        console.error('[admin-mensaje] borrar_cliente auth error:', authErr);
        return res.status(500).json({ error: 'Error eliminando usuario' });
      }
      await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);

      // Rastro fuera de las tablas con FK a auth.users (esas se limpian solas por
      // "on delete cascade": profiles, subscriptions, referidos, canjes_promo,
      // hitos_canjes). Estas otras guardan el dato por user_id/email sin FK, así
      // que sobrevivían al borrado y el cliente podía "reaparecer" (mensajes
      // antiguos en el panel, emails de retención contando el historial, una
      // invitación premium todavía activa para ese email).
      // OJO: supabase-js no lanza en errores de query, devuelve {error} -- por
      // eso se comprueba explícitamente en vez de fiarse de un try/catch.
      const { error: eMsj } = await supabaseAdmin.from('mensajes_cliente').delete().eq('user_id', userId);
      if (eMsj) avisos.push(`No se pudieron borrar los mensajes del cliente: ${eMsj.message}`);
      if (emailBorrar) {
        const { error: eLog } = await supabaseAdmin.from('email_log').delete().eq('destinatario', emailBorrar);
        if (eLog) avisos.push(`No se pudo borrar el historial de emails: ${eLog.message}`);
        const { error: eInv } = await supabaseAdmin.from('invitaciones_premium').delete().eq('email', emailBorrar);
        if (eInv) avisos.push(`No se pudo borrar la invitación premium: ${eInv.message}`);
        const { error: eLead } = await supabaseAdmin.from('leads').delete().eq('email', emailBorrar);
        if (eLead) avisos.push(`No se pudo borrar el lead: ${eLead.message}`);
      }

      if (avisos.length) {
        return res.status(200).json({ ok: true, avisos });
      }
    } else {
      return res.status(400).json({ error: 'Acción no válida' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-mensaje] error:', err);
    capturarError(err, { fn: 'admin-mensaje' });
    return res.status(500).json({ error: 'Error interno' });
  }
};
