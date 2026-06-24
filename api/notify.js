// Envía emails de notificación (leads, opiniones, bienvenida, renovación, retención).
// Usa Resend (resend.com) — gratis hasta 100 emails/día.
// POST: envío individual (lead, bienvenida, opinion, mensaje, renovacion)
// GET:  cron de retención (día 3 sin cuestionario, día 8 sin pagar) — protegido por CRON_SECRET
// Variables de entorno: RESEND_API_KEY, CRON_SECRET

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

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emailWrapper(contenido) {
  return `<div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0"><div style="max-width:560px;margin:0 auto"><div style="background:#E8490F;padding:24px;text-align:center"><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div></div>${contenido}<div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center"><p style="color:#555;font-size:13px;margin:0">Equipo de K-<span style="color:#E8490F;font-weight:600">ONE</span></p><p style="color:#444;font-size:10px;margin:8px 0 0"><a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a> · <a href="${APP_URL}" style="color:#666;text-decoration:none">k-one.fit</a></p></div></div></div>`;
}

async function handleCronRetencion(req, res) {
  const secret = req.headers.authorization?.replace('Bearer ', '') || req.query?.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: true, skipped: true });

  try {
    const supa = getSupabaseAdmin();
    const ahora = new Date();
    const hace3d = new Date(ahora.getTime() - 3 * 86400000).toISOString();
    const hace4d = new Date(ahora.getTime() - 4 * 86400000).toISOString();
    const hace8d = new Date(ahora.getTime() - 8 * 86400000).toISOString();
    const hace9d = new Date(ahora.getTime() - 9 * 86400000).toISOString();

    const { data: perfiles } = await supa.from('profiles').select('id, nombre, email, userdata, created_at');
    const { data: subs } = await supa.from('subscriptions').select('user_id, status');
    const subByUser = {};
    (subs || []).forEach(s => { subByUser[s.user_id] = s; });

    const { data: enviados } = await supa.from('email_log').select('destinatario, tipo').in('tipo', ['retencion_dia3', 'retencion_dia8']);
    const yaEnviado = new Set();
    (enviados || []).forEach(e => yaEnviado.add(`${e.tipo}:${e.destinatario}`));

    let enviados3 = 0, enviados8 = 0;

    for (const p of (perfiles || [])) {
      const ud = p.userdata || {};
      const sub = subByUser[p.id];
      const tieneSubActiva = sub && ['active', 'trialing'].includes(sub.status);
      const nombre = p.nombre || ud.nombre || '';
      const primerNombre = nombre.split(' ')[0] || 'Crack';
      const email = p.email;
      if (!email) continue;

      // DÍA 3: registrado hace 3-4 días, NO completó cuestionario, NO tiene sub activa
      if (p.created_at >= hace4d && p.created_at < hace3d && !ud.onboardingCompletado && !tieneSubActiva) {
        if (yaEnviado.has(`retencion_dia3:${email}`)) continue;
        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: email,
          subject: `${esc(primerNombre)}, el mejor momento para empezar siempre es hoy`,
          html: emailWrapper(`
            <div style="padding:28px 28px 0">
              <h1 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 18px">El mejor momento para empezar siempre es hoy</h1>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Te registraste en K-ONE hace unos días y eso ya dice algo de ti: <span style="color:#F0EDE8">que quieres dar el paso</span>. A veces lo difícil no es entrenar, es empezar.</p>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Tu plan personalizado está a <span style="color:#F0EDE8;font-weight:500">menos de 2 minutos</span>. Solo necesitamos que completes un cuestionario rápido y nosotros nos encargamos del resto: entrenamiento, nutrición y progresión semanal.</p>
              <div style="background:#141414;border-radius:10px;padding:16px 20px;margin:0 0 18px;border-left:3px solid #E8490F">
                <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:10px">QUÉ VAS A CONSEGUIR</div>
                <table style="width:100%;border-collapse:collapse"><tr>
                  <td style="padding:4px 0;font-size:13px;color:#b5b2ad"><span style="color:#E8490F">&#10003;</span> Plan de entreno adaptado a ti</td>
                  <td style="padding:4px 0;font-size:13px;color:#b5b2ad"><span style="color:#E8490F">&#10003;</span> Nutrición con 5 opciones/comida</td>
                </tr><tr>
                  <td style="padding:4px 0;font-size:13px;color:#b5b2ad"><span style="color:#E8490F">&#10003;</span> Progresión semanal automática</td>
                  <td style="padding:4px 0;font-size:13px;color:#b5b2ad"><span style="color:#E8490F">&#10003;</span> Vídeos de cada ejercicio</td>
                </tr></table>
              </div>
              <p style="margin:0 0 20px;font-size:14px;color:#b5b2ad;text-align:center"><span style="color:#F0EDE8;font-style:italic">"Un paso cada vez"</span> — y este es el primero.</p>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">COMPLETAR MI PLAN</a>
            </div>
          `)
        });
        await supa.from('email_log').insert({ tipo: 'retencion_dia3', destinatario: email, asunto: 'El mejor momento para empezar siempre es hoy', datos: JSON.stringify({ nombre, resumen: 'Retención día 3: motivacional para completar cuestionario.' }) });
        enviados3++;
      }

      // DÍA 8: registrado hace 8-9 días, SÍ completó cuestionario, NO tiene sub activa
      if (p.created_at >= hace9d && p.created_at < hace8d && ud.onboardingCompletado && !tieneSubActiva) {
        if (yaEnviado.has(`retencion_dia8:${email}`)) continue;
        const deporte = ud.deporte || 'Tu deporte';
        const objetivo = ud.objetivo || 'Tu objetivo';
        const dias = ud.diasEntreno || ud.dias || '3-5';
        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: email,
          subject: `${esc(primerNombre)}, ya sabes qué quieres. Ahora toca ir a por ello.`,
          html: emailWrapper(`
            <div style="padding:28px 28px 0">
              <h1 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 18px">Ya sabes qué quieres. Ahora toca ir a por ello.</h1>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hace una semana dedicaste tu tiempo a generar tu plan en K-ONE. Eso no lo hace cualquiera — la mayoría se queda en "ya lo haré mañana".</p>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Tu plan sigue guardado, preparado para ti:</p>
              <div style="background:#141414;border-radius:10px;padding:18px 20px;margin:0 0 18px">
                <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:12px">TU PLAN PERSONALIZADO</div>
                <table style="width:100%;border-collapse:collapse"><tr>
                  <td style="padding:6px;width:50%"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Deporte</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">${esc(deporte)}</div></div></td>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Objetivo</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">${esc(objetivo)}</div></div></td>
                </tr><tr>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Entrenos</div><div style="font-size:15px;font-weight:600;color:#E8490F">${esc(String(dias))} días/sem</div></div></td>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#888;margin-bottom:4px">Nutrición</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">5 comidas</div></div></td>
                </tr></table>
              </div>
              <div style="background:#141414;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 20px">
                <p style="margin:0;font-size:13px;color:#b5b2ad;line-height:1.6"><span style="color:#F0EDE8;font-weight:500">La diferencia entre querer y hacer es empezar.</span> Tu plan ya está hecho — solo falta que lo actives.</p>
              </div>
              <p style="margin:0 0 20px;font-size:13px;color:#888;text-align:center">Primer mes a <span style="color:#E8490F;font-weight:600;font-size:16px">1,99 €</span> · Sin permanencia · Cancela cuando quieras</p>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">ACTIVAR MI PLAN</a>
            </div>
          `)
        });
        await supa.from('email_log').insert({ tipo: 'retencion_dia8', destinatario: email, asunto: 'Ya sabes qué quieres. Ahora toca ir a por ello.', datos: JSON.stringify({ nombre, deporte, objetivo, resumen: `Retención día 8: plan personalizado (${deporte}, ${objetivo}), CTA 1,99€.` }) });
        enviados8++;
      }
    }

    // RESUMEN SEMANAL: cada lunes, email a clientes activos con su progreso
    let enviadosResumen = 0;
    const esLunes = ahora.getDay() === 1;
    if (esLunes) {
      const semanaMs = 7 * 86400000;
      const { data: resumenEnviados } = await supa.from('email_log').select('destinatario').eq('tipo', 'resumen_semanal').gte('created_at', new Date(ahora.getTime() - semanaMs).toISOString());
      const yaResumen = new Set((resumenEnviados || []).map(e => e.destinatario));

      for (const p of (perfiles || [])) {
        const sub = subByUser[p.id];
        if (!sub || !['active', 'trialing'].includes(sub.status)) continue;
        if (!p.email || yaResumen.has(p.email)) continue;
        const ud = p.userdata || {};
        if (!ud.onboardingCompletado) continue;

        const nombre = (p.nombre || '').split(' ')[0] || 'Crack';
        const entrenos = (ud.entrenosCompletados || []).length;
        const racha = ud.rachaDias || 0;
        const semana = ud.progreso?.semana || 1;

        const mensajes = [
          'La constancia gana a la motivación. Cada entreno cuenta.',
          'No se trata de ser perfecto, se trata de no parar.',
          'El progreso no siempre se ve en el espejo. Se nota en la energía.',
          'Quien entrena hoy, agradece mañana.',
          'La disciplina es elegir entre lo que quieres ahora y lo que quieres de verdad.'
        ];
        const mensajeSemana = mensajes[semana % mensajes.length];

        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: p.email,
          subject: `${esc(nombre)}, tu semana ${semana} en K-ONE`,
          html: emailWrapper(`
            <div style="padding:28px 28px 0">
              <h1 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 18px">Tu semana en K-ONE</h1>
              <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Hola <span style="color:#E8490F;font-weight:600">${esc(nombre)}</span>, aquí tienes tu resumen de la semana ${semana}.</p>
              <div style="display:flex;gap:8px;margin-bottom:18px">
                <div style="flex:1;background:#141414;border-radius:10px;padding:14px;text-align:center">
                  <div style="font-size:24px;font-weight:700;color:#27ae60">${entrenos}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">Entrenos</div>
                </div>
                <div style="flex:1;background:#141414;border-radius:10px;padding:14px;text-align:center">
                  <div style="font-size:24px;font-weight:700;color:#E8490F">${racha}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">Racha</div>
                </div>
                <div style="flex:1;background:#141414;border-radius:10px;padding:14px;text-align:center">
                  <div style="font-size:24px;font-weight:700;color:#F0EDE8">S${semana}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">Semana</div>
                </div>
              </div>
              <div style="background:#141414;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:20px">
                <p style="margin:0;font-size:13px;color:#b5b2ad;line-height:1.6;font-style:italic">"${mensajeSemana}"</p>
              </div>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">VER MI PLAN</a>
            </div>
          `)
        });
        await supa.from('email_log').insert({ tipo: 'resumen_semanal', destinatario: p.email, asunto: `Semana ${semana}`, datos: JSON.stringify({ nombre, entrenos, racha, semana }) });
        enviadosResumen++;
      }
    }

    console.log(`[notify-cron] Retención: ${enviados3} día3, ${enviados8} día8, ${enviadosResumen} resumen`);
    return res.status(200).json({ ok: true, enviados3, enviados8, enviadosResumen });
  } catch (err) {
    console.error('[notify-cron] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return handleCronRetencion(req, res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const appUrl = process.env.APP_URL || 'https://k-one.fit';
  try {
    const h = new URL(origin).hostname;
    if (h !== 'k-one.fit' && h !== 'www.k-one.fit' && h !== 'localhost' && !h.endsWith('.vercel.app')) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
  } catch (_) {
    if (origin) return res.status(403).json({ error: 'Origen no permitido' });
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
    const tiposValidos = ['lead', 'bienvenida', 'opinion', 'mensaje', 'renovacion'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo no válido' });
    }
    if (tipo === 'lead' && datos.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email)) {
        return res.status(400).json({ error: 'Email no válido' });
      }
    }

    const emails = [];

    if (tipo === 'lead') {
      // 1) Notificación al admin
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nuevo lead: ${esc(datos.email)}`,
        html: `
          <h2 style="color:#E8490F">Nuevo lead en K-ONE</h2>
          <p><strong>Email:</strong> ${esc(datos.email)}</p>
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
                <a href="${APP_URL}?go=registro" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:16px 48px;font-size:16px;font-weight:700;letter-spacing:0.5px;border-radius:6px">EMPEZAR POR 1,99€ →</a>
                <p style="color:#555;font-size:12px;margin:10px 0 0">Primer mes completo. Después 19,99€/mes. Cancelas cuando quieras.</p>
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
        subject: `${esc(primerNombre)}, tu plan te está esperando — K-ONE`,
        html: `
          <div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">

              <div style="background:#E8490F;padding:32px 24px;text-align:center">
                <div style="font-size:32px;font-weight:900;letter-spacing:3px;color:#fff">K-<span style="color:#fff">ONE</span></div>
                <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:6px;letter-spacing:1px">NO HAY ATAJOS. HAY PASOS.</div>
              </div>

              <div style="padding:36px 28px 0">
                <h1 style="color:#fff;font-size:26px;font-weight:700;margin:0 0 8px">${esc(primerNombre)}, bienvenido/a.</h1>
                <p style="color:#888;font-size:14px;line-height:1.7;margin:0 0 28px">Tu cuenta está lista. En 3 pasos tienes tu plan de entrenamiento y nutrición personalizado funcionando.</p>
              </div>

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
                      <p style="margin:0 0 3px;font-weight:700;color:#fff;font-size:15px">Activa tu primer mes — 1,99€</p>
                      <p style="margin:0;color:#888;font-size:13px;line-height:1.5">Acceso completo. Después 19,99€/mes. Sin permanencia: cancelas con un clic.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:40px;height:40px;background:#E8490F;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;border-radius:50%">3</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0">
                      <p style="margin:0 0 3px;font-weight:700;color:#fff;font-size:15px">Empieza hoy</p>
                      <p style="margin:0;color:#888;font-size:13px;line-height:1.5">Tu plan se adapta cada semana a cómo evoluciones. Sin fórmulas genéricas.</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="padding:32px 28px 0">
                <div style="font-size:11px;color:#E8490F;letter-spacing:2px;font-weight:700;margin-bottom:18px">TODO ESTO TE ESPERA DENTRO</div>

                <table style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;width:50%;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9654; ENTRENAMIENTO</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Plan semanal adaptado a tu deporte y nivel. Cada ejercicio con vídeo explicativo.</div>
                    </td>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9827; NUTRICIÓN</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">5 comidas al día, 5 opciones por comida. Macros calculados para tu objetivo.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9881; RECETARIO</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">+200 recetas con instrucciones paso a paso. Rotación semanal para no repetir.</div>
                    </td>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9878; REGISTRO DE PESOS</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Marca tus pesos en cada ejercicio y ve la progresión con gráficas.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#10003; CHECK-IN SEMANAL</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Cada semana nos dices cómo vas. El plan se ajusta a tu progreso real.</div>
                    </td>
                    <td style="padding:14px 12px;background:#141414;border-bottom:1px solid #1a1a1a;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9733; CONTADOR KCAL</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Marca lo que comes y controla tus calorías diarias de forma visual.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#141414;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9998; NOTAS PERSONALES</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Apunta lo que quieras: sensaciones, marcas, ideas. Tu diario de entreno.</div>
                    </td>
                    <td style="padding:14px 12px;background:#141414;border-left:1px solid #1a1a1a;vertical-align:top">
                      <div style="font-size:13px;color:#E8490F;font-weight:800;margin-bottom:4px">&#9758; LISTA DE LA COMPRA</div>
                      <div style="font-size:11px;color:#999;line-height:1.5">Genera la lista de la compra de toda la semana con un solo clic.</div>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="padding:32px 28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:16px 48px;font-size:16px;font-weight:700;letter-spacing:0.5px;border-radius:6px">EMPEZAR AHORA →</a>
                <p style="color:#555;font-size:12px;margin:12px 0 0">Primer mes completo por 1,99€</p>
              </div>

              <div style="padding:20px 28px;border-top:1px solid #1a1a1a;text-align:center">
                <p style="color:#999;font-size:12px;font-weight:700;margin:0 0 6px">Equipo K-<span style="color:#E8490F">ONE</span></p>
                <p style="color:#555;font-size:10px;line-height:1.8;margin:0">
                  Alcalá de Henares, Madrid<br>
                  <a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a>
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
        subject: `K-ONE · Nuevo registro: ${esc(datos.nombre)} (${esc(datos.email)})`,
        html: `
          <h2 style="color:#E8490F">Nuevo cliente registrado</h2>
          <p><strong>Nombre:</strong> ${esc(datos.nombre)}</p>
          <p><strong>Email:</strong> ${esc(datos.email)}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        `
      }));

    } else if (tipo === 'mensaje') {
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: datos.email,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Mensaje de ${esc(datos.nombre)}: ${esc(datos.asunto)}`,
        html: `
          <div style="background:#0b0b0b;padding:32px 20px;font-family:Arial,sans-serif;color:#e0e0e0">
            <div style="max-width:520px;margin:0 auto">
              <div style="margin-bottom:20px">
                <span style="font-size:22px;font-weight:800;color:#fff">K-<span style="color:#E8490F">ONE</span></span>
                <span style="font-size:12px;color:#888;margin-left:12px">Mensaje de cliente</span>
              </div>
              <div style="background:#141414;border-left:3px solid #E8490F;padding:18px 22px;margin-bottom:16px">
                <p style="margin:0 0 4px;font-size:11px;color:#888">DE</p>
                <p style="margin:0;color:#fff;font-weight:600">${esc(datos.nombre)} · <span style="color:#b5b2ad">${esc(datos.email)}</span></p>
              </div>
              <div style="background:#141414;padding:18px 22px;margin-bottom:16px">
                <p style="margin:0 0 4px;font-size:11px;color:#E8490F;font-weight:600">${esc(datos.asunto)}</p>
                <p style="margin:0;color:#e0e0e0;line-height:1.6;font-size:14px">${esc(datos.mensaje).replace(/\n/g,'<br>')}</p>
              </div>
              <p style="color:#555;font-size:11px;margin:0">Responde a este email para contestar directamente al cliente.</p>
            </div>
          </div>
        `
      }));

    } else if (tipo === 'opinion') {
      const nEstrellas = Math.min(Math.max(parseInt(datos.estrellas) || 0, 0), 5);
      const estrellas = '★'.repeat(nEstrellas) + '☆'.repeat(5 - nEstrellas);
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Nueva opinión: ${esc(datos.nombre)} (${datos.estrellas}★)`,
        html: `
          <h2 style="color:#E8490F">Nueva opinión en K-ONE</h2>
          <p><strong>Nombre:</strong> ${esc(datos.nombre) || 'Anónimo'}</p>
          <p><strong>Valoración:</strong> <span style="color:#E8490F;font-size:18px">${estrellas}</span></p>
          <p><strong>Texto:</strong> ${esc(datos.texto || '(sin texto)')}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
        `
      }));
    } else if (tipo === 'renovacion') {
      const primerNombre = (datos.nombre || '').split(' ')[0] || 'Crack';
      const entrenos = datos.entrenos || 0;
      const racha = datos.racha || 0;
      const semana = datos.semana || 1;
      emails.push(enviarEmail(apiKey, {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: datos.email,
        subject: `${esc(primerNombre)}, la constancia es tu mejor ejercicio — K-ONE`,
        html: `
          <div style="background:#0b0b0b;padding:0;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0">
            <div style="max-width:560px;margin:0 auto">
              <div style="background:#E8490F;padding:24px;text-align:center">
                <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#fff">K-ONE</div>
              </div>
              <div style="padding:32px 28px 0;text-align:center">
                <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:rgba(232,73,15,0.12);font-size:28px;margin-bottom:12px">&#127942;</div>
                <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">La constancia es tu mejor ejercicio</h1>
              </div>
              <div style="padding:0 28px">
                <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
                <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 14px">Tu suscripción se ha renovado y eso dice mucho de ti. La mayoría abandona después del primer mes — <span style="color:#F0EDE8;font-weight:500">tú has decidido seguir</span>. Esa disciplina vale más que cualquier plan de entrenamiento.</p>
                <p style="color:#b5b2ad;font-size:14px;line-height:1.7;margin:0 0 18px">Mira lo que has conseguido hasta ahora:</p>
                <div style="background:#141414;border-radius:10px;padding:18px 20px;margin:0 0 18px">
                  <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:12px">TU PROGRESO</div>
                  <table style="width:100%;border-collapse:collapse;text-align:center">
                    <tr>
                      <td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#27ae60">${entrenos}</div><div style="font-size:11px;color:#888;margin-top:2px">Entrenos</div></td>
                      <td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#E8490F">${racha}</div><div style="font-size:11px;color:#888;margin-top:2px">Mejor racha</div></td>
                      <td style="padding:8px"><div style="font-size:26px;font-weight:700;color:#F0EDE8">S${semana}</div><div style="font-size:11px;color:#888;margin-top:2px">Semana</div></td>
                    </tr>
                  </table>
                </div>
                <div style="background:#141414;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 24px">
                  <p style="margin:0;font-size:13px;color:#b5b2ad;line-height:1.6"><span style="color:#F0EDE8;font-weight:500">Nuevo mes, nuevo reto.</span> Tu plan se ha actualizado según tu progreso — entrenamiento y nutrición recalculados. No entrenas como el primer día porque ya no eres el del primer día.</p>
                </div>
              </div>
              <div style="padding:0 28px 28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">VER MI NUEVO PLAN</a>
              </div>
              <div style="padding:16px 28px;border-top:1px solid #1a1a1a;text-align:center">
                <p style="color:#555;font-size:13px;margin:0">Equipo de K-<span style="color:#E8490F;font-weight:600">ONE</span></p>
                <p style="color:#444;font-size:10px;margin:8px 0 0"><a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a> · <a href="${APP_URL}" style="color:#666;text-decoration:none">k-one.fit</a></p>
              </div>
            </div>
          </div>
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
    const errores = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        console.error(`[notify] Email ${i} rejected:`, r.reason);
        errores.push({ i, error: String(r.reason) });
      } else if (r.value && !r.value.ok) {
        const body = await r.value.text().catch(() => '');
        console.error(`[notify] Email ${i} HTTP ${r.value.status}:`, body);
        errores.push({ i, status: r.value.status, body });
      }
    }
    if (errores.length) {
      console.error(`[notify] ${errores.length}/${results.length} emails fallaron:`, JSON.stringify(errores));
    }

    // Guardar historial de emails enviados con resumen del cuerpo
    try {
      const supa = getSupabaseAdmin();
      let destinatario, asunto, resumen;
      if (tipo === 'lead') {
        destinatario = datos.email;
        asunto = 'Esto es lo que tendrías dentro de K-ONE';
        resumen = 'Email al lead con preview del área de clientes: entrenamiento (press banca, remo, press militar), nutrición (pollo con arroz y brócoli, 520 kcal), y las 6 funciones del área de cliente. CTA: Empezar por 1,99€.';
      } else if (tipo === 'bienvenida') {
        const primerNombre = (datos.nombre || '').split(' ')[0] || 'Cliente';
        destinatario = datos.email;
        asunto = `${primerNombre}, tu plan te está esperando — K-ONE`;
        resumen = `Email de bienvenida a ${datos.nombre} (${datos.email}). 3 pasos: rellenar cuestionario, activar primer mes 1,99€, empezar. Incluye 8 funciones del área de clientes: entrenamiento con vídeos, nutrición 5x5, recetario +200, registro de pesos, check-in semanal, contador kcal, notas y lista de la compra.`;
      } else if (tipo === 'mensaje') {
        destinatario = ADMIN_EMAIL;
        asunto = `Mensaje de ${datos.nombre}: ${datos.asunto}`;
        resumen = `De: ${datos.nombre} (${datos.email})\nMotivo: ${datos.asunto}\n\n${datos.mensaje || ''}`;
      } else if (tipo === 'opinion') {
        destinatario = ADMIN_EMAIL;
        asunto = `Nueva opinión de ${datos.nombre} (${datos.estrellas}★)`;
        resumen = `Opinión de ${datos.nombre || 'Anónimo'}: ${'★'.repeat(datos.estrellas || 0)}${'☆'.repeat(5-(datos.estrellas||0))}\n\n${datos.texto || '(sin texto)'}`;
      } else if (tipo === 'renovacion') {
        destinatario = datos.email;
        asunto = `${(datos.nombre || '').split(' ')[0]}, la constancia es tu mejor ejercicio`;
        resumen = `Email de renovación a ${datos.nombre} (${datos.email}). Progreso: ${datos.entrenos || 0} entrenos, racha ${datos.racha || 0}, semana ${datos.semana || 1}. Motivacional sobre constancia y disciplina.`;
      } else {
        destinatario = ADMIN_EMAIL;
        asunto = `Notificación: ${tipo}`;
        resumen = JSON.stringify(datos, null, 2);
      }
      await supa.from('email_log').insert({
        tipo, destinatario, asunto,
        datos: JSON.stringify({ ...datos, resumen })
      });
    } catch (e) {}

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
