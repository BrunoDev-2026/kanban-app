/**
 * MB FLOWBOARD — js/tasks.js
 * CRUD de tarefas e colunas
 * Criar · Editar · Arquivar · Restaurar · Excluir
 */

'use strict';

/* ── Estado temporário do modal de card ── */
let editingCardId    = null;
let editingCardColId = null;
let selectedPriority = 'low';
let tempChecklist    = [];

/* ── Estado do modal de coluna ── */
let editingColId  = null;
let selectedColor = '#6C63FF';

/* ── Estado do modal de confirmação ── */
let confirmCallback = null;

/**
 * Abre o modal de nova tarefa ou edição
 * @param {string} colId - ID da coluna destino
 * @param {string|null} cardId - ID do card a editar (null = novo)
 * @param {Object} state - Estado global
 */
function openCardModal(colId, cardId = null, state) {
  editingCardColId = colId;
  editingCardId    = cardId;

  document.getElementById('cardModalTitle').textContent = cardId ? 'Editar Tarefa' : 'Nova Tarefa';
  selectedPriority = 'low';

  if (cardId) {
    const col  = state.columns.find(c => c.id === colId);
    const card = col?.cards.find(k => k.id === cardId);
    if (card) {
      document.getElementById('cardTitleInput').value = card.title;
      document.getElementById('cardDescInput').value  = card.desc  || '';
      document.getElementById('cardDateInput').value  = card.date  || '';
      document.getElementById('cardTagsInput').value  = (card.tags || []).join(', ');
      tempChecklist    = JSON.parse(JSON.stringify(card.checklist || []));
      selectedPriority = card.priority || 'low';
    }
  } else {
    document.getElementById('cardTitleInput').value = '';
    document.getElementById('cardDescInput').value  = '';
    document.getElementById('cardDateInput').value  = '';
    document.getElementById('cardTagsInput').value  = '';
    tempChecklist = [];
  }

  renderModalChecklist();

  // Atualiza botões de prioridade
  document.querySelectorAll('.priority-btn').forEach(btn => {
    const isActive = btn.dataset.priority === selectedPriority;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });

  openModal('cardModal');
  setTimeout(() => document.getElementById('cardTitleInput').focus(), 120);
}

/**
 * Salva o card (criar ou editar)
 * @param {Object} state - Estado global (mutado in-place)
 * @param {Function} renderFn
 */
function saveCard(state, renderFn) {
  const titleInput = document.getElementById('cardTitleInput');
  const title = titleInput.value.trim();

  if (!title) {
    showToast('⚠️ O título é obrigatório.');
    titleInput.focus();
    return;
  }
  if (title.length > 80) {
    showToast('⚠️ Título muito longo (máx. 80 caracteres).');
    return;
  }

  const desc = document.getElementById('cardDescInput').value.trim().slice(0, 500);
  const date = document.getElementById('cardDateInput').value;
  const tags = parseTags(document.getElementById('cardTagsInput').value);
  const col  = state.columns.find(c => c.id === editingCardColId);
  if (!col) return;

  if (editingCardId) {
    const card = col.cards.find(k => k.id === editingCardId);
    if (card) {
      card.title     = title;
      card.desc      = desc;
      card.date      = date;
      card.tags      = tags;
      card.priority  = selectedPriority;
      card.checklist = tempChecklist;
    }
    showToast('✅ Tarefa atualizada!');
  } else {
    col.cards.push({
      id:            uid(),
      title,
      desc,
      date,
      tags,
      priority:      selectedPriority,
      checklist:     tempChecklist,
      totalFocusTime: 0,
      createdAt:     new Date().toISOString()
    });
    showToast('🎉 Tarefa criada!');
  }

  saveState(state);
  renderFn();
  closeModal('cardModal');
  editingCardId = editingCardColId = null;
}

/**
 * Renderiza o checklist dentro do modal
 */
function renderModalChecklist() {
  const area = document.getElementById('checklistArea');
  if (!area) return;
  area.innerHTML = '';
  tempChecklist.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'checklist-input-group';
    div.innerHTML = `
      <div class="chk-wrapper"><i data-lucide="${item.completed ? 'check-square' : 'square'}" size="16"></i><input type="checkbox" ${item.completed ? 'checked' : ''} id="chk_${index}"></div>
      <input type="text" value="${escapeHtml(item.text)}" style="flex:1" placeholder="Item...">
      <button class="btn-close" title="Remover">×</button>
    `;
    div.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      tempChecklist[index].completed = e.target.checked;
    });
    div.querySelector('input[type="text"]').addEventListener('input', e => {
      tempChecklist[index].text = e.target.value;
    });
    div.querySelector('.btn-close').addEventListener('click', () => {
      tempChecklist.splice(index, 1);
      renderModalChecklist();
    });
    area.appendChild(div);
  });
  lucide.createIcons();
}

/**
 * Arquiva um card (move para state.archived)
 * @param {string} colId
 * @param {string} cardId
 * @param {Object} state
 * @param {Function} renderFn
 * @param {Function} stopPomodoroFn
 */
function archiveCard(colId, cardId, state, renderFn, stopPomodoroFn) {
  const col = state.columns.find(c => c.id === colId);
  if (!col) return;
  const cardIdx = col.cards.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;
  const [card] = col.cards.splice(cardIdx, 1);
  card.archivedAt = new Date().toISOString();
  state.archived.push(card);
  saveState(state);
  renderFn();
  showToast('📦 Tarefa arquivada!');
  if (stopPomodoroFn) stopPomodoroFn(cardId);
}

/**
 * Abre o modal de nova coluna ou edição
 * @param {string|null} colId - ID da coluna a editar (null = nova)
 * @param {Object} state
 */
function openColumnModal(colId = null, state) {
  editingColId = colId;
  const titleEl    = document.getElementById('columnModalTitle');
  const nameInput  = document.getElementById('columnNameInput');
  const limitInput = document.getElementById('columnLimitInput');

  if (colId) {
    const col = state.columns.find(c => c.id === colId);
    if (!col) return;
    titleEl.textContent = 'Editar Coluna';
    nameInput.value     = col.title;
    limitInput.value    = col.limit || 0;
    selectedColor       = col.color;
  } else {
    titleEl.textContent = 'Nova Coluna';
    nameInput.value     = '';
    limitInput.value    = 0;
    selectedColor       = '#6C63FF';
  }

  document.querySelectorAll('.color-dot').forEach(d => {
    const isSelected = d.dataset.color === selectedColor;
    d.classList.toggle('selected', isSelected);
    d.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });

  openModal('columnModal');
  setTimeout(() => nameInput.focus(), 120);
}

/**
 * Salva uma coluna (criar ou editar)
 * @param {Object} state
 * @param {Function} renderFn
 */
function saveColumn(state, renderFn) {
  const name  = document.getElementById('columnNameInput').value.trim();
  const limit = parseInt(document.getElementById('columnLimitInput').value) || 0;

  if (!name) {
    showToast('⚠️ O nome da coluna é obrigatório.');
    document.getElementById('columnNameInput').focus();
    return;
  }
  if (name.length > 40) {
    showToast('⚠️ Nome muito longo (máx. 40 caracteres).');
    return;
  }

  if (editingColId) {
    const col = state.columns.find(c => c.id === editingColId);
    if (col) { col.title = name; col.color = selectedColor; col.limit = limit; }
    showToast('✏️ Coluna atualizada!');
  } else {
    state.columns.push({ id: uid(), title: name, color: selectedColor, limit, cards: [] });
    showToast('🎉 Coluna criada!');
  }

  saveState(state);
  renderFn();
  closeModal('columnModal');
  editingColId = null;
}

/**
 * Abre o modal de confirmação genérico
 * @param {string} message
 * @param {Function} cb - Callback ao confirmar
 */
function openConfirm(message, cb) {
  confirmCallback = cb;
  document.getElementById('confirmMessage').innerHTML = `<i data-lucide="alert-triangle" size="32" style="color:var(--accent2); margin-bottom:12px;"></i><br>${message}`;
  openModal('confirmModal');
  lucide.createIcons();
}

/**
 * Inicializa todos os event listeners dos modais de tasks/colunas
 * @param {Object} state
 * @param {Function} renderFn
 * @param {Function} stopPomodoroFn
 */
function initTasksEvents(state, renderFn, stopPomodoroFn) {

  // ── Coluna ──
  document.getElementById('addColumnBtn').addEventListener('click', () => openColumnModal(null, state));
  document.getElementById('closeColumnModal').addEventListener('click', () => closeModal('columnModal'));
  document.getElementById('cancelColumnModal').addEventListener('click', () => closeModal('columnModal'));
  document.getElementById('saveColumnBtn').addEventListener('click', () => saveColumn(state, renderFn));
  document.getElementById('columnNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveColumn(state, renderFn);
  });

  // Color dots (coluna)
  document.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      document.querySelectorAll('.color-dot').forEach(d => {
        const isSelected = d === btn;
        d.classList.toggle('selected', isSelected);
        d.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });
    });
  });

  // ── Card ──
  document.getElementById('closeCardModal').addEventListener('click', () => closeModal('cardModal'));
  document.getElementById('cancelCardModal').addEventListener('click', () => closeModal('cardModal'));
  document.getElementById('saveCardBtn').addEventListener('click', () => saveCard(state, renderFn));
  document.getElementById('cardTitleInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCard(state, renderFn);
  });

  // Prioridade
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPriority = btn.dataset.priority;
      document.querySelectorAll('.priority-btn').forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    });
  });

  // Checklist
  document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
    const input = document.getElementById('newChecklistItem');
    if (input.value.trim()) {
      tempChecklist.push({ text: input.value.trim(), completed: false });
      input.value = '';
      renderModalChecklist();
    }
  });
  document.getElementById('newChecklistItem').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addChecklistItemBtn').click();
  });

  // ── Confirmar ──
  document.getElementById('cancelConfirm').addEventListener('click', () => {
    closeModal('confirmModal');
    confirmCallback = null;
  });
  document.getElementById('okConfirm').addEventListener('click', () => {
    closeModal('confirmModal');
    if (typeof confirmCallback === 'function') {
      confirmCallback();
      confirmCallback = null;
    }
  });

  // ── Delegação de eventos nos cards do board ──
  document.getElementById('board').addEventListener('click', e => {
    const editBtn = e.target.closest('.card-btn.edit');
    const arcBtn  = e.target.closest('.card-btn.archive');

    if (editBtn) {
      const cardId = editBtn.dataset.card;
      const col = state.columns.find(c => c.cards.some(k => k.id === cardId));
      if (col) openCardModal(col.id, cardId, state);
      return;
    }

    if (arcBtn) {
      const cardId = arcBtn.dataset.card;
      const col    = state.columns.find(c => c.cards.some(k => k.id === cardId));
      if (col) archiveCard(col.id, cardId, state, renderFn, stopPomodoroFn);
    }
  });

  // ── Fechar modais clicando no overlay ──
  ['columnModal','cardModal','confirmModal','emojiModal','archiveModal','profileModal'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
}
