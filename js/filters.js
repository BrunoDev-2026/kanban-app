/**
 * MB FLOWBOARD — js/filters.js
 * Sistema de filtros dinâmicos
 * Busca em tempo real · Prioridade · Data · Status · Tags
 */

'use strict';

/**
 * Aplica todos os filtros ativos a um card
 * @param {Object} card - Card a verificar
 * @param {Object} filters - Filtros ativos
 * @param {boolean} isDoneColumn - Se o card está na coluna "Concluído"
 * @returns {boolean} true se o card deve ser exibido
 */
function cardMatchesFilters(card, filters, isDoneColumn = false) {
  const { searchTerm, priority, tag, dateFilter } = filters;

  // ── Filtro por texto de busca ──
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const matchesTitle = card.title.toLowerCase().includes(term);
    const matchesDesc  = (card.desc || '').toLowerCase().includes(term);
    const matchesTags  = (card.tags || []).some(t => t.toLowerCase().includes(term));
    if (!matchesTitle && !matchesDesc && !matchesTags) return false;
  }

  // ── Filtro por prioridade ──
  if (priority && priority !== 'all') {
    if (card.priority !== priority) return false;
  }

  // ── Filtro por tag ──
  if (tag && tag !== 'all') {
    const hasTag = (card.tags || []).some(t => t.toLowerCase() === tag.toLowerCase());
    if (!hasTag) return false;
  }

  // ── Filtro por data exata ──
  if (filters.exactDateFilter) {
    if (!card.date || card.date !== filters.exactDateFilter) return false;
  }

  return true;
}

/**
 * Inicializa o sistema de filtros, conectando eventos de UI
 * @param {Object} state - Estado global (ref)
 * @param {Object} appFilters - Objeto de filtros global (mutável)
 * @param {Function} renderFn - Função de render principal
 */
function initFilters(state, appFilters, renderFn) {
  const searchInput      = document.getElementById('searchInput');
  const priorityFilter   = document.getElementById('priorityFilter');
  const exactDateFilter  = document.getElementById('exactDateFilter');
  const clearFiltersBtn  = document.getElementById('clearFiltersBtn');

  // Busca em tempo real
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      appFilters.searchTerm = e.target.value.toLowerCase().trim();
      renderFn();
    }, 200));
  }

  // Filtro de prioridade
  if (priorityFilter) {
    priorityFilter.addEventListener('change', e => {
      appFilters.priority = e.target.value;
      renderFn();
    });
  }

  // Filtro de data exata
  if (exactDateFilter) {
    exactDateFilter.addEventListener('change', e => {
      appFilters.exactDateFilter = e.target.value;
      renderFn();
    });
  }

  // Limpar todos os filtros
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      clearFilters(appFilters, renderFn);
    });
  }
}

/**
 * Limpa todos os filtros e reseta a UI
 * @param {Object} appFilters - Objeto de filtros (mutado in-place)
 * @param {Function} renderFn - Função de render
 */
function clearFilters(appFilters, renderFn) {
  appFilters.searchTerm      = '';
  appFilters.priority        = 'all';
  appFilters.tag             = 'all';
  appFilters.exactDateFilter = '';

  const searchInput     = document.getElementById('searchInput');
  const priorityFilter  = document.getElementById('priorityFilter');
  const exactDateFilter = document.getElementById('exactDateFilter');

  if (searchInput)     searchInput.value     = '';
  if (priorityFilter)  priorityFilter.value  = 'all';
  if (exactDateFilter) exactDateFilter.value = '';

  renderFn();
  showToast('🧹 Filtros limpos!');
}

/**
 * Verifica se algum filtro está ativo
 * @param {Object} appFilters
 * @returns {boolean}
 */
function hasActiveFilters(appFilters) {
  return (
    (appFilters.searchTerm && appFilters.searchTerm.length > 0) ||
    (appFilters.priority && appFilters.priority !== 'all') ||
    (appFilters.tag && appFilters.tag !== 'all') ||
    (appFilters.exactDateFilter && appFilters.exactDateFilter !== '')
  );
}
