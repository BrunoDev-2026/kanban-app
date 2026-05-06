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
 */
function initShortcuts(state, renderFn, openCardFn, saveStateFn, undoFn, redoFn) {

  // ESC fecha modais abertos
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['columnModal', 'cardModal', 'confirmModal', 'emojiModal', 'archiveModal', 'profileModal']
        .forEach(id => closeModal(id));
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
