/**
 * MB FLOWBOARD — js/sync.js
 * Fila de sincronizacao offline (Outbox Pattern)
 */
'use strict';

const OUTBOX_KEY = 'kanflow_outbox';
const LOG_KEY    = 'kanflow_sync_logs';
let syncTimer    = null;
let isSyncing    = false;

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}

function setOutbox(queue) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

/**
 * Registra logs de sincronização no localStorage para persistência
 */
function saveSyncLog(op, status, error = null) {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const entry = {
      ts: new Date().toISOString(),
      method: op.method, id: op.id, status, error: error?.message || error
    };
    logs.unshift(entry);
    // Limpeza automática: mantém apenas os últimos 50 logs para poupar localStorage
    localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {}
}

function enqueue(op) {
  const queue = getOutbox();

  // Remove duplicatas exatas (mesmo id + mesmo method)
  let filtered = queue.filter(o => o && !(String(o.id) === String(op.id) && o.method === op.method));

  // Se estamos enfileirando DELETE:
  // - remove qualquer PUT/UPDATE pendente anterior para o mesmo id
  //   (evita DELETE + PUT recriar a tarefa depois)
  if (op.method === 'DELETE') {
    filtered = filtered.filter(o => o && !(String(o.id) === String(op.id) && (o.method === 'PUT' || o.method === 'UPDATE')));
  }

  // Se estamos enfileirando PUT:
  // - ignora PUT se já existe um DELETE pendente para o mesmo id
  if (op.method === 'PUT') {
    const hasDel = filtered.some(o => o && String(o.id) === String(op.id) && o.method === 'DELETE');
    if (hasDel) return;
  }

  filtered.push({ ...op, ts: Date.now() });
  setOutbox(filtered);
  scheduleSync();
}

function scheduleSync(delay) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(processOutbox, delay || 2000);
}

async function processOutbox() {
  if (isSyncing) return;
  const queue = getOutbox();
  if (!queue.length) { updateSyncIndicator('synced'); return; }

  isSyncing = true;
  updateSyncIndicator('syncing');
  const remaining = [];

  for (const op of queue) {
    try {
      if (op.method === 'PUT') {
        await window.API.updateTarefa(op.id, op.payload);
      } else if (op.method === 'DELETE') {
        await window.API.deleteTarefa(op.id);
      }
      saveSyncLog(op, 'success');
      console.log(`✅ Sincronização Realizada: [${op.method}] ID: ${op.id}`);
    } catch (err) {
      // Se o servidor retornar 404, o item já sumiu do banco. 
      // Removemos da fila para evitar que ele bloqueie ou reapareça.
      if (err.message && err.message.includes('404')) {
        console.warn('🗑️ Item já removido no servidor:', op.id);
        saveSyncLog(op, 'success', '404 - Limpeza automática');
        continue; 
      }

      // Se estivermos online e a API rejeitar a exclusão (Erro 400, 500, etc)
      // Revertemos a UI Otimista restaurando o card
      if (window.navigator.onLine && op.method === 'DELETE' && op.cardBackup) {
        console.error('❌ Erro crítico na API. Revertendo exclusão:', op.id);
        if (window._revertDelete) {
          window._revertDelete(op.cardBackup, op.columnIdBackup);
        }
        saveSyncLog(op, 'reverted', `Erro API: ${err.message}. Tarefa restaurada.`);
        continue; // Remove da fila pois foi revertido
      }

      console.warn('⏳ Sync pendente:', op.method, op.id, err.message);
      remaining.push(op);
      saveSyncLog(op, 'failed', err.message);
    }
  }

  setOutbox(remaining);
  isSyncing = false;

  if (remaining.length > 0) {
    updateSyncIndicator('pending', remaining.length);
    scheduleSync(15000);
  } else {
    updateSyncIndicator('synced');
    // Recarrega da API após sync bem-sucedido para garantir consistência
    if (window._reloadAfterSync) {
      window._reloadAfterSync();
    }
  }
}

function updateSyncIndicator(status, count) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;

  el.classList.remove('sync-pending', 'sync-loading', 'sync-done');

  if (status === 'syncing') {
    el.innerHTML = '<span class="spin">⏳</span> Sincronizando...';
    el.classList.add('sync-loading');
    el.style.display = 'inline-block';
  } else if (status === 'pending') {
    el.innerHTML = '⚠️ <strong>' + (count || 0) + '</strong> operação(ões) pendente(s)';
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
  clearLogs: () => {
    localStorage.removeItem(LOG_KEY);
    console.log('🧹 Logs de sincronização limpos.');
  },
  showLogs: () => {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    console.log('%c📋 Histórico de Sincronização:', 'font-weight: bold; font-size: 1.2em; color: #7C3AED;');
    console.table(logs);
  }
};

window.addEventListener('online', function() {
  showToast('\uD83C\uDF10 Conexao restaurada! Sincronizando...');
  processOutbox();
});
