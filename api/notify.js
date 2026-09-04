// Envía emails de notificación (leads, opiniones, bienvenida, renovación, retención).
// Usa Resend (resend.com) — gratis hasta 100 emails/día.
// POST: envío individual (lead, bienvenida, opinion, mensaje) -- 'renovacion'
// se quitó de aquí (auditoría 2 sept 2026): era un tipo válido sin ningún
// llamador legítimo (el email real lo manda stripe-webhook.js aparte) y
// funcionaba como relay de email abierto para cualquier usuario autenticado.
// GET:  cron de retención (día 3 sin cuestionario, día 8 sin pagar) — protegido por CRON_SECRET
// Variables de entorno: RESEND_API_KEY, CRON_SECRET

const { getSupabaseAdmin, getAuthUser } = require('./_stripeHelpers');
const { capturarError } = require('./_sentry');
const webpush = require('web-push');
const ADMIN_EMAIL = 'k.one.fit26@gmail.com';
const APP_URL = 'https://k-one.fit';

// Vercel corre esta función en UTC, pero "hoy" para decidir si alguien ya
// entrenó tiene que ser el calendario de España (mismo truco que
// ahoraMadrid() en admin-clientes.js): relabela la hora dada (o la actual)
// al huso de Madrid antes de leer año/mes/día, así entre las 00:00 y la
// 1-2h locales (según horario) no se cree que "hoy" sigue siendo "ayer" en
// UTC. Acepta una fecha opcional para poder clasificar timestamps pasados
// (p.ej. el created_at de una fila) con el mismo criterio, no solo "ahora".
function _hoyMadridISO(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  const d = new Date(base.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Día de la semana en Madrid con lunes = 0, que es el orden en que el plan
// guarda `semana[]` (semana[0] siempre es lunes). getDay() devuelve 0=domingo,
// de ahí el desplazamiento -- mismo criterio que getIndiceDiaHoy() en el front.
const DIAS_SEMANA_PUSH = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function _indiceDiaMadrid(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  const d = new Date(base.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return (d.getDay() + 6) % 7;
}

// Push instantáneo al admin (no espera al cron diario) -- usa la misma
// suscripción push_subscriptions que ya tienen los clientes, solo que aquí
// el "cliente" es la cuenta del propio admin (misma tabla, mismo RLS: se
// suscribe con el interruptor de Jarvis igual que un cliente se suscribe
// desde el dashboard). No revienta la petición si falla -- captura su
// propio error, es un extra sobre el email, no un requisito para que
// notify.js responda ok.
async function enviarPushAAdmins({ title, body, url }) {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.length) return;
  try {
    webpush.setVapidDetails(`mailto:${ADMIN_EMAIL}`, vapidPublic, vapidPrivate);
    const supaAdmin = getSupabaseAdmin();
    // auth.users (no profiles) porque es la fuente real del email de login --
    // profiles.email es un espejo protegido, pero listUsers() es lo mismo que
    // ya usa handleCronRetencion para resolver "último acceso" por admin.
    const { data: { users } } = await supaAdmin.auth.admin.listUsers({ perPage: 1000 });
    const idsAdmin = (users || []).filter(u => adminEmails.includes((u.email || '').toLowerCase())).map(u => u.id);
    if (!idsAdmin.length) return;
    const { data: subsAdmin } = await supaAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth_key').in('user_id', idsAdmin);
    if (!subsAdmin || !subsAdmin.length) return;
    for (const sub of subsAdmin) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title, body, url: url || '/' })
        );
      } catch (pushErr) {
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          await supaAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.warn('[notify] push a admin error:', pushErr.message);
          capturarError(pushErr, { fn: 'notify-push-admin', endpoint: sub.endpoint });
        }
      }
    }
  } catch (e) { console.warn('[notify] enviarPushAAdmins error:', e.message); }
}

// OJO con `reply_to`: 14 de las llamadas de este fichero lo pasaban y la función
// no lo recogía, así que se descartaba en silencio. Resultado: las respuestas de
// los clientes a cualquier email de K-ONE iban a equipo@k-one.fit (el remitente
// técnico) en vez de al buzón que se lee de verdad, y se perdían.
function enviarEmail(apiKey, { from, to, subject, html, reply_to }) {
  const payload = { from, to: Array.isArray(to) ? to : [to], subject, html };
  if (reply_to) payload.reply_to = reply_to;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    // Antes dependía enteramente del maxDuration de la función de Vercel
    // para cortar si Resend se colgaba -- con esto falla en 10s de forma
    // predecible en vez de consumir todo el tiempo de la función.
    signal: AbortSignal.timeout(10000)
  });
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== DATOS EXTRA DEL RESUMEN SEMANAL =====
// Mismo cálculo que renderInformeSemanal() en index.html (récords de carga:
// ejercicio cuyo último registro de peso en los últimos 7 días es mayor que
// el registro inmediatamente anterior). Duplicado a propósito -- este
// fichero corre en Vercel, sin acceso al scope de index.html.
function _recordsFuerzaSemana(ud, ahora) {
  const inicioSemana = new Date(ahora.getTime() - 7 * 86400000);
  const records = [];
  const pesos = ud.pesosEjercicios || {};
  Object.values(pesos).forEach(entry => {
    const hist = (entry && entry.historial || []).filter(h => h && h.fecha && !isNaN(new Date(h.fecha).getTime()));
    if (hist.length < 2) return;
    const ordenado = [...hist].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimo = ordenado[ordenado.length - 1];
    const anterior = ordenado[ordenado.length - 2];
    if (new Date(ultimo.fecha) < inicioSemana) return;
    if (ultimo.peso > anterior.peso) {
      records.push({ nombre: entry.nombre || 'Ejercicio', antes: anterior.peso, ahora: ultimo.peso });
    }
  });
  records.sort((a, b) => (b.ahora - b.antes) - (a.ahora - a.antes));
  return records;
}

// Nombre visible de cada hito -- copiado de los `name:` de calcularHitos()
// en index.html (mismo motivo que arriba: sin acceso a ese scope aquí).
// Si se añade un hito nuevo en index.html, hay que replicar su nombre aquí
// para que el resumen semanal pueda citarlo; si no está en el mapa, el
// email simplemente no menciona ningún hito esa semana (nunca inventa uno).
const HITO_NOMBRES = {
  primer_entreno: 'La primera piedra', tres_entrenos: 'Ya no es un capricho',
  semana1: 'Primera semana completada', primer_foto: 'La foto que no miente',
  diez_entrenos: 'Doble dígito', racha5: 'Sin romper la cadena', la_vuelta: 'La vuelta',
  mes1: 'Primer mes completado', veinte_entrenos: '20 sesiones', mes2: 'Dos meses en pie',
  racha14: 'Dos semanas sin parar', mes3: 'Tres meses', cincuenta: 'Medio centenar',
  mes6: 'Seis meses', cien: 'Triple dígito', un_anio: 'Un año', doscientos: '200 sesiones',
  primer_lista_compra: 'Primera lista de la compra', primer_checkin: 'Primer check-in',
  semana_nutricion_completa: 'Semana redonda', mes_nutricion: 'Un mes siguiendo el plan',
  primer_feedback_entreno: 'Tu plan te escucha', progreso_compartido: 'Lo enseñaste',
  primer_amigo: 'Primer amigo invitado', tres_amigos: 'Tres amigos en K-ONE',
  primer_peso: 'Primer peso apuntado', progresion_peso: 'Progresión real',
  diez_pct_fuerte: '+10% más fuerte', cinco_ejercicios_reg: 'Cuaderno de hierro',
  racha21: '21 días seguidos', racha30: 'Un mes sin fallar',
  fotos3: 'La comparativa habla sola', fotos6: 'Medio año en imágenes',
  kilo1: 'Primer kilo conquistado', kilo5: 'Cinco kilos de camino', kilo10: 'Diez kilos de camino',
  constancia_bascula: 'Constancia de báscula', nota1: 'Primera nota', notas10: 'Diario de guerra',
  trescientos: '300 sesiones', dos_anios: 'Dos años', testimonio_dejado: 'Tu historia inspira'
};
// El hito conseguido más reciente dentro de los últimos 7 días, o null.
function _hitoDeEstaSemana(ud, ahora) {
  const inicioSemana = new Date(ahora.getTime() - 7 * 86400000);
  const hitos = ud.hitos || {};
  let mejorFecha = null, mejorKey = null;
  Object.entries(hitos).forEach(([key, fechaISO]) => {
    const f = new Date(fechaISO);
    if (isNaN(f.getTime()) || f < inicioSemana) return;
    if (!mejorFecha || f > mejorFecha) { mejorFecha = f; mejorKey = key; }
  });
  return mejorKey ? (HITO_NOMBRES[mejorKey] || null) : null;
}
// Entrenos de la semana pasada (7-14 días atrás), a partir de historialEntrenos
// (fechas persistentes, a diferencia de entrenosCompletados que se vacía en
// cada check-in) -- para poder comparar con la semana actual.
function _entrenosSemanaAnterior(ud, ahora) {
  const hace7d = new Date(ahora.getTime() - 7 * 86400000);
  const hace14d = new Date(ahora.getTime() - 14 * 86400000);
  const fechas = Array.isArray(ud.historialEntrenos) ? ud.historialEntrenos : [];
  return fechas.filter(f => { const d = new Date(f); return !isNaN(d.getTime()) && d >= hace14d && d < hace7d; }).length;
}

// Límites por hora para los tipos sin sesión (lead/mensaje). "lead" se permite
// más veces porque cualquiera puede pasar por el lead-magnet de la landing
// varias veces sin ser un abuso; "mensaje" es más generoso en abuso potencial
// (contenido libre, reply_to arbitrario) así que va más ajustado.
const RATE_LIMITS = { lead: 5, mensaje: 3, bienvenida: 5 };
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Vercel pone la IP real del cliente en x-forwarded-for (primer valor de la
// lista, el resto son proxies intermedios). Sin cabecera, se agrupan todas
// las peticiones bajo una clave común -- peor que nada, pero nunca deja
// pasar una petición sin comprobar límite alguno.
function _ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

// Antes el único límite era un contador en localStorage del propio navegador
// -- trivial de saltar con curl/Postman o borrando esa clave. Este cuenta
// cuántas peticiones sin sesión (lead/mensaje) ha hecho esa IP para ese tipo
// en la ventana actual. Si Supabase falla, se deja pasar la petición
// (fail-open): un rate-limit caído no debería tumbar el formulario de
// contacto entero.
//
// Usa check_rate_limit() (función atómica en Supabase, ver migration-
// agosto29-hardening.sql) en vez de "contar y luego insertar" en dos pasos
// sueltos: esa versión anterior tenía una condición de carrera real -- N
// peticiones concurrentes (trivial con un script) podían leer todas el mismo
// count antes de que ninguna hubiera insertado su fila, saltándose el límite
// en ráfaga. El INSERT ... ON CONFLICT ... DO UPDATE ... WHERE de la función
// es una sola operación atómica de Postgres, serializada a nivel de fila.
async function estaLimitadoPorTasa(req, tipo) {
  try {
    const supa = getSupabaseAdmin();
    const ip = _ipDe(req);
    const clave = `${tipo}:${ip}`;
    const limite = RATE_LIMITS[tipo] || 5;
    const ventana = new Date(Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS).toISOString();
    const { data: permitido, error } = await supa.rpc('check_rate_limit', {
      p_clave: clave, p_limite: limite, p_ventana: ventana
    });
    if (error) { console.warn('[notify] rate-limit check falló, se deja pasar:', error.message); return false; }
    return permitido === false;
  } catch (e) {
    console.warn('[notify] rate-limit check con excepción, se deja pasar:', e.message);
    return false;
  }
}

// Antes: bloque naranja sólido con "K-ONE" en blanco + cuerpo plano — el
// aspecto genérico de cualquier plantilla de email marketing de plantilla,
// sin relación visual con la web real. Ahora: foto real de gimnasio como
// cabecera (misma estética oscura/cinematográfica que los section-banner de
// la propia app), la misma tarjeta oscura con borde + esquinas redondeadas
// que usa toda la web (.price-card, .testimonial-card...), franja naranja
// fina bajo la foto en vez de un bloque entero, y el logotipo partido
// K-/ONE tal cual aparece en la web. Imagen como <img> normal (no
// background-image) y tablas en vez de flex/grid para que no se rompa en
// Outlook de escritorio -- degrada a "no se ve la foto" en el peor caso,
// nunca a un diseño roto.
const EMAIL_HERO_IMG = `${APP_URL}/img/landing/email-hero-gym.jpg`;
function emailWrapper(contenido, subtitulo) {
  return `<div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #232323;border-radius:16px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
        <tr><td style="line-height:0;font-size:0">
          <img src="${EMAIL_HERO_IMG}" width="560" alt="K-ONE" style="display:block;width:100%;max-width:560px;height:auto;border:0">
        </td></tr>
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#E8490F">&nbsp;</td></tr>
        <tr><td style="padding:24px 28px 18px;text-align:center">
          <span style="font-size:24px;font-weight:900;letter-spacing:3px;color:#F0EDE8">K-</span><span style="font-size:24px;font-weight:900;letter-spacing:3px;color:#E8490F">ONE</span>
          ${subtitulo ? `<div style="font-size:11px;color:#8A8A8A;letter-spacing:1.5px;margin-top:6px;text-transform:uppercase">${subtitulo}</div>` : ''}
        </td></tr>
      </table>
      ${contenido}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #232323">
        <tr><td style="padding:18px 28px;text-align:center">
          <p style="color:#5A5A5A;font-size:12px;margin:0">Equipo K-<span style="color:#E8490F;font-weight:600">ONE</span></p>
          <p style="color:#444;font-size:10px;margin:8px 0 0"><a href="mailto:k.one.fit26@gmail.com" style="color:#E8490F;text-decoration:none">k.one.fit26@gmail.com</a> &middot; <a href="${APP_URL}" style="color:#666;text-decoration:none">k-one.fit</a></p>
        </td></tr>
      </table>
    </div>
  </div>`;
}

async function handleCronRetencion(req, res) {
  const crypto = require('crypto');
  const secret = req.headers.authorization?.replace('Bearer ', '') || req.query?.secret;
  const expected = process.env.CRON_SECRET || '';
  // Comparar hashes: longitud siempre igual, así timingSafeEqual nunca lanza
  // (con buffers de distinta longitud lanzaría RangeError → 500 en vez de 401).
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  if (!secret || !expected || !crypto.timingSafeEqual(h(secret), h(expected))) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Nota: esto también deja sin correr el bloque de push de más abajo, no
  // solo los emails -- ambos comparten este único cron diario. Hoy no es un
  // problema real (RESEND_API_KEY está configurada en producción), pero si
  // algún día se quita esa key sin querer, el push diario se apagaría con
  // ella aunque las claves VAPID sigan puestas. Si eso llega a pasar, mover
  // el bloque de push antes de este `if` para desacoplarlos.
  if (!apiKey) return res.status(200).json({ ok: true, skipped: true });

  try {
    const supa = getSupabaseAdmin();
    const ahora = new Date();
    const hace3d = new Date(ahora.getTime() - 3 * 86400000).toISOString();
    const hace4d = new Date(ahora.getTime() - 4 * 86400000).toISOString();
    const hace8d = new Date(ahora.getTime() - 8 * 86400000).toISOString();
    const hace9d = new Date(ahora.getTime() - 9 * 86400000).toISOString();

    // supabase-js no lanza: devuelve {data, error}. Si last_seen aún no existe,
    // reintentar sin esa columna para no dejar el cron entero sin perfiles.
    let perfiles;
    {
      const r = await supa.from('profiles').select('id, nombre, email, userdata, created_at, last_seen');
      if (r.error) {
        const r2 = await supa.from('profiles').select('id, nombre, email, userdata, created_at');
        perfiles = r2.data;
      } else {
        perfiles = r.data;
      }
    }
    const { data: subs } = await supa.from('subscriptions').select('user_id, status');
    const subByUser = {};
    (subs || []).forEach(s => { subByUser[s.user_id] = s; });

    let authLastSignIn = {};
    try {
      const { data: { users } } = await supa.auth.admin.listUsers({ perPage: 1000 });
      (users || []).forEach(u => { if (u.last_sign_in_at) authLastSignIn[u.id] = u.last_sign_in_at; });
    } catch (_) {}

    const { data: enviados } = await supa.from('email_log').select('destinatario, tipo').in('tipo', ['retencion_dia3', 'retencion_dia8', 'reenganche_7d', 'reenganche_14d', 'reenganche_21d']);
    const yaEnviado = new Set();
    (enviados || []).forEach(e => yaEnviado.add(`${e.tipo}:${e.destinatario}`));

    let enviados3 = 0, enviados8 = 0, enviadosReenganche = 0;

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
        const htmlDia3 = emailWrapper(`
            <div style="padding:28px 28px 0">
              <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 18px">El mejor momento para empezar siempre es hoy</h1>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Te registraste en K-ONE hace unos días y eso ya dice algo de ti: <span style="color:#F0EDE8">que quieres dar el paso</span>. A veces lo difícil no es entrenar, es empezar.</p>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 18px">Tu plan personalizado está a <span style="color:#F0EDE8;font-weight:500">menos de 2 minutos</span>. Solo necesitamos que completes un cuestionario rápido y nosotros nos encargamos del resto: entrenamiento, nutrición y progresión semanal.</p>
              <div style="background:#0A0A0A;border:1px solid #232323;border-radius:10px;padding:16px 20px;margin:0 0 18px;border-left:3px solid #E8490F">
                <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:10px">QUÉ VAS A CONSEGUIR</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
                  <td style="padding:4px 0;font-size:13px;color:#B5B2AD"><span style="color:#E8490F">&#10003;</span> Plan de entreno adaptado a ti</td>
                  <td style="padding:4px 0;font-size:13px;color:#B5B2AD"><span style="color:#E8490F">&#10003;</span> Nutrición con 5 opciones/comida</td>
                </tr><tr>
                  <td style="padding:4px 0;font-size:13px;color:#B5B2AD"><span style="color:#E8490F">&#10003;</span> Progresión semanal automática</td>
                  <td style="padding:4px 0;font-size:13px;color:#B5B2AD"><span style="color:#E8490F">&#10003;</span> Vídeos de cada ejercicio</td>
                </tr></table>
              </div>
              <p style="margin:0 0 20px;font-size:14px;color:#B5B2AD;text-align:center"><span style="color:#F0EDE8;font-style:italic">"Un paso cada vez"</span> — y este es el primero.</p>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">COMPLETAR MI PLAN</a>
            </div>
          `);
        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: email,
          subject: `${esc(primerNombre)}, el mejor momento para empezar siempre es hoy`,
          html: htmlDia3
        });
        await supa.from('email_log').insert({ tipo: 'retencion_dia3', destinatario: email, asunto: 'El mejor momento para empezar siempre es hoy', html: htmlDia3, datos: JSON.stringify({ nombre, resumen: 'Retención día 3: motivacional para completar cuestionario.' }) });
        enviados3++;
      }

      // DÍA 8: registrado hace 8-9 días, SÍ completó cuestionario, NO tiene sub activa
      if (p.created_at >= hace9d && p.created_at < hace8d && ud.onboardingCompletado && !tieneSubActiva) {
        if (yaEnviado.has(`retencion_dia8:${email}`)) continue;
        const deporte = ud.deporte || 'Tu deporte';
        const objetivo = ud.objetivo || 'Tu objetivo';
        const dias = ud.diasEntreno || ud.dias || '3-5';
        const htmlDia8 = emailWrapper(`
            <div style="padding:28px 28px 0">
              <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 18px">Ya sabes qué quieres. Ahora toca ir a por ello.</h1>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hace una semana dedicaste tu tiempo a generar tu plan en K-ONE. Eso no lo hace cualquiera — la mayoría se queda en "ya lo haré mañana".</p>
              <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 18px">Tu plan sigue guardado, preparado para ti:</p>
              <div style="background:#0A0A0A;border:1px solid #232323;border-radius:10px;padding:18px 20px;margin:0 0 18px">
                <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:12px">TU PLAN PERSONALIZADO</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
                  <td style="padding:6px;width:50%"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#8A8A8A;margin-bottom:4px">Deporte</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">${esc(deporte)}</div></div></td>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#8A8A8A;margin-bottom:4px">Objetivo</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">${esc(objetivo)}</div></div></td>
                </tr><tr>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#8A8A8A;margin-bottom:4px">Entrenos</div><div style="font-size:15px;font-weight:600;color:#E8490F">${esc(String(dias))} días/sem</div></div></td>
                  <td style="padding:6px"><div style="background:#1E1E1E;border-radius:8px;padding:12px 14px;text-align:center"><div style="font-size:11px;color:#8A8A8A;margin-bottom:4px">Nutrición</div><div style="font-size:15px;font-weight:600;color:#F0EDE8">5 comidas</div></div></td>
                </tr></table>
              </div>
              <div style="background:#0A0A0A;border:1px solid #232323;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 20px">
                <p style="margin:0;font-size:13px;color:#B5B2AD;line-height:1.6"><span style="color:#F0EDE8;font-weight:500">La diferencia entre querer y hacer es empezar.</span> Tu plan ya está hecho — solo falta que lo actives.</p>
              </div>
              <p style="margin:0 0 20px;font-size:13px;color:#8A8A8A;text-align:center">Primer mes <span style="color:#E8490F;font-weight:600;font-size:16px">gratis</span> · Sin código · Sin permanencia · Cancela cuando quieras</p>
            </div>
            <div style="padding:0 28px 28px;text-align:center">
              <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">ACTIVAR MI PLAN</a>
            </div>
          `);
        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: email,
          subject: `${esc(primerNombre)}, ya sabes qué quieres. Ahora toca ir a por ello.`,
          html: htmlDia8
        });
        await supa.from('email_log').insert({ tipo: 'retencion_dia8', destinatario: email, asunto: 'Ya sabes qué quieres. Ahora toca ir a por ello.', html: htmlDia8, datos: JSON.stringify({ nombre, deporte, objetivo, resumen: `Retención día 8: plan personalizado (${deporte}, ${objetivo}), CTA primer mes gratis.` }) });
        enviados8++;
      }

      // RE-ENGAGEMENT: clientes ACTIVOS que llevan días sin abrir la web.
      // Usa last_seen (heartbeat del front) con fallback a last_sign_in_at (auth).
      // 3 niveles: 7d (suave), 14d (directo), 21d (urgente). Cada uno se envía una sola vez.
      if (tieneSubActiva && ud.onboardingCompletado) {
        const ultimaVez = p.last_seen || authLastSignIn[p.id] || null;
        if (ultimaVez) {
          const diasInactivo = (ahora.getTime() - new Date(ultimaVez).getTime()) / 86400000;

          // 7 DÍAS sin entrar
          if (diasInactivo >= 7 && diasInactivo < 14 && !yaEnviado.has(`reenganche_7d:${email}`)) {
            const frases7 = [
              'Una semana sin entrenar no es el fin — es el principio de volver con más ganas.',
              'La motivación va y viene. La disciplina se queda.',
              'No se trata de no caer, se trata de levantarse cada vez.',
            ];
            const frase = frases7[Math.floor(Math.random() * frases7.length)];
            const htmlReeng7 = emailWrapper(`
                <div style="padding:28px 28px 0">
                  <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 18px">Llevas una semana fuera. Tu plan sigue aquí.</h1>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Llevas unos días sin pasarte por K-ONE. No pasa nada — todos tenemos semanas complicadas. Pero tu plan de entrenamiento y nutrición sigue ahí, adaptado a ti, listo para cuando vuelvas.</p>
                  <div style="background:#0A0A0A;border:1px solid #232323;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 20px">
                    <p style="margin:0;font-size:13px;color:#B5B2AD;line-height:1.6;font-style:italic">"${frase}"</p>
                  </div>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 20px">Un solo entreno hoy puede cambiar toda la semana. <span style="color:#F0EDE8;font-weight:500">¿Volvemos?</span></p>
                </div>
                <div style="padding:0 28px 28px;text-align:center">
                  <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">VOLVER A MI PLAN</a>
                </div>
              `);
            await enviarEmail(apiKey, {
              from: 'K-ONE <equipo@k-one.fit>',
              reply_to: ADMIN_EMAIL,
              to: email,
              subject: `${esc(primerNombre)}, tu plan te sigue esperando`,
              html: htmlReeng7
            });
            await supa.from('email_log').insert({ tipo: 'reenganche_7d', destinatario: email, asunto: 'Tu plan te sigue esperando', html: htmlReeng7, datos: JSON.stringify({ nombre, resumen: `Re-engagement 7d: ${primerNombre} lleva ~${Math.round(diasInactivo)} días sin entrar. Motivacional suave.` }) });
            enviadosReenganche++;
          }

          // 14 DÍAS sin entrar
          if (diasInactivo >= 14 && diasInactivo < 21 && !yaEnviado.has(`reenganche_14d:${email}`)) {
            const entrenos = Array.isArray(ud.historialEntrenos) ? ud.historialEntrenos.length : 0;
            const semana = ud.progreso?.semana || 1;
            const htmlReeng14 = emailWrapper(`
                <div style="padding:28px 28px 0">
                  <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 18px">Dos semanas. Tu cuerpo lo nota.</h1>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Llevas 2 semanas sin abrir K-ONE. No te escribo para presionarte — te escribo porque sé que <span style="color:#F0EDE8">cuando empezaste, lo hiciste por algo</span>. Ese objetivo sigue ahí.</p>
                  <div style="background:#0A0A0A;border:1px solid #232323;border-radius:10px;padding:18px 20px;margin:0 0 18px">
                    <div style="font-size:11px;color:#E8490F;letter-spacing:1px;font-weight:600;margin-bottom:12px">LO QUE HAS CONSTRUIDO HASTA AHORA</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
                      <td width="50%" style="padding:0 4px 0 0;background:#1E1E1E;border-radius:8px;text-align:center">
                        <div style="padding:12px"><div style="font-size:22px;font-weight:700;color:#27ae60">${entrenos}</div>
                        <div style="font-size:10px;color:#8A8A8A;margin-top:2px">Entrenos</div></div>
                      </td>
                      <td width="8" style="font-size:0;line-height:0">&nbsp;</td>
                      <td width="50%" style="padding:0 0 0 4px;background:#1E1E1E;border-radius:8px;text-align:center">
                        <div style="padding:12px"><div style="font-size:22px;font-weight:700;color:#F0EDE8">S${semana}</div>
                        <div style="font-size:10px;color:#8A8A8A;margin-top:2px">Semana</div></div>
                      </td>
                    </tr></table>
                  </div>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 20px">No tienes que empezar de cero. Solo tienes que <span style="color:#F0EDE8;font-weight:500">volver a abrir la puerta</span>. Tu plan está actualizado y esperándote.</p>
                </div>
                <div style="padding:0 28px 28px;text-align:center">
                  <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">RETOMAR MI ENTRENAMIENTO</a>
                </div>
              `);
            await enviarEmail(apiKey, {
              from: 'K-ONE <equipo@k-one.fit>',
              reply_to: ADMIN_EMAIL,
              to: email,
              subject: `${esc(primerNombre)}, no dejes que se enfríe lo que ya empezaste`,
              html: htmlReeng14
            });
            await supa.from('email_log').insert({ tipo: 'reenganche_14d', destinatario: email, asunto: 'No dejes que se enfríe lo que ya empezaste', html: htmlReeng14, datos: JSON.stringify({ nombre, entrenos, semana, resumen: `Re-engagement 14d: ${primerNombre} lleva ~${Math.round(diasInactivo)} días sin entrar. ${entrenos} entrenos, semana ${semana}.` }) });
            enviadosReenganche++;
          }

          // 21 DÍAS (3 semanas) sin entrar
          if (diasInactivo >= 21 && !yaEnviado.has(`reenganche_21d:${email}`)) {
            const deporte = ud.deporte || 'tu deporte';
            const htmlReeng21 = emailWrapper(`
                <div style="padding:28px 28px 0">
                  <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 18px">Tres semanas. Esto es un aviso de tu yo del futuro.</h1>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Hola <span style="color:#E8490F;font-weight:600">${esc(primerNombre)}</span>,</p>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Llevas 3 semanas sin entrar en K-ONE. No sé qué ha pasado — quizá la vida, el trabajo, la pereza, o simplemente que no era el momento. <span style="color:#F0EDE8">Todo eso es normal</span>.</p>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 14px">Pero te cuento algo: <span style="color:#F0EDE8;font-weight:500">la disciplina no es entrenar cuando te apetece. Es hacerlo cuando no te apetece</span>. Y hoy puede ser ese día.</p>
                  <div style="background:#0A0A0A;border:1px solid #232323;border-left:3px solid #E8490F;border-radius:0 10px 10px 0;padding:14px 18px;margin:0 0 18px">
                    <p style="margin:0;font-size:14px;color:#F0EDE8;line-height:1.6;font-weight:500">Prepárate. Tu plan de ${esc(deporte)} te está esperando. Solo necesitas 45 minutos para volver a sentirte bien.</p>
                  </div>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 8px">Si algo no te convence del plan o necesitas un cambio, escríbenos. Para eso estamos.</p>
                  <p style="color:#B5B2AD;font-size:14px;line-height:1.7;margin:0 0 20px">Si quieres cancelar, puedes hacerlo desde tu perfil con un clic. Pero antes — <span style="color:#E8490F;font-weight:600">dale una oportunidad más</span>.</p>
                </div>
                <div style="padding:0 28px 28px;text-align:center">
                  <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;letter-spacing:0.5px;border-radius:8px">VOLVER A ENTRENAR</a>
                  <p style="margin:12px 0 0;font-size:12px;color:#5A5A5A">¿Dudas? Responde a este email y te ayudamos.</p>
                </div>
              `);
            await enviarEmail(apiKey, {
              from: 'K-ONE <equipo@k-one.fit>',
              reply_to: ADMIN_EMAIL,
              to: email,
              subject: `${esc(primerNombre)}, llevas 3 semanas sin entrar. ¿Todo bien?`,
              html: htmlReeng21
            });
            await supa.from('email_log').insert({ tipo: 'reenganche_21d', destinatario: email, asunto: 'Llevas 3 semanas sin entrar', html: htmlReeng21, datos: JSON.stringify({ nombre, deporte, resumen: `Re-engagement 21d: ${primerNombre} lleva ~${Math.round(diasInactivo)} días sin entrar. Último aviso. Deporte: ${deporte}.` }) });
            enviadosReenganche++;
          }
        }
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

        // Datos extra a petición del usuario (18 ago 2026): comparación con
        // la semana pasada, récord de fuerza y hito conseguido esta semana.
        // Los tres son opcionales de verdad -- si no hay dato, ese bloque
        // simplemente no se pinta, nunca se rellena con algo inventado.
        const entrenosSemanaPasada = _entrenosSemanaAnterior(ud, ahora);
        const comparacionTxt = entrenos > entrenosSemanaPasada
          ? `↑ ${entrenos - entrenosSemanaPasada} más que la semana pasada (${entrenosSemanaPasada})`
          : entrenos < entrenosSemanaPasada
            ? `↓ ${entrenosSemanaPasada - entrenos} menos que la semana pasada (${entrenosSemanaPasada})`
            : entrenosSemanaPasada > 0 ? `= Igual que la semana pasada` : null;

        const recordsSemana = _recordsFuerzaSemana(ud, ahora);
        const mejorRecord = recordsSemana[0] || null;
        const recordExtraTxt = recordsSemana.length > 1 ? ` (+${recordsSemana.length - 1} ejercicio${recordsSemana.length > 2 ? 's' : ''} más)` : '';

        const nombreHito = _hitoDeEstaSemana(ud, ahora);

        const mensajes = [
          'La constancia gana a la motivación. Cada entreno cuenta.',
          'No se trata de ser perfecto, se trata de no parar.',
          'El progreso no siempre se ve en el espejo. Se nota en la energía.',
          'Quien entrena hoy, agradece mañana.',
          'La disciplina es elegir entre lo que quieres ahora y lo que quieres de verdad.'
        ];
        const mensajeSemana = mensajes[semana % mensajes.length];

        // Antes: fila de 3 cajas con display:flex (Outlook de escritorio no
        // soporta flex -- se apilaban en vertical en vez de en fila) y un
        // "Tu semana en K-ONE" genérico como único titular. Ahora: fila de
        // estadísticas con <table> de verdad (misma técnica que ya usan
        // otras plantillas de este fichero, ej. el email de día 8), eyebrow
        // "SEMANA N" + titular que saluda por nombre, y números más grandes
        // para que el resumen se lea de un vistazo.
        const htmlResumen = emailWrapper(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:0 28px 20px">
                <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#E8490F;text-transform:uppercase;margin-bottom:10px">Semana ${semana}</div>
                <h1 style="color:#F0EDE8;font-size:21px;font-weight:700;margin:0 0 8px;line-height:1.3">Hola ${esc(nombre)}, así te ha ido esta semana</h1>
                <p style="color:#8A8A8A;font-size:13.5px;line-height:1.6;margin:0">Tu resumen, calculado solo con tus datos.</p>
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr>
                <td width="33.33%" style="padding:0 4px 0 28px;background:#0A0A0A;border:1px solid #232323;border-radius:12px;text-align:center">
                  <div style="padding:16px 6px"><div style="font-size:27px;font-weight:900;color:#27ae60;line-height:1;font-family:Arial,Helvetica,sans-serif">${entrenos}</div>
                  <div style="font-size:10px;color:#8A8A8A;letter-spacing:1px;text-transform:uppercase;margin-top:6px">Entrenos</div></div>
                </td>
                <td width="6" style="font-size:0;line-height:0">&nbsp;</td>
                <td width="33.33%" style="padding:0 4px;background:#0A0A0A;border:1px solid #232323;border-radius:12px;text-align:center">
                  <div style="padding:16px 6px"><div style="font-size:27px;font-weight:900;color:#E8490F;line-height:1;font-family:Arial,Helvetica,sans-serif">${racha}</div>
                  <div style="font-size:10px;color:#8A8A8A;letter-spacing:1px;text-transform:uppercase;margin-top:6px">Racha</div></div>
                </td>
                <td width="6" style="font-size:0;line-height:0">&nbsp;</td>
                <td width="33.33%" style="padding:0 28px 0 4px;background:#0A0A0A;border:1px solid #232323;border-radius:12px;text-align:center">
                  <div style="padding:16px 6px"><div style="font-size:27px;font-weight:900;color:#F0EDE8;line-height:1;font-family:Arial,Helvetica,sans-serif">S${semana}</div>
                  <div style="font-size:10px;color:#8A8A8A;letter-spacing:1px;text-transform:uppercase;margin-top:6px">Semana</div></div>
                </td>
              </tr>
            </table>
            ${comparacionTxt ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:10px 28px 0;text-align:center">
                <span style="font-size:11.5px;color:#8A8A8A;font-family:'Courier New',monospace">${esc(comparacionTxt)}</span>
              </td></tr>
            </table>` : ''}
            ${mejorRecord ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:18px 28px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border:1px solid #232323;border-radius:12px">
                  <tr><td style="padding:14px 18px">
                    <div style="font-size:10px;letter-spacing:1.5px;color:#27ae60;font-weight:700;text-transform:uppercase;margin-bottom:6px">Récord de la semana</div>
                    <p style="margin:0;font-size:14px;color:#F0EDE8;line-height:1.5"><strong>${esc(mejorRecord.nombre)}</strong>: ${esc(String(mejorRecord.antes))} → <span style="color:#27ae60;font-weight:700">${esc(String(mejorRecord.ahora))} kg</span>${esc(recordExtraTxt)}</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>` : ''}
            ${nombreHito ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:18px 28px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border:1px solid #232323;border-radius:12px">
                  <tr><td style="padding:14px 18px">
                    <div style="font-size:10px;letter-spacing:1.5px;color:#E8490F;font-weight:700;text-transform:uppercase;margin-bottom:6px">Nuevo hito desbloqueado</div>
                    <p style="margin:0;font-size:14px;color:#F0EDE8;line-height:1.5;font-weight:600">${esc(nombreHito)}</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>` : ''}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:20px 28px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border-left:3px solid #E8490F;border-radius:0 10px 10px 0">
                  <tr><td style="padding:14px 18px">
                    <p style="margin:0;font-size:13px;color:#B5B2AD;line-height:1.6;font-style:italic">&ldquo;${esc(mensajeSemana)}&rdquo;</p>
                  </td></tr>
                </table>
              </td></tr>
              <tr><td style="padding:24px 28px 28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:13px 34px;font-size:13px;font-weight:700;letter-spacing:1px;border-radius:10px">VER MI PLAN →</a>
              </td></tr>
            </table>
          `);
        await enviarEmail(apiKey, {
          from: 'K-ONE <equipo@k-one.fit>',
          reply_to: ADMIN_EMAIL,
          to: p.email,
          subject: `${esc(nombre)}, tu semana ${semana} en K-ONE`,
          html: htmlResumen
        });
        await supa.from('email_log').insert({ tipo: 'resumen_semanal', destinatario: p.email, asunto: `Semana ${semana}`, html: htmlResumen, datos: JSON.stringify({ nombre, entrenos, racha, semana, resumen: `Resumen semana ${semana}: ${entrenos} entrenos, racha ${racha} días. Mensaje: "${mensajeSemana}"` }) });
        enviadosResumen++;
      }
    }

    // AVISO DIARIO AL ADMIN: "qué requiere tu atención hoy" (una vez al día).
    // Consultas propias y defensivas para no depender de la lógica de retención.
    try {
      const hoyStr = ahora.toISOString().slice(0, 10);
      const { data: yaDigest } = await supa.from('email_log')
        .select('id').eq('tipo', 'digest_admin').gte('created_at', hoyStr + 'T00:00:00').limit(1);
      if (!yaDigest || yaDigest.length === 0) {
        const { data: subsFull } = await supa.from('subscriptions')
          .select('user_id, status, cancel_at_period_end');
        const subMap = {}; (subsFull || []).forEach(s => { subMap[s.user_id] = s; });
        let profsFull = [];
        {
          const r = await supa.from('profiles').select('id, userdata, is_beta, beta_expires, last_seen');
          if (r.error) {
            const r2 = await supa.from('profiles').select('id, userdata, is_beta, beta_expires');
            profsFull = r2.data || [];
          } else {
            profsFull = r.data || [];
          }
        }
        const now = ahora.getTime();
        let pagoFallido = 0, cancela = 0, premiumCaduca = 0, inactivos = 0, sinEntrenar = 0;
        for (const p of profsFull) {
          const s = subMap[p.id]; const st = s?.status || 'none'; const activo = ['active', 'trialing'].includes(st);
          const ud = p.userdata || {};
          const ent = Array.isArray(ud.historialEntrenos) ? ud.historialEntrenos.length
            : (Array.isArray(ud.entrenosCompletados) ? ud.entrenosCompletados.length : 0);
          if (st === 'past_due') pagoFallido++;
          if (activo && s?.cancel_at_period_end) cancela++;
          if (p.is_beta && p.beta_expires && (new Date(p.beta_expires).getTime() - now) < 7 * 86400000) premiumCaduca++;
          if (activo && ent === 0) sinEntrenar++;
          const ls = p.last_seen ? new Date(p.last_seen).getTime() : null;
          if (ud.onboardingCompletado && ls && (now - ls) / 86400000 > 14) inactivos++;
        }
        let sinResponder = 0;
        try {
          const { count } = await supa.from('mensajes_cliente').select('id', { count: 'exact', head: true }).is('respuesta', null);
          sinResponder = count || 0;
        } catch (_) {}

        const filas = [
          { n: pagoFallido,   t: 'Pagos fallidos',          c: '#e74c3c' },
          { n: cancela,       t: 'Cancelan al vencer',      c: '#e67e22' },
          { n: premiumCaduca, t: 'Premium por caducar (7d)',c: '#f0a500' },
          { n: inactivos,     t: 'Inactivos +14 días',      c: '#e67e22' },
          { n: sinEntrenar,   t: 'Activos sin entrenar',    c: '#f0a500' },
          { n: sinResponder,  t: 'Mensajes sin responder',  c: '#9b59b6' },
        ].filter(f => f.n > 0);
        const totalAcc = filas.reduce((a, f) => a + f.n, 0);

        if (totalAcc > 0) {
          const filasHtml = filas.map(f => `<tr>
            <td style="padding:10px 14px;border-bottom:1px solid #232323;color:#B5B2AD;font-size:14px">${f.t}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #232323;text-align:right;font-size:18px;font-weight:700;color:${f.c}">${f.n}</td>
          </tr>`).join('');
          const htmlDigest = emailWrapper(`
              <div style="padding:28px 28px 0">
                <h1 style="color:#F0EDE8;font-size:20px;font-weight:600;margin:0 0 6px">Resumen de Jarvis</h1>
                <p style="color:#B5B2AD;font-size:13px;line-height:1.6;margin:0 0 18px">Esto es lo que requiere tu atención hoy en K-ONE:</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border:1px solid #232323;border-radius:10px;overflow:hidden">${filasHtml}</table>
              </div>
              <div style="padding:20px 28px 28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:12px 32px;font-size:14px;font-weight:600;border-radius:8px">ABRIR JARVIS</a>
              </div>`);
          await enviarEmail(apiKey, {
            from: 'K-ONE Jarvis <equipo@k-one.fit>',
            to: ADMIN_EMAIL,
            subject: `Jarvis · ${totalAcc} cosa${totalAcc > 1 ? 's' : ''} requieren tu atención hoy`,
            html: htmlDigest
          });
          await supa.from('email_log').insert({
            tipo: 'digest_admin', destinatario: ADMIN_EMAIL,
            asunto: `Jarvis · ${totalAcc} requieren atención`, html: htmlDigest,
            datos: JSON.stringify({ resumen: filas.map(f => `${f.t}: ${f.n}`).join(' · '), pagoFallido, cancela, premiumCaduca, inactivos, sinEntrenar, sinResponder })
          });
        }
      }
    } catch (digestErr) { console.error('[notify] digest admin error:', digestErr.message); }

    // RECORDATORIO PUSH DIARIO: "¿entrenas hoy?" a quien tenga la suscripción
    // activada y todavía no haya marcado ningún entreno hoy. No depende de
    // RESEND_API_KEY -- si no hay claves VAPID configuradas, simplemente no
    // se manda nada (igual que el resto del cron cuando falta una env var).
    let pushEnviados = 0;
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (vapidPublic && vapidPrivate) {
      try {
        webpush.setVapidDetails(`mailto:${ADMIN_EMAIL}`, vapidPublic, vapidPrivate);
        const { data: subsPush } = await supa.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth_key');
        if (subsPush && subsPush.length) {
          const hoyMadrid = _hoyMadridISO();
          const idxDiaHoy = _indiceDiaMadrid();
          const nombreDiaHoy = DIAS_SEMANA_PUSH[idxDiaHoy];
          const perfilPorId = {};
          (perfiles || []).forEach(p => { perfilPorId[p.id] = p; });

          // El plan de cada cliente (para poder decirle QUÉ le toca hoy, no solo
          // "entrena"). Se pide aparte y SOLO para quien tiene push activado, en
          // vez de añadir `plan` al select general de profiles: ese select trae
          // TODOS los perfiles y la columna admite hasta 2 MB por fila, así que
          // meterla ahí multiplicaría por mucho lo que descarga el cron diario.
          const idsPush = [...new Set(subsPush.map(s => s.user_id).filter(Boolean))];
          const planPorId = {};
          if (idsPush.length) {
            const rPlanes = await supa.from('profiles').select('id, plan').in('id', idsPush);
            if (rPlanes.error) {
              // Sin planes seguimos: el aviso sale en su versión genérica.
              console.warn('[notify-cron] no se pudieron cargar los planes para el push:', rPlanes.error.message);
            } else {
              (rPlanes.data || []).forEach(r => { planPorId[r.id] = r.plan; });
            }
          }

          // Margen de sobra en UTC (las últimas 30h cubren cualquier desfase
          // entre huso UTC y Madrid) y luego se filtra fino por calendario de
          // Madrid en JS -- así el dedupe usa el MISMO criterio de "hoy" que
          // el check de "ya entrenó" de un poco más abajo, en vez de mezclar
          // un límite en UTC con una comprobación en huso de Madrid.
          const { data: yaPush } = await supa.from('email_log')
            .select('destinatario, created_at').eq('tipo', 'push_recordatorio_diario')
            .gte('created_at', new Date(ahora.getTime() - 30 * 3600000).toISOString());
          const yaAvisadoHoy = new Set(
            (yaPush || [])
              .filter(e => _hoyMadridISO(e.created_at) === hoyMadrid)
              .map(e => e.destinatario)
          );

          for (const sub of subsPush) {
            const p = perfilPorId[sub.user_id];
            if (!p || !p.email || yaAvisadoHoy.has(p.email)) continue;
            const ud = p.userdata || {};
            if (!ud.onboardingCompletado) continue;
            const s = subByUser[p.id];
            if (!s || !['active', 'trialing'].includes(s.status)) continue;
            const historial = Array.isArray(ud.historialEntrenos) ? ud.historialEntrenos : [];
            if (historial.includes(hoyMadrid)) continue; // ya entrenó hoy

            // Qué le toca HOY según su propio plan. semana[] va de lunes (0) a
            // domingo (6), igual que idxDiaHoy.
            const diaPlan = planPorId[p.id]?.semana?.[idxDiaHoy] || null;
            const esDescanso = diaPlan ? diaPlan.tipo === 'Descanso' : false;

            // Con nombre y variado, no el mismo aviso robótico cada día --
            // mismo criterio que ya usan los mensajes de racha en index.html.
            const primerNombrePush = (p.nombre || ud.nombre || '').split(' ')[0] || '';
            const coma = primerNombrePush ? `, ${primerNombrePush}` : '';

            let cuerpoPush;
            if (esDescanso) {
              // Antes se mandaba "¿entrenas hoy?" TODOS los días, también en los
              // de descanso programado: el aviso contradecía al propio plan y
              // empujaba justo el día que toca recuperar.
              cuerpoPush = `Hoy toca descanso${coma}. Recuperar también es entrenar.`;
            } else if (diaPlan && diaPlan.resumen) {
              cuerpoPush = `Hoy toca: ${diaPlan.resumen}.`;
            } else {
              // Sin plan cargado (cliente antiguo, plan aún sin generar): aviso
              // genérico de siempre.
              const frasesPush = primerNombrePush ? [
                `${primerNombrePush}, tu plan de hoy te está esperando.`,
                `¿Entrenas hoy, ${primerNombrePush}? Tienes el plan listo.`,
                `Hoy toca${coma}. Un paso más.`
              ] : [
                'Tu plan de hoy te está esperando.',
                '¿Entrenas hoy? Tienes el plan listo.',
                'Hoy toca. Un paso más.'
              ];
              cuerpoPush = frasesPush[Math.floor(Math.random() * frasesPush.length)];
            }

            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
                // El día de la semana va en el título: es lo primero que se lee
                // en la notificación, antes de desplegarla.
                JSON.stringify({ title: `K-ONE · ${nombreDiaHoy}`, body: cuerpoPush, url: '/' })
              );
              await supa.from('email_log').insert({ tipo: 'push_recordatorio_diario', destinatario: p.email, asunto: 'Recordatorio push diario', datos: JSON.stringify({ resumen: 'Push: recordatorio de entreno diario.' }) });
              // Sin esto, un cliente con 2+ dispositivos suscritos (móvil +
              // portátil) recibía el push una vez POR DISPOSITIVO en la misma
              // pasada del cron -- yaAvisadoHoy solo se rellenaba una vez al
              // principio, antes del bucle, así que la segunda vuelta para el
              // mismo email todavía no lo veía como "ya avisado".
              yaAvisadoHoy.add(p.email);
              pushEnviados++;
            } catch (pushErr) {
              // 404/410 = el navegador anuló la suscripción (desinstaló, borró
              // datos del sitio...) -- limpiarla para no reintentar cada día
              // contra un endpoint que ya no existe. Cualquier otro código (400
              // por claves corruptas, 413...) se manda a Sentry -- si no, una
              // suscripción rota reintenta en silencio cada día para siempre,
              // sin que nadie se entere salvo mirando logs de Vercel a mano.
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await supa.from('push_subscriptions').delete().eq('id', sub.id);
              } else {
                console.warn('[notify-cron] push error:', pushErr.message);
                capturarError(pushErr, { fn: 'notify-cron-push', endpoint: sub.endpoint });
              }
            }
          }
        }
      } catch (pushBlockErr) { console.error('[notify-cron] push diario error:', pushBlockErr.message); }
    }

    // BACKUP DIARIO: snapshot de profiles + subscriptions → Supabase Storage
    let backupOk = false;
    try {
      // Ninguna de las 3 comprobaba `error` explícitamente (supabase-js no
      // lanza) -- si cualquiera fallaba de forma transitoria, `data` quedaba
      // `undefined`, caía al `|| []`, y el backup se subía igual con arrays
      // vacíos. `uploadErr` sí se comprobaba, pero el upload en sí no falla
      // por subir un JSON vacío -- así que `backupOk` se reportaba `true`
      // (log: "backup: OK") con un backup del día inservible, sin que nadie
      // se enterase.
      const rProfiles = await supa.from('profiles').select('*');
      const rSubs = await supa.from('subscriptions').select('*');
      const rEmails = await supa.from('email_log').select('id, tipo, destinatario, asunto, created_at').order('created_at', { ascending: false }).limit(500);
      const erroresBackup = [rProfiles, rSubs, rEmails].map(r => r.error).filter(Boolean);
      if (erroresBackup.length) {
        throw new Error('Consulta fallida al preparar el backup: ' + erroresBackup.map(e => e.message).join(' | '));
      }
      const allProfiles = rProfiles.data, allSubs = rSubs.data, allEmails = rEmails.data;
      const backup = {
        fecha: ahora.toISOString(),
        totalClientes: (allProfiles || []).length,
        totalSuscripciones: (allSubs || []).length,
        profiles: allProfiles || [],
        subscriptions: allSubs || [],
        emailLog: allEmails || []
      };
      const fileName = `backup-${ahora.toISOString().slice(0,10)}.json`;
      const { error: uploadErr } = await supa.storage
        .from('backups')
        .upload(fileName, JSON.stringify(backup, null, 2), {
          contentType: 'application/json',
          upsert: true
        });
      if (uploadErr) console.error('[notify-cron] backup upload error:', uploadErr.message);
      else backupOk = true;
    } catch (bErr) {
      console.error('[notify-cron] backup error:', bErr.message);
    }

    console.log(`[notify-cron] Retención: ${enviados3} día3, ${enviados8} día8, ${enviadosReenganche} reenganche, ${enviadosResumen} resumen, ${pushEnviados} push, backup: ${backupOk ? 'OK' : 'FAIL'}`);
    return res.status(200).json({ ok: true, enviados3, enviados8, enviadosReenganche, enviadosResumen, pushEnviados, backupOk });
  } catch (err) {
    console.error('[notify-cron] error:', err);
    capturarError(err, { fn: 'notify-cron' });
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return handleCronRetencion(req, res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  return handlePost(req, res);
};

// Reutilizables por otras funciones (p.ej. stripe-webhook.js para avisos al
// admin) vía require('./notify'). Esto es solo un import de módulo — no crea
// una función serverless nueva, así que no cuenta para el límite de Vercel.
module.exports.enviarEmail = enviarEmail;
module.exports.ADMIN_EMAIL = ADMIN_EMAIL;

async function handlePost(req, res) {

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
    // 'renovacion' quitado de aquí (auditoría 2 sept 2026): el email real de
    // renovación lo manda api/stripe-webhook.js con su propia plantilla
    // inline, sin pasar nunca por este endpoint -- nada legítimo llamaba a
    // POST /api/notify con tipo:'renovacion'. Pero SÍ era un tipo válido y
    // "protegido" (tiposProtegidos exigía sesión, sin más), así que
    // cualquier usuario autenticado (cualquier cliente, no hacía falta ser
    // admin) podía mandar `datos.email` arbitrario y K-ONE reenviaba un
    // email con remitente oficial a quien quisiera, sin límite de tasa
    // (estaLimitadoPorTasa solo cubre lead/mensaje/bienvenida) -- relay de
    // spam/phishing real con la reputación del dominio, y forma de agotar la
    // cuota diaria de Resend. Si algún día hace falta volver a exponer este
    // tipo por API, hay que resolver el email/nombre del PERFIL del usuario
    // autenticado, nunca del body de la petición.
    const tiposValidos = ['lead', 'bienvenida', 'opinion', 'mensaje'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo no válido' });
    }
    const tiposProtegidos = ['opinion'];
    if (tiposProtegidos.includes(tipo)) {
      const supa = getSupabaseAdmin();
      const user = await getAuthUser(req, supa);
      if (!user) return res.status(401).json({ error: 'No autenticado' });
    }
    // Rate-limit server-side para los tipos que NO exigen sesión (lead,
    // mensaje, bienvenida): antes, el único límite era un contador en
    // localStorage del propio navegador del cliente -- trivial de saltar con
    // curl/Postman o simplemente borrando esa clave. Sin esto, cualquiera
    // podía hacer que el dominio de K-ONE mandara correos arbitrarios
    // (spam/phishing) sin límite y quemara la cuota de Resend.
    //
    // 'bienvenida' no exige sesión a propósito: el aviso de "nuevo registro"
    // se dispara justo tras signUp(), y como el proyecto exige confirmar el
    // email, en ese instante todavía NO hay sesión activa (data.session es
    // null hasta que el cliente confirma) -- exigir auth aquí hacía que el
    // aviso nunca llegara (401 silencioso, ver notificarAdmin() en
    // index.html). Mismo perfil de riesgo que 'lead': email a destinatario
    // arbitrario sin sesión, acotado por límite de IP + validación.
    if (tipo === 'lead' || tipo === 'mensaje' || tipo === 'bienvenida') {
      const limitado = await estaLimitadoPorTasa(req, tipo);
      if (limitado) {
        return res.status(429).json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un rato.' });
      }
    }
    if ((tipo === 'lead' || tipo === 'bienvenida') && datos.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email)) {
        return res.status(400).json({ error: 'Email no válido' });
      }
    }
    if (tipo === 'bienvenida' && (datos.nombre || '').length > 100) {
      return res.status(400).json({ error: 'Algún campo supera la longitud máxima permitida' });
    }
    // El formulario de contacto solo validaba en el cliente (saltable con
    // curl/Postman): sin límite de tamaño ni formato de email real, aunque
    // el contenido ya se escapa con esc() antes de insertarlo en el HTML.
    if (tipo === 'mensaje') {
      if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email)) {
        return res.status(400).json({ error: 'Email no válido' });
      }
      if ((datos.nombre || '').length > 100 || (datos.asunto || '').length > 150 || (datos.mensaje || '').length > 3000) {
        return res.status(400).json({ error: 'Algún campo supera la longitud máxima permitida' });
      }
    }

    const emails = [];
    // Guarda el HTML real del email de cara al cliente (o al admin si el tipo
    // no tiene destinatario cliente) para poder verlo tal cual en Jarvis, no
    // solo un resumen de texto -- ver el insert en email_log más abajo.
    let htmlParaLog = null;

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

      // 2) Email al lead con preview del área de clientes. Antes tenía su
      // propio wrapper duplicado a mano (cabecera plana + flex en los chips
      // de macros, roto en Outlook) en vez de reutilizar emailWrapper().
      const optsLead = {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: datos.email,
        subject: 'Esto es lo que tendrías dentro de K-ONE',
        html: emailWrapper(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:22px 28px 0">
                <h1 style="color:#F0EDE8;font-size:21px;font-weight:700;margin:0 0 8px">Esto es lo que tendrías hoy</h1>
                <p style="color:#8A8A8A;font-size:13px;line-height:1.6;margin:0 0 22px">No es una plantilla genérica. Tu plan se genera con tu peso, altura, deporte, objetivo y lesiones. Se recalcula cada semana según tu progreso.</p>
              </td></tr>
              <tr><td style="padding:0 28px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border:1px solid #232323;border-radius:12px;margin-bottom:10px">
                  <tr><td style="padding:16px 18px">
                    <div style="font-size:10px;letter-spacing:2px;color:#E8490F;font-family:'Courier New',monospace;margin-bottom:8px">ENTRENAMIENTO DE HOY</div>
                    <div style="font-size:15px;font-weight:700;color:#F0EDE8;margin-bottom:10px">Lunes — Tren superior</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:12px">
                      <tr style="border-bottom:1px solid #232323"><td style="padding:5px 0;color:#B5B2AD">Press banca</td><td style="color:#8A8A8A;text-align:right;padding:5px 0">4×8</td></tr>
                      <tr style="border-bottom:1px solid #232323"><td style="padding:5px 0;color:#B5B2AD">Remo con mancuerna</td><td style="color:#8A8A8A;text-align:right;padding:5px 0">4×10</td></tr>
                      <tr style="border-bottom:1px solid #232323"><td style="padding:5px 0;color:#B5B2AD">Press militar</td><td style="color:#8A8A8A;text-align:right;padding:5px 0">3×10</td></tr>
                      <tr><td style="padding:5px 0;color:#5A5A5A;font-style:italic" colspan="2">+ 3 ejercicios más...</td></tr>
                    </table>
                  </td></tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#0A0A0A;border:1px solid #232323;border-radius:12px;margin-bottom:20px">
                  <tr><td style="padding:16px 18px">
                    <div style="font-size:10px;letter-spacing:2px;color:#E8490F;font-family:'Courier New',monospace;margin-bottom:8px">COMIDA DEL DÍA (1 de 5 opciones)</div>
                    <div style="font-size:14px;font-weight:700;color:#F0EDE8;margin-bottom:4px">Pollo con arroz y brócoli</div>
                    <div style="font-size:11px;color:#8A8A8A;margin-bottom:10px">180g pollo, 150g arroz integral, 200g brócoli, AOVE</div>
                    <span style="display:inline-block;background:#1E1E1E;border-radius:4px;padding:3px 8px;font-size:10px;color:#E8490F;font-family:'Courier New',monospace;font-weight:600;margin:0 4px 4px 0">520 kcal</span>
                    <span style="display:inline-block;background:#1E1E1E;border-radius:4px;padding:3px 8px;font-size:10px;color:#8A8A8A;font-family:'Courier New',monospace;margin:0 4px 4px 0">42g prot</span>
                    <span style="display:inline-block;background:#1E1E1E;border-radius:4px;padding:3px 8px;font-size:10px;color:#8A8A8A;font-family:'Courier New',monospace;margin:0 4px 4px 0">48g carbs</span>
                    <span style="display:inline-block;background:#1E1E1E;border-radius:4px;padding:3px 8px;font-size:10px;color:#8A8A8A;font-family:'Courier New',monospace;margin:0 4px 4px 0">14g grasa</span>
                  </td></tr>
                </table>
              </td></tr>
              <tr><td style="padding:0 28px">
                <div style="font-size:11px;color:#E8490F;letter-spacing:2px;font-weight:700;margin-bottom:14px">TU ÁREA DE CLIENTE INCLUYE</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #232323;border-radius:12px;overflow:hidden">
                  <tr>
                    <td style="padding:14px;background:#0A0A0A;border-bottom:1px solid #232323;width:50%;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Plan de entrenamiento</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">Gimnasio, running, CrossFit, Hyrox o combinación. Con series, reps y descansos.</div>
                    </td>
                    <td style="padding:14px;background:#0A0A0A;border-bottom:1px solid #232323;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Plan semanal de nutrición</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">5 comidas al día, 5 opciones cada una. Eliges por día de la semana.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px;background:#0A0A0A;border-bottom:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Lista de la compra</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">Todo lo de la semana sumado por categorías. Descárgala o cópiala.</div>
                    </td>
                    <td style="padding:14px;background:#0A0A0A;border-bottom:1px solid #232323;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Check-in semanal</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">Cuentas cómo te fue y el plan se ajusta: sube o baja según tu progreso.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px;background:#0A0A0A;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Progreso y racha</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">Pesos, fotos mensuales, hitos y racha de días entrenados.</div>
                    </td>
                    <td style="padding:14px;background:#0A0A0A;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#F0EDE8;font-weight:600;margin-bottom:3px">Contacto directo</div>
                      <div style="font-size:10px;color:#5A5A5A;line-height:1.4">Escríbenos desde tu panel. Sugerencias, dudas, lo que sea.</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:26px 28px;text-align:center">
                <a href="${APP_URL}?go=registro" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:15px 40px;font-size:14px;font-weight:700;letter-spacing:0.5px;border-radius:10px">EMPEZAR GRATIS →</a>
                <p style="color:#5A5A5A;font-size:11px;margin:12px 0 0">Primer mes completo, gratis. Después 7,99€/mes (o 4,99€/mes solo nutrición). Cancelas cuando quieras.</p>
              </td></tr>
              <tr><td style="padding:0 28px 22px;text-align:center">
                <p style="color:#444;font-size:10px;line-height:1.6;margin:0;border-top:1px solid #232323;padding-top:16px">Recibes este email porque dejaste tu dirección en k-one.fit</p>
              </td></tr>
            </table>
          `, 'TU PREPARADOR DE ÉLITE, 24/7')
      };
      emails.push(enviarEmail(apiKey, optsLead));
      htmlParaLog = optsLead.html;

    } else if (tipo === 'bienvenida') {
      const primerNombre = (datos.nombre || '').split(' ')[0] || 'Crack';
      // 1) Email al cliente
      // Antes tenía su propio wrapper duplicado a mano en vez de reutilizar
      // emailWrapper(); ahora comparte cabecera/foto/pie con el resto.
      const optsBienvenida = {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: datos.email,
        subject: `${esc(primerNombre)}, tu plan te está esperando — K-ONE`,
        html: emailWrapper(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
              <tr><td style="padding:22px 28px 0">
                <h1 style="color:#F0EDE8;font-size:24px;font-weight:700;margin:0 0 8px">${esc(primerNombre)}, bienvenido/a.</h1>
                <p style="color:#8A8A8A;font-size:14px;line-height:1.7;margin:0 0 26px">Tu cuenta está lista. En 3 pasos tienes tu plan de entrenamiento y nutrición personalizado funcionando.</p>
              </td></tr>
              <tr><td style="padding:0 28px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:36px;height:36px;background:#E8490F;color:#fff;font-size:16px;font-weight:800;text-align:center;line-height:36px;border-radius:50%">1</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0;border-bottom:1px solid #232323">
                      <p style="margin:0 0 3px;font-weight:700;color:#F0EDE8;font-size:15px">Rellena el cuestionario</p>
                      <p style="margin:0;color:#8A8A8A;font-size:13px;line-height:1.5">5 minutos. Nos cuentas tu deporte, objetivo, nivel, lesiones y alergias. Con eso construimos todo.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:36px;height:36px;background:#E8490F;color:#fff;font-size:16px;font-weight:800;text-align:center;line-height:36px;border-radius:50%">2</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0;border-bottom:1px solid #232323">
                      <p style="margin:0 0 3px;font-weight:700;color:#F0EDE8;font-size:15px">Activa tu primer mes — gratis</p>
                      <p style="margin:0;color:#8A8A8A;font-size:13px;line-height:1.5">Acceso completo, sin coste ni código. Después 7,99€/mes (o 4,99€/mes solo nutrición). Sin permanencia: cancelas con un clic.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="width:48px;vertical-align:top;padding:16px 14px 16px 0">
                      <div style="width:36px;height:36px;background:#E8490F;color:#fff;font-size:16px;font-weight:800;text-align:center;line-height:36px;border-radius:50%">3</div>
                    </td>
                    <td style="vertical-align:top;padding:16px 0">
                      <p style="margin:0 0 3px;font-weight:700;color:#F0EDE8;font-size:15px">Empieza hoy</p>
                      <p style="margin:0;color:#8A8A8A;font-size:13px;line-height:1.5">Tu plan se adapta cada semana a cómo evoluciones. Sin fórmulas genéricas.</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:26px 28px 0">
                <div style="font-size:11px;color:#E8490F;letter-spacing:2px;font-weight:700;margin-bottom:14px">TODO ESTO TE ESPERA DENTRO</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #232323;border-radius:12px;overflow:hidden">
                  <tr>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;width:50%;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">ENTRENAMIENTO</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Plan semanal adaptado a tu deporte y nivel. Cada ejercicio con vídeo explicativo.</div>
                    </td>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">NUTRICIÓN</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">5 comidas al día, 5 opciones por comida. Macros calculados para tu objetivo.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">RECETARIO</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">+200 recetas con instrucciones paso a paso. Rotación semanal para no repetir.</div>
                    </td>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">REGISTRO DE PESOS</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Marca tus pesos en cada ejercicio y ve la progresión con gráficas.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">CHECK-IN SEMANAL</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Cada semana nos dices cómo vas. El plan se ajusta a tu progreso real.</div>
                    </td>
                    <td style="padding:14px 12px;background:#0A0A0A;border-bottom:1px solid #232323;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">CONTADOR KCAL</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Marca lo que comes y controla tus calorías diarias de forma visual.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 12px;background:#0A0A0A;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">NOTAS PERSONALES</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Apunta lo que quieras: sensaciones, marcas, ideas. Tu diario de entreno.</div>
                    </td>
                    <td style="padding:14px 12px;background:#0A0A0A;border-left:1px solid #232323;vertical-align:top">
                      <div style="font-size:12px;color:#E8490F;font-weight:800;margin-bottom:4px">LISTA DE LA COMPRA</div>
                      <div style="font-size:11px;color:#8A8A8A;line-height:1.5">Genera la lista de la compra de toda la semana con un solo clic.</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:28px;text-align:center">
                <a href="${APP_URL}" style="display:inline-block;background:#E8490F;color:#fff;text-decoration:none;padding:15px 40px;font-size:14px;font-weight:700;letter-spacing:0.5px;border-radius:10px">EMPEZAR AHORA →</a>
                <p style="color:#5A5A5A;font-size:12px;margin:12px 0 0">Primer mes completo, gratis. Sin código, automático.</p>
              </td></tr>
            </table>
          `, 'NO HAY ATAJOS. HAY PASOS.')
      };
      emails.push(enviarEmail(apiKey, optsBienvenida));
      htmlParaLog = optsBienvenida.html;
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
      // 3) Push instantáneo al admin, si tiene los avisos activados desde
      // Jarvis. Con await a propósito -- Vercel puede congelar la función en
      // cuanto se manda la respuesta, así que sin esperar aquí el push
      // podría no llegar a salir nunca (enviarPushAAdmins ya atrapa sus
      // propios errores, así que esto no puede romper la respuesta).
      await enviarPushAAdmins({ title: 'K-ONE · Nuevo registro', body: `${datos.nombre || 'Alguien'} (${datos.email}) acaba de registrarse.`, url: '/' });

    } else if (tipo === 'mensaje') {
      const optsMensaje = {
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
      };
      emails.push(enviarEmail(apiKey, optsMensaje));
      htmlParaLog = optsMensaje.html;

    } else if (tipo === 'opinion') {
      const nEstrellas = Math.min(Math.max(parseInt(datos.estrellas) || 0, 0), 5);
      const estrellas = '★'.repeat(nEstrellas) + '☆'.repeat(5 - nEstrellas);
      const optsOpinion = {
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
      };
      emails.push(enviarEmail(apiKey, optsOpinion));
      htmlParaLog = optsOpinion.html;
    } else {
      const optsGenerico = {
        from: 'K-ONE <equipo@k-one.fit>',
        reply_to: ADMIN_EMAIL,
        to: ADMIN_EMAIL,
        subject: `K-ONE · Notificación: ${tipo}`,
        html: `<pre>${JSON.stringify(datos, null, 2)}</pre>`
      };
      emails.push(enviarEmail(apiKey, optsGenerico));
      htmlParaLog = optsGenerico.html;
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
        resumen = 'Email al lead con preview del área de clientes: entrenamiento (press banca, remo, press militar), nutrición (pollo con arroz y brócoli, 520 kcal), y las 6 funciones del área de cliente. CTA: Empezar gratis.';
      } else if (tipo === 'bienvenida') {
        const primerNombre = (datos.nombre || '').split(' ')[0] || 'Cliente';
        destinatario = datos.email;
        asunto = `${primerNombre}, tu plan te está esperando — K-ONE`;
        resumen = `Email de bienvenida a ${datos.nombre} (${datos.email}). 3 pasos: rellenar cuestionario, activar primer mes gratis, empezar. Incluye 8 funciones del área de clientes: entrenamiento con vídeos, nutrición 5x5, recetario +200, registro de pesos, check-in semanal, contador kcal, notas y lista de la compra.`;
      } else if (tipo === 'mensaje') {
        destinatario = ADMIN_EMAIL;
        asunto = `Mensaje de ${datos.nombre}: ${datos.asunto}`;
        resumen = `De: ${datos.nombre} (${datos.email})\nMotivo: ${datos.asunto}\n\n${datos.mensaje || ''}`;
      } else if (tipo === 'opinion') {
        destinatario = ADMIN_EMAIL;
        asunto = `Nueva opinión de ${datos.nombre} (${datos.estrellas}★)`;
        resumen = `Opinión de ${datos.nombre || 'Anónimo'}: ${'★'.repeat(datos.estrellas || 0)}${'☆'.repeat(5-(datos.estrellas||0))}\n\n${datos.texto || '(sin texto)'}`;
      } else {
        destinatario = ADMIN_EMAIL;
        asunto = `Notificación: ${tipo}`;
        resumen = JSON.stringify(datos, null, 2);
      }
      await supa.from('email_log').insert({
        tipo, destinatario, asunto, html: htmlParaLog,
        datos: JSON.stringify({ ...datos, resumen })
      });
    } catch (e) {}

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify] error:', err);
    capturarError(err, { fn: 'notify' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
