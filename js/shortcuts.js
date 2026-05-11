/**
 * MB FLOWBOARD — js/shortcuts.js
 * Atalhos globais de teclado
 * N · Delete · Ctrl+S · Esc · F
 */

'use strict';

/**
 * Inicializa todos os atalhos de teclado globais
 * @param {Object} state - Estado global (ref)
 * @param {Function} renderFn - Função de render
 * @param {Function} openCardFn - Função para abrir modal de card
 * @param {Function} saveStateFn - Função de salvar
 * @param {Object} appFilters - Filtros globais do aplicativo
 * @param {Function} toggleViewFn - Função para alternar visualização (Quadro/Lista)
 * @param {Function} openColumnModalFn - Função para abrir modal de coluna
 */
function initShortcuts(state, renderFn, openCardFn, saveStateFn, undoFn, redoFn, appFilters, toggleViewFn, openColumnModalFn) {

  // ESC fecha modais abertos ou limpa filtros se nenhum modal estiver ativo
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay.open');
      if (openModal) {
        ['columnModal', 'cardModal', 'confirmModal', 'emojiModal', 'archiveModal', 'profileModal']
          .forEach(id => closeModal(id));
      } else if (appFilters && typeof hasActiveFilters === 'function' && hasActiveFilters(appFilters)) {
        // Se não houver modal aberto e houver filtros ativos, limpa tudo
        clearFilters(appFilters, renderFn);
        showShortcutHUD('Filtros Limpos (Esc)');
      }
    }
  });

  // Atalhos globais (ignorar quando foco está em input)
  window.addEventListener('keydown', e => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (isInput) return;

    switch (e.key.toLowerCase()) {

      // N = Nova Tarefa (na primeira coluna)
      case 'n':
        e.preventDefault();
        if (state.columns.length > 0) {
          openCardFn(state.columns[0].id);
          showShortcutHUD('Nova Tarefa (N)');
        } else {
          showToast('⚠️ Crie uma coluna primeiro!');
        }
        break;

      // F = Focar na busca
      case 'f':
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          showShortcutHUD('Busca (F)');
        }
        break;

      // Alt + C = Nova Coluna
      case 'c':
        if (e.altKey) {
          e.preventDefault();
          if (typeof openColumnModalFn === 'function') {
            openColumnModalFn(null, state);
            showShortcutHUD('Nova Coluna (Alt+C)');
          }
        }
        break;

      // L = Alternar Visualização (Quadro / Lista)
      case 'l':
        e.preventDefault();
        if (typeof toggleViewFn === 'function') {
          toggleViewFn();
          showShortcutHUD('Alternar Vista (L)');
        }
        break;

      // Delete = Aviso (ação via botões de card)
      case 'delete':
        showShortcutHUD('Use ✏️ ou 📦 nos cards');
        break;

      // CTRL + Z / CTRL + SHIFT + Z (Undo/Redo)
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            const newState = redoFn(state);
            if (newState) { Object.assign(state, newState); renderFn(); showToast('♻️ Refazer'); }
          } else {
            const newState = undoFn(state);
            if (newState) { Object.assign(state, newState); renderFn(); showToast('↩️ Desfazer'); }
          }
        }
        break;
    }

    // Ctrl+S = Salvar com feedback
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveStateFn(state);
      showToast('💾 Alterações salvas!');
      showShortcutHUD('Salvar (Ctrl+S)');
    }
  });
}
