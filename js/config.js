/**
 * MB FLOWBOARD — js/config.js
 * Configurações globais compartilhadas entre App e Service Worker
 */
const APP_VERSION = '{{VERSION}}';
const CACHE_NAME = `kanban-${APP_VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js'
];