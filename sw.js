/**
 * MB FLOWBOARD — sw.js
 * Service Worker — Network First para API, Cache First para assets
 */

const CACHE_NAME = 'kanban-{{VERSION}}';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Iniciando pré-cache de ${ASSETS.length} arquivos...`);
        return Promise.all(
          ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.error(`[SW] Falha Crítica: Não foi possível carregar para o cache offline: ${url}`, err);
              console.log('%cDica: Verifique se o arquivo existe e se o caminho no array ASSETS está correto.', 'color: #f87171;');
            });
          })
        ).then(() => {
          console.log('[SW] Cache inicial de assets concluído.');
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
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
        .then(res => {
          // Evita logar avisos no console se for um erro 404 em uma operação de DELETE
          if (!res.ok && !(res.status === 404 && event.request.method === 'DELETE')) {
            console.warn(`[SW] API retornou erro ${res.status} para: ${url.pathname}`);
          }
          return res;
        })
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
          const isHtml = res.headers.get('content-type')?.includes('text/html');
          
          // Impede o cache de HTML vindo de CDNs (geralmente scripts/fontes/css)
          // para evitar fallbacks de erro que retornam o index.html por engano
          if (res.ok && !isHtml) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(err => {
              console.error(`[SW] Erro ao salvar asset externo no cache: ${url.href}`, err);
            });
          }
          return res;
        }).catch(err => {
          console.error(`[SW] Erro de rede para recurso externo: ${url.href}`, err);
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // Assets locais — Cache First, atualiza em background (Stale While Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          const isHtml = res.headers.get('content-type')?.includes('text/html');
          const isNavigation = event.request.mode === 'navigate';

          // Cacheia apenas se for sucesso e:
          // 1. For uma navegação legítima (o HTML da própria página)
          // 2. Ou NÃO for um arquivo HTML (assets reais como JS, CSS, Imagens)
          if (res.ok && (isNavigation || !isHtml)) {
            cache.put(event.request, res.clone()).catch(err => {
              console.error(`[SW] Erro ao atualizar cache local para: ${url.pathname}`, err);
            });
          }
          return res;
        }).catch(err => {
          if (!cached) console.error(`[SW] Falha de rede e sem versão em cache para: ${url.pathname}`, err);
          return cached;
        });
        return cached || fetchPromise;
      })
    )
  );
});

// Recebe mensagens para forçar atualização do cache
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
