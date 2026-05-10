/**
 * MB FLOWBOARD — sw.js
 * Service Worker — Network First para API, Cache First para assets
 */

// Importa as configurações centralizadas (Versão, Cache Name e Assets)
importScripts('/js/config.js');

// Carrega o Workbox da CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  // Injeta o manifesto de precache (essencial para o Workbox Build funcionar)
  // O placeholder abaixo será preenchido pelo workbox-build-script.js
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Configura cache de Google Fonts de forma otimizada
  // CacheFirst para os arquivos de fonte (.woff2) e StaleWhileRevalidate para o CSS
  workbox.recipes.googleFonts();

  // Define estratégia Stale-While-Revalidate para imagens (png, jpg, svg, webp)
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'images-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,           // Limite de 60 imagens no cache
          maxAgeSeconds: 30 * 24 * 60 * 60, // Expira após 30 dias
          purgeOnQuotaError: true,  // Limpa automaticamente se o disco encher
        }),
      ],
    })
  );
}

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting(); 
});

// Handler de Fetch: Essencial para estabilidade e funcionamento Offline
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open('api-cache').then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Deixa o Workbox lidar com o restante dos assets via precacheAndRoute
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== 'api-cache') {
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      // Faz o novo Service Worker assumir o controle de todas as abas abertas imediatamente
      return self.clients.claim();
    })
  );
});

// Recebe mensagens para forçar atualização do cache
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
