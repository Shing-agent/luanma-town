// 存檔：存在玩家自己的瀏覽器（localStorage），不做帳號。
// 瀏覽器不給存（隱私模式、內嵌頁面）時不會出錯，只是關掉就不見。
(function (root) {
  'use strict';
  const KEY = 'lmtown.save.v1';

  function store() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  // 讀檔：跟新遊戲的預設值合併，之後加的新欄位舊存檔也會有
  function load() {
    const s = store();
    if (!s) return null;
    try {
      const raw = s.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const g = root.Town.newGame();
      for (const k in g) {
        if (!(k in data)) continue;
        const def = g[k], v = data[k];
        if (def && typeof def === 'object' && !Array.isArray(def)) g[k] = Object.assign(def, v);
        else g[k] = v;
      }
      return g;
    } catch (e) { return null; }
  }

  function write(g) {
    const s = store();
    if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(g)); return true; } catch (e) { return false; }
  }

  function clear() {
    const s = store();
    try { if (s) s.removeItem(KEY); } catch (e) { /* 沒關係 */ }
  }

  root.Save = { KEY, load, write, clear };
})(typeof window !== 'undefined' ? window : globalThis);
