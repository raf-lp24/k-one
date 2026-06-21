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

    const { nombre, email, password, premium } = req.body || {};
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'nombre, email y password son obligatorios' });
    }

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre }
    });

    if (createErr) {
      if (/already|registered|exists/i.test(createErr.message)) {
        return res.status(400).json({ error: 'Este email ya está registrado' });
      }
      return res.status(400).json({ error: createErr.message });
    }

    const userId = newUser.user.id;

    await supabaseAdmin.from('profiles').update({ nombre }).eq('id', userId);

    if (premium) {
      const expira = new Date();
      expira.setFullYear(expira.getFullYear() + 1);
      await supabaseAdmin.from('profiles').update({
        is_beta: true,
        beta_expires: expira.toISOString()
      }).eq('id', userId);
    }

    return res.status(200).json({ ok: true, userId });
  } catch (err) {
    console.error('[admin-crear-cliente] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
