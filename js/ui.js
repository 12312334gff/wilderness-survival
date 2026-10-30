/* 荒野余生 · 界面层 */
(function (A) {
  'use strict';
  var D = A.DATA, G = A.Game, Sfx = A.Audio, U = A.util;
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var UI = {
    tab: 'build',
    modalOpen: false,
    nightTimer: null,
    pendingNight: null,
    lastRes: {},
    lastLogLen: 0
  };
  A.UI = UI;

  /* ================= 开始屏 ================= */
  UI.showTitle = function () {
    UI.stopNightWatch();
    var has = G.hasSave();
    var app = $('app');
    $('hud').classList.add('hidden');
    $('screen-play').classList.add('hidden');
    $('fx').innerHTML = '';
    $('modal-root').innerHTML = '';
    UI.modalOpen = false;
    Array.prototype.forEach.call(document.querySelectorAll('.title-screen'), function (t) { t.remove(); });
    if (app._title) { app._title.remove(); app._title = null; }
    var wrap = el('div', 'title-screen');
    wrap.innerHTML =
      '<div class="glow"></div>' +
      '<div class="title-fire">🔥</div>' +
      '<h1>荒野余生</h1>' +
      '<div class="sub">20 天 · 生存经营</div>' +
      '<p class="quote">「你的船没能撑过那场风暴。<br/>这里没有信号，没有路，只有一座石山、一条溪流，和你手上的这双手。」<br/>—— 撑过 20 天，救援就会来。</p>' +
      '<div class="title-btns">' +
        (has ? '<button class="btn primary" id="t-continue">继续上次的旅程</button>' : '') +
        '<button class="btn ' + (has ? 'ghost' : 'primary') + '" id="t-new">开始新的生存</button>' +
        '<button class="btn ghost" id="t-help">玩法说明</button>' +
      '</div>' +
      '<div class="tips">单机游戏 · 进度自动保存在本机<br/>屏幕小提示：一天 = 2 分钟，先点火，再活下来</div>';
    app.appendChild(wrap);
    app._title = wrap;
    if (has) $('t-continue').onclick = function () { Sfx.click(); UI.continueGame(); };
    $('t-new').onclick = function () {
      Sfx.click();
      if (has) {
        UI.confirm('重新开始？', '之前那趟旅程的进度会被覆盖，无法恢复。', '开始新的生存', function () { UI.startNew(); });
      } else UI.startNew();
    };
    $('t-help').onclick = function () { Sfx.click(); UI.showHelp(); };
  };

  UI.startNew = function () {
    G.newGame();
    UI._lastTick = Date.now();
    UI.boot();
    UI.toast('先建一座🔥营火，然后去营地把它点燃。', '');
  };

  UI.continueGame = function () {
    if (!G.load()) { UI.startNew(); return; }
    var s = G.s;
    if (s.ending) { UI.boot(); UI.showEnding(s.ending); return; }
    UI.boot();
    UI._lastTick = Date.now();
    if (s.phase === 'night') {
      // 夜晚中断：回到夜晚开头重新结算
      s.phase = 'day';
      s.dayStart = Date.now() - s.dayLength + 8000;
    } else if (s.phase === 'day' && G.isDayOver()) {
      s.dayStart = Date.now() - s.dayLength + 5000;
    }
    UI.renderAll();
  };

  UI.showHelp = function () {
    var m = UI.modal(
      '<h3><span class="m-icon">📖</span>怎么活下来</h3><div class="m-sub">荒野余生 · 20 天</div>' +
      '<p>你的目标只有一个：<b>撑过 20 天</b>，等待救援。每一天都在消耗——饥饿、口渴、体温和体力。</p>' +
      '<p style="margin-top:10px"><b>① 白天：行动</b><br/>' +
      '一天 = 2 分钟。白天你只能做 <b>1 次</b>行动：外出采集、建造或制作。<br/>' +
      '吃完喝完不算行动：点「外出采集」上方的 💧喝水 / 🍖进食 随时补充。<br/>' +
      '用完行动或者时间耗尽，就会进入夜晚。</p>' +
      '<p style="margin-top:10px"><b>② 夜晚：取暖</b><br/>' +
      '营火搭好后记得<b>点燃</b>（营地页或快捷按钮），夜里它会烧木材取暖。<br/>' +
      '体温过低、饥饿、口渴都会扣体力。<br/>' +
      '夜晚可以选「休息 / 劳作 / 巡哨」，劳作能换来明天的额外行动。</p>' +
      '<p style="margin-top:10px"><b>③ 路线建议</b><br/>' +
      '营火 → 简易窝棚 → 集雨器 → 陷阱 → 菜圃 → 晾肉架 → 冶炼窑 → 信号台 → 信号火堆。<br/>' +
      '知识来自采集和探索，用来解锁科技（火种术、草药学、锻造……）。</p>' +
      '<p style="margin-top:10px;color:#8a998f;font-size:12.5px">小技巧：食物和净水永远优先补满；雨天别出门太远；深林很危险但很肥。</p>' +
      '<div class="modal-actions"><button class="btn primary" data-close>明白了</button></div>', { wide: true });
    return m;
  };

  /* ================= 启动主界面 ================= */
  UI.boot = function () {
    var t = document.querySelector('.title-screen');
    if (t) t.remove();
    $('hud').classList.remove('hidden');
    $('screen-play').classList.remove('hidden');
    UI.modalOpen = false;
    $('modal-root').innerHTML = '';
    UI.lastLogLen = 0;
    $('log').innerHTML = '';
    UI.renderAll();
    UI.applyWeatherFx();
    $('btn-sound').textContent = Sfx.enabled ? '🔊' : '🔇';
    $('btn-sound').onclick = function () { this.textContent = Sfx.toggle() ? '🔊' : '🔇'; };
    $('btn-restart').onclick = function () {
      Sfx.click();
      UI.confirm('放弃这次生存？', '所有进度将被清空。', '重开', function () { G.clearSave(); G.newGame(); UI.boot(); });
    };
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.onclick = function () {
        Sfx.click();
        UI.tab = b.getAttribute('data-tab');
        Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('active', x === b); });
        UI.renderTab();
      };
    });
    UI.startNightWatch();
  };

  /* ================= 渲染 ================= */
  UI.renderAll = function () {
    if (!G.s) return;
    UI.renderHud();
    UI.renderLog();
    UI.renderZones();
    UI.renderTab();
  };

  UI.renderHud = function () {
    var s = G.s, w = D.WEATHER[s.weather];
    $('hud-clock').textContent = '第 ' + s.day + ' 天 · ' + (s.phase === 'night' ? '夜晚' : G.clockText());
    $('hud-weather').innerHTML = '<span class="wx-icon">' + w.icon + '</span><span class="wx-name">' + w.name + '</span>';
    $('hud-daynum').innerHTML = Math.min(s.day, D.TOTAL_DAYS) + '<small>/' + D.TOTAL_DAYS + '</small>';
    $('hud-daybar').style.width = Math.min(100, (s.day / D.TOTAL_DAYS) * 100) + '%';

    var vw = $('hud-vitals');
    vw.innerHTML = '';
    D.VITALS.forEach(function (v) {
      var val = Math.round(s.vitals[v.key]);
      var d = el('div', 'vital' + (val < 25 ? ' low' : ''));
      d.title = v.hint;
      d.innerHTML = '<div class="vital-top"><span>' + v.icon + ' ' + v.name + '</span><b>' + val + '</b></div>' +
        '<div class="vital-bar"><i style="width:' + val + '%;background:' + v.color + '"></i></div>';
      vw.appendChild(d);
    });

    var rw = $('hud-res');
    rw.innerHTML = '';
    UI.lastRes = {};
    var cap = G.storageCap();
    D.RES_ORDER.forEach(function (k) {
      var n = s.res[k] || 0;
      var c = el('div', 'res-chip' + (!D.RES[k].safe && n >= cap ? ' hi' : ''), '<span class="ic">' + D.RES[k].icon + '</span>' + D.RES[k].name + ' <b>' + n + '</b>');
      c.setAttribute('data-res', k);
      rw.appendChild(c);
    });

    var e = Math.round(s.energy);
    $('hud-energy').style.width = e + '%';
    $('hud-energy-num').textContent = e;
    $('hud-know').textContent = s.knowledge;

    var acts = G.dayActions();
    var maxDots = Math.max(1, acts, s.phase === 'day' ? 1 : 0);
    var dots = $('hud-dots');
    dots.innerHTML = '';
    for (var i = 0; i < Math.max(1, s.pending + (s.phase === 'day' ? 1 : 0)); i++) {
      var d2 = el('i', i < acts ? 'on' : '');
      dots.appendChild(d2);
    }
    dots.title = '剩余行动：' + acts;

    var p = s.phase === 'night' ? 1 : G.dayProgress();
    $('hud-timebar').style.width = (p * 100) + '%';
  };

  UI.renderLog = function () {
    var box = $('log');
    var s = G.s;
    if (UI.lastLogLen > s.logs.length) { box.innerHTML = ''; UI.lastLogLen = 0; }
    for (var i = UI.lastLogLen; i < s.logs.length; i++) {
      var L = s.logs[i];
      var d = el('div', 'log-item ' + L.type);
      d.innerHTML = (L.type === 'day' ? '' : '<span class="daytag">D' + L.day + '</span>') + esc(L.t);
      box.appendChild(d);
    }
    UI.lastLogLen = s.logs.length;
    box.scrollTop = box.scrollHeight;
  };

  UI.renderZones = function () {
    var s = G.s, wrap = $('zones');
    wrap.innerHTML = '';

    // 消耗品快捷操作（不消耗行动）
    var quick = el('div', 'quick-row');
    var items = [
      { icon: '💧', label: '喝水', cost: '💧8', can: s.res.water >= 8, fn: function () { return G.drinkWater(); } },
      { icon: '🍖', label: '进食', cost: '🍖8', can: s.res.food >= 8, fn: function () { return G.eatFood(); } }
    ];
    if (G.has('campfire') && !s.flags.fireLit) {
      items.unshift({ icon: '🔥', label: '点燃营火', cost: '🪵1', can: s.res.wood >= 1, fn: function () { return G.lightFire(); } });
    }
    items.forEach(function (it) {
      var b = el('button', 'quick' + (it.can ? '' : ' off'));
      b.innerHTML = '<span class="q-ic">' + it.icon + '</span><span class="q-lbl">' + it.label + '</span><span class="q-cost">' + it.cost + '</span>';
      if (!it.can) b.disabled = true;
      b.onclick = function () {
        var r = it.fn();
        if (!r.ok) { UI.toast(r.why, 'bad'); Sfx.error(); return; }
        Sfx.gather();
        UI.renderAll();
      };
      quick.appendChild(b);
    });
    wrap.appendChild(quick);

    var grid = el('div', 'zones-grid');
    var actions = G.dayActions();
    D.ZONE_ORDER.forEach(function (id) {
      var z = D.ZONES[id];
      var locked = z.unlock > s.day;
      var cost = G.gatherCost(id);
      var b = el('button', 'zone' + (locked ? ' locked' : ''));
      var why = locked ? '第 ' + z.unlock + ' 天解锁'
        : actions <= 0 ? '今天的行动用完了'
        : s.energy < cost ? '体力不足，等它恢复'
        : '';
      b.disabled = !!why;
      b.innerHTML =
        '<div class="z-top"><span class="z-icon">' + z.icon + '</span>' + z.name +
        '<span class="z-cost">⚡' + cost + '</span></div>' +
        '<div class="z-desc">' + (why ? '<span class="z-warn">' + why + '</span>' : esc(z.desc)) + '</div>';
      b.onclick = function () {
        var r = G.gather(id);
        if (!r.ok) { UI.toast(r.why, 'bad'); Sfx.error(); return; }
        Sfx.gather();
        UI.renderAll();
      };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
  };

  UI.costHtml = function (cost) {
    if (!cost) return '';
    var out = '';
    for (var k in cost) {
      if (k === 'knowledge') {
        out += '<span class="cost' + ((G.s.knowledge || 0) < cost[k] ? ' lack' : '') + '">📘 ' + cost[k] + '</span>';
        continue;
      }
      var lack = (G.s.res[k] || 0) < cost[k];
      out += '<span class="cost' + (lack ? ' lack' : '') + '">' + D.RES[k].icon + ' ' + cost[k] + '</span>';
    }
    return out;
  };

  UI.renderTab = function () {
    var body = $('tab-body');
    body.innerHTML = '';
    if (UI.tab === 'build') UI.renderBuild(body);
    else if (UI.tab === 'craft') UI.renderCraft(body);
    else if (UI.tab === 'tech') UI.renderTech(body);
    else UI.renderCamp(body);
  };

  /* 拼装一张卡片：主体 + 按钮 + 说明，避免依赖 innerHTML 的 DOM 解析 */
  function makeCard(opts) {
    var card = el('div', 'card ' + (opts.cls || ''));
    var icon = el('div', 'c-icon', opts.icon);
    var main = el('div', 'c-main');
    var title = el('div', 'c-title');
    title.innerHTML = opts.title;
    main.appendChild(title);
    var desc = el('div', 'c-desc');
    desc.innerHTML = opts.desc;
    main.appendChild(desc);
    if (opts.costHtml) {
      var cost = el('div', 'c-cost');
      cost.innerHTML = opts.costHtml;
      main.appendChild(cost);
    }
    if (opts.why) main.appendChild(el('div', 'c-why', esc(opts.why)));
    card.appendChild(icon);
    card.appendChild(main);
    if (opts.btn) {
      var btn = el('button', 'c-btn', opts.btn);
      if (!opts.enabled) btn.disabled = true;
      card.appendChild(btn);
    }
    if (opts.enabled && opts.onClick) {
      card.onclick = opts.onClick;
      card.classList.add('ok');
    }
    return card;
  }

  UI.renderBuild = function (body) {
    D.BUILD_ORDER.forEach(function (id) {
      var b = D.BUILDINGS[id];
      var chk = G.canBuild(id);
      var owned = G.count(id);
      var maxed = owned && (b.once || owned >= (b.max || 99));
      body.appendChild(makeCard({
        cls: chk.ok ? 'ok' : (maxed ? 'owned' : 'no'),
        icon: b.icon,
        title: b.name + '<span class="tag">' + b.cat + '</span>' + (owned ? '<span class="have">×' + owned + '</span>' : ''),
        desc: b.desc,
        costHtml: maxed ? '' : UI.costHtml(b.cost),
        btn: maxed ? '' : (owned ? '再建' : '建造'),
        enabled: chk.ok,
        why: chk.ok || maxed ? '' : chk.why,
        onClick: function () { UI.doBuild(id); }
      }));
    });
  };

  UI.doBuild = function (id) {
    var r = G.build(id);
    if (!r.ok) { UI.toast(r.why, 'bad'); Sfx.error(); return; }
    Sfx.build();
    UI.renderAll();
    UI.flashRes();
  };

  UI.renderCraft = function (body) {
    var cats = ['工具', '装备', '食物', '医疗', '终极'];
    var cur = UI.craftCat || '工具';
    var bar = el('div');
    bar.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap';
    cats.forEach(function (c) {
      var b = el('button', 'c-btn', c);
      b.style.cssText = 'padding:5px 11px;font-size:12px;' + (c === cur ? 'border-color:#f2b053;color:#f2b053' : '');
      b.onclick = function () { Sfx.click(); UI.craftCat = c; UI.renderTab(); };
      bar.appendChild(b);
    });
    body.appendChild(bar);

    var count = 0;
    D.RECIPE_ORDER.forEach(function (id) {
      var r = D.RECIPES[id];
      if (r.cat !== cur) return;
      count++;
      var chk = G.canCraft(id);
      var owned = G.s.gear[id] || 0;
      body.appendChild(makeCard({
        cls: chk.ok ? 'ok' : (owned && r.once ? 'owned' : 'no'),
        icon: r.icon,
        title: r.name + (owned && r.once ? '<span class="have">已拥有</span>' : ''),
        desc: r.desc,
        costHtml: UI.costHtml(r.cost),
        btn: owned && r.once ? '' : '制作',
        enabled: chk.ok,
        why: chk.ok ? '' : chk.why,
        onClick: function () { UI.doCraft(id); }
      }));
    });
    if (!count) body.appendChild(el('div', 'empty', '这一类还没有解锁的配方。'));
  };

  UI.doCraft = function (id) {
    var r = G.craft(id);
    if (!r.ok) { UI.toast(r.why, 'bad'); Sfx.error(); return; }
    Sfx.craft();
    UI.renderAll();
    UI.flashRes();
  };

  UI.renderTech = function (body) {
    D.TECH_ORDER.forEach(function (id) {
      var t = D.TECHS[id];
      var have = G.hasTech(id);
      var locked = t.day > G.s.day;
      var chk = G.research(id);
      body.appendChild(makeCard({
        cls: have ? 'owned' : (chk.ok ? 'ok' : 'no'),
        icon: t.icon,
        title: t.name + (have ? '<span class="have">已掌握</span>' : ''),
        desc: t.desc,
        costHtml: '<span class="cost' + (G.s.knowledge < t.knowledge ? ' lack' : '') + '">📘 ' + t.knowledge + '</span>' +
          '<span class="cost">第 ' + t.day + ' 天解锁</span>',
        btn: have ? '' : '研究',
        enabled: !have && chk.ok,
        why: have || chk.ok ? '' : (locked ? '第 ' + t.day + ' 天解锁' : chk.why),
        onClick: function () {
          var r = G.research(id);
          if (r.ok) { Sfx.build(); UI.toast('掌握了：' + t.name, 'good'); UI.renderAll(); }
          else { Sfx.error(); UI.toast(r.why, 'bad'); }
        }
      }));
    });
  };

  UI.renderCamp = function (body) {
    var s = G.s;
    var html = '';
    // 营火状态
    html += '<div class="section-title">营火与状态</div>';
    if (G.has('campfire')) {
      var lit = s.flags.fireLit;
      html += '<div class="camp-item"><span class="ic">' + (lit ? '🔥' : '🪵') + '</span><span>' +
        (lit ? '营火正在燃烧' : '营火没点着') + '</span>' +
        (lit ? '<span class="v" style="color:#f2b053">今夜可取暖</span>'
             : '<span class="c-btn" id="camp-light" style="margin-left:auto">点燃（🪵1）</span>') +
        '</div>';
    }
    if (s.res.meat >= 1) {
      html += '<div class="camp-item"><span class="ic">🥩</span><span>生肉可以烤肉</span>' +
        '<span class="c-btn" id="camp-cook" style="margin-left:auto">烤一份（🪵1）</span></div>';
    }
    html += '<div class="kv-row"><span>今夜需要木材</span><b>' +
      (G.has('campfire') ? Math.max(1, D.BUILDINGS.campfire.nightWood - (G.hasTech('fire') ? 1 : 0)) + '（现有 ' + s.res.wood + '）' : '没有营火，非常危险') + '</b></div>' +
      '<div class="kv-row"><span>今晚天气</span><b>' + D.WEATHER[s.weather].icon + ' ' + D.WEATHER[s.weather].name + '</b></div>';

    html += '<div class="section-title">营地设施</div><div class="camp-grid">';
    var any = false;
    D.BUILD_ORDER.forEach(function (id) {
      var n = G.count(id);
      if (!n) return;
      any = true;
      html += '<div class="camp-item"><span class="ic">' + D.BUILDINGS[id].icon + '</span><span>' + D.BUILDINGS[id].name + '</span><span class="v">×' + n + '</span></div>';
    });
    if (!any) html += '<div class="empty">还没有任何建筑。先去「建造」页点起火堆吧。</div>';
    html += '</div>';

    html += '<div class="section-title">装备</div><div class="equip-list">';
    var eq = false;
    for (var g in s.gear) if (s.gear[g]) { eq = true; html += '<span class="equip">' + D.RECIPES[g].icon + ' ' + D.RECIPES[g].name + '</span>'; }
    if (!eq) html += '<span class="empty">还没有装备</span>';
    html += '</div>';

    html += '<div class="section-title">统计</div>' +
      '<div class="kv-row"><span>储存上限</span><b>' + G.storageCap() + '</b></div>' +
      '<div class="kv-row"><span>本次外出次数</span><b>' + s.totalGathers + '</b></div>' +
      '<div class="kv-row"><span>制作次数</span><b>' + s.totalCrafts + '</b></div>' +
      '<div class="kv-row"><span>已掌握科技</span><b>' + Object.keys(s.techs).length + ' / ' + D.TECH_ORDER.length + '</b></div>' +
      '<div class="kv-row"><span>离获救还有</span><b>' + Math.max(0, D.TOTAL_DAYS - s.day) + ' 天</b></div>';
    body.innerHTML = html;
    var lb = body.querySelector('#camp-light');
    if (lb) lb.onclick = function () {
      var r = G.lightFire();
      if (r.ok) { Sfx.build(); UI.renderAll(); } else { Sfx.error(); UI.toast(r.why, 'bad'); }
    };
    var cb = body.querySelector('#camp-cook');
    if (cb) cb.onclick = function () {
      var r = G.craft('cooked_meat');
      if (r.ok) { Sfx.craft(); UI.renderAll(); }
      else { Sfx.error(); UI.toast(r.why, 'bad'); }
    };
  };

  UI.flashRes = function () { /* 预留 */ };

  /* ================= 天气特效 ================= */
  UI.applyWeatherFx = function () {
    var s = G.s, fx = $('fx');
    fx.innerHTML = '';
    if (!s || s.phase !== 'day') return;
    var w = s.weather;
    if (w === 'rain' || w === 'storm') {
      var n = w === 'storm' ? 90 : 55;
      for (var i = 0; i < n; i++) {
        var d = el('div', 'drop');
        d.style.left = (Math.random() * 100) + '%';
        d.style.animationDuration = (0.55 + Math.random() * 0.5) + 's';
        d.style.animationDelay = (-Math.random() * 2) + 's';
        d.style.opacity = 0.3 + Math.random() * 0.5;
        if (w === 'storm') d.style.height = '26px';
        fx.appendChild(d);
      }
    }
    if (w === 'fog') { fx.appendChild(el('div', 'fog')); }
    if (w === 'cold') {
      for (var j = 0; j < 26; j++) {
        var sn = el('div', 'snow', '❄');
        sn.style.left = (Math.random() * 100) + '%';
        sn.style.animationDuration = (6 + Math.random() * 6) + 's';
        sn.style.animationDelay = (-Math.random() * 8) + 's';
        sn.style.opacity = 0.25 + Math.random() * 0.4;
        fx.appendChild(sn);
      }
    }
  };

  /* ================= 计时 ================= */
  UI.startNightWatch = function () {
    UI.stopNightWatch();
    UI.nightTimer = setInterval(function () {
      if (!G.s || G.s.ending) return;
      // 白天自然消耗：饥饿/口渴/体温/体力回复
      var now = Date.now();
      G.idleTick(now - (UI._lastTick || now));
      UI._lastTick = now;
      G.tick(500);
      UI.renderHud();
      if (G.s.ending) { UI.stopNightWatch(); UI.showEnding(G.s.ending); return; }
      if (G.s.phase === 'day' && G.isDayOver() && !UI.modalOpen) UI.showNightChoice();
    }, 500);
  };
  UI.stopNightWatch = function () {
    if (UI.nightTimer) { clearInterval(UI.nightTimer); UI.nightTimer = null; }
  };

  /* ================= 弹窗基础 ================= */
  UI.modal = function (inner, opts) {
    opts = opts || {};
    UI.closeModal();
    var ov = el('div', 'overlay');
    var m = el('div', 'modal');
    m.innerHTML = inner;
    ov.appendChild(m);
    $('modal-root').appendChild(ov);
    UI.modalOpen = true;
    UI._ov = ov;
    Array.prototype.forEach.call(m.querySelectorAll('[data-close]'), function (b) {
      b.onclick = function () { Sfx.click(); UI.closeModal(); };
    });
    return m;
  };
  UI.closeModal = function () {
    $('modal-root').innerHTML = '';
    UI.modalOpen = false;
    UI._ov = null;
  };

  UI.confirm = function (title, text, okLabel, onOk) {
    var m = UI.modal(
      '<h3><span class="m-icon">⚠️</span>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      '<div class="modal-actions"><button class="btn" data-close>取消</button>' +
      '<button class="btn primary" id="cf-ok">' + esc(okLabel) + '</button></div>');
    var b = m.querySelector('#cf-ok');
    if (b) b.onclick = function () { UI.closeModal(); onOk(); };
  };

  UI.toast = function (text, cls) {
    var t = el('div', 'toast ' + (cls || ''), esc(text));
    $('toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .35s,transform .35s'; t.style.opacity = 0; t.style.transform = 'translateY(6px)'; }, 1900);
    setTimeout(function () { t.remove(); }, 2350);
  };

  /* ================= 夜晚 ================= */
  UI.showNightChoice = function () {
    if (UI.modalOpen) return;
    if (G.s.phase === 'night') return;
    var s = G.s, w = D.WEATHER[s.weather];
    var lines = [];
    lines.push(['🔥 营火', G.has('campfire') ? '木材 ' + Math.max(2, D.BUILDINGS.campfire.nightWood - (G.hasTech('fire') ? 1 : 0)) + ' / 夜' : '尚未建造（很危险）']);
    lines.push(['⛺ 庇护', G.has('lean') ? '保温 +' + D.BUILDINGS.lean.warmth : '无']);
    lines.push(['🧥 保暖', (G.hasGear('fur_coat') ? '兽皮衣 +18 ' : '') + (G.has('bed') ? '草枕 ' : '') || '无']);
    lines.push(['📦 存粮', '🍖 ' + (s.res.food || 0) + ' · 💧 ' + (s.res.water || 0)]);
    var est = 40 + ((G.has('lean') ? 12 : 0) + (G.has('bed') ? 4 : 0) + (G.hasGear('fur_coat') ? 18 : 0) + (G.has('campfire') && s.res.wood >= 3 ? 28 : 0)) +
      ({ clear: 0, cloudy: -4, rain: -12, fog: -8, storm: -20, cold: -18 }[s.weather] || 0);

    var actions = D.ACTION_ORDER.map(function (id) {
      var a = D.ACTIONS[id];
      return '<button class="choice" data-act="' + id + '">' + a.icon + ' ' + a.name +
        '<span class="ch-tip">' + a.desc + '</span></button>';
    }).join('');

    var m = UI.modal(
      '<h3><span class="m-icon">🌙</span>夜幕降临</h3><div class="m-sub">第 ' + s.day + ' 天 · 夜里会发生什么</div>' +
      '<div class="wx-big">' + w.icon + '</div><div class="wx-name-big">今晚天气：' + w.name + '</div>' +
      '<div class="night-score">' +
        lines.map(function (l) { return '<div class="ns-row"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>'; }).join('') +
        '<div class="ns-row"><span>预计体温</span><b>约 ' + Math.max(0, Math.min(100, Math.round(est))) + '</b></div>' +
        '<div class="ns-note">今晚要做点什么？</div>' +
      '</div>' + actions);

    Array.prototype.forEach.call(m.querySelectorAll('[data-act]'), function (b) {
      b.onclick = function () {
        Sfx.click();
        G.setAction(b.getAttribute('data-act'));
        UI.closeModal();
        UI.beginNight();
      };
    });
  };

  UI.beginNight = function () {
    var s = G.s;
    if (s.ending) return;
    G.startNight();
    Sfx.night();
    UI.renderHud();
    var ov = el('div', 'night-overlay');
    ov.id = 'night-overlay';
    ov.innerHTML =
      '<div class="night-card">' +
        '<div class="moon">🌙</div>' +
        '<h3>夜幕降临</h3>' +
        '<div class="n-sub">第 ' + s.day + ' 天 · ' + D.ACTIONS[s.action].name + '</div>' +
        '<div class="night-rings"><i></i><i></i><i></i><i></i></div>' +
        '<div class="n-sub" id="night-count">' + D.NIGHT_SEC + '</div>' +
        '<button class="n-skip" id="night-skip">熬到天亮 ›</button>' +
      '</div>';
    document.body.appendChild(ov);
    $('night-skip').onclick = function () { Sfx.click(); UI.finishNight(); };
    var t0 = Date.now();
    UI._nightInt = setInterval(function () {
      var left = Math.max(0, D.NIGHT_SEC - Math.floor((Date.now() - t0) / 1000));
      var c = $('night-count');
      if (c) c.textContent = left;
      if (left <= 0) UI.finishNight();
    }, 250);
  };

  UI.finishNight = function () {
    if (UI._nightDone) return;
    UI._nightDone = true;
    if (UI._nightInt) { clearInterval(UI._nightInt); UI._nightInt = null; }
    var ov = $('night-overlay');
    if (ov) ov.remove();
    var s = G.s;
    if (s.phase !== 'night') return;
    var report = G.resolveNight();
    UI.renderAll();
    if (s.ending) {
      // 夜里直接倒下
      setTimeout(function () { UI.showNightReport(report, true); }, 200);
      return;
    }
    UI.showNightReport(report, false);
  };

  UI.showNightReport = function (report, dead) {
    var s = G.s;
    var nextDay = s.day + 1;
    var wNext = dead ? null : G.rollWeather(nextDay);
    var html = '<h3><span class="m-icon">🌅</span>' + (dead ? '你没能等到天亮' : '第 ' + s.day + ' 夜的记录') + '</h3>' +
      '<div class="m-sub">' + (dead ? '最后一夜' : '熬过去了') + '</div>';
    html += report.lines.map(function (l) {
      return '<div class="settle-line ' + l.c + '"><span class="bullet">·</span><span>' + esc(l.t) + '</span></div>';
    }).join('');
    html += '<div class="kv-row" style="margin-top:12px"><span>🍖 饥饿 / 💧 口渴</span><b>' + Math.round(s.vitals.hunger) + ' / ' + Math.round(s.vitals.thirst) + '</b></div>' +
      '<div class="kv-row"><span>❤️ 体力</span><b>' + Math.round(s.vitals.health) + '</b></div>' +
      '<div class="kv-row"><span>🌡️ 体温</span><b>' + Math.round(s.vitals.warmth) + '</b></div>' +
      '<div class="kv-row"><span>⚡ 体力值</span><b>' + Math.round(s.energy) + '</b></div>';
    if (!dead && wNext) {
      html += '<div class="wx-line" style="margin-top:12px">明天：' + D.WEATHER[wNext].icon + ' ' + D.WEATHER[wNext].name +
        '<span class="wx-d">' + D.WEATHER[wNext].desc + '</span></div>';
    }
    html += '<div class="modal-actions"><button class="btn primary" id="n-next">' + (dead ? '看看结局' : '进入第 ' + nextDay + ' 天') + '</button></div>';
    var m = UI.modal(html);
    var nb = m.querySelector('#n-next');
    if (nb) nb.onclick = function () {
      Sfx.dawn();
      UI.closeModal();
      UI._nightDone = false;
      G.nextDay();
      UI.renderAll();
      UI.applyWeatherFx();
      if (G.s.ending) { UI.showEnding(G.s.ending); return; }
      // 隔一天来一次遭遇
      if (G.eventDue()) {
        G.s.nextEventAt = G.s.day + 2 + Math.floor(Math.random() * 2);
        var eid = G.rollEvent(true);
        if (eid) { UI.showEvent(eid); return; }
      }
      // 醒来时体力太低就提示
      if (G.s.energy < 40) UI.toast('你只睡了几个小时，体力还没恢复满。', '');
    };
  };

  /* ================= 事件 ================= */
  UI.rollEvent = function () {
    var id = G.rollEvent();
    if (id) UI.showEvent(id);
  };

  /* 统一处理遭遇结算后的流程 */
  UI.resolveEventAndClose = function (id, index) {
    G.resolveEvent(id, index);
    UI.closeModal();
    UI.renderAll();
    if (G.s.ending) UI.showEnding(G.s.ending);
  };

  UI.showEvent = function (id) {
    var e = D.EVENTS[id];
    var opts = G.eventOptions(id);
    var html = '<h3><span class="m-icon">' + e.icon + '</span>' + e.title + '</h3><div class="m-sub">遭遇</div><p>' + e.text + '</p>';
    opts.forEach(function (o) {
      html += '<button class="choice" data-i="' + o.index + '" ' + (o.ok ? '' : 'disabled') + '>' + o.label +
        '<span class="ch-tip">' + (o.ok ? (o.tip || '') : o.why) + '</span></button>';
    });
    var m = UI.modal(html);
    Array.prototype.forEach.call(m.querySelectorAll('[data-i]'), function (b) {
      b.onclick = function () {
        Sfx.click();
        G.resolveEvent(id, parseInt(b.getAttribute('data-i'), 10));
        UI.closeModal();
        UI.renderAll();
        if (G.s.ending) UI.showEnding(G.s.ending);
      };
    });
  };

  /* ================= 结局 ================= */
  UI.showEnding = function (cause) {
    UI.stopNightWatch();
    var s = G.s, e = D.ENDINGS[cause];
    var win = cause === 'rescue';
    if (win) Sfx.win(); else Sfx.lose();
    var playTime = Math.max(1, Math.round((Date.now() - (s.savedAt || Date.now())) / 60000));
    var m = UI.modal(
      '<div class="ending-wrap">' +
        '<div class="ending-icon">' + e.icon + '</div>' +
        '<div class="ending-title ' + (win ? 'win' : 'lose') + '">' + e.title + '</div>' +
        '<div class="m-sub" style="text-align:center">' + (win ? '你撑过了 ' + D.TOTAL_DAYS + ' 天' : '在第 ' + s.day + ' 天') + '</div>' +
        '<p class="ending-text">' + e.text + '</p>' +
        '<div class="stat-grid">' +
          '<div class="stat"><div class="s-k">坚持天数</div><div class="s-v">' + s.day + '</div></div>' +
          '<div class="stat"><div class="s-k">建造数量</div><div class="s-v">' + (function () { var n = 0; for (var k in s.buildings) n += s.buildings[k]; return n; })() + '</div></div>' +
          '<div class="stat"><div class="s-k">外出次数</div><div class="s-v">' + s.totalGathers + '</div></div>' +
          '<div class="stat"><div class="s-k">掌握科技</div><div class="s-v">' + Object.keys(s.techs).length + '</div></div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn ghost" id="end-title">回到标题</button>' +
          '<button class="btn primary" id="end-again">再来一次</button>' +
        '</div>' +
      '</div>', { wide: true });
    var b1 = m.querySelector('#end-title'), b2 = m.querySelector('#end-again');
    if (b1) b1.onclick = function () { G.clearSave(); UI.closeModal(); UI.showTitle(); };
    if (b2) b2.onclick = function () { G.clearSave(); UI.closeModal(); UI.startNew(); };
  };

  /* ================= 入口 ================= */
  UI.init = function () {
    if (UI._inited) return;
    UI._inited = true;
    document.addEventListener('pointerdown', function once() { Sfx.unlock(); document.removeEventListener('pointerdown', once); });
    UI.showTitle();
    G.on('over', function (cause) {
      if (UI.modalOpen) return;
      UI.showEnding(cause);
    });
  };

  window.addEventListener('load', UI.init);

})(window.WS = window.WS || {});