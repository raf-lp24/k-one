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
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nuevo lead: ${datos.email}`,
        html: `
          <h2 style="color:#E8490F">Nuevo lead en K-ONE</h2>
          <p><strong>Email:</strong> ${datos.email}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
          <p style="color:#888;font-size:12px">Se ha registrado desde el formulario "Avísame de ofertas" de la landing.</p>
        `
      }));

      // 2) Email al lead con preview del área de clientes
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: datos.email,
        subject: 'Esto es lo que tendrías dentro de K-ONE',
        html: `
          <div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">

              <!-- Header -->
              <div style="background:#E8490F;padding:28px 24px;text-align:center">
                <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:5px;letter-spacing:1px">TU PREPARADOR DE ÉLITE, 24/7</div>
              </div>

              <!-- Intro -->
              <div style="padding:30px 28px 0">
                <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px">Esto es lo que tendrías hoy</h1>
                <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 24px">No es una plantilla genérica. Tu plan se genera con tu peso, altura, deporte, objetivo y lesiones. Se recalcula cada semana según tu progreso.</p>
              </div>

              <!-- Mini preview entrenamiento -->
              <div style="padding:0 28px">
                <div style="background:#141414;padding:18px;margin-bottom:3px">
                  <div style="font-size:10px;letter-spacing:2px;color:#E8490F;font-family:monospace;margin-bottom:8px">ENTRENAMIENTO DE HOY</div>
                  <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:10px">Lunes — Tren superior</div>
                  <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <tr style="border-bottom:1px solid #1a1a1a"><td style="padding:5px 0;color:#ccc">Press banca</td><td style="color:#888;text-align:right;padding:5px 0">4×8</td></tr>
                    <tr style="border-bottom:1px solid #1a1a1a"><td style="padding:5px 0;color:#ccc">Remo con mancuerna</td><td style="color:#888;text-align:right;padding:5px 0">4×10</td></tr>
                    <tr style="border-bottom:1px solid #1a1a1a"><td style="padding:5px 0;color:#ccc">Press militar</td><td style="color:#888;text-align:right;padding:5px 0">3×10</td></tr>
                    <tr><td style="padding:5px 0;color:#666;font-style:italic" colspan="2">+ 3 ejercicios más...</td></tr>
                  </table>
                </div>

                <!-- Mini preview nutrición -->
                <div style="background:#141414;padding:18px;margin-bottom:3px">
                  <div style="font-size:10px;letter-spacing:2px;color:#E8490F;font-family:monospace;margin-bottom:8px">COMIDA DEL DÍA (1 de 5 opciones)</div>
                  <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px">Pollo con arroz y brócoli</div>
                  <div style="font-size:11px;color:#888;margin-bottom:8px">180g pollo, 150g arroz integral, 200g brócoli, AOVE</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <span style="background:#1a1a1a;padding:3px 8px;font-size:10px;color:#E8490F;font-family:monospace;font-weight:600">520 kcal</span>
                    <span style="background:#1a1a1a;padding:3px 8px;font-size:10px;color:#888;font-family:monospace">42g prot</span>
                    <span style="background:#1a1a1a;padding:3px 8px;font-size:10px;color:#888;font-family:monospace">48g carbs</span>
                    <span style="background:#1a1a1a;padding:3px 8px;font-size:10px;color:#888;font-family:monospace">14g grasa</span>
                  </div>
                </div>
              </div>

              <!-- Qué incluye el área de clientes -->
              <div style="padding:24px 28px 0">
                <div style="font-size:11px;color:#E8490F;letter-spacing:2px;font-weight:700;margin-bottom:14px">TU ÁREA DE CLIENTE INCLUYE</div>
                <table style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="padding:12px;background:#141414;border-bottom:1px solid #1a1a1a;width:50%;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">🏋️</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Plan de entrenamiento</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">Gimnasio, running, CrossFit, Hyrox o combinación. Con series, reps y descansos.</div>
                    </td>
                    <td style="padding:12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">🥗</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Plan semanal de nutrición</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">5 comidas al día, 5 opciones cada una. Eliges por día de la semana.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px;background:#141414;border-bottom:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">🛒</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Lista de la compra</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">Todo lo de la semana sumado por categorías. Descárgala o cópiala.</div>
                    </td>
                    <td style="padding:12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">📊</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Check-in semanal</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">Cuentas cómo te fue y el plan se ajusta: sube o baja según tu progreso.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px;background:#141414;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">📈</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Progreso y racha</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">Pesos, fotos mensuales, hitos y racha de días entrenados.</div>
                    </td>
                    <td style="padding:12px;background:#141414;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:16px;margin-bottom:3px">💬</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Contacto directo</div>
                      <div style="font-size:10px;color:#666;line-height:1.4">Escríbenos desde tu panel. Sugerencias, dudas, lo que sea.</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="padding:28px;text-align:center">
                <a href="${APP_URL}?go=registro" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:16px 48px;font-size:16px;font-weight:700;letter-spacing:0.5px;border-radius:6px">EMPEZAR POR 0,99€ →</a>
                <p style="color:#555;font-size:12px;margin:10px 0 0">Primer mes completo. Después 14,99€/mes. Cancelas cuando quieras.</p>
              </div>

              <!-- Footer -->
              <div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center">
                <p style="color:#444;font-size:10px;line-height:1.6;margin:0">
                  Recibes este email porque dejaste tu dirección en k-one.fit<br>
                  K-ONE · R. López Pinto · Alcalá de Henares, Madrid<br>
                  <a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a>
                </p>
              </div>

            </div>
          </div>
        `
      }));

    } else if (tipo === 'bienvenida') {
      const primerNombre = (datos.nombre || '').split(' ')[0] || 'Crack';
      // 1) Email al cliente
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: datos.email,
        subject: `${primerNombre}, tu plan te está esperando — K-ONE`,
        html: `
          <div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">

              <!-- Header con logo -->
              <div style="background:#E8490F;padding:32px 24px;text-align:center">
                <div style="font-size:32px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:6px;letter-spacing:1px">NO HAY ATAJOS. HAY PASOS.</div>
              </div>

              <!-- Saludo -->
              <div style="padding:36px 28px 0">
                <h1 style="color:#fff;font-size:26px;font-weight:700;margin:0 0 8px">${primerNombre}, bienvenido/a.</h1>
                <p style="color:#888;font-size:14px;line-height:1.7;margin:0 0 28px">Tu cuenta está lista. En 3 pasos tienes tu plan de entrenamiento y nutrición personalizado funcionando.</p>
              </div>

              <!-- 3 Pasos -->
              <div style="padding:0 28px">
                <table style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:40px;height:40px;background:#E8490F;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;border-radius:50%">1</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0;border-bottom:1px solid #1a1a1a">
                      <p style="margin:0 0 3px;font-weight:700;color:#fff;font-size:15px">Rellena el cuestionario</p>
                      <p style="margin:0;color:#888;font-size:13px;line-height:1.5">5 minutos. Nos cuentas tu deporte, objetivo, nivel, lesiones y alergias. Con eso construimos todo.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:40px;height:40px;background:#E8490F;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;border-radius:50%">2</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0;border-bottom:1px solid #1a1a1a">
                      <p style="margin:0 0 3px;font-weight:700;color:#fff;font-size:15px">Activa tu primer mes — 0,99€</p>
                      <p style="margin:0;color:#888;font-size:13px;line-height:1.5">Acceso completo. Después 14,99€/mes. Sin permanencia: cancelas con un clic.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:40px;height:40px;background:#E8490F;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;border-radius:50%">3</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0">
                      <p style="margin:0 0 3px;font-weight:700;color:#fff;font-size:15px">Empieza hoy</p>
                      <p style="margin:0;color:#888;font-size:13px;line-height:1.5">Tu plan de entrenamiento y nutrición listos. Cada semana se adaptan a cómo evoluciones.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Qué incluye -->
              <div style="padding:28px 28px 0">
                <div style="font-size:11px;color:#E8490F;letter-spacing:2px;font-weight:700;margin-bottom:14px">QUÉ VAS A ENCONTRAR</div>
                <table style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="padding:10px 12px;background:#141414;border-bottom:1px solid #1a1a1a;width:50%">
                      <div style="font-size:18px;margin-bottom:2px">🏋️</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Entrenamiento</div>
                      <div style="font-size:11px;color:#666">Adaptado a tu deporte y nivel</div>
                    </td>
                    <td style="padding:10px 12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a">
                      <div style="font-size:18px;margin-bottom:2px">🥗</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Nutrición</div>
                      <div style="font-size:11px;color:#666">5 comidas, 5 opciones cada una</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;background:#141414">
                      <div style="font-size:18px;margin-bottom:2px">📊</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Check-in semanal</div>
                      <div style="font-size:11px;color:#666">El plan se ajusta a tu progreso</div>
                    </td>
                    <td style="padding:10px 12px;background:#141414;border-left:1px solid #1a1a1a">
                      <div style="font-size:18px;margin-bottom:2px">🛒</div>
                      <div style="font-size:12px;color:#fff;font-weight:600">Lista de la compra</div>
                      <div style="font-size:11px;color:#666">Toda la semana en un clic</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="padding:32px 28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:16px 48px;font-size:16px;font-weight:700;letter-spacing:0.5px;border-radius:6px">EMPEZAR AHORA →</a>
                <p style="color:#555;font-size:12px;margin:12px 0 0">Primer mes completo por 0,99€</p>
              </div>

              <!-- Footer -->
              <div style="padding:20px 28px;border-top:1px solid #1a1a1a;text-align:center">
                <p style="color:#444;font-size:10px;line-height:1.6;margin:0">
                  K-ONE · R. López Pinto · Alcalá de Henares, Madrid<br>
                  <a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a> · <a href="${APP_URL}" style="color:#666;text-decoration:none">k-one.fit</a>
                </p>
              </div>

            </div>
          </div>
        `
      }));
      // 2) Notificación al admin
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nuevo registro: ${datos.nombre} (${datos.email})`,
        html: `
          <h2 style="color:#E8490F">Nuevo cliente registrado</h2>
          <p><strong>Nombre:</strong> ${datos.nombre}</p>
          <p><strong>Email:</strong> ${datos.email}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        `
      }));

    } else if (tipo === 'mensaje') {
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: datos.email,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Mensaje de ${datos.nombre}: ${datos.asunto}`,
        html: `
          <div style="background:#0b0b0b;padding:32px 20px;font-family:Arial,sans-serif;color:#e0e0e0">
            <div style="max-width:520px;margin:0 auto">
              <div style="margin-bottom:20px">
                <span style="font-size:22px;font-weight:800;color:#fff">K-<span style="color:#E8490F">ONE</span></span>
                <span style="font-size:12px;color:#888;margin-left:12px">Mensaje de cliente</span>
              </div>
              <div style="background:#141414;border-left:3px solid #E8490F;padding:18px 22px;margin-bottom:16px">
                <p style="margin:0 0 4px;font-size:11px;color:#888">DE</p>
                <p style="margin:0;color:#fff;font-weight:600">${datos.nombre} · <span style="color:#b5b2ad">${datos.email}</span></p>
              </div>
              <div style="background:#141414;padding:18px 22px;margin-bottom:16px">
                <p style="margin:0 0 4px;font-size:11px;color:#E8490F;font-weight:600">${datos.asunto}</p>
                <p style="margin:0;color:#e0e0e0;line-height:1.6;font-size:14px">${datos.mensaje.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</p>
              </div>
              <p style="color:#555;font-size:11px;margin:0">Responde a este email para contestar directamente al cliente.</p>
            </div>
          </div>
        `
      }));

    } else if (tipo === 'opinion') {
      const estrellas = '★'.repeat(datos.estrellas || 0) + '☆'.repeat(5 - (datos.estrellas || 0));
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
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
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
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
