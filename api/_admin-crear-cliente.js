const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');
const { concederPremium } = require('./_premium');

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

    // Si ese email YA tiene cuenta, la invitación no le llegaba nunca: solo se
    // canjea al entrar en la app y, mientras tanto, el cliente seguía viendo el
    // muro de pago (y metía la tarjeta). Se le concede el premium ya, y se
    // cancela lo que tuviera en Stripe para que no se le cobre nada.
    // ilike con _ y % escapados: son comodines y un email puede llevar "_".
    const patron = emailLower.replace(/[\\%_]/g, c => '\\' + c);
    const { data: perfiles, error: buscarErr } = await supabaseAdmin
      .from('profiles').select('id').ilike('email', patron).limit(1);
    if (buscarErr) console.warn('[admin-crear-cliente] búsqueda de perfil falló:', buscarErr.message);
    if (perfiles && perfiles.length) {
      const r = await concederPremium(supabaseAdmin, perfiles[0].id);
      if (!r.ok) {
        console.error('[admin-crear-cliente] conceder premium falló:', r.error);
        return res.status(500).json({ error: 'No se pudo conceder el premium' });
      }
      if (r.avisos.length) console.warn('[admin-crear-cliente] Stripe:', r.avisos.join(' | '));
      return res.status(200).json({ ok: true, email: emailLower, yaRegistrado: true, stripeCanceladas: r.canceladas, avisos: r.avisos });
    }

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
