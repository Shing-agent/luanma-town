// 每日挑戰（不碰畫面，方便測試）：每天（台北時間）全世界同一題 6×6，用日期當種子出題。
// 怪物招式依日期輪替；每天第一次過關拿金幣＋連續天數獎勵，可以重打但只領一次。
(function (root) {
  'use strict';

  const BASE = 50, STREAK_STEP = 10, STREAK_MAX = 50;

  // 台北時間的日期字串 YYYY-MM-DD
  function today(now) {
    const t = (now == null ? Date.now() : now) + 8 * 3600 * 1000;
    return new Date(t).toISOString().slice(0, 10);
  }
  function dayBefore(d) {
    const t = Date.parse(d + 'T00:00:00Z') - 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }
  const dayNumber = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);

  // 由日期字串做出固定的亂數（同一天每個人都一樣）
  function rngFor(d) {
    let h = 2166136261;
    for (const ch of 'lmtown-daily-' + d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return () => { h = (h + 0x6D2B79F5) >>> 0; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  const VARIANTS = [
    { tag: '黏黏版', moveName: '黏液', moveText: '每隔一陣子蓋住數字，填對一格擦掉一塊。', moves: { cover: { every: 12, count: 1, max: 2 } } },
    { tag: '雜訊版', moveName: '雜訊', moveText: '偷放假數字，選那格重新填對就能揭穿。', moves: { fake: { every: 15, max: 2 } } },
    { tag: '急躁版', moveName: '急躁', moveText: '攻擊倒數只有 28 秒。', moves: {}, attackTime: 28 },
  ];

  // 今天的怪：外型用錯位方塊、換成金色，招式依日期輪替
  function monster(d) {
    const v = VARIANTS[((dayNumber(d) % 3) + 3) % 3];
    return {
      id: 'daily', daily: true, size: 6, map: 'cube', scale: 1, glitchy: true,
      name: `今日亂碼・${v.tag}`, moveName: v.moveName, moveText: v.moveText,
      moves: v.moves, attackTime: v.attackTime,
      pal: { M: '#e8c04a', D: '#a8862b', W: '#ffffff', K: '#3a2a0c', T: '#fff6d0' },
    };
  }

  function puzzle(d) { return root.Sudoku.generate(6, { rng: rngFor(d) }); }

  const unlocked = g => !!g.dex.m1; // 打倒史萊姆後解鎖

  function status(g, d) {
    const s = g.daily || {};
    const done = s.last === d;
    // 昨天有過關（或今天已過關）連續天數才算數
    const streak = (s.last === d || s.last === dayBefore(d)) ? (s.streak || 0) : 0;
    return { done, streak, best: s.best || 0 };
  }

  // 過關：回傳這次拿到的金幣（今天已領過就是 0）
  function recordWin(g, d, seconds) {
    const s = g.daily = Object.assign({ last: '', streak: 0, best: 0 }, g.daily);
    if (!s.best || seconds < s.best) s.best = seconds;
    if (s.last === d) return { gold: 0, streak: s.streak, again: true };
    s.streak = s.last === dayBefore(d) ? s.streak + 1 : 1;
    s.last = d;
    const gold = BASE + Math.min(STREAK_MAX, STREAK_STEP * (s.streak - 1));
    g.gold += gold;
    return { gold, streak: s.streak, again: false };
  }

  root.Daily = { today, dayBefore, rngFor, monster, puzzle, unlocked, status, recordWin, BASE };
})(typeof window !== 'undefined' ? window : globalThis);
