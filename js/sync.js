/**
 * MB FLOWBOARD — js/sync.js
 * Fila de sincronizacao offline (Outbox Pattern)
 */
'use strict';

const OUTBOX_KEY = 'kanflow_outbox';
let syncTimer    = null;
let isSyncing    = false;

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}

function setOutbox(queue) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

function enqueue(op) {
  const queue = getOutbox();
  // Remove operacao anterior sobre o mesmo ID para evitar duplicatas
  const filtered = queue.filter(o => !(o.id === op.id && o.method === op.method));
  // Se ja tem DELETE pendente, ignora UPDATE
  if (op.method === 'PUT') {
    const hasDel = filtered.some(o => o.id === op.id && o.method === 'DELETE');
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
      console.log('✅ Sync OK:', op.method, op.id);
    } catch (err) {
      console.warn('⏳ Sync pendente:', op.method, op.id, err.message);
      remaining.push(op);
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
  if (status === 'syncing') {
    el.textContent = '⏳ Sincronizando...';
    el.style.color = 'var(--accent-light)';
    el.style.display = 'inline-block';
  } else if (status === 'pending') {
    el.textContent = '\u26A0\uFE0F ' + (count || 0) + ' pendente(s) — aguardando servidor';
    el.style.color = '#FFB347';
    el.style.display = 'inline-block';
  } else {
    el.textContent = '\u2705 Sincronizado';
    el.style.color = '#43D9AD';
    el.style.display = 'inline-block';
    setTimeout(function() { el.style.display = 'none'; }, 3000);
  }
}

window.Sync = { enqueue: enqueue, processOutbox: processOutbox, getOutbox: getOutbox };

window.addEventListener('online', function() {
  showToast('\uD83C\uDF10 Conexao restaurada! Sincronizando...');
  processOutbox();
});
