// 開場故事（無厘頭版，2026-11-10 煦恩定案）：5 格，用現有街景與角色組合，程式畫的像素動畫。
// 第一次打開遊戲自動播放，可以跳過；「怎麼玩」裡可以重看。
(function (root) {
  'use strict';
  const W = 128, H = 50, GROUND = 42;
  const { drawMap, MAPS, HERO_MAP, HERO_PAL } = root.PixelKit;

  const PAGES = [
    '這裡是一座普通的小鎮。普通到鎮長的興趣是數路燈，而且每天都數對。',
    '直到某天，有人在廣場打了一個超大的噴嚏。不知道為什麼，噴出來的全是亂碼。',
    '麵包變成 404，時鐘開始倒著走，工具店的積木把自己裝反了。鎮長數路燈，數到 7 之後就變成「ㄅ」。',
    '這時，一台舊電腦自己開機了，跳出來的是你：修復師。你唯一的技能是……解數獨。',
    '沒錯，打怪就靠解數獨。別問為什麼，要問就去問亂碼。',
  ];

  const MAYOR = [
    '.KKKKK.',
    '.KKKKK.',
    'KKKKKKK',
    '.SSSSS.',
    '.SESES.',
    '.SWWWS.',
    'RRRRRRR',
    'RRRYRRR',
    '.RRRRR.',
    '.P...P.',
  ];
  const MAYOR_PAL = { K: '#2a2a3a', S: '#f2c9a0', E: '#222222', W: '#eeeeee', R: '#b03a52', Y: '#ffd84d', P: '#3a3a4a' };
  const SNEEZER = [
    '.HHH.',
    'HHHHH',
    '.SSS.',
    '.SES.',
    'BBBBB',
    '.BBB.',
    '.P.P.',
  ];

  // 小小的像素數字（3×5），給鎮長的對話泡泡用；最後一個是注音「ㄅ」
  const DIGITS = {
    1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XX.', '..X', '.X.', 'X..', 'XXX'], 3: ['XX.', '..X', 'XX.', '..X', 'XX.'],
    4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XX.', '..X', 'XX.'], 6: ['.XX', 'X..', 'XXX', 'X.X', 'XXX'],
    7: ['XXX', '..X', '.X.', '.X.', '.X.'], B: ['.X.', 'XXX', '.X.', '.X.', '..X'],
  };

  const LAMPS = [35, 63, 97];

  // 街景底圖：用小鎮的畫法，配不同的進度
  let bgCache = null;
  function backgrounds() {
    if (bgCache) return bgCache;
    const T = root.Town;
    const happy = T.newGame();
    happy.repaired = [true, true, true]; happy.quests = [true, true, true]; happy.ended = true;
    const broken = T.newGame();
    const empty = T.newGame(); // 灰色街景但門口沒有怪（史萊姆已經走到主角對面）
    empty.dex[root.MONSTERS[0].id] = 1;
    const mk = g => { const c = document.createElement('canvas'); root.drawStreet(c, g); return c; };
    bgCache = { happy: mk(happy), broken: mk(broken), empty: mk(empty) };
    return bgCache;
  }

  function bubble(ctx, x, y, glyph) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 7, 7); ctx.fillRect(x + 1, y + 7, 2, 1);
    drawMap(ctx, DIGITS[glyph], { X: '#2a2a3a' }, x + 2, y + 1);
  }

  function lamps(ctx, lit) {
    for (const x of LAMPS) {
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x, GROUND - 14, 1, 14);
      ctx.fillStyle = lit ? '#ffe08a' : '#666677'; ctx.fillRect(x - 1, GROUND - 16, 3, 2);
    }
  }

  function glitch(ctx, n, x0, y0, w, h, rnd) {
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(87,227,137,0.85)' : 'rgba(255,59,212,0.7)';
      ctx.fillRect(x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), 1 + Math.floor(rnd() * 2), 1);
    }
  }

  // 修復師：還沒取名選角時是一團剪影（頭上一個問號），選好之後照玩家的樣子畫
  function hero(ctx, x, y, t) {
    const look = root.Intro.getLook ? root.Intro.getLook() : null;
    if (look && look.gender) { root.Avatar.drawFine(ctx, look, x, y, { t }); return; }
    root.Avatar.drawFine(ctx, { gender: 'm' }, x, y, { t, tint: '#2a2c44', tintAmt: 0.9 });
    if (Math.floor(t * 2) % 2 === 0) drawMap(ctx, ['XXX', '..X', '.X.', '...', '.X.'], { X: '#ffd84d' }, x + 5, y - 7);
  }

  function draw(ctx, page, t) {
    const bg = backgrounds();
    const rnd = Math.random;
    ctx.setTransform(2, 0, 0, 2, 0, 0); // 畫布是兩倍大，修復師的重畫版才畫得細
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    if (page === 0) {
      ctx.drawImage(bg.happy, 0, 0);
      lamps(ctx, true);
      // 鎮長走到哪盞燈就數到幾，數完從頭再來
      const k = Math.floor(t / 1.2) % 3;
      const mx = LAMPS[k] + 3;
      drawMap(ctx, MAYOR, MAYOR_PAL, mx, GROUND - 10 + (Math.floor(t * 4) % 2));
      bubble(ctx, mx + 6, GROUND - 22, k + 1);
    } else if (page === 1) {
      ctx.drawImage(bg.happy, 0, 0);
      lamps(ctx, true);
      // 廣場上的人：吸氣 → 哈啾！→ 亂碼噴滿天
      const cyc = t % 3;
      const sx = 110, sy = GROUND - 7;
      const lean = cyc < 1.2 ? -Math.floor(cyc * 2) % 2 : cyc < 1.4 ? 2 : 0;
      drawMap(ctx, SNEEZER, { H: '#6b3a1e', S: '#f2c9a0', E: '#222222', B: '#e8a23d', P: '#3a3a4a' }, sx + lean, sy);
      if (cyc >= 1.2) {
        const p = Math.min(1, (cyc - 1.2) / 1.2);
        const r = 6 + p * 70;
        for (let k = 0; k < 90; k++) {
          const a = Math.PI * (0.55 + rnd() * 0.9), d = rnd() * r;
          ctx.fillStyle = rnd() < 0.5 ? '#57e389' : '#ff3bd4';
          ctx.fillRect(Math.round(sx + Math.cos(a) * d), Math.round(sy - 2 - Math.abs(Math.sin(a)) * d * 0.5), 1 + (rnd() < 0.3), 1);
        }
      }
    } else if (page === 2) {
      ctx.drawImage(bg.broken, 0, 0);
      lamps(ctx, false);
      glitch(ctx, 30, 0, 0, W, GROUND, rnd);
      // 鎮長數到 7 就當機成「ㄅ」
      const n = Math.floor(t / 0.6) % 10;
      const glyph = n < 7 ? n + 1 : 'B';
      const shake = n >= 7 ? Math.round(rnd() * 2 - 1) : 0;
      drawMap(ctx, MAYOR, MAYOR_PAL, 100 + shake, GROUND - 10);
      bubble(ctx, 106, GROUND - 22, glyph);
    } else if (page === 3) {
      ctx.drawImage(bg.empty, 0, 0);
      ctx.fillStyle = 'rgba(15,16,26,0.55)'; ctx.fillRect(0, 0, W, H);
      // 舊電腦
      const cx = 52, cy = GROUND - 18;
      ctx.fillStyle = '#c9c1a8'; ctx.fillRect(cx, cy, 24, 16);
      ctx.fillStyle = '#a89f86'; ctx.fillRect(cx + 4, cy + 16, 16, 2);
      ctx.fillStyle = '#0d1f17'; ctx.fillRect(cx + 3, cy + 2, 18, 11);
      const on = t > 0.4;
      if (on) {
        ctx.fillStyle = '#57e389';
        for (let r = 0; r < 4; r++) if (rnd() < 0.8) ctx.fillRect(cx + 5, cy + 4 + r * 2, 3 + Math.floor(rnd() * 11), 1);
      }
      // 修復師從螢幕跳出來（跳一次之後在旁邊站好、輕輕晃）
      const p = Math.min(1, Math.max(0, (t - 0.9) / 0.8));
      if (t > 0.9) {
        const hx = Math.round(cx + 6 + p * 28), hy = Math.round(cy - 2 - Math.sin(Math.PI * p) * 18 + p * 4);
        hero(ctx, hx, p >= 1 ? GROUND - 16 + (Math.sin(t * 3) > 0.6 ? -1 : 0) : hy, t);
        if (p < 1) glitch(ctx, 12, hx - 2, hy, 16, 16, rnd);
      }
    } else {
      ctx.drawImage(bg.empty, 0, 0);
      glitch(ctx, 15, 0, 0, W, GROUND, rnd);
      hero(ctx, 22, GROUND - 16 + (Math.sin(t * 3) > 0.6 ? -1 : 0), t);
      const slime = root.MONSTERS[0];
      const map = MAPS[slime.map][0];
      drawMap(ctx, map, slime.pal, 90, GROUND - map.length - (Math.sin(t * 2.4 + 1) > 0.5 ? 1 : 0));
      // 中間的 VS 會閃
      if (Math.floor(t * 2) % 2 === 0) {
        const V = ['X...X', 'X...X', '.X.X.', '.X.X.', '..X..'], S = ['.XXX', 'X...', '.XX.', '...X', 'XXX.'];
        drawMap(ctx, V, { X: '#ffd84d' }, 56, 18); drawMap(ctx, S, { X: '#ffd84d' }, 63, 18);
      }
    }
  }

  // ---------- 播放 ----------
  const ASK_AT = 3;
  let page = 0, t0 = 0, raf = 0, onDone = null;
  const $ = s => document.querySelector(s);

  function textOf(k) {
    const name = root.Intro.getName ? root.Intro.getName() : '';
    if (k === PAGES.length - 1 && name) return `沒錯，${name}，打怪就靠解數獨。別問為什麼，要問就去問亂碼。`;
    return PAGES[k];
  }

  function render() {
    $('#intro-text').textContent = textOf(page);
    $('#intro-dots').innerHTML = PAGES.map((_, k) => `<i class="${k === page ? 'on' : ''}"></i>`).join('');
    $('#intro-next').textContent = page === PAGES.length - 1 ? '好吧，開始修復' : '下一頁 ▶';
    t0 = performance.now();
  }

  function loop(now) {
    const cv = $('#intro-canvas');
    draw(cv.getContext('2d'), page, (now - t0) / 1000);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(raf);
    $('#intro').classList.add('hidden');
    try { localStorage.setItem('lmtown.introSeen', '1'); } catch (e) { /* 瀏覽器不給存就算了 */ }
    if (onDone) onDone();
  }

  // 第 4 格（修復師跳出來）之後先問名字和男生／女生；問完再回來播最後一格
  function next() {
    if (page === ASK_AT && root.Intro.ask) {
      $('#intro').classList.add('hidden');
      root.Intro.ask(() => { $('#intro').classList.remove('hidden'); page++; render(); });
      return;
    }
    if (page < PAGES.length - 1) { page++; render(); } else close();
  }

  function play(done) {
    onDone = done || null;
    page = 0;
    const cv = $('#intro-canvas');
    cv.width = W * 2; cv.height = H * 2;
    $('#intro').classList.remove('hidden');
    render();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function seen() { try { return localStorage.getItem('lmtown.introSeen') === '1'; } catch (e) { return false; } }
  function isOpen() { return !$('#intro').classList.contains('hidden'); }

  function init() {
    $('#intro-next').addEventListener('click', next);
    $('#intro-canvas').addEventListener('click', next);
    $('#intro-skip').addEventListener('click', close);
  }

  root.Intro = { PAGES, play, seen, isOpen, next, close, init, draw };
})(typeof window !== 'undefined' ? window : globalThis);
