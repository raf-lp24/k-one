// MOTIVO DE BAJA QUE EL CLIENTE DA EN STRIPE (4 oct 2026).
//
// Quien cancela desde «Tarjeta y facturas» lo hace en el portal de Stripe, no
// en el modal de la web, y su motivo (la encuesta del portal: "demasiado caro",
// "no lo uso"...) solo quedaba en Stripe. Jarvis no lo veía: de 4 bajas
// durante el mes gratis, las 3 que tenían motivo lo tenían ahí y en Jarvis
// salían sin motivo. Ahora el webhook lo deja en el Buzón (mensajes_cliente,
// "[BAJA] Motivo: ...", el mismo formato que usa la web) y admin-clientes lo
// lee de ahí si la ficha no tiene otro.
//
// No se escribe en profiles.userdata a propósito: la web guarda userdata
// entero desde el navegador y pisaría el cambio en el siguiente guardado.

const ETIQUETAS = {
  too_expensive: 'Precio',
  unused: 'Falta de uso',
  missing_features: 'Le falta algo',
  switched_service: 'Se cambia a otro servicio',
  too_complex: 'Demasiado complicado',
  low_quality: 'Calidad',
  customer_service: 'Atención al cliente',
  other: 'Otro',
};

// Motivo legible de una suscripción de Stripe, o null si el cliente no dio
// ninguno. `internos` son los comentarios que pone el propio sistema (premium,
// cuenta eliminada): esos no son un motivo del cliente.
function motivoDeStripe(subscription, internos = []) {
  const det = subscription && subscription.cancellation_details;
  if (!det) return null;
  const comentario = String(det.comment || '').trim();
  if (comentario && internos.includes(comentario)) return null;
  const etiqueta = det.feedback ? (ETIQUETAS[det.feedback] || det.feedback) : '';
  if (!etiqueta && !comentario) return null;
  return { etiqueta: etiqueta || 'Otro', comentario };
}

const PREFIJO = '[BAJA] Motivo: ';

// Lo deja en el Buzón una sola vez por cliente y motivo (Stripe reintenta los
// webhooks y manda "updated" y "deleted" de la misma baja). Nunca lanza.
async function registrarMotivoStripe(supabaseAdmin, subscription, internos, log = console) {
  try {
    const motivo = motivoDeStripe(subscription, internos);
    if (!motivo) return false;
    let userId = subscription.metadata && subscription.metadata.supabase_user_id;
    if (!userId) {
      const { data: s } = await supabaseAdmin.from('subscriptions')
        .select('user_id').eq('stripe_customer_id', subscription.customer).maybeSingle();
      userId = s && s.user_id;
    }
    if (!userId) return false;
    const { data: prof } = await supabaseAdmin.from('profiles').select('nombre, email').eq('id', userId).maybeSingle();
    const mensaje = PREFIJO + motivo.etiqueta + ' (lo marcó al cancelar en Stripe)' + (motivo.comentario ? '\n\n' + motivo.comentario : '');
    const { data: previos } = await supabaseAdmin.from('mensajes_cliente').select('id').eq('user_id', userId).eq('mensaje', mensaje).limit(1);
    if (previos && previos.length) return false;
    const fila = { user_id: userId, nombre: (prof && (prof.nombre || prof.email)) || 'Cliente', email: (prof && prof.email) || '', asunto: 'Baja', mensaje };
    let { error } = await supabaseAdmin.from('mensajes_cliente').insert(fila);
    // Mismo criterio que la web: si 'Baja' no pasa una posible restricción de asunto, 'Otro'.
    if (error) ({ error } = await supabaseAdmin.from('mensajes_cliente').insert({ ...fila, asunto: 'Otro' }));
    if (error) { log.warn('[motivoBaja] no se pudo guardar el motivo:', error.message); return false; }
    return true;
  } catch (e) {
    log.warn('[motivoBaja] error:', e.message);
    return false;
  }
}

// "[BAJA] Motivo: Precio (lo marcó...)\n\n..." -> "Precio". Para Jarvis.
function motivoDeMensaje(texto) {
  const t = String(texto || '');
  if (!t.startsWith(PREFIJO)) return null;
  const resto = t.slice(PREFIJO.length).split('\n')[0];
  return resto.replace(/\s*\(lo marcó al cancelar en Stripe\)\s*$/, '').trim() || null;
}

module.exports = { motivoDeStripe, registrarMotivoStripe, motivoDeMensaje, ETIQUETAS };
