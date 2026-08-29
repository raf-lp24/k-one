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

    const { userId, premium } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    // supabase-js no lanza en errores de query (devuelve {data, error}) -- sin
    // comprobar esto, un fallo de la UPDATE o un userId que no coincide con
    // ningún perfil devolvían igualmente {ok:true}, así que un admin podía
    // creer que había concedido o revocado premium y en realidad no había
    // pasado nada.
    if (premium) {
      const expira = new Date();
      expira.setFullYear(expira.getFullYear() + 1);
      const { data, error } = await supabaseAdmin.from('profiles').update({
        is_beta: true,
        beta_expires: expira.toISOString()
      }).eq('id', userId).select('id');
      if (error) {
        console.error('[admin-set-premium] update falló:', error.message);
        return res.status(500).json({ error: 'No se pudo conceder premium' });
      }
      if (!data || !data.length) {
        return res.status(404).json({ error: 'No existe ningún cliente con ese userId' });
      }
      return res.status(200).json({ ok: true, is_beta: true, beta_expires: expira.toISOString() });
    } else {
      const { data, error } = await supabaseAdmin.from('profiles').update({
        is_beta: false,
        beta_expires: null
      }).eq('id', userId).select('id');
      if (error) {
        console.error('[admin-set-premium] update falló:', error.message);
        return res.status(500).json({ error: 'No se pudo revocar premium' });
      }
      if (!data || !data.length) {
        return res.status(404).json({ error: 'No existe ningún cliente con ese userId' });
      }
      return res.status(200).json({ ok: true, is_beta: false });
    }
  } catch (err) {
    console.error('[admin-set-premium] error:', err);
    capturarError(err, { fn: 'admin-set-premium' });
    return res.status(500).json({ error: 'Error interno' });
  }
};
