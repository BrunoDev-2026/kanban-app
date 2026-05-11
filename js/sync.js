/**
 * MB FLOWBOARD — js/sync.js
 * Fila de sincronizacao offline (Outbox Pattern)
 */
'use strict';

const OUTBOX_KEY = 'kanflow_outbox';
const LOG_KEY    = 'kanflow_sync_logs';
let syncTimer    = null;
let isSyncing    = false;

// API Health Check
const API_HEALTH_CHECK_INTERVAL = 10000; // 10 segundos
const API_DOWN_THRESHOLD = 6; // 6 tentativas * 10s = 1 minuto
let apiDownAttempts = 0;

// Configurações para Exponential Backoff
let retryAttempt = 0;
const BASE_DELAY = 2000; // 2 segundos
const MAX_DELAY  = 300000; // 5 minutos (máximo)
const MAX_RETRIES = 7; // Limite enterprise de tentativas

// Configurações para Log Expiration
const LOG_EXPIRATION_DAYS = 7; // Logs expiram após 7 dias

// Configurações para Alerta de LocalStorage
const LOCAL_STORAGE_ALERT_THRESHOLD = 0.9; // 90% da capacidade
const LOCAL_STORAGE_CHECK_INTERVAL = 60000; // A cada 1 minuto


function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}

function setOutbox(queue) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

/**
 * Gera um Jitter aleatório para evitar colisões de rede
 */
function getJitter() {
  return Math.random() * 1000;
}

/**
 * Registra logs de sincronização no localStorage para persistência
 */
function saveSyncLog(op, status, error = null, duration = null) {
  try {
    let logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const now = new Date();
    const expirationTime = now.getTime() - (LOG_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    // Remove logs expirados
    logs = logs.filter(entry => new Date(entry.ts).getTime() > expirationTime);

    const entry = {
      ts: now.toISOString(),
      method: op.method, id: op.id, status, 
      duration: duration ? `${(duration / 1000).toFixed(2)}s` : '-',
      error: error?.message || error
    };
    logs.unshift(entry);
    // Limpeza automática: mantém apenas os últimos 50 logs para poupar localStorage
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {}
}

function enqueue(op) {
  const queue = getOutbox();

  // Verifica se já existe um DELETE pendente para este ID para evitar duplicidade
  if (op.method === 'DELETE' && queue.some(o => o.id === op.id && o.method === 'DELETE')) {
    return;
  }

  // Verificação para remover tarefas duplicadas (mesmo ID):
  // Se já existe um DELETE pendente para este ID, ignoramos qualquer nova tentativa de edição (PUT).
  if (op.method === 'PUT') {
    const hasExistingDelete = queue.some(o => o && String(o.id) === String(op.id) && o.method === 'DELETE');
    if (hasExistingDelete) {
      console.log(`[Sync] Ignorando atualização para ${op.id} pois já existe uma exclusão pendente.`);
      return;
    }
  }

  // Removemos qualquer operação anterior para o mesmo ID.
  // Isso garante que apenas a última intenção do usuário seja processada, evitando duplicatas na fila.
  const filtered = queue.filter(o => o && String(o.id) !== String(op.id));

  filtered.push({ ...op, ts: Date.now() });
  setOutbox(filtered);
  retryAttempt = 0; // Reseta tentativas ao adicionar nova operação manual
  updateSyncIndicator('pending', filtered.length); // Atualiza indicador imediatamente
  scheduleSync(BASE_DELAY);
}

function scheduleSync(delay) {
  clearTimeout(syncTimer);
  const finalDelay = (delay || BASE_DELAY) + getJitter();
  console.log(`[Sync] Próxima tentativa em ${(finalDelay / 1000).toFixed(1)}s (Attempt: ${retryAttempt})`);
  syncTimer = setTimeout(processOutbox, finalDelay);
}

async function processOutbox() {
  if (isSyncing || !navigator.onLine) {
    console.log('[Sync] Processo pausado: isSyncing=', isSyncing, 'Online=', navigator.onLine);
    return;
  }
  
  try {
    let queue = getOutbox();

    // Filtrar IDs duplicados (mantendo apenas a operação mais recente para cada ID)
    const seenIds = new Set();
    queue = queue.reverse().filter(op => {
      if (!op || !op.id || seenIds.has(op.id)) return false;
      seenIds.add(op.id);
      return true;
    }).reverse();
    setOutbox(queue);

    if (!queue.length) { updateSyncIndicator('synced'); return; }
    
    isSyncing = true;
    updateSyncIndicator('syncing');
    const remaining = [];

    for (const op of queue) {
      const opStart = Date.now();
      // Timer para exibir tempo decorrido no log de progresso da UI
      const stepTimer = setInterval(() => {
        const elapsed = ((Date.now() - opStart) / 1000).toFixed(1);
        updateSyncIndicator('syncing', queue.length, `Enviando ${op.method}... (${elapsed}s)`);
      }, 100);

      try {
        // --- RESOLUÇÃO DE CONFLITOS ---
        // Busca a versão atual das tarefas para comparar timestamps
        const latestTasks = await window.API.fetchTarefas();
        const serverTask = latestTasks.find(t => String(t.id || t._id) === String(op.id));

        // --- RESOLUÇÃO DE CONFLITOS: CLIENT WINS (Última alteração local prevalece) ---
        // Compara o timestamp da operação local (op.ts) com o updatedAt do servidor.
        // Se o servidor tiver uma versão mais nova, a alteração local ainda será aplicada,
        // mas um aviso será registrado.
        if (serverTask && serverTask.updatedAt && new Date(serverTask.updatedAt).getTime() > op.ts) {
          const serverTime = new Date(serverTask.updatedAt).getTime();
          console.warn(`[Sync] Conflito detectado para ${op.id}. Servidor (${new Date(serverTime).toISOString()}) é mais novo que a operação local (${new Date(op.ts).toISOString()}), mas a alteração local será aplicada (Client Wins).`);
          saveSyncLog(op, 'conflict-client-wins', `Servidor é mais recente, mas a alteração local foi aplicada.`);
        }

        if (op.method === 'PUT') {
          await window.API.updateTarefa(op.id, op.payload);
        } else if (op.method === 'DELETE') {
          await window.API.deleteTarefa(op.id);
        }
        clearInterval(stepTimer);
        const duration = Date.now() - opStart;
        saveSyncLog(op, 'success', null, duration);
      } catch (err) {
        clearInterval(stepTimer);
        const duration = Date.now() - opStart;

        if (op.method === 'DELETE' && (err.status === 404 || err.message.includes('404'))) {
          console.log('🧹 Limpeza automática 404:', op.id);
          saveSyncLog(op, 'success', '404 - Limpeza automática', duration);
          continue;
        }

        if (window.navigator.onLine && op.method === 'DELETE' && op.cardBackup) {
          if (window._revertDelete) window._revertDelete(op.cardBackup, op.columnIdBackup);
          saveSyncLog(op, 'reverted', err.message, duration);
          continue; 
        }

        remaining.push(op);
        saveSyncLog(op, 'failed', err.message, duration);
      }
    }

    setOutbox(remaining);

    if (remaining.length > 0) {
      if (retryAttempt < MAX_RETRIES) {
        retryAttempt++;
        const nextDelay = Math.min(BASE_DELAY * Math.pow(2, retryAttempt), MAX_DELAY);
        updateSyncIndicator('pending', remaining.length, `Falha parcial. Retentando em breve...`);
        scheduleSync(nextDelay);
      } else {
        console.error('[Sync] Limite de tentativas atingido para alguns itens.');
        updateSyncIndicator('pending', remaining.length, '⚠️ Erro persistente no Sync');
        retryAttempt = 0; // Reseta para permitir nova tentativa manual
      }
    } else {
      retryAttempt = 0;
      updateSyncIndicator('synced');
      if (window._reloadAfterSync && window.navigator.onLine) window._reloadAfterSync();
    }
  } catch (criticalErr) {
    console.error('❌ Erro crítico no processo de sincronização:', criticalErr);
  } finally {
    isSyncing = false;
  }
}

/**
 * Atualiza o indicador de sincronização na UI
 * @param {string} detail - Mensagem opcional de progresso
 */
function updateSyncIndicator(status, count, detail = '') {
  const el = document.getElementById('syncIndicator');
  const pendingBtn = document.getElementById('pendingOperationsCountBtn');
  const pendingCountSpan = document.getElementById('pendingOperationsCount');

  if (!el) return;

  // Atualiza o botão de contagem de operações pendentes
  if (pendingCountSpan) {
    pendingCountSpan.textContent = count || 0;
  }
  if (pendingBtn) {
    pendingBtn.style.display = (count > 0) ? 'inline-flex' : 'none';
    pendingBtn.classList.toggle('pulse-warning', count > 0);
  }

  el.classList.remove('sync-pending', 'sync-loading', 'sync-done');

  if (status === 'syncing') {
    el.innerHTML = `<span class="spin">⏳</span> ${detail || 'Sincronizando...'}`;
    el.classList.add('sync-loading');
    el.style.display = 'inline-block';
  } else if (status === 'pending') {
    el.innerHTML = `
      ⚠️ <strong>${count || 0}</strong> pendente(s) 
      <button onclick="window.Sync.processOutbox()" class="btn-sync-retry" title="Tentar sincronizar agora">Sync</button>
      <button onclick="window.Sync.clearQueue()" class="btn-sync-retry" style="background:rgba(239,68,68,0.2)" title="Limpar fila de operações travadas">Limpar</button>
    `;
    el.classList.add('sync-pending');
    el.style.display = 'inline-block';
  } else {
    el.innerHTML = '✅ Sincronizado';
    el.classList.add('sync-done');
    el.style.display = 'inline-block';
    setTimeout(function() { if (!isSyncing && getOutbox().length === 0) el.style.display = 'none'; }, 3000);
  }
}

window.Sync = { 
  enqueue: enqueue, 
  processOutbox: processOutbox, 
  getOutbox: getOutbox,
  clearQueue: () => {
    isSyncing = false;
    clearTimeout(syncTimer);
    setOutbox([]);
    updateSyncIndicator('synced', 0);
    showToast('🧹 Fila de sincronização limpa!');
  },
  clearLogs: () => {
    localStorage.removeItem(LOG_KEY);
    console.log('🧹 Logs de sincronização limpos.');
  },
  showLogs: () => {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    console.log('%c📋 Histórico de Sincronização:', 'font-weight: bold; font-size: 1.2em; color: #2563EB;');
    console.table(logs);
  },
  listPendingOperations: () => {
    const outbox = getOutbox();
    if (outbox.length === 0) {
      console.log('%c✅ Nenhuma operação pendente na fila de sincronização.', 'color: #10B981;');
    } else {
      console.log('%c⏳ Operações pendentes na fila de sincronização:', 'font-weight: bold; font-size: 1.2em; color: #FFB347;');
      console.table(outbox);
    }
  },
  checkApiHealth: checkApiHealth
};

window.addEventListener('online', function() {
  showToast('\uD83C\uDF10 Conexao restaurada! Sincronizando...');
  processOutbox();
});

// --- API Health Check ---
let apiHealthCheckIntervalId = null;

async function checkApiHealth() {
  try {
    // Use a API_BASE_URL do window.API para a verificação
    const apiUrl = window.API.API_BASE_URL + '/tarefas';
    const response = await fetch(apiUrl, { method: 'HEAD', mode: 'cors' }); // HEAD é mais leve

    if (response.ok) {
      if (apiDownAttempts > 0) {
        console.log('✅ API Online novamente.');
        showToast('🌐 API Online novamente! Sincronizando...');
        if (typeof clearToast === 'function') setTimeout(clearToast, 3000);
        processOutbox(); // Tenta sincronizar imediatamente
      }
      apiDownAttempts = 0;
      updateApiDownIndicator(false);
    } else {
      throw new Error(`API retornou status ${response.status}`);
    }
  } catch (err) {
    apiDownAttempts++;
    console.warn(`❌ Falha na verificação de saúde da API (Tentativa ${apiDownAttempts}): ${err.message}`);
    if (apiDownAttempts >= API_DOWN_THRESHOLD) {
      updateApiDownIndicator(true, `API Indisponível há mais de ${API_DOWN_THRESHOLD * API_HEALTH_CHECK_INTERVAL / 1000} segundos.`);
    }
  }
}

function updateApiDownIndicator(isDown, message = '') {
  const offlineInd = document.getElementById('offlineIndicator');

  if (isDown) {
    // Muda a cor do badge de rede para Amber (Atenção) caso a API esteja fora
    if (offlineInd) {
      offlineInd.style.display = 'flex';
      offlineInd.classList.add('api-down');
      offlineInd.title = message || 'API Indisponível';
    }

    // Usa o sistema de Toast com duração de 10 minutos (persistente)
    if (typeof showToast === 'function') {
      showToast(`🛑 ${message || 'API Indisponível'}. Tentando reconectar...`, 600000);
    }
    console.error(`[API Monitor] ${message}`);
  } else {
    // Restaura o ícone caso a API volte (e o usuário esteja online)
    if (offlineInd && offlineInd.classList.contains('api-down')) {
      offlineInd.style.display = 'none';
      offlineInd.classList.remove('api-down');
    }

    // O toast de "Online novamente" cuidará da limpeza visual
    console.log('[API Monitor] API Online.');
  }
}

// Inicia o monitoramento da API quando o app é carregado
window.addEventListener('DOMContentLoaded', () => {
  if (apiHealthCheckIntervalId) clearInterval(apiHealthCheckIntervalId);
  apiHealthCheckIntervalId = setInterval(checkApiHealth, API_HEALTH_CHECK_INTERVAL);

  // Listener para o botão de contagem de operações pendentes
  const pendingBtn = document.getElementById('pendingOperationsCountBtn');
  const pendingCountSpan = document.getElementById('pendingOperationsCount');
  if (pendingBtn) {
    pendingBtn.addEventListener('click', () => {
      window.Sync.listPendingOperations();
      showToast('📋 Detalhes exibidos no console (F12).');
    });
    // Atualiza contagem inicial na carga da página
    const outboxSize = getOutbox().length;
    if (pendingCountSpan) pendingCountSpan.textContent = outboxSize;
    pendingBtn.style.display = outboxSize > 0 ? 'inline-flex' : 'none';
  }
  
  // Inicia o monitoramento de LocalStorage
  if (navigator.storage && navigator.storage.estimate) {
    setInterval(checkLocalStorageCapacity, LOCAL_STORAGE_CHECK_INTERVAL);
  }
});

async function checkLocalStorageCapacity() {
  try {
    const estimate = await navigator.storage.estimate();
    const usageRatio = estimate.usage / estimate.quota;

    if (usageRatio >= LOCAL_STORAGE_ALERT_THRESHOLD) {
      const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
      showToast(`⚠️ Armazenamento quase cheio! Usando ${usedMB}MB de ${quotaMB}MB.`, 10000);
      console.warn(`[LocalStorage] Quota quase atingida: ${usedMB}MB de ${quotaMB}MB (${(usageRatio * 100).toFixed(2)}%)`);
    }
  } catch (e) {
    console.error("[LocalStorage] Erro ao estimar capacidade:", e);
  }
}
