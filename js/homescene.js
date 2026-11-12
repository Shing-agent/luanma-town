// 主畫面「角色舞台」的夜晚小鎮背景（程式畫的像素風）。只畫背景；修復師由 main.js 另外用 Avatar.draw 放大畫在中間。
// 修好的店＝彩色、亮燈；沒修的＝灰色；整條街修好＝清晨。
(function (root) {
  'use strict';

  // 三間店的顏色（和 street.js 的 LOOKS 一致），w／h 是相對舞台寬度的比例
  const SHOPS = [
    { roof: '#d9773f', wall: '#f2d6a2', door: '#8a4b2a', cx: 0.17, w: 0.25, h: 0.20 },
    { roof: '#5a6fb5', wall: '#d8d2c4', door: '#4a3a5a', cx: 0.50, w: 0.20, h: 0.27 },
    { roof: '#3f8f6a', wall: '#c9d6de', door: '#2f4a5a', cx: 0.83, w: 0.25, h: 0.22 },
  ];

  // 畫一個 lw × lh（邏輯像素）的背景。t＝秒，讓星星閃爍
  function draw(ctx, lw, lh, g, t) {
    const mix = root.PixelKit.mix;
    const ended = !!g.ended;
    const horizon = Math.floor(lh * 0.60);
    const sky = ended ? ['#7fbfe6', '#9ccbea', '#b8d9ee', '#d9e4ea', '#f2e2c4'] : ['#181a32', '#22243e', '#2e2f55', '#3d3a64', '#5a4a70'];
    const bh = Math.ceil(horizon / sky.length);
    sky.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, lw, bh + 1); });

    // 星星（固定位置，輪流閃爍）／清晨的太陽
    const rnd = root.PixelKit.seeded(7);
    if (!ended) {
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(rnd() * lw), y = Math.floor(rnd() * horizon * 0.8), ph = rnd() * 6;
        ctx.fillStyle = Math.floor(t * 1.5 + ph) % 4 === 0 ? '#7a7ca8' : '#e4e4fa';
        ctx.fillRect(x, y, 1, 1);
        if (i % 7 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
    }
    // 月亮（缺一角）或太陽
    const mx = Math.floor(lw * 0.80), my = Math.floor(horizon * 0.2), r = 5;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (!ended && (dx + 2) * (dx + 2) + (dy - 1) * (dy - 1) < 22) continue;
      ctx.fillStyle = ended ? '#fff3c4' : '#f4efd0';
      ctx.fillRect(mx + dx, my + dy, 1, 1);
    }

    // 遠方的城市剪影（比店面更遠、更暗），有幾扇亮著的窗
    {
      const r3 = root.PixelKit.seeded(41), base = ended ? '#b9cfdc' : '#262848';
      let x = 0;
      while (x < lw) {
        const w = 5 + Math.floor(r3() * 7), h = Math.floor(horizon * (0.25 + r3() * 0.30));
        ctx.fillStyle = mix(base, ended ? '#8aa6b8' : '#101226', 0.35);
        ctx.fillRect(x, horizon - h, w, h);
        if (r3() < 0.5) ctx.fillRect(x + 1, horizon - h - 2, w - 2, 2);
        for (let k = 0; k < 3; k++) {
          const wx = x + 1 + Math.floor(r3() * (w - 2)), wy = horizon - h + 2 + Math.floor(r3() * Math.max(1, h - 5)), on = r3() < 0.45;
          ctx.fillStyle = on ? (ended ? '#fff3c4' : '#ffe08a') : 'rgba(0,0,0,0)';
          if (on) ctx.fillRect(wx, wy, 1, 1);
        }
        x += w + Math.floor(r3() * 2);
      }
    }
    // 飄在天上的亂碼（往上飄、輪流消失）
    if (!ended) {
      const r4 = root.PixelKit.seeded(63);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(r4() * lw), sp = 2 + r4() * 3, ph = r4() * horizon;
        const y = horizon - ((t * sp + ph) % horizon);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,59,212,0.55)' : 'rgba(87,227,137,0.6)';
        ctx.fillRect(x, Math.floor(y), 1, i % 2 ? 2 : 1);
        if (i % 4 === 0) ctx.fillRect(x + 1, Math.floor(y) + 1, 1, 1);
      }
    }

    // 地面：遠處街道、近處街道，加石板紋
    ctx.fillStyle = ended ? '#a39887' : '#34343f'; ctx.fillRect(0, horizon, lw, lh - horizon);
    ctx.fillStyle = ended ? '#9a8f80' : '#3e3e4a'; ctx.fillRect(0, horizon + Math.floor((lh - horizon) * 0.30), lw, lh);
    ctx.fillStyle = ended ? '#b5aa9a' : '#4a4a57';
    for (let y = horizon + 3; y < lh; y += 3) for (let x = (y % 2) * 3; x < lw; x += 6) ctx.fillRect(x, y, 3, 1);

    // 三間店的剪影
    SHOPS.forEach((L, i) => {
      const st = root.Town.shopStatus(g, i), fixed = g.repaired[i];
      const col = c => fixed ? c : mix(c, st === 'locked' ? '#2a2a36' : '#5a5a66', st === 'locked' ? 0.85 : 0.72);
      const w = Math.round(lw * L.w), h = Math.round(lw * L.h), x = Math.round(lw * L.cx - w / 2), top = horizon - h;
      ctx.fillStyle = col(L.wall); ctx.fillRect(x, top, w, h);
      ctx.fillStyle = col(L.roof);
      for (let k = 0; k < Math.ceil(w / 2) - 1; k++) ctx.fillRect(x - 1 + k, top - 1 - k, w + 2 - k * 2, 1);
      const dx = x + Math.floor(w / 2) - 1;
      ctx.fillStyle = col(L.door); ctx.fillRect(dx, horizon - 4, 3, 4);
      ctx.fillStyle = fixed ? '#ffe08a' : col('#3a4a5a');
      ctx.fillRect(x + 2, top + 3, 2, 2); ctx.fillRect(x + w - 4, top + 3, 2, 2);
      // 店門上方的小標記：紅＝被佔據、黃＝可以修
      if (st === 'occupied' || st === 'repairable') {
        const my2 = Math.max(1, top - Math.ceil(w / 2) - 5 + (Math.floor(t * 2) % 2));
        ctx.fillStyle = st === 'occupied' ? '#ff5a6a' : '#ffd84d';
        ctx.fillRect(dx + 1, my2, 1, 3); ctx.fillRect(dx + 1, my2 + 4, 1, 1);
      }
      if (!fixed && st !== 'locked') { // 亂碼雜點
        const r2 = root.PixelKit.seeded(20 + i);
        for (let k = 0; k < 5; k++) { ctx.fillStyle = r2() < 0.5 ? 'rgba(87,227,137,0.8)' : 'rgba(255,59,212,0.6)'; ctx.fillRect(x + Math.floor(r2() * w), top + Math.floor(r2() * h), 1, 1); }
      }
    });
    // 路燈
    for (const lx of [0.33, 0.67]) {
      const x = Math.round(lw * lx);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(x, horizon - 9, 1, 9);
      ctx.fillStyle = ended ? '#c9c2b0' : '#ffe08a'; ctx.fillRect(x - 1, horizon - 11, 3, 2);
    }
    // 近處：兩側的大路燈（有光暈）、長椅、花盆、貓（尾巴會搖）
    const gy = lh - 3;
    for (const lx of [0.07, 0.93]) {
      const x = Math.round(lw * lx), top = Math.floor(lh * 0.38);
      if (!ended) { ctx.fillStyle = 'rgba(255,224,138,0.10)'; ctx.fillRect(x - 6, top - 5, 13, 11); ctx.fillStyle = 'rgba(255,224,138,0.14)'; ctx.fillRect(x - 4, top - 3, 9, 7); }
      ctx.fillStyle = '#23232d'; ctx.fillRect(x, top, 2, gy - top); ctx.fillRect(x - 1, gy - 1, 4, 2);
      ctx.fillStyle = ended ? '#c9c2b0' : '#ffe08a'; ctx.fillRect(x - 2, top - 3, 6, 3);
      ctx.fillStyle = '#23232d'; ctx.fillRect(x - 3, top - 4, 8, 1);
    }
    { // 長椅（右）
      const bx = Math.round(lw * 0.77), by = gy - 5;
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(bx, by, 12, 2); ctx.fillRect(bx, by - 3, 12, 1);
      ctx.fillStyle = '#3e2614'; ctx.fillRect(bx + 1, by + 2, 1, 3); ctx.fillRect(bx + 10, by + 2, 1, 3); ctx.fillRect(bx, by - 3, 1, 3); ctx.fillRect(bx + 11, by - 3, 1, 3);
    }
    { // 花盆（左）
      const px = Math.round(lw * 0.20), py = gy - 4;
      ctx.fillStyle = '#b5702e'; ctx.fillRect(px, py, 5, 4); ctx.fillStyle = '#8a4b2a'; ctx.fillRect(px, py, 5, 1);
      ctx.fillStyle = '#57a37a'; ctx.fillRect(px + 1, py - 3, 1, 3); ctx.fillRect(px + 3, py - 4, 1, 4); ctx.fillRect(px + 2, py - 2, 1, 1);
      ctx.fillStyle = '#ff7ab0'; ctx.fillRect(px, py - 4, 2, 1); ctx.fillStyle = '#ffd84d'; ctx.fillRect(px + 3, py - 6, 2, 2);
    }
    { // 貓（坐著，尾巴左右搖）
      const cx = Math.round(lw * 0.66), cy = gy - 5, sw = Math.floor(t * 2) % 2;
      ctx.fillStyle = '#e8b06a'; ctx.fillRect(cx, cy + 1, 5, 4); ctx.fillRect(cx + 1, cy - 2, 4, 3);
      ctx.fillRect(cx + 1, cy - 3, 1, 1); ctx.fillRect(cx + 4, cy - 3, 1, 1);
      ctx.fillStyle = '#b5702e'; ctx.fillRect(cx + (sw ? 5 : 6), cy + 3 - sw, 1, 2 + sw); ctx.fillRect(cx + 1, cy + 3, 1, 2);
      ctx.fillStyle = '#1d1d2b'; ctx.fillRect(cx + 2, cy - 1, 1, 1); ctx.fillRect(cx + 4, cy - 1, 1, 1);
    }
  }

  root.HomeScene = { draw };
})(typeof window !== 'undefined' ? window : globalThis);
