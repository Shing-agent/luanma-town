// 怪物精緻版（2026-11-12 美術升級第三步）：和修復師重畫版同一套做法。
// 用長方形、橢圓、多邊形把怪物畫在「半格」上（一格 = 0.5 個邏輯單位），每個零件右下加深、左上提亮並描邊。
// 舊的 ASCII 像素圖（sprites.js 的 MAPS）保留給跟班、圖鑑小圖、開場故事。
(function (root) {
  'use strict';

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }
  function seeded(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  const trio = (b, d, l) => [b, d || mix(b, '#000000', 0.3), l || mix(b, '#ffffff', 0.3)];
  const flat = c => [c, c, c];

  // 從怪物的 pal（M 主色、D 深色…）組出每個顏色代號的三階色
  function palFor(p) {
    const o = {
      M: trio(p.M, p.D), D: trio(p.D), Ml: flat(mix(p.M, '#ffffff', 0.45)),
      W: trio('#ffffff', '#c8ccd8', '#ffffff'), K: flat(p.K), T: trio(p.T, mix(p.T, '#000000', 0.2)),
      G: flat('#57e389'), P: flat('#ff3bd4'),
    };
    ['R', 'B', 'C', 'Y'].forEach(k => { if (p[k]) o[k] = trio(p[k]); });
    return o;
  }

  // 零件畫板：每格 {k: 顏色代號, p: 零件編號}；p=91 是單點細節，不加明暗
  function builder(W, H) {
    const g = Array.from({ length: H }, () => Array(W).fill(null));
    let part = 0, grp = false;
    const np = () => { if (!grp) part++; };
    const put = (x, y, k, p) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; g[y][x] = { k, p }; };
    const b = {
      W, H, g,
      group(fn) { part++; grp = true; fn(); grp = false; },
      set(x, y, k) { put(x, y, k, 91); },
      clr(x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = null; },
      rect(x0, y0, x1, y1, k) { np(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, k, part); },
      ell(cx, cy, rx, ry, k, keep) {
        np();
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.0 && (!keep || keep(x, y))) put(x, y, k, part);
        }
      },
      poly(pts, k) {
        np();
        let a0 = 1e9, a1 = -1e9;
        for (const p of pts) { a0 = Math.min(a0, p[1]); a1 = Math.max(a1, p[1]); }
        for (let y = Math.round(a0); y <= Math.round(a1); y++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], c = pts[(i + 1) % pts.length];
            if ((a[1] <= y && c[1] > y) || (c[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (c[0] - a[0]) / (c[1] - a[1]));
          }
          xs.sort((u, v) => u - v);
          for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) put(x, y, k, part);
        }
      },
      has(x, y) { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < W && y < H && !!g[y][x]; },
    };
    return b;
  }

  // 上色：右、下緣深一階，左、上緣亮一階；最外面描一圈深色邊。輸出比畫板大 1 格的邊。
  function shade(b, pal, o) {
    o = o || {};
    const W = b.W, H = b.H, g = b.g;
    const tintC = c => o.tint ? mix(c, o.tint, o.tintAmt == null ? 1 : o.tintAmt) : c;
    const hexc = (r, gg, bb) => '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
    const out = document.createElement('canvas'); out.width = W + 2; out.height = H + 2;
    const q = out.getContext('2d');
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : g[y][x];
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const t = tmp.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (!c) continue;
      const tr = pal[c.k] || ['#f0f', '#f0f', '#f0f'];
      let col = tr[0];
      if (c.p < 90) {
        const diff = n => !n || n.p !== c.p;
        if (diff(at(x + 1, y)) || diff(at(x, y + 1)) || diff(at(x + 1, y + 1))) col = tr[1];
        else if (diff(at(x - 1, y)) || diff(at(x, y - 1)) || diff(at(x - 1, y - 1))) col = tr[2];
      }
      t.fillStyle = tintC(col); t.fillRect(x, y, 1, 1);
    }
    const d = t.getImageData(0, 0, W, H).data;
    const has = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 10;
    for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
      if (has(x, y)) continue;
      let best = null;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { if (has(x + dx, y + dy)) { const i = ((y + dy) * W + (x + dx)) * 4; best = [d[i], d[i + 1], d[i + 2]]; } }
      if (best) { q.fillStyle = mix(hexc(best[0], best[1], best[2]), '#0e1020', 0.68); q.fillRect(x + 1, y + 1, 1, 1); }
    }
    q.drawImage(tmp, 1, 1);
    return out;
  }

  // 眼睛：白底＋瞳孔（朝左看修復師）＋高光。blink 時畫成一條線。
  function eye(b, x, y, rx, ry, o) {
    o = o || {};
    if (o.blink) { b.rect(Math.round(x - rx), Math.round(y), Math.round(x + rx), Math.round(y) + 1, 'K'); return; }
    b.ell(x, y, rx, ry, 'W');
    const px = Math.round(x - rx * 0.5), py = Math.round(y + ry * 0.15);
    b.rect(px, py, px + 1, py + Math.max(1, Math.round(ry)), 'K');
    b.set(px, py, 'W');
  }
  // 撒幾點亂碼：只落在已經畫好的身體上
  function glitchDots(b, n, seed) {
    const r = seeded(seed);
    for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
      const x = Math.floor(r() * b.W), y = Math.floor(r() * b.H);
      if (b.has(x, y) && b.g[y][x].p < 90 && b.g[y][x].k === 'M') { b.set(x, y, r() < 0.55 ? 'G' : 'P'); if (r() < 0.5) b.set(x + 1, y, 'G'); i++; }
    }
  }

  // ───────── 各種怪物 ─────────
  // 史萊姆（也給魔王用）：boss=true 時有皇冠、生氣眉毛、鋸齒牙
  function slime(b, o) {
    o = o || {};
    const W = b.W, H = b.H, top = o.top || 0, hb = H - top, cx = W / 2 - 0.5;
    const bottom = H - 2;
    b.group(() => {
      b.ell(cx, top + hb * 0.62, W * 0.47, hb * 0.36, 'M', (x, y) => y <= bottom);
      b.ell(cx, top + hb * 0.4, W * 0.3, hb * 0.32, 'M');
      b.ell(W * 0.17, bottom - 1, W * 0.07, 2.2, 'M');
      b.ell(W * 0.83, bottom - 1, W * 0.07, 2.2, 'M');
      b.ell(W * 0.36, bottom, W * 0.05, 1.5, 'M');
    });
    const ex = W * 0.215, ey = top + hb * 0.55, er = o.boss ? W * 0.065 : W * 0.075;
    if (o.boss) {
      // 生氣眉毛
      b.poly([[cx - ex - er * 1.8, ey - er * 3.3], [cx - ex + er * 1.8, ey - er * 1.7], [cx - ex + er * 1.8, ey - er * 0.7], [cx - ex - er * 1.8, ey - er * 2.3]], 'D');
      b.poly([[cx + ex + er * 1.8, ey - er * 3.3], [cx + ex - er * 1.8, ey - er * 1.7], [cx + ex - er * 1.8, ey - er * 0.7], [cx + ex + er * 1.8, ey - er * 2.3]], 'D');
    }
    eye(b, cx - ex, ey, er, er * 1.3, o);
    eye(b, cx + ex, ey, er, er * 1.3, o);
    const my = top + hb * 0.78, mw = W * (o.boss ? 0.24 : 0.17);
    b.rect(Math.round(cx - mw), Math.round(my), Math.round(cx + mw), Math.round(my + (o.boss ? hb * 0.14 : hb * 0.11)), 'K');
    const step = o.boss ? 5 : 3;
    for (let x = Math.round(cx - mw) + 1; x < cx + mw - 1; x += step) {
      b.set(x, my, 'T'); if (o.boss) { b.set(x, my + 1, 'T'); b.set(x + 1, my, 'T'); }
    }
    // 身體上的高光
    for (let i = 0; i < 3; i++) b.set(W * 0.22 + i, top + hb * 0.3 - i * 0.8 + 1, 'Ml');
    b.set(W * 0.22 + 3, top + hb * 0.3 - 2, 'Ml');
    glitchDots(b, o.boss ? 7 : 3, o.boss ? 5 : 3);
    if (o.boss) {
      // 皇冠
      const cw = W * 0.4, x0 = cx - cw / 2, y1 = top + 4, y0 = Math.max(0, top - 6);
      b.rect(Math.round(x0), y1 - 3, Math.round(x0 + cw), y1, 'C');
      b.poly([[x0, y1 - 3], [x0, y0 + 1], [x0 + cw * 0.25, y1 - 6], [cx, y0 - 0.5], [x0 + cw * 0.75, y1 - 6], [x0 + cw, y0 + 1], [x0 + cw, y1 - 3]], 'C');
      b.set(x0 + 2, y1 - 1.5, 'Y'); b.set(cx, y1 - 1.5, 'Y'); b.set(x0 + cw - 2, y1 - 1.5, 'Y');
      b.set(cx, y0 + 1, 'Y');
    }
  }

  function bat(b, o) {
    o = o || {};
    const cx = 21.5, up = (o.frame || 0) === 0;
    const mir = pts => pts.map(p => [2 * cx - p[0], p[1]]);
    const wing = up
      ? [[16, 14], [11, 6], [4, 2], [2, 3], [4, 9], [1, 15], [6, 14], [8, 19], [12, 16], [15, 20]]
      : [[16, 14], [10, 18], [4, 25], [2, 26], [7, 25], [6, 29], [11, 25], [12, 30], [15, 23]];
    b.poly(wing, 'D'); b.poly(mir(wing), 'D');
    // 翼骨
    const bone = up ? [[15, 14, 5, 4], [14, 15, 3, 14], [14, 16, 8, 19]] : [[15, 15, 4, 24], [14, 16, 9, 24], [14, 17, 12, 28]];
    bone.forEach(([x0, y0, x1, y1]) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; b.set(x, y, 'M'); b.set(2 * cx - x, y, 'M'); } });
    b.group(() => {
      b.ell(cx, 16, 6.8, 7.5, 'M');
      b.poly([[16, 11], [16.5, 3], [20.5, 9]], 'M');
      b.poly([[27, 11], [26.5, 3], [22.5, 9]], 'M');
    });
    b.poly([[17.5, 7], [17.5, 5], [19, 8]], 'T'); b.poly([[25.5, 7], [25.5, 5], [24, 8]], 'T');
    eye(b, 18.5, 15, 2.1, 2.6, o); eye(b, 24.5, 15, 2.1, 2.6, o);
    b.rect(19, 20, 24, 20, 'K');
    b.rect(19, 21, 20, 23, 'T'); b.rect(23, 21, 24, 23, 'T');
    b.set(21, 21, 'T'); b.set(22, 21, 'T');
    // 肚子的淡色
    b.ell(cx, 22, 3.2, 2, 'T');
    glitchDots(b, 2, 9);
  }

  function cube(b, o) {
    o = o || {};
    b.rect(3, 8, 23, 27, 'M');
    b.poly([[3, 8], [8, 3], [28, 3], [23, 8]], 'Ml');
    b.poly([[23, 8], [28, 3], [28, 22], [23, 27]], 'D');
    // 錯位的方塊角
    b.rect(20, 11, 27, 16, 'Ml');
    b.rect(2, 22, 6, 26, 'D');
    eye(b, 9, 15, 2.2, 2.8, o); eye(b, 17, 15, 2.2, 2.8, o);
    b.rect(8, 21, 18, 24, 'K');
    for (let x = 9; x <= 17; x += 2) b.set(x, 21, 'T');
    for (let x = 10; x <= 16; x += 2) b.set(x, 24, 'T');
    b.rect(6, 28, 10, 29, 'D'); b.rect(16, 28, 20, 29, 'D');
    // 拼不上的縫
    for (let x = 4; x <= 22; x += 3) b.set(x, 18, 'D');
    glitchDots(b, 3, 13);
  }

  function can(b, o) {
    o = o || {};
    // 飛出來的垃圾信
    b.rect(8, 2, 21, 10, 'W');
    b.poly([[8, 2], [14.5, 8], [21, 2]], 'W');
    b.ell(14.5, 8, 1.7, 1.7, 'R');
    b.group(() => { b.rect(5, 13, 24, 28, 'M'); b.ell(14.5, 28, 10, 2.6, 'M'); });
    b.ell(14.5, 12.5, 10, 2.8, 'D');
    b.ell(14.5, 12.5, 8, 1.8, 'Ml');
    eye(b, 10.5, 21, 1.9, 2.4, o); eye(b, 18.5, 21, 1.9, 2.4, o);
    b.rect(11, 25, 18, 25, 'K'); b.set(10, 24, 'K'); b.set(19, 24, 'K');
    b.rect(8, 30, 12, 31, 'D'); b.rect(17, 30, 21, 31, 'D');
    glitchDots(b, 2, 17);
  }

  function popup(b, o) {
    o = o || {};
    b.group(() => { b.rect(2, 3, 29, 26, 'D'); });
    b.rect(3, 4, 28, 8, 'T');
    b.set(5, 6, 'W'); b.set(7, 6, 'W'); b.set(9, 6, 'W');
    b.rect(24, 5, 27, 7, 'R');
    b.set(25, 5, 'W'); b.set(26, 6, 'W'); b.set(25, 7, 'W'); b.set(26, 5, 'W'); b.set(25, 6, 'W'); b.set(26, 7, 'W');
    b.rect(3, 9, 28, 25, 'M');
    eye(b, 11, 15, 2.2, 2.8, o); eye(b, 21, 15, 2.2, 2.8, o);
    b.rect(12, 20, 20, 22, 'K');
    for (let x = 13; x <= 19; x += 2) b.set(x, 20, 'W');
    b.rect(8, 27, 12, 29, 'D'); b.rect(20, 27, 24, 29, 'D');
    // 滑鼠游標
    b.poly([[24, 18], [24, 26], [26, 24], [28, 28], [29.5, 27], [27.5, 23], [30, 22.5]], 'W');
    glitchDots(b, 2, 21);
  }

  function bear(b, o) {
    o = o || {};
    b.ell(7, 8, 3.8, 3.8, 'M'); b.ell(25, 8, 3.8, 3.8, 'M');
    b.ell(7, 8, 1.8, 1.8, 'T'); b.ell(25, 8, 1.8, 1.8, 'T');
    b.group(() => { b.ell(15.5, 17, 13.5, 11, 'M'); });
    // 頭上的電池，電量只剩一格
    b.rect(10, 1, 21, 6, 'B'); b.rect(22, 2, 23, 5, 'B');
    b.rect(11, 2, 13, 5, 'R'); b.rect(14, 2, 20, 5, 'D');
    b.ell(15.5, 21, 5.5, 4, 'T');
    b.rect(14, 19, 17, 20, 'K');
    // 睡眼
    eye(b, 9.5, 15, 2.3, 2.6, o); eye(b, 21.5, 15, 2.3, 2.6, o);
    b.rect(7, 13, 12, 14, 'M'); b.rect(19, 13, 24, 14, 'M');
    b.rect(7, 14, 12, 14, 'D'); b.rect(19, 14, 24, 14, 'D');
    b.rect(14, 23, 17, 23, 'K');
    b.rect(7, 27, 12, 29, 'D'); b.rect(19, 27, 24, 29, 'D');
    glitchDots(b, 2, 25);
  }

  // 每種造型的畫板大小、影格數、腳底到畫板底部的格數
  const KINDS = {
    blob: { w: 30, h: 26, frames: 1, draw: b => slime(b), feet: 1 },
    bat: { w: 44, h: 32, frames: 2, draw: (b, o) => bat(b, o), feet: 4 },
    cube: { w: 30, h: 30, frames: 1, draw: cube, feet: 1 },
    can: { w: 30, h: 32, frames: 1, draw: can, feet: 0 },
    popup: { w: 32, h: 30, frames: 1, draw: popup, feet: 1 },
    bear: { w: 32, h: 30, frames: 1, draw: bear, feet: 1 },
    boss: { w: 64, h: 66, frames: 1, draw: (b, o) => slime(b, Object.assign({ boss: true, top: 12 }, o)), feet: 1 },
  };

  const cache = new Map();
  // 回傳 { cv, w, h }：cv 比畫板多 1 格描邊；w、h 是 cv 的格數（除以 2 = 邏輯單位）
  function sprite(map, pal, frame, o) {
    o = o || {};
    const K = KINDS[map] || KINDS.blob;
    const fr = K.frames > 1 ? (frame || 0) % K.frames : 0;
    const blink = o.blink ? 1 : 0;
    const key = [map, pal.M, pal.K, fr, blink, o.tint || '', o.tintAmt || 0].join('|');
    if (cache.has(key)) return cache.get(key);
    const b = builder(K.w, K.h);
    K.draw(b, { frame: fr, blink });
    const cv = shade(b, palFor(pal), o);
    const res = { cv, w: K.w + 2, h: K.h + 2, feet: K.feet };
    if (cache.size > 200) cache.clear();
    cache.set(key, res);
    return res;
  }
  function frames(map) { return (KINDS[map] || KINDS.blob).frames; }
  // 圖鑑／預覽：把精緻版畫進一個小畫布，打過的有顏色，沒打過的是剪影
  function drawPreview(canvas, map, pal, unlocked, size) {
    const s = sprite(map, pal, 0, unlocked ? null : { tint: '#11131c', tintAmt: 1 });
    const n = size || 40;
    canvas.width = n; canvas.height = n;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, n, n);
    ctx.imageSmoothingEnabled = false;
    const k = Math.min((n - 2) / s.w, (n - 2) / s.h);
    const w = Math.round(s.w * k), h = Math.round(s.h * k);
    ctx.drawImage(s.cv, Math.round((n - w) / 2), Math.round((n - h) / 2), w, h);
  }

  root.MonsterArt = { sprite, frames, palFor, builder, shade, mix, seeded, trio, flat, drawPreview, KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
