// Envía un email de notificación al admin cuando llega un lead o una opinión.
// Usa Resend (resend.com) — gratis hasta 100 emails/día.
// Variable de entorno necesaria: RESEND_API_KEY

const ADMIN_EMAIL = 'k.one.fit26@gmail.com';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[notify] RESEND_API_KEY no configurada, email no enviado');
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    const { tipo, datos } = req.body || {};
    if (!tipo || !datos) {
      return res.status(400).json({ error: 'tipo y datos son obligatorios' });
    }

    let subject, html;

    if (tipo === 'lead') {
      subject = `K-ONE · Nuevo lead: ${datos.email}`;
      html = `
        <h2 style="color:#E8490F">Nuevo lead en K-ONE</h2>
        <p><strong>Email:</strong> ${datos.email}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        <p style="color:#888;font-size:12px">Se ha registrado desde el formulario "Avísame de ofertas" de la landing.</p>
      `;
    } else if (tipo === 'opinion') {
      const estrellas = '★'.repeat(datos.estrellas || 0) + '☆'.repeat(5 - (datos.estrellas || 0));
      subject = `K-ONE · Nueva opinión: ${datos.nombre} (${datos.estrellas}★)`;
      html = `
        <h2 style="color:#E8490F">Nueva opinión en K-ONE</h2>
        <p><strong>Nombre:</strong> ${datos.nombre || 'Anónimo'}</p>
        <p><strong>Valoración:</strong> <span style="color:#E8490F;font-size:18px">${estrellas}</span></p>
        <p><strong>Texto:</strong> ${datos.texto || '(sin texto)'}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
      `;
    } else {
      subject = `K-ONE · Notificación: ${tipo}`;
      html = `<pre>${JSON.stringify(datos, null, 2)}</pre>`;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'K-ONE <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject,
        html
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[notify] Resend error:', err);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err);
    return res.status(200).json({ ok: true });
  }
};
