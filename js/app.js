/**
 * MB FLOWBOARD — js/app.js
 * Orquestrador principal da aplicação
 * Render · Pomodoro · Temas · Init
 */

'use strict';

/* ════════════════════════════════════════════
   ESTADO GLOBAL E INICIALIZAÇÃO VIA API
════════════════════════════════════════════ */
let state = {
  title: 'RH - Marina',
  emoji: '',
  profile: { name: 'Usuário', color: '#6C63FF', focusTime: 25, breakTime: 5 },
  columns: [],
  archived: [],
  history: {}
};

function tarefasToColumns(tarefas) {

  const columnDefs = [
    { id: 'todo',     title: 'A Fazer',      color: '#6C63FF', limit: 0 },
    { id: 'progress', title: 'Em Progresso', color: '#FFB347', limit: 0 },
    { id: 'review',   title: 'Revisão',      color: '#4FC3F7', limit: 0 },
    { id: 'done',     title: 'Concluído',    color: '#43D9AD', limit: 0 }
  ];
  const columns = columnDefs.map(col => ({ ...col, cards: [] }));
  tarefas.forEach(t => {
    const col = columns.find(c => c.title === t.coluna);
    if (col) {
      col.cards.push({ id: t.id, title: t.titulo, desc: t.desc || '', priority: t.priority || 'low', date: t.date || '', tags: t.tags || [], checklist: t.checklist || [] });
    }
  });
  return columns;
}

/* Função principal que carrega os dados da API e inicia o app */
async function loadInitialData() {
  try {
    const tarefas = await window.API.fetchTarefas();
    // Preserva metadados locais (título, emoji, perfil, archived) e substitui só as colunas
    const localMeta = loadState(); // lê do localStorage para preservar título/emoji/perfil
    state.title   = localMeta.title   || state.title;
    state.emoji   = localMeta.emoji   || state.emoji;
    state.profile = localMeta.profile || state.profile;
    state.archived = localMeta.archived || [];
    state.columns = tarefasToColumns(tarefas);
    console.log('✅ Dados carregados da API:', tarefas);
  } catch (err) {
    console.error('❌ Erro ao carregar tarefas da API:', err);
    // Fallback: usa dados do localStorage se a API falhar
    const local = loadState();
    state.title    = local.title;
    state.emoji    = local.emoji;
    state.profile  = local.profile;
    state.archived = local.archived;
    state.columns  = local.columns.length > 0 ? local.columns : tarefasToColumns([]);
    if (window.showToast) window.showToast('⚠️ Sem conexão com servidor. Usando dados locais.', 4000);
  }
}

/** Controla transições de UI para evitar reflows pesados e gerenciar skeletons */
let isTransitioning = false;

/** ID da coluna sendo arrastada (drag de colunas) */
let dragColSrcId = null;

/** Filtros ativos */
const appFilters = {
  searchTerm: '',
  priority:   'all',
  tag:        'all',
  dateFilter: 'all'
};

/** Estado da visualização */
let currentView   = 'board';
let showDashboard = state.lastView === 'dashboard';

/* ════════════════════════════════════════════
   THEME ENGINE (Dynamic CSS Variables)
════════════════════════════════════════════ */
const THEME_CONFIG = {
  'theme-dark': {
    '--accent': '#3B82F6',
    '--accent-light': '#60A5FA',
    '--bg-base': '#020617',
    '--bg-deep': '#0B1120',
    '--glass-bg': 'rgba(15, 23, 42, 0.8)',
    '--glass-border': 'rgba(255, 255, 255, 0.12)',
    '--glass-bg-hover': 'rgba(255, 255, 255, 0.09)',
    '--text-primary': '#eeeaff',
    '--card-bg': 'rgba(10, 20, 50, 0.92)'
  },
  'theme-light': {
    '--accent': '#2563eb',
    '--accent-light': '#3b82f6',
    '--bg-base': '#f8fafc',
    '--bg-deep': '#ffffff',
    '--glass-bg': 'rgba(255, 255, 255, 0.9)',
    '--glass-border': 'rgba(0, 0, 0, 0.1)',
    '--glass-bg-hover': 'rgba(0, 0, 0, 0.03)',
    '--text-primary': '#0f172a',
    '--card-bg': '#ffffff'
  }
};

function applyTheme(themeName) {
  const vars = THEME_CONFIG[themeName] || THEME_CONFIG['theme-dark'];
  const root = document.documentElement;

  Object.entries(vars).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });

  document.body.className = themeName;
  if (typeof saveTheme === 'function') saveTheme(themeName);
}

// Mantém compatibilidade com módulos que chamam showTheme/selection
// (se saveTheme/loadTheme já existirem, não faz diferença)


/* ════════════════════════════════════════════
   POMODORO ENGINE
════════════════════════════════════════════ */
let activeFocusCardId  = null;
let pomodoroInterval   = null;
let tabFlashInterval   = null;
let completedPomodoros = 0;
let isPomodoroBreak    = false;
let timeLeft           = 0;

function togglePomodoro(cardId) {
  if (activeFocusCardId === cardId) { stopPomodoro(); return; }
  stopPomodoro();
  activeFocusCardId = cardId;
  isPomodoroBreak   = false;
  timeLeft = (state.profile.focusTime || 25) * 60;
  playMelody('start');
  requestNotificationPermission();
  
  document.getElementById('pomodoroContainer').style.display = 'block';
  updateTimerDisplay();

  pomodoroInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      const spent = (state.profile.focusTime || 25) * 60;
      const col  = state.columns.find(c => c.cards.some(k => k.id === activeFocusCardId));
      const card = col?.cards.find(k => k.id === activeFocusCardId);
      if (card) card.totalFocusTime = (card.totalFocusTime || 0) + spent;

      completedPomodoros++;
      const isLong    = completedPomodoros % 4 === 0;
      const breakMins = isLong ? (state.profile.breakTime * 3) : (state.profile.breakTime || 5);
      stopPomodoro(false);
      startPomodoroBreak(breakMins, isLong);
      startTabFlash();
      if (isLong) playMelody('longBreak'); else playMelody('end');
      sendSystemNotification(
        isLong ? '🏆 Super Foco!' : '🎉 Pomodoro Concluído!',
        isLong ? '4 Ciclos! Hora de um descanso longo.' : 'Ótimo trabalho! Pausa curta iniciada.'
      );
      playTick(440, 0.8, 0.1, true);
      showToast(isLong ? '🏆 4 Ciclos! Descanso Longo.' : '🎉 Ciclo concluído! Pausa iniciada.');
    }
  }, 1000);

  render();
  showToast(`🎯 Foco iniciado: ${state.profile.focusTime || 25} minutos`);
}

function stopPomodoro(hideContainer = true) {
  clearInterval(pomodoroInterval);
  activeFocusCardId = null;
  isPomodoroBreak   = false;
  if (hideContainer) document.getElementById('pomodoroContainer').style.display = 'none';
  const display = document.querySelector('.pomodoro-display');
  if (display) { display.style.background = ''; display.style.borderColor = ''; display.style.color = ''; }
  stopTabFlash();
  document.title = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  render();
}

function startPomodoroBreak(minutes, isLong = false) {
  isPomodoroBreak = true;
  timeLeft = minutes * 60;
  const display = document.querySelector('.pomodoro-display');
  if (display) {
    display.style.background  = 'rgba(16, 185, 129, 0.15)';
    display.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    display.style.color       = 'var(--accent3)';
  }
  document.getElementById('pomodoroContainer').style.display = 'block';
  updateTimerDisplay();
  pomodoroInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      stopPomodoro();
      startTabFlash();
      playMelody('end');
      showToast('⌛ Pausa finalizada! Pronto para o próximo ciclo?');
    }
  }, 1000);
}

function startTabFlash() {
  if (tabFlashInterval) return;
  const alertTitle    = '🚨 TEMPO ESGOTADO! 🚨';
  const originalTitle = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  let isAlert = true;
  tabFlashInterval = setInterval(() => {
    document.title = isAlert ? alertTitle : originalTitle;
    isAlert = !isAlert;
  }, 1000);
}

function stopTabFlash() {
  if (tabFlashInterval) {
    clearInterval(tabFlashInterval);
    tabFlashInterval = null;
    document.title = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const prefix = isPomodoroBreak ? '☕ ' : '';
  const mStr = String(mins).padStart(2,'0');
  const sStr = String(secs).padStart(2,'0');
  const timeStr = `${mStr}:${sStr}`;

  // Atualiza timers da interface
  document.getElementById('timerMinutes').textContent = String(mins).padStart(2,'0');
  document.getElementById('timerSeconds').textContent = String(secs).padStart(2,'0');
  
  const bigMins = document.getElementById('bigTimerMinutes');
  const bigSecs = document.getElementById('bigTimerSeconds');
  if (bigMins) bigMins.textContent = mStr;
  if (bigSecs) bigSecs.textContent = sStr;

  const cyclesEl = document.getElementById('pomodoroCycles');
  if (cyclesEl) {
    const cur = completedPomodoros % 4;
    cyclesEl.textContent = Array.from({length:4}, (_,i) => i < cur ? '🟢' : '⚪').join('');
  }
  document.title = `(${prefix}${timeStr}) ${state.title || 'MB - FlowBoard'}`;
}

function renderFocusView() {
  const focusSection = document.getElementById('focusModeSection');
  if (!activeFocusCardId) {
    focusSection.style.display = 'none';
    document.body.classList.remove('focus-mode-active');
    return;
  }

  const col = state.columns.find(c => c.cards.some(k => k.id === activeFocusCardId));
  const card = col?.cards.find(k => k.id === activeFocusCardId);
  if (!card) return;

  document.body.classList.add('focus-mode-active');
  focusSection.style.display = 'flex';
  
  document.getElementById('focusTaskTitle').textContent = card.title;
  document.getElementById('focusTaskDesc').textContent = card.desc || 'Foco total nesta tarefa.';
  const badge = document.getElementById('focusPrioBadge');
  badge.textContent = card.priority.toUpperCase();
  badge.className = `card-due-badge prio-${card.priority}`;
  
  lucide.createIcons();
}

/* ════════════════════════════════════════════
   BUILD CARD HTML
════════════════════════════════════════════ */
const EMOJI_LIST = [
  '💡','🌟','✨','✅','🎉','📝','📌','🗓️','📊','💻','📱','💬','⚠️',
  '🔄','➕','📚','📁','🔗','🗑️','🌎','☀️','🌈','🔥','💖','🤔','⏳','⏰',
  '📆','📈','📉','🛠️','🔒','🔔','📢','🎁','🎓','💼','🏡','🚗','✈️','⛵',
  '🍕','☕','💪','🧠','👀','🎤','🎧','🎸','🎮','🎥','🎨','🎵','❤️','🧡',
  '💛','💚','💙','💜','🖤','🤍','🤎','🌙','⭐','🏆','🦄','🐱','🐶','🍀'
];

function buildCardHTML(card, isDoneColumn, hasPrevCol = false, hasNextCol = false) {
  const deadlineStatus = getDeadlineStatus(card.date, isDoneColumn);
  const isFocusing     = activeFocusCardId === card.id;

  // Badge de prazo
  let dueBadgeHTML = '';
  if (deadlineStatus === 'overdue') {
    dueBadgeHTML = `<span class="card-due-badge overdue">🔴 Atrasada</span>`;
  } else if (deadlineStatus === 'due-today') {
    dueBadgeHTML = `<span class="card-due-badge due-today">⚠️ Hoje</span>`;
  } else if (deadlineStatus === 'due-soon') {
    const diff = getDaysDiff(card.date);
    dueBadgeHTML = `<span class="card-due-badge due-soon">⏰ ${diff}d</span>`;
  }

  const dateStr = card.date
    ? `<span class="card-date">📅 ${formatDate(card.date)}</span>`
    : '<span></span>';

  const tagsHtml = buildTagsHTML(card.tags);

  const totalItems = (card.checklist || []).length;
  const doneItems  = (card.checklist || []).filter(i => i.completed).length;
  const checklistHtml = totalItems > 0 ? `
    <div class="card-checklist-progress">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      ${doneItems}/${totalItems}
    </div>` : '';

  const cardClasses = [
    'card',
    deadlineStatus === 'overdue' ? 'card-overdue' : '',
    deadlineStatus === 'due-soon' || deadlineStatus === 'due-today' ? 'card-due-soon' : '',
    isFocusing ? 'is-focusing' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClasses}" draggable="true" data-card-id="${card.id}"
         role="listitem" aria-label="${escapeHtml(card.title)}">
      <div class="card-priority-bar ${card.priority}" aria-hidden="true"></div>
      <div class="card-title">${escapeHtml(card.title)}</div>
      <div class="card-tags">${tagsHtml} ${dueBadgeHTML}</div>
      ${checklistHtml}
      ${card.desc ? `<div class="card-desc">${escapeHtml(card.desc)}</div>` : ''}
      <div class="card-footer">
        ${dateStr}
        <div class="card-actions">
          ${hasPrevCol ? `<button class="card-btn prev-col" data-card="${card.id}" title="Anterior"><i data-lucide="chevron-left" size="14"></i></button>` : ''}
          <button class="card-btn edit"    data-card="${card.id}" title="Editar"><i data-lucide="pencil" size="14"></i></button>
          <button class="card-btn focus"   data-card="${card.id}" title="Foco"><i data-lucide="play" size="14"></i></button>
          <button class="card-btn archive" data-card="${card.id}" title="Arquivar"><i data-lucide="archive" size="14"></i></button>
          <button class="card-btn delete"  data-card="${card.id}" title="Excluir"><i data-lucide="trash-2" size="14"></i></button>
          ${hasNextCol ? `<button class="card-btn next-col" data-card="${card.id}" title="Próximo"><i data-lucide="chevron-right" size="14"></i></button>` : ''}
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   BUILD COLUNA
════════════════════════════════════════════ */
function buildColumn(col, isDoneColumn, hasPrevCol = false, hasNextCol = false) {
  const isExceeded = col.limit > 0 && col.cards.length > col.limit;
  const progress   = col.limit > 0 ? Math.min((col.cards.length / col.limit) * 100, 100) : 0;

  const el = document.createElement('div');
  el.className = `column ${isExceeded ? 'limit-exceeded' : ''}`;
  el.dataset.colId = col.id;
  el.setAttribute('role', 'listitem');

  // Empty state da coluna
  const emptyStateHTML = col.cards.length === 0 ? `
    <div class="column-empty-state">
      <span class="empty-icon">📁</span>
      <p>Nenhuma tarefa criada ainda</p>
      <button class="btn-empty-create" data-col="${col.id}">+ Criar primeira tarefa</button>
    </div>` : '';

  el.innerHTML = `
    <div class="column-header" data-col-id="${col.id}">
      <div class="column-drag-handle" title="Arrastar coluna" aria-label="Arrastar coluna" draggable="true">
        <i data-lucide="grip-vertical" size="16"></i>
      </div>
      <div class="column-title-wrap">
        <span class="column-title">${escapeHtml(col.title)}</span>
        <span class="column-count" aria-label="${col.cards.length} tarefas">
          ${col.cards.length}${col.limit > 0 ? ' / ' + col.limit : ''}
        </span>
      </div>
      <div class="column-actions">
        <button class="col-btn edit" data-col="${col.id}" title="Editar coluna" aria-label="Editar ${escapeHtml(col.title)}">
          <i data-lucide="pencil" size="14"></i>
        </button>
        <button class="col-btn delete" data-col="${col.id}" title="Excluir coluna" aria-label="Excluir ${escapeHtml(col.title)}">
          <i data-lucide="trash-2" size="14"></i>
        </button>
      </div>
      <div class="column-header-accent" style="background:${col.color}" aria-hidden="true"></div>
    </div>
    ${col.limit > 0 ? `
      <div class="column-progress-container">
        <div class="column-progress-bar" style="width:${progress}%; background-color:${isExceeded ? 'var(--accent2)' : col.color}"></div>
      </div>` : ''}
    <div class="cards-area" data-col-id="${col.id}" role="list" aria-label="Tarefas de ${escapeHtml(col.title)}">
      ${col.cards.map(c => buildCardHTML(c, isDoneColumn, hasPrevCol, hasNextCol)).join('')}
      ${emptyStateHTML}
    </div>
    <button class="add-card-btn" data-col="${col.id}" aria-label="Adicionar tarefa em ${escapeHtml(col.title)}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Adicionar tarefa
    </button>`;

  // Drag & Drop de cards
  const area = el.querySelector('.cards-area');
  initDragDropArea(area, state, render);

  // Drag & Drop de coluna via handle
  const handle = el.querySelector('.column-drag-handle');
  if (handle) {
    handle.addEventListener('dragstart', e => {
      e.stopPropagation();
      dragColSrcId = col.id;
      el.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', col.id);
      playTick(300, 0.1, 0.03);
    });
    handle.addEventListener('dragend', () => {
      el.classList.remove('col-dragging');
      document.querySelectorAll('.column').forEach(c => c.classList.remove('col-drag-over'));
      dragColSrcId = null;
    });
  }

  // Receber coluna arrastada sobre esta coluna
  el.addEventListener('dragover', e => {
    if (!dragColSrcId || dragColSrcId === col.id) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.column').forEach(c => c.classList.remove('col-drag-over'));
    el.classList.add('col-drag-over');
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('col-drag-over');
  });
  el.addEventListener('drop', e => {
    if (!dragColSrcId || dragColSrcId === col.id) return;
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('col-drag-over');
    const srcIdx = state.columns.findIndex(c => c.id === dragColSrcId);
    const tgtIdx = state.columns.findIndex(c => c.id === col.id);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = state.columns.splice(srcIdx, 1);
    state.columns.splice(tgtIdx, 0, moved);
    dragColSrcId = null;
    saveState(state);
    render();
    showToast('↔️ Coluna reordenada!');
    playTick(380, 0.3, 0.06, true);
  });

  // Botões da coluna
  el.querySelector('.col-btn.edit').addEventListener('click', () => openColumnModal(col.id, state));
  el.querySelector('.col-btn.delete').addEventListener('click', () => {
    const msg = col.cards.length > 0
      ? `Excluir a coluna "${col.title}" e ${col.cards.length} tarefa(s)?`
      : `Excluir a coluna "${col.title}"?`;
    openConfirm(msg, () => {
      state.columns = state.columns.filter(c => c.id !== col.id);
      saveState(state);
      render();
      showToast('🗑️ Coluna excluída.');
    });
  });
  el.querySelector('.add-card-btn').addEventListener('click', () => openCardModal(col.id, null, state));

  // Botão de empty state
  const emptyBtn = el.querySelector('.btn-empty-create');
  if (emptyBtn) {
    emptyBtn.addEventListener('click', () => openCardModal(col.id, null, state));
  }

  return el;
}

/* ════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════ */
function render() {
  if (isTransitioning) return;

  const board = document.getElementById('board');
  const dashSection = document.getElementById('dashboardSection');
  
  // Alternância Exclusiva (SaaS Style)
  if (showDashboard) {
    board.style.display = 'none';
    dashSection.style.display = 'grid';
    requestAnimationFrame(() => renderDashboard(state, dashSection));
  } else {
    dashSection.style.display = 'none';
    board.style.display = currentView === 'list' ? 'block' : 'flex';
  }

  // MODO FOCO: Se um card está em foco, ocultamos o Kanban/Dashboard 
  // para garantir imersão total (Deep Work), a menos que o dashboard esteja aberto.
  if (activeFocusCardId && !showDashboard) {
    renderFocusView();
    board.style.display = 'none';
    return;
  } else if (!activeFocusCardId) {
    document.body.classList.remove('focus-mode-active');
    if (document.getElementById('focusModeSection')) {
      document.getElementById('focusModeSection').style.display = 'none';
    }
  }

  board.className = currentView === 'list' ? 'board view-list' : 'board';
  if (!showDashboard) board.innerHTML = '';

  // Header
  const emojiText    = document.getElementById('boardEmojiText');
  const titleDisplay = document.getElementById('boardTitleDisplay');
  if (emojiText)    emojiText.textContent    = state.emoji;
  if (titleDisplay) titleDisplay.textContent = state.title;

  // Avatar
  updateAvatarDisplay(state.profile);

  // Contador de concluídas
  const doneCol   = state.columns.find(c => c.title.toLowerCase().includes('concluíd') || c.title.toLowerCase().includes('done'));
  const doneCount = doneCol ? doneCol.cards.length : 0;
  const counter   = document.getElementById('completedCounter');
  if (counter) counter.innerHTML = `<i data-lucide="check-circle-2"></i> ${doneCount}`;

  // Board vazio
  if (state.columns.length === 0) {
    board.innerHTML = `
      <div class="empty-board">
        <i data-lucide="layout-template" size="64" style="opacity:0.2; margin-bottom:16px;"></i>
        <h3>Nenhuma coluna ainda</h3>
        <p>Clique em <strong>+ Coluna</strong> no topo para começar seu quadro.</p>
      </div>`;
    return;
  }

  // Renderiza colunas com filtros e ordenação por prioridade
  state.columns.forEach((col, colIndex) => {
    const isDoneColumn = col.title.toLowerCase().includes('concluíd') || col.title.toLowerCase().includes('done');
    const hasPrevCol   = colIndex > 0;
    const hasNextCol   = colIndex < state.columns.length - 1;

    let filteredCards = col.cards.filter(card =>
      cardMatchesFilters(card, appFilters, isDoneColumn)
    );

    // Ordenação: High > Medium > Low
    const prioWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    filteredCards.sort((a, b) => (prioWeight[b.priority] || 0) - (prioWeight[a.priority] || 0));

    const colWithFilteredCards = { ...col, cards: filteredCards };
    board.appendChild(buildColumn(colWithFilteredCards, isDoneColumn, hasPrevCol, hasNextCol));
  });

  // Renderiza ícones Lucide após atualizar o DOM
  lucide.createIcons();
}

/**
 * Executa o render com um efeito de skeleton loading para transições suaves
 */
function renderWithSkeletons() {
  const board = document.getElementById('board');
  if (!board) return;

  isTransitioning = true;
  
  // Gera estrutura temporária de skeletons baseada nas colunas atuais
  const skeletonsHTML = state.columns.map(col => `
    <div class="column skeleton">
      <div class="column-header" style="height: 48px; opacity: 0.3; background: var(--glass-border)"></div>
      <div class="cards-area">
        <div class="card skeleton-card skeleton"></div>
        <div class="card skeleton-card skeleton"></div>
      </div>
    </div>
  `).join('');

  board.innerHTML = skeletonsHTML;
  
  // Simula latência de "carregamento premium" antes de aplicar o estado real
  setTimeout(() => {
    isTransitioning = false;
    render();
    // Feedback sonoro sutil de conclusão de carregamento
    if (typeof playTick === 'function') playTick(440, 0.05, 0.02);
  }, 350);
}

/* ════════════════════════════════════════════
   EDIÇÃO INLINE DO TÍTULO DO QUADRO
════════════════════════════════════════════ */
function activateTitleEdit() {
  const span = document.getElementById('boardTitleDisplay');
  const input = document.createElement('input');
  input.type      = 'text';
  input.value     = state.title || 'Meu Quadro';
  input.className = 'board-title-input';
  input.maxLength = 30;
  input.setAttribute('aria-label', 'Nome do quadro');
  span.replaceWith(input);
  input.focus();
  input.select();
  let saved = false;

  const saveTitle = () => {
    if (saved) return;
    saved = true;
    state.title = input.value.trim() || 'Meu Quadro';
    saveState(state);
    render();
    showToast('✏️ Título atualizado!');
  };
  const cancelTitle = () => { if (saved) return; saved = true; render(); };

  input.addEventListener('blur', saveTitle);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.removeEventListener('blur', saveTitle); saveTitle(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', saveTitle); cancelTitle(); }
  });
}

/* ════════════════════════════════════════════
   EMOJI PICKER
════════════════════════════════════════════ */
function openEmojiModal() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  EMOJI_LIST.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className   = 'emoji-item';
    btn.textContent = emoji;
    btn.setAttribute('aria-label', `Emoji ${emoji}`);
    btn.addEventListener('click', () => {
      state.emoji = emoji;
      saveState(state);
      render();
      showToast(`Emoji atualizado para ${emoji}! ✨`);
      closeModal('emojiModal');
    });
    grid.appendChild(btn);
  });
  openModal('emojiModal');
}

/* ════════════════════════════════════════════
   MODAL: ARQUIVO
════════════════════════════════════════════ */
function openArchiveModal() {
  const list     = document.getElementById('archiveList');
  const clearBtn = document.getElementById('clearArchiveBtn');
  list.innerHTML = '';

  if (state.archived.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhuma tarefa arquivada.</p>';
    if (clearBtn) clearBtn.style.display = 'none';
  } else {
    if (clearBtn) clearBtn.style.display = 'block';
    state.archived.forEach(card => {
      const item = document.createElement('div');
      item.className = 'archive-item';
      item.innerHTML = `
        <div class="archive-item-info">
          <h4>${escapeHtml(card.title)}</h4>
          <p>${card.desc ? escapeHtml(card.desc).slice(0,40) + '...' : 'Sem descrição'}</p>
          <span class="archive-item-date">Arquivado em: ${formatFullDate(card.archivedAt)}</span>
        </div>
        <div class="archive-item-actions">
          <button class="btn-icon btn-ghost btn-restore" data-id="${card.id}" title="Restaurar">⬆️</button>
          <button class="btn-icon btn-ghost btn-danger-hover btn-del-archive" data-id="${card.id}" title="Excluir">🗑️</button>
        </div>`;

      item.querySelector('.btn-restore').addEventListener('click', () => {
        const idx = state.archived.findIndex(c => c.id === card.id);
        if (idx === -1) return;
        const [restored] = state.archived.splice(idx, 1);
        if (state.columns.length > 0) state.columns[0].cards.push(restored);
        saveState(state);
        render();
        openArchiveModal();
        showToast('♻️ Tarefa restaurada!');
      });
      item.querySelector('.btn-del-archive').addEventListener('click', () => {
        openConfirm('Excluir esta tarefa permanentemente?', () => {
          state.archived = state.archived.filter(c => c.id !== card.id);
          saveState(state);
          openArchiveModal();
          showToast('🗑️ Tarefa excluída definitivamente.');
        });
      });

      list.appendChild(item);
    });
  }
  openModal('archiveModal');
}

/* ════════════════════════════════════════════
   HELPERS DE MODAL
════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  // ── Tema ──
  const savedTheme = loadTheme();
  applyTheme(savedTheme);
  const themeToggleBtn  = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');

  if (themeToggleBtn && themeToggleIcon) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.contains('theme-light');
      const novo = isLight ? 'theme-dark' : 'theme-light';
      applyTheme(novo);
      showToast(novo === 'theme-light' ? '☀️ Modo claro' : '🌙 Modo escuro');
    });
  }

  // ── Filtros ──
  initFilters(state, appFilters, render);

  // ── Atalhos ──
  initShortcuts(state, render, openCardModal, saveState, undo, redo);

  // ── Tasks / Colunas ──
  initTasksEvents(state, render, (cardId) => {
    if (activeFocusCardId === cardId) stopPomodoro();
  });

  // ── Avatar / Perfil ──
  document.getElementById('userProfileTrigger').addEventListener('click', () => openProfileModal(state));
  document.getElementById('saveProfileBtn').addEventListener('click', () => saveProfile(state));
  document.getElementById('closeProfileModal').addEventListener('click', () => closeModal('profileModal'));

  // ── Dashboard ──
  document.getElementById('toggleDashboardBtn').addEventListener('click', () => {
    showDashboard = !showDashboard;
    state.lastView = showDashboard ? 'dashboard' : 'board';
    saveState(state);
    
    if (showDashboard) {
      renderDashboard(state, document.getElementById('dashboardSection'));
    }
    render();
  });

  // ── Emoji Picker ──
  document.getElementById('boardEmojiText').addEventListener('click', openEmojiModal);
  document.getElementById('closeEmojiModal').addEventListener('click', () => closeModal('emojiModal'));
  document.getElementById('clearEmojiBtn').addEventListener('click', () => {
    state.emoji = '';
    saveState(state);
    render();
    showToast('Emoji removido!');
    closeModal('emojiModal');
  });

  // ── Título do Quadro ──
  document.getElementById('boardTitleDisplay').addEventListener('click', activateTitleEdit);
  document.getElementById('boardTitleDisplay').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTitleEdit(); }
  });

  // ── Alternar Vista ──
  document.getElementById('toggleViewBtn').addEventListener('click', () => {
    currentView = currentView === 'board' ? 'list' : 'board';
    render();
    showToast(currentView === 'list' ? '📋 Vista em lista' : '📊 Vista em quadro');
  });

  // ── Arquivo ──
  document.getElementById('openArchiveBtn').addEventListener('click', openArchiveModal);
  document.getElementById('closeArchiveModal').addEventListener('click', () => closeModal('archiveModal'));
  document.getElementById('clearArchiveBtn').addEventListener('click', () => {
    if (state.archived.length === 0) return;
    openConfirm('Excluir permanentemente todas as tarefas arquivadas?', () => {
      state.archived = [];
      saveState(state);
      openArchiveModal();
      showToast('🧹 Arquivo limpo!');
    });
  });

  // ── Limpar Quadro ──
  document.getElementById('clearBoardBtn').addEventListener('click', () => {
    openConfirm('Deseja limpar todo o quadro? Isso excluirá todas as colunas e tarefas permanentemente.', () => {
      state.columns = [];
      saveState(state);
      render();
      showToast('🧹 Quadro limpo!');
    });
  });

  // ── Exportar ──
  document.getElementById('exportBoardBtn').addEventListener('click', () => {
    try {
      const blob     = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const date     = new Date().toISOString().split('T')[0];
      const link     = document.createElement('a');
      link.href      = url;
      link.download  = `mb-flowboard-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('💾 Backup exportado com sucesso!');
    } catch { showToast('❌ Erro ao exportar backup.'); }
  });

  // ── Imprimir ──
  document.getElementById('printBoardBtn').addEventListener('click', () => {
    showToast('🖨️ Preparando impressão...');
    setTimeout(() => window.print(), 300);
  });

  // ── Dropdown "Mais" ──
  document.getElementById('moreActionsBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('moreDropdown').classList.toggle('open');
  });
  window.addEventListener('click', () => document.getElementById('moreDropdown').classList.remove('open'));

  // ── Scroll to Top Logic ──
  const scrollTopBtn = document.getElementById('scrollToTopBtn');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.innerWidth <= 768 && window.scrollY > 400) {
        scrollTopBtn.classList.add('show');
      } else {
        scrollTopBtn.classList.remove('show');
      }
    });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Pomodoro ──
  document.getElementById('stopTimerBtn').addEventListener('click', stopPomodoro);
  document.getElementById('quitFocusBtn').addEventListener('click', stopPomodoro);
  document.getElementById('board').addEventListener('click', e => {
    const focBtn = e.target.closest('.card-btn.focus');
    if (focBtn) { togglePomodoro(focBtn.dataset.card); return; }

    // ── Excluir tarefa individual ──
    const delBtn = e.target.closest('.card-btn.delete');
    if (delBtn) {
      const cardId = delBtn.dataset.card;
      const cardEl = delBtn.closest('.card');
      const col    = state.columns.find(c => c.cards.some(k => k.id === cardId));
      const card   = col?.cards.find(k => k.id === cardId);
      if (!col || !card) return;
      openConfirm(`Excluir a tarefa "${card.title}" permanentemente?`, () => {
        cardEl.classList.add('card-exit');
        
        setTimeout(() => {
          col.cards = col.cards.filter(k => k.id !== cardId);
          if (activeFocusCardId === cardId) stopPomodoro();
          saveState(state);
          render();
          showToast('🗑️ Tarefa excluída.');
        }, 280);
      });
      return;
    }

    // ── Mover para próxima coluna ──
    const nextBtn = e.target.closest('.card-btn.next-col');
    if (nextBtn) {
      const cardId = nextBtn.dataset.card;
      const colIdx = state.columns.findIndex(c => c.cards.some(k => k.id === cardId));
      if (colIdx >= 0 && colIdx < state.columns.length - 1) {
        const cardIdx = state.columns[colIdx].cards.findIndex(k => k.id === cardId);
        const [card] = state.columns[colIdx].cards.splice(cardIdx, 1);
        state.columns[colIdx + 1].cards.push(card);
        saveState(state);
        render();
        showToast('➡️ Tarefa avançou de etapa!');
        playTick(400, 0.2, 0.05, true);
      }
      return;
    }

    // ── Mover para coluna anterior ──
    const prevBtn = e.target.closest('.card-btn.prev-col');
    if (prevBtn) {
      const cardId = prevBtn.dataset.card;
      const colIdx = state.columns.findIndex(c => c.cards.some(k => k.id === cardId));
      if (colIdx > 0) {
        const cardIdx = state.columns[colIdx].cards.findIndex(k => k.id === cardId);
        const [card] = state.columns[colIdx].cards.splice(cardIdx, 1);
        state.columns[colIdx - 1].cards.push(card);
        saveState(state);
        render();
        showToast('⬅️ Tarefa retornou de etapa!');
        playTick(400, 0.2, 0.05, true);
      }
      return;
    }

    // ── Arquivar tarefa individual ──
    const arcBtn = e.target.closest('.card-btn.archive');
    if (arcBtn) {
      const cardId = arcBtn.dataset.card;
      const cardEl = arcBtn.closest('.card');
      const col = state.columns.find(c => c.cards.some(k => k.id === cardId));
      if (!col) return;
      
      cardEl.classList.add('card-exit');
      setTimeout(() => {
        if (typeof archiveCard === 'function') {
          archiveCard(col.id, cardId, state, render, stopPomodoro);
        }
        else showToast('📦 Tarefa arquivada');
      }, 280);
    }
  });

  async function initApp() {
    try {
      const tarefas = await window.API.fetchTarefas();
      const local = typeof loadState === 'function' ? loadState() : null;
      if (local) {
        state.title = local.title || state.title;
        state.emoji = local.emoji !== undefined ? local.emoji : state.emoji;
        state.profile = local.profile || state.profile;
      }
      state.columns = tarefasToColumns(tarefas);
      render();
    } catch (err) {
      console.warn('📶 Modo Offline: Carregando dados locais.');
      const local = typeof loadState === 'function' ? loadState() : null;
      if (local) Object.assign(state, local);
      else state.columns = tarefasToColumns([]);
      render();
      if (window.showToast) showToast('📴 Você está offline. Usando dados locais.', 5000);
    }
  }

  // Monitorar conexão em tempo real
  window.addEventListener('online', () => {
    document.getElementById('offlineIndicator').style.display = 'none';
    showToast('🌐 Conexão restaurada! Sincronizando...');
    initApp(); // Recarrega dados da API ao voltar online
  });
  window.addEventListener('offline', () => {
    document.getElementById('offlineIndicator').style.display = 'flex';
    showToast('📴 Você está offline.');
  });

  await initApp();


  startDashboardAutoRefresh(() => {
    if (showDashboard) renderDashboard(state, document.getElementById('dashboardSection'));
  });
});
