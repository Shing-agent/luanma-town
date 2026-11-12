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
    // 星空披風：深紫色，身上有黃點，肩後兩側露出披風邊
    starry: { B: '#3a2a6a', G: '#ffd84d', cape: '#241a4a', stars: [[3, 8], [8, 9], [5, 11], [7, 10], [2, 8]] },
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
    // 終端機鍵盤：藍灰色長方形，亮藍色按鍵
    keyboard: { dx: 11, dy: 9, pal: { K: '#5a6578', G: '#8a96a8', B: '#7fd4ff' }, map: [
      'KKKKKKK',
      'GBGBGBG',
      'GBBGBBG',
      'KKKKKKK',
    ] },
  };

  // 衣櫥商品（cls：職業裝，進化才拿得到，不能買）
  const ITEMS = {
    hat: [
      { id: 'none', name: '不戴', starter: true },
      { id: 'cap', name: '棒球帽', price: 60 },
      { id: 'beanie', name: '毛線帽', price: 80 },
      { id: 'flower', name: '花圈', price: 100 },
      { id: 'crown', name: '小皇冠', price: 300 },
      { id: 'helmet', name: '騎士頭盔', cls: 'knight' },
      { id: 'wizard', name: '法師帽', cls: 'mage' },
      { id: 'hood', name: '盜賊兜帽', cls: 'rogue' },
    ],
    cloth: [
      { id: 'blue', name: '修復師藍', starter: true },
      { id: 'red', name: '紅色外套', price: 80 },
      { id: 'green', name: '綠色工作服', price: 80 },
      { id: 'pink', name: '粉紅帽T', price: 80 },
      { id: 'yellow', name: '黃色雨衣', price: 80 },
      { id: 'white', name: '白色實驗袍', price: 120 },
      { id: 'starry', name: '星空披風' },
      { id: 'armor', name: '騎士鎧甲', cls: 'knight' },
      { id: 'robe', name: '法師長袍', cls: 'mage' },
      { id: 'cloak', name: '盜賊斗篷', cls: 'rogue' },
    ],
    weapon: [
      { id: 'term', name: '終端機', starter: true },
      { id: 'lolly', name: '棒棒糖', price: 100 },
      { id: 'bread', name: '法國麵包', price: 120 },
      { id: 'wrench', name: '大扳手', price: 150 },
      { id: 'keyboard', name: '終端機鍵盤' },
      { id: 'shield', name: '騎士盾', cls: 'knight' },
      { id: 'staff', name: '法杖', cls: 'mage' },
      { id: 'dagger', name: '匕首', cls: 'rogue' },
    ],
  };
  const SLOT_NAME = { hat: '帽子', cloth: '衣服', weapon: '武器' };
  const DEFAULT_LOOK = { hat: 'none', cloth: 'blue', weapon: 'term' };

  const find = (slot, id) => ITEMS[slot].find(x => x.id === id);
  // 起始裝備永遠擁有；其他要掉落／補給箱／進化拿到才算（g.owned 是真本）
  const owns = (g, slot, id) => { const it = find(slot, id); return !!it && (!!it.starter || (g.owned[slot] || []).includes(id)); };

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
    // 星空披風：先畫肩後兩側的披風邊，再畫身體，最後撒黃點
    if (cl.cape) { ctx.fillStyle = tint ? root.PixelKit.mix(cl.cape, o.tint, o.tintAmt == null ? 1 : o.tintAmt) : cl.cape; for (let r = 8; r <= 13; r++) { ctx.fillRect(x, y + r, 1, 1); ctx.fillRect(x + 11, y + r, 1, 1); } }
    put(ctx, BODY[g], pal, x, y, tint);
    if (cl.stars) { ctx.fillStyle = cl.G; for (const s of cl.stars) ctx.fillRect(x + s[0], y + s[1], 1, 1); }
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

  // ---------- 重畫版（2026-11-12 煦恩核准樣本）----------
  // 角色畫在 30×50 的格子上（比舊版細約 2.3 倍）：頭佔一半高的可愛比例、有眼睛高光／紅暈／小嘴的臉、
  // 每個零件自己的明暗和描邊。fineSprite 回傳 SW×SH（32×52）的畫布；腳底在第 FEET（48）列，身體中線在第 CX（16）欄。
  // 舊的 draw（12×16 小圖）只留給開場動畫用。
  const SW = 32, SH = 52, GW = 30, GH = 50, OY = 10, FEET = 48, CX = 16, HX = 15;
  const mixc = (a, b, t) => root.PixelKit.mix(a, b, t);
  const trio = (b, d, l) => [b, d || mixc(b, '#000000', 0.3), l || mixc(b, '#ffffff', 0.3)];
  const flat = c => [c, c, c];
  const PAL = {
    skin: trio('#f2c9a0', '#d9a67a', '#ffe3c4'),
    hairM: trio('#2f7a55', '#1f5a3d', '#5fb88a'), hairF: trio('#b8456e', '#8a2f52', '#e87aa2'),
    pants: trio('#2b2b3a', '#1c1c28', '#464660'), shoe: trio('#5a3a22', '#3e2614', '#80583a'),
    blue: trio('#3b5b8c', '#2a4268', '#6a93cf'), red: trio('#b03a52', '#7e2638', '#e0627c'), pink: trio('#e07ab0', '#b0558a', '#ffa6d2'),
    green: trio('#2e8b57', '#1f6640', '#57c188'), yellow: trio('#d9a52a', '#a87a14', '#ffd86a'), white: trio('#e8e8f0', '#b4b6c8', '#ffffff'),
    robe: trio('#4a3a8a', '#352a66', '#7358c8'), armor: trio('#9aa6b5', '#6f7a88', '#dce4ec'), cloak: trio('#2e2e40', '#1e1e2c', '#4e4e6a'), starry: trio('#3a2a6a', '#241a4a', '#6a54b0'),
    metal: trio('#9aa6b5', '#6f7a88', '#dce4ec'), hood: trio('#3a3a4a', '#26262f', '#5c5c74'), gold: trio('#ffd84d', '#c9a02a', '#fff1a0'),
    wiz: trio('#6b52b5', '#4a3a8a', '#9a80e8'), brown: trio('#8a4b2a', '#5e3018', '#b5703f'),
    cap: trio('#e0455f', '#a82f45', '#ff7d92'), beanie: trio('#ffd84d', '#c9a02a', '#fff1a0'),
    petalP: trio('#ff7ab0', '#d9528a', '#ffc2dc'), petalW: trio('#ffffff', '#d8d8e8', '#ffffff'), leaf: trio('#57a37a', '#3a7a58', '#8ad4a8'),
    eye: flat('#1d1d2b'), eyeW: flat('#ffffff'), blush: flat('#ff8fa8'), mouth: flat('#c2506a'),
    steel: trio('#c9d3da', '#8a96a0', '#ffffff'), cyan: trio('#57e3d4', '#2a8a82', '#c8fff9'),
    term: trio('#2a2a33', '#1a1a22', '#4a4a58'), screen: flat('#0d1f17'), glow: flat('#57e389'),
    keyb: trio('#5a6578', '#3e4756', '#8a96a8'), keyc: trio('#7fd4ff', '#7fd4ff', '#bfeaff'),
    shield: trio('#3a5a8a', '#26406a', '#6fa8ff'), cream: trio('#f4f0e0', '#c9c2a8', '#ffffff'),
    lolly: trio('#ff7ab0', '#d9528a', '#ffc2dc'), bread: trio('#e8b06a', '#b5702e', '#ffd9a0'), breadD: flat('#b5702e'),
  };
  const dk = k => { const n = k + '~'; if (!PAL[n]) PAL[n] = trio(PAL[k][1]); return n; }; // 同色再深一階

  // 組出角色的格子（每格 = {k: 顏色名, p: 零件編號}）。only：只畫某一格裝備（做圖示用）
  function mk(look, o) {
    o = o || {};
    const only = o.only || '';
    const g = Array.from({ length: GH }, () => Array(GW).fill(null));
    let part = 0;
    const put = (x, y, k, p) => { x = Math.round(x); y = Math.round(y) + OY; if (x < 0 || y < 0 || x >= GW || y >= GH) return; g[y][x] = { k, p }; };
    const set = (x, y, k) => put(x, y, k, 91); // 單點細節，不加明暗
    const clr = (x, y) => { y += OY; if (x >= 0 && y >= 0 && x < GW && y < GH) g[y][x] = null; };
    const rect = (x0, y0, x1, y1, k) => { part++; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, k, part); };
    const ell = (cx, cy, rx, ry, k, keep) => {
      part++;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0 && (!keep || keep(x, y))) put(x, y, k, part);
      }
    };
    const poly = (pts, k) => {
      part++;
      let a0 = 1e9, a1 = -1e9;
      for (const p of pts) { a0 = Math.min(a0, p[1]); a1 = Math.max(a1, p[1]); }
      for (let y = a0; y <= a1; y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort((u, v) => u - v);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) put(x, y, k, part);
      }
    };
    const f = look.gender === 'f', cx = HX, hair = f ? 'hairF' : 'hairM';
    const cloth = look.cloth, hat = look.hat, w = look.weapon;
    const isRobe = cloth === 'robe', isCloak = cloth === 'cloak', skirt = f && !isRobe && !isCloak;
    const body = !only, wantCloth = !only || only === 'cloth', wantHat = !only || only === 'hat', wantWeapon = !only || only === 'weapon';

    if (body && f && hat !== 'hood') poly([[7, 8], [23, 8], [25, 26], [22, 29], [8, 29], [5, 26]], hair); // 長髮在最後面
    if (wantCloth && (cloth === 'cloak' || cloth === 'starry')) poly([[8, 19], [22, 19], [25, 33], [5, 33]], cloth); // 披風在身體後面
    if (body) {
      if (!isRobe) { rect(11, 28, 13, 33, 'pants'); rect(17, 28, 19, 33, 'pants'); }
      rect(10, 34, 14, 36, 'shoe'); rect(16, 34, 20, 36, 'shoe');
    }
    if (wantCloth) {
      if (isRobe) poly([[10, 19], [20, 19], [23, 35], [7, 35]], cloth);
      else if (skirt) { rect(10, 19, 19, 26, cloth); poly([[9, 26], [21, 26], [23, 32], [7, 32]], cloth); }
      else rect(10, 19, 19, 28, cloth);
      rect(7, 20, 9, 25, cloth); rect(21, 20, 23, 25, cloth);
      if (body) { rect(7, 26, 9, 28, 'skin'); rect(21, 26, 23, 28, 'skin'); }
      // 各件衣服自己的細節
      if (cloth === 'starry') { for (const [x, y] of [[12, 21], [17, 23], [14, 26], [19, 27], [9, 23], [22, 24], [13, 31], [18, 32]]) set(x, y, 'gold'); }
      else if (cloth === 'cloak') { rect(14, 20, 16, 21, 'red'); }
      else if (cloth === 'armor') {
        rect(14, 21, 16, 24, 'gold'); rect(10, 27, 19, 28, 'brown'); set(14, 27, 'gold'); set(15, 27, 'gold');
        ell(8, 21, 3.2, 2.6, 'armor'); ell(22, 21, 3.2, 2.6, 'armor');
      }
      else if (cloth === 'robe') { rect(14, 19, 15, 34, 'gold'); rect(8, 33, 22, 34, 'gold'); for (let y = 22; y <= 32; y += 4) { set(13, y, 'gold'); set(16, y, 'gold'); } rect(7, 24, 9, 25, 'gold'); rect(21, 24, 23, 25, 'gold'); }
      else {
        rect(14, 22, 15, 23, cloth === 'blue' ? 'glow' : (cloth === 'yellow' ? 'red' : (cloth === 'white' ? 'blue' : 'gold')));
        if (cloth === 'red') { for (let y = 19; y <= 28; y++) set(13, y, dk('red')); } // 拉鍊
        if (cloth === 'pink') { rect(11, 19, 18, 20, dk('pink')); set(12, 21, 'white'); set(12, 22, 'white'); set(17, 21, 'white'); set(17, 22, 'white'); } // 帽T的帽子和繩子
        if (cloth === 'yellow') { rect(10, 19, 19, 20, dk('yellow')); for (const y of [24, 26]) { set(14, y, 'red'); set(15, y, 'red'); } } // 雨衣領子和釦子
        if (cloth === 'white') { rect(14, 19, 15, 28, dk('white')); rect(11, 25, 12, 27, dk('white')); set(10, 27, dk('white')); } // 實驗袍前襟和口袋
        if (cloth === 'green') { rect(11, 19, 12, 25, dk('green')); rect(17, 19, 18, 25, dk('green')); rect(12, 26, 17, 27, dk('green')); } // 工作服吊帶和口袋
      }
    }
    if (body) {
      ell(cx, 11, 8.5, 8.2, 'skin'); // 頭
      rect(6, 12, 6, 14, 'skin'); rect(24, 12, 24, 14, 'skin'); // 耳朵
      if (hat === 'hood') {
        ell(cx, 10, 10, 9.5, 'hood'); ell(cx, 13, 6.6, 6, 'skin'); rect(8, 19, 22, 21, 'hood');
      } else if (hat === 'helmet') {
        ell(cx, 9.2, 9.4, 8.4, 'metal', (x, y) => y <= 12); rect(7, 12, 23, 12, 'metal'); rect(14, 9, 16, 16, 'metal');
        rect(6, 12, 7, 17, 'metal'); rect(23, 12, 24, 17, 'metal'); // 護頰
      } else {
        ell(cx, 9.2, 9.2, 8.4, hair, (x, y) => y <= 9 || ((x <= 8 || x >= 22) && y <= 14) || (y <= 11 && ((x * 7) % 5 < 2)));
        for (const x of [10, 13, 17, 20]) { set(x, 10, hair); set(x, 11, hair); } // 瀏海分綹
        set(11, 10, hair); set(19, 10, hair);
      }
      // 臉：大眼睛＋白色高光、紅暈、小嘴
      for (const ex of [11, 18]) { rect(ex, 14, ex + 1, 16, 'eye'); put(ex, 14, 'eyeW', 99); } // 眼睛 2×3（11/12 煦恩嫌太可愛，縮小、拿掉紅暈）
      put(14, 17, 'mouth', 97); put(15, 17, 'mouth', 97);
    }
    if (wantHat) {
      if (hat === 'cap') {
        ell(cx, 8.4, 9.6, 7.4, 'cap', (x, y) => y <= 9); rect(6, 9, 24, 10, dk('cap')); ell(cx, 11.4, 8.8, 1.8, dk('cap'), (x, y) => y >= 11 && y <= 12);
        rect(14, 4, 16, 6, 'white');
      } else if (hat === 'beanie') {
        ell(cx, 8.4, 9.8, 7.6, 'beanie', (x, y) => y <= 10); rect(6, 9, 24, 11, dk('beanie'));
        for (let x = 8; x <= 22; x += 2) set(x, 10, 'beanie'); ell(cx, 0.6, 2.7, 2.7, 'white');
      } else if (hat === 'flower') {
        for (let k = 0; k <= 6; k++) {
          const x = 7 + k * 2.6, t = (x - cx) / 8.8, y = 11 - 8.4 * Math.sqrt(Math.max(0, 1 - t * t)) + 1.4;
          if (k % 2) { put(x - 1, y, 'leaf', 80 + k); put(x + 1, y + 1, 'leaf', 80 + k); }
          else { const pk = k % 4 === 0 ? 'petalP' : 'petalW'; rect(Math.round(x) - 1, Math.round(y) - 1, Math.round(x) + 1, Math.round(y) + 1, pk); set(x, y, 'gold'); }
        }
      } else if (hat === 'wizard') {
        ell(cx, 5, 11.5, 3, 'wiz'); poly([[9, 4], [21, 4], [19, -2], [17, -7], [14, -10]], 'wiz'); rect(10, 3, 20, 4, 'gold'); rect(14, 3, 15, 4, 'cream');
      } else if (hat === 'crown') {
        poly([[9, 4], [10, -1], [12, 2], [15, -2], [18, 2], [20, -1], [21, 4]], 'gold'); rect(9, 3, 21, 5, 'gold');
        set(15, 4, 'red'); set(11, 4, 'cyan'); set(19, 4, 'cyan');
      } else if (hat === 'helmet') {
        poly([[13, 1], [17, 1], [20, -4], [15, -2]], 'red');
      }
    }
    if (wantWeapon) {
      if (w === 'staff') {
        rect(25, 4, 26, 35, 'brown'); ell(25.5, 3, 3.2, 3.2, 'gold'); set(25, 3, 'cyan'); set(26, 3, 'cyan'); set(25, 4, 'cyan');
        if (o.glow) { for (const [x, y] of [[21, 2], [29, 4], [25, -2]]) set(x, y, 'cyan'); }
        if (body) rect(22, 25, 24, 28, 'skin');
      } else if (w === 'shield') {
        poly([[22, 22], [29, 22], [29, 30], [25.5, 35], [22, 30]], 'shield'); rect(25, 24, 26, 31, 'white');
      } else if (w === 'dagger') {
        poly([[24, 18], [26, 18], [26, 28], [24, 28]], 'steel'); rect(22, 28, 28, 29, 'gold'); rect(24, 30, 26, 33, 'brown');
      } else if (w === 'keyboard') {
        rect(21, 27, 29, 34, 'keyb'); for (let y = 28; y <= 33; y += 2) for (let x = 22; x <= 28; x += 2) set(x, y, 'keyc');
      } else if (w === 'lolly') {
        rect(25, 15, 26, 33, 'cream'); ell(25.5, 10.5, 3.8, 3.8, 'lolly');
        for (const [x, y] of [[25, 10], [26, 10], [27, 11], [26, 12], [24, 12], [23, 11], [24, 9], [26, 8]]) set(x, y, 'white');
        if (body) rect(22, 26, 25, 29, 'skin');
      } else if (w === 'bread') {
        poly([[26, 8], [29, 10], [28, 30], [24, 30], [23, 12]], 'bread');
        for (const y of [12, 17, 22, 27]) { set(25, y, 'breadD'); set(26, y, 'breadD'); set(27, y + 1, 'breadD'); }
        if (body) rect(22, 26, 25, 29, 'skin');
      } else if (w === 'wrench') {
        rect(25, 11, 27, 23, 'steel'); rect(25, 24, 27, 34, 'brown'); rect(23, 5, 29, 10, 'steel');
        for (let y = 5; y <= 7; y++) for (let x = 25; x <= 27; x++) clr(x, y);
        if (body) rect(22, 26, 25, 29, 'skin');
      } else if (w === 'term') {
        rect(21, 25, 29, 33, 'term'); rect(22, 26, 28, 31, 'screen'); rect(24, 28, 26, 29, o.blink ? 'screen' : 'glow');
      }
    }
    return g;
  }

  // 上色：每個零件右、下緣深一階，左、上緣亮一階；最外面再描一圈深色邊。tint 用在受傷閃紅／剪影。
  function shadeGrid(g, o) {
    o = o || {};
    const tintC = c => o.tint ? mixc(c, o.tint, o.tintAmt == null ? 1 : o.tintAmt) : c;
    const hexc = (r, gg, b) => '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
    const out = document.createElement('canvas'); out.width = SW; out.height = SH;
    const q = out.getContext('2d');
    const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? null : g[y][x];
    const tmp = document.createElement('canvas'); tmp.width = GW; tmp.height = GH;
    const t = tmp.getContext('2d');
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const c = at(x, y);
      if (!c) continue;
      const pal = PAL[c.k] || ['#f0f', '#f0f', '#f0f'];
      let col = pal[0];
      if (c.p < 90) {
        const diff = n => !n || n.p !== c.p;
        if (diff(at(x + 1, y)) || diff(at(x, y + 1)) || diff(at(x + 1, y + 1))) col = pal[1];
        else if (diff(at(x - 1, y)) || diff(at(x, y - 1)) || diff(at(x - 1, y - 1))) col = pal[2];
      }
      t.fillStyle = tintC(col); t.fillRect(x, y, 1, 1);
    }
    const d = t.getImageData(0, 0, GW, GH).data;
    const has = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && d[(y * GW + x) * 4 + 3] > 10;
    for (let y = -1; y <= GH; y++) for (let x = -1; x <= GW; x++) {
      if (has(x, y)) continue;
      let best = null;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { if (has(x + dx, y + dy)) { const i = ((y + dy) * GW + (x + dx)) * 4; best = [d[i], d[i + 1], d[i + 2]]; } }
      if (best) { q.fillStyle = mixc(hexc(best[0], best[1], best[2]), '#0e1020', 0.68); q.fillRect(x + 1, y + 1, 1, 1); }
    }
    q.drawImage(tmp, 1, 1);
    return out;
  }

  const fineCache = new Map();
  function fineSprite(look, o) {
    o = o || {};
    look = Object.assign({ gender: 'm' }, DEFAULT_LOOK, look);
    const w = WEAPONS[look.weapon] || WEAPONS.term, t = o.t || 0;
    const blink = w.blink && Math.floor(t * 3) % 2 === 1 ? 1 : 0, glow = w.glow && Math.floor(t * 4) % 2 === 0 ? 1 : 0;
    const key = JSON.stringify([look, blink, glow, o.tint || '', o.tintAmt || 0]);
    if (fineCache.has(key)) return fineCache.get(key);
    const c = shadeGrid(mk(look, { blink, glow }), o);
    if (fineCache.size > 120) fineCache.clear();
    fineCache.set(key, c);
    return c;
  }
  // 畫到邏輯座標：x、y 沿用舊版（12×16 身體的左上角），所以呼叫的地方不用改位置。
  // ctx 必須已放大 2 倍（一格 = 半個邏輯單位），這樣每個像素剛好對齊。
  function drawFine(ctx, look, x, y, o) {
    const s = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fineSprite(look, o), x - 2, y - 8, SW / 2, SH / 2);
    ctx.imageSmoothingEnabled = s;
  }

  // 小畫布預覽（裝備、取名、進化畫面）：32×52
  function preview(canvas, look, t) {
    canvas.width = SW; canvas.height = SH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SW, SH);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(7, FEET, 18, 1); ctx.fillRect(9, FEET + 1, 14, 1);
    ctx.drawImage(fineSprite(Object.assign({ gender: 'm' }, DEFAULT_LOOK, look), { t }), 0, 0);
  }

  // 裝備小圖示：只畫那一件裝備，裁掉空白，放進正方形畫布
  const iconCache = {};
  function iconUrl(slot, id) {
    const key = slot + ':' + id;
    if (iconCache[key]) return iconCache[key];
    let c;
    if (slot === 'hat' && id === 'none') {
      c = document.createElement('canvas'); c.width = c.height = 16;
      const x = c.getContext('2d'); x.fillStyle = '#7a8099';
      for (let i = 3; i <= 12; i++) { x.fillRect(i, i, 2, 1); x.fillRect(15 - i, i, 2, 1); }
    } else {
      const look = Object.assign({ gender: 'm' }, DEFAULT_LOOK); look[slot] = id;
      const spr = shadeGrid(mk(look, { only: slot }));
      const d = spr.getContext('2d').getImageData(0, 0, SW, SH).data;
      let x0 = SW, y0 = SH, x1 = -1, y1 = -1;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (d[(y * SW + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, n = Math.max(w, h) + 2;
      c = document.createElement('canvas'); c.width = c.height = n;
      c.getContext('2d').drawImage(spr, x0, y0, w, h, Math.floor((n - w) / 2), Math.floor((n - h) / 2), w, h);
    }
    return (iconCache[key] = c.toDataURL());
  }

  root.Avatar = { ITEMS, SLOT_NAME, DEFAULT_LOOK, CLOTHES, find, owns, equip, giveClassSet, draw, drawFine, fineSprite, preview, iconUrl, SW, SH, FEET, CX };
})(typeof window !== 'undefined' ? window : globalThis);
