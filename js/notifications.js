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
 * @param {'start'|'end'|'longBreak'} type - Tipo de melodia
 */
function playMelody(type = 'start') {
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
