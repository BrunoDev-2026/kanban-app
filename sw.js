/**
 * MB FLOWBOARD — sw.js
 * Service Worker — Network First para API, Cache First para assets
 */

const CACHE_NAME = 'flowboard-{{VERSION}}';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/animations.css',
  '/css/board.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/css/responsive.css',
  '/js/api.js',
  '/js/app.js',
  '/js/avatar.js',
  '/js/dashboard.js',
  '/js/dragdrop.js',
  '/js/filters.js',
  '/js/metrics-logic.js',
  '/js/notifications.js',
  '/js/shortcuts.js',
  '/js/storage.js',
  '/js/tags.js',
  '/js/tasks.js',
  '/js/utils.js',
  '/manifest.json',
  '/assets/logo/logo.png'
];

// Instalação: pré-cacheia assets essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.error(`[SW] Falha ao cachear asset: ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Network First para API, Cache First para assets estáticos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora requisições não-GET e extensões de browser
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API — Network First com fallback offline
  if (url.hostname === 'kanban-api-oozq.onrender.com' || url.pathname.startsWith('/tarefas')) {
    event.respondWith(
      fetch(event.request)
        .then(res => res)
        .catch(() => new Response(
          JSON.stringify({ erro: 'Offline — dados indisponíveis' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // CDN externo (Lucide, Fonts) — Cache First
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Assets locais — Cache First, atualiza em background (Stale While Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});

// Recebe mensagens para forçar atualização do cache
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
