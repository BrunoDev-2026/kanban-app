/**
 * MB FLOWBOARD — sw.js
 * Service Worker — Network First para API, Cache First para assets
 */

// Importa as configurações centralizadas (Versão, Cache Name e Assets)
importScripts('/js/config.js');

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

// Recebe mensagens para forçar atualização do cache
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
