// 修復師升級規則（不碰畫面，方便測試）：打贏拿經驗 → 升級 → 三選一技能。
// 技能會疊加（每個有上限），開戰時轉成戰鬥參數交給 Battle。
(function (root) {
  'use strict';

  // 從 Lv n 升到 Lv n+1 需要的經驗：25、50、75…
  const xpToNext = level => 25 * level;

  // 打贏一場拿到的經驗＝這場要填的空格數（4×4 約 10、6×6 約 20、9×9 約 50）
  const xpFor = holes => holes;

  const SKILLS = [
    { id: 'heart',  name: '備用電池',     icon: 'heart',  max: 2, text: '心的上限 +1',              detail: n => `心的上限 +${n}` },
    { id: 'combo',  name: '連擊大師', icon: 'sword',  max: 3, text: '連擊每格加成 +0.1 倍',      detail: n => `連擊最高 ${(2 + 0.4 * n).toFixed(1)} 倍` },
    { id: 'reveal', name: '作弊碼', icon: 'scan',   max: 3, text: '每場開場自動多填好 1 格',   detail: n => `開場多填 ${n} 格` },
    { id: 'calm',   name: '轉圈圈',     icon: 'freeze', max: 3, text: '怪物攻擊倒數 +4 秒',        detail: n => `攻擊倒數 +${4 * n} 秒` },
    { id: 'crit',   name: '超頻爆擊', icon: 'bomb',   max: 3, text: '爆擊傷害 +30%',             detail: n => `爆擊傷害 +${30 * n}%` },
    { id: 'shield', name: '防火牆',     icon: 'shield', max: 1, text: '每場擋下第一次扣心',        detail: () => '每場擋 1 次扣心' },
    { id: 'lucky',  name: '挖礦',     icon: 'coin',   max: 3, text: '打贏的金幣 +20%',           detail: n => `金幣 +${20 * n}%` },
    // 職業專屬技能（進化後才抽得到）
    { id: 'reflect', cls: 'knight', name: '反彈',     icon: 'shield', max: 3, text: '填錯時怪物也受 25 傷害',   detail: n => `填錯反彈 ${25 * n} 傷害` },
    { id: 'wall',    cls: 'knight', name: '雙重驗證',     icon: 'shield', max: 2, text: '每場多 1 道防火牆',          detail: n => `防火牆 +${n} 道` },
    { id: 'chain',   cls: 'mage',   name: '連鎖爆擊', icon: 'bomb',   max: 2, text: '爆擊時順便揭開 1 格',      detail: n => `爆擊連鎖 ${n} 格` },
    { id: 'focus',   cls: 'mage',   name: '專注',     icon: 'freeze', max: 3, text: '填對時倒數多退 5%',        detail: n => `倒數多退 ${5 * n}%` },
    { id: 'spare',   cls: 'rogue',  name: '快取',     icon: 'scan',   max: 2, text: '用道具有 20% 機會不消耗',  detail: n => `道具 ${20 * n}% 不消耗` },
    { id: 'loot',    cls: 'rogue',  name: '順手牽羊', icon: 'coin',   max: 3, text: '打贏有 25% 機會撿到道具', detail: n => `撿道具 ${25 * n}%` },
  ];
  const byId = Object.fromEntries(SKILLS.map(s => [s.id, s]));

  // 進化：Lv 2 起可以三選一（2026-11-12 由 Lv 4 提早）。外觀換成職業裝，之後升級多抽到職業專屬技能。
  const EVOLVE_LV = 2;
  const CLASSES = {
    knight: { name: '除錯騎士', icon: 'shield', role: '耐打', text: '心的上限 +1、每場多 1 道防火牆' },
    mage:   { name: '演算法師', icon: 'bomb',   role: '攻擊', text: '爆擊傷害 +50%' },
    rogue:  { name: '亂碼盜賊', icon: 'coin',   role: '運氣', text: '開場多填 1 格、金幣 +30%' },
  };
  const canEvolve = g => !g.cls && g.level >= EVOLVE_LV;
  function evolve(g, cls) {
    if (!canEvolve(g) || !CLASSES[cls]) return { ok: false };
    g.cls = cls;
    if (root.Avatar) root.Avatar.giveClassSet(g, cls);
    return { ok: true };
  }

  const lv = (g, id) => (g.skills && g.skills[id]) || 0;

  // 加經驗；回傳升了幾級。每升一級要選一次技能（記在 picks）
  function gainXp(g, amount) {
    g.xp += amount;
    let ups = 0;
    while (g.xp >= xpToNext(g.level)) {
      g.xp -= xpToNext(g.level);
      g.level++;
      ups++;
    }
    g.picks = (g.picks || 0) + ups;
    return ups;
  }

  // 隨機抽三個還沒點滿的技能（不足三個就給剩下的）；職業專屬技能要是那個職業才抽得到
  const available = (g, s) => (!s.cls || s.cls === g.cls) && lv(g, s.id) < s.max;
  function rollChoices(g, rng) {
    rng = rng || Math.random;
    const pool = SKILLS.filter(s => available(g, s));
    const out = [];
    // 進化後，第一張卡優先放一個職業技能，讓玩家感覺到職業的差別
    const own = pool.filter(s => s.cls);
    if (own.length) { const s = own[Math.floor(rng() * own.length)]; out.push(s.id); pool.splice(pool.indexOf(s), 1); }
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
    return out;
  }

  function learn(g, id) {
    const s = byId[id];
    if (!s || !(g.picks > 0) || !available(g, s)) return { ok: false };
    g.skills[id] = lv(g, id) + 1;
    g.picks--;
    return { ok: true, level: g.skills[id] };
  }

  // 開戰時交給 Battle 的參數（技能＋職業本身的加成）
  function battleOpts(g) {
    const c = g.cls;
    const G = root.Gear ? root.Gear.total(g) : {}; // 穿著的裝備能力（gear.js）
    return {
      maxHearts: 3 + lv(g, 'heart') + (c === 'knight' ? 1 : 0) + (G.heart || 0),
      firstAttackBonus: g.follower === 'm3' ? 5 : 0, // 方塊跟班：第一次攻擊倒數多 5 秒
      reveal: lv(g, 'reveal') + (c === 'rogue' ? 1 : 0) + (G.peek || 0),
      shield: lv(g, 'shield') + lv(g, 'wall') + (c === 'knight' ? 1 : 0),
      rules: {
        comboStep: 0.25 + 0.1 * lv(g, 'combo') + (G.combo || 0) * 0.005,
        critBonus: 0.3 * lv(g, 'crit') + (c === 'mage' ? 0.5 : 0) + (G.crit || 0) / 100,
        attackBonus: 4 * lv(g, 'calm') + (G.dur || 0),
        reflect: 25 * lv(g, 'reflect'),
        chainReveal: lv(g, 'chain'),
        rollbackBonus: 0.05 * lv(g, 'focus'), // 在 Battle 加到基本退回比例上
        itemSave: 0.2 * lv(g, 'spare'),
      },
    };
  }

  const gearGold = g => (root.Gear ? root.Gear.total(g).gold : 0) / 100;
  const goldBonus = (g, reward) => Math.round(reward * (1 + gearGold(g) + 0.2 * lv(g, 'lucky') + (g.cls === 'rogue' ? 0.3 : 0) + (g.follower === 'm1' ? 0.1 : 0)));

  // 這場拿到的經驗（魔王跟班 +20%）
  const xpGain = (g, holes) => Math.round(xpFor(holes) * (g.follower === 'm4' ? 1.2 : 1));

  // 怪物跟班：打倒過的怪可以帶一隻，效果都很小（2026-11-10）
  const FOLLOWERS = {
    m1: { name: '小史萊姆', text: '打贏的金幣 +10%' },
    m2: { name: '小蝙蝠', text: '聞得出假數字：假數字的格子會有小記號' },
    m3: { name: '小方塊', text: '每場第一次怪物攻擊，倒數多 5 秒' },
    m4: { name: '小亂碼王', text: '打贏的經驗 +20%' },
  };
  function setFollower(g, id) {
    if (id && (!FOLLOWERS[id] || !g.dex[id])) return { ok: false };
    g.follower = id || null;
    return { ok: true };
  }

  // 技能「順手牽羊」：打贏時撿到一個隨機道具（回傳道具種類或 null）
  function loot(g, rng) {
    rng = rng || Math.random;
    if (rng() >= 0.25 * lv(g, 'loot')) return null;
    const kinds = ['scan', 'bomb', 'freeze', 'heal'];
    const k = kinds[Math.floor(rng() * kinds.length)];
    g.inventory[k] = (g.inventory[k] || 0) + 1;
    return k;
  }

  root.Hero = { SKILLS, byId, CLASSES, EVOLVE_LV, xpToNext, xpFor, xpGain, FOLLOWERS, setFollower, gainXp, rollChoices, learn, battleOpts, goldBonus, loot, canEvolve, evolve, lv };
})(typeof window !== 'undefined' ? window : globalThis);
