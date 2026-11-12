// 亂碼迷宮的畫面（裂縫入口、起始包、選路、掉落、休息站、商店、事件、結算）。
// 規則都在 maze.js；這裡只負責畫出來、把按鈕接到規則上，戰鬥本身交回 main.js。
(function (root) {
  'use strict';
  const M = () => root.Maze;
  const I = name => root.Icons.img(name);
  const ROOM_ICON = { normal: 'sword', elite: 'skull', rest: 'camp', shop: 'bag', event: 'qmark', boss: 'crown' };

  // ---------- 外掛說明泡泡（長按／滑鼠移上去）----------
  // 任何元素加 data-info="外掛id:目前等級,外掛id:目前等級"（沒有就填 0），就會有說明。
  function infoHtml(spec) {
    return spec.split(',').map(part => {
      const [id, l] = part.split(':'), p = root.Maze.byId[id];
      if (!p) return '';
      const cur = +l || 0, next = Math.min(root.Maze.MAXLV, cur + 1), f = root.Maze.FLOWS[p.flow];
      const lvl = cur >= root.Maze.MAXLV ? `Lv${cur}（滿級）` : cur ? `Lv${cur} → Lv${next}` : `新外掛 → Lv1`;
      const eff = (cur ? `<div>現在：${p.text(cur)}</div>` : '') + (cur < root.Maze.MAXLV ? `<div>${cur ? '升級後' : '效果'}：${p.text(next)}</div>` : '');
      const sets = root.Maze.SETS[p.flow];
      const setTxt = sets ? `<div class="mzi-set"><b style="color:${f.color}">${f.name}流派</b>：湊 2 個 ★ ${sets[2]}；湊 3 個 ★ ${sets[3]}</div>` : `<div class="mzi-set"><b style="color:${f.color}">${f.name}</b>：沒有套裝，單件就能用</div>`;
      return `<div class="mzi-one"><div class="mzi-name"><b>${p.name}</b>${p.rare ? ' <u>稀有</u>' : ''} <em>${lvl}</em></div>${eff}${setTxt}</div>`;
    }).join('');
  }
  let infoEl = null;
  function showInfo(el) {
    if (!infoEl) { infoEl = document.createElement('div'); infoEl.className = 'mz-info'; document.body.appendChild(infoEl); }
    infoEl.innerHTML = infoHtml(el.dataset.info);
    infoEl.style.display = 'block';
    const r = el.getBoundingClientRect(), w = infoEl.offsetWidth, h = infoEl.offsetHeight;
    const x = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2));
    const y = r.top - h - 8 >= 6 ? r.top - h - 8 : Math.min(window.innerHeight - h - 6, r.bottom + 8);
    infoEl.style.left = x + 'px'; infoEl.style.top = Math.max(6, y) + 'px';
  }
  function hideInfo() { if (infoEl) infoEl.style.display = 'none'; }
  // 在某個容器上掛一次，底下所有 data-info 元素共用（重畫內容也不用重掛）
  function bindInfo(box) {
    let timer = null, startX = 0, startY = 0, held = null;
    const clear = () => { clearTimeout(timer); timer = null; };
    box.addEventListener('pointerdown', e => {
      const el = e.target.closest('[data-info]');
      if (!el || e.pointerType === 'mouse') return;
      startX = e.clientX; startY = e.clientY; clear();
      timer = setTimeout(() => { held = el; showInfo(el); }, 400);
    });
    box.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) clear(); });
    const end = () => { clear(); if (held) { hideInfo(); setTimeout(() => { held = null; }, 450); } };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    // 長按放開後瀏覽器還是會送出 click：攔下來，才不會誤選掉落卡
    box.addEventListener('click', e => { if (held && held.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
    box.addEventListener('contextmenu', e => { if (e.target.closest('[data-info]')) e.preventDefault(); });
    box.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('[data-info]');
      if (el) showInfo(el);
    });
    box.addEventListener('pointerout', e => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('[data-info]');
      if (el && !el.contains(e.relatedTarget)) hideInfo();
    });
  }

  function create(api) {
    const $ = s => document.querySelector(s);
    let lastSummary = null; // 這局剛結算的內容（只在畫面上顯示一次）

    const game = () => api.game();
    const run = () => game().maze.run;
    const save = () => api.save();
    const esc = api.esc;

    // ---------- 共用元件 ----------
    function plugChip(id, level) {
      const p = M().byId[id], f = M().FLOWS[p.flow];
      return `<span class="mzp${p.rare ? ' rare' : ''}" style="--fc:${f.color}" data-info="${id}:${level}"><i>${f.name}</i><b>${p.name}</b><em>Lv${level}</em></span>`;
    }
    function chips(r) {
      const own = M().owned(r);
      return own.length ? own.map(p => plugChip(p.id, M().lv(r, p.id))).join('') : '<span class="mz-none">還沒有外掛</span>';
    }
    function setsHtml(r) {
      return M().setStatus(r).map(s => {
        const f = M().FLOWS[s.flow];
        const tip = s.active.length ? s.active.map(t => `<small>★ ${t}</small>`).join('') : `<small>湊 2 個有套裝效果</small>`;
        return `<span class="mzs${s.count >= 2 ? ' on' : ''}" style="--fc:${f.color}"><b>${f.name} ${s.count}/3</b>${tip}</span>`;
      }).join('');
    }
    function progress(r) {
      const idx = M().idxOf(r);
      let out = '';
      for (let i = 0; i < 15; i++) {
        const cls = ['mzc', i < idx ? 'done' : '', i === idx && r.phase !== 'over' ? 'cur' : '', i % 5 === 4 ? 'boss' : '', i % 5 === 0 && i ? 'gap' : ''].filter(Boolean).join(' ');
        out += `<i class="${cls}"></i>`;
      }
      return `<div class="mz-prog">${out}</div>`;
    }
    function head(r) {
      const hearts = [];
      for (let i = 0; i < r.maxHearts; i++) hearts.push(I(i < r.hearts ? 'heart' : 'heartEmpty'));
      return `<div class="mz-head">
        ${progress(r)}
        <div class="mz-stat"><b>第 ${r.act} 幕・${r.floor}/5 關</b><span class="mz-hearts">${hearts.join('')}</span><span class="gold">${I('coin')} ${r.gold}</span></div>
        <div class="mz-plugs">${chips(r)}</div>
        <div class="mz-sets">${setsHtml(r)}</div>
      </div>`;
    }
    const btn = (cls, act, label, data) => `<button class="btn ${cls}" data-act="${act}" ${data || ''}>${label}</button>`;

    // ---------- 裂縫入口 ----------
    function riftHtml() {
      const m = game().maze, r = m.run;
      const rows = Object.entries(M().META).map(([id, d]) => {
        const have = m.meta[id] || 0, maxed = have >= d.max;
        return `<div class="mz-meta"><div><b>${d.name}</b> <small>${have}/${d.max}</small><br><small>${d.text}</small></div>
          ${btn('sbtn repair', 'meta', maxed ? '已滿' : `${I('shard')} ${d.cost}`, `data-id="${id}"${maxed ? ' disabled' : ''}`)}</div>`;
      }).join('');
      const best = m.best.floors ? `最遠打到第 ${m.best.floors} 關｜通關 ${m.best.clears} 次` : '還沒有紀錄';
      return `<h2 class="title mz-title">${I('rift')} 亂碼裂縫</h2>
        <p class="lead mz-lead">整條街修好之後，廣場裂開了一道縫。走進去，每次都是不同的路。</p>
        <div class="mz-box"><div class="mz-shards">${I('shard')} 亂碼碎片 <b>${m.shards}</b></div><p class="shop-note">${best}</p></div>
        <div class="mz-box"><h3>碎片商店（永久加成）</h3>${rows}</div>
        <div class="menu">
          ${r ? btn('btn-main', 'resume', '繼續這一局') : btn('btn-main', 'newrun', '走進裂縫')}
          ${r ? btn('btn-small mz-abandon', 'abandon', '放棄這一局（結算碎片）') : ''}
          ${btn('btn-sub', 'town', '回小鎮')}
        </div>`;
    }

    // ---------- 起始包 ----------
    function startHtml(r) {
      const cards = r.starters.map((id, k) => {
        const p = M().PACKS[id];
        return `<button class="btn mz-card pack ${id}" data-act="pack" data-id="${id}" data-info="${Object.keys(p.plugins).map(k => k + ':0').join(',')}" style="--fc:${M().FLOWS[id].color}">
          <span class="mz-ico">${I(id === 'coin' ? 'coin' : id === 'crit' ? 'bomb' : id === 'prime' ? 'star' : 'sword')}</span>
          <span class="lu-body"><b>${p.name}</b><small>${p.text}</small></span></button>`;
      }).join('');
      return `${head(r)}<p class="lu-title mz-sub">選一個起始包</p><p class="lu-sub">之後打贏會掉外掛，同流派湊 2、3 個有套裝效果</p><div class="lu-cards">${cards}</div>`;
    }

    // ---------- 選路 ----------
    function pathHtml(r) {
      let cards;
      if (r.phase === 'battle') {
        const t = r.node.type;
        cards = `<button class="btn mz-card room ${t}" data-act="fight">
          <span class="mz-ico">${I(ROOM_ICON[t])}</span><span class="lu-body"><b>重打這一關：${M().ROOMS[t].name}</b><small>上次打到一半離開了，這一關要重打（不能重新選路）</small></span></button>`;
      } else {
        cards = r.choices.map((c, i) => {
          const d = M().ROOMS[c.type];
          return `<button class="btn mz-card room ${c.type}" data-act="go" data-i="${i}">
            <span class="mz-ico">${I(ROOM_ICON[c.type])}</span><span class="lu-body"><b>${d.name}</b><small>${d.text}</small></span></button>`;
        }).join('');
      }
      return `${head(r)}<p class="lu-title mz-sub">選一條路</p><div class="lu-cards">${cards}</div>${btn('btn-small mz-leave', 'rift', '回裂縫入口（這局會保留）')}`;
    }

    // ---------- 掉落 ----------
    function rewardHtml(r) {
      const d = r.drops;
      const cards = d.options.map((o, i) => {
        const p = M().byId[o.id], f = M().FLOWS[p.flow];
        return `<button class="btn mz-card drop${p.rare ? ' rare' : ''}" data-act="drop" data-i="${i}" data-info="${o.id}:${o.from}" style="--fc:${f.color}">
          <span class="mz-flow">${f.name}${p.rare ? '・稀有' : ''}</span>
          <span class="lu-body"><b>${p.name}</b><small>${p.text(o.to)}</small></span>
          <span class="lu-lv">${o.from ? `升到 Lv ${o.to}` : '新外掛'}<i>${o.to}/${M().MAXLV}</i></span></button>`;
      }).join('') || '<p class="shop-note">所有外掛都滿級了！</p>';
      const free = r.rerolls > 0;
      return `${head(r)}<p class="lu-title mz-sub">${I('star')} 打贏了！選一個外掛</p><p class="lu-sub">${d.kind === 'boss' ? '幕王' : d.kind === 'elite' ? '精英怪' : '戰利品'}掉落，也可以都不要（長按外掛看說明）</p>
        <div class="lu-cards">${cards}</div>
        <div class="mz-row">${btn('btn-small', 'reroll', free ? `重抽（免費券 ×${r.rerolls}）` : `重抽 ${I('coin')}10`)}${btn('btn-small', 'skip', '都不要')}</div>`;
    }

    // ---------- 存檔營火（休息站）----------
    function restHtml(r) {
      const up = M().upgradeable(r);
      const forge = up.length ? up.map(p => btn('btn mz-forge', 'forge', `${p.name} Lv${M().lv(r, p.id)} → Lv${M().lv(r, p.id) + 1}`, `data-id="${p.id}" data-info="${p.id}:${M().lv(r, p.id)}" style="--fc:${M().FLOWS[p.flow].color}"`)).join('') : '<p class="shop-note">還沒有可以鍛造的外掛</p>';
      return `${head(r)}<p class="lu-title mz-sub">${I('camp')} 存檔營火</p><p class="lu-sub">營火旁，只能選一件事</p>
        <div class="mz-box">${btn('btn-main', 'heal', `補 1 顆心 ${I('heart')}`, r.hearts >= r.maxHearts ? 'disabled' : '')}</div>
        <div class="mz-box"><h3>或者鍛造一個外掛</h3><div class="mz-forges">${forge}</div></div>
        ${btn('btn-small mz-leave', 'finish', '直接離開')}`;
    }

    // ---------- 商店 ----------
    function shopHtml(r) {
      const s = r.shop;
      const disc = M().shopDiscount(r) < 1 ? '<p class="shop-note">金幣流 3 件套：全場 7 折！</p>' : '';
      const items = s.items.map((it, i) => {
        const p = M().byId[it.id], f = M().FLOWS[p.flow], cur = M().lv(r, it.id);
        const dead = it.sold || cur >= M().MAXLV;
        return `<div class="mz-meta${it.sold ? ' sold' : ''}" data-info="${it.id}:${cur}" style="--fc:${f.color}"><div><b>${p.name}</b>${p.rare ? ' <small class="rare-t">稀有</small>' : ''} <small>${f.name}</small><br><small>${p.text(cur + 1)}${cur ? `（升到 Lv${cur + 1}）` : ''}</small></div>
          ${btn('sbtn repair', 'buy', it.sold ? '已買' : `${I('coin')} ${M().shopPrice(r, i)}`, `data-i="${i}"${dead ? ' disabled' : ''}`)}</div>`;
      }).join('');
      return `${head(r)}<p class="lu-title mz-sub">${I('bag')} 商店</p>${disc}
        <div class="mz-box">${items}<div class="mz-meta"><div><b>補 1 顆心</b><br><small>目前 ${r.hearts}/${r.maxHearts}</small></div>
          ${btn('sbtn repair', 'buyheal', r.shop.healSold ? '已買' : `${I('coin')} ${M().shopHealPrice(r)}`, r.shop.healSold || r.hearts >= r.maxHearts ? 'disabled' : '')}</div></div>
        ${btn('btn-main', 'finish', '離開商店')}`;
    }

    // ---------- 事件 ----------
    const EVENT_TEXT = {
      merchant: { title: '神秘商人', text: '路中間站著一位披著斗篷的商人，斗篷底下露出一截像素化的尾巴。「用 1 顆心，換一個好東西？」', opts: [['trade', '給 1 顆心，換一個稀有外掛']] },
      spring: { title: '亂碼泉水', text: '一座冒著泡的泉水，水面上漂著「0」跟「1」。看起來可以喝。看起來。', opts: [['drink', '喝（一半機率好事，一半機率壞事）']] },
      lost: { title: '失物招領', text: '路邊有個箱子，旁邊貼了張紙：「失主請來認領。逾期歸路過的修復師所有。」', opts: [['gold', '拿走 35 金幣'], ['box', '打開箱子（隨機升級一個外掛）']] },
      gamble: { title: '亂碼賭桌', text: '荷官是一隻戴墨鏡的史萊姆。「押 20 金幣，一半機率拿回 60，很公平。」牠推了推墨鏡。', opts: [['bet', `押 20 金幣`]] },
    };
    function eventHtml(r) {
      const ev = r.event, d = EVENT_TEXT[ev.id];
      if (ev.done) return `${head(r)}<p class="lu-title mz-sub">${I('qmark')} ${d.title}</p><p class="mz-evtext">${esc(ev.msg)}</p>${btn('btn-main', 'evdone', '繼續往前')}`;
      const opts = d.opts.map(([c, label]) => btn('btn-main mz-evbtn', 'event', label, `data-c="${c}"`)).join('');
      return `${head(r)}<p class="lu-title mz-sub">${I('qmark')} ${d.title}</p><p class="mz-evtext">${d.text}</p><div class="menu">${opts}${btn('btn-sub', 'event', '離開', 'data-c="leave"')}</div>`;
    }

    // ---------- 結算 ----------
    function overHtml() {
      const s = lastSummary;
      if (!s) return `<h2 class="title mz-title">${I('rift')} 這局結束了</h2><div class="menu">${btn('btn-main', 'rift', '回裂縫入口')}</div>`;
      const plugs = Object.keys(s.plugins).map(id => plugChip(id, s.plugins[id])).join('') || '<span class="mz-none">沒有外掛</span>';
      return `<h2 class="title mz-title">${s.won ? '通關了！' : '這局結束了'}</h2>
        <p class="lead mz-lead">${s.won ? '迷宮守門怪倒下的那一刻，裂縫輕輕地合上了。' : '亂碼把路又重新排了一遍。下次會不一樣。'}</p>
        <dl class="stats"><dt>過了幾關</dt><dd>${s.floors} / 15</dd><dt>精英怪</dt><dd>${s.elites}</dd><dt>幕王</dt><dd>${s.bosses}</dd><dt>亂碼碎片</dt><dd>${I('shard')} +${s.shards}</dd></dl>
        <div class="mz-box"><h3>這局的外掛</h3><div class="mz-plugs">${plugs}</div></div>
        <div class="menu">${btn('btn-main', 'rift', '回裂縫入口（用碎片買加成）')}</div>`;
    }

    // ---------- 畫面切換 ----------
    function view() {
      const r = run();
      if (!r || lastSummary && !r) return riftHtml();
      switch (r.phase) {
        case 'start': return startHtml(r);
        case 'path': case 'battle': return pathHtml(r);
        case 'reward': return rewardHtml(r);
        case 'rest': return restHtml(r);
        case 'shop': return shopHtml(r);
        case 'event': return eventHtml(r);
        default: return overHtml();
      }
    }

    let atRift = true; // true：顯示入口畫面（即使有進行中的一局）
    function render() {
      const r = run();
      $('#mz-body').innerHTML = (atRift || (!r && !lastSummary)) ? riftHtml() : (!r ? overHtml() : view());
      window.scrollTo(0, 0);
    }
    function open(toRift) {
      atRift = toRift !== false;
      render();
      api.show('screen-maze');
    }

    // 打完一局（輸或通關）：結算碎片
    function doSettle() {
      lastSummary = M().settle(game());
      atRift = false;
    }
    function finishRoom() {
      const r = run();
      M().advance(r);
      if (r.phase === 'over') doSettle();
      save(); render();
    }

    // 戰鬥結束（main.js 呼叫）
    function onBattleEnd(won, battle) {
      const r = run();
      const res = M().endBattle(r, won, battle);
      if (res.lost) { doSettle(); save(); atRift = false; render(); api.show('screen-maze'); api.sound('lose'); return; }
      save(); atRift = false; render(); api.show('screen-maze');
      api.sound('win');
      api.toast(`打贏了！+${res.reward} 金幣`); // 普通怪已直接進下一關的選路，精英、幕王停在 3 選 1
    }

    // ---------- 按鈕 ----------
    $('#mz-body').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act, g = game(), r = run();
      if (act === 'town') { api.goTown(); return; }
      if (act === 'rift') { atRift = true; render(); return; }
      if (act === 'newrun') { M().startRun(g); lastSummary = null; atRift = false; save(); render(); return; }
      if (act === 'resume') { atRift = false; render(); return; }
      if (act === 'abandon') {
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '真的放棄？再按一次'; return; }
        r.phase = 'over'; r.won = false; doSettle(); atRift = false; save(); render(); return;
      }
      if (act === 'meta') {
        const res = M().buyMeta(g, b.dataset.id);
        if (!res.ok) { api.toast(res.reason === 'shards' ? `碎片不夠，還差 ${res.short}` : '已經買滿了'); return; }
        api.sound('coin'); save(); render(); return;
      }
      if (!r) return;
      api.sound('tap');
      if (act === 'pack') { M().applyStarter(r, b.dataset.id); save(); render(); return; }
      if (act === 'go') {
        const t = M().enter(r, +b.dataset.i);
        save(); render();
        if (t === 'normal' || t === 'elite' || t === 'boss') api.startBattle(r);
        return;
      }
      if (act === 'fight') { api.startBattle(r); return; }
      if (act === 'drop') {
        const o = r.drops.options[+b.dataset.i], before = M().setStatus(r).map(s => s.active.length).join();
        if (M().takeDrop(r, +b.dataset.i)) {
          api.sound('plugin');
          if (M().setStatus(r).map(s => s.active.length).join() !== before) { api.sound('setbonus'); api.toast('套裝效果觸發了！'); }
          else api.toast(`拿到了：${M().byId[o.id].name}`);
          finishRoom();
        }
        return;
      }
      if (act === 'skip') { finishRoom(); return; }
      if (act === 'reroll') {
        const res = M().rerollDrops(r);
        if (!res.ok) { api.toast('金幣不夠（重抽要 10 金幣）'); return; }
        save(); render(); return;
      }
      if (act === 'heal') { if (M().restHeal(r).ok) { api.sound('heal'); finishRoom(); } return; }
      if (act === 'forge') { if (M().forge(r, b.dataset.id).ok) { api.sound('plugin'); finishRoom(); } return; }
      if (act === 'buy') {
        const res = M().buyItem(r, +b.dataset.i);
        if (!res.ok) { api.toast(res.reason === 'gold' ? `金幣不夠，還差 ${res.short}` : '不能買'); return; }
        api.sound('coin'); save(); render(); return;
      }
      if (act === 'buyheal') {
        const res = M().buyHeal(r);
        if (!res.ok) { api.toast(res.reason === 'gold' ? `金幣不夠，還差 ${res.short}` : '不能買'); return; }
        api.sound('heal'); save(); render(); return;
      }
      if (act === 'finish') { finishRoom(); return; }
      if (act === 'event') {
        const res = M().eventAct(r, b.dataset.c);
        if (!res.ok) { api.toast(res.reason === 'hearts' ? '只剩 1 顆心，不能換' : res.reason === 'gold' ? '金幣不夠' : '現在不能這樣做'); return; }
        api.sound(r.event.good === false ? 'wrong' : 'plugin');
        if (b.dataset.c === 'leave') { finishRoom(); return; }
        save(); render(); return;
      }
      if (act === 'evdone') { finishRoom(); return; }
    });

    bindInfo($('#mz-body'));
    // 正在看通關畫面（讓 main.js 換結局曲）
    const ending = () => { const r = run(); return !atRift && (r ? !!r.won : !!(lastSummary && lastSummary.won)); };
    return { open, render, onBattleEnd, chips, setsHtml, plugChip, ending };
  }

  root.MazeUI = { create, bindInfo, infoHtml };
})(typeof window !== 'undefined' ? window : globalThis);
