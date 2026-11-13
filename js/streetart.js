// 小鎮街景精緻版（2026-11-12 美術升級第三步）：256×100 格（一格 = 半個邏輯單位），和修復師、怪物重畫版同一套做法。
// 店面用零件（牆、屋頂、門、窗）畫在畫板上、再加明暗與描邊；天空、地面、路燈光暈直接畫。
(function (root) {
  'use strict';
  const MA = root.MonsterArt;
  const mix = MA.mix, trio = MA.trio, flat = MA.flat, seeded = MA.seeded;
  const W = 256, H = 100, G = 84; // 寬、高、地面線

  // 每間店的樣子（x、w、h 是格數）
  const LOOKS = [
    { x: 6, w: 60, h: 44, roof: '#d9773f', wall: '#f2d6a2', door: '#8a4b2a', trim: '#a9683a', a1: '#e0455f', a2: '#fff3dc', hair: '#6b3a1e', shirt: '#e8a23d' },   // 麵包店
    { x: 74, w: 48, h: 60, roof: '#5a6fb5', wall: '#d8d2c4', door: '#4a3a5a', trim: '#6b5a7a', hair: '#2a2a3a', shirt: '#7a8fd5' },                                  // 鐘錶店
    { x: 130, w: 60, h: 48, roof: '#3f8f6a', wall: '#c9d6de', door: '#2f4a5a', trim: '#4a6a7a', hair: '#8a5a2a', shirt: '#4fa37a' },                                 // 工具店
  ];
  const PLAZA_X = 198;

  function shopPal(L, fixed, status) {
    const col = c => fixed ? c : mix(c, status === 'locked' ? '#3a3a46' : '#6e6e7a', status === 'locked' ? 0.8 : 0.7);
    const t = c => trio(col(c));
    return {
      wall: t(L.wall), roof: t(L.roof), door: t(L.door), trim: t(L.trim), brass: t('#e8c04a'), steel: t('#8a96a0'),
      a1: t(L.a1 || '#e0455f'), a2: t(L.a2 || '#fff3dc'), face: t('#f4f0e0'), ink: flat(col('#2a2a3a')),
      glass: flat(col('#3a4a5a')), glow: flat('#ffe08a'), pink: flat('#ff7ab0'), yel: flat('#ffd84d'), leaf: flat('#57a37a'),
      pot: t('#8a4b2a'), G: flat('#57e389'), P: flat('#ff3bd4'),
      hair: flat(L.hair), skin: flat('#f2c9a0'), shirt: flat(L.shirt), pants: flat('#3a3a4a'),
    };
  }

  function drawShop(b, L, i, st, lit, rnd) {
    const x = L.x, w = L.w, top = G - L.h, cx = x + Math.floor(w / 2);
    // 牆與屋頂
    b.rect(x, top, x + w - 1, G - 1, 'wall');
    b.rect(x, G - 3, x + w - 1, G - 1, 'trim');
    const peak = top - Math.round(w * 0.42);
    b.poly([[x - 3, top + 1], [cx, peak], [x + w + 2, top + 1]], 'roof');
    b.rect(x - 3, top, x + w + 2, top + 2, 'trim');
    for (let r = peak + 3; r < top; r += 3) for (let xx = x - 2; xx < x + w + 2; xx++) {
      if (b.has(xx, r) && ((xx + r * 2) % 6 === 0)) b.set(xx, r, 'trim');
    }
    // 門（拱形）
    const dx = cx - 6;
    b.rect(dx, G - 20, dx + 11, G - 4, 'door');
    b.ell(dx + 5.5, G - 20, 6, 4, 'door');
    b.rect(dx + 1, G - 17, dx + 4, G - 5, 'trim'); b.rect(dx + 7, G - 17, dx + 10, G - 5, 'trim');
    b.set(dx + 9, G - 10, 'brass');
    // 窗
    const wy = G - 30;
    const win = wx => {
      b.rect(wx - 1, wy - 1, wx + 10, wy + 10, 'trim');
      b.rect(wx, wy, wx + 9, wy + 9, lit ? 'glow' : 'glass');
      for (let k = 0; k < 10; k++) { b.set(wx + 4, wy + k, 'trim'); b.set(wx + 5, wy + k, 'trim'); }
      b.rect(wx, wy + 4, wx + 9, wy + 4, 'trim');
      b.rect(wx - 2, wy + 11, wx + 11, wy + 13, 'trim');
      if (lit) for (let k = 0; k < 5; k++) b.set(wx - 1 + k * 3, wy + 10, k % 2 ? 'pink' : 'yel');
    };
    const wl = x + 6, wr = x + w - 16;
    if (i === 1) { win(x + 5); win(x + w - 15); } else { win(wl); win(wr); }
    // 各店招牌
    if (i === 0) {
      // 條紋遮陽棚＋麵包招牌
      const ay = G - 29;
      for (let k = 0; k < 7; k++) b.rect(dx - 4 + k * 3, ay, dx - 2 + k * 3, ay + 4, k % 2 ? 'a2' : 'a1');
      for (let k = 0; k < 7; k++) b.rect(dx - 4 + k * 3, ay + 5, dx - 2 + k * 3, ay + 6, k % 2 ? 'a2' : 'a1');
      b.ell(cx, top + 12, 7, 4.5, 'pot'); b.ell(cx, top + 11, 5, 3, 'brass');
      b.rect(x + w - 14, peak + 10, x + w - 8, top - 1, 'trim'); // 煙囪
    }
    if (i === 1) {
      // 鐘面與尖頂
      b.rect(cx - 1, peak - 8, cx, peak, 'steel'); b.poly([[cx - 4, peak + 2], [cx + 3, peak + 2], [cx, peak - 9]], 'steel');
      const cy = top + 8;
      b.ell(cx - 0.5, cy, 9, 9, 'trim'); b.ell(cx - 0.5, cy, 7.4, 7.4, 'face');
      b.rect(cx - 1, cy - 6, cx - 1, cy, 'ink'); b.rect(cx - 1, cy, cx + 3, cy, 'ink');
      for (const [a, c] of [[0, -6.5], [6.5, 0], [0, 6.5], [-6.5, 0]]) b.set(cx - 1 + a, cy + c, 'ink');
    }
    if (i === 2) {
      // 齒輪招牌＋扳手
      const gx = cx, gy = top + 8;
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; b.ell(gx + Math.cos(ang) * 8, gy + Math.sin(ang) * 8, 2.2, 2.2, 'steel'); }
      b.ell(gx, gy, 7.5, 7.5, 'steel'); b.ell(gx, gy, 3.2, 3.2, 'ink');
      b.rect(dx - 8, G - 8, dx - 6, G - 2, 'steel'); b.ell(dx - 7, G - 9, 2.5, 2, 'steel'); // 門邊的扳手
    }
    // 任務完成：花箱＋門口居民
    if (lit) {
      b.rect(wl - 3, G - 12, wl + 8, G - 6, 'pot'); b.rect(wr - 1, G - 12, wr + 10, G - 6, 'pot');
      for (let k = 0; k < 4; k++) { b.set(wl - 1 + k * 3, G - 14, k % 2 ? 'pink' : 'yel'); b.set(wl - 1 + k * 3, G - 13, 'leaf'); b.set(wr + k * 3, G - 14, k % 2 ? 'yel' : 'pink'); b.set(wr + k * 3, G - 13, 'leaf'); }
      const rx = dx + 15, ry = G - 18;
      b.ell(rx, ry + 3, 3, 3.2, 'skin'); b.rect(rx - 3, ry, rx + 3, ry + 1, 'hair'); b.rect(rx - 4, ry + 6, rx + 4, ry + 13, 'shirt'); b.rect(rx - 3, ry + 14, rx - 1, ry + 17, 'pants'); b.rect(rx + 1, ry + 14, rx + 3, ry + 17, 'pants');
    }
    // 亂碼雜點
    if (!st.fixed) for (let k = 0; k < 14; k++) {
      const gx = x + Math.floor(rnd() * w), gy = top + Math.floor(rnd() * L.h);
      if (b.has(gx, gy)) { b.set(gx, gy, rnd() < 0.5 ? 'G' : 'P'); if (rnd() < 0.5) b.set(gx + 1, gy, 'G'); }
    }
  }

  function lamp(ctx, x, lit) {
    ctx.fillStyle = '#1c1c28'; ctx.fillRect(x, G - 30, 2, 30); ctx.fillRect(x - 3, G - 33, 8, 3); ctx.fillRect(x - 1, G - 2, 4, 2);
    ctx.fillStyle = lit ? '#ffe9a8' : '#8c8c9c'; ctx.fillRect(x - 2, G - 31, 6, 5); ctx.fillStyle = '#1c1c28'; ctx.fillRect(x - 2, G - 33, 6, 1);
    if (lit) {
      const gr = ctx.createRadialGradient(x + 1, G - 28, 1, x + 1, G - 28, 26);
      gr.addColorStop(0, 'rgba(255,224,138,0.42)'); gr.addColorStop(1, 'rgba(255,224,138,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 26, G - 54, 54, 54);
    }
  }

  // st = { ended, allRepaired, shops:[{status:'locked|occupied|repairable|done', fixed, lit}], monsterDefs:[def,…], bossDef }
  function draw(canvas, st, opts) {
    opts = opts || {};
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const rnd = seeded(11);
    const ended = !!st.ended;

    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, G);
    if (ended) { sky.addColorStop(0, '#7fbfe8'); sky.addColorStop(0.6, '#b9dcf0'); sky.addColorStop(1, '#f6e6c8'); }
    else { sky.addColorStop(0, '#1d1f3a'); sky.addColorStop(0.55, '#33345a'); sky.addColorStop(1, '#6a5478'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (!ended) {
      for (let i = 0; i < 40; i++) { const sx = Math.floor(rnd() * W), sy = Math.floor(rnd() * 36); ctx.fillStyle = rnd() < 0.25 ? '#ffffff' : '#9a9cc8'; ctx.fillRect(sx, sy, 1, 1); if (rnd() < 0.15) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); } }
      ctx.fillStyle = '#f2eed0'; ctx.beginPath(); ctx.arc(228, 17, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#d6d2b0'; ctx.fillRect(225, 14, 3, 3); ctx.fillRect(230, 19, 3, 2);
      ctx.fillStyle = 'rgba(255,255,220,0.10)'; ctx.beginPath(); ctx.arc(228, 17, 15, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(228, 17, 9, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,243,196,0.3)'; ctx.beginPath(); ctx.arc(228, 17, 16, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (const [cx2, cy2] of [[30, 12], [120, 8], [180, 20]]) { ctx.fillRect(cx2, cy2, 14, 3); ctx.fillRect(cx2 + 3, cy2 - 2, 8, 3); }
    }
    // 遠方城市剪影
    const sil = ended ? '#9db8cc' : '#262848', rs = seeded(41);
    ctx.fillStyle = sil;
    for (let xx = -4; xx < W; xx += 10 + Math.floor(rs() * 9)) { const bw = 12 + Math.floor(rs() * 12), bh = 16 + Math.floor(rs() * 26); ctx.fillRect(xx, G - bh - 6, bw, bh + 6); xx += 0; }
    ctx.fillStyle = ended ? '#fff3c4' : '#c9b46a';
    for (let k = 0; k < 26; k++) { const wx = Math.floor(rs() * W), wy = G - 10 - Math.floor(rs() * 36); if (!ended && rs() < 0.5) ctx.fillRect(wx, wy, 2, 2); }

    // 地面
    ctx.fillStyle = ended ? '#a39887' : '#3d3d49'; ctx.fillRect(0, G, W, H - G);
    ctx.fillStyle = ended ? '#bdb2a1' : '#555563'; ctx.fillRect(0, G, W, 3);
    ctx.fillStyle = ended ? '#8f8474' : '#2f2f3a'; ctx.fillRect(0, G + 3, W, 1);
    const rc = seeded(5);
    for (let y = G + 5; y < H; y += 5) for (let xx = ((y / 5) % 2) * 6 - 3; xx < W; xx += 12) {
      ctx.fillStyle = ended ? (rc() < 0.5 ? '#b5aa98' : '#a89d8b') : (rc() < 0.5 ? '#4a4a58' : '#434350'); ctx.fillRect(xx, y, 10, 3);
      ctx.fillStyle = ended ? '#8f8474' : '#2f2f3a'; ctx.fillRect(xx, y + 3, 10, 1);
    }
    // 路燈（店與店之間、廣場前）
    const lampOn = !ended;
    [70, 126, 194].forEach(lx => lamp(ctx, lx, lampOn));

    // 店面
    const b = MA.builder(W, H);
    const pals = {};
    st.shops.forEach((s, i) => {
      const L = LOOKS[i];
      const p = shopPal(L, s.fixed, s.status);
      // 每間店用自己的色盤，所以分開畫分開上色
      const bb = MA.builder(W, H);
      drawShop(bb, L, i, s, s.lit, rnd);
      const cv = MA.shade(bb, p);
      ctx.drawImage(cv, -1, -1);
      // 被佔據：怪物站在門口
      if (s.status === 'occupied' && st.monsterDefs && st.monsterDefs[i]) {
        const def = st.monsterDefs[i];
        const sp = MA.sprite(def.map, def.pal, Math.floor((opts.t || 0) * 6), null);
        const mx = L.x + Math.floor(L.w / 2) - Math.floor(sp.w / 2), my = G - sp.h + (sp.feet || 0) - (def.fly ? 8 : 0);
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(mx + 4, G - 1, sp.w - 8, 2);
        ctx.drawImage(sp.cv, mx, my);
      }
    });

    // 廣場
    const px = PLAZA_X;
    if (ended) {
      ctx.fillStyle = '#8a96a0'; ctx.fillRect(px + 8, G - 8, 40, 8); ctx.fillStyle = '#c9d3da'; ctx.fillRect(px + 8, G - 8, 40, 2);
      ctx.fillStyle = '#5fb5e8'; ctx.fillRect(px + 12, G - 6, 32, 4);
      ctx.fillStyle = '#8a96a0'; ctx.fillRect(px + 26, G - 24, 4, 16); ctx.fillStyle = '#a9dcf5'; ctx.fillRect(px + 22, G - 28, 12, 4);
      ctx.fillRect(px + 20, G - 24, 2, 6); ctx.fillRect(px + 34, G - 24, 2, 6);
      const flags = ['#e0455f', '#ffd84d', '#57e389', '#5f8fe8'];
      for (let k = 0; k < 40; k++) { ctx.fillStyle = flags[k % 4]; ctx.fillRect(4 + k * 6, 14 + Math.round(Math.sin(k * 0.5) * 3), 3, 4); }
    } else if (st.allRepaired) {
      const rr = seeded(77);
      for (let k = 0; k < 60; k++) { ctx.fillStyle = rr() < 0.5 ? 'rgba(217,79,106,0.7)' : 'rgba(87,227,137,0.7)'; ctx.fillRect(px + 2 + Math.floor(rr() * 50), G - 8 - Math.floor(rr() * 56), 1, 3); }
      const def = st.bossDef; const sp = MA.sprite('boss', def.pal, 0, null);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 8, G - 1, sp.w - 10, 3);
      ctx.drawImage(sp.cv, px - 2, G - sp.h + 2);
    } else {
      const rr = seeded(33);
      for (let k = 0; k < 90; k++) { ctx.fillStyle = `rgba(${rr() < 0.5 ? '87,227,137' : '120,120,140'},${0.25 + rr() * 0.4})`; ctx.fillRect(px + Math.floor(rr() * 56), G - Math.floor(rr() * 58), 1 + Math.floor(rr() * 2), 1 + Math.floor(rr() * 5)); }
    }
  }

  root.StreetArt = { draw, LOOKS, PLAZA_X, W, H, G };
})(typeof window !== 'undefined' ? window : globalThis);
