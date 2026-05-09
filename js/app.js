/**
 * MB FLOWBOARD — js/app.js
 * Orquestrador principal da aplicação
 */
'use strict';

/* ════════════════════════════════════════════
   ESTADO GLOBAL
════════════════════════════════════════════ */
let state = {
  title: 'Meu Quadro',
  emoji: '🚀',
  profile: { name: 'Usuário', color: '#6C63FF', focusTime: 25, breakTime: 5 },
  columns: [],
  archived: [],
  history: {}
};

let isTransitioning = false;
let dragColSrcId    = null;
let currentView     = 'board';
let showDashboard   = false;

const appFilters = {
  searchTerm: '', priority: 'all', tag: 'all', exactDateFilter: ''
};

/* ════════════════════════════════════════════
   CONVERSÃO API → COLUNAS
   Preserva estrutura local (IDs, ordem, cores)
   e recarrega apenas os cards da API
════════════════════════════════════════════ */
function tarefasToColumns(tarefas, existingColumns = []) {
  let columns;
  if (existingColumns && existingColumns.length > 0) {
    columns = existingColumns.map(col => ({ ...col, cards: [] }));
  } else {
    columns = [
      { id: uid(), title: 'A Fazer',      color: '#6C63FF', limit: 0, cards: [] },
      { id: uid(), title: 'Em Progresso', color: '#FFB347', limit: 0, cards: [] },
      { id: uid(), title: 'Revisão',      color: '#4FC3F7', limit: 0, cards: [] },
      { id: uid(), title: 'Concluído',    color: '#43D9AD', limit: 0, cards: [] }
    ];
  }
  (tarefas || []).forEach(t => {
    const col = columns.find(c => c.title === t.coluna);
    if (col) col.cards.push({
      id:             t.id,
      title:          t.titulo        || '',
      desc:           t.desc          || '',
      priority:       t.priority      || 'low',
      date:           t.date          || '',
      tags:           Array.isArray(t.tags)      ? t.tags      : [],
      checklist:      Array.isArray(t.checklist) ? t.checklist : [],
      totalFocusTime: t.totalFocusTime || 0,
      createdAt:      t.createdAt     || new Date().toISOString()
    });
  });
  return columns;
}

/* ════════════════════════════════════════════
   CARREGAMENTO INICIAL
════════════════════════════════════════════ */
async function loadInitialData() {
  const local = loadState();
  // Aplica metadados locais primeiro
  if (local) {
    state.title    = local.title    || 'Meu Quadro';
    state.emoji    = local.emoji    !== undefined ? local.emoji : '🚀';
    state.profile  = local.profile  || state.profile;
    state.archived = local.archived || [];
    state.history  = local.history  || {};
    state.lastView = local.lastView || 'board';
    showDashboard  = state.lastView === 'dashboard';
  }

  try {
    const tarefas = await window.API.fetchTarefas();

    // Usa as colunas já salvas localmente (preserva IDs e estrutura)
    // Se não existir, cria as colunas padrão
    const existingCols = (local?.columns?.length) ? local.columns : null;
    state.columns = tarefasToColumns(tarefas, existingCols);

    // Persiste estado completo no localStorage
    saveState(state, false);
    console.log('✅ API carregada:', tarefas.length, 'tarefas');
  } catch (err) {
    console.warn('📶 Offline — usando localStorage:', err.message);
    // Usa colunas do localStorage sem sobrescrever com dados da API
    if (local?.columns?.length) {
      state.columns = local.columns;
    } else {
      state.columns = tarefasToColumns([], null);
      saveState(state, false);
    }
    if (window.showToast) showToast('📴 Modo offline. Dados locais.', 4000);
  }
}

/* ════════════════════════════════════════════
   THEME ENGINE
════════════════════════════════════════════ */
const THEME_CONFIG = {
  'theme-dark': {
    '--accent': '#3B82F6', '--accent-light': '#60A5FA',
    '--bg-base': '#020617', '--bg-deep': '#0B1120',
    '--glass-bg': 'rgba(15,23,42,0.8)', '--glass-border': 'rgba(255,255,255,0.12)',
    '--glass-bg-hover': 'rgba(255,255,255,0.09)', '--text-primary': '#eeeaff',
    '--card-bg': 'rgba(10,20,50,0.92)'
  },
  'theme-light': {
    '--accent': '#2563eb', '--accent-light': '#3b82f6',
    '--bg-base': '#f8fafc', '--bg-deep': '#ffffff',
    '--glass-bg': 'rgba(255,255,255,0.9)', '--glass-border': 'rgba(0,0,0,0.1)',
    '--glass-bg-hover': 'rgba(0,0,0,0.03)', '--text-primary': '#0f172a',
    '--card-bg': '#ffffff'
  }
};
function applyTheme(themeName) {
  const vars = THEME_CONFIG[themeName] || THEME_CONFIG['theme-dark'];
  Object.entries(vars).forEach(([p, v]) => document.documentElement.style.setProperty(p, v));
  document.body.className = themeName;
  if (typeof saveTheme === 'function') saveTheme(themeName);
}

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

function startPomodoroBreak(minutes) {
  isPomodoroBreak = true;
  timeLeft = minutes * 60;
  const display = document.querySelector('.pomodoro-display');
  if (display) {
    display.style.background  = 'rgba(16,185,129,0.15)';
    display.style.borderColor = 'rgba(16,185,129,0.3)';
    display.style.color       = 'var(--accent3)';
  }
  document.getElementById('pomodoroContainer').style.display = 'block';
  updateTimerDisplay();
  pomodoroInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) { stopPomodoro(); startTabFlash(); playMelody('end'); showToast('⌛ Pausa finalizada!'); }
  }, 1000);
}

function startTabFlash() {
  if (tabFlashInterval) return;
  let isAlert = true;
  const orig = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  tabFlashInterval = setInterval(() => {
    document.title = isAlert ? '🚨 TEMPO ESGOTADO! 🚨' : orig;
    isAlert = !isAlert;
  }, 1000);
}
function stopTabFlash() {
  if (tabFlashInterval) { clearInterval(tabFlashInterval); tabFlashInterval = null; }
  document.title = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const prefix = isPomodoroBreak ? '☕ ' : '';
  const mStr = String(mins).padStart(2,'0');
  const sStr = String(secs).padStart(2,'0');
  document.getElementById('timerMinutes').textContent = mStr;
  document.getElementById('timerSeconds').textContent = sStr;
  const bm = document.getElementById('bigTimerMinutes');
  const bs = document.getElementById('bigTimerSeconds');
  if (bm) bm.textContent = mStr;
  if (bs) bs.textContent = sStr;
  const cy = document.getElementById('pomodoroCycles');
  if (cy) cy.textContent = Array.from({length:4},(_,i)=>i<completedPomodoros%4?'🟢':'⚪').join('');
  document.title = `(${prefix}${mStr}:${sStr}) ${state.title || 'MB - FlowBoard'}`;
}

function renderFocusView() {
  const sec = document.getElementById('focusModeSection');
  if (!activeFocusCardId) {
    sec.style.display = 'none';
    document.body.classList.remove('focus-mode-active');
    return;
  }
  const col  = state.columns.find(c => c.cards.some(k => k.id === activeFocusCardId));
  const card = col?.cards.find(k => k.id === activeFocusCardId);
  if (!card) return;
  document.body.classList.add('focus-mode-active');
  sec.style.display = 'flex';
  document.getElementById('focusTaskTitle').textContent = card.title;
  document.getElementById('focusTaskDesc').textContent  = card.desc || 'Foco total nesta tarefa.';
  const badge = document.getElementById('focusPrioBadge');
  badge.textContent = card.priority.toUpperCase();
  badge.className   = `card-due-badge prio-${card.priority}`;
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

function buildCardHTML(card, isDone, hasPrev, hasNext) {
  const ds = getDeadlineStatus(card.date, isDone);
  const isFocus = activeFocusCardId === card.id;
  let badge = '';
  if (ds === 'overdue')   badge = `<span class="card-due-badge overdue">🔴 Atrasada</span>`;
  if (ds === 'due-today') badge = `<span class="card-due-badge due-today">⚠️ Hoje</span>`;
  if (ds === 'due-soon')  badge = `<span class="card-due-badge due-soon">⏰ ${getDaysDiff(card.date)}d</span>`;
  const dateStr = card.date ? `<span class="card-date">📅 ${formatDate(card.date)}</span>` : '<span></span>';
  const total = (card.checklist||[]).length;
  const done  = (card.checklist||[]).filter(i=>i.completed).length;
  const chk   = total > 0 ? `<div class="card-checklist-progress"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${done}/${total}</div>` : '';
  const cls   = ['card', ds==='overdue'?'card-overdue':'', (ds==='due-soon'||ds==='due-today')?'card-due-soon':'', isFocus?'is-focusing':''].filter(Boolean).join(' ');
  return `<div class="${cls}" draggable="true" data-card-id="${card.id}" role="listitem" aria-label="${escapeHtml(card.title)}">
    <div class="card-priority-bar ${card.priority}" aria-hidden="true"></div>
    <div class="card-title">${escapeHtml(card.title)}</div>
    <div class="card-tags">${buildTagsHTML(card.tags)} ${badge}</div>
    ${chk}
    ${card.desc ? `<div class="card-desc">${escapeHtml(card.desc)}</div>` : ''}
    <div class="card-footer">${dateStr}
      <div class="card-actions">
        ${hasPrev ? `<button class="card-btn prev-col" data-card="${card.id}" title="Anterior"><i data-lucide="chevron-left" size="14"></i></button>` : ''}
        <button class="card-btn edit"    data-card="${card.id}" title="Editar"><i data-lucide="pencil" size="14"></i></button>
        <button class="card-btn focus"   data-card="${card.id}" title="Foco"><i data-lucide="play" size="14"></i></button>
        <button class="card-btn archive" data-card="${card.id}" title="Arquivar"><i data-lucide="archive" size="14"></i></button>
        <button class="card-btn delete"  data-card="${card.id}" title="Excluir"><i data-lucide="trash-2" size="14"></i></button>
        ${hasNext ? `<button class="card-btn next-col" data-card="${card.id}" title="Próximo"><i data-lucide="chevron-right" size="14"></i></button>` : ''}
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════════
   BUILD COLUNA
════════════════════════════════════════════ */
function buildColumn(col, isDone, hasPrev, hasNext) {
  const exceeded = col.limit > 0 && col.cards.length > col.limit;
  const progress = col.limit > 0 ? Math.min((col.cards.length/col.limit)*100,100) : 0;
  const el = document.createElement('div');
  el.className    = `column ${exceeded ? 'limit-exceeded' : ''}`;
  el.dataset.colId = col.id;
  el.setAttribute('role','listitem');
  const emptyHTML = col.cards.length === 0 ? `<div class="column-empty-state"><span class="empty-icon">📁</span><p>Nenhuma tarefa criada ainda</p><button class="btn-empty-create" data-col="${col.id}">+ Criar primeira tarefa</button></div>` : '';
  el.innerHTML = `
    <div class="column-header" data-col-id="${col.id}">
      <div class="column-drag-handle" draggable="true" title="Arrastar coluna"><i data-lucide="grip-vertical" size="16"></i></div>
      <div class="column-title-wrap">
        <span class="column-title">${escapeHtml(col.title)}</span>
        <span class="column-count">${col.cards.length}${col.limit>0?' / '+col.limit:''}</span>
      </div>
      <div class="column-actions">
        <button class="col-btn edit"   data-col="${col.id}" title="Editar"><i data-lucide="pencil" size="14"></i></button>
        <button class="col-btn delete" data-col="${col.id}" title="Excluir"><i data-lucide="trash-2" size="14"></i></button>
      </div>
      <div class="column-header-accent" style="background:${col.color}"></div>
    </div>
    ${col.limit>0 ? `<div class="column-progress-container"><div class="column-progress-bar" style="width:${progress}%;background:${exceeded?'var(--accent2)':col.color}"></div></div>` : ''}
    <div class="cards-area" data-col-id="${col.id}" role="list">
      ${col.cards.map(c => buildCardHTML(c, isDone, hasPrev, hasNext)).join('')}
      ${emptyHTML}
    </div>
    <button class="add-card-btn" data-col="${col.id}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Adicionar tarefa
    </button>`;
  initDragDropArea(el.querySelector('.cards-area'), state, render);
  const handle = el.querySelector('.column-drag-handle');
  if (handle) {
    handle.addEventListener('dragstart', e => { e.stopPropagation(); dragColSrcId = col.id; el.classList.add('col-dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', col.id); playTick(300,0.1,0.03); });
    handle.addEventListener('dragend',   () => { el.classList.remove('col-dragging'); document.querySelectorAll('.column').forEach(c=>c.classList.remove('col-drag-over')); dragColSrcId = null; });
  }
  el.addEventListener('dragover', e => { if (!dragColSrcId||dragColSrcId===col.id) return; e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.column').forEach(c=>c.classList.remove('col-drag-over')); el.classList.add('col-drag-over'); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('col-drag-over'); });
  el.addEventListener('drop', e => {
    if (!dragColSrcId||dragColSrcId===col.id) return;
    e.preventDefault(); e.stopPropagation(); el.classList.remove('col-drag-over');
    const si = state.columns.findIndex(c=>c.id===dragColSrcId);
    const ti = state.columns.findIndex(c=>c.id===col.id);
    if (si<0||ti<0) return;
    const [m] = state.columns.splice(si,1); state.columns.splice(ti,0,m);
    dragColSrcId = null; saveState(state); render(); showToast('↔️ Coluna reordenada!'); playTick(380,0.3,0.06,true);
  });
  el.querySelector('.col-btn.edit').addEventListener('click', () => openColumnModal(col.id, state));
  el.querySelector('.col-btn.delete').addEventListener('click', () => {
    const msg = col.cards.length > 0 ? `Excluir a coluna "${col.title}" e ${col.cards.length} tarefa(s)?` : `Excluir a coluna "${col.title}"?`;
    openConfirm(msg, () => { state.columns = state.columns.filter(c=>c.id!==col.id); saveState(state); render(); showToast('🗑️ Coluna excluída.'); });
  });
  el.querySelector('.add-card-btn').addEventListener('click', () => openCardModal(col.id, null, state));
  const emptyBtn = el.querySelector('.btn-empty-create');
  if (emptyBtn) emptyBtn.addEventListener('click', () => openCardModal(col.id, null, state));
  return el;
}

/* ════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════ */
function render() {
  if (isTransitioning) return;
  const board = document.getElementById('board');
  const dash  = document.getElementById('dashboardSection');
  if (showDashboard) {
    board.style.display = 'none';
    dash.style.display  = 'grid';
    requestAnimationFrame(() => renderDashboard(state, dash));
  } else {
    dash.style.display  = 'none';
    board.style.display = currentView === 'list' ? 'block' : 'flex';
  }
  if (activeFocusCardId && !showDashboard) { renderFocusView(); board.style.display = 'none'; return; }
  else if (!activeFocusCardId) {
    document.body.classList.remove('focus-mode-active');
    const fs = document.getElementById('focusModeSection');
    if (fs) fs.style.display = 'none';
  }
  board.className = currentView === 'list' ? 'board view-list' : 'board';
  if (!showDashboard) board.innerHTML = '';
  const et = document.getElementById('boardEmojiText');
  const td = document.getElementById('boardTitleDisplay');
  if (et) et.textContent = state.emoji || '';
  if (td) td.textContent = state.title || 'Meu Quadro';
  updateAvatarDisplay(state.profile);
  const doneCol   = state.columns.find(c => c.title.toLowerCase().includes('concluíd') || c.title.toLowerCase().includes('done'));
  const ctr       = document.getElementById('completedCounter');
  if (ctr) ctr.innerHTML = `<i data-lucide="check-circle-2"></i> ${doneCol ? doneCol.cards.length : 0}`;
  if (state.columns.length === 0) {
    board.innerHTML = `<div class="empty-board"><i data-lucide="layout-template" size="64" style="opacity:0.2;margin-bottom:16px"></i><h3>Nenhuma coluna ainda</h3><p>Clique em <strong>+ Coluna</strong> no topo.</p></div>`;
    return;
  }
  const pw = { high:3, medium:2, low:1 };
  state.columns.forEach((col, idx) => {
    const isDone = col.title.toLowerCase().includes('concluíd') || col.title.toLowerCase().includes('done');
    let cards = col.cards.filter(c => cardMatchesFilters(c, appFilters, isDone));
    cards.sort((a,b) => (pw[b.priority]||0) - (pw[a.priority]||0));
    board.appendChild(buildColumn({...col, cards}, isDone, idx>0, idx<state.columns.length-1));
  });
  lucide.createIcons();
}

/* ════════════════════════════════════════════
   TÍTULO INLINE
════════════════════════════════════════════ */
function activateTitleEdit() {
  const span = document.getElementById('boardTitleDisplay');
  const input = document.createElement('input');
  input.type = 'text'; input.value = state.title || 'Meu Quadro';
  input.className = 'board-title-input'; input.maxLength = 30;
  span.replaceWith(input); input.focus(); input.select();
  let saved = false;
  const save = () => { if (saved) return; saved=true; state.title = input.value.trim()||'Meu Quadro'; saveState(state); render(); showToast('✏️ Título atualizado!'); };
  const cancel = () => { if (saved) return; saved=true; render(); };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key==='Enter')  { input.removeEventListener('blur',save); save(); }
    if (e.key==='Escape') { input.removeEventListener('blur',save); cancel(); }
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
    btn.className = 'emoji-item'; btn.textContent = emoji;
    btn.addEventListener('click', () => { state.emoji = emoji; saveState(state); render(); showToast(`Emoji ${emoji}! ✨`); closeModal('emojiModal'); });
    grid.appendChild(btn);
  });
  openModal('emojiModal');
}

/* ════════════════════════════════════════════
   MODAL ARQUIVO
════════════════════════════════════════════ */
function openArchiveModal() {
  const list = document.getElementById('archiveList');
  const btn  = document.getElementById('clearArchiveBtn');
  list.innerHTML = '';
  if (!state.archived.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma tarefa arquivada.</p>';
    if (btn) btn.style.display = 'none';
  } else {
    if (btn) btn.style.display = 'block';
    state.archived.forEach(card => {
      const item = document.createElement('div');
      item.className = 'archive-item';
      item.innerHTML = `<div class="archive-item-info"><h4>${escapeHtml(card.title)}</h4><p>${card.desc?escapeHtml(card.desc).slice(0,40)+'...':'Sem descrição'}</p><span class="archive-item-date">Arquivado em: ${formatFullDate(card.archivedAt)}</span></div><div class="archive-item-actions"><button class="btn-icon btn-ghost btn-restore" data-id="${card.id}" title="Restaurar">⬆️</button><button class="btn-icon btn-ghost btn-danger-hover btn-del-archive" data-id="${card.id}" title="Excluir">🗑️</button></div>`;
      item.querySelector('.btn-restore').addEventListener('click', () => {
        const i = state.archived.findIndex(c=>c.id===card.id);
        if (i<0) return;
        const [r] = state.archived.splice(i,1);
        if (state.columns.length) state.columns[0].cards.push(r);
        saveState(state); render(); openArchiveModal(); showToast('♻️ Tarefa restaurada!');
      });
      item.querySelector('.btn-del-archive').addEventListener('click', () => {
        openConfirm('Excluir permanentemente?', () => { state.archived = state.archived.filter(c=>c.id!==card.id); saveState(state); openArchiveModal(); showToast('🗑️ Excluída.'); });
      });
      list.appendChild(item);
    });
  }
  openModal('archiveModal');
}

function openModal(id)  { const el=document.getElementById(id); if(el) el.classList.add('open'); }
function closeModal(id) { const el=document.getElementById(id); if(el) el.classList.remove('open'); }

/* ════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  applyTheme(loadTheme());

  // Tema
  const themeBtn  = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const novo = document.body.classList.contains('theme-light') ? 'theme-dark' : 'theme-light';
    applyTheme(novo);
    showToast(novo==='theme-light'?'☀️ Modo claro':'🌙 Modo escuro');
  });

  initFilters(state, appFilters, render);
  initShortcuts(state, render, openCardModal, saveState, undo, redo);
  initTasksEvents(state, render, cardId => { if(activeFocusCardId===cardId) stopPomodoro(); });

  document.getElementById('userProfileTrigger').addEventListener('click', () => openProfileModal(state));
  document.getElementById('saveProfileBtn').addEventListener('click',     () => saveProfile(state));
  document.getElementById('closeProfileModal').addEventListener('click',  () => closeModal('profileModal'));

  document.getElementById('toggleDashboardBtn').addEventListener('click', () => {
    showDashboard = !showDashboard;
    state.lastView = showDashboard ? 'dashboard' : 'board';
    saveState(state);
    if (showDashboard) renderDashboard(state, document.getElementById('dashboardSection'));
    render();
  });

  document.getElementById('boardEmojiText').addEventListener('click', openEmojiModal);
  document.getElementById('closeEmojiModal').addEventListener('click', () => closeModal('emojiModal'));
  document.getElementById('clearEmojiBtn').addEventListener('click', () => { state.emoji=''; saveState(state); render(); showToast('Emoji removido!'); closeModal('emojiModal'); });

  document.getElementById('boardTitleDisplay').addEventListener('click', activateTitleEdit);
  document.getElementById('boardTitleDisplay').addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();activateTitleEdit();} });

  document.getElementById('toggleViewBtn').addEventListener('click', () => { currentView=currentView==='board'?'list':'board'; render(); showToast(currentView==='list'?'📋 Vista em lista':'📊 Vista em quadro'); });

  document.getElementById('openArchiveBtn').addEventListener('click', openArchiveModal);
  document.getElementById('closeArchiveModal').addEventListener('click', () => closeModal('archiveModal'));
  document.getElementById('clearArchiveBtn').addEventListener('click', () => { if(!state.archived.length) return; openConfirm('Excluir todas as tarefas arquivadas?', () => { state.archived=[]; saveState(state); openArchiveModal(); showToast('🧹 Arquivo limpo!'); }); });

  document.getElementById('clearBoardBtn').addEventListener('click', () => openConfirm('Limpar todo o quadro?', () => { state.columns=[]; saveState(state); render(); showToast('🧹 Quadro limpo!'); }));

  document.getElementById('exportBoardBtn').addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `mb-flowboard-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast('💾 Backup exportado!');
    } catch { showToast('❌ Erro ao exportar.'); }
  });

  document.getElementById('printBoardBtn').addEventListener('click', () => { showToast('🖨️ Preparando...'); setTimeout(()=>window.print(),300); });

  document.getElementById('moreActionsBtn').addEventListener('click', e => { e.stopPropagation(); document.getElementById('moreDropdown').classList.toggle('open'); });
  window.addEventListener('click', () => document.getElementById('moreDropdown').classList.remove('open'));

  document.getElementById('stopTimerBtn').addEventListener('click', stopPomodoro);
  document.getElementById('quitFocusBtn').addEventListener('click', stopPomodoro);

  // Indicador offline
  window.addEventListener('online',  () => { const ind=document.getElementById('offlineIndicator'); if(ind) ind.style.display='none';  showToast('🌐 Conexão restaurada!'); loadInitialData().then(render); });
  window.addEventListener('offline', () => { const ind=document.getElementById('offlineIndicator'); if(ind) ind.style.display='flex'; showToast('📴 Sem conexão.'); });

  // Eventos do board (delegação)
  document.getElementById('board').addEventListener('click', async e => {
    // Foco/Pomodoro
    const focBtn = e.target.closest('.card-btn.focus');
    if (focBtn) { togglePomodoro(focBtn.dataset.card); return; }

    // Editar
    const editBtn = e.target.closest('.card-btn.edit');
    if (editBtn) {
      const col = state.columns.find(c => c.cards.some(k => k.id === editBtn.dataset.card));
      if (col) openCardModal(col.id, editBtn.dataset.card, state);
      return;
    }

    // ── Excluir tarefa ──
    const delBtn = e.target.closest('.card-btn.delete');
    if (delBtn) {
      const cardId = delBtn.dataset.card;
      const col    = state.columns.find(c => c.cards.some(k => k.id === cardId));
      const card   = col?.cards.find(k => k.id === cardId);
      if (!col || !card) return;

      openConfirm(`Excluir "${card.title}"?`, () => {
        const ki = col.cards.findIndex(k => k.id === cardId);
        col.cards.splice(ki, 1);
        if (activeFocusCardId === cardId) stopPomodoro();
        saveState(state, false);
        render();
        // Enfileira DELETE na outbox — garante sync mesmo se servidor hibernar
        window.Sync.enqueue({ method: 'DELETE', id: cardId });
        showToast('🗑️ Tarefa excluída!');
      });
      return;
    }

    // Mover próxima coluna
    const nextBtn = e.target.closest('.card-btn.next-col');
    if (nextBtn) {
      const cardId = nextBtn.dataset.card;
      const ci = state.columns.findIndex(c => c.cards.some(k => k.id === cardId));
      if (ci >= 0 && ci < state.columns.length - 1) {
        const destColTitle = state.columns[ci + 1].title;
        const ki = state.columns[ci].cards.findIndex(k => k.id === cardId);
        const [card] = state.columns[ci].cards.splice(ki, 1);
        state.columns[ci + 1].cards.push(card);
        saveState(state, false);
        render();
        window.Sync.enqueue({ method: 'PUT', id: cardId, payload: {
          titulo: card.title, coluna: destColTitle,
          desc: card.desc || '', date: card.date || '',
          tags: Array.isArray(card.tags) ? card.tags : [],
          priority: card.priority || 'low',
          checklist: Array.isArray(card.checklist) ? card.checklist : []
        }});
        showToast('➡️ Avançou para ' + destColTitle + '!');
      }
      return;
    }

    // Mover coluna anterior
    const prevBtn = e.target.closest('.card-btn.prev-col');
    if (prevBtn) {
      const cardId = prevBtn.dataset.card;
      const ci = state.columns.findIndex(c => c.cards.some(k => k.id === cardId));
      if (ci > 0) {
        const destColTitle = state.columns[ci - 1].title;
        const ki = state.columns[ci].cards.findIndex(k => k.id === cardId);
        const [card] = state.columns[ci].cards.splice(ki, 1);
        state.columns[ci - 1].cards.push(card);
        saveState(state, false);
        render();
        window.Sync.enqueue({ method: 'PUT', id: cardId, payload: {
          titulo: card.title, coluna: destColTitle,
          desc: card.desc || '', date: card.date || '',
          tags: Array.isArray(card.tags) ? card.tags : [],
          priority: card.priority || 'low',
          checklist: Array.isArray(card.checklist) ? card.checklist : []
        }});
        showToast('⬅️ Voltou para ' + destColTitle + '!');
      }
      return;
    }

    // Arquivar
    const arcBtn = e.target.closest('.card-btn.archive');
    if (arcBtn) {
      const cardId = arcBtn.dataset.card;
      const cardEl = arcBtn.closest('.card');
      const col = state.columns.find(c => c.cards.some(k => k.id === cardId));
      if (!col) return;
      cardEl.classList.add('card-exit');
      setTimeout(() => archiveCard(col.id, cardId, state, render, stopPomodoro), 280);
    }
  });

  // Carrega dados e renderiza
  await loadInitialData();
  render();

  // Registra callback para recarregar após sync bem-sucedido
  window._reloadAfterSync = async () => {
    await loadInitialData();
    render();
  };

  // Processa operações pendentes (outbox) após carregar
  setTimeout(() => window.Sync.processOutbox(), 1500);

  startDashboardAutoRefresh(() => { if (showDashboard) renderDashboard(state, document.getElementById('dashboardSection')); });
});
