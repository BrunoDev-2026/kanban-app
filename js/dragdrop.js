/**
 * MB FLOWBOARD — js/dragdrop.js
 * Drag & Drop nativo HTML5
 * Ghost placeholder · Reordenação · WIP Limit
 */

'use strict';

/* ── Estado do Drag & Drop ── */
let dragCardId = null;
let dragColId  = null;
let dragCardPriority = null;
let ghostEl    = null;
let lastSparkTime = 0;

/**
 * Handler: início do arrasto de um card
 * @param {DragEvent} e
 */
function onDragStart(e) {
  dragCardId = e.currentTarget.dataset.cardId;
  const colEl = e.currentTarget.closest('.column');
  dragColId = colEl?.dataset.colId || null;

  // Captura a prioridade do card através da classe da barra de prioridade
  const priorityBar = e.currentTarget.querySelector('.card-priority-bar');
  dragCardPriority = priorityBar ? 
    Array.from(priorityBar.classList).find(c => ['low', 'medium', 'high'].includes(c)) : 'low';

  // Ativa pulso no título se o card for de alta prioridade
  if (dragCardPriority === 'high') {
    const titleEl = document.getElementById('boardTitleDisplay');
    if (titleEl) titleEl.classList.add('title-pulse-urgent');
  }

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
  const titleEl = document.getElementById('boardTitleDisplay');
  if (titleEl) {
    titleEl.style.removeProperty('color');
    titleEl.classList.remove('title-pulse-urgent');
  }

  document.querySelectorAll('.column').forEach(c => {
    c.classList.remove('drag-over');
    c.style.removeProperty('--drag-grid-color');
    c.style.removeProperty('--drag-bg-color');
  });
  dragCardPriority = null;
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
    
    // Mapeamento de cores baseado na prioridade do card sendo arrastado
    const colors = {
      high:   { grid: 'rgba(239, 68, 68, 0.25)', bg: 'rgba(50, 20, 20, 0.6)', title: '#EF4444' },
      medium: { grid: 'rgba(245, 158, 11, 0.25)', bg: 'rgba(50, 40, 20, 0.6)', title: '#F59E0B' },
      low:    { grid: 'rgba(16, 185, 129, 0.25)', bg: 'rgba(20, 50, 30, 0.6)', title: '#10B981' }
    };

    const selected = colors[dragCardPriority || 'low'];
    col.style.setProperty('--drag-grid-color', selected.grid);
    col.style.setProperty('--drag-bg-color', selected.bg);

    // Altera a cor do título do quadro
    const titleEl = document.getElementById('boardTitleDisplay');
    if (titleEl) titleEl.style.color = selected.title;

    if (col.querySelector('.column-empty-state')) playMelody('magnetic', dragCardPriority);
  }

  // ── Efeito de faíscas contínuas se o limite WIP estiver atingido ──
  if (col && col.classList.contains('limit-exceeded')) {
    const now = Date.now();
    if (now - lastSparkTime > 150) { // Cria uma faísca a cada 150ms
      createSparkEffect(col, e.clientX, e.clientY);
      playMelody('shortCircuit');
      lastSparkTime = now;
    }
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
 * Cria faíscas elétricas no ponto do mouse
 */
function createSparkEffect(parent, mouseX, mouseY) {
  const rect = parent.getBoundingClientRect();
  const x = mouseX - rect.left;
  const y = mouseY - rect.top;

  for (let i = 0; i < 3; i++) {
    const s = document.createElement('div');
    s.className = 'spark-particle';
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    s.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    s.style.animation = `sparkFlash ${0.3 + Math.random() * 0.3}s ease-out forwards`;
    
    parent.appendChild(s);
    setTimeout(() => s.remove(), 600);
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
    if (dragCardPriority !== 'high') {
       const titleEl = document.getElementById('boardTitleDisplay');
       if (titleEl) titleEl.style.removeProperty('color');
    }
    col.style.removeProperty('--drag-grid-color');
    col.style.removeProperty('--drag-bg-color');
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

  // Detecta se a coluna estava vazia antes do processamento
  const wasEmpty = targetColEl.querySelector('.column-empty-state');

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

  saveState(state, true);
  renderFn();

  // Enfileira na outbox — sync garantido mesmo com servidor hibernando
  if (card.id) {
    window.Sync.enqueue({ method: 'PUT', id: card.id, payload: {
      titulo:    card.title,
      coluna:    tgtCol.title,
      desc:      card.desc      || '',
      date:      card.date      || '',
      tags:      Array.isArray(card.tags)      ? card.tags      : [],
      priority:  card.priority  || 'low',
      checklist: Array.isArray(card.checklist) ? card.checklist : []
    }});
  }
  showToast('✅ Tarefa movida para ' + tgtCol.title + '!');

  // Dispara efeito de fumaça se a coluna estava vazia
  if (wasEmpty) {
    const prioColors = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
    createSmokeEffect(targetColEl, prioColors[card.priority] || '#fff');
    playMelody('impact');
    playMelody('shatter'); // Adiciona o feedback sonoro de estilhaço

    // Vibração personalizada para tarefas urgentes (padrão SOS curto)
    if (card.priority === 'high' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 300]);
    }
  }
}

/**
 * Cria um efeito visual de fumaça/partículas
 * @param {HTMLElement} parent - Elemento pai onde as partículas surgirão
 * @param {string} color - Cor das partículas
 */
function createSmokeEffect(parent, color = '#fff') {
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'smoke-particle';
    const size = Math.random() * 25 + 10;
    p.style.width = p.style.height = `${size}px`;
    
    // Cálculo de explosão: espalha em direções aleatórias X e Y
    const vx = (Math.random() - 0.5) * 160; // Spread horizontal
    const vy = (Math.random() - 0.5) * 160 - 20; // Spread vertical (leve tendência para cima)
    p.style.setProperty('--vx', `${vx}px`);
    p.style.setProperty('--vy', `${vy}px`);

    // Posicionamento aleatório dentro do container
    p.style.color = color; // Define a cor para o rastro (currentColor)
    p.style.backgroundColor = color;
    p.style.left = `${Math.random() * 80 + 10}%`;
    p.style.top = `${Math.random() * 60 + 20}%`;
    p.style.animationDelay = `${Math.random() * 0.2}s`;
    
    parent.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
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
  // evita rebind acidental
  if (!area || area.dataset.ddBound === '1') return;
  area.dataset.ddBound = '1';

  area.addEventListener('dragover',  onDragOver);
  area.addEventListener('dragleave', onDragLeave);
  area.addEventListener('drop',      e => onDrop(e, state, renderFn));

  // Eventos de drag nos cards da área
  area.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend',   onDragEnd);
  });
}

function initAllDragDrop(state, renderFn) {
  const board = document.getElementById('board');
  if (!board) return;

  // reseta flags em cada render (DOM é recriado)
  board.querySelectorAll('.cards-area').forEach(a => {
    a.dataset.ddBound = '';
  });

  board.querySelectorAll('.cards-area').forEach(area => {
    initDragDropArea(area, state, renderFn);
  });

  // fallback touch/pointer para mobile (long-press)
  if (!board.dataset.ddTouchBound) {
    board.dataset.ddTouchBound = '1';
    initTouchDnDFallback(board, state, renderFn);
  }
}

// Exposição para o app.js chamar depois do render
window.DragDrop = { initAllDragDrop, createSparkEffect };

/**
 * Fallback para mobile: long-press + arrasto manual
 * - Só ativa em pointer/touch
 * - Não interfere no HTML5 DnD (mouse continua usando dragstart/drop)
 */
function initTouchDnDFallback(boardEl, state, renderFn) {
  let pressTimer = null;
  let dragMode = false;
  let activeCardId = null;
  let activePointerId = null;

  // ghost manual
  let manualGhost = null;
  let manualColEl = null;
  let startClientX = 0;
  let startClientY = 0;

  const LONG_PRESS_MS = 250;
  const MOVE_CANCEL_PX = 10;

  function findCardElFromTarget(target) {
    return target?.closest?.('.card');
  }

  function findColElFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest?.('.column') || null;
  }

  function ensureGhost() {
    if (manualGhost) return;
    manualGhost = document.createElement('div');
    manualGhost.className = 'card card-ghost-manual';
    manualGhost.style.position = 'fixed';
    manualGhost.style.left = '-9999px';
    manualGhost.style.top = '-9999px';
    manualGhost.style.zIndex = '99999';
    manualGhost.style.pointerEvents = 'none';
    manualGhost.style.width = 'auto';
    manualGhost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(manualGhost);
  }

  function positionGhost(x, y) {
    if (!manualGhost) return;
    manualGhost.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  function teardown() {
    dragMode = false;
    activeCardId = null;
    activePointerId = null;
    manualColEl = null;
    startClientX = 0;
    startClientY = 0;
    if (manualGhost) {
      manualGhost.remove();
      manualGhost = null;
    }
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;

    boardEl.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
    // remove any wip shake
    boardEl.querySelectorAll('.column').forEach(c => c.classList.remove('wip-shake'));
  }

  function startManualDrag(cardEl, pointerEvent) {
    const cardId = cardEl?.dataset?.cardId;
    if (!cardId) return;

    dragMode = true;
    activeCardId = cardId;
    activePointerId = pointerEvent.pointerId;

    ensureGhost();

    // clone visual content (safe: we use existing DOM)
    manualGhost.innerHTML = cardEl.innerHTML;
    manualGhost.classList.add('manual');

    const rect = cardEl.getBoundingClientRect();
    // place ghost offset to keep touch stable
    const offsetX = pointerEvent.clientX - rect.left;
    const offsetY = pointerEvent.clientY - rect.top;

    manualGhost.style.width = rect.width + 'px';

    // initial position
    positionGhost(pointerEvent.clientX - offsetX, pointerEvent.clientY - offsetY);

    // find initial target column
    manualColEl = findColElFromPoint(pointerEvent.clientX, pointerEvent.clientY);
    if (manualColEl) manualColEl.classList.add('drag-over');

    // vibrate small feedback
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  function manualMove(pointerEvent) {
    if (!dragMode || pointerEvent.pointerId !== activePointerId) return;

    // move ghost
    positionGhost(pointerEvent.clientX, pointerEvent.clientY);

    const colEl = findColElFromPoint(pointerEvent.clientX, pointerEvent.clientY);
    if (colEl && manualColEl && colEl !== manualColEl) {
      // column changed
      manualColEl.classList.remove('drag-over');
      manualColEl = colEl;
      manualColEl.classList.add('drag-over');
    } else if (colEl && (!manualColEl || colEl === manualColEl)) {
      manualColEl = colEl;
      if (manualColEl) manualColEl.classList.add('drag-over');
    }

    if (!manualColEl) return;

    // reorder by y within column
    const targetColId = manualColEl.dataset.colId;
    if (!targetColId) return;

    const srcCol = state.columns.find(c => c.cards.some(k => String(k.id) === String(activeCardId)));
    const tgtCol = state.columns.find(c => c.id === targetColId);
    if (!srcCol || !tgtCol) return;

    if (tgtCol.limit > 0 && tgtCol.cards.length >= tgtCol.limit && srcCol.id !== tgtCol.id) {
      // WIP feedback
      manualColEl.classList.add('wip-shake');
      setTimeout(() => manualColEl.classList.remove('wip-shake'), 350);
      if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
      return;
    }

    const cardIdx = srcCol.cards.findIndex(c => String(c.id) === String(activeCardId));
    if (cardIdx === -1) return;

    // compute insert index based on pointer Y
    const cardsArea = manualColEl.querySelector('.cards-area');
    if (!cardsArea) return;
    const afterEl = getDragAfterElement(cardsArea, pointerEvent.clientY);

    let insertIdx = tgtCol.cards.length;
    if (afterEl && afterEl.dataset.cardId) {
      const idx = tgtCol.cards.findIndex(c => String(c.id) === String(afterEl.dataset.cardId));
      if (idx !== -1) insertIdx = idx;
    }

    // apply move in state only while dragging manually
    // remove from src (if moved already, this keeps stable)
    const [card] = srcCol.cards.splice(cardIdx, 1);
    if (tgtCol.id !== srcCol.id) {
      tgtCol.cards.splice(insertIdx, 0, card);
    } else {
      // same column: reinsert at new position
      // adjust insertIdx if removing earlier shifts indices
      if (insertIdx > cardIdx) insertIdx = insertIdx; // keep behavior simple
      tgtCol.cards.splice(insertIdx, 0, card);
    }

    renderFn();
  }

  boardEl.addEventListener('pointerdown', (e) => {
    // only touch/pen; ignore mouse to avoid fighting with HTML5 DnD
    if (e.pointerType === 'mouse') return;

    const cardEl = findCardElFromTarget(e.target);
    if (!cardEl) return;

    // capture coordinates
    startClientX = e.clientX;
    startClientY = e.clientY;
    activePointerId = e.pointerId;

    if (pressTimer) clearTimeout(pressTimer);

    pressTimer = setTimeout(() => {
      // cancel if user moved too much
      dragMode = false; // will be set in startManualDrag
      startManualDrag(cardEl, e);
      pressTimer = null;
    }, LONG_PRESS_MS);
  }, { passive: true });

  boardEl.addEventListener('pointermove', (e) => {
    if (!dragMode) {
      if (!activePointerId) return;
      const dx = Math.abs(e.clientX - startClientX);
      const dy = Math.abs(e.clientY - startClientY);
      if ((dx + dy) > MOVE_CANCEL_PX && pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      return;
    }

    manualMove(e);
  }, { passive: true });

  boardEl.addEventListener('pointerup', (e) => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    if (dragMode) {
      // finalizar: persistir via outbox
      const tgtColEl = manualColEl;
      if (tgtColEl && activeCardId) {
        const targetColId = tgtColEl.dataset.colId;
        const srcCol = state.columns.find(c => c.cards.some(k => String(k.id) === String(activeCardId)));
        const tgtCol = state.columns.find(c => c.id === targetColId);

        if (srcCol && tgtCol && srcCol.id !== tgtCol.id) {
          window.Sync.enqueue({ method: 'PUT', id: activeCardId, payload: {
            titulo:  (tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.title) || '',
            coluna:  tgtCol.title,
            desc:    (tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.desc) || '',
            date:    (tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.date) || '',
            tags:    (Array.isArray(tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.tags) ? tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.tags : []),
            priority:(tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.priority) || 'low',
            checklist: (Array.isArray(tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.checklist) ? tgtCol.cards.find(k => String(k.id) === String(activeCardId))?.checklist : [])
          }});
        }
      }
    }

    teardown();
  });

  boardEl.addEventListener('pointercancel', () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    teardown();
  });
}
