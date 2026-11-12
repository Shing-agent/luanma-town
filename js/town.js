// 小鎮規則（不碰畫面，方便測試）：修店、買道具、店家任務、怪物解鎖。
// 每間店被一隻怪佔據 → 打倒那隻怪才能花金幣修店 → 修好的店開賣道具、解鎖下一隻怪。
// 三間都修好，魔王出現在街尾廣場。
(function (root) {
  'use strict';

  const SHOPS = [
    { id: 'bakery', name: '麵包店', monster: 0, repair: 40, quest: 60, qname: '幫忙烤一爐修復麵包',
      items: [{ kind: 'heal', price: 30 }] },
    { id: 'clock', name: '鐘錶店', monster: 1, repair: 100, quest: 120, qname: '把停掉的鐘重新上發條',
      items: [{ kind: 'freeze', price: 25 }] },
    { id: 'tools', name: '工具店', monster: 2, repair: 150, quest: 180, qname: '整理被亂碼打翻的零件',
      items: [{ kind: 'scan', price: 20 }, { kind: 'bomb', price: 50 }] },
  ];
  const BOSS = 3;               // MONSTERS 裡魔王的編號
  const QUEST_DISCOUNT = 0.8;   // 任務完成後道具打 8 折
  const STARTER = { scan: 2, bomb: 0, freeze: 0, heal: 0 };

  function newGame() {
    return {
      gold: 0,
      inventory: Object.assign({}, STARTER),
      dex: {},                       // 怪物 id → 打倒次數
      repaired: SHOPS.map(() => false),
      quests: SHOPS.map(() => false),
      ended: false,                  // 打倒過魔王＝整條街修好
      level: 1, xp: 0,               // 修復師等級與目前經驗（規則在 hero.js）
      skills: {},                    // 技能 id → 等級
      picks: 0,                      // 還沒選的技能次數
      name: '', gender: '',          // 修復師名字、男生 m／女生 f（開場時問）
      look: { hat: 'none', cloth: 'blue', weapon: 'term' },   // 目前穿的（avatar.js）
      owned: { hat: [], cloth: [], weapon: [] },              // 擁有的裝備（起始裝備不用記）
      gear: { lv: {}, shards: 0 },   // 裝備等級（沒記錄＝Lv 1）與碎片（gear.js）
      cls: null,                     // 進化職業 knight／mage／rogue
      daily: { last: '', streak: 0, best: 0 },   // 每日挑戰：最後過關日、連續天數、最快秒數（daily.js）
      follower: null,                // 帶著走的跟班（怪物 id）
      maze: { shards: 0, meta: { heart: 0, cash: 0, reroll: 0 }, run: null, best: { floors: 0, clears: 0 }, unlocked: false }, // 亂碼迷宮（maze.js）：碎片、永久加成、進行中這局、最佳紀錄
    };
  }

  const beaten = (g, mIdx) => !!g.dex[root.MONSTERS[mIdx].id];
  const allRepaired = g => g.repaired.every(Boolean);
  // 試玩期間（main.js 設 TRIAL_OPEN）：魔王不用先修好三間店就能挑戰
  const bossOpen = g => !!root.TRIAL_OPEN || allRepaired(g);

  // 這隻怪現在能不能打
  function canFight(g, mIdx) {
    if (mIdx === BOSS) return bossOpen(g);
    if (mIdx === 0) return true;
    return g.repaired[mIdx - 1];
  }

  // 店的狀態：locked 還沒解鎖／occupied 被亂碼佔據／repairable 可以修／open 營業中／done 任務完成
  function shopStatus(g, i) {
    if (!canFight(g, SHOPS[i].monster)) return 'locked';
    if (g.quests[i]) return 'done';
    if (g.repaired[i]) return 'open';
    if (beaten(g, SHOPS[i].monster)) return 'repairable';
    return 'occupied';
  }

  function itemPrice(g, i, kind) {
    const it = SHOPS[i].items.find(x => x.kind === kind);
    return Math.round(it.price * (g.quests[i] ? QUEST_DISCOUNT : 1));
  }

  function pay(g, cost) {
    if (g.gold < cost) return { ok: false, reason: 'gold', short: cost - g.gold };
    g.gold -= cost;
    return { ok: true };
  }

  function repair(g, i) {
    const st = shopStatus(g, i);
    if (st !== 'repairable') return { ok: false, reason: st };
    const r = pay(g, SHOPS[i].repair);
    if (!r.ok) return r;
    g.repaired[i] = true;
    return { ok: true, unlocked: i + 1 < SHOPS.length ? SHOPS[i + 1].monster : BOSS };
  }

  function buy(g, i, kind) {
    if (!g.repaired[i]) return { ok: false, reason: 'closed' };
    const r = pay(g, itemPrice(g, i, kind));
    if (!r.ok) return r;
    g.inventory[kind] = (g.inventory[kind] || 0) + 1;
    return { ok: true };
  }

  function doQuest(g, i) {
    if (shopStatus(g, i) !== 'open') return { ok: false, reason: shopStatus(g, i) };
    const r = pay(g, SHOPS[i].quest);
    if (!r.ok) return r;
    g.quests[i] = true;
    return { ok: true };
  }

  // 打完一場：發金幣、記圖鑑；打倒魔王第一次＝結局
  function recordWin(g, mIdx, reward) {
    const id = root.MONSTERS[mIdx].id;
    const firstTime = !g.dex[id];
    g.dex[id] = (g.dex[id] || 0) + 1;
    g.gold += reward;
    let ending = false;
    if (mIdx === BOSS && !g.ended) { g.ended = true; ending = true; }
    return { firstTime, ending };
  }

  root.Town = { SHOPS, BOSS, QUEST_DISCOUNT, STARTER, newGame, canFight, shopStatus, itemPrice, repair, buy, doQuest, recordWin, allRepaired, bossOpen };
})(typeof window !== 'undefined' ? window : globalThis);
