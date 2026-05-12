/**
 * MB FLOWBOARD — sw.js
 * Service Worker — PWA Enterprise
 * Network First (API) · Stale While Revalidate (Assets) · Cache First (Imagens)
 * Versionamento automático · Retry com Exponential Backoff
 */

'use strict';

const CACHE_VERSION = self.__CACHE_VERSION || `kanban-${Date.now()}`;
const CACHE_NAME    = `kanban-${CACHE_VERSION}`;
const CACHE_API     = 'kanban-api-cache';
const CACHE_IMAGES  = 'kanban-images-cache';
const CACHE_FONTS   = 'kanban-fonts-cache';
const API_BASE      = 'https://kanban-api-oozq.onrender.com';

const PRECACHE_ASSETS = [
  '/', '/index.html', '/offline.html',
  '/css/main.css', '/css/animations.css', '/css/dashboard.css',
  '/css/board.css', '/css/components.css', '/css/responsive.css',
  '/js/api.js', '/js/utils.js', '/js/storage.js', '/js/sync.js',
  '/js/notifications.js', '/js/tags.js', '/js/filters.js',
  '/js/metrics-logic.js', '/js/dashboard.js', '/js/dragdrop.js',
  '/js/avatar.js', '/js/shortcuts.js', '/js/tasks.js',
  '/js/app.js', '/js/config.js', '/manifest.json'
];


// Exponential Backoff para retry de rede
async function fetchWithRetry(request, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(request.clone());
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
}

// Instalação
self.addEventListener('install', event => {
  console.log(`[SW] Instalando: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => console.log('[SW] Pre-cache concluido.'))
      .catch(err => console.warn('[SW] Falha parcial no pre-cache:', err))
  );
});

// Ativação — limpa caches antigos
self.addEventListener('activate', event => {
  console.log(`[SW] Ativando: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ![CACHE_NAME, CACHE_API, CACHE_IMAGES, CACHE_FONTS].includes(k))
            .map(k => { console.log('[SW] Removendo cache antigo:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});


// Estratégia de Fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // API — Network First
  if (url.origin === new URL(API_BASE).origin) {
    event.respondWith(networkFirstAPI(request));
    return;
  }
  // Fonts — Stale While Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, CACHE_FONTS));
    return;
  }
  // Imagens — Cache First + TTL 30 dias
  if (request.destination === 'image') {
    event.respondWith(cacheFirstImages(request));
    return;
  }
  // Assets estáticos — Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

async function networkFirstAPI(request) {
  const cache = await caches.open(CACHE_API);
  try {
    const response = await fetchWithRetry(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ erro: 'Offline: dados indisponiveis.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request.clone())
    .then(r => { if (r && r.ok) cache.put(request, r.clone()); return r; })
    .catch(() => null);
  return cached || networkFetch || offlineFallback(request);
}

async function cacheFirstImages(request) {
  const cache = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(request);
  if (cached) {
    const age = Date.now() - new Date(cached.headers.get('Date') || 0).getTime();
    if (age < 30 * 24 * 60 * 60 * 1000) return cached;
    cache.delete(request);
  }
  try {
    const response = await fetch(request.clone());
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response('', { status: 404 });
  }
}

async function offlineFallback(request) {
  if (request.destination === 'document') {
    const cache = await caches.open(CACHE_NAME);
    return cache.match('/offline.html') || new Response('<h1>Offline</h1>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  return new Response('', { status: 503 });
}

// Controle de atualização via botão "Atualizar App" na UI
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Ativacao forcada pela UI.');
    self.skipWaiting();
  }
});
