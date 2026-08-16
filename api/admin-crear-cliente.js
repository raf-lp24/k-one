const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');

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

    const { email } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email válido requerido' });
    }

    const emailLower = email.trim().toLowerCase();

    const { error: insertErr } = await supabaseAdmin
      .from('invitaciones_premium')
      .upsert({ email: emailLower }, { onConflict: 'email' });

    if (insertErr) {
      console.error('[admin-crear-cliente] insert error:', insertErr.message);
      return res.status(500).json({ error: 'No se pudo guardar la invitación' });
    }

    return res.status(200).json({ ok: true, email: emailLower });
  } catch (err) {
    console.error('[admin-crear-cliente] error:', err);
    capturarError(err, { fn: 'admin-crear-cliente' });
    return res.status(500).json({ error: 'Error interno' });
  }
};
