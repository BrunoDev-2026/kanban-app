/**
 * MB FLOWBOARD — js/storage.js
 * Responsável por toda a persistência via localStorage
 * Salvar · Recuperar · Atualizar · Remover dados
 */

'use strict';

/** Chave principal do localStorage */
const STORAGE_KEY = 'kanflow_state';
const STORAGE_THEME_KEY = 'kanflow_theme';

/* ── Gestão de Histórico (Undo/Redo) ── */
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let saveTimeout = null;

/**
 * Constrói o estado padrão da aplicação (primeiro acesso)
 * @returns {Object} Estado inicial com colunas e cards de exemplo
 */
function buildDefaultState() {
  return {
    title: 'RH - Marina',
    emoji: '',
    profile: {
      name: 'Usuário',
      color: '#6C63FF',
      focusTime: 25
    },
    lastView: 'board',
    columns: [
      {
        id: uid(),
        title: 'A Fazer',
        color: '#6C63FF',
        limit: 0,
        cards: [
          {
            id: uid(),
            title: 'Criar wireframe do projeto',
            desc: 'Esboçar as telas principais antes de começar o código.',
            priority: 'high',
            date: '',
            tags: ['Design', 'UI'],
            checklist: [],
            totalFocusTime: 0,
            createdAt: new Date().toISOString()
          },
          {
            id: uid(),
            title: 'Configurar repositório Git',
            desc: '',
            priority: 'medium',
            date: '',
            tags: ['DevOps'],
            checklist: [],
            totalFocusTime: 0,
            createdAt: new Date().toISOString()
          }
        ]
      },
      {
        id: uid(),
        title: 'Em Progresso',
        color: '#FFB347',
        limit: 3,
        cards: [
          {
            id: uid(),
            title: 'Desenvolver página inicial',
            desc: 'Componente Hero + Navbar responsivo.',
            priority: 'high',
            date: '',
            tags: ['Frontend'],
            checklist: [],
            totalFocusTime: 0,
            createdAt: new Date().toISOString()
          }
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
          {
            id: uid(),
            title: 'Definir tecnologias do projeto',
            desc: 'HTML, CSS, JS vanilla — simples e eficaz.',
            priority: 'low',
            date: '',
            tags: [],
            checklist: [],
            totalFocusTime: 0,
            createdAt: new Date().toISOString()
          }
        ]
      }
    ],
    archived: [],
    history: {}
  };
}

/**
 * Normaliza um card garantindo todos os campos necessários
 * @param {Object} card - Card bruto do localStorage
 * @returns {Object} Card normalizado
 */
function normalizeCard(card) {
  return {
    id:             card.id             || uid(),
    title:          card.title          || '',
    desc:           card.desc           || '',
    priority:       card.priority       || 'low',
    date:           card.date           || '',
    tags:           Array.isArray(card.tags)      ? card.tags      : [],
    checklist:      Array.isArray(card.checklist) ? card.checklist : [],
    totalFocusTime: card.totalFocusTime || 0,
    createdAt:      card.createdAt      || new Date().toISOString(),
    archivedAt:     card.archivedAt     || null
  };
}

/**
 * Carrega o estado do localStorage
 * @returns {Object} Estado atual da aplicação
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();

    const parsed = JSON.parse(raw);

    // Validação mínima da estrutura
    if (!parsed || !Array.isArray(parsed.columns)) return buildDefaultState();

    // Normaliza colunas e cards
    parsed.columns = parsed.columns.map(col => ({
      id:    col.id    || uid(),
      title: col.title || 'Coluna',
      color: col.color || '#6C63FF',
      limit: parseInt(col.limit) || 0,
      cards: Array.isArray(col.cards) ? col.cards.map(normalizeCard) : []
    }));

    // Garante arrays e objetos obrigatórios
    parsed.archived = Array.isArray(parsed.archived) ? parsed.archived.map(normalizeCard) : [];
    parsed.history  = parsed.history || {};
    parsed.lastView = parsed.lastView || 'board';

    // Normaliza perfil
    if (!parsed.profile) {
      parsed.profile = { name: 'Usuário', color: '#7C3AED', focusTime: 25, breakTime: 5 };
    }
    parsed.profile.focusTime = parsed.profile.focusTime || 25;
    parsed.profile.breakTime = parsed.profile.breakTime || 5;

    return parsed;
  } catch {
    return buildDefaultState();
  }
}

/**
 * Salva o estado no localStorage
 * @param {Object} state - Estado a salvar
 */
function saveState(state, recordHistory = true) {
  if (recordHistory) {
    // Salva uma cópia profunda para o histórico antes de mutar
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = []; // Limpa o refazer ao criar nova linha do tempo
  }

  // Auto-save inteligente com Debounce (500ms)
  clearTimeout(saveTimeout);
  updateSaveStatus('saving');

  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSaveStatus('saved');
    } catch (e) {
      showToast('⚠️ Erro ao salvar. Armazenamento cheio?');
      updateSaveStatus('error');
    }
  }, 500);
}

/**
 * Desfaz a última ação
 * @param {Object} currentState - Referência ao estado atual
 * @returns {Object|null} Estado anterior
 */
function undo(currentState) {
  if (undoStack.length === 0) return null;
  
  redoStack.push(JSON.stringify(currentState));
  const previousState = JSON.parse(undoStack.pop());
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousState));
    return previousState;
  } catch (e) { return null; }
}

/**
 * Refaz a ação desfeita
 * @param {Object} currentState - Referência ao estado atual
 * @returns {Object|null} Próximo estado
 */
function redo(currentState) {
  if (redoStack.length === 0) return null;

  undoStack.push(JSON.stringify(currentState));
  const nextState = JSON.parse(redoStack.pop());

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  } catch (e) { return null; }
}

/**
 * Atualiza o indicador visual de salvamento no UI
 */
function updateSaveStatus(status) {
  const indicator = document.getElementById('saveIndicator');
  if (!indicator) return;

  switch(status) {
    case 'saving':
      indicator.innerHTML = '<span class="spin">⏳</span> Salvando...';
      break;
    case 'saved':
      indicator.innerHTML = '✨ Salvo com sucesso ✓';
      setTimeout(() => { indicator.innerHTML = ''; }, 2000);
      break;
    case 'error':
      indicator.innerHTML = '❌ Erro ao salvar';
      break;
  }
}

/**
 * Carrega o tema salvo
 * @returns {string} Nome do tema
 */
function loadTheme() {
  return localStorage.getItem(STORAGE_THEME_KEY) || 'theme-dark';
}

/**
 * Salva o tema selecionado
 * @param {string} theme - Nome do tema
 */
function saveTheme(theme) {
  localStorage.setItem(STORAGE_THEME_KEY, theme);
}

/**
 * Limpa todos os dados do localStorage (reset total)
 */
function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_THEME_KEY);
}
