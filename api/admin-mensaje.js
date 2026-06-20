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

    const { id, accion } = req.body || {};
    if (!id || !accion) return res.status(400).json({ error: 'id y accion requeridos' });

    if (accion === 'gestionado') {
      await supabaseAdmin.from('mensajes_cliente').update({ respuesta: 'Gestionado' }).eq('id', id);
    } else if (accion === 'eliminar') {
      await supabaseAdmin.from('mensajes_cliente').delete().eq('id', id);
    } else {
      return res.status(400).json({ error: 'Acción no válida' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-mensaje] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
