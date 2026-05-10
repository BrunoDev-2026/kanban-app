// js/tasks.js - Versão corrigida
'use strict';

// Estado global do modal
let editingCardId = null;
let editingCardColId = null;
let selectedPriority = 'low';
let tempChecklist = [];

// ==================== MODAL CARD ====================
function openCardModal(colId, cardId = null, state) {
  editingCardColId = colId;
  editingCardId = cardId;

  const modalTitle = document.getElementById('cardModalTitle');
  if (modalTitle) modalTitle.textContent = cardId ? 'Editar Tarefa' : 'Nova Tarefa';

  // Reset prioridade
  selectedPriority = 'low';
  document.querySelectorAll('.priority-btn').forEach(btn => {
    const isActive = btn.dataset.priority === selectedPriority;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });

  if (cardId) {
    const col = state.columns.find(c => c.cards.some(k => k.id === cardId));
    const card = col?.cards.find(k => k.id === cardId);
    if (card) {
      document.getElementById('cardTitleInput').value = card.title;
      document.getElementById('cardDescInput').value = card.desc || '';
      document.getElementById('cardDateInput').value = card.date || '';
      document.getElementById('cardTagsInput').value = (card.tags || []).join(', ');
      tempChecklist = JSON.parse(JSON.stringify(card.checklist || []));
      selectedPriority = card.priority || 'low';
    }
  } else {
    document.getElementById('cardTitleInput').value = '';
    document.getElementById('cardDescInput').value = '';
    document.getElementById('cardDateInput').value = '';
    document.getElementById('cardTagsInput').value = '';
    tempChecklist = [];
  }

  renderModalChecklist();
  openModal('cardModal');
  setTimeout(() => document.getElementById('cardTitleInput').focus(), 120);
}

// ==================== SALVAR (criar/editar) ====================
async function saveCard(state, renderFn) {
  const title = sanitizeInput(document.getElementById('cardTitleInput').value, 80);
  if (!title) {
    showToast('⚠️ O título é obrigatório.');
    return;
  }

  const desc = sanitizeInput(document.getElementById('cardDescInput').value, 500);
  const date = document.getElementById('cardDateInput').value;
  const tags = parseTags(document.getElementById('cardTagsInput').value);
  const col = state.columns.find(c => c.id === editingCardColId);
  if (!col) return;

  try {
    if (editingCardId) {
      // Enfileira atualização no sistema de Sync para persistência garantida
      const payload = {
        titulo: title,
        coluna: col.title,
        desc,
        date,
        tags,
        priority: selectedPriority,
        checklist: tempChecklist
      };
      
      window.Sync.enqueue({ method: 'PUT', id: editingCardId, payload });

      // Atualiza estado local
      const card = col.cards.find(k => k.id === editingCardId);

      if (card) {
        card.title = title;
        card.desc = desc;
        card.date = date;
        card.tags = tags;
        card.priority = selectedPriority;
        card.checklist = tempChecklist;
      }
      showToast('✅ Tarefa atualizada!');
    } else {
      // Criar nova tarefa (POST)
      const nova = await window.API.createTarefa({
        titulo: title,
        coluna: col.title,
        desc,
        date,
        tags,
        priority: selectedPriority,
        checklist: tempChecklist
      });

      col.cards.push({
        id: nova.id,
        title,
        desc: nova.desc || desc,
        date: nova.date || date,
        tags: Array.isArray(nova.tags) ? nova.tags : tags,
        priority: nova.priority || selectedPriority,
        checklist: Array.isArray(nova.checklist) ? nova.checklist : tempChecklist,
        totalFocusTime: 0,
        createdAt: nova.createdAt || new Date().toISOString()
      });
      showToast('🎉 Tarefa criada!');

    }
    renderFn();
    closeModal('cardModal');
  } catch (err) {
    console.error(err);
    showToast('❌ Erro ao salvar tarefa. Tente novamente.');
  }
}

// ==================== ARQUIVAR (DELETE) ====================
async function archiveCard(colId, cardId, state, renderFn, stopPomodoroFn) {
  const col = state.columns.find(c => c.id === colId);
  if (!col) return;
  const idx = col.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const [card] = col.cards.splice(idx, 1);

  try {
    window.Sync.enqueue({ method: 'DELETE', id: cardId });
    card.archivedAt = new Date().toISOString();
    state.archived.push(card);
    renderFn();
    showToast('📦 Tarefa arquivada!');
    if (stopPomodoroFn) stopPomodoroFn(cardId);
  } catch (err) {
    // Reverte remoção local
    col.cards.splice(idx, 0, card);
    showToast('❌ Erro ao arquivar tarefa');
  }
}

// ==================== MODAL COLUNA ====================
let editingColId = null;

function openColumnModal(colId, state) {
  editingColId = colId || null;
  const col = colId ? state.columns.find(c => c.id === colId) : null;

  document.getElementById('columnModalTitle').textContent = col ? 'Editar Coluna' : 'Nova Coluna';
  document.getElementById('columnNameInput').value = col ? col.title : '';
  document.getElementById('columnLimitInput').value = col ? col.limit : 0;

  // Cor selecionada
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.toggle('selected', col && dot.dataset.color === col.color);
  });

  openModal('columnModal');
  setTimeout(() => document.getElementById('columnNameInput').focus(), 120);
}

// ==================== INIT TASKS EVENTS ====================
function initTasksEvents(state, renderFn, stopPomodoroFn) {
  // Botões do modal de tarefa
  document.getElementById('saveCardBtn').addEventListener('click', () => saveCard(state, renderFn));
  document.getElementById('cancelCardModal').addEventListener('click', () => closeModal('cardModal'));
  document.getElementById('closeCardModal').addEventListener('click', () => closeModal('cardModal'));

  // Priority picker
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPriority = btn.dataset.priority;
      document.querySelectorAll('.priority-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
    });
  });

  // Checklist: adicionar item
  document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
    const input = document.getElementById('newChecklistItem');
    const text = input.value.trim();
    if (!text) return;
    tempChecklist.push({ text, completed: false });
    input.value = '';
    renderModalChecklist();
  });
  document.getElementById('newChecklistItem').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('addChecklistItemBtn').click();
    }
  });

  // Modal coluna
  document.getElementById('addColumnBtn').addEventListener('click', () => openColumnModal(null, state));
  document.getElementById('closeColumnModal').addEventListener('click', () => closeModal('columnModal'));
  document.getElementById('cancelColumnModal').addEventListener('click', () => closeModal('columnModal'));
  document.getElementById('saveColumnBtn').addEventListener('click', () => {
    const name = document.getElementById('columnNameInput').value.trim();
    if (!name) { showToast('⚠️ Nome da coluna é obrigatório.'); return; }
    const limit = parseInt(document.getElementById('columnLimitInput').value) || 0;
    const selectedDot = document.querySelector('.color-dot.selected');
    const color = selectedDot ? selectedDot.dataset.color : '#6C63FF';

    if (editingColId) {
      const col = state.columns.find(c => c.id === editingColId);
      if (col) { col.title = name; col.limit = limit; col.color = color; }
      showToast('✏️ Coluna atualizada!');
    } else {
      state.columns.push({ id: uid(), title: name, color, limit, cards: [] });
      showToast('✅ Coluna criada!');
    }
    saveState(state);
    renderFn();
    closeModal('columnModal');
  });

  // Color dots na modal de coluna
  document.querySelectorAll('#columnModal .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('#columnModal .color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });

  // Modal de confirmação
  document.getElementById('okConfirm').addEventListener('click', () => {
    closeModal('confirmModal');
    if (typeof confirmCallback === 'function') confirmCallback();
    confirmCallback = null;
  });
  document.getElementById('cancelConfirm').addEventListener('click', () => {
    closeModal('confirmModal');
    confirmCallback = null;
  });
}

// ==================== EXPOSIÇÃO GLOBAL ====================
window.openCardModal = openCardModal;
window.saveCard = saveCard;
window.archiveCard = archiveCard;
window.openColumnModal = openColumnModal;
window.initTasksEvents = initTasksEvents;

// Helper para renderizar checklist (se necessário)
function renderModalChecklist() {
  const area = document.getElementById('checklistArea');
  if (!area) return;
  area.innerHTML = '';
  tempChecklist.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'checklist-input-group';
    div.innerHTML = `
      <input type="checkbox" ${item.completed ? 'checked' : ''}>
      <input type="text" value="${escapeHtml(item.text)}" style="flex:1">
      <button class="btn-close" data-index="${index}">×</button>
    `;
    div.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      tempChecklist[index].completed = e.target.checked;
    });
    div.querySelector('input[type="text"]').addEventListener('input', (e) => {
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

let confirmCallback = null;

window.openConfirm = function(message, cb) {
  confirmCallback = cb;
  document.getElementById('confirmMessage').textContent = message;
  openModal('confirmModal');
};
