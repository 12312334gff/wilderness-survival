/* 荒野余生 3D · HUD 覆盖层（纯图形，无文字） */
const $ = (id) => document.getElementById(id);

const el = {
  loading: $('loading'),
  hud: $('hud'),
  energy: $('st-energy'),
  hunger: $('st-hunger'),
  thirst: $('st-thirst'),
  stamina: $('st-stamina'),
  dialIcon: $('dial-icon'),
  dial: $('daydial'),
  pips: $('day-pips'),
  prompt: $('prompt'),
  itWood: $('it-wood'),
  itStone: $('it-stone'),
  itCamp: $('it-camp'),
  bubbles: $('bubbles'),
  hitFlash: $('hitFlash'),
  vignette: $('vignette'),
  btnAction: $('btnAction'),
  gameover: $('gameover'),
  btnRestart: $('btnRestart')
};

let dead = false;

function setBar(node, v) {
  const p = Math.max(0, Math.min(1, v)) * 100;
  node.style.width = p.toFixed(1) + '%';
  node.parentElement.classList.toggle('low', p < 22);
}

function popSlot(node) {
  node.classList.remove('pop');
  void node.offsetWidth;
  node.classList.add('pop');
}

function bubble(icon, cls) {
  const b = document.createElement('div');
  b.className = 'bubble ' + (cls || '');
  b.textContent = icon;
  el.bubbles.appendChild(b);
  requestAnimationFrame(() => b.classList.add('show'));
  setTimeout(() => { b.classList.remove('show'); }, 1100);
  setTimeout(() => b.remove(), 1600);
}

/* 昼夜拨盘：环形进度 + 太阳/月亮图标 */
function setDial(t, night) {
  const arc = Math.max(0, Math.min(1, t));
  const face = el.dial.querySelector('.dial-face');
  if (face) face.style.setProperty('--p', (arc * 100).toFixed(1) + '%');
  el.dial.classList.toggle('night', night > 0.45);
  const icon = night > 0.45 ? '🌙' : '☀️';
  if (el.dialIcon.textContent !== icon) el.dialIcon.textContent = icon;
}

/* 第几天：用圆点表示 */
function setDay(dayNo) {
  const n = Math.min(5, Math.max(0, dayNo - 1));
  if (el.pips.children.length !== n) {
    el.pips.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i');
      el.pips.appendChild(d);
    }
  }
}

/* 交互提示：靠近树/石头时，按钮变高亮 */
function setPrompt(kind) {
  el.prompt.classList.toggle('show', !!kind);
  el.prompt.dataset.kind = kind || '';
  el.btnAction.classList.toggle('ready', !!kind);
  if (kind === 'rock') el.btnAction.querySelector('.act-icon').textContent = '⛏️';
  else if (kind === 'camp') el.btnAction.querySelector('.act-icon').textContent = '🔥';
  else el.btnAction.querySelector('.act-icon').textContent = '🪓';
}

/* 受击 */
function flash() {
  el.hitFlash.classList.remove('on');
  void el.hitFlash.offsetWidth;
  el.hitFlash.classList.add('on');
  if (navigator.vibrate) navigator.vibrate(60);
}

/* 夜间暗角 */
function setNight(night) {
  el.vignette.style.opacity = (night * 0.92).toFixed(2);
  document.body.classList.toggle('is-night', night > 0.5);
}

let lastStats = {};
window.HUDBridge = function (f) {
  if (dead) return;

  if (f.cmds && f.cmds.length) {
    for (const [k, v] of f.cmds) {
      switch (k) {
        case 'ready':
          el.loading.classList.add('gone');
          el.hud.classList.add('on');
          break;
        case 'wood':
          el.itWood.classList.add('got');
          popSlot(el.itWood);
          bubble('🪵');
          if (navigator.vibrate) navigator.vibrate(25);
          break;
        case 'stone':
          el.itStone.classList.add('got');
          popSlot(el.itStone);
          bubble('🪨');
          if (navigator.vibrate) navigator.vibrate(25);
          break;
        case 'camp':
          el.itCamp.classList.add('got');
          popSlot(el.itCamp);
          bubble('🔥');
          break;
        case 'near':
          setPrompt(v);
          break;
        case 'hit':
          flash();
          break;
        case 'thirst':
          bubble('💧', 'warn');
          break;
        case 'dead':
          die();
          break;
        default:
          break;
      }
    }
  }

  // 状态条
  if (f.cmds) {
    // 状态值由主循环以数字命令传入
  }
  if (typeof f.energy === 'number') setBar(el.energy, f.energy);
  if (typeof f.hunger === 'number') setBar(el.hunger, f.hunger);
  if (typeof f.thirst === 'number') setBar(el.thirst, f.thirst);
  if (typeof f.stamina === 'number') setBar(el.stamina, f.stamina);

  setDial(f.time || 0, f.night || 0);
  setDay(f.dayNo || 1);
  setNight(f.night || 0);
};

/* 主循环每帧会用到的数值命令 */
window.__stats = function (obj) {
  if (typeof obj.energy === 'number') setBar(el.energy, obj.energy);
  if (typeof obj.hunger === 'number') setBar(el.hunger, obj.hunger);
  if (typeof obj.thirst === 'number') setBar(el.thirst, obj.thirst);
  if (typeof obj.stamina === 'number') setBar(el.stamina, obj.stamina);
};

function die() {
  dead = true;
  el.gameover.classList.remove('hidden');
  requestAnimationFrame(() => el.gameover.classList.add('show'));
  if (window.__pause) window.__pause(true);
  if (navigator.vibrate) navigator.vibrate([120, 60, 200]);
}

el.btnRestart.addEventListener('click', () => {
  location.reload();
});

/* 防止双击缩放 */
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
/* 阻止页面滚动/回弹 */
document.addEventListener('touchmove', (e) => {
  if (e.target.closest && e.target.closest('#stick')) return;
  e.preventDefault();
}, { passive: false });

/* 手机横屏时：尝试锁定横屏 + 进入全屏，让画面上方没有地址栏 */
document.addEventListener('pointerdown', function tryImmersive() {
  document.removeEventListener('pointerdown', tryImmersive);
  const el = document.documentElement;
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* 桌面浏览器不支持 */ }
  try {
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
  } catch (e) { /* 被浏览器策略拒绝时忽略 */ }
}, { once: true });

/* 窗口尺寸变化时，重新居中受宽高比影响的元素 */
window.addEventListener('resize', () => {
  document.body.style.setProperty('--vh', window.innerHeight + 'px');
});
document.body.style.setProperty('--vh', window.innerHeight + 'px');