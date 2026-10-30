/* 荒野余生 · 极简音效（WebAudio 合成，无外部资源） */
(function (A) {
  'use strict';
  var ctx = null, enabled = true;
  try { enabled = localStorage.getItem('ws-sound') !== '0'; } catch (e) { /* ignore */ }

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when) {
    var c = ensure();
    if (!c) return;
    var t0 = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  var Audio = {
    get enabled() { return enabled; },
    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem('ws-sound', enabled ? '1' : '0'); } catch (e) { /* ignore */ }
      if (enabled) this.click();
      return enabled;
    },
    unlock: function () { ensure(); },
    click: function () { tone(520, 0.06, 'triangle', 0.05); },
    gather: function () { tone(340, 0.07, 'triangle', 0.05); tone(460, 0.09, 'triangle', 0.04, 0.06); },
    build: function () { tone(220, 0.12, 'square', 0.045); tone(330, 0.14, 'triangle', 0.05, 0.1); tone(440, 0.18, 'sine', 0.04, 0.2); },
    craft: function () { tone(600, 0.05, 'square', 0.035); tone(760, 0.07, 'square', 0.03, 0.06); },
    error: function () { tone(160, 0.14, 'sawtooth', 0.035); },
    night: function () { tone(196, 0.5, 'sine', 0.05); tone(147, 0.7, 'sine', 0.045, 0.25); },
    dawn: function () { tone(392, 0.18, 'sine', 0.045); tone(523, 0.2, 'sine', 0.045, 0.15); tone(659, 0.3, 'sine', 0.04, 0.3); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.3, 'sine', 0.05, i * 0.14); }); },
    lose: function () { [330, 262, 196, 147].forEach(function (f, i) { tone(f, 0.4, 'sine', 0.05, i * 0.2); }); }
  };
  A.Audio = Audio;
})(window.WS = window.WS || {});