/**
 * MB FLOWBOARD — js/metrics-logic.js
 * Lógica centralizada para cálculo de métricas e estatísticas.
 * Compartilhado entre a thread principal (Fallback) e Web Workers.
 */

/**
 * Calcula todas as métricas baseadas no estado atual
 * @param {Object} state - Estado do quadro
 * @param {string} today - Data atual no formato YYYY-MM-DD
 * @returns {Object} Objeto contendo métricas processadas
 */
function calculateMetrics(state, today) {
  // Otimização: Iteração única para coletar todas as métricas (O(n))
  let completedCount = 0;
  let delayedCount = 0;
  let dueSoonCount = 0;
  let totalFocusSeconds = 0;
  let activeCardsCount = 0;
  
  const priorityData = { high: 0, medium: 0, low: 0 };
  const bottleneckData = [];
  const todayDate = new Date(today + 'T00:00:00');

  state.columns.forEach(col => {
    const isDoneCol = col.title.toLowerCase().includes('concluíd') || col.title.toLowerCase().includes('done');
    const colCards = col.cards;
    
    activeCardsCount += colCards.length;
    if (isDoneCol) completedCount += colCards.length;

    colCards.forEach(card => {
      totalFocusSeconds += (card.totalFocusTime || 0);
      if (priorityData[card.priority] !== undefined) priorityData[card.priority]++;

      if (!isDoneCol && card.date) {
        const cardDate = new Date(card.date + 'T00:00:00');
        const diffDays = Math.round((cardDate - todayDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) delayedCount++;
        else if (diffDays <= 2) dueSoonCount++;
      }
    });

    bottleneckData.push({ title: col.title, count: colCards.length, color: col.color });
  });

  const totalItems = activeCardsCount + (Array.isArray(state.archived) ? state.archived.length : 0);
  const productivity = activeCardsCount > 0 ? Math.round((completedCount / activeCardsCount) * 100) : 0;

  // Histórico Semanal
  const weekHistory = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    weekHistory.push({ date: dateKey, value: state.history[dateKey] || 0, isToday: i === 0 });
  }

  return {
    total: totalItems,
    completed: completedCount,
    delayed: delayedCount,
    dueSoon: dueSoonCount,
    productivity,
    totalFocus: totalFocusSeconds,
    weekHistory,
    bottleneckData,
    priorityData
  };
}

/** ── TESTES UNITÁRIOS SIMPLES ── */
function runMetricsTests() {
  console.log('🧪 Iniciando Testes de Métricas...');
  const mockState = {
    columns: [
      { title: 'To Do', cards: [{ priority: 'high', date: '2023-01-01' }], color: '#000' },
      { title: 'Done', cards: [{ priority: 'low' }, { priority: 'medium' }], color: '#fff' }
    ],
    archived: [],
    history: {}
  };
  const result = calculateMetrics(mockState, '2023-01-05');
  
  console.assert(result.total === 3, 'Erro: Total de cards incorreto');
  console.assert(result.completed === 2, 'Erro: Contagem de concluídos incorreta');
  console.assert(result.productivity === 67, 'Erro: Cálculo de produtividade incorreto. Esperado 67, obtido ' + result.productivity);
  console.assert(result.delayed === 1, 'Erro: Detecção de atraso falhou');
  
  console.log('✅ Testes concluídos.');
}
// runMetricsTests(); // Descomente para rodar no console