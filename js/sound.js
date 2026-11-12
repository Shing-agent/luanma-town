// 音效：用 Web Audio 即時合成復古電子音，不用音檔、沒有版權問題（2026-11-10 煦恩決定先做）。
// 手機瀏覽器規定要玩家先點過畫面才能出聲，所以第一次點擊時才建立聲音。
// iPhone 側邊的靜音開關打開時，網頁音效會被一起靜音。
(function (root) {
  'use strict';
  const KEY = 'lmtown.sound';
  let ctx = null, master = null, musicGain = null;
  let on = true;
  try { on = root.localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 不能存就預設開 */ }

  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.11; // 背景音樂比音效小聲
      musicGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 一個音：type 波形、f 起始頻率、f2 結束頻率（滑音）、dur 秒、vol 音量、at 延遲幾秒
  function tone(type, f, f2, dur, vol, at) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime + (at || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // 一段雜訊（被打、爆炸）
  function noise(dur, vol, at, lowpass) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime + (at || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    src.buffer = buf;
    fl.type = 'lowpass'; fl.frequency.value = lowpass || 1200;
    g.gain.setValueAtTime(vol || 0.3, t);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t);
  }

  const notes = (list, type, step, vol) => list.forEach((f, i) => tone(type || 'square', f, f, step * 1.1, vol || 0.18, i * step));

  const SFX = {
    // 填對：連擊越高音越高
    correct(combo) { const f = 520 * Math.pow(1.06, Math.min(combo || 1, 12)); tone('square', f, f * 1.5, 0.08, 0.16); },
    wrong() { tone('sawtooth', 160, 90, 0.22, 0.2); },
    crit() { notes([660, 880, 1320], 'square', 0.05, 0.16); noise(0.15, 0.12, 0.02, 3000); },
    attack() { noise(0.25, 0.35, 0, 700); tone('triangle', 120, 50, 0.25, 0.3); },
    shield() { tone('triangle', 900, 1400, 0.15, 0.2); },
    cast() { tone('sine', 300, 700, 0.18, 0.12); },
    phase() { notes([220, 185, 147], 'sawtooth', 0.09, 0.18); },
    scan() { tone('sine', 1200, 1800, 0.12, 0.15); },
    bomb() { noise(0.4, 0.4, 0, 500); tone('square', 200, 60, 0.35, 0.2); },
    freeze() { notes([1500, 1800, 2100, 2400], 'triangle', 0.04, 0.12); },
    heal() { notes([523, 659, 784], 'triangle', 0.07, 0.18); },
    win() { notes([523, 659, 784, 1047, 784, 1047], 'square', 0.09, 0.16); },
    lose() { notes([392, 330, 262, 196], 'triangle', 0.16, 0.2); },
    coin() { tone('square', 988, 988, 0.06, 0.14); tone('square', 1319, 1319, 0.14, 0.14, 0.06); },
    levelup() { notes([523, 659, 784, 1047, 1319], 'square', 0.07, 0.15); },
    evolve() { notes([392, 523, 659, 784, 1047, 1319, 1568], 'square', 0.08, 0.15); },
    tap() { tone('square', 700, 700, 0.03, 0.06); },
    // 亂碼迷宮
    ult() { notes([330, 440, 587, 880, 1175], 'sawtooth', 0.05, 0.16); noise(0.2, 0.15, 0.1, 2500); },
    foe() { notes([784, 988, 1175], 'square', 0.06, 0.14); },
    plugin() { notes([659, 880, 1175], 'triangle', 0.07, 0.18); },
    // 命中怪物的撞擊聲（每種攻擊、技能各有自己的聲音，在打中的瞬間響）
    hit() { noise(0.1, 0.3, 0, 900); tone('square', 220, 90, 0.1, 0.22); },
    hitCrit() { noise(0.16, 0.4, 0, 3500); tone('sawtooth', 900, 200, 0.18, 0.25); tone('square', 1500, 700, 0.1, 0.14, 0.03); },
    hitPrime() { tone('triangle', 1320, 1320, 0.14, 0.22); tone('sine', 1980, 1980, 0.2, 0.16, 0.04); noise(0.06, 0.15, 0, 4000); },
    hitSmall() { tone('square', 1100, 1500, 0.07, 0.16); tone('square', 1500, 1900, 0.09, 0.14, 0.06); },
    hitStorm() { noise(0.35, 0.45, 0, 2500); tone('sawtooth', 1800, 80, 0.3, 0.28); },
    hitChain() { [0, 0.07, 0.14].forEach(d => { noise(0.05, 0.22, d, 2000); tone('square', 600 - d * 800, 300, 0.06, 0.18, d); }); },
    hitScan() { tone('sawtooth', 2200, 400, 0.18, 0.2); noise(0.08, 0.15, 0.02, 5000); },
    hitBomb() { noise(0.5, 0.5, 0, 450); tone('sine', 110, 35, 0.45, 0.4); tone('square', 180, 50, 0.25, 0.18); },
    hitUlt() { [0, 0.06, 0.12, 0.18].forEach((d, i) => { noise(0.1, 0.28, d, 1800 + i * 600); tone('square', 300 + i * 150, 120, 0.1, 0.18, d); }); },
    hitReflect() { tone('triangle', 1600, 1000, 0.2, 0.22); tone('square', 2400, 1800, 0.1, 0.1, 0.03); },
    // 垃圾信：丟出一堆信件的唰唰聲
    spam() { [0, 0.05, 0.1, 0.15].forEach((d, i) => { noise(0.07, 0.2, d, 4500); tone('square', 1200 - i * 150, 800 - i * 100, 0.05, 0.1, d); }); },
    setbonus() { notes([523, 659, 784, 1047, 1319, 1568], 'square', 0.06, 0.15); },
  };

  function play(name, arg) { if (SFX[name]) { try { SFX[name](arg); } catch (e) { /* 聲音出錯不影響遊戲 */ } } }

  function setOn(v) {
    on = !!v;
    try { root.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 沒關係 */ }
    if (on) play('tap');
  }

  // ---------- 背景音樂（原創曲，程式即時合成） ----------
  // 每首 16 小節（128 格八分音符，一小節 8 格）：A 段 1–8 小節、B 段 9–16 小節。
  // 格式：{ bpm, wave, drums, chords: [16 個和弦名], lead: [128 格，'-' 是休止], arp, loop }
  // 低音和琶音由 chords 自動推；drums：beat（戰鬥）、heavy（精英）、soft（小鎮、休息）。
  const MKEY = 'lmtown.music';
  let musicOn = true;
  try { musicOn = root.localStorage.getItem(MKEY) !== 'off'; } catch (e) { /* 預設開 */ }

  const sp = s => s.trim().split(/\s+/);
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const SCALE = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] }; // 每個和弦自己的音階（大和弦用大調、小和弦用自然小調）
  const midiName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const parseChord = c => { const m = /^([A-G]#?)(m?)$/.exec(c); return m ? { pc: NOTE[m[1]], minor: !!m[2] } : null; };

  // 用「音階級數」寫旋律：每小節 8 個數字，0 是這個和弦的根音、2 是三度、4 是五度、7 是高八度根音，
  // 其餘是經過音（音階跟著每小節的和弦走，所以不會撞音）；'-' 休止。
  function buildLead(tonic, chords, bars) {
    const out = [];
    bars.forEach((bar, i) => {
      const c = parseChord(chords[i]), sc = SCALE[c.minor ? 'min' : 'maj'];
      let off = (c.pc - tonic % 12 + 12) % 12;
      if (off > 6) off -= 12; // 根音落在主音附近，音域才不會亂跳
      sp(bar).forEach(t => {
        if (t === '-') { out.push('-'); return; }
        const k = +t;
        let m = tonic + off + sc[k % 7] + 12 * Math.floor(k / 7);
        while (m > 88) m -= 12;
        while (m < 52) m += 12;
        out.push(midiName(m));
      });
    });
    return out;
  }
  function makeTrack(o) {
    const ch = sp(o.chords);
    const lead = o.lead || buildLead(o.tonic, ch, o.bars);
    return { bpm: o.bpm, wave: o.wave, drums: o.drums, chords: ch, lead, arp: !!o.arp, loop: o.loop !== false, vol: o.vol };
  }

  const TRACKS = {
    // 小鎮、開場、衣櫥、圖鑑：C 大調 104 BPM，輕鬆
    town: makeTrack({ bpm: 90, wave: 'triangle', drums: 'soft', arp: true,
      chords: 'C Am F G C Am Dm G F G Em Am F G C C',
      lead: sp(`E5 G5 E5 C5 D5 E5 G5 -  A5 G5 E5 C5 E5 D5 C5 -
                A5 C6 A5 F5 G5 A5 C6 -  B5 A5 G5 D5 G5 F5 D5 -
                E5 G5 C6 G5 E5 G5 E5 D5  C5 E5 A5 E5 C5 E5 D5 C5
                D5 F5 A5 F5 D5 F5 A5 G5  F5 D5 B4 D5 G5 - - -
                C6 - A5 C6 F6 - C6 A5  B5 - G5 B5 D6 - B5 G5
                G5 B5 E6 B5 G5 B5 A5 G5  A5 C6 E6 C6 A5 C6 B5 A5
                A5 C6 A5 F5 A5 C6 F6 -  G5 B5 D6 B5 G5 B5 D6 -
                E6 D6 C6 G5 E5 G5 C6 -  C6 - G5 - E5 - C5 -`) }),
    // 主線一般戰鬥：A 小調 144 BPM，輕快
    battle: makeTrack({ bpm: 124, wave: 'square', drums: 'beat', arp: true,
      chords: 'Am F G Am Am F G E Dm Am F E Dm G Am Am',
      lead: sp(`A4 C5 E5 A5 G5 E5 C5 E5  F5 A5 C6 A5 F5 E5 C5 A4
                G4 B4 D5 G5 F5 D5 B4 D5  E5 - C5 - A4 - - -
                A4 E5 A5 E5 C6 A5 E5 C5  A5 F5 C6 A5 F5 C5 A4 C5
                B4 D5 G5 B5 D6 B5 G5 D5  E5 G#5 B5 G#5 E5 D5 B4 G#4
                D5 F5 A5 F5 D5 F5 A5 D6  C6 A5 E5 A5 C6 B5 A5 E5
                F5 A5 C6 F6 C6 A5 F5 C5  E5 G#5 B5 E6 D6 B5 G#5 E5
                F5 A5 D6 A5 F5 A5 D6 F6  G5 B5 D6 G6 F6 D6 B5 G5
                A5 C6 E6 C6 A5 E5 C5 E5  A4 - E5 - A5 - - -`) }),
    // 主線魔王戰：D 小調 152 BPM，緊張；A 段壓著打、B 段往上衝
    boss: makeTrack({ bpm: 132, wave: 'square', drums: 'beat', arp: false, minor: true, tonic: 62,
      chords: 'Dm Dm A# A Dm Gm A# A A# A Dm Dm Gm A# A A',
      bars: ['0 - 0 1 0 - 2 1', '0 - 0 1 0 - 2 1', '2 - 2 3 2 - 4 3', '2 - 2 3 2 - 4 3',
        '0 - 0 1 0 - 2 1', '0 - 2 - 4 - 7 -', '7 - 5 4 5 - 4 2', '4 - 2 - 0 - - -',
        '7 - 7 9 7 - 5 4', '7 - 5 7 9 - 7 5', '9 7 5 4 2 4 5 7', '7 - 4 - 2 - 0 -',
        '7 - 7 9 7 - 5 4', '9 - 7 - 5 - 4 -', '7 9 7 5 7 9 7 5', '9 - - - 7 - - -'] }),
    // 迷宮第 1 幕：E 小調 132 BPM
    maze1: makeTrack({ bpm: 114, wave: 'square', drums: 'beat', arp: true, minor: true, tonic: 64,
      chords: 'Em Em C D Em Bm C D C D Em Bm Am C D B',
      bars: ['4 - 2 3 4 - 2 0', '2 - 0 1 2 - 4 -', '4 - 2 3 4 - 2 0', '7 - 5 4 2 - 4 -',
        '4 - 2 3 4 5 7 -', '2 - 0 1 2 - 4 -', '7 - 9 7 5 - 4 2', '2 1 0 - 0 - - -',
        '7 - 5 7 9 - 7 5', '4 - 5 4 2 - 4 -', '7 - 5 7 9 - 7 5', '7 9 7 5 4 5 7 -',
        '9 7 5 7 9 - 7 -', '9 - 7 - 4 - 2 -', '7 5 4 5 7 9 7 5', '4 - 2 - 0 - - -'] }),
    // 迷宮第 2 幕：F# 小調 140 BPM
    maze2: makeTrack({ bpm: 120, wave: 'square', drums: 'beat', arp: true, minor: true, tonic: 66,
      chords: 'F#m F#m D E F#m C#m D E D E F#m C#m Bm D E C#',
      bars: ['0 - 2 - 4 3 2 -', '4 - 5 4 2 - 0 -', '0 - 2 - 4 3 2 -', '2 - 4 - 2 1 0 -',
        '0 2 4 - 7 - 4 2', '4 - 5 4 2 - 0 -', '4 - 7 - 9 7 5 -', '4 2 1 0 - - - -',
        '7 - 7 5 4 - 5 7', '9 - 7 - 5 4 5 -', '7 - 7 5 4 - 5 7', '9 7 9 7 5 - 4 -',
        '5 7 9 7 5 4 2 4', '9 - - 7 - 5 - 4', '7 5 7 9 7 5 4 5', '7 - - - 4 - - -'] }),
    // 迷宮第 3 幕：B 小調 148 BPM
    maze3: makeTrack({ bpm: 128, wave: 'square', drums: 'beat', arp: true, minor: true, tonic: 59,
      chords: 'Bm Bm G A Bm F#m G A G A Bm F#m Em G A F#',
      bars: ['0 0 2 0 4 - 2 -', '4 4 5 4 2 - 0 -', '0 0 2 0 4 - 2 -', '4 5 4 2 4 5 7 -',
        '7 7 5 7 9 - 7 -', '4 4 5 4 2 - 0 -', '9 7 5 7 4 2 0 2', '0 - - 2 0 - - -',
        '9 - 9 7 5 - 7 -', '7 - 5 4 2 - 4 -', '9 - 9 7 5 - 7 -', '7 5 4 2 4 5 7 9',
        '9 9 7 9 7 5 4 2', '9 - 7 - 5 - 4 -', '7 7 5 7 9 9 7 5', '4 - - 2 - - 0 -'] }),
    // 迷宮精英怪、幕王：G 小調 138 BPM，鼓更多、音色更厚
    elite: makeTrack({ bpm: 118, wave: 'sawtooth', drums: 'heavy', arp: false, minor: true, tonic: 55, vol: 0.14,
      chords: 'Gm Gm D# D Gm Cm D# D D# D# Cm Cm Gm D# D D',
      bars: ['0 - 0 - 2 - 4 -', '4 - 2 - 0 - 2 -', '0 - 0 - 2 - 4 -', '4 - 5 - 7 - 5 4',
        '0 0 - 0 2 - 4 2', '4 - 2 - 0 - 2 -', '7 - 5 - 4 - 2 -', '2 1 0 - - - - -',
        '7 - - 7 9 - 7 5', '9 - 7 - 5 - 7 -', '7 - - 7 9 - 7 5', '7 5 4 2 0 2 4 5',
        '9 - 9 7 5 - 7 -', '9 - 7 - 5 - 7 -', '7 9 7 5 4 5 7 9', '7 - - - 4 - - -'] }),
    // 迷宮選路、商店、休息站、事件：G 大調 90 BPM，輕鬆
    rest: makeTrack({ bpm: 78, wave: 'triangle', drums: 'soft', arp: true, minor: false, tonic: 67,
      chords: 'G Em C D G Em Am D C D Bm Em C D G G',
      bars: ['4 - 2 - 4 5 4 2', '2 - 0 - 2 - - -', '4 - 2 - 4 5 4 2', '5 - 4 - 2 - 0 -',
        '4 - 7 - 5 4 2 -', '2 - 0 - 2 - - -', '7 - 5 4 5 - 4 2', '2 - 0 - - - - -',
        '7 - 7 - 7 5 4 -', '5 - 4 - 2 - 4 -', '7 - 7 - 7 5 4 -', '7 - 5 - 4 - 2 -',
        '7 - 5 - 7 - 7 5', '7 - 5 4 5 - 7 -', '7 5 4 2 4 5 7 -', '4 - 2 - 0 - - -'] }),
    // 魔王結局、通關結算：D 大調 120 BPM，明亮，播一遍就停
    ending: makeTrack({ bpm: 104, wave: 'square', drums: 'beat', arp: true, minor: false, tonic: 62, loop: false,
      chords: 'D A Bm G D G A A D A Bm F#m G D A D',
      bars: ['4 - 2 - 4 5 7 -', '9 - 7 - 5 - 4 -', '4 - 2 - 4 5 7 -', '5 - 4 2 0 - 2 -',
        '7 - 5 - 7 - 9 -', '9 - 7 - 5 - 4 -', '9 7 5 7 9 - 7 -', '9 - - - 7 - - -',
        '7 - 9 7 5 - 7 -', '9 - 7 - 5 - 4 -', '7 - 9 7 5 - 7 -', '9 7 5 4 2 4 5 7',
        '9 - 9 7 9 - 7 -', '7 - 5 - 4 - 2 -', '9 7 9 7 5 7 9 -', '7 - - - - - - -'] }),
  };

  function freq(n) {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    if (!m) return 0;
    const midi = (+m[2] + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  const mfreq = m => 440 * Math.pow(2, (m - 69) / 12);

  function voice(type, f, t, dur, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let hatBuf = null;
  function hat(t, vol, dest) {
    if (!hatBuf) {
      const len = Math.floor(ctx.sampleRate * 0.04);
      hatBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = hatBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = hatBuf; fl.type = 'highpass'; fl.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t);
    s.connect(fl); fl.connect(g); g.connect(dest || musicGain); s.start(t);
  }
  function kick(t, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol || 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(dest || musicGain); o.start(t); o.stop(t + 0.17);
  }
  function snare(t, vol) {
    const len = Math.floor(ctx.sampleRate * 0.12), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = 1800;
    g.gain.setValueAtTime(vol, t);
    s.connect(fl); fl.connect(g); g.connect(musicGain); s.start(t);
    voice('triangle', 190, t, 0.08, vol * 0.5);
  }

  // 緊張層：高八度旋律疊音、加密的 hat、多一個底鼓。放在獨立的音量節點上，開關都用漸變（約 0.5 秒）。
  let want = null, track = null, step = 0, nextT = 0, timer = null, ended = false;
  let intense = false, ig = null, layerUntil = 0;
  function setIntensity(v) {
    v = !!v;
    if (v === intense) return;
    intense = v;
    if (!ctx || !ig) return;
    ig.gain.cancelScheduledValues(ctx.currentTime);
    ig.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, v ? 0.08 : 0.17);
    layerUntil = ctx.currentTime + 0.6;
  }

  function schedule() {
    if (!musicOn || !ctx || ctx.state !== 'running') return;
    if (!ig) { ig = ctx.createGain(); ig.gain.value = intense ? 1 : 0; ig.connect(musicGain); }
    if (track !== want) { track = want; step = 0; ended = false; nextT = ctx.currentTime + 0.08; }
    if (!track || ended) return;
    const T = TRACKS[track], len = T.lead.length, dur = 60 / T.bpm / 2;
    const fight = T.drums !== 'soft', lv = T.vol || (T.wave === 'square' ? 0.22 : 0.4);
    while (nextT < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 8), pos = step % 8;
      const c = parseChord(T.chords[bar]), l = T.lead[step];
      const layer = intense || nextT < layerUntil;
      if (l !== '-') {
        const f = freq(l);
        voice(T.wave, f, nextT, dur * 0.9, lv);
        if (layer) voice(T.wave, f * 2, nextT, dur * 0.9, 0.08, ig);
      }
      // 低音：戰鬥類跑動（低八度、高八度交替），小鎮類每小節一個長音
      const root = 36 + c.pc;
      if (fight) voice('triangle', mfreq(root + (pos % 2 ? 12 : 0)), nextT, dur * 0.95, 0.55);
      else if (pos === 0) voice('triangle', mfreq(root), nextT, dur * 6.5, 0.5);
      // 琶音層：和弦音 [0,1,2,1] 順序，sine 八分音符
      if (T.arp) {
        const ar = 60 + (c.pc >= 7 ? c.pc - 12 : c.pc), tri = [0, c.minor ? 3 : 4, 7];
        voice('sine', mfreq(ar + tri[[0, 1, 2, 1][step % 4]]), nextT, dur * 0.9, 0.18);
      }
      // 鼓：每小節不完全一樣（每 4 小節最後一小節後半有過門，每 8 小節開頭有重音）
      if (fight) {
        const fill = bar % 4 === 3 && pos >= 6;
        if (pos % 2 === 0) kick(nextT);
        if (pos === 2 || pos === 6 || fill) snare(nextT, 0.3);
        if (T.drums === 'heavy') {
          if (pos === 7 || pos === 3 && bar % 2) kick(nextT, 0.6);
          if (pos === 5 && bar % 2) snare(nextT, 0.16);
        }
        hat(nextT, pos === 0 && bar % 8 === 0 ? 0.3 : pos % 2 ? 0.12 : 0.2);
        if (layer) {
          hat(nextT + dur / 2, 0.1, ig);
          if (pos % 4 === 2) kick(nextT, 0.55, ig);
        }
      } else {
        if (pos === 2 || pos === 6) hat(nextT, 0.08);
        if (layer && pos % 4 === 0) kick(nextT, 0.5, ig);
        if (layer) hat(nextT + dur / 2, 0.06, ig);
      }
      step++;
      if (step >= len) { if (T.loop) step = 0; else { ended = true; break; } }
      nextT += dur;
    }
  }

  // 換曲：TRACKS 裡的曲名；null 停止（例如結果畫面讓勝利音效被聽清楚）。同一首重複叫不會從頭重播。
  function music(name) {
    want = name || null;
    if (!timer && typeof setInterval !== 'undefined') timer = setInterval(schedule, 25);
  }

  function setMusic(v) {
    musicOn = !!v;
    try { root.localStorage.setItem(MKEY, musicOn ? 'on' : 'off'); } catch (e) { /* 沒關係 */ }
    if (musicOn) { ensure(); track = null; } // 重新從頭播
  }

  // 第一次點畫面就把聲音叫醒（iPhone 需要）；切到別的 App 時把聲音暫停
  if (typeof document !== 'undefined') {
    // iPhone 靜音開關：把網頁音訊改成「播放」類別，側邊開關打開時也能出聲（iOS 16.4 以上）
    let silent = null;
    const unmute = () => {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 沒有就算了 */ }
      if (silent) return;
      try { // 舊版 iOS：放一段無聲的 <audio>，同樣會切到播放類別
        silent = document.createElement('audio');
        silent.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        silent.loop = true; silent.setAttribute('playsinline', ''); silent.volume = 0.01;
        silent.play().catch(() => { silent = null; });
      } catch (e) { silent = null; }
    };
    const wake = () => { if (on || musicOn) { ensure(); unmute(); } };
    // iPhone 只認「放開手指」那一刻（touchend／click）才算使用者操作，pointerdown 不夠，所以全部都掛
    ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(t => document.addEventListener(t, wake, { passive: true }));
    document.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (on || musicOn) { ctx.resume(); track = null; }
    });
  }

  root.Sound = { play, setOn, isOn: () => on, music, setMusic, isMusicOn: () => musicOn, setIntensity, intensity: () => intense, current: () => want, freq, TRACKS };
})(typeof window !== 'undefined' ? window : globalThis);
