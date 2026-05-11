/**
 * MB FLOWBOARD — js/dashboard.js
 * Métricas · Estatísticas · Produtividade Semanal
 * Integração Chart.js · Gráficos Interativos
 */

'use strict';

let dashboardRefreshInterval = null;
let charts = {}; // Cache de instâncias dos gráficos
let metricsWorker = null;
let isCalculating = false;

/**
 * Renderiza o dashboard de métricas com contadores animados
 * @param {Object} state - Estado global
 * @param {HTMLElement} container - Elemento do dashboard
 */
function renderDashboard(state, container) {
  if (!container) return;

  if (isCalculating) return;
  isCalculating = true;

  // 1. Mostrar Skeletons enquanto calcula
  container.innerHTML = `
    <div class="dashboard-premium-grid">
      ${'<div class="chart-container skeleton" style="height:300px"></div>'.repeat(4)}
    </div>
  `;
  container.classList.add('fade-in');

  try {
    // Detecta se está rodando localmente via file:// (onde Workers são bloqueados)
    if (window.location.protocol === 'file:') {
      throw new Error('Ambiente de arquivo local detectado. Usando fallback.');
    }

    if (!metricsWorker) {
      metricsWorker = new Worker('js/metricsWorker.js');
    }

    metricsWorker.postMessage({ state, today: getTodayISO() });
    metricsWorker.onmessage = (e) => {
      isCalculating = false;
      drawDashboardUI(e.data, state, container);
    };
  } catch (err) {
    console.warn('Dashboard: Operando em modo de compatibilidade (Thread Principal).');
    const metrics = calculateMetrics(state, getTodayISO());
    isCalculating = false;
    drawDashboardUI(metrics, state, container);
  }
}

function drawDashboardUI(m, state, container) {
  // Destruir instâncias antigas do Chart.js com segurança
  for (let key in charts) {
    if (charts[key]) charts[key].destroy();
  }
  charts = {};

  container.innerHTML = `
    <div class="dashboard-header-actions">
      <button class="btn-icon btn-ghost" id="shareMetricsBtn" title="Compartilhar produtividade">
        <i data-lucide="share-2"></i> Compartilhar
      </button>
      <button class="btn-icon btn-ghost" id="syncMetricsBtn" title="Atualizar métricas agora">
        <i data-lucide="refresh-cw"></i> Sincronizar
      </button>
    </div>
    <div class="dashboard-premium-grid fade-in">
      <div class="chart-container glass">
        <h3><i data-lucide="calendar"></i> Conclusões por Dia</h3>
        <canvas id="chartHistory"></canvas>
      </div>
      <div class="chart-container glass">
        <h3><i data-lucide="activity"></i> Distribuição de Prioridade</h3>
        <canvas id="chartPriority"></canvas>
      </div>
      <div class="chart-container glass">
        <h3><i data-lucide="gauge"></i> Gargalo por Coluna</h3>
        <canvas id="chartBottleneck"></canvas>
      </div>
      <div class="chart-container glass">
        <h3>📊 Produtividade Geral</h3>
        <div class="prod-circle">
          <span class="prod-value">${m.productivity}%</span>
        </div>
      </div>
    </div>
    <div class="dashboard-footer">Atualizado em tempo real</div>
  `;

  // Listener para o botão de sincronização manual
  document.getElementById('syncMetricsBtn').addEventListener('click', () => {
    renderDashboard(state, container);
    showToast('🔄 Métricas atualizadas!');
  });

  document.getElementById('shareMetricsBtn')?.addEventListener('click', () => {
    const text = `📊 *Resumo de Produtividade - KanFlow*\n\n` +
                 `✅ Concluídas: ${m.completed}\n` +
                 `🔥 Produtividade: ${m.productivity}%\n` +
                 `⏰ Foco Total: ${(m.totalFocus / 3600).toFixed(1)}h\n\n` +
                 `Confira meu quadro no KanFlow! 🚀`;

    if (navigator.share) {
      navigator.share({
        title: 'Minha Produtividade no KanFlow',
        text: text,
        url: window.location.href
      }).then(() => showToast('📤 Compartilhado com sucesso!'))
        .catch(() => {}); // Cancelado pelo usuário
    } else {
      // Fallback: Copiar para área de transferência
      navigator.clipboard.writeText(text + "\n" + window.location.href);
      showToast('📋 Resumo copiado para a área de transferência!');
    }
  });

  lucide.createIcons();
  initCharts(m, state);
}

/**
 * Inicializa os gráficos Chart.js com cores baseadas no tema
 */
function initCharts(metrics, state) {
  const ctxHistory = document.getElementById('chartHistory')?.getContext('2d');
  const ctxPriority = document.getElementById('chartPriority')?.getContext('2d');
  const ctxBottleneck = document.getElementById('chartBottleneck')?.getContext('2d');

  if (ctxHistory) {
    charts.history = new Chart(ctxHistory, {
      type: 'bar',
      data: {
        labels: metrics.weekHistory.map(d => d.date.split('-').reverse().slice(0, 2).join('/')),
        datasets: [{
          label: 'Tarefas Concluídas',
          data: metrics.weekHistory.map(d => d.value),
          backgroundColor: '#7C3AED',
          borderRadius: 4
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, // Permite respeitar a altura fixa do container
        plugins: { legend: { display: false } } 
      }
    });
  }

  if (ctxPriority) {
    const p = metrics.priorityData;

    charts.priority = new Chart(ctxPriority, {
      type: 'doughnut',
      data: {
        labels: ['Alta', 'Média', 'Baixa'],
        datasets: [{
          data: [p.high, p.medium, p.low],
          backgroundColor: ['#EF4444', '#F59E0B', '#10B981'],
          borderWidth: 0
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%', 
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } } 
      }
    });
  }

  if (ctxBottleneck) {
    charts.bottleneck = new Chart(ctxBottleneck, {
      type: 'bar',
      data: {
        labels: metrics.bottleneckData.map(c => c.title),
        datasets: [{
          label: 'Qtd. Tarefas',
          data: metrics.bottleneckData.map(c => c.count),
          backgroundColor: metrics.bottleneckData.map(c => c.color),
          borderRadius: 4
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', 
        plugins: { legend: { display: false } } 
      }
    });
  }
}

/**
 * Inicia a atualização automática do dashboard
 * @param {Function} refreshFn - Função a chamar para atualizar
 */
function startDashboardAutoRefresh(refreshFn) {
  stopDashboardAutoRefresh();
  dashboardRefreshInterval = setInterval(() => {
    const dash = document.getElementById('dashboardSection');
    if (dash && dash.style.display !== 'none') {
      refreshFn();
    }
  }, 60000); // 60 segundos
}

/**
 * Para a atualização automática do dashboard
 */
function stopDashboardAutoRefresh() {
  if (dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = null;
  }
}
