/**
 * MB FLOWBOARD — js/tags.js
 * Sistema de tags inteligentes
 * Cores automáticas · Filtro · Validação
 */

'use strict';

/**
 * Lista de tags predefinidas por categoria
 * Usada para sugestão e autocompletar
 */
const PREDEFINED_TAGS = [
  { name: 'Frontend',      emoji: '🎨' },
  { name: 'Backend',       emoji: '⚙️' },
  { name: 'Bug',           emoji: '🐛' },
  { name: 'Urgente',       emoji: '🔥' },
  { name: 'UX',            emoji: '✨' },
  { name: 'Design',        emoji: '🖌️' },
  { name: 'Deploy',        emoji: '🚀' },
  { name: 'Documentação',  emoji: '📝' },
  { name: 'API',           emoji: '🔗' },
  { name: 'DevOps',        emoji: '🛠️' },
  { name: 'Testes',        emoji: '🧪' },
  { name: 'Mobile',        emoji: '📱' },
  { name: 'Segurança',     emoji: '🔒' },
  { name: 'Performance',   emoji: '⚡' },
  { name: 'Revisão',       emoji: '👀' }
];

/**
 * Normaliza uma lista de tags vindas de input de texto
 * @param {string} rawInput - String separada por vírgulas
 * @returns {string[]} Array de tags limpas e únicas
 */
function parseTags(rawInput) {
  if (!rawInput) return [];
  return rawInput
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.length <= 30)
    .filter((t, i, arr) => arr.indexOf(t) === i); // Remove duplicatas
}

/**
 * Gera o HTML de uma tag para exibição em card
 * @param {string} tag - Nome da tag
 * @returns {string} HTML da tag
 */
function buildTagHTML(tag) {
  const color = getTagColor(tag);
  return `<span class="card-tag" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44;">${escapeHtml(tag)}</span>`;
}

/**
 * Gera o HTML de todas as tags de um card
 * @param {string[]} tags - Array de tags
 * @returns {string} HTML do container de tags
 */
function buildTagsHTML(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(buildTagHTML).join('');
}

/**
 * Retorna todas as tags únicas usadas no quadro (para filtros)
 * @param {Object} state - Estado global
 * @returns {string[]} Tags únicas ordenadas
 */
function getAllTags(state) {
  const tagSet = new Set();
  state.columns.forEach(col => {
    col.cards.forEach(card => {
      (card.tags || []).forEach(t => tagSet.add(t));
    });
  });
  return [...tagSet].sort();
}

/**
 * Filtra um card por tag ativa
 * @param {Object} card - Card a filtrar
 * @param {string} activeTag - Tag do filtro ('all' = sem filtro)
 * @returns {boolean}
 */
function cardMatchesTag(card, activeTag) {
  if (!activeTag || activeTag === 'all') return true;
  return (card.tags || []).some(t => t.toLowerCase() === activeTag.toLowerCase());
}
