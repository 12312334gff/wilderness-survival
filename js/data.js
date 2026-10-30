/* 荒野余生 · 生存经营模拟 —— 静态配置 */
(function (A) {
  'use strict';
  var D = {};

  D.VERSION = 1;
  D.SAVE_KEY = 'wilderness-survival-save-v1';
  D.TOTAL_DAYS = 20;          // 坚持到第几天可以获救
  D.DAY_MS = 120000;          // 一个白天的真实时长（毫秒）
  D.NIGHT_SEC = 30;           // 夜晚结算演出的时长（秒）
  D.ENERGY_MAX = 100;

  /* ---------------- 资源 ---------------- */
  D.RES = {
    wood:    { name: '木材', icon: '🪵', safe: true },
    stone:   { name: '石料', icon: '🪨', safe: true },
    fiber:   { name: '纤维', icon: '🌿', safe: true },
    food:    { name: '食物', icon: '🍖', safe: false },
    water:   { name: '净水', icon: '💧', safe: false },
    herb:    { name: '草药', icon: '🌱', safe: true },
    hide:    { name: '兽皮', icon: '🐾', safe: true },
    meat:    { name: '生肉', icon: '🥩', safe: false },
    sulfur:  { name: '硫磺', icon: '🟡', safe: true },
    charcoal:{ name: '木炭', icon: '⚫', safe: true },
    coal:    { name: '煤炭', icon: '⬛', safe: true },
    cloth:   { name: '布条', icon: '🧵', safe: true }
  };
  D.RES_ORDER = ['wood', 'stone', 'fiber', 'food', 'water', 'herb', 'hide', 'meat', 'sulfur', 'charcoal', 'coal', 'cloth'];

  /* ---------------- 界面统计条 ---------------- */
  D.VITALS = [
    { key: 'hunger', name: '饥饿', icon: '🍖', color: '#d9a066', hint: '越低越饿；0 时会持续掉血' },
    { key: 'thirst', name: '口渴', icon: '💧', color: '#64b5e6', hint: '消耗比饥饿快；0 时掉血更快' },
    { key: 'warmth', name: '体温', icon: '🔥', color: '#f08a5d', hint: '夜间骤降，低于 30 影响体力恢复' },
    { key: 'health', name: '体力/状态', icon: '❤️', color: '#e05555', hint: '归零即倒下' }
  ];

  /* 白天里状态自然衰减 / 恢复 */
  D.DAY_DRAIN = { hunger: 9, thirst: 11, warmth: 1.2 };
  D.DAY_REGEN = 0.28;       // 每分钟真实时间的体力恢复
  D.BASE_STORAGE = 80;      // 建筑/科技前的基础储量

  /* ---------------- 建筑 ---------------- */
  D.BUILDINGS = {
    campfire: {
      name: '营火', icon: '🔥', cat: '基础', day: 1, cost: { wood: 15, stone: 5 }, once: true,
      desc: '明火取暖。夜间持续烧柴，维持体温并照亮四周。',
      nightWood: 2, warmth: 40
    },
    lean: {
      name: '简易窝棚', icon: '⛺', cat: '基础', day: 1, cost: { wood: 24, fiber: 16 }, once: true,
      desc: '挡风避雨的小棚子，夜间保温 +20。',
      warmth: 20
    },
    rain: {
      name: '集雨器', icon: '🚰', cat: '基础', day: 1, cost: { wood: 15, fiber: 25 }, once: true,
      desc: '每天清晨自动积累清水，雨天翻倍。',
      water: 10
    },
    snare: {
      name: '陷阱', icon: '🪤', cat: '基础', day: 1, cost: { wood: 12, fiber: 15 }, max: 4,
      desc: '每晨有几率带回生肉，1 份生肉当前食物。森林中命中率更高。',
      meatChance: 0.5
    },
    bed: {
      name: '草枕', icon: '🛏️', cat: '进阶', day: 2, cost: { fiber: 25, herb: 8 }, once: true, req: ['lean'],
      desc: '睡得更沉：白天恢复 +10，夜间多恢复 12 体力。',
      energy: 12
    },
    smelter: {
      name: '冶炼窑', icon: '⚒️', cat: '进阶', day: 2, cost: { stone: 40, wood: 20 }, once: true, req: ['campfire'],
      desc: '解锁进阶锻造：铁器类装备的制造前提。',
      unlock: ['forge']
    },
    farm: {
      name: '菜圃', icon: '🌾', cat: '进阶', day: 3, cost: { wood: 20, fiber: 20, water: 10 }, max: 3,
      desc: '每晨产出食物，投入越多回报越高。',
      food: 6
    },
    rack: {
      name: '晾肉架', icon: '🥓', cat: '进阶', day: 3, cost: { wood: 25, fiber: 10 }, max: 2,
      desc: '清晨自动把生肉晾成更耐放的食物。',
      meatConvert: 2
    },
    shed: {
      name: '储物棚', icon: '📦', cat: '进阶', day: 4, cost: { wood: 40, stone: 15 }, once: true,
      desc: '扩大储备容量 +60，雨天也保护木料不受潮。',
      cap: 60
    },
    signal: {
      name: '信号台', icon: '📡', cat: '终极', day: 6, cost: { wood: 60, stone: 40 }, req: ['campfire'], tech: 'signal',
      desc: '架起高台，等待救援飞机看到你的火堆。',
      unlock: ['signal']
    },
    flare: {
      name: '信号火堆', icon: '🧯', cat: '终极', day: 8, cost: { wood: 40, charcoal: 10, cloth: 5 }, req: ['signal'],
      desc: '制作黑火药信号弹，白天也能招来救援。',
      unlock: ['flare']
    }
  };
  D.BUILD_ORDER = ['campfire', 'lean', 'rain', 'snare', 'bed', 'smelter', 'farm', 'rack', 'shed', 'signal', 'flare'];

  /* ---------------- 科技 ---------------- */
  D.TECHS = {
    fire:      { name: '火种术', icon: '🔥', day: 1, knowledge: 10, desc: '营火燃烧更省柴（每夜 -1 木），雨天也不易熄灭。' },
    herb:      { name: '草药学', icon: '🌱', day: 1, knowledge: 15, desc: '治疗效率 +60%，采集时更容易找到草药。' },
    trap:      { name: '陷阱学', icon: '🪤', day: 2, knowledge: 20, desc: '陷阱每天多 1 只（上限 +2），命中率提升。' },
    preserve:  { name: '食物保存', icon: '🥓', day: 3, knowledge: 25, desc: '食物不再在夜间失鲜，晾肉架效率提升。' },
    smith:     { name: '锻造', icon: '⚒️', day: 4, knowledge: 35, req: ['smelter'], desc: '解锁铁器配方：铁刀、铁斧。' },
    water:     { name: '净水术', icon: '💧', day: 3, knowledge: 25, desc: '集雨器产出 +50%，制作净水更省柴。' },
    navigation:{ name: '天象导航', icon: '🧭', day: 5, knowledge: 40, desc: '探索体力消耗降低，收获更多知识。' },
    signal:    { name: '信号工程', icon: '📡', day: 6, knowledge: 50, desc: '解锁信号台与信号火堆的建造。' }
  };
  D.TECH_ORDER = ['fire', 'herb', 'trap', 'preserve', 'smith', 'water', 'navigation', 'signal'];

  /* ---------------- 制作配方 ---------------- */
  D.RECIPES = {
    stone_axe:  { name: '石斧', icon: '🪓', cat: '工具', day: 1, cost: { wood: 10, stone: 10, fiber: 8 },
      desc: '采集木材效率翻倍。', effect: '采集木材 +100%' },
    stone_knife:{ name: '石刀', icon: '🔪', cat: '工具', day: 1, cost: { wood: 5, stone: 12, fiber: 6 },
      desc: '处理猎物、剥皮更容易。', effect: '兽皮/生肉 +50%' },
    spear:      { name: '木矛', icon: '🗡️', cat: '装备', day: 1, cost: { wood: 15, stone: 5, fiber: 10 },
      desc: '深林里遇到野兽时有一战之力。', effect: '抵抗野兽袭击' },
    canteen:    { name: '水壶', icon: '🥤', cat: '装备', day: 2, cost: { hide: 2, fiber: 10 },
      desc: '随身带水，白天口渴增长 -35%。', effect: '口渴速度 -35%' },
    fur_coat:   { name: '兽皮衣', icon: '🧥', cat: '装备', day: 2, cost: { hide: 4, fiber: 15 },
      desc: '抵御寒冷，夜间保温 +18。', effect: '保温 +18' },
    cooked_meat:{ name: '烤肉', icon: '🍖', cat: '食物', day: 1, cost: { meat: 1, wood: 1 },
      desc: '消耗 1 生肉 + 1 木，得 15 食物。', effect: '食物 +15' },
    c_water:    { name: '净水', icon: '💧', cat: '食物', day: 1, cost: { wood: 1 },
      desc: '烧开一锅水，得 10 净水。', effect: '净水 +10' },
    bread:      { name: '烤块茎', icon: '🥔', cat: '食物', day: 2, cost: { food: 8, wood: 1 },
      desc: '挖到的块茎烤熟，得 16 食物。', effect: '食物 +16' },
    bandage:    { name: '绷带', icon: '🩹', cat: '医疗', day: 1, cost: { cloth: 1, herb: 1 },
      desc: '包扎伤口，体力 +20，伤势减轻。', effect: '体力 +20' },
    herbal:     { name: '草药膏', icon: '🧪', cat: '医疗', day: 2, cost: { herb: 3, charcoal: 1 },
      desc: '持续回血的贴剂，体力 +35。', effect: '体力 +35' },
    iron_knife: { name: '铁刀', icon: '🗡️', cat: '工具', day: 4, cost: { coal: 2, charcoal: 2, hide: 1 }, tech: 'smith',
      desc: '锋利的铁器，采集与剥皮再 +30%。', effect: '全采集 +30%' },
    iron_axe:   { name: '铁斧', icon: '🪓', cat: '工具', day: 5, cost: { coal: 3, charcoal: 3, stone: 5 }, tech: 'smith',
      desc: '伐木利器。', effect: '木材 +80%（累计）' },
    torch:      { name: '火把', icon: '🕯️', cat: '工具', day: 1, cost: { wood: 3, fiber: 2 },
      desc: '夜间探索时驱赶野兽。', effect: '探索更安全' },
    powder:     { name: '黑火药配方', icon: '🧨', cat: '终极', day: 8, cost: { sulfur: 6, charcoal: 6, coal: 2 }, tech: 'signal', once: true,
      desc: '为信号火堆准备火药。', effect: '解锁信号火堆' }
  };
  D.RECIPE_ORDER = ['stone_axe', 'stone_knife', 'spear', 'canteen', 'fur_coat', 'torch', 'cooked_meat', 'c_water', 'bread', 'bandage', 'herbal', 'iron_knife', 'iron_axe', 'powder'];

  /* ---------------- 采集区域 ---------------- */
  D.ZONES = {
    forest:  { name: '森林', icon: '🌲', unlock: 0, energy: 12, desc: '松林与灌木，木材纤维丰盛，野兽常出没。' },
    stream:  { name: '溪流', icon: '🏞️', unlock: 0, energy: 10, desc: '清水与芦草，常有鱼群，也最容易摔伤。' },
    stone:   { name: '石山', icon: '⛰️', unlock: 2, energy: 16, desc: '石料与硫磺矿脉，路远费体力。' },
    coast:   { name: '海岸', icon: '🌊', unlock: 3, energy: 14, desc: '断木与渔网残片，也许藏着失踪船只的物资。' },
    deep:    { name: '深林', icon: '🌑', unlock: 4, energy: 22, danger: 0.3, desc: '野兽的老巢。高风险，高回报。' }
  };
  D.ZONE_ORDER = ['forest', 'stream', 'stone', 'coast', 'deep'];

  /* ---------------- 夜间行动 ---------------- */
  D.ACTIONS = {
    rest:  { name: '生火休息', icon: '🔥', energy: 0, desc: '次日体力回满，专注恢复。' },
    craft: { name: '夜晚劳作', icon: '⚒️', energy: 20, desc: '熬夜干活：明天可以多建造或制作 1 次。' },
    scout: { name: '夜间巡哨', icon: '🔭', energy: 25, update: 'dark', desc: '暗中观察：发现额外资源，但更冷。' }
  };
  D.ACTION_ORDER = ['rest', 'craft', 'scout'];

  /* ---------------- 天气 ---------------- */
  D.WEATHER = {
    clear:  { name: '晴朗', icon: '☀️', desc: '阳光正好，适合出门。' },
    cloudy: { name: '阴云', icon: '☁️', desc: '风有点凉，气温普通。' },
    rain:   { name: '暴雨', icon: '🌧️', desc: '采集体力消耗更高，营火容易被浇灭。' },
    fog:    { name: '浓雾', icon: '🌫️', desc: '视野受限，探索收获减少。' },
    storm:  { name: '风暴', icon: '⛈️', desc: '狂风骤雨，非常危险。' },
    cold:   { name: '寒潮', icon: '❄️', desc: '气温骤降，夜间格外难熬。' }
  };

  /* ---------------- 随机事件 ---------------- */
  D.EVENTS = {
    villager: {
      title: '林中有灯', icon: '🌲',
      text: '探索时，你在林间看到远处有摇曳的灯光。一个披着斗篷的老人正守着火堆，见到你只抬了抬下巴。',
      choices: [
        { label: '拿出食物交换信息', need: { food: 5 }, tip: '食物 -5', apply: { knowledge: 15, log: '老人收下食物，在地上画了几道只有猎人才看得懂的记号。' } },
        { label: '帮他分柴', tip: '木材 -5，换些资源', apply: { res: { wood: -5, meat: 2, fiber: 12 }, log: '老人递给你几块风干的肉和一捆结实的纤维。' } },
        { label: '点头致意，继续赶路', apply: { warmth: 4, log: '你们安静地并肩烤了一会儿火，然后各走各的。' } }
      ]
    },
    pursue: {
      title: '撕开夜色', icon: '🐺',
      text: '树影里传来喘息。一群野狼围成了半圆，绿莹莹的眼睛在暗处晃动。',
      choices: [
        { label: '举火驱赶', tip: '需要 🔥 营火/火把', apply: { warmth: 4, log: '火光暴涨，狼群低吼着退进了黑暗。' }, condition: 'fire' },
        { label: '挥矛搏斗', tip: '需要 🗡️ 木矛，有受伤风险', apply: { health: -12, hide: 2, meat: 2, energy: -10, log: '你刺倒了一头狼，其余四散。代价是肩上被撕开一道口子。' }, condition: 'spear' },
        { label: '丢弃部分食物换取平安', need: { food: 10 }, tip: '食物 -10', apply: { log: '你把烤肉扔向远处，狼群立刻扑了过去。' } },
        { label: '拼命逃跑', apply: { health: -22, energy: -15, log: '你一直跑到肺里全是苦味，腿上的伤口还在渗血。' } }
      ]
    },
    caravan: {
      title: '倒下的营地', icon: '⛺',
      text: '一顶塌了一半的帐篷，散落着人的痕迹——也许是几天前的。',
      choices: [
        { label: '仔细搜刮', apply: { randomLoot: 1, log: '你在睡袋夹层里翻出了一些物资。' } },
        { label: '拆走帐篷的布', apply: { res: { cloth: 3, wood: 6, fiber: 10 }, log: '帆布裁剪成布条，绳子也还能用。' } },
        { label: '在营地边上留下记号', apply: { knowledge: 10, warmth: 3, log: '你记下了这里，也许以后还能回来。' } }
      ]
    },
    storm_collapse: {
      title: '夜半风吼', icon: '⛈️',
      text: '半夜，狂风扯动窝棚的支撑。雨水顺着缝隙灌了进来。',
      choices: [
        { label: '冒雨加固', need: { wood: 8 }, tip: '木材 -8', apply: { warmth: -5, log: '你顶着雨把绳子重新勒紧，窝棚保住了。' } },
        { label: '去火堆旁挨一夜', apply: { warmth: -10, health: -6, log: '你在火堆边发抖着熬到天亮，好在火没灭。' } }
      ]
    },
    berry: {
      title: '灌木深处', icon: '🍇',
      text: '顺着隐约的甜味，你找到一片野果灌木；旁边还长着几丛类似草药的植物。',
      choices: [
        { label: '摘果子', apply: { res: { food: 10 }, log: '你又酸又甜地吃了几颗，剩下装进了背包。' } },
        { label: '挖草药根', apply: { res: { herb: 4 }, log: '根茎的汁液还是熟悉的苦味——这就是药。' } },
        { label: '砍几根灌木', apply: { res: { wood: 8, fiber: 8 }, log: '干枯的枝条烧起来噼啪作响。' } }
      ]
    }
  };
  D.EVENT_POOL = ['villager', 'caravan', 'berry', 'pursue', 'storm_collapse'];

  /* ---------------- 结局文案 ---------------- */
  D.ENDINGS = {
    rescue: {
      title: '获救', icon: '🚁',
      text: '直升机的螺旋桨声撕开云层。救援队员用软梯放下来，冲你竖起大拇指。你回头看了一眼那片烧掉一半的林地，火堆还温热着——你已经在这里活下来了。'
    },
    starvation: { title: '饿毙', icon: '🍖', text: '饥饿先是让手指发抖，然后让一切都变得遥远。你靠着树干坐下来，星星变得很近。' },
    thirst:     { title: '干渴', icon: '💧', text: '唇上裂开的口子已经不会痛了，只有舌头还在渴。你听见溪水的声音——也许是幻觉。' },
    cold:       { title: '失温', icon: '❄️', text: '寒冷从脚趾开始，一直漫到意识深处。你梦见家里的暖气片发出轻轻的响声。' },
    injury:     { title: '伤势恶化', icon: '🩸', text: '伤口在高热里发烫，你也开始说胡话。没有救援，也没有更多的药了。' },
    wolf:       { title: '野狼之口', icon: '🐺', text: '黑暗中一阵混乱的撕扯。你的火把掉进泥里，熄灭得很干脆。' }
  };

  A.DATA = D;
})(window.WS = window.WS || {});