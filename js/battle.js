// 戰鬥規則（不碰畫面，方便測試）。
// 填對＝打怪（連擊加成），填錯＝被反擊扣 1 顆心；
// 怪物攻擊倒數 40 秒，每填對一格往回退 15%；填滿一列／一行／一宮＝爆擊。
// 怪物招式：cover（黏液蓋住數字）、fake（偷放假數字）、attackTime（攻擊較快）；
// 魔王用 phases 分段，每打掉一段換一招。
(function (root) {
  'use strict';

  const RULES = {
    base: 10,          // 填對一格的基本傷害
    crit: 30,          // 每完成一列／行／宮的爆擊傷害
    unmask: 20,        // 揭穿假數字的額外傷害
    attackTime: 40,    // 怪物攻擊倒數（秒）
    rollback: 0.15,    // 填對一格，倒數往回退的比例
    freeze: 10,        // 凍結秒數
    killAt: 0.9,       // 怪物血量 = 零失誤解完整盤的總傷害 × 這個比例（約填到九成倒下）
    maxHearts: 3,
    comboStep: 0.25,   // 連擊每格加成（技能「連擊大師」會加）
    critBonus: 0,      // 爆擊額外比例（技能「爆擊強化」）
    attackBonus: 0,    // 攻擊倒數多幾秒（技能「冷靜」）
    reflect: 0,        // 填錯時反彈給怪物的傷害（騎士技能「反彈」）
    chainReveal: 0,    // 爆擊時順便揭開幾格（法師技能「連鎖爆擊」）
    itemSave: 0,       // 用道具不消耗的機率（盜賊技能「妙手」）
  };

  class Battle {
    constructor(opts) {
      const p = opts.puzzle;
      this.n = p.n; this.br = p.br; this.bc = p.bc;
      this.solution = p.solution;
      this.grid = p.puzzle.slice();
      this.rng = opts.rng || Math.random;
      // 技能「開場偷看」：開場先替玩家填好幾格（當成題目給的）
      for (let k = 0; k < (opts.reveal || 0); k++) {
        const e = []; this.grid.forEach((v, i) => { if (!v) e.push(i); });
        if (e.length <= 1) break;
        const i = e[Math.floor(this.rng() * e.length)];
        this.grid[i] = this.solution[i];
      }
      this.given = this.grid.map(v => v !== 0);
      this.holes = this.grid.filter(v => !v).length;
      this.monster = opts.monster || { name: '亂碼' };
      this.rules = Object.assign({}, RULES, opts.rules);
      this.maxHp = this._calcHp();
      this.hp = this.maxHp;
      this.maxHearts = opts.maxHearts || this.rules.maxHearts;
      this.hearts = this.maxHearts;
      this.freezeLeft = 0;
      this.inventory = opts.inventory || { scan: 0, bomb: 0, freeze: 0, heal: 0 };
      this.combo = 0; this.maxCombo = 0; this.mistakes = 0; this.elapsed = 0;
      this.state = 'fighting'; // fighting / won / lost
      this.shield = opts.shield || 0;  // 技能「護盾」：還能擋下幾次扣心
      this.covers = [];          // 被黏液蓋住的格子（先蓋的在前面）
      this.fakes = new Map();    // 假數字：格子 → 數字
      this.notes = new Map();    // 筆記：格子 → Set(候選數字)，只是玩家的備忘，不算填答
      this.avoid = -1;           // 畫面告訴規則：玩家正選著哪格（不在這格放假數字）
      this.events = [];
      this.phase = 0;
      this.timer = null;
      this._applyPhase();
      this.timer += opts.firstAttackBonus || 0; // 方塊跟班：第一次攻擊晚一點來
    }

    // 零失誤一路連擊填完的總傷害（含每組列／行／宮一次爆擊），乘上 killAt
    _calcHp() {
      const r = this.rules;
      let total = 0;
      for (let k = 1; k <= this.holes; k++) total += r.base * (1 + 0.25 * Math.min(k - 1, 4));
      const seen = new Set();
      this.grid.forEach((v, i) => {
        if (v) return;
        for (const u of this.units(i)) seen.add(u.type + u.cells[0]);
      });
      total += seen.size * r.crit * 2;
      return Math.max(30, Math.round(total * r.killAt / 10) * 10);
    }

    // ---------- 招式與階段 ----------
    phaseDef() {
      const m = this.monster;
      if (m.phases) return m.phases[this.phase];
      return { moves: m.moves || {}, attackTime: m.attackTime };
    }

    _applyPhase() {
      const d = this.phaseDef();
      this.moves = d.moves || {};
      this.attackTime = (d.attackTime || this.rules.attackTime) + this.rules.attackBonus;
      this.timer = this.timer == null ? this.attackTime : Math.min(this.timer, this.attackTime);
      this.moveClock = {};
      for (const k in this.moves) this.moveClock[k] = this.moves[k].every;
    }

    drainEvents() { const e = this.events; this.events = []; return e; }

    _pick(list) { return list[Math.floor(this.rng() * list.length)]; }

    _doMove(kind, cfg) {
      if (kind === 'cover') {
        const room = (cfg.max || 3) - this.covers.length;
        const cand = [];
        this.grid.forEach((v, i) => { if (v && !this.covers.includes(i)) cand.push(i); });
        const cells = [];
        for (let k = 0; k < Math.min(cfg.count || 1, room); k++) {
          if (!cand.length) break;
          const i = cand.splice(Math.floor(this.rng() * cand.length), 1)[0];
          cells.push(i); this.covers.push(i);
        }
        if (cells.length) this.events.push({ type: 'cover', cells });
      } else if (kind === 'fake') {
        if (this.fakes.size >= (cfg.max || 2)) return;
        const cand = this.empties().filter(i => !this.fakes.has(i) && i !== this.avoid);
        if (!cand.length) return;
        const idx = this._pick(cand);
        // 盡量挑「看起來不衝突」的假數字，比較騙得到人
        const seen = new Set();
        for (const u of this.units(idx)) for (const j of u.cells) {
          if (this.grid[j]) seen.add(this.grid[j]);
          if (this.fakes.has(j)) seen.add(this.fakes.get(j));
        }
        const all = Array.from({ length: this.n }, (_, k) => k + 1).filter(v => v !== this.solution[idx]);
        const sneaky = all.filter(v => !seen.has(v));
        const value = this._pick(sneaky.length ? sneaky : all);
        this.fakes.set(idx, value);
        this.events.push({ type: 'fake', idx, value });
      }
    }

    // ---------- 共用 ----------
    units(idx) { return root.Sudoku.unitsOf(idx, this.n, this.br, this.bc); }
    empties() { const out = []; this.grid.forEach((v, i) => { if (!v) out.push(i); }); return out; }

    // 畫面上顯示的數字：蓋住的看不到、假數字看起來像真的
    shown(i) {
      if (this.covers.includes(i)) return 0;
      return this.grid[i] || this.fakes.get(i) || 0;
    }

    // 連擊倍率：第 1 格 1 倍，之後每格 +0.25，最多 2 倍
    multiplier() { return 1 + this.rules.comboStep * Math.min(Math.max(this.combo - 1, 0), 4); }

    // 放進一格，回傳這一格完成了哪些列／行／宮
    _place(idx) {
      this.grid[idx] = this.solution[idx];
      this.fakes.delete(idx);
      // 筆記：這格的筆記清掉，同列／行／宮的同數字筆記也擦掉
      this.notes.delete(idx);
      const v = this.grid[idx];
      for (const u of this.units(idx)) for (const j of u.cells) { const s = this.notes.get(j); if (s) s.delete(v); }
      return this.units(idx).filter(u => u.cells.every(i => this.grid[i]));
    }

    _hurt(cause) {
      if (this.shield > 0) { this.shield--; return { heartLost: false, shielded: true, cause, lost: false }; }
      this.hearts = Math.max(0, this.hearts - 1);
      if (this.hearts === 0) this.state = 'lost';
      return { heartLost: true, cause, lost: this.state === 'lost' };
    }

    _damage(x) {
      this.hp = Math.max(0, this.hp - x);
      const ph = this.monster.phases;
      if (ph && this.hp > 0) {
        const k = Math.min(ph.length - 1, Math.floor((1 - this.hp / this.maxHp) * ph.length));
        if (k > this.phase) {
          this.phase = k;
          this._applyPhase();
          this.events.push({ type: 'phase', phase: k });
        }
      }
    }

    _checkEnd() {
      if (this.state === 'fighting' && (this.hp <= 0 || this.grid.every(v => v))) {
        this.state = 'won'; this.hp = 0;
      }
      return { won: this.state === 'won' };
    }

    // 填對一格就擦掉最早的一塊黏液
    _wipeCover() {
      if (!this.covers.length) return;
      const c = this.covers.shift();
      this.events.push({ type: 'uncover', cells: [c] });
    }

    // ---------- 玩家動作 ----------
    // 筆記模式：記下或擦掉一個候選數字（不扣心、不影響連擊和倒數）
    toggleNote(idx, v) {
      if (this.state !== 'fighting' || this.grid[idx]) return { ignored: true };
      let s = this.notes.get(idx);
      if (!s) { s = new Set(); this.notes.set(idx, s); }
      const added = !s.has(v);
      if (added) s.add(v); else s.delete(v);
      if (!s.size) this.notes.delete(idx);
      return { ok: true, added };
    }

    input(idx, v) {
      if (this.state !== 'fighting' || this.grid[idx]) return { ignored: true };
      if (v !== this.solution[idx]) {
        this.combo = 0; this.mistakes++;
        // 技能「反彈」：填錯時怪物也受傷（最多打到剩 1 滴血，不會靠填錯打贏）
        const reflected = Math.max(0, Math.min(this.rules.reflect, this.hp - 1));
        if (reflected) this._damage(reflected);
        return Object.assign({ ok: false, idx, value: v, reflected }, this._hurt('wrong'));
      }
      const unmasked = this.fakes.has(idx);
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const mult = this.multiplier();
      const crits = this._place(idx);
      const damage = Math.round(this.rules.base * mult) + (unmasked ? this.rules.unmask : 0);
      const critDamage = crits.length * Math.round(this.rules.crit * (1 + this.rules.critBonus) * mult);
      this.timer = Math.min(this.attackTime, this.timer + this.attackTime * this.rules.rollback);
      this._wipeCover();
      this._damage(damage + critDamage);
      // 技能「連鎖爆擊」：爆擊時順便揭開幾格（揭開的格子也可能再爆擊，但不會再連鎖）
      let chain = null;
      if (crits.length && this.rules.chainReveal > 0 && this.hp > 0) {
        const e = this.empties(), cells = [];
        for (let k = 0; k < this.rules.chainReveal && e.length; k++) cells.push(e.splice(Math.floor(this.rng() * e.length), 1)[0]);
        if (cells.length) chain = Object.assign({ cells }, this._autoFill(cells));
      }
      return Object.assign({ ok: true, idx, value: v, damage, critDamage, crits, combo: this.combo, mult, unmasked, chain }, this._checkEnd());
    }

    // 時間前進 dt 秒；回傳這段時間發生的事件（怪物攻擊、放招…）
    tick(dt) {
      if (this.state !== 'fighting') return this.drainEvents();
      this.elapsed += dt;
      if (this.freezeLeft > 0) {
        // 凍結：攻擊倒數和招式都停住
        this.freezeLeft = Math.max(0, this.freezeLeft - dt);
        return this.drainEvents();
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.attackTime;
        this.combo = 0;
        this.events.push(Object.assign({ type: 'attack' }, this._hurt('attack')));
      }
      if (this.state === 'fighting') {
        for (const k in this.moves) {
          this.moveClock[k] -= dt;
          if (this.moveClock[k] <= 0) {
            this.moveClock[k] = this.moves[k].every;
            this._doMove(k, this.moves[k]);
          }
        }
      }
      return this.drainEvents();
    }

    // 道具不影響連擊；揭開的格子照樣造成傷害、照樣可以爆擊
    _autoFill(cells) {
      let damage = 0;
      const crits = [];
      const seen = new Set();
      for (const i of cells) {
        if (this.grid[i]) continue;
        for (const u of this._place(i)) {
          const key = u.type + u.cells[0];
          if (!seen.has(key)) { seen.add(key); crits.push(u); }
        }
        damage += this.rules.base;
      }
      const critDamage = crits.length * Math.round(this.rules.crit * (1 + this.rules.critBonus));
      this._damage(damage + critDamage);
      return { damage, critDamage, crits };
    }

    useItem(kind, sel) {
      if (this.state !== 'fighting') return { ok: false, reason: 'not-fighting' };
      if (!(this.inventory[kind] > 0)) return { ok: false, reason: 'empty' };
      let res;
      if (kind === 'scan') {
        const empties = this.empties();
        const target = !this.grid[sel] ? sel : this._pick(empties);
        res = Object.assign({ cells: [target] }, this._autoFill([target]));
      } else if (kind === 'bomb') {
        let box = this.units(sel)[2].cells;
        if (box.every(i => this.grid[i])) {
          // 選的宮已經滿了，改炸空格最多的宮
          let best = null, bestCount = -1;
          for (const i of this.empties()) {
            const b = this.units(i)[2].cells;
            const cnt = b.filter(j => !this.grid[j]).length;
            if (cnt > bestCount) { best = b; bestCount = cnt; }
          }
          box = best;
        }
        const cells = box.filter(i => !this.grid[i]);
        res = Object.assign({ cells }, this._autoFill(cells));
      } else if (kind === 'freeze') {
        this.freezeLeft = this.rules.freeze;
        res = { cells: [] };
      } else if (kind === 'heal') {
        if (this.hearts >= this.maxHearts) return { ok: false, reason: 'full' };
        this.hearts++;
        res = { cells: [] };
      } else {
        return { ok: false, reason: 'unknown' };
      }
      // 技能「妙手」：有機會不消耗道具
      const saved = this.rules.itemSave > 0 && this.rng() < this.rules.itemSave;
      if (!saved) this.inventory[kind]--;
      res.saved = saved;
      return Object.assign({ ok: true, kind }, res, this._checkEnd());
    }
  }

  root.Battle = Battle;
  root.BATTLE_RULES = RULES;
})(typeof window !== 'undefined' ? window : globalThis);
