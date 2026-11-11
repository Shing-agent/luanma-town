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
    setbonus() { notes([523, 659, 784, 1047, 1319, 1568], 'square', 0.06, 0.15); },
  };

  function play(name, arg) { if (SFX[name]) { try { SFX[name](arg); } catch (e) { /* 聲音出錯不影響遊戲 */ } } }

  function setOn(v) {
    on = !!v;
    try { root.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 沒關係 */ }
    if (on) play('tap');
  }

  // ---------- 背景音樂（原創曲，程式即時合成） ----------
  // 每首是一串「八分音符格」：lead 主旋律、bass 低音，'-' 是休止；drums 決定有沒有鼓。
  const MKEY = 'lmtown.music';
  let musicOn = true;
  try { musicOn = root.localStorage.getItem(MKEY) !== 'off'; } catch (e) { /* 預設開 */ }

  const sp = s => s.trim().split(/\s+/);
  const TRACKS = {
    // 小鎮：C 大調，C–Am–F–G，輕鬆散步
    town: { bpm: 104, drums: 'soft', wave: 'triangle',
      lead: sp(`E5 G5 A5 G5 E5 D5 C5 D5  E5 E5 D5 C5 A4 C5 D5 -
                F5 A5 C6 A5 G5 F5 E5 F5  G5 - E5 D5 B4 D5 C5 -
                E5 G5 A5 G5 E5 D5 C5 D5  E5 G5 A5 C6 A5 G5 E5 -
                F5 E5 D5 F5 E5 D5 C5 B4  C5 - - - G4 - - -`),
      bass: sp(`C3 - G3 - C3 - G3 -  A2 - E3 - A2 - E3 -
                F2 - C3 - F2 - C3 -  G2 - D3 - G2 - D3 -
                C3 - G3 - C3 - G3 -  A2 - E3 - A2 - E3 -
                F2 - C3 - G2 - D3 -  C3 - G2 - C3 - - -`) },
    // 一般戰鬥：A 小調，Am–F–G–Am，輕快
    battle: { bpm: 144, drums: 'beat', wave: 'square',
      lead: sp(`A4 C5 E5 C5 A4 C5 E5 G5  F5 E5 C5 A4 C5 - A4 -
                G4 B4 D5 G5 F5 D5 B4 D5  E5 - C5 - A4 - - -
                A4 C5 E5 A5 G5 E5 C5 E5  F5 A5 G5 F5 E5 - C5 -
                D5 E5 F5 G5 F5 E5 D5 B4  C5 B4 A4 - E5 - - -`),
      bass: sp(`A2 A3 A2 A3 A2 A3 A2 A3  F2 F3 F2 F3 F2 F3 F2 F3
                G2 G3 G2 G3 G2 G3 G2 G3  A2 A3 A2 A3 A2 A3 A2 A3
                A2 A3 A2 A3 A2 A3 A2 A3  F2 F3 F2 F3 F2 F3 F2 F3
                G2 G3 G2 G3 G2 G3 G2 G3  E2 E3 E2 E3 E2 E3 E2 E3`) },
    // 魔王戰：D 小調加半音，緊張
    boss: { bpm: 152, drums: 'beat', wave: 'square',
      lead: sp(`D5 F5 A5 G#5 A5 F5 D5 C#5  D5 - A4 - A#4 A4 G4 A4
                F5 E5 D5 C#5 D5 E5 F5 G5  A5 - G#5 - A5 - - -
                A#5 A5 G5 F5 G5 F5 E5 D5  E5 F5 E5 D5 C#5 - A4 -
                D5 F5 E5 G5 F5 A5 G#5 A5  D6 - C#6 - D6 - - -`),
      bass: sp(`D2 D3 D2 D3 C#2 C#3 C#2 C#3  D2 D3 D2 D3 F2 F3 E2 E3
                D2 D3 D2 D3 C#2 C#3 C#2 C#3  D2 D3 D2 D3 D2 D3 D2 D3
                A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2  A1 A2 A1 A2 A1 A2 A1 A2
                D2 D3 D2 D3 C#2 C#3 C#2 C#3  D2 D3 D2 D3 D2 - - -`) },
  };

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    if (!m) return 0;
    const midi = (+m[2] + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function voice(type, f, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let hatBuf = null;
  function hat(t, vol) {
    if (!hatBuf) {
      const len = Math.floor(ctx.sampleRate * 0.04);
      hatBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = hatBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = hatBuf; fl.type = 'highpass'; fl.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t);
    s.connect(fl); fl.connect(g); g.connect(musicGain); s.start(t);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.17);
  }

  let want = null, track = null, step = 0, nextT = 0, timer = null;
  function schedule() {
    if (!musicOn || !ctx || ctx.state !== 'running') return;
    if (track !== want) { track = want; step = 0; nextT = ctx.currentTime + 0.08; }
    if (!track) return;
    const T = TRACKS[track], len = T.lead.length, dur = 60 / T.bpm / 2;
    while (nextT < ctx.currentTime + 0.15) {
      const l = T.lead[step], b = T.bass[step % T.bass.length];
      if (l !== '-') voice(T.wave, freq(l), nextT, dur * 0.9, T.wave === 'square' ? 0.22 : 0.4);
      if (b !== '-') voice('triangle', freq(b), nextT, dur * 0.95, 0.55);
      if (T.drums === 'beat') { if (step % 4 === 0) kick(nextT); hat(nextT, step % 2 ? 0.12 : 0.2); }
      else if (T.drums === 'soft' && step % 4 === 2) hat(nextT, 0.08);
      step = (step + 1) % len;
      nextT += dur;
    }
  }

  // 換曲：town／battle／boss；null 停止（例如結果畫面讓勝利音效被聽清楚）
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
    const wake = () => { if (on || musicOn) ensure(); };
    document.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (on || musicOn) { ctx.resume(); track = null; }
    });
  }

  root.Sound = { play, setOn, isOn: () => on, music, setMusic, isMusicOn: () => musicOn, TRACKS };
})(typeof window !== 'undefined' ? window : globalThis);
