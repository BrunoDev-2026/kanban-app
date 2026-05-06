/**
 * MB FLOWBOARD — js/utils.js
 * Utilitários globais reutilizáveis
 * Funções auxiliares sem dependências externas
 */

'use strict';

/**
 * Gera ID único baseado em timestamp + random
 * @returns {string} ID único
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Escapa HTML para evitar XSS
 * @param {string} str - String a escapar
 * @returns {string} String escapada
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY
 * @param {string} str - Data no formato ISO
 * @returns {string} Data formatada
 */
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Formata data completa com hora para exibição em arquivo
 * @param {string} isoStr - Data ISO completa
 * @returns {string} Data formatada com hora
 */
function formatFullDate(isoStr) {
  if (!isoStr) return 'Data desconhecida';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD
 * @returns {string} Data atual ISO
 */
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calcula diferença em dias entre hoje e uma data
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {number} Diferença em dias (negativo = atrasado)
 */
function getDaysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Verifica status de prazo de um card
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @param {boolean} isDone - Se o card está na coluna concluída
 * @returns {string|null} 'overdue' | 'due-today' | 'due-soon' | null
 */
function getDeadlineStatus(dateStr, isDone = false) {
  if (!dateStr || isDone) return null;
  const diff = getDaysDiff(dateStr);
  if (diff === null) return null;
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  if (diff <= 2) return 'due-soon';
  return null;
}

/**
 * Gera uma cor determinística baseada no texto da tag
 * @param {string} text - Texto da tag
 * @returns {string} Cor hex
 */
function getTagColor(text) {
  const colors = [
    '#6C63FF', '#FF6584', '#43D9AD', '#FFB347',
    '#4FC3F7', '#BA68C8', '#F06292', '#4DB6AC',
    '#FF8A65', '#A5D6A7'
  ];
  let hash = 0;
  const normalized = text.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Debounce: atrasa execução de função
 * @param {Function} fn - Função a debounced
 * @param {number} delay - Delay em ms
 * @returns {Function} Função com debounce
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Capitaliza primeira letra de uma string
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Trunca texto com reticências
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Animação de contador numérico (counter-up)
 * @param {HTMLElement} el - Elemento alvo
 * @param {number} target - Valor final
 * @param {number} duration - Duração em ms
 */
function animateCounter(el, target, duration = 800) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Easing out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(update);
}
