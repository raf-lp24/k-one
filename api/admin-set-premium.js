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

    const { userId, premium } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    await supabaseAdmin.from('profiles').update({ is_beta: !!premium }).eq('id', userId);

    return res.status(200).json({ ok: true, is_beta: !!premium });
  } catch (err) {
    console.error('[admin-set-premium] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
