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
    } else if (accion === 'email_gestionado') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { data: row } = await supabaseAdmin.from('email_log').select('datos').eq('id', id).single();
      let datos = {};
      try { datos = typeof row?.datos === 'string' ? JSON.parse(row.datos) : (row?.datos || {}); } catch(e) {}
      datos.gestionado = true;
      datos.gestionado_at = new Date().toISOString();
      const { error: e } = await supabaseAdmin.from('email_log').update({ datos: JSON.stringify(datos) }).eq('id', id);
      if (e) { console.error('[admin-mensaje] email_gestionado error:', e.message); return res.status(500).json({ error: 'Error marcando email' }); }
    } else if (accion === 'borrar_cliente') {
      if (!userId) return res.status(400).json({ error: 'userId requerido' });
      if (userId === admin.id) return res.status(400).json({ error: 'No puedes borrar tu propia cuenta' });
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
