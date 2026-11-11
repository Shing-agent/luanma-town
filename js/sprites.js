// 戰鬥舞台：程式畫的像素風（自己做的，沒有版權問題）。
(function (root) {
  'use strict';

  const W = 128, H = 54, GROUND = 44;
  const HERO_X = 22, MON_X = 98; // 角色中心 x（給畫面上的跳字定位）

  const HERO_MAP = [
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
  ];
  const HERO_PAL = { H: '#2f7a55', h: '#1f5a3d', S: '#f2c9a0', E: '#222222', B: '#3b5b8c', G: '#57e389', P: '#2b2b3a', K: '#5a3a22' };

  const BLOB_MAP = [
    '......MMMM......',
    '....MMMMMMMM....',
    '...MMMMMMMMMM...',
    '..MMMMMMMMMMMM..',
    '..MMWWMMMMWWMM..',
    '.MMMWKMMMMWKMMM.',
    '.MMMMMMMMMMMMMM.',
    '.MMMMMMMMMMMMMM.',
    '.MMMMKKKKKKMMMM.',
    'MMMMMKTKKTKMMMMM',
    'MMMMMMMMMMMMMMMM',
    'DMMMMMMMMMMMMMMD',
    '.DDMMMMMMMMMMDD.',
    '..DD..DDDD..DD..',
  ];
  const BAT_UP = [
    'M..............M',
    'MM............MM',
    'MMM...M..M...MMM',
    'MMMM..MMMM..MMMM',
    'MMMMMMMMMMMMMMMM',
    '.MMMMWKMMWKMMMM.',
    '..MMMMMMMMMMMM..',
    '...DMKTKKTKMD...',
    '....DMMMMMMD....',
    '.....DMMMMD.....',
    '......D..D......',
    '................',
  ];
  const BAT_DOWN = [
    '................',
    '................',
    '......M..M......',
    '......MMMM......',
    '..MMMMMMMMMMMM..',
    '.MMMMWKMMWKMMMM.',
    'MMMMMMMMMMMMMMMM',
    'MMMDMKTKKTKMDMMM',
    'MM..DMMMMMMD..MM',
    'M....DMMMMD....M',
    '......D..D......',
    '................',
  ];
  const CUBE_MAP = [
    '..DDDDDDDDDD..',
    '.DMMMMMMMMMMD.',
    'DMMMMMMMMMMMMD',
    'DMMWWMMMMWWMMD',
    'DMMWKMMMMWKMMD',
    'DMMMMMMMMMMMMD',
    'DMMMMMMMMMMMMD',
    'DMMKKKKKKKKMMD',
    'DMMKTKTKTKTMMD',
    'DMMMMMMMMMMMMD',
    'DMMMMMMMMMMMMD',
    'DMMMMMMMMMMMMD',
    '.DMMMMMMMMMMD.',
    '..DDDDDDDDDD..',
  ];
  // 迷宮新怪物（可愛繪本風）：罐頭郵件、彈窗小精靈、沒電熊
  const CAN_MAP = [
    '....WWWWWW....',
    '....WRWWRW....',
    '....WWRRWW....',
    '..DDDDDDDDDD..',
    '.DMMMMMMMMMMD.',
    '.DMMMMMMMMMMD.',
    '.DMMWWMMWWMMD.',
    '.DMMWKMMWKMMD.',
    '.DMMMMMMMMMMD.',
    '.DMMKMMMMKMMD.',
    '.DMMMKKKKMMMD.',
    '.DMMMMMMMMMMD.',
    '.DDDDDDDDDDDD.',
    '..DDD....DDD..',
  ];
  const POPUP_MAP = [
    'DDDDDDDDDDDDDD',
    'DTTTTTTTTTRWRD',
    'DTTTTTTTTTWRWD',
    'DTTTTTTTTTRWRD',
    'DDDDDDDDDDDDDD',
    'DMMMMMMMMMMMMD',
    'DMMWWMMMMWWMMD',
    'DMMWKMMMMWKMMD',
    'DMMMMMMMMMMMMD',
    'DMMMMKKKKMMMMD',
    'DMMMMMMMMMMMMD',
    'DDDDDDDDDDDDDD',
    '..DD......DD..',
  ];
  const BEAR_MAP = [
    '....BBBBBBB...',
    '....BRWWWWWBB.',
    '....BBBBBBB...',
    '.MMM......MMM.',
    '.MMMMMMMMMMMM.',
    'MMMMMMMMMMMMMM',
    'MMMWWMMMMWWMMM',
    'MMMWKMMMMWKMMM',
    'MMMMMTTTTMMMMM',
    'MMMMMTKKTMMMMM',
    'DMMMMMMMMMMMMD',
    '.DMMMMMMMMMMD.',
    '..DDD....DDD..',
  ];
  const BOSS_MAP = [
    '...C..C..C..C...',
    '...CCCCCCCCCC...',
    '...CCYCCCCYCC...',
  ].concat(BLOB_MAP);
  // 每種造型的動畫影格
  const MAPS = { blob: [BLOB_MAP], bat: [BAT_UP, BAT_DOWN], cube: [CUBE_MAP], can: [CAN_MAP], popup: [POPUP_MAP], bear: [BEAR_MAP], boss: [BOSS_MAP] };

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  function seeded(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function drawMap(ctx, map, pal, x, y, o) {
    o = o || {};
    const s = o.scale || 1;
    for (let r = 0; r < map.length; r++) {
      const off = o.rowOffset ? o.rowOffset(r) : 0;
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        if (o.keep && !o.keep(r, c)) continue;
        let col = pal[ch];
        if (o.tint) col = mix(col, o.tint, o.tintAmt == null ? 1 : o.tintAmt);
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + (c + off) * s), Math.round(y + r * s), s, s);
      }
    }
  }

  function makeBg() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = seeded(7);
    const bands = ['#262842', '#2f3052', '#3b3a5e', '#4c4468', '#5f4f72'];
    const bh = Math.ceil(GROUND / bands.length);
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, W, bh); });
    g.fillStyle = '#d8d8f0';
    for (let i = 0; i < 18; i++) g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 18), 1, 1);
    // 被亂碼染灰的房子
    let x = -4;
    while (x < W) {
      const w = 14 + Math.floor(rnd() * 10), h = 12 + Math.floor(rnd() * 12);
      const top = GROUND - h;
      const wall = ['#6b6b78', '#767684', '#5f5f6c'][Math.floor(rnd() * 3)];
      g.fillStyle = wall; g.fillRect(x, top, w, h);
      g.fillStyle = mix(wall, '#000000', 0.35);
      for (let k = 0; k < Math.ceil(w / 2); k++) g.fillRect(x + k, top - k, w - k * 2, 1);
      for (let wy = top + 4; wy < GROUND - 6; wy += 7)
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          g.fillStyle = rnd() < 0.2 ? '#c9b46a' : '#3a3a46';
          g.fillRect(wx, wy, 3, 3);
        }
      x += w + 2 + Math.floor(rnd() * 6);
    }
    g.fillStyle = '#44444f'; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#55555f';
    for (let yy = GROUND + 2; yy < H; yy += 4)
      for (let xx = (yy / 4) % 2 ? 0 : 3; xx < W; xx += 6) g.fillRect(xx, yy, 4, 1);
    return c;
  }

  class Stage {
    constructor(canvas) {
      this.canvas = canvas;
      canvas.width = W; canvas.height = H;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.bg = makeBg();
      this.t = 0;
      this.parts = [];
      this.timers = [];
      this.rain = Array.from({ length: 10 }, () => ({ x: Math.floor(Math.random() * W), y: Math.random() * H, v: 10 + Math.random() * 20 }));
      this.reset();
    }

    reset() {
      this.heroAct = null; this.monAct = null;
      this.heroHit = -9; this.monHit = -9;
      this.flashT = -9; this.flashCol = '#ffffff'; this.shakeT = -9;
      this.deadT = null; this.glitchUntil = 0; this.castT = -9;
      this.frozen = false;
      this.parts.length = 0; this.timers.length = 0;
    }

    setMonster(def) { this.monster = def; this.reset(); }

    monsterBox() {
      const def = this.monster || {};
      const s = def.scale || 1;
      const map = MAPS[def.map || 'blob'][0];
      const w = map[0].length * s, h = map.length * s;
      const lift = def.fly ? 6 : 0;
      return { x: MON_X - w / 2, y: GROUND - h - lift, w, h, s };
    }

    later(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }

    burst(x, y, n, colors, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * speed;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.5 + Math.random() * 0.4, col: colors[i % colors.length], g: 60 });
      }
    }

    // 動畫觸發
    heroAttack(big) {
      this.heroAct = { type: 'attack', t: this.t };
      const m = this.monsterBox();
      const sx = HERO_X + 9, sy = GROUND - 9, tx = m.x + m.w / 2, ty = m.y + m.h / 2;
      const n = big ? 10 : 5;
      for (let i = 0; i < n; i++) {
        const dur = 0.22 + i * 0.015;
        this.parts.push({ x: sx, y: sy + (Math.random() * 4 - 2), vx: (tx - sx) / dur, vy: (ty - sy) / dur, life: dur, col: i % 2 ? '#57e389' : '#b8ffd2', g: 0 });
      }
      this.later(0.22, () => { this.monHit = this.t; this.burst(tx, ty, big ? 8 : 4, ['#b8ffd2', '#57e389'], 40); });
    }

    crit() {
      this.later(0.22, () => {
        this.flashT = this.t; this.flashCol = '#ffffff'; this.shakeT = this.t;
        const m = this.monsterBox();
        this.burst(m.x + m.w / 2, m.y + m.h / 2, 22, ['#ffd84d', '#ffffff', '#ff9a3d'], 70);
      });
    }

    monsterAttack() {
      this.monAct = { type: 'attack', t: this.t };
      this.later(0.17, () => {
        this.heroHit = this.t; this.shakeT = this.t;
        this.flashT = this.t; this.flashCol = '#ff3b3b';
        this.burst(HERO_X, GROUND - 8, 8, ['#ff5a5a', '#ffd0d0'], 40);
      });
    }

    // 怪物放招：跳一下＋往上噴出顏色
    cast(color) {
      this.castT = this.t;
      const m = this.monsterBox();
      this.burst(m.x + m.w / 2, m.y + 2, 12, [color, '#ffffff'], 45);
      this.glitchUntil = this.t + 0.25;
    }

    // 魔王換階段：閃光＋震動＋大量粒子
    phase() {
      this.flashT = this.t; this.flashCol = '#ffffff'; this.shakeT = this.t;
      this.castT = this.t; this.glitchUntil = this.t + 0.6;
      const m = this.monsterBox();
      this.burst(m.x + m.w / 2, m.y + m.h / 2, 30, [this.monster.pal.M, '#ffd84d', '#ffffff'], 70);
    }

    heal() { this.burst(HERO_X, GROUND - 8, 12, ['#ff8fc4', '#ffffff'], 30); }

    die() {
      this.deadT = this.t;
      const m = this.monsterBox();
      this.burst(m.x + m.w / 2, m.y + m.h / 2, 30, [this.monster.pal.M, '#57e389', '#ffffff'], 60);
    }

    draw(dt) {
      const ctx = this.ctx;
      this.t += dt;
      const t = this.t;
      for (let i = this.timers.length - 1; i >= 0; i--)
        if (this.timers[i].at <= t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }

      ctx.save();
      const sh = t - this.shakeT < 0.25 ? 2 : 0;
      if (sh) ctx.translate(Math.round((Math.random() * 2 - 1) * sh), Math.round((Math.random() * 2 - 1) * sh));
      ctx.drawImage(this.bg, 0, 0);

      // 背景的亂碼雨
      ctx.fillStyle = 'rgba(87,227,137,0.35)';
      for (const d of this.rain) {
        d.y += d.v * dt;
        if (d.y > GROUND) { d.y = -4; d.x = Math.floor(Math.random() * W); }
        ctx.fillRect(d.x, Math.floor(d.y), 1, 3);
      }

      // 修復師
      let hx = HERO_X - 6, hy = GROUND - 16 + (Math.sin(t * 3) > 0.6 ? -1 : 0);
      if (this.heroAct) {
        const p = (t - this.heroAct.t) / 0.25;
        if (p >= 1) this.heroAct = null; else hx += Math.round(4 * Math.sin(Math.PI * p));
      }
      const heroHurt = t - this.heroHit < 0.4 && Math.floor(t * 20) % 2 === 0;
      // 修復師：外觀（男生／女生、帽子、衣服、武器）由 avatar.js 畫
      root.Avatar.draw(ctx, this.look, hx, hy, Object.assign({ t }, heroHurt ? { tint: '#ff3b3b', tintAmt: 0.7 } : null));

      // 跟班：縮小一半，在修復師後面跳
      if (this.follower) {
        const f = this.follower, frames = MAPS[f.map || 'blob'];
        const mini = halfMap(frames[frames.length > 1 ? Math.floor(t * 6) % frames.length : 0]);
        const fy = GROUND - mini.length - (f.fly ? 6 + Math.round(Math.sin(t * 4) * 2) : Math.abs(Math.round(Math.sin(t * 5) * 2)));
        drawMap(ctx, mini, f.pal, hx - mini[0].length - 1, fy);
      }

      // 怪物
      if (this.monster) {
        const def = this.monster;
        const m = this.monsterBox();
        const frames = MAPS[def.map || 'blob'];
        const map = frames[frames.length > 1 ? Math.floor(t * 6) % frames.length : 0];
        let mx = m.x, my = m.y;
        if (def.fly) my += Math.round(Math.sin(t * 4) * 2);
        else if (Math.sin(t * 2.4 + 1) > 0.5) my -= 1;
        const c = t - this.castT;
        if (c < 0.3) my -= Math.round(5 * Math.sin(Math.PI * c / 0.3));
        if (this.monAct) {
          const p = (t - this.monAct.t) / 0.35;
          if (p >= 1) this.monAct = null; else mx -= Math.round(20 * Math.sin(Math.PI * p));
        }
        if (t > this.glitchUntil && Math.random() < (def.glitchy ? 0.05 : 0.012)) this.glitchUntil = t + 0.12;
        const glitching = t < this.glitchUntil;
        const o = { scale: m.s };
        if (glitching) o.rowOffset = r => (r % 3 === Math.floor(t * 50) % 3 ? (Math.random() < 0.5 ? -1 : 1) : 0);
        if (t - this.monHit < 0.15) { o.tint = '#ffffff'; o.tintAmt = 0.85; }
        else if (this.frozen) { o.tint = '#7fd4ff'; o.tintAmt = 0.55; }
        if (this.deadT != null) {
          const p = (t - this.deadT) / 0.9;
          o.keep = (r, cc) => ((r * 7 + cc * 13) % 17) / 17 > p;
          my -= Math.round(p * 6);
        }
        if (glitching) drawMap(ctx, map, def.pal, mx + 1, my, Object.assign({}, o, { tint: '#ff3bd4', tintAmt: 1 }));
        drawMap(ctx, map, def.pal, mx, my, o);
        if (def.fly && this.deadT == null) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(MON_X - 5, GROUND + 1, 10, 1);
        }
        if (this.frozen && this.deadT == null) {
          ctx.fillStyle = '#d8f4ff';
          for (let i = 0; i < 4; i++) ctx.fillRect(mx + ((i * 11 + Math.floor(t * 4)) % m.w), my - 3 + (i % 2), 1, 1);
        }
      }

      // 粒子
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }

      // 全畫面閃光
      const f = t - this.flashT;
      if (f < 0.3) {
        ctx.globalAlpha = (1 - f / 0.3) * (this.flashCol === '#ffffff' ? 0.75 : 0.35);
        ctx.fillStyle = this.flashCol; ctx.fillRect(-4, -4, W + 8, H + 8);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  // 圖鑑用的小圖：打過的有顏色，沒打過的是剪影
  // 把像素圖縮小一半（每 2×2 取一格，有顏色就算），給跟班用；算過的記起來
  const halfCache = new Map();
  function halfMap(map) {
    if (halfCache.has(map)) return halfCache.get(map);
    const out = [];
    for (let r = 0; r < map.length; r += 2) {
      let row = '';
      for (let c = 0; c < map[0].length; c += 2) {
        const cand = [map[r][c], map[r][c + 1], map[r + 1] && map[r + 1][c], map[r + 1] && map[r + 1][c + 1]].filter(ch => ch && ch !== '.');
        // 優先保留眼睛等深色細節（K、W），其次主色
        row += cand.find(ch => ch === 'K') || cand.find(ch => ch === 'W') || cand[0] || '.';
      }
      out.push(row);
    }
    halfCache.set(map, out);
    return out;
  }

  function drawPreview(canvas, def, unlocked) {
    const map = MAPS[def.map || 'blob'][0];
    const w = map[0].length, h = map.length;
    canvas.width = 20; canvas.height = 20;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 20, 20);
    drawMap(ctx, map, def.pal, Math.floor((20 - w) / 2), Math.floor((20 - h) / 2) + (h > 18 ? 0 : 1),
      unlocked ? null : { tint: '#11131c', tintAmt: 1 });
  }

  root.Stage = Stage;
  root.drawMonsterPreview = drawPreview;
  root.PixelKit = { mix, drawMap, seeded, MAPS, HERO_MAP, HERO_PAL };
  root.STAGE_POS = { heroPct: HERO_X / W * 100, monPct: MON_X / W * 100 };
})(typeof window !== 'undefined' ? window : globalThis);
