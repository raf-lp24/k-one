const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return res.status(200).json({ isAdmin: false });
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return res.status(200).json({ isAdmin: admins.includes((user.email || '').toLowerCase()) });
  } catch {
    return res.status(200).json({ isAdmin: false });
  }
};
