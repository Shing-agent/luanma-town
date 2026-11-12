// 畫面與操作：盤面、數字鍵、道具、鍵盤、動畫串接。
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  const ITEMS = [
    { kind: 'scan', key: 'z', name: '掃描器', icon: 'scan' },
    { kind: 'bomb', key: 'x', name: '炸彈', icon: 'bomb' },
    { kind: 'freeze', key: 'c', name: '當機', icon: 'freeze' },
    { kind: 'heal', key: 'v', name: '小補丁', icon: 'heart' },
  ];

  // 玩家資料（金幣、道具、圖鑑、修店進度、等級…）；存在瀏覽器裡。
  // 測試模式（?debug）預設不讀也不寫存檔，免得弄亂真的進度；要測存檔就加 &save。
  const DEBUG = /[?&]debug\b/.test(location.search);
  const USE_SAVE = !DEBUG || /[?&]save\b/.test(location.search);
  let game = (USE_SAVE && Save.load()) || Town.newGame();
  function save() { if (USE_SAVE) Save.write(game); }
  const ITEM_INFO = Object.fromEntries(ITEMS.map(it => [it.kind, it]));

  let battle = null, monsterIdx = 0, sel = 0, paused = false, ending = false, noteMode = false;
  // 快打：selNum＝選著的數字（點數字一直選著，再點空格就填）；cellArmed＝沒選數字時先點了空格，下一個數字直接填進去
  let selNum = 0, cellArmed = false;
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 不支援就略過 */ } };
  let mazeCtx = null; // 正在打亂碼迷宮的一場戰鬥：{ run }；主線戰鬥是 null
  Maze.normalize(game);
  Gear.normalize(game);

  // 筆記模式切換
  function renderNoteMode() {
    const nb = document.getElementById('btn-note');
    if (nb) nb.classList.toggle('on', noteMode);
    padBtns.forEach(b => b.classList.toggle('noting', noteMode));
  }
  function toggleNoteMode() { noteMode = !noteMode; renderNoteMode(); }
  let cells = [], padBtns = [], itemBtns = {};
  const stage = new Stage($('#stage'));
  window.TRIAL_OPEN = true; // 試玩版：魔王關與亂碼裂縫一開始就開放（正式公開前改成 false）

  // 玩家輸入的名字放進畫面前先轉義
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function musicFor(id) {
    if (id === 'screen-result') return null;
    if (id === 'screen-battle') {
      if (mazeCtx) { // 迷宮：一幕一首，精英怪與幕王用比較重的那首
        const r = mazeCtx.run, t = r.node && r.node.type;
        return t === 'elite' || t === 'boss' ? 'elite' : 'maze' + Math.min(3, Math.max(1, r.act || 1));
      }
      return battle && battle.monster.boss ? 'boss' : 'battle';
    }
    if (id === 'screen-maze') return mazeUI.ending() ? 'ending' : 'rest';
    return 'town';
  }

  // 緊張層：連擊 ≥ 8 或只剩 1 顆心；只在狀態改變時才通知聲音
  function updateIntensity() {
    const on = !!(battle && battle.state === 'fighting' && (battle.combo >= 8 || battle.hearts === 1));
    if (on !== Sound.intensity()) Sound.setIntensity(on);
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // 背景音樂跟著畫面換：主線戰鬥（魔王另一首）、迷宮戰鬥（依幕、精英／幕王）、迷宮其他畫面、結果畫面先停、其他是小鎮
    Sound.music(musicFor(id));
    if (id !== 'screen-battle') Sound.setIntensity(false); // 緊張層只在戰鬥中
    if (id === 'screen-start') { layoutHome(); paintHome(); }
    window.scrollTo(0, 0);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), 1400);
  }

  function popup(text, cls, who) {
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.innerHTML = text;
    const base = who === 'hero' ? STAGE_POS.heroPct : STAGE_POS.monPct;
    el.style.left = (base + (Math.random() * 10 - 5)) + '%';
    el.style.top = (cls === 'crit' ? 30 : 45) + '%';
    el.addEventListener('animationend', () => el.remove());
    $('#pops').appendChild(el);
  }

  // 盤面上的跳字：從第 i 格冒出來（沒給格子就在盤面中間），眼睛盯著數字也看得到戰況
  function boardPop(text, cls, i) {
    const wrap = $('#board-wrap'), c = cells[i];
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.innerHTML = text;
    el.style.top = (c ? c.offsetTop - 4 : wrap.offsetHeight / 2 - 12) + 'px';
    el.addEventListener('animationend', () => el.remove());
    $('#board-pops').appendChild(el);
    // 靠邊的格子：字不要超出盤面
    const x = c ? c.offsetLeft + c.offsetWidth / 2 : wrap.offsetWidth / 2, half = el.offsetWidth / 2 + 2;
    el.style.left = Math.min(Math.max(x, half), wrap.offsetWidth - half) + 'px';
  }

  // 被打：整個盤面晃一下、閃紅
  function boardHit() {
    const wrap = $('#board-wrap');
    wrap.classList.remove('hit'); void wrap.offsetWidth; wrap.classList.add('hit');
    clearTimeout(boardHit.t);
    boardHit.t = setTimeout(() => wrap.classList.remove('hit'), 500);
  }

  // 出錯時在畫面上方顯示一行紅字（手機上看不到 console，截圖給我就能知道是哪裡出錯）；點一下消失
  function showErr(err) {
    try {
      let el = document.getElementById('err-bar');
      if (!el) {
        el = document.createElement('div'); el.id = 'err-bar';
        el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b00020;color:#fff;font:11px/1.3 monospace;padding:4px 6px;word-break:break-all;max-height:30vh;overflow:auto';
        el.addEventListener('click', () => { el.textContent = ''; el.style.display = 'none'; });
        document.body.appendChild(el);
      }
      const m = (err && (err.message || (err.reason && err.reason.message))) || String(err);
      const at = err && err.stack ? String(err.stack).split('\n').slice(0, 3).join(' | ').replace(/https?:\/\/[^ ]*\//g, '') : '';
      el.style.display = 'block';
      el.textContent = (el.textContent + ' ## ' + m + ' ' + at).slice(-600);
    } catch (e) { /* 略過 */ }
  }
  window.addEventListener('error', e => showErr(e.error || e.message));
  window.addEventListener('unhandledrejection', e => showErr(e.reason));

  // ---------- 開戰 ----------
  function startBattle(idx) {
    if (idx === 'daily') { startDaily(); return; }
    const monster = MONSTERS[idx];
    if (!Town.canFight(game, idx)) return;
    monsterIdx = idx;
    beginBattle(monster, Sudoku.generate(monster.size));
  }

  // 每日挑戰：今天（台北時間）大家同一題
  let dailyDate = '';
  function startDaily() {
    if (!Daily.unlocked(game)) return;
    dailyDate = Daily.today();
    monsterIdx = 'daily';
    beginBattle(Daily.monster(dailyDate), Daily.puzzle(dailyDate));
  }

  // 亂碼迷宮的一場戰鬥：主線的技能、職業、道具、跟班都不帶進來，只靠外掛（規則在 maze.js）
  function startMazeBattle(run) {
    const node = run.node;
    monsterIdx = 'maze';
    beginBattle(node.foes[0].look, Sudoku.generate(node.n), run);
  }

  function beginBattle(monster, puzzle, mazeRun) {
    dropMs = 0;
    battle = new Battle(mazeRun
      ? Object.assign({ puzzle }, Maze.battleOpts(mazeRun, mazeRun.node))
      : Object.assign({ puzzle, monster, inventory: game.inventory }, Hero.battleOpts(game)));
    mazeCtx = mazeRun ? { run: mazeRun } : null;
    sel = battle.grid.indexOf(0);
    selNum = 0; cellArmed = false;
    paused = false; ending = false;
    $('#pause-layer').classList.add('hidden');
    $('#pops').innerHTML = '';
    battle.avoid = sel;
    stage.setMonster(monster);
    stage.look = heroLook();
    stage.follower = !mazeCtx && game.follower ? MONSTERS.find(x => x.id === game.follower) : null;
    $('#items').classList.toggle('hidden', !!mazeCtx);
    $('#ult-wrap').classList.toggle('hidden', !mazeCtx);
    $('#mz-chips').classList.toggle('hidden', !mazeCtx);
    $('#btn-quit').textContent = mazeCtx ? '撤退（回裂縫，這一關要重打）' : '撤退（回小鎮）';
    buildBoard(); buildPad(); buildItems(); buildHpSegments();
    if (mazeCtx) { buildUlt(); renderChips(); }
    show('screen-battle');
    fitBoard();
    render();
    setTimeout(() => popup(`招式：${battle ? battle.monster.moveName : monster.moveName}`, 'info', 'monster'), 400);
  }

  // ---------- 亂碼迷宮：大招按鈕、外掛列、特殊格 ----------
  function buildUlt() {
    const box = $('#ult-wrap');
    box.innerHTML = `<button id="btn-ult" class="btn ult"><span class="ult-fill"></span><span class="ult-label"></span><span class="key">空白鍵</span></button>`;
    $('#btn-ult').addEventListener('click', useUlt);
  }
  // 外掛與套裝：平常收成一顆「外掛 ×N」按鈕（不擠在舞台上），點了才展開清單
  function renderChips() {
    const r = mazeCtx.run, own = Maze.owned(r);
    const sets = Maze.setStatus(r).filter(s => s.count > 0).map(s =>
      `<span class="mzs${s.count >= 2 ? ' on' : ''}" style="--fc:${Maze.FLOWS[s.flow].color}">${Maze.FLOWS[s.flow].name} ${s.count}/3${s.active.length ? ' ★'.repeat(s.active.length) : ''}</span>`).join('');
    const box = $('#mz-chips');
    box.classList.remove('open');
    box.innerHTML = `<button class="mz-toggle" type="button">外掛 ×${own.length}</button><div class="mz-list">${sets}${own.map(p => `<span class="mzp" data-info="${p.id}:${Maze.lv(r, p.id)}" style="--fc:${Maze.FLOWS[p.flow].color}"><b>${p.name}</b><em>${Maze.lv(r, p.id)}</em></span>`).join('') || '<span class="mzp">還沒有外掛</span>'}</div>`;
    box.title = '';
    box.querySelector('.mz-toggle').addEventListener('click', () => box.classList.toggle('open'));
  }
  function renderUlt() {
    const b = $('#btn-ult');
    if (!b || !battle || !battle.mz) return;
    const need = battle.mz.ultNeed, c = Math.min(battle.charge, need);
    b.classList.toggle('ready', c >= need);
    b.querySelector('.ult-fill').style.width = (c / need * 100) + '%';
    b.querySelector('.ult-label').innerHTML = c >= need ? `${Icons.img('bolt')} 整列修復！` : `${Icons.img('bolt')} 整列修復 ${c}/${need}`;
  }
  // 特殊格的小圖示（用 CSS 變數帶進格子角落）
  for (const t of ['chest', 'nugget']) document.documentElement.style.setProperty('--ic-' + t, `url(${Icons.url(t)})`);
  document.documentElement.style.setProperty('--ic-bomb', `url(${Icons.url('bomb')})`);

  function useUlt() {
    if (!canAct() || !mazeCtx) return;
    const r = battle.ult(sel);
    if (!r.ok) {
      toast(r.reason === 'charge' ? `大招還沒充滿（${battle.charge}/${battle.mz.ultNeed}）` : r.reason === 'full' ? '盤面已經滿了' : '現在不能用');
      return;
    }
    Sound.play('ult');
    hitSound('hitUlt');
    flashCells(r.cells, 'flash-item');
    stage.heroAttack(true);
    popup('整列修復！', 'crit', 'monster');
    r.results.forEach((x, k) => setTimeout(() => {
      if (!x.ok) return;
      boardPop('-' + (x.damage + (x.critDamage || 0)), 'dmg', x.idx);
      showCrits(x.crits, x.critDamage);
      showExtras(x);
    }, 60 * k));
    handleEvents(battle.drainEvents());
    render();
    afterAction({ won: r.won, lost: battle.state === 'lost' });
  }

  // 迷宮才有的額外效果：小爆擊、落雷、寶箱、炸彈格、黃金格、回血晶片
  function showExtras(r) {
    const x = r.extras;
    if (!x) return;
    if (x.small) { hitSound('hitSmall', 300); popup(`小爆擊 +${x.small}`, 'crit', 'monster'); boardPop(`小爆擊 +${x.small}`, 'crit', r.idx); }
    if (x.storm) { popup(`落雷 +${x.storm}！`, 'crit', 'monster'); hitSound('hitStorm', 380); }
    if (x.goldCell) boardPop('黃金格 ×3', 'crit', r.idx);
    if (x.chest) { boardPop(`${Icons.img('coin')} +${x.chest}`, 'coin', r.idx); Sound.play('coin'); }
    if (x.bomb) {
      Sound.play('bomb');
      hitSound('hitBomb', 250);
      boardPop(`炸彈 +${x.bomb.damage}`, 'crit', r.idx);
      if (x.bomb.cells) { flashCells(x.bomb.cells, 'flash-item'); if (x.bomb.crits) showCrits(x.bomb.crits, x.bomb.critDamage); }
    }
    if (x.loot) boardPop(`${Icons.img('coin')} +${x.loot}`, 'coin', r.idx);
    if (x.healed) popup(`+${x.healed} ${Icons.img('heart')}`, 'heal', 'hero');
  }

  // 魔王血條畫出分段線
  function buildHpSegments() {
    const bar = $('.hp-bar');
    bar.querySelectorAll('.seg').forEach(x => x.remove());
    const ph = battle.monster.phases;
    if (!ph) return;
    for (let k = 1; k < ph.length; k++) {
      const seg = document.createElement('i');
      seg.className = 'seg';
      seg.style.left = ((1 - k / ph.length) * 100) + '%';
      bar.appendChild(seg);
    }
  }

  function select(i) { sel = i; if (battle) battle.avoid = i; renderBoard(); }

  // 兩種輸入（2026-11-11 煦恩：留著兩種都能用）：
  // 點格子：選著數字＝直接填；沒選數字＝選取那格（下一個數字填進去，選取框不自動跳格）
  function tapCell(i) {
    if (!battle) return;
    if (selNum && !noteMode && canAct()) {
      select(i);
      cellArmed = false;
      if (!battle.grid[i]) enter(selNum);
      return;
    }
    select(i);
    cellArmed = !battle.grid[i];
  }

  // 點數字鍵：剛點了空格＝填進去；不然＝選這個數字（一直選著，再點一次取消）。筆記模式＝記在選取格
  function tapNum(v) {
    if (!battle) return;
    if (noteMode) { enter(v); return; }
    if (cellArmed && !battle.grid[sel]) {
      enter(v);
      if (!battle || battle.grid[sel]) cellArmed = false;
      return;
    }
    cellArmed = false;
    selNum = selNum === v ? 0 : v;
    renderBoard();
  }

  // 盤面依剩餘空間撐滿：取盤面容器寬高的較小值（視窗改變時重算）
  function fitBoard() {
    if (!battle) return;
    const wrap = $('#board-wrap'), board = $('#board');
    const z = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    if (z <= 0) return;
    board.style.width = board.style.height = z + 'px';
    board.style.setProperty('--cell', (z / battle.n) + 'px');
  }
  window.addEventListener('resize', () => { if (battle) fitBoard(); });

  function buildBoard() {
    const { n, br, bc } = battle;
    const board = $('#board');
    board.innerHTML = '';
    board.dataset.n = n;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      const b = document.createElement('button');
      b.className = 'cell';
      if ((c + 1) % bc === 0 && c < n - 1) b.classList.add('br');
      if ((r + 1) % br === 0 && r < n - 1) b.classList.add('bb');
      if (c === n - 1) b.classList.add('last-c');
      if (r === n - 1) b.classList.add('last-r');
      b.addEventListener('pointerdown', e => { e.preventDefault(); tapCell(i); });
      board.appendChild(b);
      cells.push(b);
    }
  }

  function buildPad() {
    const pad = $('#pad');
    pad.innerHTML = '';
    pad.classList.remove('rows2');
    pad.dataset.n = battle.n;
    pad.style.gridTemplateColumns = `repeat(${battle.n}, 1fr) 1.2fr`;
    padBtns = [];
    for (let v = 1; v <= battle.n; v++) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = v;
      b.addEventListener('pointerdown', e => { e.preventDefault(); tapNum(v); });
      pad.appendChild(b);
      padBtns.push(b);
    }
    // 最後一顆：筆記模式切換（放在數字鍵同一列，小螢幕不會多佔高度）
    const nb = document.createElement('button');
    nb.id = 'btn-note'; nb.className = 'btn note-toggle';
    nb.innerHTML = `${Icons.img('pencil')}<small>筆記</small>`;
    nb.setAttribute('aria-label', '筆記模式');
    nb.addEventListener('click', toggleNoteMode);
    pad.appendChild(nb);
    renderNoteMode();
  }

  function buildItems() {
    const box = $('#items');
    box.innerHTML = '';
    itemBtns = {};
    for (const it of ITEMS) {
      const b = document.createElement('button');
      b.className = 'btn item ' + it.kind;
      b.innerHTML = `<span class="ico">${Icons.img(it.icon)}</span><span>${it.name} ×<b class="cnt"></b></span><span class="key">${it.key.toUpperCase()}</span>`;
      b.addEventListener('click', () => useItem(it.kind));
      box.appendChild(b);
      itemBtns[it.kind] = b;
    }
  }

  // ---------- 畫面更新 ----------
  function renderBoard() {
    if (!battle) return;
    const { n, grid, given } = battle;
    const peers = new Set(battle.units(sel).flatMap(u => u.cells));
    const selVal = battle.shown(sel);
    for (let i = 0; i < n * n; i++) {
      const el = cells[i];
      const v = battle.shown(i);
      if (!el.classList.contains('wrong')) {
        const ns = !v && battle.notes.get(i);
        if (ns && ns.size) el.innerHTML = `<span class="notes n${n}">${Array.from({ length: n }, (_, k) => `<i>${ns.has(k + 1) ? k + 1 : ''}</i>`).join('')}</span>`;
        else el.textContent = v || '';
      }
      el.classList.toggle('given', given[i]);
      el.classList.toggle('covered', battle.covers.includes(i));
      el.classList.toggle('fake', battle.fakes.has(i));
      el.classList.toggle('sniff', game.follower === 'm2' && battle.fakes.has(i)); // 蝙蝠跟班聞得出假數字
      el.classList.toggle('selected', i === sel);
      el.classList.toggle('peer', i !== sel && peers.has(i));
      el.classList.toggle('same', selNum ? v === selNum : i !== sel && !!selVal && v === selVal);
      const sp = battle.special ? battle.special.get(i) : null;
      el.classList.toggle('sp-chest', sp === 'chest');
      el.classList.toggle('sp-bomb', sp === 'bomb');
      el.classList.toggle('sp-gold', sp === 'gold');
    }
    const counts = new Array(n + 1).fill(0);
    grid.forEach(v => counts[v]++);
    padBtns.forEach((b, k) => { b.classList.toggle('done', counts[k + 1] >= n); b.classList.toggle('on', selNum === k + 1); });
  }

  function renderHud() {
    const hearts = [];
    for (let i = 0; i < battle.maxHearts; i++)
      hearts.push(Icons.img(i < battle.hearts ? 'heart' : 'heartEmpty'));
    if (battle.shield > 0) hearts.push(Icons.img('shield'));
    $('#hearts').innerHTML = hearts.join('');
    $('#combo').textContent = battle.combo >= 2 ? `${battle.combo} 連擊 ×${battle.multiplier().toFixed(2).replace(/\.?0+$/, '')}` : '';
    if (mazeCtx) {
      const f = battle.foeInfo();
      $('#gold').innerHTML = `${Icons.img('coin')} ${battle.gold}`;
      $('#mon-name').textContent = f.count > 1 ? `${f.name}（${f.index + 1}/${f.count}）` : f.name;
      $('#hp-fill').style.width = (f.hp / f.max * 100) + '%';
      $('#hp-text').textContent = `${f.count > 1 ? f.index + 1 + '/' + f.count + ' ' : ''}${f.hp}/${f.max}`;
    } else {
      $('#gold').innerHTML = `${Icons.img('coin')} ${game.gold}`;
      $('#mon-name').textContent = battle.monster.name;
      $('#hp-fill').style.width = (battle.hp / battle.maxHp * 100) + '%';
      $('#hp-text').textContent = `${battle.hp} / ${battle.maxHp}`;
    }
    const mv = battle.monster.phases ? `第 ${battle.phase + 1} 段：${battle.phaseDef().name}` : battle.monster.moveName;
    $('#mon-move').textContent = mv;
    if (mazeCtx) { renderUlt(); return; }
    for (const it of ITEMS) {
      const b = itemBtns[it.kind], cnt = game.inventory[it.kind];
      b.querySelector('.cnt').textContent = cnt;
      b.classList.toggle('empty', cnt <= 0);
    }
  }

  function renderTimer() {
    const bar = $('.timer-bar');
    const frozen = battle.freezeLeft > 0;
    $('#timer-fill').style.width = Math.min(100, battle.timer / battle.attackTime * 100) + '%';
    bar.classList.toggle('frozen', frozen);
    bar.classList.toggle('danger', !frozen && battle.timer < battle.attackTime * 0.25);
    $('#board').classList.toggle('danger', !frozen && battle.timer < battle.attackTime * 0.25);
    $('#timer-text').innerHTML = frozen
      ? `${Icons.img('freeze')} ${Math.ceil(battle.freezeLeft)} 秒`
      : `${Math.ceil(battle.timer)} 秒`;
    stage.frozen = frozen;
  }

  function render() { renderBoard(); renderHud(); renderTimer(); updateIntensity(); }

  // 盤面邊框閃色：眼睛盯著數字時，用餘光就知道戰況（綠＝填對、金＝爆擊、紅＝被打）
  function boardFx(color, ms) {
    const b = $('#board');
    b.style.setProperty('--fx', color);
    b.classList.add('fx');
    clearTimeout(boardFx.t);
    boardFx.t = setTimeout(() => b.classList.remove('fx'), ms || 450);
  }

  // 怪物倒下時剩下的空格：一格一格長出金幣掉下來（盤面數字先藏起來，輪到才出現）
  let dropMs = 0;
  function coinRain(list, each) {
    const step = Math.min(90, 1100 / list.length);
    dropMs = Math.round(step * list.length) + 400;
    const b = battle;
    toast(`怪物倒下了！剩下 ${list.length} 格變成金幣`);
    list.forEach((i, k) => {
      cells[i].classList.add('dropping');
      setTimeout(() => {
        cells[i].classList.remove('dropping');
        if (battle !== b) return;
        flashCells([i], 'flash-item');
        const wrap = $('#board-wrap'), c = cells[i];
        const el = document.createElement('div');
        el.className = 'coin-drop';
        el.innerHTML = Icons.img('coin');
        el.style.left = (c.offsetLeft + c.offsetWidth / 2) + 'px';
        el.style.top = (c.offsetTop + c.offsetHeight / 2) + 'px';
        el.addEventListener('animationend', () => el.remove());
        $('#board-pops').appendChild(el);
        boardPop(`+${each || 3}`, 'coin', i);
        if (k % 2 === 0) Sound.play('coin');
      }, 120 + step * k);
    });
  }

  // 命中怪物的聲音：跟動畫的「打中」同一刻（約 0.22 秒後）
  function hitSound(name, delay) { setTimeout(() => Sound.play(name), delay == null ? 220 : delay); }

  function flashCells(list, cls) {
    for (const i of list) {
      const el = cells[i];
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 650);
    }
  }

  function showCrits(crits, critDamage) {
    if (!crits.length) return;
    flashCells(crits.flatMap(u => u.cells), 'flash-crit');
    stage.crit();
    boardFx('#ffd24a', 650);
    const label = crits.length > 1 ? `爆擊 ×${crits.length}！` : '爆擊！';
    setTimeout(() => { popup(label, 'crit', 'monster'); popup('-' + critDamage, 'crit', 'monster'); }, 220);
    // 盤面上：在爆擊那一排的中間跳「爆擊 -傷害」
    const mid = crits[0].cells[Math.floor(crits[0].cells.length / 2)];
    setTimeout(() => boardPop(`${label} -${critDamage}`, 'crit', mid), 120);
  }

  function canAct() { return battle && battle.state === 'fighting' && !paused && !ending; }


  // ---------- 操作 ----------
  // 動畫或特效出錯時：顯示錯誤、盤面照樣更新、輸贏照樣判斷（不讓一個小錯誤把整場戰鬥卡住）
  function enter(v) {
    try { enterInner(v); } catch (err) {
      showErr(err);
      try { render(); if (battle && !ending && battle.state !== 'fighting') finish(battle.state === 'won'); } catch (e2) { /* 略過 */ }
    }
  }
  function enterInner(v) {
    if (!canAct()) return;
    if (noteMode) { // 筆記模式：只記候選數字
      const nr = battle.toggleNote(sel, v);
      if (!nr.ignored) { Sound.play('tap'); renderBoard(); }
      return;
    }
    const r = battle.input(sel, v);
    if (r.ignored) return;
    if (!r.ok) {
      // 填錯：數字紅色閃一下就消失，被反擊扣 1 顆心
      const el = cells[sel];
      el.textContent = v; el.classList.add('wrong');
      setTimeout(() => { el.classList.remove('wrong'); renderBoard(); }, 450);
      Sound.play(r.shielded ? 'shield' : 'wrong');
      boardFx(r.shielded ? '#6ab0ff' : '#ff3b3b', 450);
      if (!r.shielded && !r.wagered && !r.down) buzz(80);
      if (r.down) { /* 怪物已倒下：填錯不會被打 */ } else if (r.wagered) { // 賭徒晶片：扣金幣代替扣心
        boardPop(`${Icons.img('coin')} -${r.wagered}`, 'hurt', sel);
        popup(`-${r.wagered} ${Icons.img('coin')}`, 'hurt', 'hero');
      } else {
        stage.monsterAttack();
        setTimeout(() => hurtPopup(r), 170);
        boardHurt(r, sel);
      }
      if (r.reflected) hitSound('hitReflect', 260);
      if (r.reflected) setTimeout(() => popup(`${Icons.img('shield')} 反彈 -${r.reflected}`, 'dmg', 'monster'), 260);
    } else {
      // 填對：選取框留在原格，不自動跳下一格（煦恩指定）
      Sound.play(r.crits.length ? 'crit' : 'correct', r.combo);
      hitSound(r.crits.length ? 'hitCrit' : r.prime ? 'hitPrime' : 'hit');
      buzz(10);
      stage.heroAttack(r.crits.length > 0);
      if (!r.crits.length) boardFx('#46d28a', 350);
      if (r.unmasked) popup('揭穿假數字！', 'info', 'monster');
      setTimeout(() => popup('-' + r.damage, 'dmg', 'monster'), 220);
      boardPop('-' + r.damage, 'dmg', sel);
      showCrits(r.crits, r.critDamage);
      showExtras(r);
      if (r.chain) { // 法師「連鎖爆擊」
        setTimeout(() => {
          Sound.play('hitChain');
          flashCells(r.chain.cells, 'flash-item');
          popup(`連鎖 -${r.chain.damage + r.chain.critDamage}`, 'crit', 'monster');
          if (r.chain.crits.length) flashCells(r.chain.crits.flatMap(u => u.cells), 'flash-crit');
        }, 450);
      }
    }
    handleEvents(battle.drainEvents());
    render();
    afterAction(r);
  }

  // 被打：有防火牆就擋下，沒有就扣 1 顆心
  function hurtPopup(r) {
    if (r.shielded) popup(`${Icons.img('shield')} 防火牆擋下！`, 'heal', 'hero');
    else popup(`-1 ${Icons.img('heart')}`, 'hurt', 'hero');
  }

  // 盤面上的被打回饋：有防火牆只跳字，沒有就晃一下閃紅
  function boardHurt(r, i) {
    if (r.shielded) { boardPop(`${Icons.img('shield')} 擋下！`, 'heal', i); return; }
    boardHit();
    boardPop(`-1 ${Icons.img('heart')}`, 'hurt', i);
  }

  // 怪物招式、魔王換段等事件
  function handleEvents(events) {
    for (const ev of events) {
      const color = battle.monster.pal.M;
      if (ev.type === 'attack') {
        Sound.play(ev.shielded ? 'shield' : 'attack');
        if (!ev.shielded) buzz(80);
        stage.monsterAttack();
        boardFx(ev.shielded ? '#6ab0ff' : '#ff3b3b', 500);
        setTimeout(() => hurtPopup(ev), 170);
        boardHurt(ev);
        afterAction(ev);
      } else if (ev.type === 'cover') {
        Sound.play('cast');
        stage.cast(color);
        flashCells(ev.cells, 'flash-cover');
        popup(`黏住 ${ev.cells.length} 格！`, 'info', 'monster');
      } else if (ev.type === 'foe') { // 迷宮：打倒一隻，下一隻出場
        Sound.play('foe');
        const b = battle;
        stage.die();
        popup('打倒了！下一隻出場', 'crit', 'monster');
        setTimeout(() => { if (battle === b && b.foes[ev.index]) { stage.setMonster(b.foes[ev.index].look); } }, 550);
      } else if (ev.type === 'down') { // 迷宮：最後一隻倒下了，剩下的格子填完撿金幣
        Sound.play('foe');
        stage.die();
        popup('打倒了！', 'crit', 'monster');
        if (ev.cells && ev.cells.length) coinRain(ev.cells, ev.each);
      } else if (ev.type === 'uncover') {
        flashCells(ev.cells, 'flash-item');
      } else if (ev.type === 'fake') {
        Sound.play(battle.monster.map === 'can' ? 'spam' : 'cast');
        stage.cast(color);
        if (battle.monster.map === 'can') stage.mail();
        popup('嘻嘻…', 'info', 'monster');
      } else if (ev.type === 'phase') {
        Sound.play('phase');
        stage.phase();
        const name = battle.phaseDef().name;
        setTimeout(() => popup(`第 ${ev.phase + 1} 段：${name}！`, 'crit', 'monster'), 100);
        if (battle.phaseDef().attackTime) toast(`魔王變急躁了，攻擊倒數只剩 ${battle.attackTime} 秒`);
      }
    }
  }

  function useItem(kind) {
    if (!canAct() || mazeCtx) return;
    const r = battle.useItem(kind, sel);
    if (!r.ok) {
      toast(r.reason === 'full' ? '心已經是滿的' : r.reason === 'empty' ? '這個道具用完了' : '現在不能用');
      return;
    }
    if (kind === 'scan' || kind === 'bomb') {
      Sound.play(kind);
      hitSound(kind === 'bomb' ? 'hitBomb' : 'hitScan');
      flashCells(r.cells, 'flash-item');
      stage.heroAttack(kind === 'bomb');
      setTimeout(() => popup('-' + r.damage, 'dmg', 'monster'), 220);
      boardPop('-' + r.damage, 'dmg', r.cells[Math.floor(r.cells.length / 2)]);
      showCrits(r.crits, r.critDamage);
    } else if (kind === 'freeze') {
      Sound.play('freeze');
      popup('當機 10 秒！', 'info', 'monster');
    } else if (kind === 'heal') {
      Sound.play('heal');
      stage.heal();
      popup(`+1 ${Icons.img('heart')}`, 'heal', 'hero');
    }
    if (r.saved) setTimeout(() => popup('快取！道具沒用掉', 'heal', 'hero'), 300);
    handleEvents(battle.drainEvents());
    render();
    afterAction(r);
  }

  function afterAction(r) {
    if (r.won) finish(true);
    else if (r.lost) finish(false);
  }

  // 怪物倒下停 1.3 秒再進結果畫面（或迷宮的下一步），不會一填完就跳走
  function finish(won) {
    ending = true;
    if (won) setTimeout(() => stage.die(), 250);
    // 主線：先在戰鬥畫面上蓋一張「修復成功」過場，再淡入結果頁，不要突然切換
    if (!mazeCtx) {
      const isBoss = battle.monster.boss;
      const el = document.createElement('div');
      el.className = 'finish-banner ' + (won ? 'win' : 'lose');
      el.innerHTML = won
        ? `<b>${isBoss ? '亂碼散去了……' : '修復成功！'}</b><small>${esc(battle.monster.name)}被打回原形了</small>`
        : `<b>被亂碼打倒了…</b><small>先喘口氣，再試一次</small>`;
      setTimeout(() => $('#screen-battle').appendChild(el), won ? 700 : 300);
    }
    setTimeout(() => showResult(won), mazeCtx ? (won ? 1300 + dropMs : 900) : (won ? 2400 : 1500));
  }

  function showResult(won) {
    if (mazeCtx) { // 亂碼迷宮：交給迷宮畫面處理（發金幣、掉外掛、結算）
      const b = battle, nodeType = mazeCtx.run.node && mazeCtx.run.node.type;
      mazeCtx = null; battle = null;
      $('#items').classList.remove('hidden');
      mazeUI.onBattleEnd(won, b);
      if (won) { // 迷宮裡的戰鬥也掉裝備：精英、幕王一定掉，普通怪 25%
        const d = Gear.drop(game, nodeType === 'elite' || nodeType === 'boss' ? 'elite' : 'normal');
        if (d) { save(); setTimeout(() => showDrop(d), 500); }
      }
      return;
    }
    const m = battle.monster;
    const sec = Math.round(battle.elapsed);
    const time = `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
    let reward = 0, xp = 0, ups = 0, dropped = null, firstTime = false, ending = false, dailyRes = null, gearDrop = null;
    if (won) {
      reward = Hero.goldBonus(game, battle.holes * 2 + battle.maxCombo * 2);
      if (monsterIdx === 'daily') { game.gold += reward; dailyRes = Daily.recordWin(game, dailyDate, sec); }
      else ({ firstTime, ending } = Town.recordWin(game, monsterIdx, reward));
      xp = Hero.xpGain(game, battle.holes);
      ups = Hero.gainXp(game, xp);
      dropped = Hero.loot(game);
      // 掉裝備：魔王一定掉（稀有以上），一般怪 25%；每日挑戰不掉
      if (monsterIdx !== 'daily') gearDrop = Gear.drop(game, m.boss ? 'elite' : 'normal');
    }
    save(); // 輸了也存：用掉的道具要記得
    $('#result-title').textContent = ending ? '整條街修好了！' : won ? '修復成功！' : '被亂碼打倒了…';
    $('#result-sub').textContent = won ? `${m.name}被打回原形了` : `${m.name}還在搗亂，再試一次吧`;
    const shopIdx = Town.SHOPS.findIndex(sh => sh.monster === monsterIdx);
    let next = '';
    if (ending) next = '亂碼散去，天亮了。麵包香、鐘聲和敲敲打打的聲音回到街上，小鎮又熱鬧起來。鎮長終於數到第 8 盞路燈了。謝謝你，' + (game.name || '修復師') + '！';
    else if (won && firstTime && shopIdx >= 0) next = `${Town.SHOPS[shopIdx].name}空出來了，回小鎮花 ${Town.SHOPS[shopIdx].repair} 金幣就能修好。`;
    $('#result-ending').textContent = next;
    $('#result-ending').classList.toggle('hidden', !next);
    $('#btn-result-dex').classList.toggle('hidden', !firstTime);
    // 第一次打倒佔據店面的怪：給一顆能直接去小鎮修店的按鈕（提示文字不會消失）
    $('#btn-result-town').classList.toggle('hidden', !(won && firstTime && shopIdx >= 0));
    $('#btn-result-town').innerHTML = `${Icons.img('house')} 去小鎮修${shopIdx >= 0 ? Town.SHOPS[shopIdx].name : '店'}`;
    const rows = [['用時', time], ['最高連擊', battle.maxCombo], ['填錯', battle.mistakes + ' 次']];
    if (won) rows.push(['金幣', '+' + reward], ['經驗', '+' + xp + (ups ? `（升到 Lv ${game.level}！）` : '')]);
    if (dailyRes) rows.push(['每日挑戰', dailyRes.again ? '今天已經領過獎勵了' : `+${dailyRes.gold} 金幣（連續 ${dailyRes.streak} 天）`]);
    if (dropped) rows.push(['撿到', `${Icons.img(ITEM_INFO[dropped].icon)} ${ITEM_INFO[dropped].name}`]);
    if (gearDrop) rows.push(['裝備', `<span class="drop-row">${dropLine(gearDrop)}</span>`]);
    $('#result-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#btn-again').textContent = won ? '再打一場' : '重試';
    battle = null;
    document.querySelectorAll('.finish-banner').forEach(e => e.remove());
    Sound.play(won ? 'win' : 'lose');
    show('screen-result');
    if (ending) Sound.music('ending'); // 整條街修好了：結局曲
    if (gearDrop) setTimeout(() => showDrop(gearDrop), 700);
    if (game.picks > 0) setTimeout(showLevelUp, gearDrop ? 1800 : 500);
  }

  // ---------- 升級：三選一技能 ----------
  let choices = [], evolving = false;
  // 技能選完之後，如果到了進化等級就接著選職業
  function doneLevelUp() { $('#levelup').classList.add('hidden'); if (Hero.canEvolve(game)) showEvolve(); }
  function showLevelUp() {
    if (!(game.picks > 0)) { doneLevelUp(); return; }
    choices = Hero.rollChoices(game);
    evolving = false;
    if (!choices.length) { game.picks = 0; doneLevelUp(); return; }
    const lvAt = game.level - game.picks + 1; // 一次升好幾級時，依序選
    $('#lu-title').innerHTML = `${Icons.img('star')} 升級了！Lv ${lvAt}`;
    $('#lu-sub').textContent = game.picks > 1 ? `選一個技能（還有 ${game.picks - 1} 次可以選）` : '選一個技能';
    $('#lu-cards').innerHTML = choices.map((id, k) => {
      const s = Hero.byId[id], now = Hero.lv(game, id);
      return `<button class="btn lu-card" data-skill="${id}">
        <span class="lu-ico">${Icons.img(s.icon)}</span>
        <span class="lu-body"><b>${s.name}</b><small>${s.text}</small></span>
        <span class="lu-lv">${now ? `Lv ${now} → ${now + 1}` : '新技能'}<i>${now + 1}/${s.max}</i></span>
        <span class="key">${k + 1}</span>
      </button>`;
    }).join('');
    Sound.play('levelup');
    $('#levelup').classList.remove('hidden');
  }

  function pickSkill(id) {
    if (!Hero.learn(game, id).ok) return;
    const s = Hero.byId[id];
    toast(`學會了：${s.name}（${s.detail(Hero.lv(game, id))}）`);
    renderTown();
    showLevelUp();
  }

  function levelUpOpen() { return !$('#levelup').classList.contains('hidden'); }

  function setPaused(p) {
    if (!battle || battle.state !== 'fighting' || ending) return;
    paused = p;
    $('#pause-layer').classList.toggle('hidden', !p);
  }

  function goHome() {
    if (mazeCtx) { // 迷宮撤退：回裂縫入口，這一關要重打
      mazeCtx = null; battle = null; paused = false; $('#items').classList.remove('hidden');
      mazeUI.open(false);
      return;
    }
    battle = null; paused = false; renderTown(); show('screen-start');
  }

  // 亂碼迷宮的畫面（mazeui.js）；規則在 maze.js
  const mazeUI = MazeUI.create({
    game: () => game, save, show, toast, esc, goTown: goHome,
    sound: n => Sound.play(n),
    startBattle: run => startMazeBattle(run),
  });
  MazeUI.bindInfo($('#mz-chips')); // 戰鬥中的外掛清單也能長按看說明

  function moveSel(dr, dc) {
    const n = battle.n;
    const r = Math.min(n - 1, Math.max(0, Math.floor(sel / n) + dr));
    const c = Math.min(n - 1, Math.max(0, (sel % n) + dc));
    select(r * n + c);
  }

  // ---------- 小鎮 ----------
  const STATUS_TEXT = { locked: '還沒解鎖', occupied: '被亂碼佔據', repairable: '可以修復', open: '營業中', done: '任務完成' };

  function renderTown() {
    $('#town-gold').innerHTML = `${Icons.img('coin')} ${game.gold}`;
    $('#town-inv').innerHTML = ITEMS.map(it => `<span>${Icons.img(it.icon)}${game.inventory[it.kind] || 0}</span>`).join('');
    if (selShop == null) selShop = defaultShop();
    paintStreet();
    renderHero();
    save(); // 小鎮畫面會在每次買賣、修店、選技能後重畫，順便存檔
    renderHome();

    const box = $('#shops');
    box.innerHTML = '';
    // 每日挑戰卡
    {
      const d = Daily.today(), st = Daily.status(game, d), card = document.createElement('div');
      if (!Daily.unlocked(game)) {
        card.className = 'shop-card daily-card st-locked';
        card.innerHTML = `<div class="shop-head"><b>${Icons.img('calendar')} 每日挑戰</b><span class="pill">還沒解鎖</span></div><p class="shop-note">打倒史萊姆之後，每天都有一題新的挑戰</p>`;
      } else {
        const m = Daily.monster(d);
        card.className = 'shop-card daily-card ' + (st.done ? 'st-done' : 'st-repairable');
        const best = st.best ? `｜最快 ${Math.floor(st.best / 60)} 分 ${st.best % 60} 秒` : '';
        card.innerHTML = `<div class="shop-head"><b>${Icons.img('calendar')} 每日挑戰 ${d.slice(5).replace('-', '/')}</b><span class="pill">${st.done ? '今天完成了' : '今天還沒打'}</span></div>
          <div class="shop-btns"><button class="btn sbtn fight daily" data-act="fight" data-m="daily">${Icons.img('sword')} 打${m.name} 6×6</button></div>
          <p class="shop-note">${st.done ? '明天再來拿獎勵；今天還是可以重打練習' : `過關拿 ${Daily.BASE} 金幣，連續天數越多獎勵越多`}｜連續 ${st.streak} 天${best}</p>`;
      }
      box.appendChild(card);
    }
    Town.SHOPS.forEach((shop, i) => {
      const st = Town.shopStatus(game, i);
      const m = MONSTERS[shop.monster];
      const card = document.createElement('div');
      card.className = 'shop-card st-' + st;
      card.dataset.card = i;
      let html = `<div class="shop-head"><b>${shop.name}</b><span class="pill">${STATUS_TEXT[st]}</span></div>`;
      if (st === 'locked') {
        html += `<p class="shop-note">修好${Town.SHOPS[i - 1].name}後，這裡的亂碼怪才會現身</p>`;
      } else {
        const btns = [`<button class="btn sbtn fight" data-act="fight" data-m="${shop.monster}">${Icons.img('sword')} 打${m.name.replace(/（暫名）/, '')} ${m.size}×${m.size}</button>`];
        if (st === 'repairable') btns.push(`<button class="btn sbtn repair" data-act="repair" data-i="${i}">${Icons.img('hammer')} 修復 ${Icons.img('coin')}${shop.repair}</button>`);
        if (st === 'open' || st === 'done') {
          for (const it of shop.items) {
            const info = ITEM_INFO[it.kind];
            btns.push(`<button class="btn sbtn item ${it.kind}" data-act="buy" data-i="${i}" data-k="${it.kind}">${Icons.img(info.icon)} 買${info.name} ${Icons.img('coin')}${Town.itemPrice(game, i, it.kind)}</button>`);
          }
        }
        if (st === 'open') btns.push(`<button class="btn sbtn quest" data-act="quest" data-i="${i}">${Icons.img('quest')} ${shop.qname} ${Icons.img('coin')}${shop.quest}</button>`);
        html += `<div class="shop-btns">${btns.join('')}</div>`;
        if (st === 'occupied') html += `<p class="shop-note">打倒${m.name.replace(/（暫名）/, '')}才能修店</p>`;
        if (st === 'open') html += `<p class="shop-note">任務完成：店面亮起來、多一位居民，道具打 8 折</p>`;
      }
      card.innerHTML = html;
      box.appendChild(card);
    });

    // 街尾廣場：魔王
    const boss = MONSTERS[Town.BOSS];
    const ready = Town.bossOpen(game);
    const card = document.createElement('div');
    card.className = 'shop-card ' + (game.ended ? 'st-done' : ready ? 'st-occupied' : 'st-locked');
    card.dataset.card = 3;
    card.innerHTML = `<div class="shop-head"><b>街尾廣場</b><span class="pill">${game.ended ? '整條街修好了' : ready ? '魔王出現了' : '還沒解鎖'}</span></div>` +
      (ready
        ? `<div class="shop-btns"><button class="btn sbtn fight boss" data-act="fight" data-m="${Town.BOSS}">${Icons.img('crown')} 挑戰${boss.name.replace(/（暫名）/, '')} ${boss.size}×${boss.size}</button></div>`
        : `<p class="shop-note">三間店都修好，魔王才會出現</p>`);
    box.appendChild(card);

    // 裂縫入口：打倒魔王後解鎖
    {
      const open = Maze.unlocked(game), rc = document.createElement('div');
      rc.className = 'shop-card rift-card ' + (open ? 'st-open' : 'st-locked');
      rc.dataset.card = 3;
      rc.innerHTML = open
        ? `<div class="shop-head"><b>${Icons.img('rift')} 亂碼裂縫</b><span class="pill">${Icons.img('shard')} ${game.maze.shards}</span></div><div class="shop-btns"><button class="btn sbtn fight rift" data-act="rift">${Icons.img('rift')} ${game.maze.run ? '繼續這一局' : '走進裂縫'}</button></div><p class="shop-note">每次路都不一樣，變強靠打贏掉的外掛。最遠第 ${game.maze.best.floors} 關</p>`
        : `<div class="shop-head"><b>${Icons.img('rift')} ？？？</b><span class="pill">還沒解鎖</span></div><p class="shop-note">整條街修好後，廣場會裂開……</p>`;
      box.appendChild(rc);
    }

    box.querySelectorAll('[data-card]').forEach(c => c.classList.toggle('hidden', +c.dataset.card !== selShop));
    $('#town-hint').textContent = townHint();
  }

  // 修復師等級、經驗條、學會的技能
  function renderHero() {
    const need = Hero.xpToNext(game.level);
    const owned = Hero.SKILLS.filter(s => Hero.lv(game, s.id));
    const job = game.cls ? Hero.CLASSES[game.cls].name : '修復師';
    const evolveBtn = Hero.canEvolve(game) ? `<button id="btn-evolve" class="btn sbtn evolve">${Icons.img('star')} 可以進化了！</button>` : '';
    $('#hero-bar').innerHTML =
      `<div class="hero-lv"><canvas class="hero-face"></canvas><div class="hero-mid"><b>${esc(game.name || '修復師')}｜${job} Lv ${game.level}</b>
        <div class="bar xp-bar"><div class="fill" style="width:${game.xp / need * 100}%"></div><span class="bar-text">經驗 ${game.xp} / ${need}</span></div></div></div>` +
      evolveBtn +
      `<div class="hero-skills">${owned.length
        ? owned.map(s => `<span class="chip">${Icons.img(s.icon)}${s.detail(Hero.lv(game, s.id))}</span>`).join('')
        : '<span class="hero-none">打贏怪物拿經驗，升級時可以選技能</span>'}</div>`;
    if (game.follower) {
      const f = Hero.FOLLOWERS[game.follower], box = $('#hero-bar .hero-skills');
      box.querySelector('.hero-none') && box.querySelector('.hero-none').remove();
      box.insertAdjacentHTML('afterbegin', `<span class="chip pal-chip">跟班：${f.name}</span>`);
    }
    // 小頭像：畫頭和上半身
    const face = $('#hero-bar .hero-face');
    face.width = 32; face.height = 40;
    face.getContext('2d').drawImage(Avatar.fineSprite(heroLook(), { t: 0 }), 0, -4);
    const eb = $('#btn-evolve');
    if (eb) eb.addEventListener('click', showEvolve);
  }

  // ---------- 進化：三選一職業 ----------
  function showEvolve() {
    if (!Hero.canEvolve(game)) return;
    $('#lu-title').innerHTML = `${Icons.img('star')} 進化的時候到了！`;
    $('#lu-sub').textContent = '選一個職業（選了就不能換）。職業裝會自動穿上。';
    const look = heroLook();
    $('#lu-cards').innerHTML = Object.entries(Hero.CLASSES).map(([id, c], k) => {
      const own = Hero.SKILLS.filter(s => s.cls === id).map(s => s.name).join('、');
      return `<button class="btn lu-card evo-card" data-cls="${id}">
        <canvas class="evo-pic" data-pic="${id}"></canvas>
        <span class="lu-body"><b>${c.name}<i class="evo-role">${c.role}</i></b><small>${c.text}</small><small>專屬技能：${own}</small></span>
        <span class="key">${k + 1}</span>
      </button>`;
    }).join('') + '<button class="btn btn-small evo-later" data-later="1">之後再決定</button>';
    for (const id of Object.keys(Hero.CLASSES)) {
      const cv = document.querySelector(`[data-pic="${id}"]`);
      const set = {};
      for (const slot of ['hat', 'cloth', 'weapon']) set[slot] = Avatar.ITEMS[slot].find(x => x.cls === id).id;
      Avatar.preview(cv, Object.assign({}, look, set), 0);
    }
    choices = []; evolving = true;
    Sound.play('levelup');
    $('#levelup').classList.remove('hidden');
  }

  function pickClass(cls) {
    if (!Hero.evolve(game, cls).ok) return;
    evolving = false;
    $('#levelup').classList.add('hidden');
    Sound.play('evolve');
    toast(`${game.name || '修復師'}進化成${Hero.CLASSES[cls].name}了！`);
    renderTown();
  }

  // ---------- 居民台詞：點街景，依修復進度講一句無厘頭的話 ----------
  function residentLines() {
    const g = game, name = g.name || '修復師', L = [];
    const st = i => Town.shopStatus(g, i);
    if (g.ended) {
      L.push('鎮長：「我今天數路燈數到 8 了！人生圓滿。」', '鎮長：「我決定明天挑戰數到 9。不要告訴別人。」');
    } else {
      L.push('鎮長：「1、2、3……7……ㄅ？我又卡住了。」', `鎮長：「${name}，加油！我先去數路燈。」`);
    }
    if (st(0) === 'occupied') L.push('史萊姆：「黏～黏黏～」', '麵包店門口傳來一股發酵過頭的味道。');
    if (g.repaired[0]) L.push('麵包店老闆：「麵包終於不是 404 了，是 200 OK！」', '麵包店老闆：「法國麵包可以當武器？我只賣，不負責。」');
    if (st(1) === 'occupied') L.push('鐘樓裡傳來「吱吱」的雜訊聲。');
    if (g.repaired[1]) L.push('鐘錶店老闆：「時鐘往前走了，只是我的手錶還在倒退，我決定隨它去。」');
    if (st(2) === 'occupied') L.push('工具店裡的積木正在努力把自己拼回去，好像越拼越亂。');
    if (g.repaired[2]) L.push('工具店老闆：「積木裝回來了，多出兩顆螺絲，應該沒差吧。」');
    if (g.quests.some(Boolean)) L.push('路過的居民：「謝謝你幫忙！明天也要來喔。」');
    if (g.cls === 'mage') L.push(`小孩：「${name}的帽子好尖，可以拿來戳星星嗎？」`);
    if (g.cls === 'knight') L.push(`小孩：「${name}穿鎧甲走路會叮叮噹噹耶。」`);
    if (g.cls === 'rogue') L.push(`鎮長：「${name}，你剛剛是不是拿走我的筆？……喔，在我耳朵上。」`);
    if (g.follower) L.push(`${Hero.FOLLOWERS[g.follower].name}：「（開心地跳來跳去）」`);
    L.push('路過的居民：「聽說修復師解數獨的時候會自言自語。」', '路過的貓：「喵。」（看起來對數獨沒興趣）');
    return L;
  }
  let lastLine = '';
  function sayLine() {
    const L = residentLines().filter(x => x !== lastLine);
    lastLine = L[Math.floor(Math.random() * L.length)];
    const el = $('#toast');
    el.textContent = lastLine; el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), 2600);
  }
  // 街景：居民會走動；點居民聽他說話，點店（或廣場）切換下方的店面板
  let selShop = null;
  const streetT0 = performance.now();
  function paintStreet() { drawStreet($('#street'), game, { t: (performance.now() - streetT0) / 1000, sel: selShop }); }
  setInterval(() => {
    if (!document.hidden && $('#screen-town').classList.contains('active')) paintStreet();
  }, 110);
  // 預設選到「下一步該去」的那間店
  function defaultShop() {
    for (let i = 0; i < Town.SHOPS.length; i++) {
      const st = Town.shopStatus(game, i);
      if (st === 'occupied' || st === 'repairable' || st === 'open') return i;
    }
    return Town.bossOpen(game) ? 3 : 0;
  }
  function selectShop(i) {
    selShop = i;
    $('#shops').querySelectorAll('[data-card]').forEach(c => c.classList.toggle('hidden', +c.dataset.card !== selShop));
    paintStreet();
  }
  $('#street').addEventListener('click', e => {
    const cv = $('#street'), r = cv.getBoundingClientRect(), S = window.streetInfo;
    const x = (e.clientX - r.left) / r.width * S.W, y = (e.clientY - r.top) / r.height * S.H;
    Sound.play('tap');
    const t = (performance.now() - streetT0) / 1000;
    if (S.walkerAt(t).some(o => x >= o.x - 3 && x <= o.x + 8 && y >= S.GROUND - 12)) { sayLine(); return; }
    for (let i = 0; i < S.LOOKS.length; i++) {
      const L = S.LOOKS[i];
      if (x >= L.x - 1 && x <= L.x + L.w + 1) { selectShop(i); return; }
    }
    if (x >= S.PLAZA_X) { selectShop(3); return; }
    sayLine();
  });

  // 告訴玩家下一步可以做什麼
  function townHint() {
    if (game.ended) return '整條街都修好了！可以繼續打怪收集金幣、完成店家任務。';
    for (let i = 0; i < Town.SHOPS.length; i++) {
      const st = Town.shopStatus(game, i), shop = Town.SHOPS[i];
      const name = MONSTERS[shop.monster].name.replace(/（暫名）/, '');
      if (st === 'occupied') return `下一步：打倒佔據${shop.name}的${name}。`;
      if (st === 'repairable') return game.gold >= shop.repair
        ? `金幣夠了，可以修${shop.name}！`
        : `再存 ${shop.repair - game.gold} 金幣就能修${shop.name}（打過的怪可以重複打）。`;
    }
    return '三間店都修好了，魔王出現在廣場！';
  }

  function townAction(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act, i = +b.dataset.i;
    let r;
    if (act === 'rift') { Sound.play('tap'); mazeUI.open(!game.maze.run); return; }
    if (act === 'fight') { startBattle(b.dataset.m === 'daily' ? 'daily' : +b.dataset.m); return; }
    if (act === 'repair') r = Town.repair(game, i);
    if (act === 'buy') r = Town.buy(game, i, b.dataset.k);
    if (act === 'quest') r = Town.doQuest(game, i);
    if (!r.ok) { toast(r.reason === 'gold' ? `金幣不夠，還差 ${r.short}` : '現在不能這樣做'); return; }
    Sound.play('coin');
    if (act === 'repair') {
      const nextName = MONSTERS[r.unlocked].name.replace(/（暫名）/, '');
      toast(`${Town.SHOPS[i].name}修好了！${r.unlocked === Town.BOSS ? '魔王出現在廣場' : nextName + '出現了'}`);
    }
    if (act === 'buy') toast(`買了 1 個${ITEM_INFO[b.dataset.k].name}`);
    if (act === 'quest') toast(`${Town.SHOPS[i].name}的任務完成了！`);
    renderTown();
  }

  // ---------- 主畫面：角色舞台 ----------
  const hs = { lw: 0, lh: 0, S: 9, say: '', sayT: 0 };

  // 「出發」要打的怪：依解鎖順序，第一隻能打但還沒打倒過的；都打倒過就打最後一隻能打的（不含魔王）
  function frontierMonster() {
    let last = 0;
    for (let i = 0; i < Town.BOSS; i++) {
      if (!Town.canFight(game, i)) break;
      last = i;
      if (!game.dex[MONSTERS[i].id]) return i;
    }
    return last;
  }
  const shortName = m => m.name.replace(/（暫名）/, '');

  // 氣泡裡的提示：townHint() 截成一句短的
  function homeHint() {
    const first = townHint().split(/[。！]/)[0].replace(/（.*?）/g, '');
    return first.length > 24 ? first.slice(0, 23) + '…' : first;
  }

  // 舞台尺寸：背景用細一點的像素（約 4 倍），修復師放大到約佔舞台高度一半
  function layoutHome() {
    const st = $('#home-stage'), cw = st.clientWidth, ch = st.clientHeight;
    if (!cw || !ch) return false;
    const bg = $('#home-bg'), Sb = 4;
    bg.width = hs.lw = Math.ceil(cw / Sb); bg.height = hs.lh = Math.ceil(ch / Sb);
    // 重畫版角色 32×52：每個像素放大 3 倍（人約 120px 高，和煦恩 11/12 縮小兩次後的舊版差不多大）；舞台很矮時才用 2 倍
    const S = ch < 300 || cw < 160 ? 2 : 3;
    const hero = $('#home-hero');
    hero.width = Avatar.SW; hero.height = Avatar.SH;
    hero.style.width = Avatar.SW * S + 'px'; hero.style.height = Avatar.SH * S + 'px';
    hero.style.left = `calc(50% - ${Avatar.CX * S}px)`; // 身體中線對準舞台正中間
    hs.S = S;
    return true;
  }

  function paintHome() {
    if (!hs.lw && !layoutHome()) return;
    const t = (performance.now() - streetT0) / 1000;
    HomeScene.draw($('#home-bg').getContext('2d'), hs.lw, hs.lh, game, t);
    const hc = $('#home-hero').getContext('2d'), bob = Math.floor(t * 2) % 2; // 約 0.5 秒微動一格
    hc.clearRect(0, 0, Avatar.SW, Avatar.SH);
    hc.fillStyle = 'rgba(0,0,0,0.16)'; hc.fillRect(3, 49, 26, 2);
    hc.fillStyle = 'rgba(0,0,0,0.30)'; hc.fillRect(6, 48, 20, 2); hc.fillRect(8, 50, 16, 1);
    hc.drawImage(Avatar.fineSprite(heroLook(), { t }), 0, -bob);
  }
  setInterval(() => { // 不在主畫面或分頁在背景時不畫（省電）
    if (!document.hidden && $('#screen-start').classList.contains('active')) paintHome();
  }, 250);
  window.addEventListener('resize', () => { if ($('#screen-start').classList.contains('active') && layoutHome()) paintHome(); });

  const NAV = [
    ['nav-town', 'house', '小鎮'], ['nav-gear', 'shield', '裝備'], ['nav-dex', 'book', '圖鑑'], ['nav-daily', 'calendar', '每日'], ['nav-settings', 'cog', '設定'],
  ];
  function renderHome() {
    const need = Hero.xpToNext(game.level);
    $('#home-name').textContent = `${game.name || '修復師'} Lv ${game.level}`;
    $('#home-xp').style.width = (game.xp / need * 100) + '%';
    $('#home-xp-text').textContent = `${game.xp}/${need}`;
    $('#home-gold').innerHTML = `${Icons.img('coin')} ${game.gold}`;
    $('#home-shards').innerHTML = `${Icons.img('scrap')} ${Gear.shards(game)}`;
    const ev = $('#home-evolve');
    ev.classList.toggle('hidden', !Hero.canEvolve(game));
    ev.innerHTML = `${Icons.img('star')} 進化`;
    $('#home-label').textContent = (game.cls ? Hero.CLASSES[game.cls].name + '・' : '') + (game.name || '修復師');
    if (!hs.sayT) $('#home-bubble').textContent = homeHint();
    // 能力值總數（技能＋職業＋裝備全部加起來，和開戰時用的同一份 Hero.battleOpts）
    const bo = Hero.battleOpts(game), gold = Hero.goldBonus(game, 100) - 100;
    const stats = [
      ['愛心上限', bo.maxHearts, ''], ['倒數加成', bo.rules.attackBonus, ' 秒'], ['開場多填', bo.reveal, ' 格'],
      ['爆擊傷害', Math.round(bo.rules.critBonus * 100), '%'], ['連擊加成', Math.round((bo.rules.comboStep - 0.25) * 100), '%'], ['金幣加成', gold, '%'],
    ];
    $('#home-stats').innerHTML = stats.map(([n, v, u], i) =>
      `<div class="st${v > (i === 0 ? 3 : 0) ? ' on' : ''}"><small>${n}</small><b>${i > 0 && v > 0 ? '+' : ''}${v}${u}</b></div>`).join('');
    // 大按鈕：出發（最前線的怪）＋ 左右兩顆小的（鎖著時顯示鎖頭）
    const fm = MONSTERS[frontierMonster()];
    $('#btn-go').innerHTML = `${Icons.img('sword')}<b>出發</b><small>${shortName(fm)}</small>`;
    const side = (id, icon, text, open) => {
      const b = $(id);
      b.innerHTML = `${Icons.img(open ? icon : 'lock')}<span>${text}</span>`;
      b.classList.toggle('locked', !open);
    };
    side('#btn-rift', 'rift', '裂縫', Maze.unlocked(game));
    side('#btn-boss', 'crown', '魔王', Town.bossOpen(game));
    // 導覽列：圖示在上、兩個字在下；有事可做時右上角冒一顆小圓點
    const afford = Town.SHOPS.some((s, i) => Town.shopStatus(game, i) === 'repairable' && game.gold >= s.repair);
    const dailyNew = Daily.unlocked(game) && !Daily.status(game, Daily.today()).done;
    const dots = { 'nav-town': afford, 'nav-daily': dailyNew, 'nav-gear': Gear.shards(game) >= 3 };
    for (const [id, icon, text] of NAV) $('#' + id).innerHTML = `${Icons.img(icon)}<span>${text}</span>${dots[id] ? '<i class="dot"></i>' : ''}`;
    paintHome();
  }

  // 點角色：說一句居民台詞（氣泡暫時換成那一句）
  // 能力值明細：每一項列出基本值、職業、技能、裝備各加多少（數字和 Hero.battleOpts／goldBonus 同一份規則）
  function statSources() {
    const L = id => Hero.lv(game, id), sk = id => Hero.byId[id].name;
    const gearRows = (stat, mul) => ['hat', 'cloth', 'weapon'].map(slot => {
      const id = game.look && game.look[slot], v = id ? (Gear.statsOf(game, id)[stat] || 0) * (mul || 1) : 0;
      return v ? [Avatar.find(slot, id).name, v, '裝備'] : null;
    }).filter(Boolean);
    const cls = game.cls, cn = cls ? Hero.CLASSES[cls].name : '';
    const row = (name, v, tag) => v ? [name, v, tag] : null;
    return [
      { name: '愛心上限', unit: '', rows: [['基本', 3, ''], row(cn, cls === 'knight' ? 1 : 0, '職業'), row(sk('heart') + ' Lv' + L('heart'), L('heart'), '技能'), ...gearRows('heart')] },
      { name: '倒數加成', unit: ' 秒', rows: [row(sk('calm') + ' Lv' + L('calm'), 4 * L('calm'), '技能'), ...gearRows('dur')] },
      { name: '開場多填', unit: ' 格', rows: [row(cn, cls === 'rogue' ? 1 : 0, '職業'), row(sk('reveal') + ' Lv' + L('reveal'), L('reveal'), '技能'), ...gearRows('peek')] },
      { name: '爆擊傷害', unit: '%', rows: [row(cn, cls === 'mage' ? 50 : 0, '職業'), row(sk('crit') + ' Lv' + L('crit'), 30 * L('crit'), '技能'), ...gearRows('crit')] },
      { name: '連擊加成', unit: '%', note: '裝備標示的連擊 % 每 1% 只換算成 0.5%', rows: [row(sk('combo') + ' Lv' + L('combo'), 10 * L('combo'), '技能'), ...gearRows('combo', 0.5)] },
      { name: '金幣加成', unit: '%', rows: [row(cn, cls === 'rogue' ? 30 : 0, '職業'), row(sk('lucky') + ' Lv' + L('lucky'), 20 * L('lucky'), '技能'), row('魔王跟班', game.follower === 'm1' ? 10 : 0, '跟班'), ...gearRows('gold')] },
    ].map(s => { s.rows = s.rows.filter(Boolean); return s; });
  }
  function openStatsPop() {
    const fmt = n => String(Math.round(n * 10) / 10);
    $('#stats-body').innerHTML = statSources().map(s => {
      const sum = s.rows.reduce((a, r) => a + r[1], 0), plus = s.name !== '愛心上限' && sum > 0 ? '+' : '';
      return `<div class="stats-sec"><h4>${s.name}<span>${plus}${fmt(sum)}${s.unit}</span></h4>` +
        (s.rows.length ? s.rows.map(r => `<div class="row"><span>${esc(r[0])}<i>${r[2]}</i></span><span>${r[2] === '' ? '' : '+'}${fmt(r[1])}${s.unit}</span></div>`).join('') : '<div class="none">目前沒有加成</div>') +
        (s.note && s.rows.some(r => r[2] === '裝備') ? `<div class="none">${s.note}</div>` : '') + '</div>';
    }).join('');
    $('#stats-pop').classList.remove('hidden');
  }
  $('#home-stats').addEventListener('click', () => { Sound.play('tap'); openStatsPop(); });
  $('#stats-close').addEventListener('click', () => $('#stats-pop').classList.add('hidden'));
  $('#stats-pop').addEventListener('click', e => { if (e.target.id === 'stats-pop') $('#stats-pop').classList.add('hidden'); });
  $('#stats-gear').addEventListener('click', () => { $('#stats-pop').classList.add('hidden'); showGear(); });
  $('#home-hero').addEventListener('click', () => {
    Sound.play('tap');
    const L = residentLines().filter(x => x !== lastLine);
    lastLine = L[Math.floor(Math.random() * L.length)];
    $('#home-bubble').textContent = lastLine;
    hs.sayT = 1;
    clearTimeout(hs.timer);
    hs.timer = setTimeout(() => { hs.sayT = 0; $('#home-bubble').textContent = homeHint(); }, 3500);
  });

  // ---------- 裝備 ----------
  let gearSel = null, gearTab = 'all'; // 選到的裝備 { slot, id }；格子篩選 all／hat／cloth／weapon
  const gearIcon = (slot, id) => `<img class="gear-ico" src="${Avatar.iconUrl(slot, id)}" alt="">`;
  const rarOf = id => (Gear.GEAR[id] ? Gear.GEAR[id].rarity : 0);

  // 掉落／補給箱結果的一行（圖示＋名字＋品質＋新裝備或碎片）
  function dropLine(res) {
    const slot = Gear.GEAR[res.id].slot, it = Avatar.find(slot, res.id);
    return `${gearIcon(slot, res.id)}<b class="r${res.rarity}">${it.name}</b><i class="rar r${res.rarity}">${Gear.RARITY[res.rarity].name}</i>` +
      (res.dupe ? `<small>已經有了 → 碎片 +${res.shards}</small>` : '<small>新裝備！</small>');
  }
  function showDrop(res, title) {
    const el = $('#drop-pop');
    el.innerHTML = `<span class="dp-title">${title || '掉到裝備了！'}</span><span class="dp-line">${dropLine(res)}</span>`;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    Sound.play(res.rarity === 3 ? 'levelup' : 'coin');
    clearTimeout(showDrop.t);
    showDrop.t = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function ensureGearSel() {
    if (gearSel && Avatar.find(gearSel.slot, gearSel.id) && Avatar.owns(game, gearSel.slot, gearSel.id)) return;
    gearSel = { slot: 'hat', id: game.look.hat };
  }

  function renderGear() {
    ensureGearSel();
    $('#gear-top').innerHTML = `<span class="gold">${Icons.img('coin')} ${game.gold}</span><span class="tb-shard">${Icons.img('scrap')} ${Gear.shards(game)}</span>`;
    Avatar.preview($('#gear-pic'), heroLook(), 0);
    document.querySelectorAll('.gslot').forEach(b => {
      const slot = b.dataset.slot, id = game.look[slot];
      b.className = 'gslot r' + rarOf(id) + (gearSel.slot === slot && gearSel.id === id ? ' sel' : '');
      b.innerHTML = gearIcon(slot, id);
    });
    // 篩選：全部＋三個部位（用代表圖示）
    const rep = { hat: 'cap', cloth: 'red', weapon: 'lolly' };
    $('#gear-tabs').innerHTML = `<button class="gtab${gearTab === 'all' ? ' on' : ''}" data-tab="all">全部</button>` +
      Gear.SLOTS.map(s => `<button class="gtab${gearTab === s ? ' on' : ''}" data-tab="${s}" aria-label="${Avatar.SLOT_NAME[s]}">${gearIcon(s, rep[s])}</button>`).join('');
    // 擁有的裝備：4 欄方格，品質用邊框色
    const slots = gearTab === 'all' ? Gear.SLOTS : [gearTab];
    const cells = [];
    for (const slot of slots) {
      const list = Avatar.ITEMS[slot].filter(x => Avatar.owns(game, slot, x.id))
        .sort((a, b) => rarOf(b.id) - rarOf(a.id) || Avatar.ITEMS[slot].indexOf(a) - Avatar.ITEMS[slot].indexOf(b));
      for (const x of list) {
        const sel = gearSel.slot === slot && gearSel.id === x.id, worn = game.look[slot] === x.id;
        cells.push(`<button class="gcell r${rarOf(x.id)}${sel ? ' sel' : ''}${worn ? ' worn' : ''}" data-slot="${slot}" data-id="${x.id}" aria-label="${x.name}">${gearIcon(slot, x.id)}` +
          (Gear.GEAR[x.id] ? `<span class="gc-lv">Lv${Gear.lv(game, x.id)}</span>` : '') +
          (x.cls ? `<span class="gc-cls">${Icons.img('star')}</span>` : '') + (worn ? '<span class="gc-worn"></span>' : '') + '</button>');
      }
    }
    $('#gear-grid').innerHTML = cells.join('');
    // 選到的那件：名字、品質、Lv、能力
    const { slot, id } = gearSel, it = Avatar.find(slot, id), def = Gear.GEAR[id];
    let info;
    if (!def) info = `<div class="gi-head"><b>${it.name}</b></div><p class="gi-none">起始裝備，沒有額外能力</p>`;
    else {
      const lvNow = Gear.lv(game, id), R = Gear.RARITY[def.rarity];
      const next = lvNow < Gear.MAX_LV ? Object.entries(def.stats).map(([s]) => Gear.statText(s, Gear.statAt(id, s, lvNow + 1))).join('、') : '';
      info = `<div class="gi-head"><b>${it.name}</b><i class="rar r${def.rarity}">${R.name}</i>${def.cls ? `<i class="rar cls">${Hero.CLASSES[def.cls].name}專屬</i>` : ''}<span class="gi-lv">Lv ${lvNow}/${Gear.MAX_LV}</span></div>` +
        `<ul class="gi-stats">${Gear.textOf(game, id).map(t => `<li>${t}</li>`).join('')}</ul>` +
        (next ? `<p class="gi-next">升到 Lv ${lvNow + 1}：${next}</p>` : '<p class="gi-next">已經滿級了</p>');
    }
    $('#gear-info').innerHTML = info;
    const worn = game.look[slot] === id;
    $('#gear-equip').textContent = worn ? '穿著中' : '換上';
    $('#gear-equip').classList.toggle('on', worn);
    const nxt = def && Gear.lv(game, id) < Gear.MAX_LV ? Gear.UPGRADE_COST[Gear.lv(game, id)] : 0;
    $('#gear-up').innerHTML = `${Icons.img('scrap')} ${def ? (nxt ? `升級（碎片 ${nxt}）` : '滿級') : '升級'}`;
    $('#gear-crate').innerHTML = `補給箱（${Icons.img('coin')}${Gear.CRATE_PRICE}）`;
    const tot = Gear.totalText(game);
    $('#gear-total').innerHTML = tot.length ? tot.map(t => `<span class="chip">${t}</span>`).join('') : '<span class="hero-none">穿上有能力的裝備，這裡就會有加成</span>';
  }

  function showGear() { gearSel = null; gearTab = 'all'; renderGear(); show('screen-gear'); }

  $('#gear-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    Sound.play('tap');
    gearSel = { slot: b.dataset.slot, id: b.dataset.id };
    renderGear();
  });
  document.querySelectorAll('.gslot').forEach(b => b.addEventListener('click', () => {
    Sound.play('tap');
    gearTab = b.dataset.slot;
    gearSel = { slot: b.dataset.slot, id: game.look[b.dataset.slot] };
    renderGear();
  }));
  $('#gear-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    Sound.play('tap');
    gearTab = b.dataset.tab;
    renderGear();
  });
  $('#gear-equip').addEventListener('click', () => {
    ensureGearSel();
    const { slot, id } = gearSel;
    if (game.look[slot] === id) { toast('已經穿著了'); return; }
    if (!Avatar.equip(game, slot, id).ok) { toast('還沒有這件裝備'); return; }
    Sound.play('tap');
    save(); renderGear();
  });
  $('#gear-up').addEventListener('click', () => {
    ensureGearSel();
    const { id } = gearSel, r = Gear.upgrade(game, id);
    if (!r.ok) {
      toast(r.reason === 'shards' ? `碎片不夠，還差 ${r.short} 個` : r.reason === 'max' ? '已經是滿級了' : '起始裝備沒有能力，不能升級');
      return;
    }
    Sound.play('levelup');
    toast(`${Avatar.find(gearSel.slot, id).name}升到 Lv ${r.level} 了！`);
    save(); renderGear();
  });
  $('#gear-crate').addEventListener('click', () => {
    const r = Gear.crate(game);
    if (!r.ok) { toast(`金幣不夠，還差 ${r.short}`); return; }
    save();
    gearTab = 'all';
    gearSel = { slot: Gear.GEAR[r.id].slot, id: r.id };
    renderGear();
    showDrop(r, '補給箱開出：');
  });
  $('#btn-gear-back').addEventListener('click', goHome);
  $('#btn-town-back').addEventListener('click', goHome);
  $('#btn-settings-back').addEventListener('click', goHome);

  // ---------- 怪物圖鑑 ----------
  function showDex() {
    const list = $('#dex-list');
    list.innerHTML = '';
    const got = MONSTERS.filter(m => game.dex[m.id]).length;
    $('#dex-count').textContent = `已收集 ${got} / ${MONSTERS.length}`;
    MONSTERS.forEach((m, i) => {
      const known = !!game.dex[m.id];
      const card = document.createElement('div');
      card.className = 'dex-card' + (known ? '' : ' locked');
      const cv = document.createElement('canvas');
      cv.className = 'dex-pic';
      drawMonsterPreview(cv, m, known);
      const info = document.createElement('div');
      info.className = 'dex-info';
      info.innerHTML = known
        ? `<p class="dex-name">No.${i + 1} ${m.name}</p>
           <p class="dex-move">招式｜${m.moveName}：${m.moveText}</p>
           <p class="dex-story">${m.story}</p>
           <p class="dex-times">打倒 ${game.dex[m.id]} 次</p>
           <p class="dex-pal">跟班「${Hero.FOLLOWERS[m.id].name}」：${Hero.FOLLOWERS[m.id].text}</p>
           <button class="btn sbtn pal-btn${game.follower === m.id ? ' on' : ''}" data-follow="${m.id}">${game.follower === m.id ? '休息' : '帶上'}</button>`
        : `<p class="dex-name">No.${i + 1} ？？？</p><p class="dex-story">還沒打倒過。出現在 ${m.size}×${m.size} 的戰鬥。</p>`;
      card.append(cv, info);
      list.appendChild(card);
    });
    show('screen-dex');
  }

  // 圖鑑裡選跟班（一次一隻）
  $('#dex-list').addEventListener('click', e => {
    const b = e.target.closest('[data-follow]');
    if (!b) return;
    const id = b.dataset.follow;
    Hero.setFollower(game, game.follower === id ? null : id);
    save();
    toast(game.follower ? `${Hero.FOLLOWERS[id].name}跟上來了！` : '跟班回去休息了');
    showDex();
  });

  // ---------- 事件 ----------
  // 音效、音樂開關（主畫面、設定、戰鬥畫面各一組，狀態共用；設定頁的按鈕多一行字）
  function renderSoundBtns() {
    document.querySelectorAll('.btn-sound').forEach(b => {
      b.innerHTML = Icons.img(Sound.isOn() ? 'soundOn' : 'soundOff') + (b.classList.contains('set-toggle') ? ` 音效：${Sound.isOn() ? '開' : '關'}` : '');
      b.setAttribute('aria-label', Sound.isOn() ? '關掉音效' : '打開音效');
    });
    document.querySelectorAll('.btn-music').forEach(b => {
      b.innerHTML = Icons.img(Sound.isMusicOn() ? 'note' : 'noteOff') + (b.classList.contains('set-toggle') ? ` 音樂：${Sound.isMusicOn() ? '開' : '關'}` : '');
      b.setAttribute('aria-label', Sound.isMusicOn() ? '關掉音樂' : '打開音樂');
    });
  }
  document.querySelectorAll('.btn-music').forEach(b => b.addEventListener('click', () => {
    Sound.setMusic(!Sound.isMusicOn());
    renderSoundBtns();
    toast(Sound.isMusicOn() ? '背景音樂打開了' : '背景音樂關掉了');
  }));
  Sound.music('town');
  document.querySelectorAll('.btn-sound').forEach(b => b.addEventListener('click', () => {
    Sound.setOn(!Sound.isOn());
    renderSoundBtns();
    toast(Sound.isOn() ? '音效打開了' : '音效關掉了');
  }));
  renderSoundBtns();
  // 主畫面的大按鈕：出發（最前線的怪）、魔王、裂縫（沒開放時顯示鎖頭，按了說明原因）。TRIAL_OPEN 期間魔王與裂縫直接開放
  $('#btn-go').addEventListener('click', () => { Sound.play('tap'); startBattle(frontierMonster()); });
  $('#btn-boss').addEventListener('click', () => {
    if (Town.bossOpen(game)) startBattle(Town.BOSS);
    else { Sound.play('tap'); toast('三間店都修好，魔王才會出現'); }
  });
  $('#btn-rift').addEventListener('click', () => {
    Sound.play('tap');
    if (Maze.unlocked(game)) mazeUI.open(!game.maze.run);
    else toast('整條街修好後，廣場會裂開……');
  });
  // 底部導覽列
  $('#nav-town').addEventListener('click', () => { Sound.play('tap'); renderTown(); show('screen-town'); });
  $('#nav-gear').addEventListener('click', () => { Sound.play('tap'); showGear(); });
  $('#nav-dex').addEventListener('click', () => { Sound.play('tap'); showDex(); });
  $('#nav-daily').addEventListener('click', () => {
    if (Daily.unlocked(game)) startBattle('daily');
    else { Sound.play('tap'); toast('打倒史萊姆之後，每天都有一題新的挑戰'); }
  });
  $('#nav-settings').addEventListener('click', () => { Sound.play('tap'); show('screen-settings'); });
  $('#home-evolve').addEventListener('click', showEvolve);
  $('#btn-rename').addEventListener('click', () => openCreate());
  $('#btn-result-town').addEventListener('click', () => { renderTown(); show('screen-town'); });
  $('#btn-result-dex').innerHTML = `${Icons.img('book')} 新怪物收進圖鑑了！點這裡看看`;
  $('#btn-pause').innerHTML = Icons.img('pause');
  renderTown();
  $('#shops').addEventListener('click', townAction);
  $('#btn-dex-back').addEventListener('click', goHome);
  $('#btn-result-dex').addEventListener('click', showDex);
  $('#btn-pause').addEventListener('click', () => setPaused(true));
  $('#btn-resume').addEventListener('click', () => setPaused(false));
  $('#btn-quit').addEventListener('click', goHome);
  $('#btn-again').addEventListener('click', () => startBattle(monsterIdx));
  $('#btn-home').addEventListener('click', goHome);

  $('#lu-cards').addEventListener('click', e => {
    if (e.target.closest('[data-later]')) { evolving = false; $('#levelup').classList.add('hidden'); toast('想好了再從小鎮上方的按鈕進化'); return; }
    const c = e.target.closest('[data-cls]');
    if (c) { pickClass(c.dataset.cls); return; }
    const b = e.target.closest('[data-skill]');
    if (b) pickSkill(b.dataset.skill);
  });

  // ---------- 取名與選角 ----------
  let createDone = null, createGender = '';
  function heroLook() { return Object.assign({ gender: game.gender || 'm' }, game.look); }

  function drawCreatePic() {
    Avatar.preview($('#create-pic'), createGender
      ? Object.assign({}, game.look, { gender: createGender })
      : { gender: 'm' });
    if (!createGender) { // 還沒選：剪影
      const cv = $('#create-pic'), ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(Avatar.fineSprite({ gender: 'm' }, { tint: '#2a2c44', tintAmt: 0.9 }), 0, 0);
    }
  }

  function openCreate(done) {
    createDone = done || null;
    createGender = game.gender || '';
    $('#create-name').value = game.name || '';
    $('#create-err').classList.add('hidden');
    document.querySelectorAll('[data-gender]').forEach(b => b.classList.toggle('on', b.dataset.gender === createGender));
    drawCreatePic();
    $('#create').classList.remove('hidden');
  }
  function createOpen() { return !$('#create').classList.contains('hidden'); }

  function createErr(msg) { const el = $('#create-err'); el.textContent = msg; el.classList.remove('hidden'); }

  function submitCreate() {
    const name = $('#create-name').value.trim();
    if (!name) { createErr('先幫修復師取個名字'); $('#create-name').focus(); return; }
    if (!createGender) { createErr('選一下男生或女生'); return; }
    game.name = name.slice(0, 8);
    game.gender = createGender;
    $('#create').classList.add('hidden');
    renderTown();
    const done = createDone; createDone = null;
    if (done) done();
  }

  document.querySelectorAll('[data-gender]').forEach(b => b.addEventListener('click', () => {
    createGender = b.dataset.gender;
    document.querySelectorAll('[data-gender]').forEach(x => x.classList.toggle('on', x === b));
    $('#create-err').classList.add('hidden');
    drawCreatePic();
  }));
  $('#create-name').addEventListener('input', () => $('#create-err').classList.add('hidden'));
  $('#create-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitCreate(); } });
  $('#create-ok').addEventListener('click', submitCreate);

  // 開場故事：第一次打開自動播（測試模式要加 &intro 才播），「怎麼玩」裡可以重看。
  // 第 4 格修復師跳出來之後問名字和角色；跳過開場的話，關掉後再問。
  Intro.getLook = () => (game.gender ? heroLook() : null);
  Intro.getName = () => game.name;
  Intro.ask = resume => (game.name && game.gender ? resume() : openCreate(resume));
  Intro.init();
  const afterIntro = () => { if (!game.name || !game.gender) openCreate(); };
  $('#btn-intro').addEventListener('click', () => Intro.play(afterIntro));
  // 從頭開始：按兩次才算數（網頁內嵌時跳不出確認視窗，所以自己做）
  $('#btn-reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = '真的要清除？再按一次';
      clearTimeout(b.t); b.t = setTimeout(() => { b.classList.remove('armed'); b.textContent = '從頭開始（清除進度）'; }, 3000);
      return;
    }
    clearTimeout(b.t); b.classList.remove('armed'); b.textContent = '從頭開始（清除進度）';
    if (USE_SAVE) Save.clear();
    try { localStorage.removeItem('lmtown.introSeen'); } catch (err) { /* 沒關係 */ }
    game = Town.newGame();
    renderTown();
    show('screen-start');
    toast('進度清除了，從頭開始！');
    Intro.play(afterIntro);
  });
  const isDebug = DEBUG;
  if (isDebug) {
    // 測試模式：沒指定就當成已經取好名字（&create 才會問）
    const q = new URLSearchParams(location.search);
    if (!q.has('create') && (!game.name || q.get('name'))) { game.name = q.get('name') || '小修'; game.gender = q.get('g') || game.gender || 'm'; }
  }
  if (isDebug ? /[?&]intro\b/.test(location.search) : !Intro.seen()) Intro.play(afterIntro);
  else if (!game.name || !game.gender) openCreate();
  else if (game.picks > 0) showLevelUp(); // 上次升級還沒選技能就關掉了

  document.addEventListener('keydown', e => {
    if (createOpen()) return;
    if (Intro.isOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); Intro.close(); }
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); Intro.next(); }
      return;
    }
    if (levelUpOpen() && evolving && /^[1-3]$/.test(e.key)) { e.preventDefault(); pickClass(Object.keys(Hero.CLASSES)[+e.key - 1]); return; }
    if (levelUpOpen() && /^[1-3]$/.test(e.key) && choices[+e.key - 1]) { e.preventDefault(); pickSkill(choices[+e.key - 1]); return; }
    if (!battle || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'p' || k === 'escape') { e.preventDefault(); setPaused(!paused); return; }
    if (paused || ending) return;
    const moves = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1], w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };
    if (moves[k]) { e.preventDefault(); moveSel(...moves[k]); return; }
    if (k === 'n') { e.preventDefault(); toggleNoteMode(); return; }
    if (/^[1-9]$/.test(k) && +k <= battle.n) { e.preventDefault(); enter(+k); return; }
    if (k === ' ' && mazeCtx) { e.preventDefault(); useUlt(); return; }
    const it = ITEMS.find(x => x.key === k);
    if (it && !mazeCtx) { e.preventDefault(); useItem(it.kind); }
  });

  // 切到別的分頁或 App 時自動暫停，避免被偷打
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

  // 開發測試用：網址加 ?debug 才看得到
  if (/[?&]debug\b/.test(location.search)) {
    window.__debug = { get battle() { return battle; }, get mazeUI() { return mazeUI; }, startMazeBattle, useUlt, get sel() { return sel; }, enter, useItem, startBattle, showDex, select,
      get game() { return game; }, set game(v) { game = v; renderTown(); }, renderTown,
      fastForward(sec) { for (let k = 0; k < sec * 10 && battle; k++) { const ev = battle.tick(0.1); if (ev.length) handleEvents(ev); } render(); } };
    // 截圖用：?debug&start=怪物編號&fill=先填幾格&ff=快轉秒數&dex=打倒過的怪物編號（逗號分隔）
    const q = new URLSearchParams(location.search);
    if (q.get('dex')) q.get('dex').split(',').forEach(i => { game.dex[MONSTERS[+i].id] = 1; });
    // gold=金幣&fix=修好幾間&quest=完成幾個任務&ended=1：直接造出某個小鎮進度
    if (q.get('gold')) game.gold = +q.get('gold');
    for (let i = 0; i < +(q.get('fix') || 0); i++) { game.dex[MONSTERS[i].id] = game.dex[MONSTERS[i].id] || 1; game.repaired[i] = true; }
    for (let i = 0; i < +(q.get('quest') || 0); i++) game.quests[i] = true;
    if (q.get('ended')) { game.ended = true; game.dex[MONSTERS[3].id] = 1; }
    // maze：解鎖亂碼迷宮
    if (q.has('maze') || q.has('mz')) game.maze.unlocked = true;
    // lv=等級&xp=經驗&skills=combo:2,heart:1&picks=待選次數：直接造出升級進度
    if (q.get('lv')) game.level = +q.get('lv');
    if (q.get('xp')) game.xp = +q.get('xp');
    if (q.get('skills')) q.get('skills').split(',').forEach(s => { const [id, n] = s.split(':'); game.skills[id] = +(n || 1); });
    // cls=knight／mage／rogue（直接當成已進化）、hat=&cloth=&weapon=（直接穿上）
    if (q.get('cls')) { game.cls = q.get('cls'); Avatar.giveClassSet(game, game.cls); }
    for (const slot of ['hat', 'cloth', 'weapon']) if (q.get(slot)) game.look[slot] = q.get(slot);
    Object.assign(window.__debug, { showLevelUp, showEvolve, showGear, show, showDrop });
    // own=cap,starry 直接擁有那些裝備；shards=碎片；screen=town／gear／settings／dex 直接跳到那個畫面
    if (q.get('own')) q.get('own').split(',').forEach(id => { if (Gear.GEAR[id]) Gear.give(game, id); });
    if (q.get('shards')) game.gear.shards = +q.get('shards');
    if (q.get('glv')) q.get('glv').split(',').forEach(s => { const [id, n] = s.split(':'); game.gear.lv[id] = +(n || 1); });
    renderTown();
    if (q.get('picks')) { game.picks = +q.get('picks'); showLevelUp(); }
    if (q.get('dex') && !q.has('start')) showDex();
    // mz=幕,關：直接開一局並跳到那一關；mzpl=c_speed:2,k_power:1 帶外掛；mzch=8 充滿大招；mzgo=normal／elite／boss／rest／shop／event／reward 直接進那種房間
    // mzgold=金幣 mzhearts=心 mzdone=已過關數統計
    if (q.has('mz')) {
      const [a, f] = (q.get('mz') || '1,1').split(',').map(Number);
      const run = Maze.newRun(game.maze.meta);
      run.act = a || 1; run.floor = f || 1; run.starters = null;
      run.stats.floors = Maze.idxOf(run);
      if (q.get('mzpl')) q.get('mzpl').split(',').forEach(s => { const [id, n] = s.split(':'); if (Maze.byId[id]) run.plugins[id] = +(n || 1); });
      if (q.get('mzch')) run.charge = +q.get('mzch');
      if (q.get('mzgold')) run.gold = +q.get('mzgold');
      if (q.get('mzhearts')) run.hearts = +q.get('mzhearts');
      Maze.toPath(run);
      game.maze.run = run;
      const go = q.get('mzgo');
      if (go === 'reward') { run.phase = 'reward'; run.drops = { kind: 'elite', options: Maze.rollDrops(run, 'elite') }; mazeUI.open(false); }
      else if (go) { run.choices = [{ type: go }]; const t = Maze.enter(run, 0); if (t === 'normal' || t === 'elite' || t === 'boss') startMazeBattle(run); else mazeUI.open(false); }
      else mazeUI.open(false);
    }
    if (q.has('start')) {
      startBattle(+q.get('start'));
      if (battle) for (const i of battle.empties().slice(0, +(q.get('fill') || 0))) { select(i); enter(battle.solution[i]); }
      if (q.get('ff')) window.__debug.fastForward(+q.get('ff'));
    }
    const scr = q.get('screen');
    renderTown();
    if (scr === 'town') show('screen-town');
    else if (scr === 'gear') showGear();
    else if (scr === 'settings') show('screen-settings');
  }

  // ---------- 主迴圈 ----------
  let last = performance.now(), frameErrors = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try { // 任何一格動畫出錯都不能讓主迴圈停掉（停掉＝倒數與畫面全卡住）
    if (battle && !paused && !ending) {
      const events = battle.tick(dt);
      if (events.length) { handleEvents(events); renderBoard(); renderHud(); }
      renderTimer();
    }
    if (document.getElementById('screen-battle').classList.contains('active')) stage.draw(paused ? 0 : dt);
    } catch (err) { frameErrors++; if (frameErrors < 5) { console.error(err); showErr(err); } try { stage.reset(); } catch (e2) { /* 略過 */ } }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
