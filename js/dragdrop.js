/**
 * MB FLOWBOARD — js/dragdrop.js
 * Drag & Drop nativo HTML5
 * Ghost placeholder · Reordenação · WIP Limit
 */

'use strict';

/* ── Estado do Drag & Drop ── */
let dragCardId = null;
let dragColId  = null;
let ghostEl    = null;

/**
 * Handler: início do arrasto de um card
 * @param {DragEvent} e
 */
function onDragStart(e) {
  dragCardId = e.currentTarget.dataset.cardId;
  const colEl = e.currentTarget.closest('.column');
  dragColId = colEl?.dataset.colId || null;

  // Adiciona classes para animação via CSS
  requestAnimationFrame(() => {
    e.currentTarget.classList.add('dragging');
  });

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragCardId);

  // Feedback tátil em dispositivos móveis
  if ('vibrate' in navigator) navigator.vibrate(50);

  // Som curto ao iniciar o arrasto
  playTick(280, 0.08, 0.03);
}

/**
 * Handler: fim do arrasto (soltar ou cancelar)
 * @param {DragEvent} e
 */
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  
  // Limpa estados visuais de todas as colunas
  removeGhost();
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
}

/**
 * Handler: card passando sobre uma área de drop
 * @param {DragEvent} e
 */
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const col = e.currentTarget.closest('.column');
  if (col && !col.classList.contains('drag-over')) {
    col.classList.add('drag-over');
  }

  const afterEl = getDragAfterElement(e.currentTarget, e.clientY);

  // Cria o ghost na primeira vez
  if (!ghostEl) {
    ghostEl = document.createElement('div');
    ghostEl.className = 'card-ghost';
    ghostEl.setAttribute('aria-hidden', 'true');
  }

  // Toca som de movimento apenas quando o ghost muda de posição
  if (afterEl !== ghostEl.nextSibling) {
    playTick(250, 0.1, 0.03);
    if (afterEl) {
      e.currentTarget.insertBefore(ghostEl, afterEl);
    } else {
      e.currentTarget.appendChild(ghostEl);
    }
  }
}

/**
 * Handler: card saindo da área de drop
 * @param {DragEvent} e
 */
function onDragLeave(e) {
  const col = e.currentTarget.closest('.column');
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove('drag-over');
    removeGhost();
  }
}

/**
 * Handler: card solto na área de drop
 * @param {DragEvent} e
 * @param {Object} state - Estado global (mutado in-place)
 * @param {Function} renderFn - Função de render
 */
function onDrop(e, state, renderFn) {
  e.preventDefault();
  const targetColEl = e.currentTarget.closest('.column');
  if (!targetColEl) return;

  const targetColId = targetColEl.dataset.colId;
  targetColEl.classList.remove('drag-over');
  removeGhost();

  if (!dragCardId || !dragColId) return;

  const srcCol = state.columns.find(c => c.id === dragColId);
  const tgtCol = state.columns.find(c => c.id === targetColId);
  if (!srcCol || !tgtCol) return;

  // ── Regra de negócio: WIP Limit ──
  if (tgtCol.limit > 0 && tgtCol.cards.length >= tgtCol.limit && srcCol.id !== tgtCol.id) {
    showToast(`🚫 Limite de WIP atingido na coluna "${tgtCol.title}"!`);
    playMelody('alert');
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    // Animação de shake na coluna
    targetColEl.classList.add('wip-shake');
    setTimeout(() => targetColEl.classList.remove('wip-shake'), 500);
    return;
  }

  // Remove card da origem
  const cardIdx = srcCol.cards.findIndex(c => c.id === dragCardId);
  if (cardIdx === -1) return;
  const [card] = srcCol.cards.splice(cardIdx, 1);

  // Calcula posição de inserção no destino
  const afterEl = getDragAfterElement(e.currentTarget, e.clientY);
  let insertIdx = tgtCol.cards.length;
  if (afterEl) {
    const afterId = afterEl.dataset.cardId;
    const idx = tgtCol.cards.findIndex(c => c.id === afterId);
    if (idx !== -1) insertIdx = idx;
  }
  tgtCol.cards.splice(insertIdx, 0, card);

  // Registra no histórico se moveu para coluna de conclusão
  if (tgtCol.title.toLowerCase().includes('concluíd') || tgtCol.title.toLowerCase().includes('done')) {
    const today = getTodayISO();
    state.history[today] = (state.history[today] || 0) + 1;
  }

  // Nota musical baseada na coluna destino (Escala Pentatônica)
  const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
  const colIdx = state.columns.findIndex(c => c.id === targetColId);
  const freq = notes[colIdx % notes.length] || 250;
  playTick(freq / 2, 0.5, 0.07, true);

  dragCardId = null;
  dragColId  = null;

  // Persistência com histórico
  saveState(state, true);
  renderFn(); // Renderiza imediatamente para UX responsiva
  showToast('⏳ Sincronizando...');

  // Sincroniza com a API
  (async () => {
    try {
      if (window.API?.updateTarefa && card.id) {
        await window.API.updateTarefa(card.id, {
          titulo:    card.title,
          coluna:    tgtCol.title,
          desc:      card.desc      || '',
          date:      card.date      || '',
          tags:      Array.isArray(card.tags)      ? card.tags      : [],
          priority:  card.priority  || 'low',
          checklist: Array.isArray(card.checklist) ? card.checklist : []
        });
        showToast('✅ Tarefa movida para ' + tgtCol.title + '!');
      }
    } catch (err) {
      console.error('Erro ao mover via drag:', err);
      // Reverte a movimentação se a API falhar
      const idx2 = tgtCol.cards.findIndex(c => c.id === card.id);
      if (idx2 !== -1) tgtCol.cards.splice(idx2, 1);
      srcCol.cards.splice(cardIdx, 0, card);
      saveState(state, false);
      renderFn();
      showToast('❌ Erro ao mover — servidor indisponível. Tente novamente.');
    }
  })();
}

/**
 * Encontra o elemento após o qual o card deve ser inserido
 * @param {HTMLElement} container - Área de cards
 * @param {number} y - Posição Y do mouse
 * @returns {HTMLElement|null}
 */
function getDragAfterElement(container, y) {
  const cards = container.querySelectorAll('.card:not(.dragging):not(.card-ghost)');
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  for (const child of cards) {
    const box    = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }
  return closest.element;
}

/**
 * Remove o elemento ghost (placeholder de drop) do DOM
 */
function removeGhost() {
  if (ghostEl?.parentNode) ghostEl.parentNode.removeChild(ghostEl);
  ghostEl = null;
}

/**
 * Inicializa os eventos de drag & drop em uma área de cards
 * @param {HTMLElement} area - Elemento .cards-area
 * @param {Object} state - Estado global
 * @param {Function} renderFn - Função de render
 */
function initDragDropArea(area, state, renderFn) {
  area.addEventListener('dragover',  onDragOver);
  area.addEventListener('dragleave', onDragLeave);
  area.addEventListener('drop',      e => onDrop(e, state, renderFn));

  // Eventos de drag nos cards da área
  area.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend',   onDragEnd);
  });
}
