// Subir este nÃºmero invalida TODA la cachÃ© anterior: el handler de 'activate'
// borra cualquier cachÃ© cuyo nombre no coincida con este. Hay que subirlo
// siempre que se reemplace un recurso estÃ¡tico (imagen, vÃ­deo, etc.) que los
// visitantes que ya han entrado antes pudieran tener guardado.
// v4 (julio 2026): el vÃ­deo del hero pasÃ³ de demo.mp4 al recorrido completo.
// v5 (agosto 2026): el fetch handler dejÃ³ de interceptar todo el origen
// (incluido el vÃ­deo demo de 15MB) y pasÃ³ a una allowlist de assets estÃ¡ticos.
// v6 (2 sept 2026): aÃ±adidos los handlers push/notificationclick -- no toca
// el cacheo de arriba, asÃ­ que no hace falta subir CACHE_NAME por esto solo.
// v6 (sept 2026): se sube la version para invalidar la copia guardada de
// index.html. El fetch es network-first, pero con mala cobertura sirve la
// cacheada, y los moviles que la tuvieran de antes seguian viendo una version
// sin el arreglo del interruptor de avisos.
// v17 (28 sept 2026): auditorÃ­a completa -- el arreglo real de "apagar avisos
// no se queda apagado", el de la tortilla de trigo en planes sin gluten, el
// del portal de pago fallido, y la librerÃ­a de Supabase con versiÃ³n fija.
// Cualquiera de estos con la copia vieja en cachÃ© sigue con el fallo.
// v18 (28 sept 2026): auditorÃ­a AEO -- el FAQPage de datos estructurados
// (lo que leen ChatGPT/Perplexity/Google AI Overviews) estaba desincronizado
// del FAQ visible: le faltaban 2 preguntas enteras (cobro a mitad de mes,
// seguridad de datos) y 3 respuestas tenÃ­an texto mÃ¡s viejo que el real.
// v19 (28 sept 2026): decisiÃ³n de producto -- con calorÃ­as muy altas
// (IMC>40 o peso muy alto, >4.000 kcal/dÃ­a) el plan ahora fuerza 5 tomas
// aunque el cliente haya elegido menos, para que ningÃºn plato salga con
// mÃ¡s de 1 kg de un solo ingrediente. Quien generÃ³ su plan antes de este
// cambio con la copia vieja en cachÃ© seguirÃ­a viendo el plan sin repartir.
// v20 (28 sept 2026): la pregunta de comidas pasa de "Â¿cuÃ¡ntas veces comes?"
// (el hÃ¡bito) a "Â¿cuÃ¡ntas puedes hacer?" con 5 recomendado y marcado, y se
// aÃ±ade a "Cambiar plan" (antes no se podÃ­a cambiar despuÃ©s del registro).
// v21 (29 sept 2026): "Avisos de entreno" y "Avisos de registro" dejan de ser
// el mismo interruptor; el de entreno se guarda en la cuenta (userdata).
// v22 (29 sept 2026): auditorÃ­a de entrenador -- cribado de embarazo/TCA,
// fuerza de verdad, torso/pierna, calorÃ­as y proteÃ­na afinadas, sal con
// tensiÃ³n alta y cintura en el check-in.
// v23 (29 sept 2026): vÃ­deo de tÃ©cnica concreto por ejercicio y recuadro
// 'Tu plan, adaptado' con 3 notas visibles (el resto plegadas).
// v66 (2 oct 2026): 'Tu plan, adaptado' y 'DespuÃ©s de entrenar' plegados del todo.
// v103 (4 oct 2026): portada nueva e iconos con la mancuerna del logo.
const CACHE_NAME = 'kone-v122';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Antes se interceptaba TODO GET del mismo origen que no fuera /api/,
// incluido el vÃ­deo demo (15MB) si alguna vez se pedÃ­a completo (200 en vez
// de 206 por Range) â€” arriesgaba llenar la cuota de Cache Storage del
// navegador sin necesidad, para un recurso que ya se sirve bien por Range.
// Ahora solo se cachean el documento principal y los assets estÃ¡ticos que
// de verdad se benefician de un fallback offline.
function _cacheable(pathname) {
  if (pathname === '/' || pathname === '/index.html') return true;
  // El cÃ³digo de la app estÃ¡ en /app.js desde el 25 oct 2026: sin Ã©l, la app guardada no arranca sin conexiÃ³n.
  if (pathname === '/app.js') return true;
  if (pathname.startsWith('/img/')) return true;
  if (pathname.startsWith('/data/')) return true;
  // Fuentes propias desde el 16 oct 2026 (antes venÃ­an de Google y no se guardaban).
  // Solo los .woff2: la hoja fuentes.css va con preload y, si la sirve el service worker, el
  // navegador no reutiliza la precarga y la descarga dos veces.
  if (pathname.startsWith('/fonts/') && pathname.endsWith('.woff2')) return true;
  if (pathname === '/manifest.json') return true;
  return /\.(png|jpe?g|svg|ico|webp|gif)$/i.test(pathname);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (!_cacheable(url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Ojo con el 206: los vÃ­deos se piden por trozos (cabecera Range) y la
        // respuesta es "206 Partial Content", que entra en res.ok (200-299)
        // pero NO se puede guardar en la Cache API â€” cache.put() lanza
        // "Partial response is unsupported" y dejaba un rechazo de promesa sin
        // capturar en cada trozo de vÃ­deo. Solo se cachean respuestas 200.
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(e.request, clone))
            .catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ===== NOTIFICACIONES PUSH =====
// El payload lo manda api/notify.js (cron diario) vÃ­a web-push, como JSON
// {title, body, url}. Si por lo que sea no llega como JSON (payload vacÃ­o,
// formato inesperado), se cae a un texto genÃ©rico en vez de fallar en
// silencio y no mostrar nada -- un push sin notificaciÃ³n visible hace que
// el navegador avise al usuario de que la web "manda notificaciones
// silenciosas" y puede acabar revocando el permiso.
self.addEventListener('push', e => {
  let datos = { title: 'K-ONE', body: 'Tienes novedades en tu plan.', url: '/' };
  try { if (e.data) datos = { ...datos, ...e.data.json() }; } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: datos.url || '/' },
      // Antes TODO iba con la misma etiqueta 'kone-recordatorio': el aviso de
      // "tienes respuesta" pisaba al de "hoy toca pecho" y viceversa. Y sin
      // renotify, en Android una notificaciÃ³n que reemplaza a otra con la misma
      // etiqueta llega EN SILENCIO (sin sonido ni vibraciÃ³n): si el cliente no
      // habÃ­a quitado la de ayer, la de hoy se cambiaba sin que se enterara.
      tag: datos.tag || 'kone-aviso',
      renotify: true,
      // Fin del descanso: vibraciÃ³n mÃ¡s larga, que se note con el mÃ³vil en el bolsillo.
      ...(datos.tag === 'kone-descanso' ? { vibrate: [300, 150, 300, 150, 300] } : {})
    })
  );
});

// Al pulsar la notificaciÃ³n, reutiliza una pestaÃ±a de K-ONE ya abierta si
// existe (en vez de abrir una nueva encima) -- mismo criterio que ya usa el
// enlace del email de retenciÃ³n (una sola pestaÃ±a de la app, no varias).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const c of clientsArr) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
