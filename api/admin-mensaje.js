const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

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

    if (accion === 'gestionado') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { error: e } = await supabaseAdmin.from('mensajes_cliente').update({ respuesta: 'Gestionado' }).eq('id', id);
      if (e) { console.error('[admin-mensaje] gestionado error:', e.message); return res.status(500).json({ error: 'Error actualizando mensaje' }); }
    } else if (accion === 'eliminar') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { error: e } = await supabaseAdmin.from('mensajes_cliente').delete().eq('id', id);
      if (e) { console.error('[admin-mensaje] eliminar error:', e.message); return res.status(500).json({ error: 'Error eliminando mensaje' }); }
    } else if (accion === 'eliminar_email') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { error: e } = await supabaseAdmin.from('email_log').delete().eq('id', id);
      if (e) { console.error('[admin-mensaje] eliminar_email error:', e.message); return res.status(500).json({ error: 'Error eliminando email' }); }
    } else if (accion === 'eliminar_emails_masivo') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
      if (!ids.length) return res.status(400).json({ error: 'ids requerido' });
      const { error: e } = await supabaseAdmin.from('email_log').delete().in('id', ids);
      if (e) { console.error('[admin-mensaje] eliminar_emails_masivo error:', e.message); return res.status(500).json({ error: 'Error eliminando emails' }); }
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
      const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_subscription_id, stripe_customer_id').eq('user_id', userId).maybeSingle();
      if (sub?.stripe_subscription_id) {
        try {
          const { getStripe } = require('./_stripeHelpers');
          await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
        } catch (stripeErr) { console.warn('[admin-mensaje] stripe cancel error:', stripeErr.message); }
      }
      // Cancelar la suscripción NO borra el Customer de Stripe: el email se
      // quedaba "colgado" ahí para siempre, así que un cliente borrado desde
      // Jarvis podía toparse luego con un Customer huérfano en Stripe si
      // volvía a registrarse. Se borra también aquí.
      if (sub?.stripe_customer_id) {
        try {
          const { getStripe } = require('./_stripeHelpers');
          await getStripe().customers.del(sub.stripe_customer_id);
        } catch (stripeErr) { console.warn('[admin-mensaje] stripe customer delete error:', stripeErr.message); }
      }
      await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) {
        console.error('[admin-mensaje] borrar_cliente auth error:', authErr);
        return res.status(500).json({ error: 'Error eliminando usuario' });
      }
    } else {
      return res.status(400).json({ error: 'Acción no válida' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-mensaje] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
