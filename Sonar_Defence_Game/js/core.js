/* core: stage fit, timing, sound (synth sfx + Indian music bed + recorded voice), captions, characters. */
(function () {
  const $ = s => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  const SPEED = parseFloat(Q.get('speed') || '1');
  if (SPEED !== 1) gsap.globalTimeline.timeScale(SPEED);
  const stage = $('#stage');
  function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px,${(innerHeight - 1080 * s) / 2}px) scale(${s})`; }
  addEventListener('resize', fit); fit();

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
      if (!AC) return;
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
  };

  /* ================= voice: recorded VO (assets/vo/<id>.wav) → browser voice → reading time ================= */
  const VO_OK = id => !MUTE && Array.isArray(window.VO_HAVE) && window.VO_HAVE.includes(id);
  let curAudio = null, skipFn = null;
  function playVO(id) {
    return new Promise(res => {
      if (!VO_OK(id)) return res(false);
      const a = new Audio('assets/vo/' + id + '.wav'); curAudio = a; a.playbackRate = Math.min(SPEED, 2);
      let done = false; const fin = ok => { if (!done) { done = true; if (curAudio === a) curAudio = null; res(ok); } };
      a.onended = () => fin(true); a.onerror = () => fin(false); a.onpause = () => fin(true);
      a.play().catch(() => fin(false));
    });
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
      u.onend = fin; u.onerror = fin; speechSynthesis.speak(u); setTimeout(fin, (readTime(text) * 2.2 + 2) * 1000);
    });
  }
  function hush() { if (curAudio) { curAudio.pause(); curAudio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  /* ================= characters ================= */
  // Commander Meera on the ship deck (full-body poses)
  const POSE = { idle: 'off_idle', right: 'off_right', left: 'off_left', thumb: 'off_thumb', cheer: 'off_cheer', think: 'off_think', bino: 'off_bino' };
  const offImg = $('#offImg'); let talkTw = null;
  function pose(p) {
    const f = POSE[p] || POSE.idle; if (offImg.src.endsWith(f + '.webp')) return;
    offImg.src = 'assets/img/' + f + '.webp';
    gsap.fromTo('#officer', { scaleY: .94, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: .35, ease: 'back.out(3)' });
  }
  // comms portrait next to the caption (waist-up talking frames)
  const pImg = $('#pImg'), pName = $('#pName'), comms = $('#comms');
  const TALK = [1, 2, 3, 4, 5, 6].map(i => `assets/img/meera_talk_${i}.webp`);
  TALK.concat(['assets/img/riya_idle.webp', 'assets/img/riya_cheer.webp']).forEach(s => { const i = new Image(); i.src = s; });
  let frameTimer = null, curWho = null;
  function portrait(who, mood) {
    comms.classList.toggle('riya', who === 'riya');
    pName.textContent = SCRIPT.WHO[who].name;
    if (who === 'riya') pImg.src = `assets/img/${mood === 'cheer' ? 'riya_cheer' : 'riya_idle'}.webp`;
    else pImg.src = TALK[0];
    pImg.className = who + (mood === 'cheer' ? ' cheer' : '');
    if (curWho !== who) gsap.fromTo('#portrait', { scale: .7, rotation: -8 }, { scale: 1, rotation: 0, duration: .4, ease: 'back.out(2.4)' });
    curWho = who;
  }
  function talking(who, on) {
    if (talkTw) { talkTw.kill(); talkTw = null; gsap.to('#offImg,#pImg', { y: 0, rotation: 0, duration: .15 }); }
    clearInterval(frameTimer); frameTimer = null;
    if (!on) return;
    talkTw = gsap.to(who === 'meera' ? '#offImg,#pImg' : '#pImg', { y: -4, rotation: 1.2, duration: .2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    if (who === 'meera') { let k = 0; frameTimer = setInterval(() => { k = (k + 1 + Math.floor(Math.random() * 2)) % TALK.length; pImg.src = TALK[k]; }, 520 / SPEED); }
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
    talking(who, true); duck(true);
    const t0 = performance.now();
    const skipP = new Promise(r => { skipFn = r; });
    const spokeP = playVO(id).then(ok => ok || speak(text, who));
    const spoke = await Promise.race([spokeP, skipP.then(() => 'skip')]);
    if (spoke !== 'skip') {
      const spent = (performance.now() - t0) / 1000 * SPEED, min = spoke ? .25 : readTime(text);
      if (spent < min) await Promise.race([wait(min - spent), skipP]);
    } else hush();
    skipFn = null;
    if (my !== sayN) return;
    talking(who, false); duck(false);
    if (!o.keep && !o.bubble) captionOff(.25);
    await wait(.3);
  }
  function captionOff(delay = 0) { gsap.to('#comms', { opacity: 0, duration: .3, delay }); }
  function skip() { if (skipFn) { const f = skipFn; skipFn = null; hush(); f(); } }

  window.SD = { $, Q, SPEED, MUTE, wait, fmt, readTime, audioOn, SFX, say, hush, skip, captionOff, pose, talking, portrait, get lastLine() { return lastLine; } };
})();
