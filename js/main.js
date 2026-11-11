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
  let mazeCtx = null; // 正在打亂碼迷宮的一場戰鬥：{ run }；主線戰鬥是 null
  Maze.normalize(game);

  // 筆記模式切換
  function renderNoteMode() {
    const nb = document.getElementById('btn-note');
    if (nb) nb.classList.toggle('on', noteMode);
    padBtns.forEach(b => b.classList.toggle('noting', noteMode));
  }
  function toggleNoteMode() { noteMode = !noteMode; renderNoteMode(); }
  let cells = [], padBtns = [], itemBtns = {};
  const stage = new Stage($('#stage'));

  // 玩家輸入的名字放進畫面前先轉義
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    // 背景音樂跟著畫面換：戰鬥（魔王另一首）、結果畫面先停、其他都是小鎮
    Sound.music(id === 'screen-battle' ? (battle && battle.monster.boss ? 'boss' : 'battle')
      : id === 'screen-result' ? null : 'town');
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
    battle = new Battle(mazeRun
      ? Object.assign({ puzzle }, Maze.battleOpts(mazeRun, mazeRun.node))
      : Object.assign({ puzzle, monster, inventory: game.inventory }, Hero.battleOpts(game)));
    mazeCtx = mazeRun ? { run: mazeRun } : null;
    sel = battle.grid.indexOf(0);
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
    render();
    setTimeout(() => popup(`招式：${battle ? battle.monster.moveName : monster.moveName}`, 'info', 'monster'), 400);
  }

  // ---------- 亂碼迷宮：大招按鈕、外掛列、特殊格 ----------
  function buildUlt() {
    const box = $('#ult-wrap');
    box.innerHTML = `<button id="btn-ult" class="btn ult"><span class="ult-fill"></span><span class="ult-label"></span><span class="key">空白鍵</span></button>`;
    $('#btn-ult').addEventListener('click', useUlt);
  }
  function renderChips() {
    const r = mazeCtx.run, own = Maze.owned(r);
    const sets = Maze.setStatus(r).filter(s => s.count > 0).map(s =>
      `<span class="mzs${s.count >= 2 ? ' on' : ''}" style="--fc:${Maze.FLOWS[s.flow].color}">${Maze.FLOWS[s.flow].name} ${s.count}/3${s.active.length ? ' ★'.repeat(s.active.length) : ''}</span>`).join('');
    $('#mz-chips').innerHTML = sets + own.map(p => `<span class="mzp" style="--fc:${Maze.FLOWS[p.flow].color}"><b>${p.name}</b><em>${Maze.lv(r, p.id)}</em></span>`).join('');
    $('#mz-chips').title = Maze.setStatus(r).map(s => s.active.join('、')).filter(Boolean).join('；');
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
    if (x.small) { popup(`小爆擊 +${x.small}`, 'crit', 'monster'); boardPop(`小爆擊 +${x.small}`, 'crit', r.idx); }
    if (x.storm) { popup(`落雷 +${x.storm}！`, 'crit', 'monster'); Sound.play('crit'); }
    if (x.goldCell) boardPop('黃金格 ×3', 'crit', r.idx);
    if (x.chest) { boardPop(`${Icons.img('coin')} +${x.chest}`, 'coin', r.idx); Sound.play('coin'); }
    if (x.bomb) {
      Sound.play('bomb');
      boardPop(`炸彈 +${x.bomb.damage}`, 'crit', r.idx);
      if (x.bomb.cells) { flashCells(x.bomb.cells, 'flash-item'); if (x.bomb.crits) showCrits(x.bomb.crits, x.bomb.critDamage); }
    }
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
      b.addEventListener('click', () => select(i));
      board.appendChild(b);
      cells.push(b);
    }
  }

  function buildPad() {
    const pad = $('#pad');
    pad.innerHTML = '';
    pad.style.gridTemplateColumns = `repeat(${battle.n}, 1fr) 1.2fr`;
    padBtns = [];
    for (let v = 1; v <= battle.n; v++) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = v;
      b.addEventListener('click', () => enter(v));
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
      el.classList.toggle('same', i !== sel && !!selVal && v === selVal);
      const sp = battle.special ? battle.special.get(i) : null;
      el.classList.toggle('sp-chest', sp === 'chest');
      el.classList.toggle('sp-bomb', sp === 'bomb');
      el.classList.toggle('sp-gold', sp === 'gold');
    }
    const counts = new Array(n + 1).fill(0);
    grid.forEach(v => counts[v]++);
    padBtns.forEach((b, k) => b.classList.toggle('done', counts[k + 1] >= n));
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
    $('#mon-move').textContent = battle.monster.phases
      ? `第 ${battle.phase + 1} 段：${battle.phaseDef().name}`
      : battle.monster.moveName;
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

  function render() { renderBoard(); renderHud(); renderTimer(); }

  // 盤面邊框閃色：眼睛盯著數字時，用餘光就知道戰況（綠＝填對、金＝爆擊、紅＝被打）
  function boardFx(color, ms) {
    const b = $('#board');
    b.style.setProperty('--fx', color);
    b.classList.add('fx');
    clearTimeout(boardFx.t);
    boardFx.t = setTimeout(() => b.classList.remove('fx'), ms || 450);
  }

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
  function enter(v) {
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
      if (r.wagered) { // 賭徒晶片：扣金幣代替扣心
        boardPop(`${Icons.img('coin')} -${r.wagered}`, 'hurt', sel);
        popup(`-${r.wagered} ${Icons.img('coin')}`, 'hurt', 'hero');
      } else {
        stage.monsterAttack();
        setTimeout(() => hurtPopup(r), 170);
        boardHurt(r, sel);
      }
      if (r.reflected) setTimeout(() => popup(`${Icons.img('shield')} 反彈 -${r.reflected}`, 'dmg', 'monster'), 260);
    } else {
      // 填對：選取框留在原格，不自動跳下一格（煦恩指定）
      Sound.play(r.crits.length ? 'crit' : 'correct', r.combo);
      stage.heroAttack(r.crits.length > 0);
      if (!r.crits.length) boardFx('#46d28a', 350);
      if (r.unmasked) popup('揭穿假數字！', 'info', 'monster');
      setTimeout(() => popup('-' + r.damage, 'dmg', 'monster'), 220);
      boardPop('-' + r.damage, 'dmg', sel);
      showCrits(r.crits, r.critDamage);
      showExtras(r);
      if (r.chain) { // 法師「連鎖爆擊」
        setTimeout(() => {
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
      } else if (ev.type === 'uncover') {
        flashCells(ev.cells, 'flash-item');
      } else if (ev.type === 'fake') {
        Sound.play('cast');
        stage.cast(color);
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

  function finish(won) {
    ending = true;
    if (won) {
      setTimeout(() => stage.die(), 300);
    }
    setTimeout(() => showResult(won), won ? 1400 : 900);
  }

  function showResult(won) {
    if (mazeCtx) { // 亂碼迷宮：交給迷宮畫面處理（發金幣、掉外掛、結算）
      const b = battle;
      mazeCtx = null; battle = null;
      $('#items').classList.remove('hidden');
      mazeUI.onBattleEnd(won, b);
      return;
    }
    const m = battle.monster;
    const sec = Math.round(battle.elapsed);
    const time = `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
    let reward = 0, xp = 0, ups = 0, dropped = null, firstTime = false, ending = false, dailyRes = null;
    if (won) {
      reward = Hero.goldBonus(game, battle.holes * 2 + battle.maxCombo * 2);
      if (monsterIdx === 'daily') { game.gold += reward; dailyRes = Daily.recordWin(game, dailyDate, sec); }
      else ({ firstTime, ending } = Town.recordWin(game, monsterIdx, reward));
      xp = Hero.xpGain(game, battle.holes);
      ups = Hero.gainXp(game, xp);
      dropped = Hero.loot(game);
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
    const rows = [['用時', time], ['最高連擊', battle.maxCombo], ['填錯', battle.mistakes + ' 次']];
    if (won) rows.push(['金幣', '+' + reward], ['經驗', '+' + xp + (ups ? `（升到 Lv ${game.level}！）` : '')]);
    if (dailyRes) rows.push(['每日挑戰', dailyRes.again ? '今天已經領過獎勵了' : `+${dailyRes.gold} 金幣（連續 ${dailyRes.streak} 天）`]);
    if (dropped) rows.push(['撿到', `${Icons.img(ITEM_INFO[dropped].icon)} ${ITEM_INFO[dropped].name}`]);
    $('#result-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#btn-again').textContent = won ? '再打一場' : '重試';
    battle = null;
    Sound.play(won ? 'win' : 'lose');
    show('screen-result');
    if (game.picks > 0) setTimeout(showLevelUp, 500);
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
    const ready = Town.allRepaired(game);
    const card = document.createElement('div');
    card.className = 'shop-card ' + (game.ended ? 'st-done' : ready ? 'st-occupied' : 'st-locked');
    card.dataset.card = 3;
    card.innerHTML = `<div class="shop-head"><b>街尾廣場</b><span class="pill">${game.ended ? '整條街修好了' : ready ? '魔王出現了' : '還沒解鎖'}</span></div>` +
      (ready
        ? `<div class="shop-btns"><button class="btn sbtn fight boss" data-act="fight" data-m="${Town.BOSS}">${Icons.img('crown')} 挑戰${boss.name.replace(/（暫名）/, '')} 9×9</button></div>`
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
    face.width = 16; face.height = 20;
    Avatar.draw(face.getContext('2d'), heroLook(), 2, 6, { t: 0 });
    const eb = $('#btn-evolve');
    if (eb) eb.addEventListener('click', showEvolve);
  }

  // ---------- 進化：三選一職業 ----------
  function showEvolve() {
    if (!Hero.canEvolve(game)) return;
    $('#lu-title').innerHTML = `${Icons.img('star')} 進化的時候到了！`;
    $('#lu-sub').textContent = '選一個職業（選了就不能換）。職業裝會送進衣櫥。';
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
    if (!document.hidden && $('#screen-start').classList.contains('active')) paintStreet();
  }, 110);
  // 預設選到「下一步該去」的那間店
  function defaultShop() {
    for (let i = 0; i < Town.SHOPS.length; i++) {
      const st = Town.shopStatus(game, i);
      if (st === 'occupied' || st === 'repairable' || st === 'open') return i;
    }
    return Town.allRepaired(game) ? 3 : 0;
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

  // ---------- 衣櫥 ----------
  let trying = null; // 正在試穿、還沒買的 { slot, id }

  function wardrobeLook() {
    const look = heroLook();
    if (trying) look[trying.slot] = trying.id;
    return look;
  }

  function renderWardrobe() {
    Avatar.preview($('#wd-pic'), wardrobeLook(), 0);
    $('#wd-name').textContent = game.name || '修復師';
    $('#wd-gold').innerHTML = `${Icons.img('coin')} ${game.gold}`;
    const it = trying && Avatar.find(trying.slot, trying.id);
    $('#wd-try').textContent = it ? `試穿中：${it.name}` : '';
    const buy = $('#wd-buy');
    buy.classList.toggle('hidden', !it);
    if (it) buy.innerHTML = `買下 ${Icons.img('coin')}${it.price}`;

    $('#wd-slots').innerHTML = Object.keys(Avatar.ITEMS).map(slot => {
      const items = Avatar.ITEMS[slot].map(x => {
        const own = Avatar.owns(game, slot, x.id);
        const worn = game.look[slot] === x.id && !(trying && trying.slot === slot);
        const tryingThis = trying && trying.slot === slot && trying.id === x.id;
        let sub;
        if (worn) sub = '穿著中';
        else if (own) sub = '點一下換上';
        else if (x.cls) sub = `${Hero.CLASSES[x.cls].name}專屬`;
        else sub = `${Icons.img('coin')}${x.price}`;
        const cls = ['btn', 'wd-item', worn && 'worn', tryingThis && 'trying', !own && x.cls && 'locked'].filter(Boolean).join(' ');
        return `<button class="${cls}" data-slot="${slot}" data-id="${x.id}"><span>${x.name}</span><small>${sub}</small></button>`;
      }).join('');
      return `<div class="wd-slot"><h3>${Avatar.SLOT_NAME[slot]}</h3><div class="wd-items">${items}</div></div>`;
    }).join('');
  }

  function showWardrobe() { trying = null; renderWardrobe(); show('screen-wardrobe'); }

  $('#wd-slots').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    const slot = b.dataset.slot, id = b.dataset.id, it = Avatar.find(slot, id);
    if (Avatar.owns(game, slot, id)) {
      trying = null;
      Avatar.equip(game, slot, id);
      save();
    } else if (it.cls) {
      toast(`進化成${Hero.CLASSES[it.cls].name}才拿得到`);
      return;
    } else {
      trying = (trying && trying.slot === slot && trying.id === id) ? null : { slot, id };
    }
    renderWardrobe();
  });
  $('#wd-buy').addEventListener('click', () => {
    if (!trying) return;
    const it = Avatar.find(trying.slot, trying.id);
    const r = Avatar.buy(game, trying.slot, trying.id);
    if (!r.ok) { toast(r.reason === 'gold' ? `金幣不夠，還差 ${r.short}` : '現在不能買'); return; }
    Sound.play('coin');
    toast(`買了${it.name}，已經換上！`);
    trying = null;
    save();
    renderWardrobe();
  });
  $('#wd-rename').addEventListener('click', () => openCreate(renderWardrobe));
  $('#btn-wardrobe').addEventListener('click', showWardrobe);
  $('#btn-wd-back').addEventListener('click', goHome);

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
           <button class="btn sbtn pal-btn${game.follower === m.id ? ' on' : ''}" data-follow="${m.id}">${game.follower === m.id ? '跟著你中（點一下放回）' : '帶著走'}</button>`
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
  $('#btn-dex').innerHTML = `${Icons.img('book')} 怪物圖鑑`;
  $('#btn-wardrobe').innerHTML = `${Icons.img('shirt')} 衣櫥`;
  // 音效、音樂開關（小鎮和戰鬥畫面各一組，狀態共用）
  function renderSoundBtns() {
    document.querySelectorAll('.btn-sound').forEach(b => {
      b.innerHTML = Icons.img(Sound.isOn() ? 'soundOn' : 'soundOff');
      b.setAttribute('aria-label', Sound.isOn() ? '關掉音效' : '打開音效');
    });
    document.querySelectorAll('.btn-music').forEach(b => {
      b.innerHTML = Icons.img(Sound.isMusicOn() ? 'note' : 'noteOff');
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
  $('#btn-result-dex').innerHTML = `${Icons.img('book')} 新怪物收進圖鑑了！點這裡看看`;
  $('#btn-pause').innerHTML = Icons.img('pause');
  renderTown();
  $('#shops').addEventListener('click', townAction);
  $('#btn-dex').addEventListener('click', showDex);
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
      Avatar.draw(ctx, { gender: 'm' }, 3, 6, { tint: '#2a2c44', tintAmt: 0.9 });
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
    Object.assign(window.__debug, { showLevelUp, showEvolve, showWardrobe });
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
  }

  // ---------- 主迴圈 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (battle && !paused && !ending) {
      const events = battle.tick(dt);
      if (events.length) { handleEvents(events); renderBoard(); renderHud(); }
      renderTimer();
    }
    if (document.getElementById('screen-battle').classList.contains('active')) stage.draw(paused ? 0 : dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
