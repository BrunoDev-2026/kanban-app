/**
 * KanFlow — script.js v2.0
 *
 * ATENÇÃO: Este arquivo foi modificado para usar Firebase Firestore
 * como backend de persistência, substituindo a API Node/Express/MongoDB.
 *
 * Aplicação Kanban completa com Drag & Drop nativo
 * Persistência via localStorage | Sem frameworks
 *
 * Estrutura de dados:
 * state = {
 *   title: string,
 *   columns: [
 *     { id, title, color, cards: [ { id, title, desc, priority, date } ] }
 *   ]
 *   profile: { name, color }
 * }
 */

'use strict';

/* ════════════════════════════════════════════
   UTILIDADES
════════════════════════════════════════════ */

/** Gera ID único baseado em timestamp + random */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Escapa HTML para evitar XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/** Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY */
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/** Formata data completa para o arquivo */
function formatFullDate(isoStr) {
  if (!isoStr) return 'Data desconhecida';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Retorna a data de hoje no formato ISO YYYY-MM-DD */
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/** 
 * Calcula a diferença em dias entre hoje e uma data alvo
 * @param {string} dateStr - Data no formato YYYY-MM-DD
 * @returns {number|null} Diferença em dias
 */
function getDaysDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date(getTodayISO() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Determina o status de prazo de uma tarefa
 * @param {string} dateStr - Data alvo
 * @param {boolean} isDone - Se a tarefa já está concluída
 * @returns {'overdue'|'due-today'|'due-soon'|'none'}
 */
function getDeadlineStatus(dateStr, isDone) {
  if (!dateStr || isDone) return 'none';
  const diff = getDaysDiff(dateStr);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  if (diff <= 2) return 'due-soon';
  return 'none';
}

/** Exibe toast com mensagem */
function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/** Feedback sonoro sutil (Web Audio API) */
let audioCtx = null;
function playTick(freq = 250, duration = 0.1, vol = 0.04, hasEcho = false, type = 'sine') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    if (hasEcho) {
      const delay = audioCtx.createDelay();
      const feedback = audioCtx.createGain();
      
      delay.delayTime.value = 0.15; // Tempo do eco
      feedback.gain.value = 0.3;    // Intensidade da repetição
      
      gain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(audioCtx.destination);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* Silencia se houver bloqueio de áudio pelo navegador */ }
}

function showShortcutHUD(msg) {
  const hud = document.createElement('div');
  hud.className = 'shortcut-hud';
  hud.textContent = `Atalho: ${msg}`;
  document.body.appendChild(hud);
  setTimeout(() => hud.remove(), 1500);
}

function playMelody(type = 'start') {
  if (type === 'start') {
    playTick(440, 0.1, 0.05);
    setTimeout(() => playTick(880, 0.1, 0.04), 100);
  } else {
    playTick(660, 0.2, 0.05, true);
    setTimeout(() => playTick(440, 0.3, 0.04, true), 200);
  }
}

/** Gera uma cor determinística baseada no texto da tag */
function getTagColor(text) {
  const colors = ['#2563EB', '#3B82F6', '#43D9AD', '#FFB347', '#4FC3F7', '#60A5FA', '#0ea5e9'];
  let hash = 0;
  const normalized = text.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ════════════════════════════════════════════
   ESTADO PADRÃO
════════════════════════════════════════════ */
function buildDefaultState() {
  return {
    title: 'Meu Quadro',
    profile: { name: 'Usuário', color: '#2563EB' },
    columns: [
      {
        id: uid(),
        title: 'A Fazer',
        color: '#2563EB',
        limit: 0,
        cards: [
          { id: uid(), title: 'Criar wireframe do projeto', desc: 'Esboçar as telas principais antes de começar o código.', priority: 'high',   date: '', tags: ['Design', 'UI'] },
          { id: uid(), title: 'Configurar repositório Git',  desc: '',                                                                priority: 'medium', date: '', tags: ['DevOps'] }
        ]
      },
      {
        id: uid(),
        title: 'Em Progresso',
        color: '#FFB347',
        limit: 3,
        cards: [
          { id: uid(), title: 'Desenvolver página inicial', desc: 'Componente Hero + Navbar responsivo.', priority: 'high', date: '' }
        ]
      },
      {
        id: uid(),
        title: 'Revisão',
        color: '#4FC3F7',
        limit: 0,
        cards: []
      },
      {
        id: uid(),
        title: 'Concluído',
        color: '#43D9AD',
        limit: 0,
        cards: [
          { id: uid(), title: 'Definir tecnologias do projeto', desc: 'HTML, CSS, JS vanilla — simples e eficaz.', priority: 'low', date: '' }
        ]
      },
    ],
    archived: []
  };
}

/* ════════════════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════════════════ */
function loadState() {
  try {
    const raw = localStorage.getItem('kanflow_state');
    if (!raw) return buildDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.columns)) return buildDefaultState();
    // Garante campos obrigatórios nos cards
    parsed.columns = parsed.columns.map(col => ({
      id:    col.id    || uid(),
      title: col.title || 'Coluna',
      color: col.color || '#6C63FF',
      limit: parseInt(col.limit) || 0,
      cards: Array.isArray(col.cards) ? col.cards.map(card => ({
        id:       card.id       || uid(),
        title:    card.title    || '',
        desc:     card.desc     || '',
        priority: card.priority || 'low',
        date:     card.date     || '',
        tags:     Array.isArray(card.tags) ? card.tags : [],
        checklist: Array.isArray(card.checklist) ? card.checklist : [],
        totalFocusTime: card.totalFocusTime || 0
      })) : []
    }));
    parsed.archived = Array.isArray(parsed.archived) ? parsed.archived : [];
    parsed.history = parsed.history || {};
    if (!parsed.profile) parsed.profile = { name: 'Usuário', color: '#6C63FF' };
    return parsed;
  } catch {
    return buildDefaultState();
  }
}

/**
 * Salva o estado LOCAL (não relacionado a tarefas) no localStorage.
 * Tarefas são gerenciadas pela API.
 */
function saveLocalState() {
  try {
    const localState = {
      title: state.title,
      profile: state.profile,
      archived: state.archived,
      history: state.history,
      // Não salva cards aqui, pois são gerenciados pela API
      columns: state.columns.map(col => ({
        id: col.id, title: col.title, color: col.color, limit: col.limit, cards: []
      }))
    };
    localStorage.setItem('kanflow_state', JSON.stringify(localState));
  } catch (e) {
    showToast('⚠️ Erro ao salvar. Armazenamento cheio?');
  }
}
/* ════════════════════════════════════════════
   ESTADO GLOBAL
════════════════════════════════════════════ */
const API_URL = "https://kanban-api-oozq.onrender.com/tarefas";
const API_KEY = "minha-chave-secreta-2026";

// =========================
// API (Node/Express) - Conexão com Fly.dev
// =========================

function apiUrlForId(id) {
  return `${API_URL}/${id}`;
}

/**
 * Processa a resposta da API de forma centralizada.
 */
async function handleApiResponse(res) {
  setLoading(false);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.erro || `Erro: ${res.status}`);
  }
  return res.json();
}

async function apiGetTarefas() {
  setLoading(true);
  const res = await fetch(API_URL);
  return handleApiResponse(res);
}

async function apiCreateTarefa({ titulo, coluna }) {
  setLoading(true);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, coluna })
  });
  return handleApiResponse(res);
}

async function apiUpdateTarefa({ id, titulo, coluna }) {
  setLoading(true);
  const res = await fetch(apiUrlForId(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, coluna })
  });
  return handleApiResponse(res);
}

async function apiDeleteTarefa(id) {
  setLoading(true);
  const res = await fetch(apiUrlForId(id), {
    method: 'DELETE'
  });
  return handleApiResponse(res);
}

/**
 * Controla o estado visual de carregamento
 */
function setLoading(isLoading) {
  let spinner = document.getElementById('api-spinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.id = 'api-spinner';
    spinner.innerHTML = '<div class="spinner-dot"></div>';
    document.body.appendChild(spinner);
  }
  
  if (isLoading) {
    spinner.classList.add('active');
  } else {
    spinner.classList.remove('active');
  }
}

async function firebaseGetTarefas() {
  setLoading(true);
  try {
    const tarefasCol = collection(db, "tarefas");
    const tarefaSnapshot = await getDocs(tarefasCol);
    const tarefasList = tarefaSnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    return tarefasList;
  } catch (error) {
    console.error("Erro ao buscar tarefas do Firebase:", error);
    showToast(`❌ Erro ao carregar tarefas: ${error.message}`);
    throw error;
  } finally {
    setLoading(false);
  }
}

async function firebaseCreateTarefa({ titulo, coluna }) {
  setLoading(true);
  try {
    const docRef = await addDoc(collection(db, "tarefas"), {
      titulo,
      coluna,
      descricao: '', // Default values
      prioridade: 'low',
      data: '',
      tags: [],
      checklist: [],
      totalFocusTime: 0,
      createdAt: new Date().toISOString()
    });
    showToast('🎉 Tarefa criada no Firebase!');
    return { _id: docRef.id, titulo, coluna }; // Return minimal data for UI update
  } catch (error) {
    console.error("Erro ao criar tarefa no Firebase:", error);
    showToast(`❌ Erro ao criar tarefa: ${error.message}`);
    throw error;
  } finally {
    setLoading(false);
  }
}

async function firebaseUpdateTarefa({ id, titulo, coluna, desc, date, priority, tags, checklist, totalFocusTime }) {
  setLoading(true);
  try {
    const tarefaRef = doc(db, "tarefas", id);
    const updateData = { titulo, coluna };
    if (desc !== undefined) updateData.descricao = desc;
    if (date !== undefined) updateData.data = date;
    if (priority !== undefined) updateData.prioridade = priority;
    if (tags !== undefined) updateData.tags = tags;
    if (checklist !== undefined) updateData.checklist = checklist;
    if (totalFocusTime !== undefined) updateData.totalFocusTime = totalFocusTime;

    await updateDoc(tarefaRef, updateData);
    showToast('✅ Tarefa atualizada no Firebase!');
    return { _id: id, ...updateData };
  } catch (error) {
    console.error("Erro ao atualizar tarefa no Firebase:", error);
    showToast(`❌ Erro ao atualizar tarefa: ${error.message}`);
    throw error;
  } finally {
    setLoading(false);
  }
}

async function firebaseDeleteTarefa(id) {
  setLoading(true);
  try {
    await deleteDoc(doc(db, "tarefas", id));
    showToast('🗑️ Tarefa excluída do Firebase!');
    return { mensagem: 'Tarefa excluída com sucesso' };
  } catch (error) {
    console.error("Erro ao excluir tarefa no Firebase:", error);
    showToast(`❌ Erro ao excluir tarefa: ${error.message}`);
    throw error;
  } finally {
    setLoading(false);
  }
}

function uiColumnTitleToBackendColuna(title) {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('a fazer')) return 'fazer';
  if (t.includes('em progresso')) return 'andamento';
  if (t.includes('revis')) return 'revisao';
  if (t.includes('concl')) return 'feito';
  return 'fazer';
}

function backendColunaToUIColumnTitle(coluna) {
  const c = (coluna || '').toLowerCase().trim();
  if (c === 'fazer') return 'A Fazer';
  if (c === 'andamento') return 'Em Progresso';
  if (c === 'revisao') return 'Revisão';
  if (c === 'feito') return 'Concluído';
  return 'A Fazer';
}

async function initBoardFromAPI() {
  try {
    const tarefas = await apiGetTarefas(); // Já usa apiGetTarefas
    if (!Array.isArray(tarefas)) return;

    // limpa cards, mas mantém colunas/profile/tema do localStorage
    state.columns.forEach(col => { col.cards = []; });
    state.archived = [];

    tarefas.forEach(tarefa => {
      const titulo = tarefa.titulo;
      const coluna = tarefa.coluna;
      const id = tarefa._id ? String(tarefa._id) : String(tarefa.id || '');

      if (!titulo || !coluna || !id) return;

      const targetTitle = backendColunaToUIColumnTitle(coluna);
      let col = state.columns.find(c => c.title === targetTitle);
      if (!col) {
        col = state.columns[0];
      }

      col.cards.push({
        id,
        title: tarefa.titulo,
        desc: tarefa.descricao || '',
        priority: tarefa.prioridade || 'low',
        date: tarefa.data || '',
        tags: tarefa.tags || [],
        checklist: tarefa.checklist || [],
        totalFocusTime: tarefa.totalFocusTime || 0
      });
    });

    saveState();
    render();
  } catch (e) {
    console.warn('API init failed, falling back to localStorage state:', e);
    // mantém state atual (carregado do localStorage) e renderiza (fallback)
    render();
  }
}

let state = loadState();


// Drag & Drop
let dragCardId = null;
let dragColId  = null;
let ghostEl    = null;

// Modais
let editingColId     = null;
let editingCardId    = null;
let editingCardColId = null;
let selectedColor    = '#6C63FF';
let selectedPriority = 'low';
let confirmCallback  = null;

// Pomodoro State
let activeFocusCardId = null;
let pomodoroInterval  = null;
let tabFlashInterval  = null;
let timeLeft          = 0;

let currentView = 'board';
let showDashboard = false;
let searchTerm = '';
let activePriorityFilter = 'all';

const EMOJI_LIST = [
  '🚀','💡','🌟','✨','✅','🎉','📝','📌','🗓️','📊','💻','📱','💬','⚠️',
  '🔄','➕','📚','📁','🔗','🗑️','🌎','☀️','🌈','🔥','💖','🤔','⏳','⏰',
  '📆','📈','📉','🛠️','🔒','🔔','📢','🎁','🎓','💼','🏡','🚗','✈️','⛵',
  '🍕','☕','💪','🧠','👀','🎤','🎧','🎸','🎮','🎥','🎨','🎵','❤️','🧡',
  '💛','💚','💙','💜','🖤','🤍','🤎','🌙','⭐','🏆','🦄','🐱','🐶','🍀'
];

/* ════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════ */
function render() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  // Aplica classe de visualização
  board.className = currentView === 'list' ? 'board view-list' : 'board';

  const titleDisplay = document.getElementById('boardTitleDisplay');
  if (titleDisplay) titleDisplay.textContent = state.title || 'Meu Quadro';

  // Perfil e Avatar
  const avatar = document.getElementById('headerAvatar');
  const initials = state.profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  avatar.textContent = initials || '??';
  avatar.style.backgroundColor = state.profile.color;

  // Dashboard
  const dash = document.getElementById('dashboardSection');
  dash.style.display = showDashboard ? 'grid' : 'none';
  if (showDashboard) {
    const metrics = calculateMetrics();
    const focusHours = (metrics.totalFocus / 3600).toFixed(1);

    dash.innerHTML = `
      <div class="metric-card">
        <span class="metric-value">${metrics.total}</span>
        <span class="metric-label">Total Criadas</span>
      </div>
      <div class="metric-card">
        <span class="metric-value" style="color:var(--accent3)">${metrics.completed}</span>
        <span class="metric-label">Concluídas</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">${metrics.productivity}%</span>
        <span class="metric-label">Produtividade Semanal</span>
        <div class="progress-mini"><div class="progress-mini-fill" style="width:${metrics.productivity}%"></div></div>
      </div>
    `;
  }

  // Atualiza contador de concluídas
  const doneCol = state.columns.find(c => c.title.toLowerCase().includes('concluíd') || c.title.toLowerCase().includes('done'));
  const doneCount = doneCol ? doneCol.cards.length : 0;
  const counter = document.getElementById('completedCounter');
  if (counter) counter.textContent = `✅ ${doneCount}`;

  // Board vazio
  if (state.columns.length === 0) {
    board.innerHTML = `
      <div class="empty-board">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="4"  y="8" width="18" height="48" rx="4" fill="currentColor"/>
          <rect x="27" y="8" width="18" height="32" rx="4" fill="currentColor"/>
          <rect x="50" y="8" width="10" height="48" rx="4" fill="currentColor" opacity=".35"/>
        </svg>
        <h3>Nenhuma coluna ainda</h3>
        <p>Clique em <strong>+ Coluna</strong> no topo para começar seu quadro.</p>
      </div>`;
    return;
  }

  state.columns.forEach(col => {
    // Aplica filtros de busca e prioridade
    const filteredCards = col.cards.filter(card => {
      const matchesSearch = card.title.toLowerCase().includes(searchTerm) || 
                            card.desc.toLowerCase().includes(searchTerm) ||
                            (card.tags || []).some(t => t.toLowerCase().includes(searchTerm));
      const matchesPriority = activePriorityFilter === 'all' || 
                              card.priority === activePriorityFilter;
      return matchesSearch && matchesPriority;
    });

    const colWithFilteredCards = { ...col, cards: filteredCards };
    board.appendChild(buildColumn(colWithFilteredCards));
  });
}

function calculateMetrics() {
  const allCards = state.columns.reduce((acc, col) => acc.concat(col.cards), []).concat(state.archived);
  const total = allCards.length;
  const doneCol = state.columns.find(c => c.title.toLowerCase().includes('concluíd'));
  const completed = doneCol ? doneCol.cards.length : 0;
  const totalFocus = allCards.reduce((acc, c) => acc + (c.totalFocusTime || 0), 0);
  
  const today = new Date().toISOString().split('T')[0];
  const delayed = allCards.filter(c => c.date && c.date < today && !state.columns.find(col => col.cards.includes(c) && col.title.toLowerCase().includes('concluíd'))).length;

  const prod = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, delayed, productivity: prod, totalFocus };
}

/* ════════════════════════════════════════════
   BUILD COLUNA
════════════════════════════════════════════ */
function buildColumn(col) {
  const isExceeded = col.limit > 0 && col.cards.length > col.limit;
  const progress = col.limit > 0 ? Math.min((col.cards.length / col.limit) * 100, 100) : 0;
  
  const el = document.createElement('div');
  el.className = `column ${isExceeded ? 'limit-exceeded' : ''}`;
  el.dataset.colId = col.id;
  el.setAttribute('role', 'listitem');

  el.innerHTML = `
    <div class="column-header">
      <div class="column-title-wrap">
        <span class="column-title" style="color: ${col.color}">${escapeHtml(col.title)}</span>
        <span class="column-count" aria-label="${col.cards.length} tarefas">
          ${col.cards.length}${col.limit > 0 ? ' / ' + col.limit : ''}
        </span>
      </div>
      <div class="column-actions">
        <button class="col-btn edit" data-col="${col.id}" title="Editar coluna" aria-label="Editar coluna ${escapeHtml(col.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="col-btn delete" data-col="${col.id}" title="Excluir coluna" aria-label="Excluir coluna ${escapeHtml(col.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
      <div class="column-header-accent" style="background:${col.color}" aria-hidden="true"></div>
    </div>
    ${col.limit > 0 ? `
      <div class="column-progress-container">
        <div class="column-progress-bar" style="width: ${progress}%; background-color: ${isExceeded ? 'var(--accent2)' : col.color}"></div>
      </div>
    ` : ''}
    <div class="cards-area" data-col-id="${col.id}" role="list" aria-label="Tarefas de ${escapeHtml(col.title)}">
      ${col.cards.map(c => buildCardHTML(c)).join('')}
    </div>
    <button class="add-card-btn" data-col="${col.id}" aria-label="Adicionar tarefa em ${escapeHtml(col.title)}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5"  y1="12" x2="19" y2="12"/>
      </svg>
      Adicionar tarefa
    </button>`;

  // Drag & drop na área de cards
  const area = el.querySelector('.cards-area');
  area.addEventListener('dragover',  onDragOver);
  area.addEventListener('dragleave', onDragLeave);
  area.addEventListener('drop',      onDrop);

  // Eventos dos cards (dragstart/dragend)
  area.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend',   onDragEnd);
  });

  // Botões da coluna
  el.querySelector('.col-btn.edit').addEventListener('click', () => openColumnModal(col.id));
  el.querySelector('.col-btn.delete').addEventListener('click', () => {
    const cardCount = col.cards.length;
    const msg = cardCount > 0
      ? `Excluir a coluna "${col.title}" e ${cardCount} tarefa(s)?`
      : `Excluir a coluna "${col.title}"?`;
    openConfirm(msg, () => {
      state.columns = state.columns.filter(c => c.id !== col.id);
      saveState();
      render();
      showToast('🗑️ Coluna excluída.');
    });
  });
  el.querySelector('.add-card-btn').addEventListener('click', () => openCardModal(col.id));

  return el;
}

/* ════════════════════════════════════════════
   BUILD CARD HTML
════════════════════════════════════════════ */
function buildCardHTML(card) {
  const dateStr = card.date
    ? `<span class="card-date">📅 ${formatDate(card.date)}</span>`
    : '<span></span>';

  const priorityLabel = { low: 'Baixa', medium: 'Média', high: 'Alta' };

  const tagsHtml = (card.tags || []).map(tag => {
    const color = getTagColor(tag);
    return `<span class="card-tag" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44;">${escapeHtml(tag)}</span>`;
  }).join('');

  // Checklist Progress
  const totalItems = (card.checklist || []).length;
  const doneItems = (card.checklist || []).filter(i => i.completed).length;
  const checklistHtml = totalItems > 0 ? `
    <div class="card-checklist-progress">
      <i data-lucide="check-square" size="12"></i>
      ${doneItems}/${totalItems}
    </div>` : '';

  return `
    <div class="card" draggable="true" data-card-id="${card.id}" data-id="${card.id}"

         role="listitem" aria-label="${escapeHtml(card.title)}, prioridade ${priorityLabel[card.priority] || 'baixa'}">
      <div class="card-priority-bar ${card.priority}" aria-hidden="true"></div>
      <div class="card-title">${escapeHtml(card.title)}</div>
      <div class="card-tags">${tagsHtml}</div>
      ${checklistHtml}
      ${card.desc ? `<div class="card-desc">${escapeHtml(card.desc)}</div>` : ''}
      <div class="card-footer">
        ${dateStr}
        <div class="card-actions">
          <button class="card-btn edit"   data-card="${card.id}" title="Editar tarefa"  aria-label="Editar ${escapeHtml(card.title)}">✏️</button>
          <button class="card-btn focus"  data-card="${card.id}" title="Iniciar Foco (Pomodoro)">🎯</button>
          <button class="card-btn archive" data-card="${card.id}" title="Arquivar tarefa" aria-label="Arquivar ${escapeHtml(card.title)}">📦</button>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   DELEGAÇÃO DE EVENTOS — CARDS (editar / excluir)
════════════════════════════════════════════ */
document.getElementById('board').addEventListener('click', e => {
  const editBtn = e.target.closest('.card-btn.edit');
  const arcBtn  = e.target.closest('.card-btn.archive');
  const focBtn  = e.target.closest('.card-btn.focus');

  if (editBtn) {
    const cardId = editBtn.dataset.card;
    const col = state.columns.find(c => c.cards.some(k => k.id === cardId));
    if (col) openCardModal(col.id, cardId);
    return;
  }

  if (focBtn) {
    const cardId = focBtn.dataset.card;
    togglePomodoro(cardId);
    return;
  }

  if (arcBtn) {
    const cardId = arcBtn.dataset.card;
    const col  = state.columns.find(c => c.cards.some(k => k.id === cardId));
    const card = col?.cards.find(k => k.id === cardId);
    if (card) {
      archiveCard(col.id, cardId);

    }
  }
});

async function archiveCard(colId, cardId) {
  const col = state.columns.find(c => c.id === colId);
  if (!col) return;

  const cardIdx = col.cards.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return;

  const [card] = col.cards.splice(cardIdx, 1);

  // Requisito: DELETE na API usando o id do Mongo
  try {
    await apiDeleteTarefa(card.id);
  } catch (e) {
    console.error(e);
    showToast('⚠️ Erro ao excluir tarefa na API.');
    // Reverte o splice caso falhe
    col.cards.splice(cardIdx, 0, card);
    return;
  }

  card.archivedAt = new Date().toISOString(); //
  state.archived.push(card);
  saveLocalState(); // Save local archived state
  render();
  showToast('📦 Tarefa arquivada!');
  if (activeFocusCardId === cardId) stopPomodoro();
}


/* ════════════════════════════════════════════
   POMODORO ENGINE
════════════════════════════════════════════ */
function togglePomodoro(cardId) {
  if (activeFocusCardId === cardId) {
    stopPomodoro();
    return;
  }
  
  stopPomodoro(); // Para qualquer um que esteja rodando
  activeFocusCardId = cardId;
  timeLeft = 25 * 60; // 25 minutos
  playMelody('start');

  // Solicita permissão para notificações se ainda não foi decidida
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  
  document.getElementById('pomodoroContainer').style.display = 'block';
  updateTimerDisplay();
  
  pomodoroInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      const spent = 25 * 60;
      const col = state.columns.find(c => c.cards.some(k => k.id === activeFocusCardId));
      const card = col?.cards.find(k => k.id === activeFocusCardId);
      if (card) card.totalFocusTime = (card.totalFocusTime || 0) + spent;
      
      stopPomodoro();
      startTabFlash();
      playMelody('end');

      // Dispara a notificação do sistema operacional
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🎉 Pomodoro Concluído!", {
          body: "Excelente trabalho! Hora de uma pausa.",
          icon: "assets/logo/logo.png"
        });
      }

      playTick(440, 0.8, 0.1, true); // Som de finalização
      showToast('🎉 Ciclo Pomodoro concluído! Hora de uma pausa.');
    }
  }, 1000);

  render(); // Adiciona classe is-focusing
  showToast('🎯 Foco iniciado: 25 minutos');
}

function stopPomodoro() {
  clearInterval(pomodoroInterval);
  activeFocusCardId = null;
  document.getElementById('pomodoroContainer').style.display = 'none';
  
  stopTabFlash();

  // Restaura o título original da aba
  document.title = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  
  render();
}

/** Altera o ícone da aba (Favicon) dinamicamente */
function updateFavicon(url) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

/** Inicia o efeito de piscar na aba do navegador */
function startTabFlash() {
  if (tabFlashInterval) return;
  
  const alertTitle = "🚨 TEMPO ESGOTADO! 🚨";
  const originalTitle = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
  let isAlert = true;

  // Cria um favicon de alerta (ponto vermelho) usando Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#EF4444';
  ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2); ctx.fill();
  const alertFavicon = canvas.toDataURL();
  const originalFavicon = 'assets/logo/logo.png'; // Caminho da sua logo

  tabFlashInterval = setInterval(() => {
    document.title = isAlert ? alertTitle : originalTitle;
    updateFavicon(isAlert ? alertFavicon : originalFavicon);
    isAlert = !isAlert;
  }, 1000);
}

/** Para o efeito de piscar e restaura o título */
function stopTabFlash() {
  if (tabFlashInterval) {
    clearInterval(tabFlashInterval);
    tabFlashInterval = null;
    document.title = `MB - FlowBoard — ${state.title || 'Meu Quadro'}`;
    updateFavicon('assets/logo/logo.png');
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  document.getElementById('timerMinutes').textContent = mins.toString().padStart(2, '0');
  document.getElementById('timerSeconds').textContent = secs.toString().padStart(2, '0');

  // Atualiza o título da aba com o tempo restante
  document.title = `(${timeStr}) ${state.title || 'MB - FlowBoard'}`;
}

/* ════════════════════════════════════════════
   DRAG & DROP
════════════════════════════════════════════ */
function onDragStart(e) {
  dragCardId = e.currentTarget.dataset.cardId;
  const colEl = e.currentTarget.closest('.column');
  dragColId = colEl?.dataset.colId || null;

  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragCardId);

  // Feedback tátil (vibrar) ao segurar o card, se disponível no dispositivo
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
  playTick(280, 0.08, 0.03); // Som curto e agudo ao iniciar
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  removeGhost();
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const col = e.currentTarget.closest('.column');
  if (col) col.classList.add('drag-over');

  const afterEl = getDragAfterElement(e.currentTarget, e.clientY);

  if (!ghostEl) {
    ghostEl = document.createElement('div');
    ghostEl.className = 'card-ghost';
    ghostEl.setAttribute('aria-hidden', 'true');
  }

  // Toca o som apenas se o card mudar de posição (evita repetição excessiva)
  if (afterEl !== ghostEl.nextSibling) {
    playTick(250, 0.1, 0.03); // Som de movimento
    if (afterEl) {
      e.currentTarget.insertBefore(ghostEl, afterEl);
    } else {
      e.currentTarget.appendChild(ghostEl);
    }
  }
}

function onDragLeave(e) {
  const col = e.currentTarget.closest('.column');
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove('drag-over');
    removeGhost();
  }
}

async function onDrop(e) {

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
  
  // 🚀 REGRA DE NEGÓCIO: WIP LIMIT
  if (tgtCol.limit > 0 && tgtCol.cards.length >= tgtCol.limit && srcCol.id !== tgtCol.id) {
    showToast(`🚫 Limite de WIP atingido na coluna "${tgtCol.title}"!`);
    playTick(150, 0.2, 0.1);
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    return;
  }

  // Calcula nota musical baseada na coluna (Escala Pentatônica)
  const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4, D4, E4, G4, A4
  const colIdx = state.columns.findIndex(c => c.id === targetColId);
  const freq = notes[colIdx % notes.length] || 250;

  const cardIdx = srcCol.cards.findIndex(c => c.id === dragCardId);
  if (cardIdx === -1) return;

  const [card] = srcCol.cards.splice(cardIdx, 1);

  const afterEl = getDragAfterElement(e.currentTarget, e.clientY);
  let insertIdx = tgtCol.cards.length;
  if (afterEl) {
    const afterId = afterEl.dataset.cardId;
    const idx = tgtCol.cards.findIndex(c => c.id === afterId);
    if (idx !== -1) insertIdx = idx;
  }
  tgtCol.cards.splice(insertIdx, 0, card);

  dragCardId = null;
  dragColId  = null;

  saveLocalState(); // Save local state (non-task related)
  render();
  
  // Registra no histórico se moveu para Concluído
  if (tgtCol.title.toLowerCase().includes('concluíd')) {
    const today = new Date().toISOString().split('T')[0];
    state.history[today] = (state.history[today] || 0) + 1;
  }

  playTick(freq / 2, 0.5, 0.07, true); // Drop mais grave baseado na nota da coluna
  // Atualiza na API com a nova coluna (requisito de update por movimentação)
  try {
    const movedCard = tgtCol.cards[insertIdx]?.id ? tgtCol.cards[insertIdx] : card;
    if (movedCard && movedCard.id) {
      const colunaBackend = uiColumnTitleToBackendColuna(tgtCol.title);
      await apiUpdateTarefa({ // Usando apiUpdateTarefa
        id: movedCard.id,
        titulo: movedCard.title,
        coluna: colunaBackend,
        descricao: movedCard.desc,
        prioridade: movedCard.priority,
        data: movedCard.date,
        tags: movedCard.tags,
        checklist: movedCard.checklist,
        totalFocusTime: movedCard.totalFocusTime
      });
    }
  } catch (e) {
    console.error(e);
    showToast('⚠️ Erro ao atualizar tarefa na API.');
  }

  showToast('✨ Tarefa movida!');
}


/* ════════════════════════════════════════════
   TEMAS DE FUNDO
════════════════════════════════════════════ */
// Carregar tema salvo
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('kanflow_theme') || 'theme-professional';
  document.body.className = savedTheme;
  const selector = document.getElementById('themeSelector');
  if (selector) selector.value = savedTheme;
});

document.getElementById('themeSelector')?.addEventListener('change', (e) => {
  const newTheme = e.target.value;
  document.body.className = newTheme;
  localStorage.setItem('kanflow_theme', newTheme);
  showToast(`🎨 Tema alterado com sucesso!`);
});

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

function removeGhost() {
  if (ghostEl?.parentNode) ghostEl.parentNode.removeChild(ghostEl);
  ghostEl = null;
}

/* ════════════════════════════════════════════
   MODAL: COLUNA
════════════════════════════════════════════ */
function openColumnModal(colId = null) {
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

function closeColumnModal() {
  closeModal('columnModal');
  editingColId = null;
}

document.getElementById('addColumnBtn').addEventListener('click', () => openColumnModal());
document.getElementById('closeColumnModal').addEventListener('click', closeColumnModal);
document.getElementById('cancelColumnModal').addEventListener('click', closeColumnModal);

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

document.getElementById('saveColumnBtn').addEventListener('click', () => {
  const name = document.getElementById('columnNameInput').value.trim();
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
    state.columns.push({ id: uid(), title: name, color: selectedColor, limit: limit, cards: [] });
    showToast('🎉 Coluna criada!');
  }

  saveLocalState(); // Save local column structure
  render();
  closeColumnModal();
});

document.getElementById('columnNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveColumnBtn').click();
});

/* ════════════════════════════════════════════
   DROPDOWN & CHECKLIST LOGIC
════════════════════════════════════════════ */
document.getElementById('moreActionsBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('moreDropdown').classList.toggle('open');
});
window.addEventListener('click', () => document.getElementById('moreDropdown').classList.remove('open'));

let tempChecklist = [];
function renderModalChecklist() {
  const area = document.getElementById('checklistArea');
  area.innerHTML = '';
  tempChecklist.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'checklist-input-group';
    div.innerHTML = `
      <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="tempChecklist[${index}].completed = this.checked">
      <input type="text" value="${escapeHtml(item.text)}" oninput="tempChecklist[${index}].text = this.value" style="flex:1">
      <button class="btn-close" onclick="tempChecklist.splice(${index},1); renderModalChecklist()">×</button>
    `;
    area.appendChild(div);
  });
}

document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
  const input = document.getElementById('newChecklistItem');
  if (input.value.trim()) {
    tempChecklist.push({ text: input.value.trim(), completed: false });
    input.value = '';
    renderModalChecklist();
  }
});

/* ════════════════════════════════════════════
   MODAL: CARD / TAREFA
════════════════════════════════════════════ */
function openCardModal(colId, cardId = null) {
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
      document.getElementById('cardTagsInput').value  = (card.tags  || []).join(', ');
      tempChecklist = JSON.parse(JSON.stringify(card.checklist || []));
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

function closeCardModal() {
  closeModal('cardModal');
  editingCardId = editingCardColId = null;
}

document.getElementById('closeCardModal').addEventListener('click', closeCardModal);
document.getElementById('cancelCardModal').addEventListener('click', closeCardModal);

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

document.getElementById('saveCardBtn').addEventListener('click', async () => {

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
  const tags = document.getElementById('cardTagsInput').value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  const col  = state.columns.find(c => c.id === editingCardColId);
  if (!col) return;

  const movedColumnUI = (state.columns.find(c => c.id === editingCardColId) || col);
  const movedColumnBackend = uiColumnTitleToBackendColuna(movedColumnUI.title);

  if (editingCardId) {
    // Atualização via API (somente campos aceitos pelo backend do exemplo)
    try {
      const updated = await apiUpdateTarefa({ // Usando apiUpdateTarefa
        id: editingCardId,
        titulo: title,
        coluna: movedColumnBackend,
        descricao: desc,
        data: date,
        prioridade: selectedPriority,
        tags: tags,
        checklist: tempChecklist
      });
      const card = col.cards.find(k => k.id === editingCardId);
      if (card) {
        card.title    = title;
        card.desc     = desc;
        card.date     = date;
        card.tags     = tags;
        card.priority = selectedPriority;
        if (updated && updated._id) card.id = String(updated._id);
        card.checklist = tempChecklist;
      }
      showToast('✅ Tarefa atualizada!');
    } catch (e) {
      console.error(e);
      showToast('⚠️ Erro ao atualizar tarefa na API.');
      return;
    }
  } else {
    try { // Usando apiCreateTarefa
      const created = await apiCreateTarefa({
        titulo: title,
        coluna: movedColumnBackend,
        descricao: desc,
        data: date,
        prioridade: selectedPriority,
        tags: tags,
        checklist: tempChecklist
      });
      const newId = created && (created._id || created.id);
      col.cards.push({
        id: newId ? String(newId) : uid(),
        title,
        desc,
        date,
        tags,
        priority: selectedPriority
      }); // Adiciona checklist ao novo card
      col.cards[col.cards.length - 1].checklist = tempChecklist;
      showToast('🎉 Tarefa criada!');
    } catch (e) {
      console.error(e);
      showToast('⚠️ Erro ao criar tarefa na API.');
      return;
    }
  }

  saveLocalState(); // Save local state (non-task related)
  render();
  closeCardModal();
});


document.getElementById('cardTitleInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveCardBtn').click();
});

/* ════════════════════════════════════════════
   MODAL: ARQUIVO
════════════════════════════════════════════ */
function openArchiveModal() {
  const list = document.getElementById('archiveList');
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
          <p>${card.desc ? escapeHtml(card.desc).slice(0, 40) + '...' : 'Sem descrição'}</p>
          <span class="archive-item-date">Arquivado em: ${formatFullDate(card.archivedAt)}</span>
        </div>
        <div class="archive-item-actions">
          <button class="btn-icon btn-ghost" onclick="restoreFromArchive('${card.id}')" title="Restaurar">⬆️</button>
          <button class="btn-icon btn-ghost btn-danger-hover" onclick="deleteFromArchive('${card.id}')" title="Excluir permanentemente">🗑️</button>
        </div>
      `;
      list.appendChild(item);
    });
  }
  openModal('archiveModal');
}

window.restoreFromArchive = function(cardId) {
  const idx = state.archived.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const [card] = state.archived.splice(idx, 1);
  
  // Restaura na primeira coluna disponível e adiciona ao Firebase
  if (state.columns.length > 0) {
    state.columns[0].cards.push(card);
    const targetCol = state.columns[0];
    const colunaBackend = uiColumnTitleToBackendColuna(targetCol.title);
    firebaseCreateTarefa({
      titulo: card.title, // Usando apiCreateTarefa
      coluna: colunaBackend, // Usando apiCreateTarefa
      descricao: card.desc, // Usando apiCreateTarefa
      prioridade: card.priority, // Usando apiCreateTarefa
      data: card.date, // Usando apiCreateTarefa
      tags: card.tags, // Usando apiCreateTarefa
      checklist: card.checklist, // Usando apiCreateTarefa
      totalFocusTime: card.totalFocusTime // Usando apiCreateTarefa
    }).then(createdCard => {
      card.id = createdCard._id; // Update the ID of the restored card with the new Firebase ID
      saveLocalState(); // Save local archived state
      render();
      showToast('♻️ Tarefa restaurada!');
      openArchiveModal(); // Refresh
    }).catch(e => {
      console.error("Erro ao restaurar tarefa para o Firebase:", e);
      showToast('⚠️ Erro ao restaurar tarefa.');
      // Revert local changes if Firebase fails
      state.archived.splice(idx, 0, card);
      saveLocalState();
      render();
    });
  } else {
    saveLocalState(); // Salva estado local arquivado (sem chamada à API se não houver colunas)
    render();
    showToast('♻️ Tarefa restaurada! (Mas não há colunas ativas para ela)');
    openArchiveModal(); // Refresh
  }
};

window.deleteFromArchive = function(cardId) {
  openConfirm('Excluir esta tarefa permanentemente?', () => {
    state.archived = state.archived.filter(c => c.id !== cardId);
    saveLocalState(); // Save local archived state
    openArchiveModal();
    showToast('🗑️ Tarefa excluída definitivamente.');
  });
};

document.getElementById('openArchiveBtn').addEventListener('click', openArchiveModal);
document.getElementById('closeArchiveModal').addEventListener('click', () => closeModal('archiveModal'));
document.getElementById('clearArchiveBtn').addEventListener('click', () => {
  if (state.archived.length === 0) return;
  openConfirm('Deseja excluir permanentemente todas as tarefas arquivadas?', () => {
    state.archived = [];
    saveLocalState(); // Save local archived state
    openArchiveModal();
    showToast('🧹 Arquivo limpo!');
  });
});

/* ════════════════════════════════════════════
   MODAL: CONFIRMAR EXCLUSÃO
════════════════════════════════════════════ */
function openConfirm(message, cb) {
  confirmCallback = cb;
  document.getElementById('confirmMessage').textContent = message;
  openModal('confirmModal');
}

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

/* ════════════════════════════════════════════
   HELPERS DE MODAL (abrir / fechar genérico)
════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Fechar modal ao clicar no overlay
['columnModal', 'cardModal', 'confirmModal', 'emojiModal', 'archiveModal'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    if (e.target.id === id) {
      closeModal(id);
      if (id === 'columnModal') editingColId = null;
      if (id === 'cardModal')   { editingCardId = null; editingCardColId = null; }
      if (id === 'confirmModal') confirmCallback = null;
    }
  });
});

// ESC fecha modais
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['columnModal', 'cardModal', 'confirmModal', 'emojiModal'].forEach(id => closeModal(id));
    editingColId = null;
    editingCardId = null;
    editingCardColId = null;
    confirmCallback = null;
  }
});

/* ════════════════════════════════════════════
   EDIÇÃO INLINE DO TÍTULO DO QUADRO
════════════════════════════════════════════ */
document.getElementById('boardTitleDisplay').addEventListener('click', activateTitleEdit);
document.getElementById('boardTitleDisplay').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    activateTitleEdit();
  }
});

function activateTitleEdit() {
  const span = document.getElementById('boardTitleDisplay');
  const currentText = state.title || 'Meu Quadro';

  const input = document.createElement('input');
  input.type       = 'text';
  input.value      = currentText;
  input.className  = 'board-title-input';
  input.maxLength  = 30;
  input.setAttribute('aria-label', 'Nome do quadro');

  span.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;

  const saveTitle = () => {
    if (saved) return;
    saved = true;
    const newValue = input.value.trim() || 'Meu Quadro';
    state.title = newValue; //
    saveLocalState(); // Save local title state
    render();
    showToast('✏️ Título atualizado!');
  };

  const cancelTitle = () => {
    if (saved) return;
    saved = true;
    render(); // restaura sem salvar
  };

  input.addEventListener('blur', saveTitle);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.removeEventListener('blur', saveTitle); saveTitle(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', saveTitle); cancelTitle(); }
  });
}

/* ════════════════════════════════════════════
   AÇÕES DO HEADER
════════════════════════════════════════════ */

// Limpar quadro
document.getElementById('clearBoardBtn').addEventListener('click', () => {
  openConfirm('Deseja limpar todo o quadro? Isso excluirá todas as colunas e tarefas permanentemente.', () => {
    // Delete all tasks via API
    setLoading(true);
    try {
      // Primeiro, busca todas as tarefas da API
      const allTasks = await apiGetTarefas();
      const deletePromises = allTasks.map(task => apiDeleteTarefa(task.id));
      await Promise.all(deletePromises);
      showToast('🧹 Todas as tarefas excluídas da API!');
    } catch (e) {
      console.error("Erro ao limpar tarefas na API:", e);
      showToast('❌ Erro ao limpar tarefas na API.');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    state.columns = []; // Clear local columns (will be rebuilt from Firebase if any)
    state.archived = []; // Clear local archived
    state.history = {}; // Clear local history
    saveLocalState(); // Save empty local state
    render();
    showToast('🧹 Quadro limpo!');
  });
});

// Imprimir
document.getElementById('printBoardBtn').addEventListener('click', () => {
  showToast('🖨️ Preparando impressão...');
  setTimeout(() => window.print(), 300);
});

// Exportar JSON
document.getElementById('exportBoardBtn').addEventListener('click', () => {
  try {
    const dataStr  = JSON.stringify(state, null, 2);
    const blob     = new Blob([dataStr], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const date     = new Date().toISOString().split('T')[0];
    const fileName = `kanflow-backup-${date}.json`;

    const link = document.createElement('a');
    link.href     = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('💾 Backup exportado com sucesso!');
  } catch {
    showToast('❌ Erro ao exportar backup.');
  }
});

/* ════════════════════════════════════════════
   EVENTOS DE BUSCA E FILTRO
════════════════════════════════════════════ */
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value.toLowerCase();
  render();
});

document.getElementById('priorityFilter').addEventListener('change', (e) => {
  activePriorityFilter = e.target.value;
  render();
});

/* ════════════════════════════════════════════
   ATALHOS DE TECLADO
════════════════════════════════════════════ */
window.addEventListener('keydown', e => {
  const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  
  // N -> Nova Tarefa (na primeira coluna)
  if (e.key.toLowerCase() === 'n' && !isInput) {
    e.preventDefault();
    if (state.columns.length > 0) {
      openCardModal(state.columns[0].id);
      showShortcutHUD('Nova Tarefa');
    }
  }

  // Ctrl + S -> Salvar (Feedback Visual)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    // With Firebase, changes are saved immediately. This can just be a visual feedback.
    // saveState(); // Não salva mais o estado completo no localStorage diretamente para tarefas
    showToast('💾 Alterações salvas!');
    showShortcutHUD('Salvar');
  }

  // Delete -> Remover tarefa se estiver com hover (simplificado)
  if (e.key === 'Delete' && !isInput) {
    showShortcutHUD('Delete (Use os botões de ação)');
  }
});

/* ════════════════════════════════════════════
   PERFIL DO USUÁRIO
════════════════════════════════════════════ */
document.getElementById('userProfileTrigger').addEventListener('click', () => {
  document.getElementById('userNameInput').value = state.profile.name;
  const picker = document.getElementById('avatarColorPicker');
  picker.innerHTML = '';
  ['#6C63FF', '#FF6584', '#43D9AD', '#FFB347', '#4FC3F7'].forEach(color => {
    const dot = document.createElement('button');
    dot.className = `color-dot ${state.profile.color === color ? 'selected' : ''}`;
    dot.style.background = color;
    dot.onclick = () => {
      state.profile.color = color;
      document.querySelectorAll('#avatarColorPicker .color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    };
    picker.appendChild(dot);
  });
  openModal('profileModal');
});

document.getElementById('saveProfileBtn').addEventListener('click', () => {
  state.profile.name = document.getElementById('userNameInput').value || 'Usuário';
  saveLocalState(); // Save local profile state
  render();
  closeModal('profileModal');
  showToast('👤 Perfil atualizado!');
});

document.getElementById('closeProfileModal').addEventListener('click', () => closeModal('profileModal'));

document.getElementById('toggleDashboardBtn').addEventListener('click', () => {
  showDashboard = !showDashboard;
  render();
});

document.getElementById('stopTimerBtn').addEventListener('click', stopPomodoro);

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  searchTerm = '';
  activePriorityFilter = 'all';
  document.getElementById('searchInput').value = '';
  document.getElementById('priorityFilter').value = 'all';
  render();
});

/* ════════════════════════════════════════════
   INIT
════════════════════════════════════════════ */
(async () => { //
  // Carrega tarefas da API antes do primeiro render final
  await initBoardFromAPI(); 
  render();
})();


/** 
 * Gerenciador de Logotipo: Ajuste de visibilidade e Fallback
 * Garante que o logo seja exibido corretamente ou falhe graciosamente.
 */
document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.header-logo');
  if (logo) {
    // Garante o caminho correto se estiver vazio ou mal definido
    if (!logo.getAttribute('src') || logo.getAttribute('src') === 'logo.png') {
      logo.src = 'assets/logo/logo.png';
    }
    // Fallback caso a imagem não carregue (evita ícone de erro no layout)
    logo.onerror = () => {
      logo.style.display = 'none';
      console.warn('MB FlowBoard: Logo não encontrado em assets/logo/logo.png');
    };
  }
});
