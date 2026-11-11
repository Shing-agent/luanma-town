// 怪物資料。名字是暫名（開發計畫：名字待定，可以邊做邊定）。
// moves：cover＝黏液蓋住數字（every 秒一次、count 格、最多 max 格）；
//        fake＝偷放假數字（every 秒一次、最多 max 個）。
// attackTime：攻擊倒數秒數（沒寫就是 40）。
// phases：魔王分段，血條每少三分之一換下一段。
(function (root) {
  'use strict';
  const MONSTERS = [
    {
      id: 'm1', name: '亂碼史萊姆（暫名）', size: 4, map: 'blob', scale: 1,
      pal: { M: '#8fd14f', D: '#5a9a2c', W: '#ffffff', K: '#1d2b14', T: '#f4f4d0' },
      moves: { cover: { every: 12, count: 1, max: 2 } },
      moveName: '黏液',
      moveText: '每隔一陣子吐黏液蓋住盤面上的數字。填對一格就擦掉一塊。',
      story: '本來是麵包店發酵到一半的麵團，被亂碼泡過之後，看到東西就想黏上去。',
    },
    {
      id: 'm2', name: '雜訊蝙蝠（暫名）', size: 6, map: 'bat', scale: 1, fly: true,
      pal: { M: '#b07ad9', D: '#7a4aa8', W: '#ffffff', K: '#25143a', T: '#f4e8ff' },
      moves: { fake: { every: 15, max: 2 } },
      moveName: '雜訊',
      moveText: '偷偷在空格放假數字，看起來跟你填的很像。選那一格重新填對，就能揭穿它。',
      story: '住在鐘樓裡的小蝙蝠，吞下一串雜訊以後，忍不住在別人的答案裡亂放數字。',
    },
    {
      id: 'm3', name: '錯位方塊（暫名）', size: 6, map: 'cube', scale: 1, glitchy: true,
      pal: { M: '#e0874f', D: '#a85a2a', W: '#ffffff', K: '#3a1e0c', T: '#fff0e0' },
      attackTime: 28,
      moveName: '急躁',
      moveText: '動作特別快，攻擊倒數只有 28 秒。',
      story: '工具店的積木，零件全被裝錯位置。它急著把自己拼回去，所以一刻也停不下來。',
    },
    {
      id: 'm4', name: '亂碼之王（暫名）', size: 9, map: 'boss', scale: 2, boss: true,
      pal: { M: '#d94f6a', D: '#9a2a42', W: '#ffffff', K: '#2a0c14', T: '#ffe0e8', C: '#ffd84d', Y: '#57e3d4' },
      phases: [
        { moves: { cover: { every: 18, count: 2, max: 3 } }, name: '黏液' },
        { moves: { fake: { every: 20, max: 2 } }, name: '雜訊' },
        { moves: {}, attackTime: 45, name: '急躁' },
      ],
      moveName: '三段變身',
      moveText: '血條分三段，每打掉一段就換一招：黏液 → 雜訊 → 急躁。',
      story: '把整個小鎮的數字攪亂的源頭。聽說它其實只是很怕安靜，才一直製造噪音。',
    },
  ];
  root.MONSTERS = MONSTERS;
})(typeof window !== 'undefined' ? window : globalThis);
