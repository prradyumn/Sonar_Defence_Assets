/* core: stage fit, timing, sound (synth sfx + Indian music bed + recorded voice), captions, characters. */
(function () {
  const $ = s => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  const SPEED = parseFloat(Q.get('speed') || '1');
  if (SPEED !== 1) gsap.globalTimeline.timeScale(SPEED);
  const stage = $('#stage');
  const inset = { l: 0, t: 0, r: 0, b: 0 };   // room kept free around the stage (the layout editor's panels)
  function fit() {
    const w = innerWidth - inset.l - inset.r, h = innerHeight - inset.t - inset.b, s = Math.min(w / 1920, h / 1080);
    stage.style.transform = `translate(${inset.l + (w - 1920 * s) / 2}px,${inset.t + (h - 1080 * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ================= layout overrides: js/layout.js (window.LAYOUT, written by the editor) → one <style> ================= */
  const PX = { left: 1, top: 1, width: 1, height: 1, minHeight: 1, maxWidth: 1, marginLeft: 1, fontSize: 1 };
  const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  function layoutCSS(ov) {
    return Object.keys(ov || {}).map(sel => {
      const p = ov[sel], d = [];
      for (const k in p) {
        const v = p[k]; if (typeof v !== 'number' || !isFinite(v)) continue;
        if (PX[k]) d.push(`${kebab(k)}:${v}px!important`);
        else if (k === 'zIndex') d.push(`z-index:${v}!important`);
        else if (k === 'rotate') d.push(`rotate:${v}deg`);              // not !important: GSAP folds rotate/scale into its own transform
        else if (k === 'scale' || k === 'opacity') d.push(`${k}:${v}`);   // opacity stays animatable by the game
      }
      if (p.left != null) d.push('right:auto!important');
      if (p.top != null) d.push('bottom:auto!important');
      return d.length ? `${sel}{${d.join(';')}}` : '';
    }).filter(Boolean).join('\n');
  }
  function applyLayout(ov) {
    let st = document.getElementById('layoutOverrides');
    if (!st) { st = document.createElement('style'); st.id = 'layoutOverrides'; document.head.appendChild(st); }
    st.textContent = layoutCSS(ov);
  }
  applyLayout(window.LAYOUT && LAYOUT.overrides);

  const wait = s => new Promise(r => gsap.delayedCall(s, r));
  const fmt = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';   // true minus sign
  const readTime = t => Math.max(1.6, t.split(/\s+/).length * 0.36);
  const MUTE = Q.get('mute') === '1';

  /* ================= sound: Web-Audio synth (no files needed) ================= */
  let AC = null, master = null, sfxBus = null, musicBus = null;
  function audioOn() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = MUTE ? 0 : .8; master.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.gain.value = .75; sfxBus.connect(master);
      musicBus = AC.createGain(); musicBus.gain.value = .0001; musicBus.connect(master);
      musicBus.gain.linearRampToValueAtTime(.55, AC.currentTime + 3);
      ambience(); music();
    } catch (e) { AC = null; }
  }
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(type, f0, f1, dur, peak = .3, delay = 0, bus) {
    if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .01, dur, peak); o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, peak = .25, lp = 1200, delay = 0, hp) {
    if (!AC) return; const t = AC.currentTime + delay, n = AC.sampleRate * dur, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = lp;
    env(g, t, .02, dur, peak); s.connect(f); if (hp) { const h = AC.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; f.connect(h); h.connect(g); } else f.connect(g); g.connect(sfxBus); s.start(t);
  }
  function ambience() {   // soft underwater rumble + slow "breathing" filter
    const n = AC.sampleRate * 4, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; s.loop = true; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = .2;
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = .08; lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    s.connect(f); f.connect(g); g.connect(musicBus); s.start();
  }
  /* music bed: a tanpura drone (Pa · Sa · Sa · low Sa, in D) under a slow underwater pad — gives the game an Indian heartbeat */
  function pluck(freq, t, peak) {
    const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), bp = AC.createBiquadFilter(), g = AC.createGain(), g2 = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq; o2.type = 'sawtooth'; o2.frequency.value = freq * 1.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + 3.5);
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(freq * 6, t); bp.frequency.linearRampToValueAtTime(freq * 9, t + 2.5); bp.Q.value = 6;   // the buzzy "jivari" shimmer
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 4.6);
    g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(peak * .5, t + .8); g2.gain.exponentialRampToValueAtTime(.0001, t + 4.2);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus); o.connect(bp); bp.connect(g2); g2.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + 4.8); o2.stop(t + 4.8);
  }
  function padChord(freqs, t, dur) {
    freqs.forEach((fq, i) => {
      const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
      o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = fq; o.detune.value = (i - 1) * 6;
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + .1);
    });
  }
  function music() {
    const SA = 146.83, PA = 110, LSA = 73.42, CYC = 4.8;
    const PADS = [[293.66, 349.23, 440], [261.63, 329.63, 392], [233.08, 293.66, 349.23], [261.63, 329.63, 440]];   // Dm · C · Bb · C(add A)
    let next = AC.currentTime + .3, bar = 0;
    setInterval(() => {
      if (!AC || SD.paused) return;
      while (next < AC.currentTime + 1.5) {
        pluck(PA, next, .035); pluck(SA, next + 1.2, .03); pluck(SA, next + 2.4, .03); pluck(LSA, next + 3.6, .045);
        if (bar % 2 === 0) padChord(PADS[(bar / 2) % PADS.length], next, CYC * 2);
        next += CYC; bar++;
      }
    }, 400);
  }
  function duck(on) { if (!AC) return; const t = AC.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(on ? .18 : .55, t + (on ? .25 : 1.2)); }

  const SFX = {
    ping() { tone('sine', 1250, 900, 1.1, .16); tone('sine', 1250, 900, .9, .05, .35); },
    lock() { tone('square', 880, 1320, .09, .07); tone('square', 1320, 1760, .09, .06, .1); },
    launch() { noise(.55, .28, 900, 0, 120); tone('sawtooth', 220, 90, .5, .06); },
    boom() { tone('sine', 120, 40, .7, .5); noise(.9, .38, 600); for (let i = 0; i < 6; i++) tone('sine', 500 + Math.random() * 700, 1400, .08, .05, .15 + i * .07); },
    right() { tone('triangle', 784, 0, .18, .22); tone('triangle', 1175, 0, .32, .22, .14); },
    wrong() { tone('square', 180, 140, .28, .1); tone('square', 150, 120, .28, .09, .14); },
    shield() { tone('sine', 600, 1400, .25, .12); noise(.2, .1, 3000); },
    pop() { tone('sine', 900, 1800, .08, .18); },
    step() { tone('triangle', 660, 0, .07, .12); },
    swoosh() { noise(1.2, .18, 700, 0, 200); },
    tada() { [587, 740, 880, 1175].forEach((f, i) => tone('triangle', f, 0, .3, .18, i * .12)); },
    alarm() { for (let i = 0; i < 3; i++) { tone('square', 660, 0, .16, .07, i * .42); tone('square', 880, 0, .16, .07, i * .42 + .2); } },
    blip() { tone('sine', 1500, 1500, .12, .08); },
    tap() { tone('sine', 520, 780, .07, .12); },
    bubble() { tone('sine', 300 + Math.random() * 300, 900 + Math.random() * 500, .12, .05); },
    // sonar-room doors: unlock beeps → latch → air hiss → heavy slide (rumble + servo whine) → stop
    doorBeep() { tone('sine', 1320, 0, .09, .12); tone('sine', 1760, 0, .12, .1, .13); },
    clunk() { tone('sine', 120, 36, .34, .5); noise(.16, .32, 650); tone('square', 74, 52, .07, .05); },
    hiss(dur = .8) { noise(dur, .2, 9000, 0, 2200); noise(dur * .6, .08, 3200, .05, 900); },
    doorSlide(dur = 1.8) {
      if (!AC) return; const t = AC.currentTime, o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(46, t); o.frequency.linearRampToValueAtTime(68, t + dur * .55); o.frequency.linearRampToValueAtTime(50, t + dur);
      f.type = 'lowpass'; f.frequency.value = 300;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.1, t + .3); g.gain.setValueAtTime(.1, t + dur - .35); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .05);
      noise(dur, .16, 240); tone('triangle', 230, 320, dur * .8, .025);
    },
    foot() { noise(.07, .1, 900, 0, 160); },
    splash() { noise(1, .2, 1500, 0, 280); noise(.5, .08, 6000, .1, 2500); },
    // reward: bright arpeggio + shimmer (bigger when right first time) · ding when the star lands in its pip
    reward(big) { [784, 988, 1175, 1568].forEach((f, i) => { tone('sine', f, 0, .55, big ? .15 : .1, i * .07); tone('triangle', f * 2, 0, .3, .03, i * .07); }); noise(.6, .05, 14000, .18, 6000); },
    ding() { tone('sine', 1976, 0, .7, .13); tone('sine', 2637, 0, .5, .05, .02); },
    sparkle() { for (let i = 0; i < 4; i++) tone('sine', 1800 + Math.random() * 1400, 0, .12, .04, i * .05); },
  };

  /* ================= voice: recorded VO (assets/vo/<id>.wav) → browser voice → reading time ================= */
  const VO_OK = id => !MUTE && Array.isArray(window.VO_HAVE) && window.VO_HAVE.includes(id);
  let curAudio = null, skipFn = null, held = false;
  const onResume = [];   // voice that was due to start while the editor had the game paused
  const VO_EXT = ['ogg', 'wav'];   // recorded lines are Ogg Opus; a .wav still works
  /* ONE audio element plays every line. A new element per line piles up media players until Chrome starts
     suspending them, and lines then stall for seconds mid-word. A token per line ignores the last line's events. */
  const voice = new Audio(); voice.preload = 'auto';
  let vTok = 0, endPrev = null;
  function playVO(id, ext = 0) {
    return new Promise(res => {
      if (!VO_OK(id) || ext >= VO_EXT.length) return res(false);
      if (endPrev) endPrev();                          // a new line ends the one before it
      const my = ++vTok, a = voice;
      let done = false;
      const off = () => { for (const k in on) a.removeEventListener(k, on[k]); if (endPrev === stop) endPrev = null; };
      const fin = ok => { if (done) return; done = true; off(); if (vTok === my && curAudio === a) curAudio = null; res(ok); };
      const stop = () => fin(true);
      const on = {
        ended: () => fin(true),
        pause: () => { if (!a._held && vTok === my) fin(true); },
        error: () => { if (done || vTok !== my) return; done = true; off(); playVO(id, ext + 1).then(res); },   // .ogg missing → .wav
      };
      for (const k in on) a.addEventListener(k, on[k]);
      endPrev = stop; a._held = false;
      a.src = 'assets/vo/' + id + '.' + VO_EXT[ext]; a._id = id; a.playbackRate = Math.min(SPEED, 2); curAudio = a;
      const go = () => { if (vTok === my) a.play().catch(e => { if (vTok === my && (!e || (e.name !== 'NotSupportedError' && e.name !== 'AbortError'))) fin(false); }); };
      held ? onResume.push(go) : go();
    });
  }
  // editor pause: hold the current line (recorded or browser voice) and carry on from the same word on resume
  function holdVoice(on) {
    held = on; const syn = 'speechSynthesis' in window ? speechSynthesis : null;
    if (on) {
      if (curAudio && !curAudio.paused) { curAudio._held = true; curAudio.pause(); }
      if (syn && syn.speaking) syn.pause();
    } else {
      if (curAudio && curAudio._held) { curAudio._held = false; curAudio.play().catch(() => {}); }
      if (syn) syn.resume();
      onResume.splice(0).forEach(f => f());
    }
  }
  let voices = { meera: null, riya: null };
  function pickVoice() {
    if (!('speechSynthesis' in window)) return; const vs = speechSynthesis.getVoices();
    const inF = vs.find(v => /en-IN/i.test(v.lang) && /female|heera|veena|neerja|raveena|kajal|aditi|swara/i.test(v.name));
    const any = inF || vs.find(v => /en-IN/i.test(v.lang)) || vs.find(v => /hi-IN/i.test(v.lang) && /google/i.test(v.name)) || vs.find(v => /en-GB|en-US/i.test(v.lang)) || null;
    voices = { meera: any, riya: any };
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, who) {
    const clean = window.SCRIPT ? SCRIPT.spoken(text) : text;
    return new Promise(res => {
      const v = voices[who] || voices.meera;
      if (MUTE || !v || !('speechSynthesis' in window)) return res(false);
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(clean); u.voice = v; u.lang = v.lang;
      u.rate = who === 'riya' ? 1.04 : .95; u.pitch = who === 'riya' ? 1.45 : 1.05;
      let done = false; const fin = () => { if (!done) { done = true; res(true); } };
      u.onend = fin; u.onerror = fin;
      const go = () => speechSynthesis.speak(u); held ? onResume.push(go) : go();
      gsap.delayedCall((readTime(text) * 2.2 + 2) * gsap.globalTimeline.timeScale(), fin);   // safety net, freezes with a pause
    });
  }
  function hush() { if (curAudio) { curAudio.pause(); curAudio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  /* ================= characters ================= */
  // Commander Meera on the ship deck (full-body poses)
  const POSE = { idle: 'off_idle', right: 'off_right', left: 'off_left', thumb: 'off_thumb', cheer: 'off_cheer', think: 'off_think', bino: 'off_bino' };
  const offImg = $('#offImg');
  function pose(p) {
    const f = POSE[p] || POSE.idle; if (offImg.src.endsWith(f + '.webp')) return;
    offImg.src = 'assets/img/' + f + '.webp';
    gsap.fromTo('#officer', { scaleY: .94, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: .35, ease: 'back.out(3)' });
  }
  /* ================= talking faces =================
     Each talking sprite has a face sprite sheet (assets/img/talk_*.webp, made from the sprite itself with Nano Banana Pro):
     6 frames M closed · E "eh" · A "ah" · O "oo" · I "ee" · B blink, laid over the face of the body sprite.
     While a recorded line plays, the mouth follows VO_MOUTH (its loudness, 12 values a second, from tools/make_voices.py);
     otherwise a 3.6 s talking loop plays. Every face blinks now and then while its mouth is closed. */
  const FACES = {
    meera_right_big: { sheet: 'talk_meera_full', box: [125, 22, 300, 300], size: [700, 1101] },
    meera_talk_1:    { sheet: 'talk_meera_half', box: [100, 40, 280, 280], size: [383, 503] },
    riya_idle:       { sheet: 'talk_riya',       box: [110, 60, 260, 260], size: [389, 856] },
    riya_cheer:      { sheet: 'talk_riya_cheer', box: [130, 55, 260, 260], size: [439, 841] },
  };
  Object.values(FACES).forEach(f => { const i = new Image(); i.src = `assets/img/${f.sheet}.webp`; });
  const FR = { M: 0, E: 1, A: 2, O: 3, I: 4, B: 5 }, LOOP = 'EAIEMOAIEMMEIAOEMMMEAIEOAEMMIEAOEMMM';   // 36 steps × 0.1 s
  const MOUTH = window.VO_MOUTH || {}, live = new Set();
  let talker = null;
  const show = (el, k) => { if (el._k !== k) { el._k = k; el.style.backgroundPosition = k * 20 + '% 0'; } };
  // put (or switch) the face layer on a sprite <img>; its parent must wrap the image exactly (position: relative/absolute)
  function face(img, name) {
    const f = FACES[name]; let el = img._face;
    if (!f) { if (el) el.style.display = 'none'; return null; }
    if (!el) { el = img._face = document.createElement('i'); el.className = 'face'; img.after(el); }
    const [x, y, w, h] = f.box, [W, H] = f.size;
    Object.assign(el.style, { display: '', left: x / W * 100 + '%', top: y / H * 100 + '%', width: w / W * 100 + '%', height: h / H * 100 + '%', backgroundImage: `url(assets/img/${f.sheet}.webp)` });
    el._name = name; el._k = -1; show(el, 0); el._blink = performance.now() + 1200 + Math.random() * 2500; live.add(el);
    return el;
  }
  (function faces(now) {
    requestAnimationFrame(faces);
    if (window.SD && SD.paused) return;
    for (const el of live) {
      if (!el.isConnected) { live.delete(el); continue; }
      let st = 'M';
      if (talker && talker.el === el) {
        const env = MOUTH[talker.id];
        if (env && voice._id === talker.id && !voice.paused) {   // lip-sync to where the voice actually is
          const k = Math.floor((voice.currentTime + .04) * 12), lv = env[k] || '0';
          st = lv === '0' ? 'M' : lv === '3' ? 'A' : lv === '2' ? (k % 4 < 2 ? 'I' : 'E') : (k % 3 ? 'E' : 'O');
        } else if (!env || voice._id !== talker.id) st = LOOP[Math.floor((now - talker.t0) / 100) % LOOP.length];
      }
      if (st === 'M') { if (now > el._blink + 140) el._blink = now + 2200 + Math.random() * 2800; else if (now >= el._blink) st = 'B'; }
      show(el, FR[st]);
    }
  })(0);
  function talking(el, id, on) { if (on) talker = el ? { el, id, t0: performance.now() } : null; else if (talker && talker.el === el) talker = null; }

  // comms portrait next to the caption: Meera waist-up / Riya, each with a talking face
  const pImg = $('#pImg'), pSpr = $('#pSpr'), pName = $('#pName'), comms = $('#comms');
  ['assets/img/riya_idle.webp', 'assets/img/riya_cheer.webp'].forEach(s => { const i = new Image(); i.src = s; });
  let curWho = null;
  function portrait(who, mood) {
    comms.classList.toggle('riya', who === 'riya');
    pName.textContent = SCRIPT.WHO[who].name;
    const name = who === 'riya' ? (mood === 'cheer' ? 'riya_cheer' : 'riya_idle') : 'meera_talk_1';
    if (!pImg.src.endsWith(name + '.webp')) pImg.src = `assets/img/${name}.webp`;
    if (!pImg._face || pImg._face._name !== name) face(pImg, name);
    pSpr.className = who + (mood === 'cheer' ? ' cheer' : '');
    if (curWho !== who) gsap.fromTo('#portrait', { scale: .7, rotation: -8 }, { scale: 1, rotation: 0, duration: .4, ease: 'back.out(2.4)' });
    curWho = who;
  }
  face(pImg, 'meera_talk_1');

  /* ================= caption / speech bubble + say ================= */
  let lastLine = null, sayN = 0;
  window.SD_MISSING = [];
  async function say(x, o = {}) {
    const L = typeof x === 'string' ? (window.SCRIPT && SCRIPT.find(x)) : x;
    const text = typeof x === 'string' ? x : x.text, who = o.who || (L && L.who) || 'meera', id = L && L.id;
    if (!L) SD_MISSING.push(text);
    lastLine = { x, o }; const my = ++sayN;
    if (o.pose && who === 'meera') pose(o.pose);
    let box;
    if (o.bubble) { box = o.bubble; box.querySelector('.txt').innerHTML = text; }
    else {
      portrait(who, o.mood);
      box = $('#caption'); box.innerHTML = text;
      gsap.killTweensOf('#comms'); gsap.to('#comms', { opacity: 1, duration: .25 });
      gsap.fromTo(box, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: .3 });
    }
    const fc = o.bubble ? o.face : pImg._face;          // whose face talks: the story actor, or the comms portrait
    talking(fc, id, true); duck(true);
    const t0 = performance.now();
    const skipP = new Promise(r => { skipFn = r; });
    const spokeP = playVO(id).then(ok => ok || speak(text, who));
    const spoke = await Promise.race([spokeP, skipP.then(() => 'skip')]);
    if (spoke !== 'skip') {
      const spent = (performance.now() - t0) / 1000 * SPEED, min = spoke ? .25 : readTime(text);
      if (spent < min) await Promise.race([wait(min - spent), skipP]);
    } else hush();
    skipFn = null;
    talking(fc, id, false);
    if (my !== sayN) return;
    duck(false);
    if (!o.keep && !o.bubble) captionOff(.25);
    await wait(.3);
  }
  function captionOff(delay = 0) { gsap.to('#comms', { opacity: 0, duration: .3, delay }); }
  function skip() { if (skipFn) { const f = skipFn; skipFn = null; hush(); f(); } }

  window.SD = { $, Q, SPEED, MUTE, wait, fmt, readTime, audioOn, SFX, say, hush, skip, captionOff, pose, talking, portrait, face, get lastLine() { return lastLine; },
    // editor hooks: paused = freeze ticker work + spawners · rate = extra speed factor for ticker-driven motion · where = current section
    paused: false, rate: 1, where: { at: 'title', round: 1 }, get audioCtx() { return AC; }, holdVoice, fit, inset, layoutCSS, applyLayout };
})();
