// Envía emails de notificación (leads, opiniones) y email de bienvenida al lead.
// Usa Resend (resend.com) — gratis hasta 100 emails/día.
// Variable de entorno necesaria: RESEND_API_KEY

const { getSupabaseAdmin } = require('./_stripeHelpers');
const ADMIN_EMAIL = 'k.one.fit26@gmail.com';
const APP_URL = 'https://k-one.fit';

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

      // 2) Email de bienvenida al lead con ejemplo real del plan
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <onboarding@resend.dev>',
        to: datos.email,
        subject: 'Así es un día dentro de K-ONE — mira tu plan',
        html: `
          <div style="background:#0b0b0b;padding:40px 20px;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">

              <div style="text-align:center;margin-bottom:32px">
                <span style="font-size:28px;font-weight:800;letter-spacing:2px;color:#fff">K-<span style="color:#E8490F">ONE</span></span>
              </div>

              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin-bottom:8px;text-align:center">
                Esto es lo que recibirías hoy
              </h1>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;text-align:center;margin-bottom:28px">
                Un ejemplo real de un día dentro de K-ONE. Tu plan se adapta a tu deporte, nivel, objetivo y lesiones — esto es solo una muestra.
              </p>

              <!-- ENTRENAMIENTO -->
              <div style="background:#141414;padding:24px;margin-bottom:4px">
                <p style="margin:0 0 2px;font-size:10px;letter-spacing:2px;color:#E8490F;text-transform:uppercase;font-family:monospace">// Entrenamiento de hoy</p>
                <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#fff">Lunes — Tren superior (Fuerza)</p>

                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff;font-weight:600">Press banca</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">4×8</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff;font-weight:600">Remo con mancuerna</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">4×10</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff;font-weight:600">Press militar</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">3×10</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff;font-weight:600">Jalón al pecho</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">3×12</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff;font-weight:600">Curl bíceps + tríceps polea</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">3×12</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#fff;font-weight:600">Elevaciones laterales</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">3×15</td>
                  </tr>
                </table>
                <p style="margin:12px 0 0;font-size:11px;color:#666;font-style:italic">Descanso entre series: 60-90s. Peso que cueste las 2 últimas reps.</p>
              </div>

              <!-- NUTRICIÓN -->
              <div style="background:#141414;padding:24px;margin-bottom:4px">
                <p style="margin:0 0 2px;font-size:10px;letter-spacing:2px;color:#E8490F;text-transform:uppercase;font-family:monospace">// Nutrición — Comida (ejemplo)</p>
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#fff">Pollo a la plancha con arroz y verduras</p>
                <p style="margin:0 0 12px;font-size:12px;color:#b5b2ad">180g pechuga de pollo, 150g arroz integral, 200g brócoli al vapor, 1 cda AOVE</p>
                <div style="display:flex;gap:12px;flex-wrap:wrap">
                  <span style="background:#1a1a1a;padding:4px 10px;font-size:11px;color:#b5b2ad;font-family:monospace">520 kcal</span>
                  <span style="background:#1a1a1a;padding:4px 10px;font-size:11px;color:#b5b2ad;font-family:monospace">42g prot</span>
                  <span style="background:#1a1a1a;padding:4px 10px;font-size:11px;color:#b5b2ad;font-family:monospace">48g carbs</span>
                  <span style="background:#1a1a1a;padding:4px 10px;font-size:11px;color:#b5b2ad;font-family:monospace">14g grasa</span>
                </div>
                <p style="margin:12px 0 0;font-size:11px;color:#666;font-style:italic">Esta es 1 de las 5 opciones que tendrías para esta toma. Cada comida tiene 5 alternativas.</p>
              </div>

              <!-- OTRAS COMIDAS -->
              <div style="background:#141414;padding:24px;margin-bottom:4px">
                <p style="margin:0 0 2px;font-size:10px;letter-spacing:2px;color:#E8490F;text-transform:uppercase;font-family:monospace">// El resto de tu día</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff">Desayuno</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">Tortilla de claras con avena y fruta</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff">Media mañana</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">Yogur griego con nueces</td>
                  </tr>
                  <tr style="border-bottom:1px solid #222">
                    <td style="padding:8px 0;color:#fff">Merienda</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">Tostada de pavo con aguacate</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#fff">Cena</td>
                    <td style="padding:8px 0;color:#b5b2ad;text-align:right">Salmón al horno con patata y ensalada</td>
                  </tr>
                </table>
                <p style="margin:12px 0 0;font-size:11px;color:#666;font-style:italic">Calorías y gramos ajustados a tu peso, altura, edad y objetivo. Nada inventado.</p>
              </div>

              <!-- CTA -->
              <div style="background:#141414;padding:28px 24px;margin-bottom:24px;text-align:center">
                <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#fff">Tu primer mes por 0,99€</p>
                <p style="margin:0 0 16px;font-size:13px;color:#b5b2ad">Sin compromiso. Cancelas cuando quieras con un clic.</p>
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:14px 36px;font-size:15px;font-weight:700;letter-spacing:0.5px">QUIERO MI PLAN →</a>
              </div>

              <p style="color:#666;font-size:11px;text-align:center;line-height:1.6;border-top:1px solid #222;padding-top:20px">
                Recibes este email porque dejaste tu dirección en nuestra web.<br>
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

    // Guardar historial de emails enviados
    try {
      const supa = getSupabaseAdmin();
      const destinatario = tipo === 'lead' ? datos.email : (tipo === 'opinion' ? datos.nombre : ADMIN_EMAIL);
      const asunto = tipo === 'lead' ? 'Ejemplo de plan K-ONE' : tipo === 'opinion' ? `Nueva opinión de ${datos.nombre}` : tipo;
      await supa.from('email_log').insert({
        tipo,
        destinatario,
        asunto,
        datos: JSON.stringify(datos)
      });
    } catch (e) {}

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err);
    return res.status(200).json({ ok: true });
  }
};
