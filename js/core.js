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

  /* ================= sound: recorded music + ambience + effects (assets/sfx), synthesized UI sounds ================= */
  let AC = null, master = null, sfxBus = null, musicBus = null, ambBus = null;
  function audioOn() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = MUTE ? 0 : .8; master.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.gain.value = .75; sfxBus.connect(master);
      musicBus = AC.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
      ambBus = AC.createGain(); ambBus.gain.value = .55; ambBus.connect(master);
      bed('music', want.music, 1.2); bed('amb', want.amb, 1.2);   // already loaded while the cover was showing
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
  /* Recorded sound: assets/sfx/*.ogg (CC0 effects + music made for the game, see assets/sfx/CREDITS.md).
     Over http(s) the files become Web Audio buffers (they overlap, duck under the voice and pause with the AudioContext);
     from file://, where fetch is blocked, each plays through one reused <audio> element. */
  const ONE = { sonar: .5, explosion: .85, splash: .55, torpedo: .75, door_open: .95, door_slide: .85, bubbles: .5, rush: .7 };
  const BED = { music_calm: 'music', music_play: 'music', harbour: 'amb', waves: 'amb' };
  const viaWA = /^https?:$/.test(location.protocol), BUF = {}, EL = {}, beds = {};
  let want = { music: null, amb: null }, ducked = false;
  function loadSounds() {   // runs at boot: an offline context decodes without needing the player's first tap
    const DEC = viaWA && window.OfflineAudioContext ? new OfflineAudioContext(2, 1, 48000) : null;
    for (const n of Object.keys(ONE).concat(Object.keys(BED))) {
      const url = 'assets/sfx/' + n + '.ogg';
      if (DEC) fetch(url).then(r => r.arrayBuffer()).then(b => DEC.decodeAudioData(b)).then(buf => { BUF[n] = buf; if (want[BED[n]] === n) bed(BED[n], n, 2); }).catch(() => {});
      else { const el = new Audio(); el.preload = 'auto'; el.src = url; el.loop = !!BED[n]; EL[n] = el; }
    }
  }
  const fadeEl = (el, to, dur, after) => { gsap.killTweensOf(el); gsap.to(el, { volume: to, duration: dur, ease: 'none', onComplete: after }); };
  // a looping bed: kind 'music' or 'amb' crossfades to track n (null = silence)
  function bed(kind, n, fade = 1.5) {
    want[kind] = n; if (!AC || MUTE) return;
    const cur = beds[kind];
    if (cur && cur.n === n) return;
    if (cur) { beds[kind] = null; if (cur.src) { const g = cur.g.gain, t = AC.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); cur.src.stop(t + fade + .05); } else fadeEl(cur.el, 0, fade, () => cur.el.pause()); }
    if (!n) return;
    if (BUF[n] || (viaWA && window.OfflineAudioContext)) {
      if (!BUF[n]) return;   // starts when decoded (loadSounds)
      const src = AC.createBufferSource(), g = AC.createGain(), t = AC.currentTime; src.buffer = BUF[n]; src.loop = true;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade); src.connect(g); g.connect(kind === 'music' ? musicBus : ambBus); src.start(t);
      beds[kind] = { n, src, g };
    } else {
      const el = EL[n]; if (!el) return; el.volume = 0; el.currentTime = 0; el.play().catch(() => {});
      beds[kind] = { n, el }; fadeEl(el, elVol(kind), fade);
    }
  }
  const elVol = kind => (kind === 'music' ? (ducked ? .18 : .55) : (ducked ? .4 : .55)) * .8;
  // a one-shot; false when the file isn't there, so the caller can fall back to the synth
  function sample(n, vol = 1, rate = 1) {
    if (!AC || MUTE) return true;
    if (!EL[n]) { const b = BUF[n]; if (!b) return false; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = ONE[n] * vol; s.connect(g); g.connect(sfxBus); s.start(); return true; }
    const el = EL[n]; if (!el || el.error) return false;
    el.volume = Math.min(1, ONE[n] * vol * .75); el.playbackRate = rate; el.currentTime = 0; el.play().catch(() => {}); return true;
  }
  function holdMedia(on) { for (const el of Object.values(EL)) { if (on && !el.paused) { el._held = true; el.pause(); } else if (!on && el._held) { el._held = false; el.play().catch(() => {}); } } }
  // the music (and a little of the ambience) dips under every spoken line
  function duck(on) {
    ducked = on; if (!AC) return;
    const t = AC.currentTime, ramp = (g, v) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + (on ? .25 : 1.2)); };
    ramp(musicBus, on ? .18 : .55); ramp(ambBus, on ? .4 : .55);
    for (const k of ['music', 'amb']) { const c = beds[k]; if (c && c.el) fadeEl(c.el, elVol(k), on ? .25 : 1.2); }
  }
  if (!MUTE) loadSounds();
  let lastSonar = 0;

  const SFX = {
    ping() {   // a real sonar ping; a burst of pings (submarines rising one by one) turns into soft bubbles after the first
      const now = performance.now(); if (now - lastSonar < 700) { sample('bubbles', .7, .9 + Math.random() * .25) || tone('sine', 1250, 900, .6, .08); return; }
      lastSonar = now; sample('sonar') || (tone('sine', 1250, 900, 1.1, .16), tone('sine', 1250, 900, .9, .05, .35));
    },
    lock() { tone('square', 880, 1320, .09, .07); tone('square', 1320, 1760, .09, .06, .1); },
    launch() { noise(.18, .2, 700, 0, 120); sample('torpedo') || (noise(.55, .28, 900, 0, 120), tone('sawtooth', 220, 90, .5, .06)); },
    boom() { tone('sine', 110, 38, .6, .32); sample('explosion') || (noise(.9, .38, 600), tone('sine', 120, 40, .7, .5)); for (let i = 0; i < 5; i++) tone('sine', 500 + Math.random() * 700, 1400, .08, .04, .25 + i * .08); },
    sink() { sample('bubbles', .9, .8); },
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
    hiss(dur = .8) { sample('door_open') || (noise(dur, .2, 9000, 0, 2200), noise(dur * .6, .08, 3200, .05, 900)); },
    doorSlide(dur = 1.8) {
      if (!AC) return; sample('door_slide'); const t = AC.currentTime, o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(46, t); o.frequency.linearRampToValueAtTime(68, t + dur * .55); o.frequency.linearRampToValueAtTime(50, t + dur);
      f.type = 'lowpass'; f.frequency.value = 300;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.1, t + .3); g.gain.setValueAtTime(.1, t + dur - .35); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .05);
      noise(dur, .16, 240); tone('triangle', 230, 320, dur * .8, .025);
    },
    foot() { noise(.07, .1, 900, 0, 160); },
    splash() { sample('splash') || (noise(1, .2, 1500, 0, 280), noise(.5, .08, 6000, .1, 2500)); },
    sail() { sample('rush') || noise(1.2, .18, 700, 0, 200); gsap.delayedCall(.15, () => sample('splash', .6)); },
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
    held = on; holdMedia(on); const syn = 'speechSynthesis' in window ? speechSynthesis : null;
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
    offImg.src = 'assets/img/' + f + '.webp';   // still images: the pose just changes, no squash
  }
  // comms portrait next to the caption: still images (Meera waist-up / Riya)
  const pImg = $('#pImg'), pSpr = $('#pSpr'), pName = $('#pName'), comms = $('#comms');
  ['assets/img/riya_idle.webp', 'assets/img/riya_cheer.webp'].forEach(s => { const i = new Image(); i.src = s; });
  let curWho = null;
  function portrait(who, mood) {
    comms.classList.toggle('riya', who === 'riya');
    pName.textContent = SCRIPT.WHO[who].name;
    const name = who === 'riya' ? (mood === 'cheer' ? 'riya_cheer' : 'riya_idle') : 'meera_talk_1';
    if (!pImg.src.endsWith(name + '.webp')) pImg.src = `assets/img/${name}.webp`;
    pSpr.className = who + (mood === 'cheer' ? ' cheer' : '');
    curWho = who;
  }
  const talking = () => {};   // portrait and deck officer stay still images
  /* story conversations: the Ludo talking sheets (6×6 whole full-body frames, played exactly as drawn).
     A character plays the sheet while their line is spoken, then runs on to the next closed-mouth frame and holds it. */
  const SHEET = {
    meera: { src: 'assets/img/meera_talk_sheet.webp', w: 385, h: 862, ms: 79, rest: [0, 1, 2, 3, 4, 5, 6, 9, 14, 24, 30, 31] },
    riya: { src: 'assets/img/riya_talk_sheet.webp', w: 386, h: 828, ms: 90, rest: [4, 5, 6, 7, 8, 22, 23] },
  };
  for (const k in SHEET) { const s = SHEET[k]; s.img = new Image(); s.img.src = s.src; }
  function talker(who) {
    const s = SHEET[who], c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = s.w; c.height = s.h;
    let f = s.rest[0], on = false, acc = 0, ticking = false;
    const draw = () => { g.clearRect(0, 0, s.w, s.h); g.drawImage(s.img, (f % 6) * s.w, (f / 6 | 0) * s.h, s.w, s.h, 0, 0, s.w, s.h); };
    if (s.img.complete) draw(); else s.img.addEventListener('load', draw, { once: true });
    const halt = () => { gsap.ticker.remove(tick); ticking = false; acc = 0; };
    function tick(t, dt) {
      if (!c.isConnected) return halt();
      if (SD.paused) return;
      const step = on ? s.ms : s.ms / 2;   // settling to a closed mouth runs at double speed
      acc = Math.min(acc + dt * Math.min(SPEED, 2) * SD.rate, step * 3);
      let moved = false;
      while (acc >= step) {
        acc -= step;
        if (!on && s.rest.includes(f)) { halt(); break; }
        f = (f + 1) % 36; moved = true;
      }
      if (moved) draw();
    }
    return { el: c, talk(v) { on = v; if (!ticking && (v || !s.rest.includes(f))) { ticking = true; gsap.ticker.add(tick); } } };
  }

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
    duck(true);
    const t0 = performance.now();
    const skipP = new Promise(r => { skipFn = r; });
    if (o.talk) o.talk(true);
    const spokeP = playVO(id).then(ok => ok || speak(text, who));
    const spoke = await Promise.race([spokeP, skipP.then(() => 'skip')]);
    if (spoke !== 'skip') {
      const spent = (performance.now() - t0) / 1000 * SPEED, min = spoke ? .25 : readTime(text);
      if (spent < min) await Promise.race([wait(min - spent), skipP]);
    } else hush();
    if (o.talk) o.talk(false);
    skipFn = null;
    if (my !== sayN) return;
    duck(false);
    if (!o.keep && !o.bubble) captionOff(.25);
    await wait(.3);
  }
  function captionOff(delay = 0) { gsap.to('#comms', { opacity: 0, duration: .3, delay }); }
  function skip() { if (skipFn) { const f = skipFn; skipFn = null; hush(); f(); } }

  window.SD = { $, Q, SPEED, MUTE, wait, fmt, readTime, audioOn, SFX, say, hush, skip, captionOff, pose, talking, talker, portrait, music: n => bed('music', n && 'music_' + n), ambience: n => bed('amb', n), get lastLine() { return lastLine; },
    // editor hooks: paused = freeze ticker work + spawners · rate = extra speed factor for ticker-driven motion · where = current section
    paused: false, rate: 1, where: { at: 'title', round: 1 }, get audioCtx() { return AC; }, holdVoice, fit, inset, layoutCSS, applyLayout };
})();
