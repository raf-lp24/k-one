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

    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    if (userId === admin.id) {
      return res.status(400).json({ error: 'No puedes borrar tu propia cuenta' });
    }

    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('[admin-borrar-cliente] auth delete error:', authErr);
      return res.status(500).json({ error: 'Error eliminando usuario de auth: ' + authErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-borrar-cliente] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
