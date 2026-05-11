/**
 * MB FLOWBOARD — js/app.js
 * Orquestrador principal — API e fonte da verdade
 */
'use strict';

console.log("KANBAN NEW VERSION LOADED");

/* ════════ ESTADO GLOBAL ════════ */
let state = {
  title: 'Meu Quadro',
  profile: { name: 'Usuario', color: '#2563EB', focusTime: 25, breakTime: 5 },
  columns: [], archived: [], history: {}
};

let isTransitioning = false;
let dragColSrcId    = null;
let currentView     = 'board';
let showDashboard   = false;

const appFilters = { searchTerm: '', priority: 'all', tag: 'all', exactDateFilter: '' };

/* ════════ COLUNAS PADRÃO ════════ */
const DEFAULT_COLS = [
  { title: 'A Fazer',      color: '#2563EB' },
  { title: 'Em Progresso', color: '#FFB347' },
  { title: 'Revisao',      color: '#4FC3F7' },
  { title: 'Concluido',    color: '#43D9AD' }
];

/* ════════ CONVERTE TAREFAS DA API → COLUNAS ════════
   Regra: API e fonte da verdade para cards.
   localStorage so guarda: title, emoji, profile, archived, history, estrutura de colunas (sem cards).
*/
function buildColumnsFromAPI(tarefas, savedCols) {
  // Usa estrutura salva localmente (IDs, nomes, cores, limites) ou cria padrao
  let cols;
  if (savedCols && savedCols.length > 0) {
    cols = savedCols.map(c => ({ ...c, cards: [] }));
  } else {
    cols = DEFAULT_COLS.map(d => ({ id: uid(), title: d.title, color: d.color, limit: 0, cards: [] }));
  }

  // Obtém IDs que estão na fila para serem deletados (Outbox) de forma segura
  // Isso evita que tarefas excluídas offline "voltem" ao recarregar a página
  const outbox = (window.Sync && typeof window.Sync.getOutbox === 'function') ? window.Sync.getOutbox() : [];
  const pendingDeletes = new Set(
    outbox.filter(op => op && op.method === 'DELETE').map(op => String(op.id))
  );

  // Distribui tarefas da API nas colunas pelo nome
  (tarefas || []).forEach(t => {
    // Tenta obter o ID de múltiplas propriedades comuns em APIs (id ou _id)
    const taskId = String(t.id || t._id || '');
    if (!taskId || pendingDeletes.has(taskId)) return; 

    const col = cols.find(c => c.title === t.coluna);
    if (col) col.cards.push({
      id:             taskId,
      title:          t.titulo        || '',
      desc:           t.desc          || '',
      priority:       t.priority      || 'low',
      date:           t.date          || '',
      tags:           Array.isArray(t.tags)      ? t.tags      : [],
      checklist:      Array.isArray(t.checklist) ? t.checklist : [],
      totalFocusTime: t.totalFocusTime || 0,
      createdAt:      t.createdAt      || new Date().toISOString()
    });
  });
  return cols;
}

/* ════════ SALVA METADADOS LOCAIS (sem cards) ════════ */
function saveMetadata() {
  const meta = {
    title:    state.title,
    profile:  state.profile,
    archived: state.archived,
    history:  state.history,
    lastView: state.lastView || 'board',
    // Salva estrutura das colunas (sem cards — cards vem da API)
    columns: state.columns.map(c => ({ id: c.id, title: c.title, color: c.color, limit: c.limit || 0, cards: [] }))
  };
  try { localStorage.setItem('kanflow_state', JSON.stringify(meta)); } catch(e) {}
}

/* ════════ INIT APP — FONTE DA VERDADE E A API ════════ */
async function initApp() {
  localStorage.removeItem('oldPendingDeletes');

  // 1. Carrega metadados locais
  let local = {};
  try { local = JSON.parse(localStorage.getItem('kanflow_state') || '{}'); } catch(e) {}

  state.title    = local.title    || 'Meu Quadro';
  state.profile  = local.profile  || state.profile;
  state.archived = Array.isArray(local.archived) ? local.archived : [];
  state.history  = local.history  || {};
  state.lastView = local.lastView || 'board';
  showDashboard  = state.lastView === 'dashboard';

  // 2. Busca tarefas da API (fonte da verdade)
  try {
    console.log("🔍 Iniciando busca de tarefas...");
    const tarefas = await window.API.fetchTarefas();
    const ind = document.getElementById('offlineIndicator');
    if(ind) ind.style.display = 'none';
    state.columns = buildColumnsFromAPI(tarefas, local.columns);
    saveMetadata();
    console.log('✅ API:', tarefas.length, 'tarefas carregadas');
  } catch (err) {
    console.warn('📶 API indisponivel — modo offline:', err.message);
    // Offline: usa estrutura local com cards vazios (nao mostra dados desatualizados)
    state.columns = buildColumnsFromAPI([], local.columns);
    showToast('📴 Servidor offline. Aguardando conexao...', 5000);
  }

  render();

  // 3. Gerenciamento Profissional de PWA (Auto-update)
  setupPWAUpdates();

  setTimeout(async () => {
    const pendentes = window.Sync.getOutbox();
    if (pendentes.length > 0) {
      showToast('⏳ Sincronizando ' + pendentes.length + ' operacao(oes) pendente(s)...');
      await window.Sync.processOutbox();
      // Recarrega a partir da API para confirmar estado final
      try {
        await window._reloadAfterSync();
        showToast('✅ Sincronizado!');
      } catch(e) { /* servidor ainda dormindo */ }
    }
  }, 2000);
}

/**
 * Configura a detecção de novas versões do PWA
 */
function setupPWAUpdates() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    const progressUI = document.getElementById('pwa-install-progress');
    const progressFill = document.getElementById('progress-fill');

    // Se houver um novo SW sendo instalado
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      
      // Mostra indicador de progresso
      if (progressUI) progressUI.style.display = 'block';

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installing' && progressFill) {
            progressFill.style.width = '45%'; // Progresso simulado de download
        }

        // Quando o novo SW estiver instalado e pronto para ativar
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (progressFill) progressFill.style.width = '100%';
          setTimeout(() => { if (progressUI) progressUI.style.display = 'none'; }, 1000);
          showUpdateNotification(newWorker);
        }
      });
    });
  });

  // Recarrega a página automaticamente quando o novo SW assumir o controle
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

/**
 * Exibe o Toast/Botão de "Nova Versão Disponível"
 */
function showUpdateNotification(worker) {
  const toast = document.createElement('div');
  toast.className = 'update-toast glass fade-in';
  toast.innerHTML = `
    <div class="update-content">
      <p>🚀 <strong>Nova versão disponível!</strong></p>
      <button id="btnUpdateApp" class="btn-update">Atualizar Agora</button>
    </div>
  `;
  document.body.appendChild(toast);

  document.getElementById('btnUpdateApp').addEventListener('click', () => {
    playMelody('start');
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}

// Recarrega o estado a partir da API (fonte da verdade)
window._reloadAfterSync = async function reloadAfterSync() {
  const tarefas = await window.API.fetchTarefas();
  state.columns = buildColumnsFromAPI(tarefas, state.columns);
  saveMetadata();
  render();
};

/**
 * Reverte uma exclusão otimista caso o servidor falhe
 */
window._revertDelete = function(card, colId) {
  const col = state.columns.find(c => c.id === colId);
  if (col) {
    col.cards.push(card);
    saveMetadata();
    render();
    showToast(`⚠️ Falha ao excluir: "${card.title}" foi restaurada.`, 4000);
  }
};

/* ════════ THEME ENGINE ════════ */
function applyTheme(name) {
  // Simplesmente aplica a classe ao body. O CSS cuida das variáveis.
  const themeClass = (name === 'theme-light' || name === 'theme-dark') ? name : 'theme-dark';
  document.body.className = themeClass;
  if (typeof saveTheme === 'function') saveTheme(name);
}

/* ════════ POMODORO ════════ */
let activeFocusCardId=null, pomodoroInterval=null, tabFlashInterval=null;
let completedPomodoros=0, isPomodoroBreak=false, timeLeft=0;

function togglePomodoro(cardId) {
  if (activeFocusCardId===cardId){stopPomodoro();return;}
  stopPomodoro();
  activeFocusCardId=cardId; isPomodoroBreak=false;
  timeLeft=(state.profile.focusTime||25)*60;
  playMelody('start'); requestNotificationPermission();
  document.getElementById('pomodoroContainer').style.display='block';
  updateTimerDisplay();
  pomodoroInterval=setInterval(()=>{
    timeLeft--;updateTimerDisplay();
    if(timeLeft<=0){
      const spent=(state.profile.focusTime||25)*60;
      const col=state.columns.find(c=>c.cards.some(k=>k.id===activeFocusCardId));
      const card=col?.cards.find(k=>k.id===activeFocusCardId);
      if(card)card.totalFocusTime=(card.totalFocusTime||0)+spent;
      completedPomodoros++;
      const isLong=completedPomodoros%4===0;
      const breakMins=isLong?(state.profile.breakTime*3):(state.profile.breakTime||5);
      stopPomodoro(false); startPomodoroBreak(breakMins,isLong); startTabFlash();
      if(isLong)playMelody('longBreak');else playMelody('end');
      sendSystemNotification(isLong?'🏆 Super Foco!':'🎉 Pomodoro Concluido!',isLong?'4 Ciclos!':'Pausa curta iniciada.');
      playTick(440,0.8,0.1,true);
      showToast(isLong?'🏆 4 Ciclos! Descanso Longo.':'🎉 Ciclo concluido! Pausa iniciada.');
    }
  },1000);
  render(); showToast('🎯 Foco: '+(state.profile.focusTime||25)+'min');
}
function stopPomodoro(hide=true){
  clearInterval(pomodoroInterval); activeFocusCardId=null; isPomodoroBreak=false;
  if(hide)document.getElementById('pomodoroContainer').style.display='none';
  const d=document.querySelector('.pomodoro-display');
  if(d){d.style.background='';d.style.borderColor='';d.style.color='';}
  stopTabFlash(); document.title='MB - FlowBoard — '+(state.title||'Meu Quadro'); render();
}
function startPomodoroBreak(minutes){
  isPomodoroBreak=true; timeLeft=minutes*60;
  const d=document.querySelector('.pomodoro-display');
  if(d){d.style.background='rgba(16,185,129,0.15)';d.style.borderColor='rgba(16,185,129,0.3)';d.style.color='var(--accent3)';}
  document.getElementById('pomodoroContainer').style.display='block';
  updateTimerDisplay();
  pomodoroInterval=setInterval(()=>{timeLeft--;updateTimerDisplay();if(timeLeft<=0){stopPomodoro();startTabFlash();playMelody('end');showToast('⌛ Pausa finalizada!');}},1000);
}
function startTabFlash(){
  if(tabFlashInterval)return; let isAlert=true;
  const orig='MB - FlowBoard — '+(state.title||'Meu Quadro');
  tabFlashInterval=setInterval(()=>{document.title=isAlert?'🚨 TEMPO ESGOTADO! 🚨':orig;isAlert=!isAlert;},1000);
}
function stopTabFlash(){if(tabFlashInterval){clearInterval(tabFlashInterval);tabFlashInterval=null;}document.title='MB - FlowBoard — '+(state.title||'Meu Quadro');}
function updateTimerDisplay(){
  const m=Math.floor(timeLeft/60),s=timeLeft%60;
  const ms=String(m).padStart(2,'0'),ss=String(s).padStart(2,'0');
  document.getElementById('timerMinutes').textContent=ms;
  document.getElementById('timerSeconds').textContent=ss;
  const bm=document.getElementById('bigTimerMinutes'),bs=document.getElementById('bigTimerSeconds');
  if(bm)bm.textContent=ms; if(bs)bs.textContent=ss;
  const cy=document.getElementById('pomodoroCycles');
  if(cy)cy.textContent=Array.from({length:4},(_,i)=>i<completedPomodoros%4?'🟢':'⚪').join('');
  document.title='('+(isPomodoroBreak?'☕ ':'')+ms+':'+ss+') '+(state.title||'MB FlowBoard');
}
function renderFocusView(){
  const sec=document.getElementById('focusModeSection');
  if(!activeFocusCardId){sec.style.display='none';document.body.classList.remove('focus-mode-active');return;}
  const col=state.columns.find(c=>c.cards.some(k=>k.id===activeFocusCardId));
  const card=col?.cards.find(k=>k.id===activeFocusCardId);
  if(!card)return;
  document.body.classList.add('focus-mode-active'); sec.style.display='flex';
  document.getElementById('focusTaskTitle').textContent=card.title;
  document.getElementById('focusTaskDesc').textContent=card.desc||'Foco total nesta tarefa.';
  const b=document.getElementById('focusPrioBadge');
  b.textContent=card.priority.toUpperCase(); b.className='card-due-badge prio-'+card.priority;
  lucide.createIcons();
}

/* ════════ CARD HTML ════════ */
const EMOJI_LIST=['💡','🌟','✨','✅','🎉','📝','📌','🗓️','📊','💻','📱','💬','⚠️','🔄','➕','📚','📁','🔗','🗑️','🌎','☀️','🌈','🔥','💖','🤔','⏳','⏰','📆','📈','📉','🛠️','🔒','🔔','📢','🎁','🎓','💼','🏡','🚗','✈️','⛵','🍕','☕','💪','🧠','👀','🎤','🎧','🎸','🎮','🎥','🎨','🎵','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','🌙','⭐','🏆','🦄','🐱','🐶','🍀'];

function buildCardHTML(card,isDone,hasPrev,hasNext){
  const ds=getDeadlineStatus(card.date,isDone);
  const isFocus=activeFocusCardId===card.id;
  let badge='';
  if(ds==='overdue')   badge='<span class="card-due-badge overdue">🔴 Atrasada</span>';
  if(ds==='due-today') badge='<span class="card-due-badge due-today">⚠️ Hoje</span>';
  if(ds==='due-soon')  badge='<span class="card-due-badge due-soon">⏰ '+getDaysDiff(card.date)+'d</span>';
  const dateStr=card.date?'<span class="card-date">📅 '+formatDate(card.date)+'</span>':'<span></span>';
  const total=(card.checklist||[]).length, done=(card.checklist||[]).filter(i=>i.completed).length;
  const chk=total>0?'<div class="card-checklist-progress"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'+done+'/'+total+'</div>':'';
  const cls=['card',ds==='overdue'?'card-overdue':'',(ds==='due-soon'||ds==='due-today')?'card-due-soon':'',isFocus?'is-focusing':''].filter(Boolean).join(' ');
  return '<div class="'+cls+'" draggable="true" data-card-id="'+card.id+'" role="listitem" aria-label="'+escapeHtml(card.title)+'">'+
    '<div class="card-priority-bar '+card.priority+'" aria-hidden="true"></div>'+
    '<div class="card-title">'+escapeHtml(card.title)+'</div>'+
    '<div class="card-tags">'+buildTagsHTML(card.tags)+' '+badge+'</div>'+
    chk+(card.desc?'<div class="card-desc">'+escapeHtml(card.desc)+'</div>':'')+
    '<div class="card-footer">'+dateStr+
    '<div class="card-actions">'+
    (hasPrev?'<button class="card-btn prev-col" data-card="'+card.id+'" title="Anterior"><i data-lucide="chevron-left" size="14"></i></button>':'')+
    '<button class="card-btn edit"    data-card="'+card.id+'" title="Editar"><i data-lucide="pencil" size="14"></i></button>'+
    '<button class="card-btn focus"   data-card="'+card.id+'" title="Foco"><i data-lucide="play" size="14"></i></button>'+
    '<button class="card-btn archive" data-card="'+card.id+'" title="Arquivar"><i data-lucide="archive" size="14"></i></button>'+
    '<button class="card-btn delete"  data-card="'+card.id+'" title="Excluir"><i data-lucide="trash-2" size="14"></i></button>'+
    (hasNext?'<button class="card-btn next-col" data-card="'+card.id+'" title="Proximo"><i data-lucide="chevron-right" size="14"></i></button>':'')+
    '</div></div></div>';
}

/* ════════ COLUNA HTML ════════ */
function buildColumn(col,isDone,hasPrev,hasNext){
  const exceeded=col.limit>0&&col.cards.length>col.limit;
  const progress=col.limit>0?Math.min((col.cards.length/col.limit)*100,100):0;
  const el=document.createElement('div');
  const isEmpty=col.cards.length===0;
  el.className='column'+(exceeded?' limit-exceeded':'')+(col.cards.length===0?' column-is-empty':'');
  el.dataset.colId=col.id;
  el.setAttribute('role','listitem');
  el.innerHTML=
    '<div class="column-header" data-col-id="'+col.id+'">'+
    '<div class="column-drag-handle" draggable="true" title="Arrastar coluna"><i data-lucide="grip-vertical" size="16"></i></div>'+
    '<div class="column-title-wrap"><span class="column-title">'+escapeHtml(col.title)+'</span>'+
    '<span class="column-count">'+col.cards.length+(col.limit>0?' / '+col.limit:'')+'</span></div>'+
    '<div class="column-actions">'+
    '<button class="col-btn edit" data-col="'+col.id+'" title="Editar"><i data-lucide="pencil" size="14"></i></button>'+
    '<button class="col-btn delete" data-col="'+col.id+'" title="Excluir"><i data-lucide="trash-2" size="14"></i></button>'+
    '</div><div class="column-header-accent" style="background:'+col.color+'"></div></div>'+
    (col.limit>0?'<div class="column-progress-container"><div class="column-progress-bar" style="width:'+progress+'%;background:'+(exceeded?'var(--accent2)':col.color)+'"></div></div>':'')+
    '<div class="cards-area" data-col-id="'+col.id+'" role="list">'+
    col.cards.map(c=>buildCardHTML(c,isDone,hasPrev,hasNext)).join('')+ // Cards
    '<button class="add-card-btn" data-col="'+col.id+'">'+
    (isEmpty 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>' 
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>') +
    ' Adicionar tarefa</button>'+ // Button
    '</div>'; // Close cards-area

// DnD centralizado: initDragDropArea desativado aqui para evitar duplicidade com js/dragdrop.js
// initDragDropArea(el.querySelector('.cards-area'), state, render);

  const handle=el.querySelector('.column-drag-handle');
  if(handle){
    handle.addEventListener('dragstart',e=>{e.stopPropagation();dragColSrcId=col.id;el.classList.add('col-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',col.id);playTick(300,0.1,0.03);});
    handle.addEventListener('dragend',()=>{el.classList.remove('col-dragging');document.querySelectorAll('.column').forEach(c=>c.classList.remove('col-drag-over'));dragColSrcId=null;});
  }
  el.addEventListener('dragover',e=>{if(!dragColSrcId||dragColSrcId===col.id)return;e.preventDefault();e.stopPropagation();document.querySelectorAll('.column').forEach(c=>c.classList.remove('col-drag-over'));el.classList.add('col-drag-over');});
  el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget))el.classList.remove('col-drag-over');});
  el.addEventListener('drop',e=>{
    if(!dragColSrcId||dragColSrcId===col.id)return;
    e.preventDefault();e.stopPropagation();el.classList.remove('col-drag-over');
    const si=state.columns.findIndex(c=>c.id===dragColSrcId);
    const ti=state.columns.findIndex(c=>c.id===col.id);
    if(si<0||ti<0)return;
    const[m]=state.columns.splice(si,1);state.columns.splice(ti,0,m);
    dragColSrcId=null;saveMetadata();render();showToast('↔️ Coluna reordenada!');playTick(380,0.3,0.06,true);
  });

  el.querySelector('.col-btn.edit').addEventListener('click',()=>openColumnModal(col.id,state));
  el.querySelector('.col-btn.delete').addEventListener('click',()=>{
    const msg=col.cards.length>0?'Excluir "'+col.title+'" e '+col.cards.length+' tarefa(s)?':'Excluir "'+col.title+'"?';
    openConfirm(msg,()=>{state.columns=state.columns.filter(c=>c.id!==col.id);saveMetadata();render();showToast('🗑️ Coluna excluida.');});
  });
  el.querySelector('.add-card-btn').addEventListener('click',()=>openCardModal(col.id,null,state));
  return el;
}

/* ════════ RENDER ════════ */
function render(){
  if(isTransitioning)return;
  const board=document.getElementById('board');
  const dash=document.getElementById('dashboardSection');
  if(showDashboard){board.style.display='none';dash.style.display='grid';requestAnimationFrame(()=>renderDashboard(state,dash));}
  else{dash.style.display='none';board.style.display=currentView==='list'?'block':'flex';}
  if(activeFocusCardId&&!showDashboard){renderFocusView();board.style.display='none';return;}
  else if(!activeFocusCardId){document.body.classList.remove('focus-mode-active');const fs=document.getElementById('focusModeSection');if(fs)fs.style.display='none';}
  board.className=currentView==='list'?'board view-list':'board';
  if(!showDashboard)board.innerHTML='';
  const td=document.getElementById('boardTitleDisplay');
  if(td)td.textContent=state.title||'Meu Quadro';
  updateAvatarDisplay(state.profile);
  const doneCol=state.columns.find(c=>c.title.toLowerCase().includes('conclu'));
  const ctr=document.getElementById('completedCounter');
  if(ctr)ctr.innerHTML='<i data-lucide="check-circle-2"></i> '+(doneCol?doneCol.cards.length:0);
  if(state.columns.length===0){board.innerHTML='<div class="empty-board"><i data-lucide="layout-template" size="64" style="opacity:0.2;margin-bottom:16px"></i><h3>Nenhuma coluna ainda</h3><p>Clique em <strong>+ Coluna</strong> no topo.</p></div>';return;}
  const pw={high:3,medium:2,low:1};
  state.columns.forEach((col,idx)=>{
    const isDone=col.title.toLowerCase().includes('conclu')||col.title.toLowerCase().includes('done');
    const cards=col.cards.filter(c=>cardMatchesFilters(c,appFilters,isDone));
    cards.sort((a,b)=>(pw[b.priority]||0)-(pw[a.priority]||0));
    board.appendChild(buildColumn({...col,cards},isDone,idx>0,idx<state.columns.length-1));
  });

  lucide.createIcons();

  // Re-ativar DnD (cards) exclusivamente pelo js/dragdrop.js
  if (window.DragDrop && typeof window.DragDrop.initAllDragDrop === 'function') {
    window.DragDrop.initAllDragDrop(state, render);
  }
}

/* ════════ MODAIS ════════ */
function openModal(id){const el=document.getElementById(id);if(el)el.classList.add('open');}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.remove('open');}

function activateTitleEdit(){
  const span=document.getElementById('boardTitleDisplay');
  const input=document.createElement('input');
  input.type='text';input.value=state.title||'Meu Quadro';input.className='board-title-input';input.maxLength=30;
  span.replaceWith(input);input.focus();input.select();
  let saved=false;
  const save=()=>{if(saved)return;saved=true;state.title=input.value.trim()||'Meu Quadro';saveMetadata();render();showToast('✏️ Titulo atualizado!');};
  const cancel=()=>{if(saved)return;saved=true;render();};
  input.addEventListener('blur',save);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){input.removeEventListener('blur',save);save();}if(e.key==='Escape'){input.removeEventListener('blur',save);cancel();}});
}

function openArchiveModal(){
  const list=document.getElementById('archiveList'),btn=document.getElementById('clearArchiveBtn');
  list.innerHTML='';
  if(!state.archived.length){list.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma tarefa arquivada.</p>';if(btn)btn.style.display='none';}
  else{
    if(btn)btn.style.display='block';
    state.archived.forEach(card=>{
      const item=document.createElement('div');item.className='archive-item';
      item.innerHTML='<div class="archive-item-info"><h4>'+escapeHtml(card.title)+'</h4><p>'+(card.desc?escapeHtml(card.desc).slice(0,40)+'...':'Sem descricao')+'</p><span class="archive-item-date">Arquivado em: '+formatFullDate(card.archivedAt)+'</span></div><div class="archive-item-actions"><button class="btn-icon btn-ghost btn-restore" data-id="'+card.id+'" title="Restaurar">⬆️</button><button class="btn-icon btn-ghost btn-danger-hover btn-del-archive" data-id="'+card.id+'" title="Excluir">🗑️</button></div>';
      item.querySelector('.btn-restore').addEventListener('click',()=>{const i=state.archived.findIndex(c=>c.id===card.id);if(i<0)return;const[r]=state.archived.splice(i,1);if(state.columns.length)state.columns[0].cards.push(r);saveMetadata();render();openArchiveModal();showToast('♻️ Tarefa restaurada!');});
      item.querySelector('.btn-del-archive').addEventListener('click',()=>{openConfirm('Excluir permanentemente?',()=>{state.archived=state.archived.filter(c=>c.id!==card.id);saveMetadata();openArchiveModal();showToast('🗑️ Excluida.');});});
      list.appendChild(item);
    });
  }
  openModal('archiveModal');
}

/* ════════ INICIALIZACAO ════════ */
document.addEventListener('DOMContentLoaded', async () => {

  applyTheme(loadTheme());

  document.getElementById('themeToggleBtn')?.addEventListener('click',()=>{
    const novo=document.body.classList.contains('theme-light')?'theme-dark':'theme-light';
    applyTheme(novo);showToast(novo==='theme-light'?'☀️ Modo claro':'🌙 Modo escuro');
  });

  initFilters(state,appFilters,render);
  initShortcuts(state,render,openCardModal,saveMetadata,undo,redo);
  initTasksEvents(state,render,cardId=>{if(activeFocusCardId===cardId)stopPomodoro();});

  document.getElementById('userProfileTrigger')?.addEventListener('click',()=>openProfileModal(state));
  document.getElementById('saveProfileBtn')?.addEventListener('click',()=>saveProfile(state));
  document.getElementById('closeProfileModal')?.addEventListener('click',()=>closeModal('profileModal'));

  document.getElementById('toggleDashboardBtn')?.addEventListener('click',()=>{
    showDashboard=!showDashboard;state.lastView=showDashboard?'dashboard':'board';saveMetadata();
    if(showDashboard)renderDashboard(state,document.getElementById('dashboardSection'));render();
  });

  document.getElementById('boardTitleDisplay')?.addEventListener('click',activateTitleEdit);
  document.getElementById('boardTitleDisplay')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activateTitleEdit();}});
  document.getElementById('toggleViewBtn')?.addEventListener('click', toggleView);
  document.getElementById('openArchiveBtn')?.addEventListener('click',openArchiveModal);
  document.getElementById('closeArchiveModal')?.addEventListener('click',()=>closeModal('archiveModal'));
  document.getElementById('clearArchiveBtn')?.addEventListener('click',()=>{if(!state.archived.length)return;openConfirm('Excluir todas as tarefas arquivadas?',()=>{state.archived=[];saveMetadata();openArchiveModal();showToast('🧹 Arquivo limpo!');});});
  document.getElementById('emergencyResetBtn')?.addEventListener('click', () => { if (typeof emergencyReset === 'function') emergencyReset(); });
  document.getElementById('clearBoardBtn')?.addEventListener('click',()=>openConfirm('Limpar todo o quadro?',()=>{state.columns=[];saveMetadata();render();showToast('🧹 Quadro limpo!');} ));
  document.getElementById('exportBoardBtn')?.addEventListener('click',()=>{
    try{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mb-flowboard-'+new Date().toISOString().split('T')[0]+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('💾 Exportado!');}catch{showToast('❌ Erro ao exportar.');}
  });
  document.getElementById('printBoardBtn')?.addEventListener('click',()=>{showToast('🖨️ Preparando...');setTimeout(()=>window.print(),300);});
  document.getElementById('moreActionsBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('moreDropdown').classList.toggle('open');});
  window.addEventListener('click',()=>document.getElementById('moreDropdown')?.classList.remove('open'));
  document.getElementById('stopTimerBtn')?.addEventListener('click',stopPomodoro);
  document.getElementById('quitFocusBtn')?.addEventListener('click',stopPomodoro);

  // Som de clique global nos botões
  document.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.btn-icon') || e.target.closest('.col-btn') || e.target.closest('.card-btn')) {
      playMelody('click');
    }
  });

  // Parallax sutil e Faíscas para colunas vazias
  document.getElementById('board')?.addEventListener('mousemove', e => {
    const col = e.target.closest('.column');
    if (col && col.classList.contains('column-is-empty')) {
      const rect = col.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left);
      const mouseY = (e.clientY - rect.top);
      const x = mouseX / 15;
      const y = mouseY / 15;
      col.style.setProperty('--mouse-x', `${mouseX}px`);
      col.style.setProperty('--mouse-y', `${mouseY}px`);
      col.style.setProperty('--grid-x', `${x}px`);
      col.style.setProperty('--grid-y', `${y}px`);

      // Dispara faíscas (limitado por tempo para performance)
      const now = Date.now();
      if (!col._lastSpark || now - col._lastSpark > 100) {
        window.DragDrop.createSparkEffect(col, e.clientX, e.clientY);
        col._lastSpark = now;
      }
    }
  });

  window.addEventListener('online',()=>{
    const ind=document.getElementById('offlineIndicator');
    if(ind)ind.style.display='none';
    showToast('🌐 Conexao restaurada!');
    window.Sync.processOutbox().then(()=>{window.API.fetchTarefas().then(t=>{state.columns=buildColumnsFromAPI(t,state.columns);saveMetadata();render();});});
  });
  window.addEventListener('offline',()=>{const ind=document.getElementById('offlineIndicator');if(ind)ind.style.display='flex';showToast('📴 Sem conexao.');});

  // Delegacao de eventos do board
  document.getElementById('board').addEventListener('click', async e => {
    const focBtn=e.target.closest('.card-btn.focus');
    if(focBtn){togglePomodoro(focBtn.dataset.card);return;}

    const editBtn=e.target.closest('.card-btn.edit');
    if(editBtn){const col=state.columns.find(c=>c.cards.some(k=>k.id===editBtn.dataset.card));if(col)openCardModal(col.id,editBtn.dataset.card,state);return;}

    // ── EXCLUIR ──
    const delBtn=e.target.closest('.card-btn.delete');
    if(delBtn){
      const cardId=delBtn.dataset.card;
      const col=state.columns.find(c=>c.cards.some(k=>k.id===cardId));
      const card=col?.cards.find(k=>k.id===cardId);
      if(!col || !card || !cardId) return;

      openConfirm('Excluir "'+card.title+'"?',()=>{
        const ki=col.cards.findIndex(k=>k.id===cardId);
        if (ki === -1) return; // Evita remover o último item se o ID não for encontrado

        col.cards.splice(ki,1);
        if(activeFocusCardId===cardId)stopPomodoro();
        saveMetadata(); render();
        window.Sync.enqueue({method:'DELETE',id:cardId});
        showToast('🗑️ Tarefa excluida!');
      });
      return;
    }

    // ── MOVER → ──
    const nextBtn=e.target.closest('.card-btn.next-col');
    if(nextBtn){
      const cardId=nextBtn.dataset.card;
      const ci=state.columns.findIndex(c=>c.cards.some(k=>k.id===cardId));
      if(ci>=0&&ci<state.columns.length-1){
        const destTitle=state.columns[ci+1].title;
        const ki=state.columns[ci].cards.findIndex(k=>k.id===cardId);
        const[card]=state.columns[ci].cards.splice(ki,1);
        state.columns[ci+1].cards.push(card);
        saveMetadata();render();
        window.Sync.enqueue({method:'PUT',id:cardId,payload:{titulo:card.title,coluna:destTitle,desc:card.desc||'',date:card.date||'',tags:Array.isArray(card.tags)?card.tags:[],priority:card.priority||'low',checklist:Array.isArray(card.checklist)?card.checklist:[]}});
        showToast('➡️ Avancou para '+destTitle+'!');
      }
      return;
    }

    // ── MOVER ← ──
    const prevBtn=e.target.closest('.card-btn.prev-col');
    if(prevBtn){
      const cardId=prevBtn.dataset.card;
      const ci=state.columns.findIndex(c=>c.cards.some(k=>k.id===cardId));
      if(ci>0){
        const destTitle=state.columns[ci-1].title;
        const ki=state.columns[ci].cards.findIndex(k=>k.id===cardId);
        const[card]=state.columns[ci].cards.splice(ki,1);
        state.columns[ci-1].cards.push(card);
        saveMetadata();render();
        window.Sync.enqueue({method:'PUT',id:cardId,payload:{titulo:card.title,coluna:destTitle,desc:card.desc||'',date:card.date||'',tags:Array.isArray(card.tags)?card.tags:[],priority:card.priority||'low',checklist:Array.isArray(card.checklist)?card.checklist:[]}});
        showToast('⬅️ Voltou para '+destTitle+'!');
      }
      return;
    }

    // ── ARQUIVAR ──
    const arcBtn=e.target.closest('.card-btn.archive');
    if(arcBtn){
      const cardId=arcBtn.dataset.card;
      const cardEl=arcBtn.closest('.card');
      const col=state.columns.find(c=>c.cards.some(k=>k.id===cardId));
      if(!col)return;
      cardEl.classList.add('card-exit');
      setTimeout(()=>archiveCard(col.id,cardId,state,render,stopPomodoro),280);
    }
  });

  // Inicia o app
  await initApp();

  startDashboardAutoRefresh(()=>{if(showDashboard)renderDashboard(state,document.getElementById('dashboardSection'));});
});
