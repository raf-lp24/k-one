// MES GRATIS UNA SOLA VEZ POR EMAIL (1 oct 2026).
//
// El mes gratis se decidía solo con el historial de Stripe del usuario de
// Supabase. Al eliminar la cuenta (desde "Gestionar suscripción" o desde
// Jarvis) el usuario desaparece, y al registrarse otra vez con el MISMO email
// es un usuario nuevo, sin historial: volvía a tener 30 días gratis, y así
// indefinidamente.
//
// Ahora se guarda una huella del email (SHA-256 del email normalizado, nunca
// el email en claro) en la tabla `pruebas_usadas`. Esa huella sobrevive al
// borrado de la cuenta (no tiene FK a auth.users) y create-checkout-session no
// da el mes gratis si la encuentra.
//
// La normalización tapa los trucos habituales con el mismo buzón:
// mayúsculas, espacios, "nombre+loquesea@" y, en Gmail, los puntos
// ("n.o.m.b.r.e@gmail.com" llega al mismo buzón). La tabla y la función SQL
// del relleno inicial están en supabase/migration-pruebas-usadas.sql y DEBEN
// normalizar exactamente igual que normalizarEmail().
const crypto = require('crypto');

const DOMINIOS_GMAIL = new Set(['gmail.com', 'googlemail.com']);

function normalizarEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at <= 0) return e;
  let local = e.slice(0, at);
  let dominio = e.slice(at + 1);
  local = local.split('+')[0];
  if (DOMINIOS_GMAIL.has(dominio)) {
    local = local.replace(/\./g, '');
    dominio = 'gmail.com';
  }
  return local + '@' + dominio;
}

function huellaEmail(email) {
  return crypto.createHash('sha256').update(normalizarEmail(email), 'utf8').digest('hex');
}

// ¿Este email ya tuvo una suscripción (y por tanto su mes gratis)?
// Si la tabla aún no existe o la consulta falla, devuelve false: es preferible
// dar un mes gratis de más que negárselo a un cliente nuevo por un fallo nuestro.
async function pruebaYaUsada(supabaseAdmin, email, log = console) {
  if (!email) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('pruebas_usadas').select('email_hash').eq('email_hash', huellaEmail(email)).maybeSingle();
    if (error) { log.warn('[pruebaGratis] no se pudo consultar pruebas_usadas:', error.message); return false; }
    return !!data;
  } catch (e) {
    log.warn('[pruebaGratis] error consultando pruebas_usadas:', e.message);
    return false;
  }
}

// Anota que este email ya ha tenido suscripción. Idempotente. Nunca lanza:
// un fallo aquí no debe tumbar un webhook de pago ni el borrado de una cuenta.
async function marcarPruebaUsada(supabaseAdmin, email, log = console) {
  if (!email) return false;
  try {
    const { error } = await supabaseAdmin
      .from('pruebas_usadas').upsert({ email_hash: huellaEmail(email) }, { onConflict: 'email_hash', ignoreDuplicates: true });
    if (error) { log.warn('[pruebaGratis] no se pudo anotar en pruebas_usadas:', error.message); return false; }
    return true;
  } catch (e) {
    log.warn('[pruebaGratis] error anotando en pruebas_usadas:', e.message);
    return false;
  }
}

module.exports = { normalizarEmail, huellaEmail, pruebaYaUsada, marcarPruebaUsada };
