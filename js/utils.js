/**
 * MB FLOWBOARD — js/utils.js
 * Utilitários globais reutilizáveis
 * Funções auxiliares sem dependências externas
 */

'use strict';

/* ── ID único ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Sanitização XSS segura ── */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/`/g,  '&#96;');
}

/* ── Cria elemento DOM seguro (sem innerHTML para conteúdo do usuário) ── */
function createTextNode(tag, text, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/* ── Formata data ISO → DD/MM/YYYY ── */
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/* ── Formata data completa com hora ── */
function formatFullDate(isoStr) {
  if (!isoStr) return 'Data desconhecida';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ── Data de hoje em YYYY-MM-DD ── */
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/* ── Diferença em dias entre hoje e uma data ── */
function getDaysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/* ── Status de prazo ── */
function getDeadlineStatus(dateStr, isDone = false) {
  if (!dateStr || isDone) return null;
  const diff = getDaysDiff(dateStr);
  if (diff === null) return null;
  if (diff < 0)  return 'overdue';
  if (diff === 0) return 'due-today';
  if (diff <= 2)  return 'due-soon';
  return null;
}

/* ── Cor determinística por tag ── */
function getTagColor(text) {
  const colors = [
    '#6C63FF','#FF6584','#43D9AD','#FFB347',
    '#4FC3F7','#BA68C8','#F06292','#4DB6AC',
    '#FF8A65','#A5D6A7'
  ];
  let hash = 0;
  const normalized = String(text).trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/* ── Debounce ── */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ── Throttle ── */
function throttle(fn, limit = 100) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/* ── Capitaliza primeira letra ── */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── Trunca texto ── */
function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/* ── Animação de contador ── */
function animateCounter(el, target, duration = 800) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target;
  }
  requestAnimationFrame(update);
}

/* ── Sanitiza string de input do usuário (para armazenamento) ── */
function sanitizeInput(str, maxLength = 500) {
  return String(str ?? '').trim().slice(0, maxLength);
}

/* ── Parse de tags com sanitização ── */
function parseTags(str) {
  return String(str ?? '')
    .split(',')
    .map(t => sanitizeInput(t, 30))
    .filter(Boolean)
    .slice(0, 10); // máximo 10 tags
}
