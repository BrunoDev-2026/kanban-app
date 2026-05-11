/**
 * MB FLOWBOARD — sw.js
 * Service Worker — Network First para API, Cache First para assets
 */

// Importa as configurações centralizadas (Versão, Cache Name e Assets)
importScripts('/js/config.js');

// Carrega o Workbox da CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

// Força o carregamento do módulo de receitas
workbox.loadModule('workbox-recipes');

if (workbox) {
  console.log('Workbox carregado com sucesso!');

  // Injeta o manifesto de precache (essencial para o Workbox Build funcionar)
  // O placeholder abaixo será preenchido pelo workbox-build-script.js
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // O nome correto da função na v6+ é googleFontsCache
  // Usamos um pequeno check para garantir que o objeto existe antes de chamar
  if (workbox.recipes && workbox.recipes.googleFontsCache) {
    workbox.recipes.googleFontsCache();
  } else {
    // Fallback manual caso o módulo demore a carregar via CDN
    workbox.routing.registerRoute(
      ({url}) => url.origin === 'https://fonts.googleapis.com' || 
                 url.origin === 'https://fonts.gstatic.com',
      new workbox.strategies.StaleWhileRevalidate({ cacheName: 'google-fonts' })
    );
  }

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

  // Configura uma página de fallback para quando o usuário estiver offline
  // Certifique-se de que 'offline.html' está incluído no precache.
  workbox.recipes.offlineFallback({
    pageFallback: '/offline.html',
  });
}

// Instalação
self.addEventListener('install', event => {
  // Removido o skipWaiting automático para permitir que a UI controle a atualização.
  console.log('Novo Service Worker instalado e aguardando...');
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
