/**
 * MB FLOWBOARD — js/notifications.js
 * Toast · HUD de atalhos · Feedback sonoro (Web Audio)
 */

'use strict';

/* ── Web Audio Context ── */
let audioCtx = null;

/**
 * Toca um som simples via Web Audio API
 * @param {number} freq - Frequência em Hz
 * @param {number} duration - Duração em segundos
 * @param {number} vol - Volume (0 a 1)
 * @param {boolean} hasEcho - Adicionar eco
 * @param {string} type - Tipo de oscilador
 */
function playTick(freq = 250, duration = 0.1, vol = 0.04, hasEcho = false, type = 'sine') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    if (hasEcho) {
      const delay    = audioCtx.createDelay();
      const feedback = audioCtx.createGain();
      delay.delayTime.value = 0.15;
      feedback.gain.value   = 0.3;
      gain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(audioCtx.destination);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Silencia erros de bloqueio de áudio
  }
}

/**
 * Toca uma melodia de acordo com o contexto
 * @param {'start'|'end'|'longBreak'|'alert'|'magnetic'|'impact'|'shatter'|'shortCircuit'} type - Tipo de melodia
 * @param {string} priority - Prioridade para ajuste de tom (opcional)
 */
function playMelody(type = 'start', priority = 'low') {
  if (type === 'start') {
    playTick(440, 0.1, 0.05);
    setTimeout(() => playTick(880, 0.1, 0.04), 100);
  } else if (type === 'longBreak') {
    playTick(523.25, 0.15, 0.05, true); // C5
    setTimeout(() => playTick(659.25, 0.15, 0.05, true), 150); // E5
    setTimeout(() => playTick(783.99, 0.3,  0.05, true), 300); // G5
  } else if (type === 'alert') {
    // Som de alerta (Buzzer): Grave e ríspido para indicar bloqueio
    playTick(120, 0.25, 0.1, false, 'sawtooth');
    setTimeout(() => playTick(100, 0.3, 0.08, false, 'sawtooth'), 200);
  } else if (type === 'magnetic') {
    // Pulso magnético: Tom dinâmico baseado na prioridade
    const baseFreq = priority === 'high' ? 240 : (priority === 'medium' ? 185 : 140);
    playTick(baseFreq, 0.3, 0.1, true, 'sine');
    setTimeout(() => playTick(baseFreq * 0.66, 0.3, 0.07, true, 'sine'), 40);
  } else if (type === 'impact') {
    // Impacto suave: Grave e abafado para o drop em colunas vazias
    playTick(150, 0.4, 0.08, true, 'sine');
  } else if (type === 'shatter') {
    // Estilhaço de cristal: tons agudos e curtos com variação aleatória (feedback premium)
    for (let i = 0; i < 5; i++) {
      const freq = 1800 + Math.random() * 1200;
      const dur = 0.03 + Math.random() * 0.08;
      const delay = i * 25;
      setTimeout(() => playTick(freq, dur, 0.015, true, 'sine'), delay);
    }
  } else if (type === 'shortCircuit') {
    // Curto-circuito: Tons ríspidos e aleatórios (sawtooth) para faíscas
    const freq = 400 + Math.random() * 800;
    playTick(freq, 0.06, 0.02, false, 'sawtooth');
  } else {
    playTick(660, 0.2, 0.05, true);
    setTimeout(() => playTick(440, 0.3, 0.04, true), 200);
  }
}

/**
 * Exibe um Toast de notificação
 * @param {string} msg - Mensagem a exibir
 * @param {number} duration - Duração em ms (padrão 2400ms)
 */
function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/**
 * Remove o Toast imediatamente
 */
function clearToast() {
  const t = document.getElementById('toast');
  if (t) t.classList.remove('show');
}

/**
 * Exibe o HUD de atalho de teclado (feedback visual)
 * @param {string} msg - Descrição do atalho acionado
 */
function showShortcutHUD(msg) {
  const hud = document.createElement('div');
  hud.className = 'shortcut-hud';
  hud.textContent = `Atalho: ${msg}`;
  document.body.appendChild(hud);
  setTimeout(() => hud.remove(), 1500);
}

/**
 * Solicita permissão para notificações do navegador
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Dispara uma notificação do sistema operacional
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 */
function sendSystemNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: 'assets/logo/logo.png'
    });
  }
}
