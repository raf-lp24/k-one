// Envía errores no controlados a Sentry si está configurado. Sin SENTRY_DSN
// en las variables de entorno de Vercel, esta función no hace nada -- así
// el código sigue funcionando exactamente igual antes de dar de alta la
// cuenta de Sentry (no hace falta tocar nada más aquí cuando se añada esa
// variable, solo desplegar de nuevo).
let Sentry = null;
let intentado = false;

function initSentry() {
  if (intentado) return;
  intentado = true;
  if (!process.env.SENTRY_DSN) return;
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
  } catch (e) {
    console.warn('[_sentry] no se pudo inicializar:', e.message);
    Sentry = null;
  }
}

// contexto: objeto plano opcional con datos extra (nunca PII sensible como
// contraseñas o tarjetas -- solo IDs/nombres de función para localizar el fallo).
function capturarError(err, contexto) {
  initSentry();
  if (!Sentry) return;
  try {
    Sentry.captureException(err, contexto ? { extra: contexto } : undefined);
  } catch (_) {
    // Si Sentry falla, no debe tumbar la función que lo llama.
  }
}

module.exports = { capturarError };
