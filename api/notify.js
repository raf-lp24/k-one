// Envía emails de notificación (leads, opiniones) y email de bienvenida al lead.
// Usa Resend (resend.com) — gratis hasta 100 emails/día.
// Variable de entorno necesaria: RESEND_API_KEY

const ADMIN_EMAIL = 'k.one.fit26@gmail.com';
const APP_URL = 'https://k-one-six.vercel.app';

function enviarEmail(apiKey, { from, to, subject, html }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html })
  });
}

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

    const emails = [];

    if (tipo === 'lead') {
      // 1) Notificación al admin
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nuevo lead: ${datos.email}`,
        html: `
          <h2 style="color:#E8490F">Nuevo lead en K-ONE</h2>
          <p><strong>Email:</strong> ${datos.email}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
          <p style="color:#888;font-size:12px">Se ha registrado desde el formulario "Avísame de ofertas" de la landing.</p>
        `
      }));

      // 2) Email de bienvenida al lead
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <onboarding@resend.dev>',
        to: datos.email,
        subject: 'Tu plan de entrenamiento y nutrición te está esperando — K-ONE',
        html: `
          <div style="background:#0b0b0b;padding:40px 20px;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">

              <div style="text-align:center;margin-bottom:32px">
                <span style="font-size:28px;font-weight:800;letter-spacing:2px;color:#fff">K-<span style="color:#E8490F">ONE</span></span>
              </div>

              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin-bottom:8px;text-align:center">
                Tu plan personalizado te está esperando
              </h1>

              <p style="color:#b5b2ad;font-size:15px;line-height:1.7;text-align:center;margin-bottom:28px">
                Gracias por tu interés en K-ONE. Esto es lo que vas a encontrar cuando des el paso:
              </p>

              <div style="background:#141414;border-left:3px solid #E8490F;padding:20px 24px;margin-bottom:16px">
                <p style="margin:0 0 6px;font-weight:700;color:#fff;font-size:14px">Plan de entrenamiento adaptado a ti</p>
                <p style="margin:0;color:#b5b2ad;font-size:13px;line-height:1.6">Según tu deporte (gimnasio, running, CrossFit, Hyrox o combinación), tu nivel, tus días disponibles y tus lesiones. No es un PDF genérico: se recalcula cada semana según tu progreso real.</p>
              </div>

              <div style="background:#141414;border-left:3px solid #E8490F;padding:20px 24px;margin-bottom:16px">
                <p style="margin:0 0 6px;font-weight:700;color:#fff;font-size:14px">Plan de nutrición con 5 opciones por comida</p>
                <p style="margin:0;color:#b5b2ad;font-size:13px;line-height:1.6">5 tomas al día, cada una con 5 opciones distintas. Calorías y proteínas calculadas con tu peso, altura, edad y objetivo. Con recetario paso a paso.</p>
              </div>

              <div style="background:#141414;border-left:3px solid #E8490F;padding:20px 24px;margin-bottom:16px">
                <p style="margin:0 0 6px;font-weight:700;color:#fff;font-size:14px">Check-in semanal que adapta tu plan</p>
                <p style="margin:0;color:#b5b2ad;font-size:13px;line-height:1.6">Cada semana nos cuentas cómo te fue y el plan se ajusta: más volumen si vas sobrado, menos carga si necesitas recuperar. Sin apps genéricas que te dejan solo.</p>
              </div>

              <div style="background:#141414;border-left:3px solid #E8490F;padding:20px 24px;margin-bottom:28px">
                <p style="margin:0 0 6px;font-weight:700;color:#fff;font-size:14px">Todo por 0,99€ el primer mes</p>
                <p style="margin:0;color:#b5b2ad;font-size:13px;line-height:1.6">Sin compromiso. Si no te convence, cancelas con un clic antes de que termine el mes. Sin llamadas, sin formularios, sin excusas.</p>
              </div>

              <div style="text-align:center;margin-bottom:32px">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:14px 36px;font-size:15px;font-weight:700;letter-spacing:0.5px">EMPIEZA POR 0,99€ →</a>
              </div>

              <p style="color:#666;font-size:11px;text-align:center;line-height:1.6;margin-top:32px;border-top:1px solid #222;padding-top:20px">
                Recibes este email porque dejaste tu dirección en k-one-six.vercel.app.<br>
                Si no fuiste tú, ignora este mensaje.<br><br>
                K-ONE · R. López Pinto · Alcalá de Henares, Madrid<br>
                <a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F">k.one.fit26@gmail.com</a>
              </p>

            </div>
          </div>
        `
      }));

    } else if (tipo === 'opinion') {
      const estrellas = '★'.repeat(datos.estrellas || 0) + '☆'.repeat(5 - (datos.estrellas || 0));
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nueva opinión: ${datos.nombre} (${datos.estrellas}★)`,
        html: `
          <h2 style="color:#E8490F">Nueva opinión en K-ONE</h2>
          <p><strong>Nombre:</strong> ${datos.nombre || 'Anónimo'}</p>
          <p><strong>Valoración:</strong> <span style="color:#E8490F;font-size:18px">${estrellas}</span></p>
          <p><strong>Texto:</strong> ${datos.texto || '(sin texto)'}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        `
      }));
    } else {
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `K-ONE · Notificación: ${tipo}`,
        html: `<pre>${JSON.stringify(datos, null, 2)}</pre>`
      }));
    }

    const results = await Promise.allSettled(emails);
    results.forEach((r, i) => {
      if (r.status === 'rejected' || (r.value && !r.value.ok)) {
        console.error(`[notify] Email ${i} error:`, r.reason || r.value?.statusText);
      }
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err);
    return res.status(200).json({ ok: true });
  }
};
