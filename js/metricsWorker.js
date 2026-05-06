/**
 * MB FLOWBOARD — js/metricsWorker.js
 * Worker para processamento de métricas em segundo plano
 */

// Importa a lógica compartilhada
importScripts('metrics-logic.js');

self.onmessage = function(e) {
  const { state, today } = e.data;
  const metrics = calculateMetrics(state, today);
  self.postMessage(metrics);
};