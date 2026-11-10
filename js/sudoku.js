// 數獨產生器：4×4、6×6、9×9，保證唯一解。
(function (root) {
  'use strict';

  // br／bc：一宮有幾列、幾行；givens：題目留下幾個數字
  const SPEC = {
    4: { br: 2, bc: 2, givens: 7 },
    6: { br: 2, bc: 3, givens: 15 },
    9: { br: 3, bc: 3, givens: 34 },
  };

  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function canPlace(g, n, br, bc, idx, v) {
    const r = Math.floor(idx / n), c = idx % n;
    for (let k = 0; k < n; k++) {
      if (g[r * n + k] === v || g[k * n + c] === v) return false;
    }
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let i = 0; i < br; i++)
      for (let j = 0; j < bc; j++)
        if (g[(r0 + i) * n + c0 + j] === v) return false;
    return true;
  }

  function fill(g, n, br, bc, rng) {
    const idx = g.indexOf(0);
    if (idx < 0) return true;
    const nums = shuffle(Array.from({ length: n }, (_, i) => i + 1), rng);
    for (const v of nums) {
      if (canPlace(g, n, br, bc, idx, v)) {
        g[idx] = v;
        if (fill(g, n, br, bc, rng)) return true;
        g[idx] = 0;
      }
    }
    return false;
  }

  // 數解的個數，數到 limit 就停（用來確認唯一解）
  function countSolutions(g, n, br, bc, limit) {
    let best = -1, bestCands = null;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      const cands = [];
      for (let v = 1; v <= n; v++) if (canPlace(g, n, br, bc, i, v)) cands.push(v);
      if (cands.length === 0) return 0;
      if (!bestCands || cands.length < bestCands.length) {
        best = i; bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best < 0) return 1;
    let count = 0;
    for (const v of bestCands) {
      g[best] = v;
      count += countSolutions(g, n, br, bc, limit - count);
      g[best] = 0;
      if (count >= limit) break;
    }
    return count;
  }

  function generate(n, opts) {
    const spec = SPEC[n];
    if (!spec) throw new Error('不支援的盤面大小：' + n);
    const rng = (opts && opts.rng) || Math.random;
    const givens = (opts && opts.givens) || spec.givens;
    const solution = new Array(n * n).fill(0);
    fill(solution, n, spec.br, spec.bc, rng);
    const puzzle = solution.slice();
    let filled = n * n;
    for (const i of shuffle([...puzzle.keys()], rng)) {
      if (filled <= givens) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), n, spec.br, spec.bc, 2) !== 1) puzzle[i] = keep;
      else filled--;
    }
    return { n, br: spec.br, bc: spec.bc, solution, puzzle };
  }

  // 一格所在的列、行、宮（回傳每組的格子編號）
  function unitsOf(idx, n, br, bc) {
    const r = Math.floor(idx / n), c = idx % n;
    const row = [], col = [], box = [];
    for (let k = 0; k < n; k++) { row.push(r * n + k); col.push(k * n + c); }
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let i = 0; i < br; i++)
      for (let j = 0; j < bc; j++) box.push((r0 + i) * n + c0 + j);
    return [
      { type: 'row', cells: row },
      { type: 'col', cells: col },
      { type: 'box', cells: box },
    ];
  }

  root.Sudoku = { SPEC, generate, unitsOf, countSolutions, canPlace };
})(typeof window !== 'undefined' ? window : globalThis);
