/* 荒野余生 · 游戏逻辑 */
(function (A) {
  'use strict';
  var D = A.DATA;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function chance(p) { return Math.random() < p; }

  var Game = {
    s: null,
    listeners: {}
  };

  /* ---------------- 事件订阅 ---------------- */
  Game.on = function (name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
  };
  Game.emit = function (name, payload) {
    (this.listeners[name] || []).forEach(function (fn) { fn(payload); });
  };

  /* ---------------- 存档 ---------------- */
  Game.hasSave = function () {
    try { return !!localStorage.getItem(D.SAVE_KEY); } catch (e) { return false; }
  };
  Game.save = function () {
    if (!this.s) return;
    try {
      this.s.savedAt = Date.now();
      localStorage.setItem(D.SAVE_KEY, JSON.stringify(this.s));
    } catch (e) { /* 隐私模式下忽略 */ }
  };
  Game.load = function () {
    try {
      var raw = localStorage.getItem(D.SAVE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || s.version !== D.VERSION) return false;
      this.s = s;
      return true;
    } catch (e) { return false; }
  };
  Game.clearSave = function () {
    try { localStorage.removeItem(D.SAVE_KEY); } catch (e) { /* ignore */ }
  };

  /* ---------------- 新游戏 ---------------- */
  Game.newGame = function () {
    this.s = {
      version: D.VERSION,
      day: 1,
      phase: 'day',                 // day | night
      dayStart: Date.now(),
      dayLength: D.DAY_MS,
      weather: 'clear',
      res: { wood: 12, stone: 6, fiber: 10, food: 8, water: 8, herb: 2, hide: 0, meat: 0, sulfur: 0, charcoal: 0, coal: 0, cloth: 0 },
      vitals: { hunger: 85, thirst: 78, warmth: 68, health: 100 },
      energy: D.ENERGY_MAX,
      knowledge: 0,
      buildings: {},                // id -> count
      gear: {},                     // recipe id -> count
      techs: {},
      logs: [],
      ending: null,
      totalGathers: 0,
      totalCrafts: 0,
      nextEventAt: 2,
      snareNight: {},
      action: 'rest',
      pending: 0,                   // 熬夜劳作获得的额外行动次数
      flags: { fireLit: false },
      savedAt: null
    };
    this.log('你的小艇被浪打翻在礁石上。醒来时，天已经快黑了。', 'story');
    this.log('先升起一堆火——然后想办法活过 20 天，等待救援。', 'hint');
    return this.s;
  };

  /* ---------------- 日志 ---------------- */
  Game.log = function (text, type) {
    if (!this.s) return;
    this.s.logs.push({ t: text, type: type || 'info', day: this.s.day });
    if (this.s.logs.length > 80) this.s.logs.shift();
    this.emit('log');
  };

  /* ---------------- 查询 ---------------- */
  Game.has = function (id) { return (this.s.buildings[id] || 0) > 0; };
  Game.count = function (id) { return this.s.buildings[id] || 0; };
  Game.hasGear = function (id) { return !!this.s.gear[id]; };
  Game.hasTech = function (id) { return !!this.s.techs[id]; };
  Game.storageCap = function () { return D.BASE_STORAGE + (this.has('shed') ? D.BUILDINGS.shed.cap : 0); };

  Game.canBuild = function (id) {
    var s = this.s, b = D.BUILDINGS[id];
    if (!b) return { ok: false, why: '未知建筑' };
    if (b.once && this.has(id)) return { ok: false, why: '已建造' };
    if (b.max && this.count(id) >= b.max) return { ok: false, why: '已达上限' };
    if (b.day > s.day) return { ok: false, why: '第 ' + b.day + ' 天解锁' };
    if (b.tech && !this.hasTech(b.tech)) return { ok: false, why: '需要科技：' + D.TECHS[b.tech].name };
    if (b.req) {
      for (var i = 0; i < b.req.length; i++) {
        if (!this.has(b.req[i])) return { ok: false, why: '需要先建造：' + D.BUILDINGS[b.req[i]].name };
      }
    }
    var lack = this.missing(b.cost);
    if (lack.length) return { ok: false, why: '缺少 ' + lack.map(function (k) { return D.RES[k].name; }).join('、') };
    return { ok: true };
  };

  Game.canCraft = function (id) {
    var s = this.s, r = D.RECIPES[id];
    if (!r) return { ok: false, why: '未知配方' };
    if (r.once && this.hasGear(id)) return { ok: false, why: '已制作' };
    if (r.day > s.day) return { ok: false, why: '第 ' + r.day + ' 天解锁' };
    if (r.tech && !this.hasTech(r.tech)) return { ok: false, why: '需要科技：' + D.TECHS[r.tech].name };
    var lack = this.missing(r.cost);
    if (lack.length) return { ok: false, why: '缺少 ' + lack.map(function (k) { return D.RES[k].name; }).join('、') };
    var free = this.s.phase === 'day' ? (1 + this.s.pending) : (this.s.pending > 0);
    if (!free) return { ok: false, why: '今天的行动已用完' };
    return { ok: true };
  };

  Game.missing = function (cost) {
    var lack = [];
    if (!cost) return lack;
    for (var k in cost) {
      if (k === 'knowledge') continue;
      if ((this.s.res[k] || 0) < cost[k]) lack.push(k);
    }
    return lack;
  };

  Game.pay = function (cost) {
    if (!cost) return;
    for (var k in cost) {
      if (k === 'knowledge') { this.s.knowledge -= cost[k]; continue; }
      this.s.res[k] = (this.s.res[k] || 0) - cost[k];
    }
  };

  Game.gain = function (res) {
    if (!res) return;
    var cap = this.storageCap();
    for (var k in res) {
      if (!(k in this.s.res)) continue;
      var add = Math.max(0, Math.round(res[k]));
      if (add === 0) continue;
      // 只有会腐败的资源（食物、净水、生肉）受储量上限限制
      if (D.RES[k] && D.RES[k].safe) this.s.res[k] = Math.max(0, (this.s.res[k] || 0) + add);
      else this.s.res[k] = Math.min(cap, (this.s.res[k] || 0) + add);
    }
  };

  Game.gainKnowledge = function (n) {
    if (!n) return;
    this.s.knowledge += Math.round(n);
  };

  Game.dayActions = function () {
    return this.s.phase === 'day' ? (1 + this.s.pending) : this.s.pending;
  };
  Game.useAction = function () {
    if (this.s.phase === 'day') {
      if (this.s.pending > 0) this.s.pending--;
      else { this.s.phase = 'day-used'; }
    } else if (this.s.pending > 0) {
      this.s.pending--;
    }
  };

  /* ---------------- 昼夜 ---------------- */
  Game.dayProgress = function () {
    var s = this.s;
    if (s.phase !== 'day') return 1;
    return clamp((Date.now() - s.dayStart) / s.dayLength, 0, 1);
  };
  Game.timeLeft = function () {
    var s = this.s;
    if (s.phase !== 'day') return 0;
    return Math.max(0, s.dayLength - (Date.now() - s.dayStart));
  };
  Game.clockText = function () {
    var s = this.s;
    var p = this.dayProgress();
    var total = 6 * 60 + 18 * 60 * p;         // 06:00 -> 24:00
    var h = Math.floor(total / 60), m = Math.floor(total % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };
  Game.isDayOver = function () {
    return this.s.phase === 'day' && Date.now() - this.s.dayStart >= this.s.dayLength;
  };

  /* ---------------- 火种 ---------------- */
  /* 白天修建的营火需要“点燃”才能用；点燃后恢复体温、照亮营地 */
  Game.lightFire = function () {
    var s = this.s;
    if (!this.has('campfire')) return { ok: false, why: '还没有营火' };
    if (s.flags.fireLit) return { ok: false, why: '火已经点着了' };
    if ((s.res.wood || 0) < 1) return { ok: false, why: '木材不足（需要 1）' };
    s.res.wood -= 1;
    s.flags.fireLit = true;
    s.vitals.warmth = clamp(s.vitals.warmth + 30, 0, 100);
    this.log('火点着了。橘色的光在石圈里跳，你终于算是「到家」了。', 'story');
    this.save();
    return { ok: true };
  };

  Game.rollWeather = function (nextDay) {
    var s = this.s;
    var pool = ['clear', 'clear', 'cloudy', 'cloudy', 'rain'];
    if (nextDay >= 4) pool = pool.concat(['fog', 'rain', 'cold']);
    if (nextDay >= 7) pool = pool.concat(['storm', 'cold', 'fog']);
    // 不会连续两天相同
    for (var i = 0; i < 4; i++) {
      var w = pool[irnd(0, pool.length - 1)];
      if (w !== s.weather) return w;
    }
    return pool[0];
  };

  /* ---------------- 白天的行动 ---------------- */
  /* ---------------- 吃与喝 ---------------- */
Game.drinkWater = function () {
    var s = this.s;
    if (s.res.water < 8) return { ok: false, why: '净水不足（需要 8）' };
    s.res.water -= 8;
    s.vitals.thirst = clamp(s.vitals.thirst + 40, 0, 100);
    this.log('你喝下了 8 份净水，喉咙终于舒服了些。', 'good');
    this.save();
    return { ok: true };
  };

  Game.eatFood = function () {
    var s = this.s;
    if (s.res.food < 8) return { ok: false, why: '食物不足（需要 8）' };
    s.res.food -= 8;
    s.vitals.hunger = clamp(s.vitals.hunger + 32, 0, 100);
    s.vitals.health = clamp(s.vitals.health + 3, 0, 100);
    this.log('你吃下 8 份食物，胃里终于有了重量。', 'good');
    this.save();
    return { ok: true };
  };

  /* 每个时间刻调用：白天自然消耗与恢复 */
  Game.idleTick = function (dtMs) {
    var s = this.s;
    if (!s || s.phase !== 'day' || s.ending) return;
    var frac = dtMs / s.dayLength;
    s.vitals.hunger = clamp(s.vitals.hunger - D.DAY_DRAIN.hunger * frac, 0, 100);
    var thirstRate = D.DAY_DRAIN.thirst * (this.hasGear('canteen') ? 0.65 : 1);
    s.vitals.thirst = clamp(s.vitals.thirst - thirstRate * frac, 0, 100);
    var wMod = { clear: 2, cloudy: 0, rain: -6, fog: -3, storm: -10, cold: -9 }[s.weather] || 0;
    var wTarget = 60 + wMod + (this.has('campfire') ? 12 : 0) + (this.hasGear('fur_coat') ? 10 : 0);
    s.vitals.warmth += (wTarget - s.vitals.warmth) * 0.25 * frac;
    s.vitals.warmth = clamp(s.vitals.warmth, 0, 100);
    if (s.energy < D.ENERGY_MAX && s.vitals.hunger > 12 && s.vitals.thirst > 12) {
      s.energy = Math.min(D.ENERGY_MAX, s.energy + s.dayLength * D.DAY_REGEN * frac);
    }
    if (s.vitals.hunger <= 0) s.vitals.health = clamp(s.vitals.health - 6 * frac, 0, 100);
    if (s.vitals.thirst <= 0) s.vitals.health = clamp(s.vitals.health - 10 * frac, 0, 100);
    if (s.vitals.health <= 0 && !s.ending) this.causeOfDeath();
  };

  Game.gatherCost = function (zoneId) {
    var z = D.ZONES[zoneId], base = z.energy;
    if (this.s.weather === 'rain') base *= 1.25;
    if (this.s.weather === 'storm') base *= 1.5;
    if (this.hasTech('navigation')) base *= 0.8;
    return Math.round(base);
  };

  Game.gather = function (zoneId) {
    var s = this.s, z = D.ZONES[zoneId];
    if (!z) return { ok: false, why: '未知区域' };
    if (z.unlock > s.day) return { ok: false, why: '第 ' + z.unlock + ' 天解锁' };
    var cost = this.gatherCost(zoneId);
    if (s.energy < cost) return { ok: false, why: '体力不足' };
    if (this.dayActions() <= 0) return { ok: false, why: '今天的行动已用完，去休息吧' };

    s.energy -= cost;
    s.totalGathers++;
    var gain = {}, notes = [];
    var axe = this.hasGear('stone_axe') ? 1 : 0, iron = this.hasGear('iron_knife') ? 1.3 : 1;
    var knife = this.hasGear('stone_knife') ? 1.5 : 1;
    var fog = s.weather === 'fog' ? 0.7 : 1;
    var storm = s.weather === 'storm' ? 0.6 : 1;
    var mul = fog * storm;

    if (!this.has('campfire')) { axe = 0; }

    if (zoneId === 'forest') {
      gain.wood = Math.round(irnd(10, 16) * (1 + axe * (this.hasGear('iron_axe') ? 1.8 : 1)) * mul);
      gain.fiber = Math.round(irnd(6, 11) * mul);
      gain.stone = Math.round(irnd(0, 2) * mul);
      if (chance(0.35)) gain.food = Math.round(irnd(2, 5) * mul);
      if (chance(this.hasTech('herb') ? 0.7 : 0.3)) gain.herb = 1;
      if (this.hasTech('herb') && chance(0.45)) gain.herb = (gain.herb || 0) + 1;
      if (chance(0.18)) { gain.hide = 1; notes.push('找到了鹿褪下的皮'); }
    } else if (zoneId === 'stream') {
      gain.water = Math.round(irnd(8, 12) * mul);
      gain.food = Math.round(irnd(4, 9) * mul);
      gain.fiber = Math.round(irnd(6, 10) * mul);
      if (chance(0.25)) gain.stone = 2;
      if (chance(0.2)) notes.push('溪里有鱼，但没抓到');
    } else if (zoneId === 'stone') {
      gain.stone = Math.round(irnd(12, 18) * mul);
      gain.wood = Math.round(irnd(3, 6) * mul);
      if (chance(0.3)) gain.sulfur = irnd(1, 2);
      if (chance(0.35)) gain.coal = 1;
    } else if (zoneId === 'coast') {
      gain.wood = Math.round(irnd(8, 14) * (1 + axe * 0.6) * mul);
      gain.food = Math.round(irnd(5, 9) * mul);
      gain.cloth = chance(0.5) ? 2 : 1;
      gain.water = Math.round(irnd(0, 3) * mul);
      if (chance(0.15)) { gain.charcoal = 2; notes.push('你捡到一段没烧透的船木'); }
    } else if (zoneId === 'deep') {
      gain.hide = Math.round(irnd(2, 4) * knife);
      gain.meat = Math.round(irnd(3, 5) * knife);
      gain.wood = Math.round(irnd(10, 16) * (1 + axe));
      gain.herb = irnd(1, 3);
      gain.knowledge = 8;
    }

    // 工具与知识
    if (iron > 1) for (var k in gain) if (k !== 'knowledge') gain[k] = Math.round(gain[k] * iron);
    if (zoneId !== 'deep') gain.knowledge = irnd(3, 6);
    if (this.hasTech('navigation')) gain.knowledge = Math.round(gain.knowledge * 1.5);

    // 危险
    var danger = (z.danger || 0.1);
    if (zoneId === 'forest') danger = 0.1;
    if (s.weather === 'storm') danger += 0.2;
    if (this.hasGear('torch')) danger *= 0.5;
    if (this.has('shed')) danger -= 0.02;
    var gatherWarm = -(2 + (s.weather === 'rain' || s.weather === 'storm' ? 5 : 0) + (s.weather === 'cold' ? 7 : 0));
    if (s.flags.fireLit) gatherWarm += 2;
    gain.warmth = gatherWarm;

    if (chance(danger)) {
      var hurt = irnd(10, 20);
      if (zoneId === 'deep') hurt = irnd(16, 26);
      if (this.hasGear('spear')) hurt = Math.round(hurt * 0.6);
      s.vitals.health = clamp(s.vitals.health - hurt, 0, 100);
      gain.health = -hurt;
      s.energy = Math.max(0, s.energy - 5);
      notes.push((zoneId === 'deep' ? '野兽扑了上来，你挂彩了！' : '你摔了一跤，受了伤。'));
    }

    s.vitals.warmth = clamp(s.vitals.warmth + gain.warmth, 0, 100);
    this.gain(gain);
    this.gainKnowledge(gain.knowledge || 0);
    this.useAction();

    var parts = [];
    for (var r in gain) {
      if (r === 'knowledge' || r === 'warmth' || r === 'health') continue;
      parts.push(D.RES[r].icon + ' ' + D.RES[r].name + ' +' + gain[r]);
    }
    this.log('在' + z.name + '：' + parts.join('，') + '。' + (notes.join('') ? ' ' + notes.join('') : ''), 'good');
    if (gain.health) this.log(notes.pop() || '你受了伤。', 'bad');
    if (s.vitals.health <= 0) this.end('injury');
    this.save();
    return { ok: true, gain: gain, notes: notes };
  };

  Game.build = function (id) {
    var chk = this.canBuild(id);
    if (!chk.ok) return chk;
    var b = D.BUILDINGS[id];
    this.pay(b.cost);
    this.s.buildings[id] = this.count(id) + 1;
    this.useAction();
    this.log('建造完成：' + b.icon + ' ' + b.name + (this.count(id) > 1 ? ' ×' + this.count(id) : ''), 'good');
    if (id === 'campfire') {
      this.s.flags.fireLit = false;
      this.log('营火搭好了，去「营地」把它点燃。', 'hint');
    }
    this.save();
    return { ok: true };
  };

  Game.craft = function (id) {
    var chk = this.canCraft(id);
    if (!chk.ok) return chk;
    var r = D.RECIPES[id];
    this.pay(r.cost);
    this.s.totalCrafts++;
    if (r.cat === '食物' || r.cat === '医疗') {
      if (id === 'cooked_meat') this.gain({ food: 15 });
      else if (id === 'c_water') this.gain({ water: this.hasTech('water') ? 14 : 10 });
      else if (id === 'bread') this.gain({ food: 16 });
      else if (id === 'bandage') this.s.vitals.health = clamp(this.s.vitals.health + (this.hasTech('herb') ? 32 : 20), 0, 100);
      else if (id === 'herbal') this.s.vitals.health = clamp(this.s.vitals.health + (this.hasTech('herb') ? 55 : 35), 0, 100);
    } else if (id === 'powder') {
      this.s.flags.powder = true;
    } else {
      this.s.gear[id] = (this.s.gear[id] || 0) + 1;
    }
    this.useAction();
    this.log('制作完成：' + r.icon + ' ' + r.name, 'good');
    this.save();
    return { ok: true };
  };

  Game.research = function (id) {
    var t = D.TECHS[id], s = this.s;
    if (!t) return { ok: false, why: '未知科技' };
    if (this.hasTech(id)) return { ok: false, why: '已掌握' };
    if (t.day > s.day) return { ok: false, why: '第 ' + t.day + ' 天解锁' };
    if (t.req) for (var i = 0; i < t.req.length; i++) {
      if (!this.has(t.req[i])) return { ok: false, why: '需要先建造 ' + D.BUILDINGS[t.req[i]].name };
    }
    if (s.knowledge < t.knowledge) return { ok: false, why: '知识不足（需要 ' + t.knowledge + '）' };
    s.knowledge -= t.knowledge;
    s.techs[id] = true;
    this.log('掌握了科技：' + t.icon + ' ' + t.name, 'tech');
    this.save();
    return { ok: true };
  };

  /* ---------------- 夜晚 ---------------- */
  Game.setAction = function (a) {
    if (!D.ACTIONS[a]) return;
    this.s.action = a;
    this.save();
  };

  Game.startNight = function () {
    var s = this.s;
    if (s.phase === 'night') return;
    s.phase = 'night';
    s.nightStart = Date.now();
    this.log('天色暗了下来。你选择「' + D.ACTIONS[s.action].name + '」。', 'story');
    this.save();
    this.emit('night');
  };

  Game.nightProgress = function () {
    var s = this.s;
    if (s.phase !== 'night') return 0;
    return clamp((Date.now() - s.nightStart) / (D.NIGHT_SEC * 1000), 0, 1);
  };
  Game.isNightOver = function () {
    return this.s.phase === 'night' && this.nightProgress() >= 1;
  };

  /* 夜晚结算：产生整夜的结果，然后进入下一天 */
  Game.resolveNight = function () {
    var s = this.s, day = s.day;
    var lines = [];
    var fire = this.has('campfire');
    var fireWood = fire ? Math.max(1, (D.BUILDINGS.campfire.nightWood || 2) - (this.hasTech('fire') ? 1 : 0)) : 0;
    var extinguished = false;
    var rainHard = (s.weather === 'rain' || s.weather === 'storm');

    // 1. 营火烧柴
    if (fire && !s.flags.fireLit) {
      lines.push({ t: '🔥 营火一直没点着，这一夜只能缩在黑暗里。', c: 'bad' });
    }
    if (fire && s.flags.fireLit) {
      if ((s.res.wood || 0) >= fireWood) {
        s.res.wood -= fireWood;
        lines.push({ t: '🔥 营火烧掉了 ' + fireWood + ' 木材。', c: 'warn' });
        if (rainHard && !this.hasTech('fire') && chance(0.5)) {
          extinguished = true;
          lines.push({ t: '雨水浇透了火堆，火灭了。', c: 'bad' });
        }
      } else {
        extinguished = true;
        lines.push({ t: '木材不够，营火没能点起来。', c: 'bad' });
      }
    }

    // 2. 体温
    var base = 46 + irnd(-4, 4);
    var shelter = (this.has('lean') ? D.BUILDINGS.lean.warmth : 0) + (this.has('bed') ? 4 : 0);
    var coat = this.hasGear('fur_coat') ? 18 : 0;
    var fireWarm = (fire && s.flags.fireLit && !extinguished) ? D.BUILDINGS.campfire.warmth : 0;
    var wMod = { clear: 0, cloudy: -4, rain: -12, fog: -8, storm: -20, cold: -18 }[s.weather] || 0;
    var actionMod = s.action === 'scout' ? -10 : 0;
    var target = clamp(base + shelter + coat + fireWarm + wMod + actionMod, 0, 100);

    if (fire && s.flags.fireLit && !extinguished) {
      var bonus = Math.max(0, 40 - shelter) * 0.3;
      s.vitals.warmth = s.vitals.warmth * 0.15 + target * 0.85 + bonus;
    } else {
      s.vitals.warmth = s.vitals.warmth * 0.3 + target * 0.55;
    }
    s.vitals.warmth = clamp(s.vitals.warmth, 0, 100);
    lines.push({ t: '🌡️ 体温稳定在 ' + Math.round(s.vitals.warmth) + '。' + (s.vitals.warmth < 35 ? '你整夜都在发抖。' : s.vitals.warmth > 65 ? '这一夜睡得还算暖和。' : '被窝里始终带着凉意。'), c: s.vitals.warmth < 35 ? 'bad' : 'info' });

    // 3. 饥饿与口渴
    s.vitals.hunger = clamp(s.vitals.hunger - irnd(22, 28), 0, 100);
    s.vitals.thirst = clamp(s.vitals.thirst - irnd(25, 31), 0, 100);

    // 4. 夜间恢复
    var energyGain = 30;
    if (this.has('lean')) energyGain += 12;
    if (this.has('bed')) energyGain += D.BUILDINGS.bed.energy;
    if (s.vitals.warmth < 30) energyGain = Math.round(energyGain * 0.5);
    if (s.vitals.hunger < 20 || s.vitals.thirst < 20) energyGain = Math.round(energyGain * 0.65);
    if (s.action === 'craft') energyGain = Math.round(energyGain * 0.35);
    if (s.action === 'scout') energyGain = Math.round(energyGain * 0.45);
    // 夜间缓慢回满，白天靠休息继续回复
    s.energy = clamp(Math.max(s.energy, 25) * 0.5 + energyGain, 0, D.ENERGY_MAX);

    // 5. 夜间行动效果
    if (s.action === 'craft') {
      s.pending += 1;
      lines.push({ t: '⚒️ 你在火光下一直干到后半夜。明天的行动 +1。', c: 'good' });
    }
    if (s.action === 'scout') {
      var loot = { wood: irnd(4, 8), fiber: irnd(3, 6) };
      if (chance(0.5)) loot.food = irnd(3, 6);
      if (chance(0.3)) loot.herb = irnd(1, 2);
      if (chance(0.2)) loot.stone = irnd(2, 4);
      this.gain(loot);
      var p = [];
      for (var lk in loot) p.push(D.RES[lk].icon + ' ' + D.RES[lk].name + ' +' + loot[lk]);
      lines.push({ t: '🔭 你沿着海滩摸了半夜，捡到 ' + p.join('，') + '。', c: 'good' });
      s.knowledge += 3;
    }

    // 6. 建筑产出
    if (this.has('rain')) {
      var w = Math.round(D.BUILDINGS.rain.water * (this.hasTech('water') ? 1.5 : 1) * (rainHard ? 2 : 1));
      this.gain({ water: w });
      lines.push({ t: '🚰 集雨器攒下 ' + w + ' 净水。', c: 'good' });
    }
    if (this.has('snare')) {
      var traps = this.count('snare') + (this.hasTech('trap') ? Math.min(2, this.count('snare')) : 0);
      var hits = 0;
      var hitP = D.BUILDINGS.snare.meatChance + (this.hasTech('trap') ? 0.15 : 0) + (this.has('lean') ? 0 : 0);
      for (var i = 0; i < traps; i++) if (chance(hitP)) hits++;
      if (hits > 0) {
        this.gain({ meat: hits * 2 });
        lines.push({ t: '🪤 陷阱捕获 ' + hits + ' 次，带回 ' + hits * 2 + ' 生肉。', c: 'good' });
      } else {
        lines.push({ t: '🪤 陷阱一无所获。', c: 'info' });
      }
    }
    if (this.has('farm')) {
      var f = Math.round(D.BUILDINGS.farm.food * this.count('farm') * (rainHard ? 0.6 : 1));
      this.gain({ food: f });
      lines.push({ t: '🌾 菜圃收成 ' + f + ' 食物。', c: 'good' });
    }
    if (this.has('rack')) {
      var maxMeat = this.count('rack') * 3;
      var convert = Math.min((s.res.meat || 0), maxMeat);
      if (convert > 0) {
        s.res.meat -= convert;
        this.gain({ food: convert * (this.hasTech('preserve') ? 10 : 8) });
        lines.push({ t: '🥓 晾肉架把 ' + convert + ' 生肉制成了 ' + convert * (this.hasTech('preserve') ? 10 : 8) + ' 食物。', c: 'good' });
      }
    }
    if (this.has('smelter')) {
      var need = 2;
      if ((s.res.wood || 0) >= need && chance(0.7)) {
        s.res.wood -= need;
        this.gain({ charcoal: 2 });
        lines.push({ t: '⚒️ 窑里闷出了一批木炭。', c: 'good' });
      }
    }

    // 7. 食物失鲜
    if (!this.hasTech('preserve') && s.res.food > 0) {
      var loss = Math.round(s.res.food * 0.06);
      if (loss > 0) {
        s.res.food -= loss;
        lines.push({ t: '🍖 闷热的夜里，' + loss + ' 份食物坏了。', c: 'warn' });
      }
    }

    // 8. 夜袭
    var wolfP = s.flags.fireLit && !extinguished ? 0.08 : 0.24;
    if (s.weather === 'storm') wolfP += 0.1;
    if (this.has('shed')) wolfP -= 0.05;
    if (chance(wolfP)) {
      var dmg = irnd(8, 16);
      if (this.hasGear('spear')) dmg = Math.round(dmg * 0.5);
      if (this.hasGear('torch')) dmg = Math.round(dmg * 0.7);
      s.vitals.health = clamp(s.vitals.health - dmg, 0, 100);
      lines.push({ t: '🐺 半夜有野兽在营地外徘徊，你被撕伤，体力 -' + dmg + '。', c: 'bad' });
    }

    // 9. 饥饿口渴惩罚
    if (s.vitals.hunger <= 0) {
      s.vitals.health = clamp(s.vitals.health - 15, 0, 100);
      lines.push({ t: '🍖 胃里空得发疼，体力 -15。', c: 'bad' });
    }
    if (s.vitals.thirst <= 0) {
      s.vitals.health = clamp(s.vitals.health - 20, 0, 100);
      lines.push({ t: '💧 没有水，头痛欲裂，体力 -20。', c: 'bad' });
    }
    if (s.vitals.warmth < 20) {
      s.vitals.health = clamp(s.vitals.health - 10, 0, 100);
      lines.push({ t: '❄️ 冷得失去知觉，体力 -10。', c: 'bad' });
    }

    this.s.lastNight = { day: day, lines: lines, extinguished: extinguished };
    A.lastNight = this.s.lastNight;
    return this.s.lastNight;
  };

  /* 进入第二天 */
  Game.nextDay = function () {
    var s = this.s;
    if (s.ending) return;
    if (s.vitals.health <= 0 && !s.ending) { this.causeOfDeath(); return; }
    s.day += 1;
    s.phase = 'day';
    s.dayStart = Date.now();
    s.pending = 0;
    s.action = 'rest';
    s.weather = this.rollWeather(s.day);
    s.knowledge += 2;
    s.flags.fireLit = false;          // 每天都需要重新点火
    if (this.has('campfire')) {
      s.flags.fireLit = true;         // 点过一次之后，次日清晨重新生好火
      this.log('清晨，你把余烬拨开，重新吹起火苗。', 'info');
    }
    if (s.day > D.TOTAL_DAYS) {
      this.end('rescue');
      return;
    }
    this.log('—— 第 ' + s.day + ' 天 ——', 'day');
    this.log('天气：' + D.WEATHER[s.weather].icon + ' ' + D.WEATHER[s.weather].name + '。' + D.WEATHER[s.weather].desc, 'info');
    // 检查新解锁
    for (var id in D.BUILDINGS) if (D.BUILDINGS[id].day === s.day) this.log('可以尝试建造 ' + D.BUILDINGS[id].icon + ' ' + D.BUILDINGS[id].name + ' 了。', 'hint');
    if (s.vitals.hunger < 25) this.log('你已经很饿了，别忘了吃点东西。', 'hint');
    if (s.vitals.thirst < 25) this.log('嗓子干得发疼，去溪边或者集雨器取水。', 'hint');
    this.save();
    this.emit('newday');
  };

  Game.causeOfDeath = function () {
    var v = this.s.vitals;
    var cause = 'injury';
    if (v.warmth < 20) cause = 'cold';
    if (v.thirst <= 0) cause = 'thirst';
    if (v.hunger <= 0) cause = 'starvation';
    this.end(cause);
  };

  Game.end = function (cause) {
    var s = this.s;
    if (s.ending) return;
    s.ending = cause;
    s.phase = 'over';
    this.log('—— ' + D.ENDINGS[cause].title + ' ——', 'day');
    this.save();
    this.emit('over', cause);
  };

  /* ---------------- 随机事件 ---------------- */
  Game.rollEvent = function (force) {
    var s = this.s;
    var p = 0.18 + (s.weather === 'storm' ? 0.1 : 0);
    if (!force && !chance(p)) return null;
    var pool = D.EVENT_POOL.filter(function (id) {
      if (id === 'pursue' && s.day < 2) return false;
      if (id === 'storm_collapse' && s.weather !== 'storm' && s.weather !== 'rain') return false;
      return true;
    });
    if (!pool.length) return null;
    var id = pool[irnd(0, pool.length - 1)];
    A.eventId = id;
    this.emit('event', id);
    return id;
  };

  /* 天数推进时判断是否该来一场遭遇 */
  Game.eventDue = function () {
    var s = this.s;
    if (s.day < 2) return false;
    var gap = s.day - (s.nextEventAt || 2);
    if (gap < 0) return false;
    return true;
  };

  Game.eventOptions = function (id) {
    var e = D.EVENTS[id], self = this;
    return e.choices.map(function (c, i) {
      var ok = true, why = '';
      if (c.condition === 'fire' && !(self.has('campfire') || self.hasGear('torch'))) { ok = false; why = '没有火源'; }
      if (c.condition === 'spear' && !self.hasGear('spear')) { ok = false; why = '没有木矛'; }
      if (c.need) {
        var lack = self.missing(c.need);
        if (lack.length) { ok = false; why = '缺少 ' + lack.map(function (k) { return D.RES[k].name; }).join('、'); }
      }
      return { index: i, label: c.label, tip: c.tip || '', ok: ok, why: why };
    });
  };

  Game.resolveEvent = function (id, index) {
    var e = D.EVENTS[id], c = e.choices[index];
    var a = c.apply || {};
    if (c.need) this.pay(c.need);
    if (a.res) this.gain(a.res);
    if (a.knowledge) this.gainKnowledge(a.knowledge);
    if (a.health) this.s.vitals.health = clamp(this.s.vitals.health + a.health, 0, 100);
    if (a.warmth) this.s.vitals.warmth = clamp(this.s.vitals.warmth + a.warmth, 0, 100);
    if (a.energy) this.s.energy = clamp(this.s.energy + a.energy, 0, D.ENERGY_MAX);
    if (a.randomLoot) {
      var loot = {};
      var res = ['wood', 'stone', 'fiber', 'food', 'water', 'herb', 'cloth', 'hide'];
      for (var i = 0; i < 3; i++) {
        var r = res[irnd(0, res.length - 1)];
        loot[r] = (loot[r] || 0) + irnd(2, 6);
      }
      this.gain(loot);
    }
    if (a.log) this.log(e.title + '：' + a.log, c.label.indexOf('逃跑') >= 0 ? 'bad' : 'info');
    this.s.nextEventAt = (this.s.day || 1) + 2 + irnd(0, 1);
    if (this.s.vitals.health <= 0) this.end('injury');
    this.save();
    A.eventId = null;
    return { ok: true };
  };

  /* ---------------- 存档兼容：恢复计时 ---------------- */
  Game.tick = function (dtMs) {
    var s = this.s;
    if (!s || s.ending) return;
    this.idleTick(dtMs || 500);
    if (s.phase === 'day' && this.isDayOver()) this.startNight();
  };

  A.Game = Game;
  A.util = { clamp: clamp, rnd: rnd, irnd: irnd, chance: chance };
})(window.WS = window.WS || {});