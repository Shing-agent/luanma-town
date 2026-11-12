// 亂碼迷宮（肉鴿模式）規則：不碰畫面，方便測試。
// 一局＝3 幕 × 5 關（每幕第 5 關是幕王）；每關從 1～3 條路選 1 條（戰鬥、精英、休息、商店、事件）；
// 打贏掉外掛（15 種、最多 Lv3），同流派湊 2、3 個有套裝效果；心用完＝這局結束，結算亂碼碎片買永久加成。
// 主線的技能、職業加成、道具、跟班在迷宮都不生效（只靠外掛），所以戰鬥選項全部由這裡產生。
(function (root) {
  'use strict';

  const MAXLV = 3;
  const FLOWS = {
    combo: { name: '連擊', color: '#e0a63d' },
    crit: { name: '爆擊', color: '#e0455f' },
    prime: { name: '質數', color: '#8a6bd9' },
    coin: { name: '金幣', color: '#d4b020' },
    any: { name: '通用', color: '#5a8fb8' },
  };

  // id 命名：c_連擊、k_爆擊、p_質數、g_金幣、x_通用（debug 網址 mzpl=c_speed:2 會用到）
  const PLUGINS = [
    { id: 'c_speed', flow: 'combo', name: '連擊加速', text: l => `連擊每格加成變 +${(0.25 + 0.15 * l).toFixed(2).replace(/0$/, '')}` },
    { id: 'c_cap', flow: 'combo', name: '連擊無上限', text: l => `連擊加成上限變 +${100 + 50 * l}%` },
    { id: 'c_guard', flow: 'combo', name: '連擊保險', text: l => l >= 2 ? '填錯連擊只扣 3' : '填錯連擊只減半' },
    { id: 'k_power', flow: 'crit', name: '超頻爆擊', text: l => `爆擊傷害 +${40 * l}%` },
    { id: 'k_chain', flow: 'crit', name: '連鎖修復', text: l => `爆擊時順便揭開 ${l} 格` },
    { id: 'k_heal', flow: 'crit', name: '自動修復', rare: true, text: l => `每場前 ${l} 次爆擊各回 1 心` },
    { id: 'p_fist', flow: 'prime', name: '質數拳', text: l => `填質數（2、3、5）傷害 ×${1.5 + 0.5 * l}` },
    { id: 'p_eye', flow: 'prime', name: '質數之眼', text: l => `開場揭開 ${l} 個答案是質數的格` },
    { id: 'p_storm', flow: 'prime', name: '質數雷暴', rare: true, text: l => `填質數有 ${20 * l}% 機率落雷 +40 傷害` },
    { id: 'g_magnet', flow: 'coin', name: '金幣磁鐵', text: l => `打贏金幣 +${30 * l}%` },
    { id: 'g_gamble', flow: 'coin', name: '賭徒晶片', text: l => `填錯扣 ${13 - 3 * l} 金幣代替扣心` },
    { id: 'g_smash', flow: 'coin', name: '錢砸人', rare: true, text: l => `身上每 10 金幣，傷害 +${l}%（最多 +60%）` },
    { id: 'x_wall', flow: 'any', name: '防火牆', rare: true, text: l => `每場擋下 ${l} 次扣心` },
    { id: 'x_quick', flow: 'any', name: '快充', text: l => `大招只需 ${8 - l} 格充能` },
    { id: 'x_peek', flow: 'any', name: '作弊碼', text: l => `開場多揭開 ${l} 格` },
  ];
  const byId = Object.fromEntries(PLUGINS.map(p => [p.id, p]));

  const SETS = {
    combo: [null, null, '每連擊 5 次多一記 25 傷害「小爆擊」', '小爆擊再充能 +2'],
    crit: [null, null, '每次爆擊多充能 1', '爆擊傷害再 ×1.5'],
    prime: [null, null, '填質數倒數多退 10%', '填質數連擊 +2'],
    coin: [null, null, '每場多 1 個寶箱格、寶箱金幣 ×2', '商店 7 折'],
  };
  const SET_FLOWS = ['combo', 'crit', 'prime', 'coin'];

  const PACKS = {
    combo: { name: '連擊包', text: '連擊加速 Lv1＋連擊保險 Lv1', plugins: { c_speed: 1, c_guard: 1 }, gold: 0 },
    crit: { name: '爆擊包', text: '超頻爆擊 Lv1＋連鎖修復 Lv1', plugins: { k_power: 1, k_chain: 1 }, gold: 0 },
    prime: { name: '質數包', text: '質數拳 Lv1＋質數之眼 Lv1', plugins: { p_fist: 1, p_eye: 1 }, gold: 0 },
    coin: { name: '金幣包', text: '金幣磁鐵 Lv1＋賭徒晶片 Lv1＋30 金幣', plugins: { g_magnet: 1, g_gamble: 1 }, gold: 30 },
  };

  const META = {
    heart: { name: '備用電池', text: '每局多 1 顆心', cost: 20, max: 1 },
    cash: { name: '零用錢', text: '每局多 20 金幣', cost: 8, max: 3 },
    reroll: { name: '重抽券', text: '每局多 1 次免費重抽', cost: 12, max: 2 },
  };

  const ROOMS = {
    normal: { name: '普通怪', text: '兩隻亂碼怪，打贏拿金幣' },
    elite: { name: '精英怪', text: '更硬，打贏 3 選 1 外掛（含稀有）' },
    rest: { name: '存檔營火', text: '補 1 顆心，或鍛造一個外掛' },
    shop: { name: '商店', text: '用金幣買外掛、小補丁' },
    event: { name: '？事件', text: '不知道會遇到什麼' },
    boss: { name: '幕王', text: '這一幕的最終關卡' },
  };

  const ACT_MULT = [1, 1.35, 1.7];
  const ATTACK_BASE = [36, 30, 26]; // 普通怪攻擊倒數（秒），逐幕縮短
  const hpFor = (act, type) => 14 * ACT_MULT[act - 1] * (type === 'elite' ? 1.3 : 1) * (type === 'boss' ? 1.5 : 1);
  const attackFor = (act, type, n) => n === 9 ? 50 : ATTACK_BASE[act - 1] - (type === 'normal' ? 0 : 4); // 9×9 守門怪格子多，倒數放寬
  const fastFor = act => Math.max(18, ATTACK_BASE[act - 1] - 8); // 急躁／低電量
  const rngOf = r => r || Math.random;
  const pick = (arr, rng) => arr[Math.floor(rngOf(rng)() * arr.length)];
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rngOf(rng)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- 存檔欄位 ----------
  function newMazeSave() {
    return { shards: 0, meta: { heart: 0, cash: 0, reroll: 0 }, run: null, best: { floors: 0, clears: 0 }, unlocked: false };
  }
  // 舊存檔（沒有 maze 欄位，或欄位不齊）合併回預設值
  function normalize(g) {
    const d = newMazeSave(), m = g.maze && typeof g.maze === 'object' ? g.maze : {};
    g.maze = Object.assign(d, m);
    g.maze.meta = Object.assign(newMazeSave().meta, m.meta || {});
    g.maze.best = Object.assign(newMazeSave().best, m.best || {});
    return g.maze;
  }
  const unlocked = g => !!(root.TRIAL_OPEN || g.ended || (g.maze && g.maze.unlocked)); // 試玩期間（TRIAL_OPEN）裂縫直接開

  // ---------- 外掛 ----------
  const lv = (run, id) => (run.plugins && run.plugins[id]) || 0;
  const owned = run => PLUGINS.filter(p => lv(run, p.id) > 0);
  function flowCount(run, flow) { return PLUGINS.filter(p => p.flow === flow && lv(run, p.id) > 0).length; }
  // 目前湊到幾個流派套裝：[{flow, count, active:[說明…]}]
  function setStatus(run) {
    return SET_FLOWS.map(flow => {
      const count = flowCount(run, flow), active = [];
      for (let k = 2; k <= count && k <= 3; k++) active.push(SETS[flow][k]);
      return { flow, count, active };
    });
  }
  function addPlugin(run, id) {
    if (!byId[id] || lv(run, id) >= MAXLV) return false;
    run.plugins[id] = lv(run, id) + 1;
    return true;
  }

  // 戰鬥用的外掛參數（交給 Battle 的 mz）
  function mods(run) {
    const L = id => lv(run, id);
    const fc = f => flowCount(run, f);
    return {
      comboStep: 0.25 + 0.15 * L('c_speed'),
      comboCap: L('c_cap') ? (100 + 50 * L('c_cap')) / 100 : 1,
      comboKeep: L('c_guard') >= 2 ? 2 : L('c_guard') >= 1 ? 1 : 0,
      critBonus: 0.4 * L('k_power'),
      chain: L('k_chain'),
      critHeal: L('k_heal'),
      primeMult: L('p_fist') ? 1.5 + 0.5 * L('p_fist') : 1,
      primeReveal: L('p_eye'),
      storm: 0.2 * L('p_storm'),
      chestGold: fc('coin') >= 2 ? 20 : 10,
      chestExtra: fc('coin') >= 2 ? 1 : 0,
      wagerCost: L('g_gamble') ? 13 - 3 * L('g_gamble') : 0,
      smash: L('g_smash') * 0.01,
      ultNeed: Math.max(3, 8 - L('x_quick')),
      smallCrit: fc('combo') >= 2,
      smallCharge: fc('combo') >= 3 ? 2 : 0,
      critCharge: fc('crit') >= 2 ? 1 : 0,
      critMult: fc('crit') >= 3 ? 1.5 : 1,
      rollbackPrime: fc('prime') >= 2 ? 0.1 : 0,
      primeCombo: fc('prime') >= 3 ? 2 : 0,
      gold: run.gold, charge: run.charge || 0,
    };
  }
  const shopDiscount = run => (flowCount(run, 'coin') >= 3 ? 0.7 : 1);

  // ---------- 關卡與怪物 ----------
  const LOOKS = {
    slime: { map: 'blob', pal: { M: '#8fd14f', D: '#5a9a2c', W: '#ffffff', K: '#1d2b14', T: '#f4f4d0' } },
    bat: { map: 'bat', fly: true, pal: { M: '#b07ad9', D: '#7a4aa8', W: '#ffffff', K: '#25143a', T: '#f4e8ff' } },
    cube: { map: 'cube', glitchy: true, pal: { M: '#e0874f', D: '#a85a2a', W: '#ffffff', K: '#3a1e0c', T: '#fff0e0' } },
    knight: { map: 'cube', glitchy: true, pal: { M: '#6f86c4', D: '#44588f', W: '#ffffff', K: '#10162e', T: '#e3eaff' } },
    ghost: { map: 'bat', fly: true, pal: { M: '#d8e4ee', D: '#9bb0c4', W: '#ffffff', K: '#2a3442', T: '#ffffff' } },
    slime404: { map: 'blob', pal: { M: '#4fd1c5', D: '#2a8a82', W: '#ffffff', K: '#0c2a28', T: '#e0fffb' } },
    can: { map: 'can', pal: { M: '#e8d04a', D: '#a8902a', W: '#ffffff', K: '#3a3010', T: '#fff6c0', R: '#e0474f' } },
    popup: { map: 'popup', pal: { M: '#ffb3d0', D: '#c2557f', W: '#ffffff', K: '#4a1630', T: '#7fb7ff', R: '#e0474f' } },
    bear: { map: 'bear', pal: { M: '#b98b66', D: '#8a5f38', W: '#ffffff', K: '#2e1a0c', T: '#f3dcc0', B: '#33383f', R: '#e0474f' } },
  };
  // 每一幕的怪物種類：move 是這種怪的招式（cover 黏液／fake 雜訊／rush 急躁）
  const FOES = [
    [{ name: '亂碼史萊姆', look: 'slime', move: 'cover' }, { name: '小方塊', look: 'cube', move: 'rush' }, { name: '罐頭郵件', look: 'can', move: 'junk' }],
    [{ name: '亂碼史萊姆', look: 'slime', move: 'cover' }, { name: '雜訊蝙蝠', look: 'bat', move: 'fake' }, { name: '錯位方塊', look: 'cube', move: 'rush' }, { name: '彈窗小精靈', look: 'popup', move: 'popup' }],
    [{ name: '404 史萊姆', look: 'slime404', move: 'cover' }, { name: '錯位幽靈', look: 'ghost', move: 'fake' }, { name: '亂碼騎士', look: 'knight', move: 'rush' }, { name: '沒電熊', look: 'bear', move: 'lowbat' }],
  ];
  const MOVES = {
    cover: { moves: { cover: { every: 12, count: 1, max: 3 } }, moveName: '黏液' },
    fake: { moves: { fake: { every: 15, max: 2 } }, moveName: '雜訊' },
    rush: { moves: {}, fast: true, moveName: '急躁' },
    junk: { moves: { fake: { every: 15, max: 2 } }, moveName: '垃圾信' },
    popup: { moves: { cover: { every: 12, count: 2, max: 3 } }, moveName: '彈窗' },
    lowbat: { moves: {}, fast: true, moveName: '低電量' },
  };
  const BOSSES = [
    { name: '黏黏幕王', look: 'slime', scale: 2, move: { moves: { cover: { every: 12, count: 2, max: 4 } }, moveName: '黏液' } },
    { name: '雜訊幕王', look: 'bat', scale: 2, move: { moves: { fake: { every: 14, max: 3 } }, moveName: '雜訊' } },
    { name: '迷宮守門怪', look: 'boss', scale: 2, phases: true },
  ];

  const idxOf = run => (run.act - 1) * 5 + (run.floor - 1);
  const actOf = i => Math.floor(i / 5) + 1;

  function makeNode(run, type, rng) {
    rng = rngOf(rng);
    const act = run.act, boss = type === 'boss', elite = type === 'elite';
    const n = boss ? (act === 3 ? 9 : 6) : (act === 1 && run.floor < 3 ? 4 : 6); // 第 1 幕只有前 2 關是 4×4
    const hpPerHole = hpFor(act, type);
    const attackTime = attackFor(act, type, n);
    let foes, monster;
    if (boss) {
      const b = BOSSES[act - 1];
      const look = b.look === 'boss'
        ? { map: 'boss', pal: { M: '#7a5ad9', D: '#4a2a9a', W: '#ffffff', K: '#140c2a', T: '#e8e0ff', C: '#ffd84d', Y: '#57e3d4' } }
        : LOOKS[b.look];
      const def = Object.assign({ name: b.name, size: n, scale: b.scale, boss: true }, look);
      foes = [{ name: b.name, frac: 1, look: def }];
      if (b.phases) {
        const main = root.MONSTERS ? root.MONSTERS[3] : null;
        monster = Object.assign({}, def, {
          phases: (main ? main.phases : [{ moves: {}, name: '亂碼' }]).map(p => Object.assign({}, p)),
          moveName: '三段變身',
        });
      } else monster = Object.assign({}, def, b.move);
    } else {
      const kind = pick(FOES[act - 1], rng);
      // 第 1 幕第 1、2 關讓新手熟悉：史萊姆、小方塊先不放招（罐頭郵件照舊）
      const calm = act === 1 && run.floor < 3 && kind.look !== 'can';
      const mv = kind.move && !calm ? MOVES[kind.move] : { moves: {}, moveName: '直球' };
      const look = Object.assign({ name: kind.name, size: n, scale: 1 }, LOOKS[kind.look]);
      const fr = elite ? [0.4, 0.6] : [0.45, 0.55];
      foes = [
        { name: kind.name, frac: fr[0], look: Object.assign({}, look) },
        { name: (elite ? '精英・' : '') + kind.name + (elite ? '' : ' Ⅱ'), frac: fr[1], look: Object.assign({}, look, { name: (elite ? '精英・' : '') + kind.name }) },
      ];
      monster = Object.assign({}, look, { moves: mv.moves, moveName: mv.moveName });
      // 急躁（方塊）、低電量：攻擊倒數更短（該幕基準 −8 秒，最低 18）
      if (mv.fast) monster.attackTime = Math.min(attackTime, fastFor(act));
    }
    // 特殊格：寶箱、炸彈、黃金格（9×9 各 2 個）
    const per = n === 9 ? 2 : 1;
    return { type, n, hpPerHole, attackTime, foes, monster, specials: { chest: per, bomb: per, gold: per },
      reward: boss ? 40 : elite ? 30 : 15, act, floor: run.floor };
  }

  // 11/11 試過的快打版存下的關卡（有 boards、沒有 hpPerHole）：轉回經典格式
  function fixNode(node) {
    if (node.hpPerHole) return node;
    const act = node.act || 1, boss = node.type === 'boss', elite = node.type === 'elite';
    node.hpPerHole = hpFor(act, node.type);
    if (boss && act === 3) node.n = 9;
    node.attackTime = attackFor(act, node.type, node.n);
    const fr = boss ? [1] : elite ? [0.4, 0.6] : [0.45, 0.55];
    (node.foes || []).forEach((f, i) => { f.frac = fr[i] || fr[fr.length - 1]; delete f.boards; });
    if (node.monster && node.monster.attackTime === 9) node.monster.attackTime = 28;
    delete node.boards; delete node.hpScale;
    return node;
  }

  // 一場戰鬥要交給 Battle 的完整選項（不含題目）
  function battleOpts(run, node) {
    fixNode(node);
    const m = mods(run);
    m.specials = node.specials;
    return {
      monster: node.monster,
      foes: node.foes,
      hpPerHole: node.hpPerHole,
      maxHearts: run.maxHearts,
      shield: lv(run, 'x_wall'),
      reveal: lv(run, 'x_peek'),
      inventory: { scan: 0, bomb: 0, freeze: 0, heal: 0 },
      rules: { attackTime: node.attackTime },
      mz: m,
    };
  }

  // ---------- 一局的流程 ----------
  function newRun(meta, rng) {
    return {
      act: 1, floor: 1,
      hearts: 3 + (meta.heart || 0), maxHearts: 3 + (meta.heart || 0),
      gold: 20 * (meta.cash || 0), plugins: {}, charge: 0,
      rerolls: meta.reroll || 0,
      stats: { floors: 0, elites: 0, bosses: 0 },
      phase: 'start',                       // start 選起始包／path 選路／battle 戰鬥中／reward 掉落／rest／shop／event／over 結束
      starters: shuffle(Object.keys(PACKS), rng).slice(0, 3),
      choices: null, node: null, drops: null, shop: null, event: null, seen: {}, won: false,
    };
  }
  function applyStarter(run, id) {
    const p = PACKS[id];
    if (!p || run.phase !== 'start') return false;
    for (const k in p.plugins) run.plugins[k] = p.plugins[k];
    run.gold += p.gold;
    run.starters = null;
    toPath(run);
    return true;
  }

  function makeChoices(run, rng) {
    rng = rngOf(rng);
    const i = idxOf(run);
    if (run.floor === 5) return [{ type: 'boss' }];
    if (i === 0) return [{ type: 'normal' }];
    const others = ['rest', 'shop', 'event'];
    if (i >= 2) others.push('elite'); // 精英怪：第 1 幕第 3 關起（每幕第 3 關一定有）
    const out = [{ type: 'normal' }];
    const extra = shuffle(others, rng);
    // 補票：後半段如果還沒看過某種房間，就讓它出現
    const missing = others.filter(t => !run.seen[t]);
    if (i >= 8 && missing.length) { const t = pick(missing, rng); extra.splice(extra.indexOf(t), 1); extra.unshift(t); }
    if (run.floor === 3) { extra.splice(extra.indexOf('elite'), 1); extra.unshift('elite'); } // 每幕第 3 關：精英怪那條一定在
    const count = 1 + (rng() < 0.4 ? 1 : 2); // 2～3 條路
    for (let k = 0; k < count - 1 && k < extra.length; k++) out.push({ type: extra[k] });
    for (const c of out) run.seen[c.type] = true;
    return shuffle(out, rng);
  }

  function toPath(run, rng) {
    run.phase = 'path';
    run.choices = makeChoices(run, rng);
    run.node = null; run.drops = null; run.shop = null; run.event = null;
  }

  // 走進某條路
  function enter(run, i, rng) {
    if (run.phase !== 'path' || !run.choices || !run.choices[i]) return null;
    rng = rngOf(rng);
    const type = run.choices[i].type;
    if (type === 'normal' || type === 'elite' || type === 'boss') {
      run.node = makeNode(run, type, rng);
      run.phase = 'battle';
    } else if (type === 'rest') run.phase = 'rest';
    else if (type === 'shop') { run.shop = makeShop(run, rng); run.phase = 'shop'; }
    else { run.event = makeEvent(rng); run.phase = 'event'; }
    return type;
  }

  // 過了一關：往下一關（幕王打完心補滿、換下一幕）
  function advance(run, rng) {
    run.stats.floors++;
    const wasBoss = run.floor === 5;
    if (wasBoss) {
      run.hearts = run.maxHearts;
      if (run.act >= 3) { run.won = true; run.phase = 'over'; run.node = null; run.choices = null; return 'won'; }
      run.act++; run.floor = 1;
    } else run.floor++;
    toPath(run, rng);
    return 'next';
  }

  // 戰鬥結束：贏了 → 發金幣；精英、幕王才掉外掛（3 選 1），普通怪直接進下一關；輸了 → 這局結束
  function endBattle(run, won, battle, rng) {
    const node = run.node;
    run.hearts = battle.hearts; run.gold = battle.gold; run.charge = battle.charge;
    if (!won || battle.hearts <= 0) { run.phase = 'over'; run.won = false; return { lost: true }; }
    const reward = Math.round(node.reward * (1 + 0.3 * lv(run, 'g_magnet')));
    run.gold += reward;
    if (node.type === 'elite') run.stats.elites++;
    if (node.type === 'boss') run.stats.bosses++;
    if (node.type === 'normal') { advance(run, rng); return { lost: false, reward, kind: 'normal', drops: false }; }
    run.drops = { kind: node.type, options: rollDrops(run, node.type, rng) };
    run.phase = 'reward';
    return { lost: false, reward, kind: node.type, drops: true };
  }

  // ---------- 掉落、商店、事件 ----------
  const upgradeable = run => PLUGINS.filter(p => lv(run, p.id) > 0 && lv(run, p.id) < MAXLV);
  const candidates = (run, exclude) => PLUGINS.filter(p => lv(run, p.id) < MAXLV && !(exclude || []).includes(p.id));

  function rollOne(run, rng, exclude) {
    rng = rngOf(rng);
    const cands = candidates(run, exclude);
    if (!cands.length) return null;
    const flows = new Set(owned(run).filter(p => p.flow !== 'any').map(p => p.flow));
    let pool = cands;
    if (flows.size && rng() < 0.5) { const f = cands.filter(p => flows.has(p.flow)); if (f.length) pool = f; } // 一半機率從已有的流派抽
    let p = pick(pool, rng);
    if (p.rare && rng() < 0.6) p = pick(pool, rng); // 稀有的：60% 重抽一次
    return p;
  }

  function rollDrops(run, kind, rng) {
    rng = rngOf(rng);
    const out = [];
    for (let k = 0; k < 3; k++) { const p = rollOne(run, rng, out.map(x => x.id)); if (p) out.push({ id: p.id }); }
    if ((kind === 'elite' || kind === 'boss') && out.length && !out.some(o => byId[o.id].rare)) {
      const rares = candidates(run, out.map(x => x.id)).filter(p => p.rare);
      if (rares.length) out[Math.floor(rng() * out.length)] = { id: pick(rares, rng).id };
    }
    return out.map(o => ({ id: o.id, from: lv(run, o.id), to: lv(run, o.id) + 1 }));
  }

  function takeDrop(run, i) {
    if (run.phase !== 'reward' || !run.drops) return false;
    const d = run.drops.options[i];
    if (!d || !addPlugin(run, d.id)) return false;
    return true;
  }
  // 重抽：先用免費重抽券，沒有就花 10 金幣
  function rerollDrops(run, rng) {
    if (run.phase !== 'reward' || !run.drops) return { ok: false };
    if (run.rerolls > 0) run.rerolls--;
    else if (run.gold >= 10) run.gold -= 10;
    else return { ok: false, reason: 'gold' };
    run.drops.options = rollDrops(run, run.drops.kind, rng);
    return { ok: true };
  }

  const price = (run, p) => Math.round((p.rare ? 70 : 40) * shopDiscount(run));
  const HEAL_PRICE = 30;
  function makeShop(run, rng) {
    rng = rngOf(rng);
    const items = [];
    for (let k = 0; k < 3; k++) { const p = rollOne(run, rng, items.map(x => x.id)); if (p) items.push({ id: p.id, sold: false }); }
    if (items.length && rng() < 0.5 && !items.some(x => byId[x.id].rare)) { // 一半機率含稀有
      const rares = candidates(run, items.map(x => x.id)).filter(p => p.rare);
      if (rares.length) items[Math.floor(rng() * items.length)] = { id: pick(rares, rng).id, sold: false };
    }
    return { items, healSold: false };
  }
  function shopPrice(run, i) { return price(run, byId[run.shop.items[i].id]); }
  function shopHealPrice(run) { return Math.round(HEAL_PRICE * shopDiscount(run)); }
  function buyItem(run, i) {
    const it = run.shop && run.shop.items[i];
    if (!it || it.sold) return { ok: false, reason: 'sold' };
    if (lv(run, it.id) >= MAXLV) return { ok: false, reason: 'max' };
    const c = shopPrice(run, i);
    if (run.gold < c) return { ok: false, reason: 'gold', short: c - run.gold };
    run.gold -= c; it.sold = true; addPlugin(run, it.id);
    return { ok: true };
  }
  function buyHeal(run) {
    if (!run.shop || run.shop.healSold) return { ok: false, reason: 'sold' };
    if (run.hearts >= run.maxHearts) return { ok: false, reason: 'full' };
    const c = shopHealPrice(run);
    if (run.gold < c) return { ok: false, reason: 'gold', short: c - run.gold };
    run.gold -= c; run.shop.healSold = true; run.hearts++;
    return { ok: true };
  }

  function restHeal(run) {
    if (run.phase !== 'rest') return { ok: false };
    if (run.hearts >= run.maxHearts) return { ok: false, reason: 'full' };
    run.hearts++;
    return { ok: true };
  }
  function forge(run, id) {
    if (run.phase !== 'rest' || lv(run, id) < 1 || lv(run, id) >= MAXLV) return { ok: false };
    addPlugin(run, id);
    return { ok: true };
  }

  const EVENTS = ['merchant', 'spring', 'lost', 'gamble'];
  function makeEvent(rng) { return { id: pick(EVENTS, rng), done: false, msg: '' }; }
  // choice：merchant trade／spring drink／lost gold|box／gamble bet；'leave' 都是離開
  function eventAct(run, choice, rng) {
    rng = rngOf(rng);
    const ev = run.event;
    if (run.phase !== 'event' || !ev || ev.done) return { ok: false };
    let msg = '';
    if (choice === 'leave') msg = '你決定不管它，繼續往前走。';
    else if (ev.id === 'merchant' && choice === 'trade') {
      if (run.hearts < 2) return { ok: false, reason: 'hearts' };
      const rares = candidates(run).filter(p => p.rare), pool = rares.length ? rares : candidates(run);
      if (!pool.length) return { ok: false, reason: 'none' };
      const p = pick(pool, rng);
      run.hearts--; addPlugin(run, p.id);
      msg = `商人收走 1 顆心，遞給你「${p.name}」。「不用找了。」`;
      ev.gotId = p.id;
    } else if (ev.id === 'spring' && choice === 'drink') {
      if (rng() < 0.5) { run.maxHearts++; run.hearts = Math.min(run.maxHearts, run.hearts + 1); msg = '咕嘟咕嘟……心的上限 +1，還補了 1 顆心！'; ev.good = true; }
      else { run.hearts = Math.max(1, run.hearts - 1); msg = '噗！水是酸的，扣了 1 顆心（但你撐住了）。'; ev.good = false; }
    } else if (ev.id === 'lost' && choice === 'gold') {
      run.gold += 35; msg = '你收下 35 金幣。失主可能永遠不會來領。';
    } else if (ev.id === 'lost' && choice === 'box') {
      const up = upgradeable(run);
      const p = up.length ? pick(up, rng) : rollOne(run, rng, []);
      if (p) { addPlugin(run, p.id); msg = `箱子裡是「${p.name}」！${lv(run, p.id) > 1 ? '已有的外掛升到 Lv ' + lv(run, p.id) + '。' : ''}`; ev.gotId = p.id; }
      else msg = '箱子是空的，只有一張紙條：「謝謝惠顧」。';
    } else if (ev.id === 'gamble' && choice === 'bet') {
      if (run.gold < 20) return { ok: false, reason: 'gold' };
      run.gold -= 20;
      if (rng() < 0.5) { run.gold += 60; msg = '史萊姆荷官推來 60 金幣。墨鏡下的表情看不出來。'; ev.good = true; }
      else { msg = '荷官收走你的 20 金幣，推了推墨鏡。'; ev.good = false; }
    } else return { ok: false };
    ev.done = true; ev.msg = msg;
    return { ok: true, msg };
  }
  function eventFinish(run, rng) { return advance(run, rng); }

  // ---------- 結算與永久加成 ----------
  function shardsOf(run) { return run.stats.floors + run.stats.elites * 3 + run.stats.bosses * 8 + (run.won ? 10 : 0); }
  function settle(g) {
    const m = g.maze, run = m.run;
    if (!run || run.phase !== 'over') return null;
    const shards = shardsOf(run);
    m.shards += shards;
    m.best.floors = Math.max(m.best.floors, run.stats.floors);
    if (run.won) m.best.clears++;
    const summary = { shards, won: run.won, floors: run.stats.floors, elites: run.stats.elites, bosses: run.stats.bosses, plugins: Object.assign({}, run.plugins) };
    m.run = null;
    return summary;
  }
  function buyMeta(g, id) {
    const def = META[id], m = g.maze;
    if (!def) return { ok: false };
    if ((m.meta[id] || 0) >= def.max) return { ok: false, reason: 'max' };
    if (m.shards < def.cost) return { ok: false, reason: 'shards', short: def.cost - m.shards };
    m.shards -= def.cost; m.meta[id] = (m.meta[id] || 0) + 1;
    return { ok: true };
  }
  function startRun(g, rng) {
    if (!unlocked(g)) return null;
    g.maze.run = newRun(g.maze.meta, rng);
    return g.maze.run;
  }
  // 戰鬥中途關掉：回到選路畫面，重打同一關（不重新選路）
  const resumePhase = run => run.phase;

  root.Maze = {
    MAXLV, FLOWS, PLUGINS, byId, SETS, SET_FLOWS, PACKS, META, ROOMS, LOOKS, BOSSES, HEAL_PRICE,
    newMazeSave, normalize, unlocked, lv, owned, flowCount, setStatus, addPlugin, mods, shopDiscount,
    makeNode, fixNode, battleOpts, newRun, applyStarter, makeChoices, toPath, enter, advance, endBattle,
    upgradeable, rollDrops, rollOne, takeDrop, rerollDrops, makeShop, shopPrice, shopHealPrice, buyItem, buyHeal,
    restHeal, forge, makeEvent, eventAct, eventFinish, shardsOf, settle, buyMeta, startRun, resumePhase, idxOf, actOf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
