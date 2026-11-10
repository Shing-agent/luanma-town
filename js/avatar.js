// 修復師的外觀：男生／女生、帽子、衣服、武器（程式畫的像素風）。
// 衣櫥只是好看，不加能力（2026-11-10 煦恩決定）。職業裝在進化時免費送。
(function (root) {
  'use strict';

  const BODY = {
    m: [
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHHh.',
      '...SSSSSS...',
      '...SESSES...',
      '...SSSSSS...',
      '....SSSS....',
      '..BBBBBBBB..',
      '.BBBBGBBBBB.',
      '.SBBBBBBBBS.',
      '.S.BBBBBB.S.',
      '...BBBBBB...',
      '...PP..PP...',
      '...PP..PP...',
      '...PP..PP...',
      '..KKK..KKK..',
    ],
    f: [
      '....HHHH....',
      '..HHHHHHHH..',
      '.HHHHHHHHHh.',
      '.HHSSSSSSHH.',
      '.HHSESSESHH.',
      '.HHSSRRSSHH.',
      '.HH.SSSS.HH.',
      '..BBBBBBBB..',
      '.BBBBGBBBBB.',
      '.SBBBBBBBBS.',
      '.S.BBBBBB.S.',
      '..DDDDDDDD..',
      '.DDDDDDDDDD.',
      '....SS.SS...',
      '....SS.SS...',
      '...KKK.KKK..',
    ],
  };
  const HAIR = { m: ['#2f7a55', '#1f5a3d'], f: ['#b8456e', '#8a2f52'] };

  // 帽子：map 從頭頂往上 dy 格開始畫
  const HATS = {
    none: null,
    cap: { dy: 0, pal: { C: '#e0455f', c: '#a82f45' }, map: [
      '...CCCCCC...',
      '..CCCCCCCC..',
      '..cccccccccc',
    ] },
    beanie: { dy: -1, pal: { Y: '#ffd84d', Z: '#c9a02a', W: '#ffffff' }, map: [
      '.....WW.....',
      '...YYYYYY...',
      '..YYYYYYYY..',
      '..ZZZZZZZZ..',
    ] },
    flower: { dy: 1, pal: { R: '#ff7ab0', Y: '#ffd84d', F: '#ffffff', L: '#57a37a' }, map: [
      '..RLFLYLRLF.',
    ] },
    crown: { dy: -2, pal: { Y: '#ffd84d', R: '#e0455f', C: '#57e3d4' }, map: [
      '....Y.Y.Y...',
      '....YYYYY...',
      '....YRYCY...',
    ] },
    helmet: { dy: -1, pal: { M: '#9aa6b5', L: '#d8e0e8', K: '#5a6470' }, map: [
      '...MMMMMM...',
      '..MLMMMMMM..',
      '..MLMMMMMM..',
      '..KKKKKKKK..',
    ] },
    wizard: { dy: -5, pal: { W: '#6b52b5', w: '#4a3a8a', Y: '#ffd84d' }, map: [
      '.......W....',
      '......WW....',
      '.....WWW....',
      '....WWYWW...',
      '...WWWWWWW..',
      '.wwwwwwwwww.',
    ] },
    hood: { dy: -1, pal: { D: '#3a3a4a', d: '#2a2a33' }, map: [
      '...DDDDDD...',
      '..DDDDDDDD..',
      '.DDDDDDDDDD.',
      '.Dd......dD.',
      '.Dd......dD.',
      '.Dd......dD.',
    ] },
  };

  // 衣服：B 主色、G 胸口小點、D 裙子（女生）
  const CLOTHES = {
    blue: { B: '#3b5b8c', G: '#57e389' },
    red: { B: '#b03a52', G: '#ffd84d' },
    green: { B: '#2e8b57', G: '#ffffff' },
    pink: { B: '#e07ab0', G: '#ffffff' },
    yellow: { B: '#d9a52a', G: '#b03a52' },
    white: { B: '#e8e8f0', G: '#5f8fe8' },
    armor: { B: '#9aa6b5', G: '#ffd84d' },
    robe: { B: '#4a3a8a', G: '#ffd84d' },
    cloak: { B: '#2a2a3a', G: '#b03a52' },
  };

  // 武器：畫在手的右邊（x+12）
  const WEAPONS = {
    term: { dx: 12, dy: 7, pal: { K: '#2a2a33', T: '#0d1f17', C: '#57e389' }, map: [
      'KKKKKKK',
      'KTTTTTK',
      'KTTTTTK',
      'KTCCTTK',
      'KTTTTTK',
      'KKKKKKK',
    ], blink: 'C' },
    wrench: { dx: 11, dy: 3, pal: { M: '#c9d3da', B: '#b5702e' }, map: [
      'M.M', 'MMM', '.M.', '.M.', '.M.', '.B.', '.B.', '.B.',
    ] },
    lolly: { dx: 11, dy: 2, pal: { P: '#ff7ab0', W: '#ffffff', B: '#f4f0e0' }, map: [
      '.PP.', 'PWPP', 'PPWP', '.PP.', '..B.', '..B.', '..B.', '..B.',
    ] },
    bread: { dx: 11, dy: 2, pal: { Y: '#e8b06a', O: '#b5702e' }, map: [
      '...YY', '..YOY', '..YYO', '.YOY.', 'YYO..', 'YY...',
    ] },
    shield: { dx: 11, dy: 6, pal: { K: '#3a5a8a', B: '#6fa8ff', W: '#d8e8ff' }, map: [
      'KKKKK', 'KBWBK', 'KBWBK', 'KBBBK', '.KBK.', '..K..',
    ] },
    staff: { dx: 11, dy: -1, pal: { Y: '#ffd84d', C: '#57e3d4', B: '#8a4b2a' }, map: [
      '.Y.', 'YCY', '.Y.', '.B.', '.B.', '.B.', '.B.', '.B.', '.B.', '.B.', '.B.', '.B.', '.B.',
    ], glow: 'C' },
    dagger: { dx: 11, dy: 6, pal: { L: '#ffffff', G: '#ffd84d', B: '#8a4b2a' }, map: [
      '..L', '.LL', '.L.', 'GGG', '.B.', '.B.',
    ] },
  };

  // 衣櫥商品（cls：職業裝，進化才拿得到，不能買）
  const ITEMS = {
    hat: [
      { id: 'none', name: '不戴' },
      { id: 'cap', name: '棒球帽', price: 60 },
      { id: 'beanie', name: '毛線帽', price: 80 },
      { id: 'flower', name: '花圈', price: 100 },
      { id: 'crown', name: '小皇冠', price: 300 },
      { id: 'helmet', name: '騎士頭盔', cls: 'knight' },
      { id: 'wizard', name: '法師帽', cls: 'mage' },
      { id: 'hood', name: '盜賊兜帽', cls: 'rogue' },
    ],
    cloth: [
      { id: 'blue', name: '修復師藍' },
      { id: 'red', name: '紅色外套', price: 80 },
      { id: 'green', name: '綠色工作服', price: 80 },
      { id: 'pink', name: '粉紅帽T', price: 80 },
      { id: 'yellow', name: '黃色雨衣', price: 80 },
      { id: 'white', name: '白色實驗袍', price: 120 },
      { id: 'armor', name: '騎士鎧甲', cls: 'knight' },
      { id: 'robe', name: '法師長袍', cls: 'mage' },
      { id: 'cloak', name: '盜賊斗篷', cls: 'rogue' },
    ],
    weapon: [
      { id: 'term', name: '終端機' },
      { id: 'lolly', name: '棒棒糖', price: 100 },
      { id: 'bread', name: '法國麵包', price: 120 },
      { id: 'wrench', name: '大扳手', price: 150 },
      { id: 'shield', name: '騎士盾', cls: 'knight' },
      { id: 'staff', name: '法杖', cls: 'mage' },
      { id: 'dagger', name: '匕首', cls: 'rogue' },
    ],
  };
  const SLOT_NAME = { hat: '帽子', cloth: '衣服', weapon: '武器' };
  const DEFAULT_LOOK = { hat: 'none', cloth: 'blue', weapon: 'term' };

  const find = (slot, id) => ITEMS[slot].find(x => x.id === id);
  const owns = (g, slot, id) => !find(slot, id).price && !find(slot, id).cls || (g.owned[slot] || []).includes(id);

  function buy(g, slot, id) {
    const it = find(slot, id);
    if (!it || it.cls) return { ok: false, reason: 'class' };
    if (owns(g, slot, id)) return { ok: false, reason: 'owned' };
    if (g.gold < it.price) return { ok: false, reason: 'gold', short: it.price - g.gold };
    g.gold -= it.price;
    g.owned[slot] = (g.owned[slot] || []).concat(id);
    g.look[slot] = id;
    return { ok: true };
  }

  function equip(g, slot, id) {
    if (!find(slot, id) || !owns(g, slot, id)) return { ok: false };
    g.look[slot] = id;
    return { ok: true };
  }

  // 把某個職業的三件裝送進衣櫥並穿上
  function giveClassSet(g, cls) {
    for (const slot of ['hat', 'cloth', 'weapon']) {
      const it = ITEMS[slot].find(x => x.cls === cls);
      if (!(g.owned[slot] || []).includes(it.id)) g.owned[slot] = (g.owned[slot] || []).concat(it.id);
      g.look[slot] = it.id;
    }
  }

  function put(ctx, map, pal, x, y, o) {
    const mix = root.PixelKit.mix;
    map.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || !pal[ch]) continue;
        if (o && o.skip === ch) continue;
        let col = pal[ch];
        if (o && o.tint) col = mix(col, o.tint, o.tintAmt == null ? 1 : o.tintAmt);
        ctx.fillStyle = col;
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    });
  }

  // 畫一個修復師。look = { gender, hat, cloth, weapon }；o = { t（動畫時間）, tint, tintAmt }
  function draw(ctx, look, x, y, o) {
    o = o || {};
    look = Object.assign({ gender: 'm' }, DEFAULT_LOOK, look);
    const g = look.gender === 'f' ? 'f' : 'm';
    const cl = CLOTHES[look.cloth] || CLOTHES.blue;
    const pal = {
      H: HAIR[g][0], h: HAIR[g][1], S: '#f2c9a0', E: '#222222', R: '#ff8fa8',
      B: cl.B, G: cl.G, D: root.PixelKit.mix(cl.B, '#000000', 0.25), P: '#2b2b3a', K: '#5a3a22',
    };
    const tint = o.tint ? { tint: o.tint, tintAmt: o.tintAmt } : null;
    put(ctx, BODY[g], pal, x, y, tint);
    const hat = HATS[look.hat];
    if (hat) put(ctx, hat.map, hat.pal, x, y + hat.dy, tint);
    const w = WEAPONS[look.weapon] || WEAPONS.term;
    const t = o.t || 0;
    const off = w.blink && Math.floor(t * 3) % 2 === 1 ? { skip: w.blink } : null;
    put(ctx, w.map, w.pal, x + w.dx, y + w.dy, Object.assign({}, tint, off));
    if (w.glow && Math.floor(t * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(87,227,212,0.5)';
      ctx.fillRect(x + w.dx - 1, y + w.dy, 1, 1); ctx.fillRect(x + w.dx + 3, y + w.dy + 2, 1, 1);
    }
  }

  // 小畫布預覽（衣櫥、取名畫面）
  function preview(canvas, look, t) {
    canvas.width = 22; canvas.height = 24;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 22, 24);
    draw(ctx, look, 3, 6, { t });
  }

  root.Avatar = { ITEMS, SLOT_NAME, DEFAULT_LOOK, CLOTHES, find, owns, buy, equip, giveClassSet, draw, preview };
})(typeof window !== 'undefined' ? window : globalThis);
