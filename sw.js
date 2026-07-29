// Subir este número invalida TODA la caché anterior: el handler de 'activate'
// borra cualquier caché cuyo nombre no coincida con este. Hay que subirlo
// siempre que se reemplace un recurso estático (imagen, vídeo, etc.) que los
// visitantes que ya han entrado antes pudieran tener guardado.
// v4 (julio 2026): el vídeo del hero pasó de demo.mp4 al recorrido completo.
const CACHE_NAME = 'kone-v4';

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

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Ojo con el 206: los vídeos se piden por trozos (cabecera Range) y la
        // respuesta es "206 Partial Content", que entra en res.ok (200-299)
        // pero NO se puede guardar en la Cache API — cache.put() lanza
        // "Partial response is unsupported" y dejaba un rechazo de promesa sin
        // capturar en cada trozo de vídeo. Solo se cachean respuestas 200.
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
