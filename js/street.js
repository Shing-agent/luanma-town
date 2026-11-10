// 小鎮街景：一條街、3 間店＋街尾廣場。程式畫的像素風。
// 沒修的店是灰的、有亂碼雜點；修好變彩色；任務完成後窗戶亮燈、門口多一位居民。
(function (root) {
  'use strict';
  const W = 128, H = 50, GROUND = 42;
  const { mix, drawMap, seeded, MAPS } = root.PixelKit;

  const RESIDENT = [
    '.HHH.',
    'HHHHH',
    '.SSS.',
    '.SES.',
    'BBBBB',
    '.BBB.',
    '.P.P.',
  ];

  // 每間店的樣子
  const LOOKS = [
    { x: 3, w: 30, h: 22, roof: '#d9773f', wall: '#f2d6a2', door: '#8a4b2a', hair: '#6b3a1e', shirt: '#e8a23d' },  // 麵包店
    { x: 37, w: 24, h: 30, roof: '#5a6fb5', wall: '#d8d2c4', door: '#4a3a5a', hair: '#2a2a3a', shirt: '#7a8fd5' },  // 鐘錶店
    { x: 65, w: 30, h: 24, roof: '#3f8f6a', wall: '#c9d6de', door: '#2f4a5a', hair: '#8a5a2a', shirt: '#4fa37a' },  // 工具店
  ];
  const PLAZA_X = 99;

  function drawStreet(canvas, g) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const rnd = seeded(11);
    const ended = g.ended;

    // 天空：結局後變成清晨
    const sky = ended ? ['#8fc7e8', '#a9d4ec', '#c4e2f0', '#f2e2c4'] : ['#262842', '#33345a', '#45416a', '#5f4f72'];
    const bh = Math.ceil(GROUND / sky.length);
    sky.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh); });
    if (!ended) {
      ctx.fillStyle = '#d8d8f0';
      for (let i = 0; i < 14; i++) ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 14), 1, 1);
    } else {
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(112, 4, 6, 6); ctx.fillRect(111, 5, 8, 4);
    }

    // 地面
    ctx.fillStyle = ended ? '#9a8f80' : '#44444f'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = ended ? '#b0a596' : '#55555f';
    for (let y = GROUND + 2; y < H; y += 3)
      for (let x = (y % 2) * 3; x < W; x += 6) ctx.fillRect(x, y, 4, 1);

    root.Town.SHOPS.forEach((shop, i) => drawShop(ctx, LOOKS[i], i, g, rnd));
    drawPlaza(ctx, g, rnd);
  }

  function drawShop(ctx, L, i, g, rnd) {
    const st = root.Town.shopStatus(g, i);
    const fixed = g.repaired[i];
    const col = c => fixed ? c : mix(c, st === 'locked' ? '#3a3a46' : '#6e6e7a', st === 'locked' ? 0.8 : 0.7);
    const top = GROUND - L.h;
    // 牆
    ctx.fillStyle = col(L.wall); ctx.fillRect(L.x, top, L.w, L.h);
    // 屋頂（一層層往上縮）
    ctx.fillStyle = col(L.roof);
    for (let k = 0; k < Math.ceil(L.w / 2) - 2; k++) ctx.fillRect(L.x - 1 + k, top - 1 - k, L.w + 2 - k * 2, 1);
    // 門
    const dx = L.x + Math.floor(L.w / 2) - 3;
    ctx.fillStyle = col(L.door); ctx.fillRect(dx, GROUND - 9, 6, 9);
    ctx.fillStyle = col('#e8c04a'); ctx.fillRect(dx + 4, GROUND - 5, 1, 1);
    // 窗戶：任務完成亮燈
    const lit = g.quests[i];
    ctx.fillStyle = lit ? '#ffe08a' : col('#3a4a5a');
    ctx.fillRect(L.x + 3, GROUND - 14, 5, 4);
    ctx.fillRect(L.x + L.w - 8, GROUND - 14, 5, 4);
    // 招牌
    if (i === 0) { ctx.fillStyle = col('#b5702e'); ctx.fillRect(dx - 1, top + 3, 8, 3); ctx.fillStyle = col('#e8b06a'); ctx.fillRect(dx, top + 3, 6, 2); }
    if (i === 1) {
      const cx = L.x + Math.floor(L.w / 2), cy = top + 6;
      ctx.fillStyle = col('#f4f0e0'); ctx.fillRect(cx - 3, cy - 3, 7, 7);
      ctx.fillStyle = col('#2a2a3a'); ctx.fillRect(cx, cy - 2, 1, 3); ctx.fillRect(cx, cy, 2, 1);
    }
    if (i === 2) { ctx.fillStyle = col('#8a96a0'); ctx.fillRect(dx - 2, top + 4, 10, 2); ctx.fillRect(dx + 6, top + 3, 2, 4); }
    // 花台（任務完成）
    if (lit) {
      ctx.fillStyle = '#8a4b2a'; ctx.fillRect(L.x + 2, GROUND - 9, 7, 2); ctx.fillRect(L.x + L.w - 9, GROUND - 9, 7, 2);
      ['#ff7ab0', '#ffd84d', '#ff7ab0'].forEach((c, k) => {
        ctx.fillStyle = c; ctx.fillRect(L.x + 3 + k * 2, GROUND - 10, 1, 1); ctx.fillRect(L.x + L.w - 8 + k * 2, GROUND - 10, 1, 1);
      });
      drawMap(ctx, RESIDENT, { H: L.hair, S: '#f2c9a0', E: '#222222', B: L.shirt, P: '#3a3a4a' }, dx + 8, GROUND - 7);
    }
    // 亂碼雜點（還沒修好）
    if (!fixed) {
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(87,227,137,0.8)' : 'rgba(255,59,212,0.6)';
        ctx.fillRect(L.x + Math.floor(rnd() * L.w), top + Math.floor(rnd() * L.h), 1 + Math.floor(rnd() * 2), 1);
      }
    }
    // 被佔據時，怪物站在門口
    if (st === 'occupied') {
      const def = root.MONSTERS[root.Town.SHOPS[i].monster];
      const map = MAPS[def.map][0];
      drawMap(ctx, map, def.pal, L.x + Math.floor((L.w - map[0].length) / 2), GROUND - map.length - (def.fly ? 4 : 0));
    }
  }

  function drawPlaza(ctx, g, rnd) {
    const x = PLAZA_X;
    if (g.ended) {
      // 噴水池＋彩旗
      ctx.fillStyle = '#8a96a0'; ctx.fillRect(x + 4, GROUND - 4, 20, 4);
      ctx.fillStyle = '#5fb5e8'; ctx.fillRect(x + 6, GROUND - 4, 16, 2);
      ctx.fillStyle = '#8a96a0'; ctx.fillRect(x + 13, GROUND - 12, 2, 8);
      ctx.fillStyle = '#a9dcf5'; ctx.fillRect(x + 11, GROUND - 14, 6, 2); ctx.fillRect(x + 10, GROUND - 12, 1, 3); ctx.fillRect(x + 17, GROUND - 12, 1, 3);
      const flags = ['#e0455f', '#ffd84d', '#57e389', '#5f8fe8'];
      for (let k = 0; k < 30; k++) { ctx.fillStyle = flags[k % 4]; ctx.fillRect(4 + k * 4, 8 + Math.round(Math.sin(k * 0.5) * 1.5), 2, 2); }
    } else if (root.Town.allRepaired(g)) {
      // 魔王現身：亂碼漩渦＋皇冠
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(217,79,106,0.7)' : 'rgba(87,227,137,0.7)';
        ctx.fillRect(x + 2 + Math.floor(rnd() * 24), GROUND - 4 - Math.floor(rnd() * 26), 1, 2);
      }
      const def = root.MONSTERS[root.Town.BOSS];
      drawMap(ctx, MAPS.boss[0], def.pal, x + 6, GROUND - 17);
    } else {
      // 還沒解鎖：一團亂碼霧
      for (let k = 0; k < 50; k++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '87,227,137' : '120,120,140'},${0.3 + rnd() * 0.4})`;
        ctx.fillRect(x + Math.floor(rnd() * 28), GROUND - Math.floor(rnd() * 30), 1, 1 + Math.floor(rnd() * 3));
      }
    }
  }

  root.drawStreet = drawStreet;
})(typeof window !== 'undefined' ? window : globalThis);
