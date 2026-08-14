// Subir este número invalida TODA la caché anterior: el handler de 'activate'
// borra cualquier caché cuyo nombre no coincida con este. Hay que subirlo
// siempre que se reemplace un recurso estático (imagen, vídeo, etc.) que los
// visitantes que ya han entrado antes pudieran tener guardado.
// v4 (julio 2026): el vídeo del hero pasó de demo.mp4 al recorrido completo.
// v5 (agosto 2026): el fetch handler dejó de interceptar todo el origen
// (incluido el vídeo demo de 15MB) y pasó a una allowlist de assets estáticos.
const CACHE_NAME = 'kone-v5';

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
// incluido el vídeo demo (15MB) si alguna vez se pedía completo (200 en vez
// de 206 por Range) — arriesgaba llenar la cuota de Cache Storage del
// navegador sin necesidad, para un recurso que ya se sirve bien por Range.
// Ahora solo se cachean el documento principal y los assets estáticos que
// de verdad se benefician de un fallback offline.
function _cacheable(pathname) {
  if (pathname === '/' || pathname === '/index.html') return true;
  if (pathname.startsWith('/img/')) return true;
  if (pathname.startsWith('/data/')) return true;
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
