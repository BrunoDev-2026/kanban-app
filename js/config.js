/**
 * MB FLOWBOARD — js/config.js
 * Configurações globais compartilhadas
 */
const APP_VERSION = '2.0.0';
const BUILD_TS    = Date.now(); // Timestamp único por sessão
const CACHE_NAME  = `kanban-${APP_VERSION}-${BUILD_TS}`;

// Expõe versão no SW via global
if (typeof self !== 'undefined' && self.constructor && self.constructor.name === 'ServiceWorkerGlobalScope') {
  self.__CACHE_VERSION = `${APP_VERSION}-${BUILD_TS}`;
}