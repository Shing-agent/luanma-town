// 迷宮神秘事件的配圖（程式畫的像素風，2026-11-13）。
// 每張圖 64×40 格，畫法和修復師重畫版一樣：每個零件右下緣深一階、左上緣亮一階，最外面描一圈深色邊。
// 用法：EventArt.url('merchant') → 圖片網址（data URL），放大顯示時記得 image-rendering: pixelated。
(function (root) {
  'use strict';

  const W = 64, H = 40;
  const mix = (a, b, t) => {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const trio = (b, d, l) => [b, d || mix(b, '#000000', 0.3), l || mix(b, '#ffffff', 0.3)];
  const flat = c => [c, c, c];
  const PAL = {
    night: flat('#1b1f3d'), night2: flat('#232850'), star: flat('#fff6c0'), stone: trio('#4a4f6e', '#353950', '#6a7090'), stoneF: flat('#2b2f48'),
    cloak: trio('#5a3f9a', '#3e2a70', '#8468c8'), shadow: flat('#120c22'), eyeG: flat('#7dffb0'),
    tail1: trio('#57e3d4', '#2a8a82', '#c8fff9'), tail2: trio('#ff4fd8', '#a82f8f', '#ffa8ee'),
    gold: trio('#ffd84d', '#c9a02a', '#fff1a0'), lamp: flat('#fff6c0'), brown: trio('#8a5a32', '#5e3a1c', '#b5804f'), bag: trio('#a8743f', '#7a5028', '#d4a06a'),
    cave: flat('#14303a'), cave2: flat('#1b3d48'), water: trio('#3fb8d9', '#2a86a8', '#9fe6ff'), glow: flat('#7dffb0'), glow2: flat('#c8fff9'),
    street: flat('#2a2440'), brick: flat('#352d50'), brickL: flat('#40375e'), road: flat('#1e1a2e'),
    box: trio('#c9965a', '#9a6c38', '#e8bf86'), tape: trio('#e8d9a8', '#c2b27e', '#fff6d8'), paper: trio('#f4f0e0', '#c9c2a8', '#ffffff'), ink: flat('#4a4a66'), pin: flat('#e0455f'),
    casino: flat('#1c1430'), curtain: trio('#8a2a46', '#5e1a2e', '#b5476a'), felt: trio('#2e8b57', '#1f6640', '#57c188'), wood: trio('#6a4226', '#4a2c16', '#8f5c36'),
    slime: trio('#8fd14f', '#5a9a2c', '#c4f08a'), shades: flat('#141420'), shine: flat('#ffffff'), mouth: flat('#1d2b14'), red: trio('#e0455f', '#a82f45', '#ff7d92'), white: trio('#ffffff', '#d8d8e8', '#ffffff'),
  };

  // 3×5 小字：泉水上漂的 0 和 1、紙條上的字
  const GLYPH = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'] };

  function builder() {
    const g = Array.from({ length: H }, () => Array(W).fill(null));
    let part = 0;
    const put = (x, y, k, p) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; g[y][x] = { k, p }; };
    const api = {
      g,
      bg: k => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, k, 95); },
      flatRect: (x0, y0, x1, y1, k) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, k, 95); },
      set: (x, y, k) => put(x, y, k, 91),
      rect: (x0, y0, x1, y1, k) => { part++; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, k, part); },
      ell: (cx, cy, rx, ry, k, keep) => {
        part++;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1 && (!keep || keep(x, y))) put(x, y, k, part);
        }
      },
      poly: (pts, k) => {
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
      },
      glyph: (ch, x, y, k) => GLYPH[ch].forEach((row, j) => [...row].forEach((c, i) => { if (c === '1') put(x + i, y + j, k, 91); })),
    };
    return api;
  }

  // 上色：零件邊緣明暗＋零件外描深色邊（背景 p=95 不描邊、不加明暗）
  function paint(g) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? null : g[j][i];
    const fg = n => n && n.p < 95;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const n = at(i, j); if (!n) continue;
      const pal = PAL[n.k] || ['#f0f', '#f0f', '#f0f'];
      let col = pal[0];
      if (n.p < 90) {
        const diff = m => !m || m.p !== n.p;
        if (diff(at(i + 1, j)) || diff(at(i, j + 1))) col = pal[1];
        else if (diff(at(i - 1, j)) || diff(at(i, j - 1))) col = pal[2];
      } else if (n.p === 95 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fg(at(i + dx, j + dy)))) {
        // 背景上緊貼著物件的那一格畫成描邊
        const m = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(i + dx, j + dy)).find(fg);
        col = mix((PAL[m.k] || pal)[1], '#0e1020', 0.6);
      }
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
    }
    return c;
  }

  const SCENES = {
    // 神秘商人：夜裡的石板路，披斗篷的商人，斗篷底下露出像素尾巴
    merchant(b) {
      b.bg('night');
      for (const [x, y] of [[6, 4], [15, 9], [48, 5], [57, 11], [40, 2], [10, 15], [53, 18]]) b.set(x, y, 'star');
      b.flatRect(0, 33, 63, 39, 'stoneF');
      for (let x = 0; x < 64; x += 8) { b.flatRect(x, 33, x, 39, 'stone'); b.flatRect(x + 4, 36, x + 4, 39, 'stone'); }
      b.flatRect(0, 36, 63, 36, 'stone');
      // 尾巴（先畫，壓在斗篷後面）：一格一格像素方塊，青粉交錯
      [[39, 31], [42, 29], [45, 27], [47, 24], [48, 21]].forEach(([x, y], i) => b.rect(x, y, x + 2, y + 2, i % 2 ? 'tail2' : 'tail1'));
      b.poly([[25, 13], [35, 13], [41, 34], [19, 34]], 'cloak');
      b.ell(30, 12, 6.5, 6.5, 'cloak');
      b.ell(30, 13.5, 4, 3.6, 'shadow');
      b.set(28, 13, 'eyeG'); b.set(32, 13, 'eyeG');
      b.rect(29, 20, 31, 33, 'shadow'); // 斗篷開口
      // 提燈
      b.rect(18, 17, 19, 22, 'brown'); b.rect(15, 22, 20, 28, 'gold'); b.rect(16, 23, 19, 27, 'lamp');
      // 背包
      b.ell(56, 32, 5, 3.5, 'bag'); b.rect(55, 28, 57, 29, 'brown');
    },
    // 亂碼泉水：洞穴裡的泉水，水面漂著 0 和 1
    spring(b) {
      b.bg('cave');
      for (let y = 4; y < 30; y += 7) for (let x = (y % 2) * 5; x < 64; x += 11) b.flatRect(x, y, x + 3, y, 'cave2');
      b.flatRect(0, 34, 63, 39, 'stoneF');
      b.ell(32, 32, 17, 5.5, 'stone');
      b.ell(32, 30.5, 13.5, 3.2, 'water');
      b.rect(30, 14, 34, 28, 'stone');
      b.ell(32, 13, 5, 2, 'stone');
      b.ell(32, 11.5, 3, 1.4, 'water');
      for (const [x, y] of [[27, 10], [37, 10], [25, 13], [39, 13], [24, 17], [40, 17]]) b.set(x, y, 'water'); // 噴出的水滴
      b.glyph('0', 22, 26, 'glow'); b.glyph('1', 39, 25, 'glow'); b.glyph('1', 31, 4, 'glow2'); b.glyph('0', 45, 18, 'glow2'); b.glyph('1', 15, 20, 'glow2');
    },
    // 失物招領：路邊的紙箱和貼在牆上的告示
    lost(b) {
      b.bg('street');
      for (let y = 0; y < 30; y += 4) for (let x = (y / 4 % 2) * 4; x < 64; x += 8) { b.flatRect(x, y, x + 6, y + 2, 'brick'); b.flatRect(x, y, x + 6, y, 'brickL'); }
      b.flatRect(0, 30, 63, 39, 'road');
      // 告示
      b.rect(38, 6, 52, 18, 'paper');
      for (const y of [9, 11, 13, 15]) b.flatRect(40, y, 40 + (y === 15 ? 6 : 10), y, 'ink');
      b.set(45, 7, 'pin');
      // 紙箱
      b.rect(14, 21, 34, 34, 'box');
      b.poly([[14, 21], [10, 17], [20, 17], [24, 21]], 'box');
      b.poly([[34, 21], [38, 16], [29, 16], [25, 21]], 'box');
      b.rect(23, 21, 25, 34, 'tape');
      // 箱子旁的金幣
      b.ell(41, 33, 2.2, 2.2, 'gold'); b.ell(46, 34, 2.2, 2.2, 'gold'); b.ell(43.5, 30.5, 2.2, 2.2, 'gold');
    },
    // 亂碼賭桌：戴墨鏡的史萊姆荷官
    gamble(b) {
      b.bg('casino');
      for (let x = 0; x < 64; x += 6) b.rect(x, 0, x + 4, 12, 'curtain');
      b.flatRect(0, 34, 63, 39, 'road');
      b.rect(12, 33, 14, 39, 'wood'); b.rect(49, 33, 51, 39, 'wood');
      b.rect(6, 28, 57, 33, 'felt');
      b.rect(6, 32, 57, 33, 'wood');
      b.ell(32, 22, 9, 7, 'slime', (x, y) => y <= 28);
      b.rect(25, 19, 30, 21, 'shades'); b.rect(34, 19, 39, 21, 'shades'); b.rect(30, 19, 34, 19, 'shades');
      b.set(26, 19, 'shine'); b.set(35, 19, 'shine');
      b.rect(30, 25, 34, 25, 'mouth'); b.set(29, 24, 'mouth'); b.set(35, 24, 'mouth');
      // 籌碼和撲克牌
      for (let k = 0; k < 3; k++) b.rect(11, 25 - k * 2, 16, 26 - k * 2, k % 2 ? 'red' : 'gold');
      for (let k = 0; k < 2; k++) b.rect(46, 25 - k * 2, 51, 26 - k * 2, 'gold');
      b.rect(19, 26, 22, 29, 'white'); b.set(20, 27, 'red'); b.rect(41, 26, 44, 29, 'white'); b.set(42, 27, 'shades');
    },
  };

  const cache = {};
  function url(id) {
    if (cache[id]) return cache[id];
    if (!SCENES[id] || typeof document === 'undefined') return '';
    const b = builder(); SCENES[id](b);
    return (cache[id] = paint(b.g).toDataURL());
  }

  root.EventArt = { url, ids: Object.keys(SCENES), W, H };
})(typeof window !== 'undefined' ? window : globalThis);
