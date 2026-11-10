// 像素圖示（取代 emoji，讓整個遊戲畫風一致）。用法：Icons.img('coin')
(function (root) {
  'use strict';

  const DEFS = {
    coin: { pal: { O: '#b8862b', Y: '#ffd84d', W: '#fff6c4' }, map: [
      '...OOOO...',
      '..OYYYYO..',
      '.OYWYYYYO.',
      'OYWYYOYYYO',
      'OYYYOOYYYO',
      'OYYYYOYYYO',
      'OYYYYOYYYO',
      '.OYYOOOYO.',
      '..OYYYYO..',
      '...OOOO...',
    ] },
    heart: { pal: { R: '#ff4f6a', W: '#ffd0d8' }, map: [
      '.RR...RR.',
      'RWRR.RRRR',
      'RWRRRRRRR',
      'RRRRRRRRR',
      '.RRRRRRR.',
      '..RRRRR..',
      '...RRR...',
      '....R....',
    ] },
    heartEmpty: { pal: { R: '#555a70', W: '#6a6f88' }, mapOf: 'heart' },
    scan: { pal: { K: '#2a2d40', C: '#7fd4ff', W: '#ffffff', H: '#b5702e' }, map: [
      '..KKKK....',
      '.KCCCCK...',
      'KCWCCCCK..',
      'KCWCCCCK..',
      'KCCCCCCK..',
      'KCCCCCCK..',
      '.KCCCCK...',
      '..KKKKHH..',
      '......HHH.',
      '.......HH.',
    ] },
    bomb: { pal: { K: '#30334a', W: '#8a8fb0', F: '#ff9a3d', Y: '#ffd84d' }, map: [
      '......F.Y.',
      '.....K.F..',
      '....K.....',
      '..KKKKK...',
      '.KKKKKKK..',
      'KKWKKKKKK.',
      'KWKKKKKKK.',
      'KKKKKKKKK.',
      '.KKKKKKK..',
      '..KKKKK...',
    ] },
    freeze: { pal: { W: '#bfeaff', B: '#ffffff' }, map: [
      '....W....',
      '.W..W..W.',
      '..W.W.W..',
      '...WWW...',
      'WWWWBWWWW',
      '...WWW...',
      '..W.W.W..',
      '.W..W..W.',
      '....W....',
    ] },
    sword: { pal: { S: '#d0d8e0', L: '#ffffff', G: '#ffd84d', B: '#8a4b2a' }, map: [
      '.......SS',
      '......SLS',
      '.....SLS.',
      '....SLS..',
      '.G.SLS...',
      '..GSS....',
      '..BGG....',
      '.B...G...',
      'B........',
    ] },
    hammer: { pal: { K: '#8a96a0', L: '#c9d3da', B: '#b5702e' }, map: [
      '.LLLLLL..',
      'KKKKKKKK.',
      'KKKKKKKK.',
      '...BB....',
      '...BB....',
      '...BB....',
      '...BB....',
      '...BB....',
      '...BB....',
    ] },
    quest: { pal: { P: '#f2e2b4', K: '#a08a5a', B: '#b5702e' }, map: [
      'BBPPPPPP.',
      'B.PPPPPPP',
      '.PKKKKKP.',
      '.PPPPPPP.',
      '.PKKKKKP.',
      '.PPPPPPP.',
      '.PKKKPPP.',
      'PPPPPPPBB',
      '.PPPPPP.B',
    ] },
    crown: { pal: { Y: '#ffd84d', R: '#e0455f', C: '#57e3d4', O: '#b8862b' }, map: [
      'Y...Y...Y',
      'YY.YYY.YY',
      'YYYYYYYYY',
      'YRYYCYYRY',
      'YYYYYYYYY',
      'OOOOOOOOO',
    ] },
    book: { pal: { G: '#57a37a', W: '#f4f0e0', K: '#8a8a9a' }, map: [
      '.GGGG.GGGG.',
      'GWWWWGWWWWG',
      'GWKKWGWKKWG',
      'GWWWWGWWWWG',
      'GWKKWGWKKWG',
      'GWWWWGWWWWG',
      'GGGGGGGGGGG',
      '.....G.....',
    ] },
    shield: { pal: { K: '#3a5a8a', B: '#6fa8ff', W: '#d8e8ff' }, map: [
      'KKKKKKKKK',
      'KWBBBBBBK',
      'KWBBBBBBK',
      'KWBBBBBBK',
      'KBBBBBBBK',
      '.KBBBBBK.',
      '.KBBBBBK.',
      '..KBBBK..',
      '...KKK...',
    ] },
    shirt: { pal: { B: '#e07ab0', D: '#a8487e', W: '#ffffff' }, map: [
      '.BBB..BBB.',
      'BBBBWWBBBB',
      'BBBBBBBBBB',
      'DBBBBBBBBD',
      '..BBBBBB..',
      '..BBBWBB..',
      '..BBBBBB..',
      '..DDDDDD..',
    ] },
    soundOn: { pal: { W: '#ffffff', G: '#57e389' }, map: [
      '...W......',
      '..WW...G..',
      'WWWW.G..G.',
      'WWWW..G.G.',
      'WWWW..G.G.',
      'WWWW.G..G.',
      '..WW...G..',
      '...W......',
    ] },
    soundOff: { pal: { W: '#ffffff', R: '#ff5a5a' }, map: [
      '...W......',
      '..WW......',
      'WWWW.R..R.',
      'WWWW..RR..',
      'WWWW..RR..',
      'WWWW.R..R.',
      '..WW......',
      '...W......',
    ] },
    note: { pal: { W: '#ffffff', G: '#57e389' }, map: [
      '...GGGGG',
      '...GGGGG',
      '...G...G',
      '...G...G',
      '...G...G',
      '.WWG.WWG',
      'WWWGWWWG',
      '.WW..WW.',
    ] },
    noteOff: { pal: { W: '#8a8fa8', R: '#ff5a5a' }, map: [
      'R..WWWWW',
      '.R.W...W',
      '..RW...W',
      '...R...W',
      '...WR..W',
      '.WWW.RWW',
      'WWWWWWRW',
      '.WW..WWR',
    ] },
    pencil: { pal: { Y: '#ffd84d', O: '#c9a02a', P: '#ff8fa8', K: '#2a2a33', W: '#f2e2b4' }, map: [
      '......PP',
      '.....PPP',
      '....YYP.',
      '...YYO..',
      '..YYO...',
      '.WYO....',
      'KWW.....',
      'KK......',
    ] },
    calendar: { pal: { R: '#e0455f', W: '#f4f0e0', K: '#5a5f78', G: '#57e389' }, map: [
      '.K....K.',
      'RRRRRRRR',
      'RRRRRRRR',
      'WWWWWWWW',
      'WKWKWKWW',
      'WWWWWWWW',
      'WKWGWKWW',
      'WWWWWWWW',
    ] },
    star: { pal: { Y: '#ffd84d', O: '#b8862b', W: '#fff6c4' }, map: [
      '....O....',
      '...OYO...',
      '...OYO...',
      'OOOOWYOOO',
      'OYYWYYYYO',
      '.OYYYYYO.',
      '..OYYYO..',
      '.OYYOYYO.',
      '.OYO.OYO.',
      '.OO...OO.',
    ] },
    pause: { pal: { W: '#ffffff' }, map: [
      'WW..WW',
      'WW..WW',
      'WW..WW',
      'WW..WW',
      'WW..WW',
      'WW..WW',
      'WW..WW',
    ] },
  };

  const cache = {};
  function url(name) {
    if (cache[name]) return cache[name];
    const d = DEFS[name];
    const map = d.map || DEFS[d.mapOf].map;
    const c = document.createElement('canvas');
    c.width = map[0].length; c.height = map.length;
    const ctx = c.getContext('2d');
    map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || !d.pal[ch]) return;
      ctx.fillStyle = d.pal[ch]; ctx.fillRect(x, y, 1, 1);
    }));
    return (cache[name] = c.toDataURL());
  }

  function img(name, cls) {
    return `<img class="pxi${cls ? ' ' + cls : ''}" src="${url(name)}" alt="" aria-hidden="true">`;
  }

  root.Icons = { url, img, DEFS };
})(typeof window !== 'undefined' ? window : globalThis);
