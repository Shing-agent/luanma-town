// 裝備規則（不碰畫面，方便測試）：能力表、等級、碎片、掉落、補給箱。
// 外觀與名字在 avatar.js 的 ITEMS；這裡只管「穿著的三件加多少能力」。
// 存檔欄位：game.gear = { lv: { 裝備id: 等級 }, shards }；擁有／穿著照舊記在 game.owned／game.look。
(function (root) {
  'use strict';

  // 能力種類：dur 攻擊倒數秒數／peek 開場多填格數／crit 爆擊傷害％／combo 連擊加成％／gold 金幣％／heart 愛心上限
  const STATS = ['dur', 'peek', 'crit', 'combo', 'gold', 'heart'];
  const INT_STATS = ['heart', 'peek']; // 整數能力：不隨等級成長
  const STAT_TEXT = {
    dur: n => `攻擊倒數 +${n} 秒`, peek: n => `開場多填 ${n} 格`, crit: n => `爆擊傷害 +${n}%`,
    combo: n => `連擊加成 +${n}%`, gold: n => `金幣 +${n}%`, heart: n => `愛心上限 +${n}`,
  };
  const RARITY = { 1: { name: '普通', color: '#9aa0b5' }, 2: { name: '稀有', color: '#5a9bff' }, 3: { name: '傳說', color: '#ffc83d' } };
  const MAX_LV = 3;
  const UPGRADE_COST = { 1: 3, 2: 6 };         // 目前等級 → 升級要幾個碎片
  const SHARDS_FOR = { 1: 2, 2: 4, 3: 6 };      // 重複掉落轉成碎片
  const CRATE_PRICE = 100;

  // id → 部位、品質、能力、職業裝（cls：進化自動送、不掉落）
  const GEAR = {
    cap:    { slot: 'hat',    rarity: 1, stats: { dur: 1 } },
    beanie: { slot: 'hat',    rarity: 1, stats: { gold: 10 } },
    flower: { slot: 'hat',    rarity: 2, stats: { dur: 2, gold: 10 } },
    crown:  { slot: 'hat',    rarity: 3, stats: { crit: 20, combo: 5, dur: 1 } },
    red:    { slot: 'cloth',  rarity: 1, stats: { combo: 5 } },
    green:  { slot: 'cloth',  rarity: 1, stats: { gold: 10 } },
    pink:   { slot: 'cloth',  rarity: 1, stats: { dur: 1 } },
    yellow: { slot: 'cloth',  rarity: 1, stats: { crit: 10 } },
    white:  { slot: 'cloth',  rarity: 2, stats: { crit: 15, peek: 1 } },
    starry: { slot: 'cloth',  rarity: 3, stats: { heart: 1, combo: 5, gold: 15 } },
    lolly:  { slot: 'weapon', rarity: 1, stats: { combo: 5 } },
    bread:  { slot: 'weapon', rarity: 2, stats: { crit: 15, dur: 1 } },
    wrench: { slot: 'weapon', rarity: 2, stats: { combo: 8, gold: 10 } },
    keyboard: { slot: 'weapon', rarity: 3, stats: { crit: 25, combo: 8, peek: 1 } },
    // 職業裝（品質算傳說、不掉落）
    helmet: { slot: 'hat',    rarity: 3, cls: 'knight', stats: { dur: 2 } },
    armor:  { slot: 'cloth',  rarity: 3, cls: 'knight', stats: { heart: 1, combo: 5 } },
    shield: { slot: 'weapon', rarity: 3, cls: 'knight', stats: { crit: 10, dur: 1 } },
    wizard: { slot: 'hat',    rarity: 3, cls: 'mage',   stats: { crit: 15 } },
    robe:   { slot: 'cloth',  rarity: 3, cls: 'mage',   stats: { combo: 8, dur: 1 } },
    staff:  { slot: 'weapon', rarity: 3, cls: 'mage',   stats: { crit: 15, combo: 5 } },
    hood:   { slot: 'hat',    rarity: 3, cls: 'rogue',  stats: { gold: 15 } },
    cloak:  { slot: 'cloth',  rarity: 3, cls: 'rogue',  stats: { peek: 1, gold: 10 } },
    dagger: { slot: 'weapon', rarity: 3, cls: 'rogue',  stats: { gold: 10, combo: 5 } },
  };
  const SLOTS = ['hat', 'cloth', 'weapon'];

  const state = g => (g.gear = Object.assign({ lv: {}, shards: 0 }, g.gear, { lv: Object.assign({}, g.gear && g.gear.lv) }));
  // 讀取（不修改存檔）：沒記錄的等級視為 1
  const lv = (g, id) => Math.min(MAX_LV, Math.max(1, Math.floor((g.gear && g.gear.lv && g.gear.lv[id]) || 1)));
  const shards = g => (g.gear && g.gear.shards) || 0;

  // 某件裝備在某等級的某項能力數值（整數能力不成長）
  function statAt(id, stat, level) {
    const base = (GEAR[id] && GEAR[id].stats[stat]) || 0;
    if (!base || INT_STATS.includes(stat)) return base;
    return base * (1 + 0.5 * (level - 1));
  }
  // 一件裝備目前等級的所有能力
  function statsOf(g, id) {
    const out = {};
    if (!GEAR[id]) return out;
    for (const s of Object.keys(GEAR[id].stats)) out[s] = statAt(id, s, lv(g, id));
    return out;
  }
  // 目前穿著的三件加總
  function total(g) {
    const out = {};
    for (const s of STATS) out[s] = 0;
    for (const slot of SLOTS) {
      const id = g.look && g.look[slot];
      if (!id) continue;
      const st = statsOf(g, id);
      for (const s in st) out[s] += st[s];
    }
    return out;
  }

  const fmt = n => String(Math.round(n * 10) / 10);
  const statText = (stat, n) => STAT_TEXT[stat](fmt(n));
  // 一件裝備的能力文字清單（目前等級）
  const textOf = (g, id) => Object.entries(statsOf(g, id)).map(([s, n]) => statText(s, n));
  const totalText = g => Object.entries(total(g)).filter(([, n]) => n).map(([s, n]) => statText(s, n));

  // 升級：花碎片。回傳 { ok, reason: 'max'|'owned'|'shards', need, level }
  function upgrade(g, id) {
    if (!GEAR[id] || !root.Avatar.owns(g, GEAR[id].slot, id)) return { ok: false, reason: 'owned' };
    const cur = lv(g, id);
    if (cur >= MAX_LV) return { ok: false, reason: 'max' };
    const need = UPGRADE_COST[cur];
    if (shards(g) < need) return { ok: false, reason: 'shards', need, short: need - shards(g) };
    const st = state(g);
    st.shards -= need;
    st.lv[id] = cur + 1;
    return { ok: true, level: cur + 1, need };
  }

  // 依品質機率表抽一個品質（table：[普通, 稀有, 傳說] 的累積門檻）
  const ROLL = { normal: [0.70, 0.97], elite: [0, 0.75], crate: [0.60, 0.95] };
  function rollRarity(kind, rng) {
    const t = ROLL[kind], r = rng();
    return r < t[0] ? 1 : r < t[1] ? 2 : 3;
  }
  // 該品質、非職業裝、非起始的裝備
  const pool = rarity => Object.keys(GEAR).filter(id => GEAR[id].rarity === rarity && !GEAR[id].cls);

  // 發一件：沒有就加進擁有；已經有就改成碎片
  function give(g, id) {
    const slot = GEAR[id].slot;
    if (root.Avatar.owns(g, slot, id)) {
      const n = SHARDS_FOR[GEAR[id].rarity];
      state(g).shards += n;
      return { id, rarity: GEAR[id].rarity, dupe: true, shards: n };
    }
    g.owned[slot] = (g.owned[slot] || []).concat(id);
    return { id, rarity: GEAR[id].rarity, dupe: false, shards: 0 };
  }

  // 打贏後掉落。kind：'normal'（一般怪，25%）、'elite'（精英、幕王、魔王，100%）。沒掉就回傳 null
  function drop(g, kind, rng) {
    rng = rng || Math.random;
    if (kind === 'normal' && rng() >= 0.25) return null;
    const rar = rollRarity(kind === 'elite' ? 'elite' : 'normal', rng);
    const list = pool(rar);
    return give(g, list[Math.floor(rng() * list.length)]);
  }

  // 補給箱：花金幣開一個
  function crate(g, rng) {
    rng = rng || Math.random;
    if (g.gold < CRATE_PRICE) return { ok: false, reason: 'gold', short: CRATE_PRICE - g.gold };
    g.gold -= CRATE_PRICE;
    const list = pool(rollRarity('crate', rng));
    return Object.assign({ ok: true }, give(g, list[Math.floor(rng() * list.length)]));
  }

  // 補齊舊存檔欄位
  function normalize(g) { state(g); }

  root.Gear = { GEAR, STATS, SLOTS, RARITY, MAX_LV, UPGRADE_COST, SHARDS_FOR, CRATE_PRICE, lv, shards, statAt, statsOf, total, statText, textOf, totalText, upgrade, drop, crate, give, pool, normalize };
})(typeof window !== 'undefined' ? window : globalThis);
