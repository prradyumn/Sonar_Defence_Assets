/* fx: the wow layer — sound design + VFX on top of world.js / cockpit.js (loaded last, before the QA jumper and editor).
   1 pitch follows the number line (−8 low … +8 high)   2 the torpedo lights up the sea, the blast lights the window frame
   3 outside sounds come through the glass (muffled, panned left/right), a hit = beat of silence → deep thump → glass rattle
   4 a hit submarine breaks in two                    5 a sonar sweep from 0 finds the submarines before they rise
   6 a distance beam runs from the hit number to 0   7 a soft tension layer while the child is choosing
   8 level complete: we surface into sunlight and the stars slam down
   Everything animates transform / opacity only (no per-frame repaints). */
(function () {
  const { $, SFX } = SD, snd = SD.snd, X = W.X, el = W.el, wait = SD.wait;
  const pan = x => (x - 960) / 960 * .85;
  let hitPan = 0;

  /* ---------- 1 · pitch = position: a major-pentatonic ladder, so any order sounds musical; right is higher ---------- */
  const DEG = [0, 2, 4, 7, 9];
  const freq = v => { const i = Math.max(0, Math.min(16, v + 8)); return 196 * Math.pow(2, (12 * Math.floor(i / 5) + DEG[i % 5]) / 12); };
  function note(v, o = {}) {
    const f = freq(v) * (o.oct || 1) * (o.flat ? .94 : 1), to = { pan: pan(X(v)) };
    snd.tone('triangle', f, 0, o.long ? .7 : .38, o.flat ? .09 : .16, o.delay || 0, to);
    snd.tone('sine', f * 2, 0, o.long ? .5 : .26, o.flat ? .02 : .05, o.delay || 0, to);
    if (o.long) snd.tone('sine', f * 1.5, 0, .6, .05, (o.delay || 0) + .06, to);   // a fifth on top: it rings out
  }
  W.note = note;
  const lock0 = W.lock;
  W.lock = (s, color) => { note(s.v, { flat: color === 'red' }); return lock0(s, color); };   // a wrong tap sounds dull and flat

  /* ---------- 3 · sound through the glass ---------- */
  SFX.boom = () => {
    const out = { out: true, pan: hitPan }, AC = snd.AC, mus = snd.music;
    if (AC && mus) { const t = AC.currentTime, g = mus.gain, v = g.value; g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.linearRampToValueAtTime(.04, t + .05); g.linearRampToValueAtTime(v, t + .9); }   // a beat of silence
    snd.tone('sine', 96, 28, 1, .6, .04, out);                          // the deep thump, through the hull
    snd.sample('explosion', 1, .82, out) || snd.noise(1.1, .5, 500, .04, 0, out);
    for (let i = 0; i < 7; i++) snd.tone('square', 2300 + Math.random() * 1800, 0, .035, .012, .12 + i * .035);   // the glass rattles (inside: crisp)
    snd.noise(.22, .05, 9000, .12, 3200);
  };
  SFX.sink = () => { snd.sample('bubbles', .9, .78, { out: true, pan: hitPan }) || snd.noise(.8, .1, 700, 0, 0, { out: true, pan: hitPan }); };
  const launch0 = SFX.launch;
  SFX.launch = () => { launch0(); snd.tone('sine', 70, 40, .5, .25, 0, { out: true }); };   // the tube's kick in the water

  /* ---------- 2 · the torpedo is a light in the water; the blast lights up the window frame ---------- */
  const sea = $('#bubbles'), light = el('tlight', sea);
  let lit = false;
  gsap.ticker.add(() => {
    const t = sea.querySelector('.torp');
    if (t) {
      if (!lit) { lit = true; gsap.to(light, { opacity: 1, duration: .15 }); }
      const sc = +(t.style.transform.match(/scale\(([\d.]+)\)/) || [0, 1])[1];
      light.style.transform = `translate(${parseFloat(t.style.left)}px,${parseFloat(t.style.top)}px) scale(${(.6 + sc * .6).toFixed(3)})`;
    } else if (lit) { lit = false; gsap.to(light, { opacity: 0, duration: .25 }); }
  });
  // the blast's light lands on the metal frame: a pre-tinted copy of the frame fades in and out (opacity only — no per-frame filter)
  const glow = new Image(); glow.src = 'assets/img/cockpit.webp'; glow.id = 'frameGlow'; $('#cockpit').after(glow);
  function frameFlash() { gsap.fromTo(glow, { opacity: 0 }, { keyframes: [{ opacity: 1, duration: .07 }, { opacity: 0, duration: .7, ease: 'power2.out' }] }); }

  /* ---------- 4 · break in two  +  6 · the distance beam ---------- */
  const sunk = $('#sunk'), scale = $('#scale');
  function breakApart(s) {
    const x = X(s.v), y = s.cy, by = +gsap.getProperty(s.bob, 'y') || 0;
    const half = (clip, dir) => {
      const h = el('subhalf', sunk, { left: (x - 105) + 'px', top: (y - 45 + by) + 'px' }); const im = new Image(); im.src = 'assets/img/sub.webp'; im.style.clipPath = clip; h.appendChild(im);
      gsap.timeline({ delay: .08, onComplete: () => h.remove() })
        .to(h, { x: dir * (50 + Math.random() * 20), y: -18, rotation: dir * 14, duration: .35, ease: 'power2.out' })
        .to(h, { x: dir * 120, y: 230, rotation: dir * 55, opacity: 0, duration: 1.8, ease: 'power1.in' });
      return h;
    };
    half('inset(0 50% 0 0)', -1); half('inset(0 0 0 50%)', 1);
    s.d.style.visibility = 'hidden';
    for (let i = 0; i < 16; i++) {   // bubbles stream out of the break
      const r = 3 + Math.random() * 6, b = el('pbub', sunk, { left: (x + (Math.random() - .5) * 30) + 'px', top: (y + by) + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.to(b, { x: (Math.random() - .5) * 160, y: -90 - Math.random() * 150, opacity: 0, duration: 1.2 + Math.random(), delay: .1 + i * .04, ease: 'power1.out', onComplete: () => b.remove() });
    }
  }
  function beam(v) {
    if (!v) return;
    const a = X(Math.min(v, 0)), w = Math.abs(X(v) - X(0)), b = el('dbeam ' + (v < 0 ? 'neg' : 'pos'), scale, { left: a + 'px', width: w + 'px' });
    gsap.timeline({ delay: .35, onComplete: () => b.remove() })
      .fromTo(b, { scaleX: 0, transformOrigin: v < 0 ? '0% 50%' : '100% 50%', opacity: 1 }, { scaleX: 1, duration: .45, ease: 'power2.inOut' })
      .call(() => { const z = scale.querySelector('.tick.zero'); if (z) gsap.fromTo(z, { scaleY: 1 }, { scaleY: 1.5, duration: .18, yoyo: true, repeat: 1 }); snd.tone('sine', 1568, 0, .3, .06); })
      .to(b, { opacity: 0, duration: .5 }, '+=.15');
  }
  const blast0 = W.blast;
  W.blast = s => {
    const x = X(s.v); hitPan = pan(x);
    breakApart(s); frameFlash(); beam(s.v);
    gsap.delayedCall(.3, () => note(s.v, { oct: 2, long: true }));   // the hit rings out at its own pitch
    return blast0(s);
  };

  /* ---------- 5 · sonar sweep: a pulse runs out from 0 and finds each submarine before it rises ---------- */
  const spawn0 = W.spawn;
  async function sweep(vals) {
    const L = el('shead', scale, { left: X(0) + 'px' }), R = el('shead', scale, { left: X(0) + 'px' }), found = new Set(), lbl = scale.querySelectorAll('.lbl');
    snd.tone('sine', 700, 1600, .9, .07); snd.tone('sine', 1250, 900, .9, .05, .05, { out: true });
    const p = { d: 0 };
    await gsap.fromTo(p, { d: 0 }, { d: 8.6, duration: .85, ease: 'power1.in', onUpdate() {
      L.style.left = X(-p.d) + 'px'; R.style.left = X(p.d) + 'px';
      for (const v of vals) if (!found.has(v) && Math.abs(v) <= p.d) {
        found.add(v); note(v);
        const l = lbl[v + 8]; if (l) gsap.fromTo(l, { scale: 1 }, { scale: 1.5, duration: .16, yoyo: true, repeat: 1, ease: 'back.out(3)' });
        const ring = el('sring', scale, { left: X(v) + 'px' }); gsap.fromTo(ring, { scale: .3, opacity: 1 }, { scale: 1.8, opacity: 0, duration: .6, onComplete: () => ring.remove() });
      }
    } });
    gsap.to([L, R], { opacity: 0, duration: .2, onComplete: () => { L.remove(); R.remove(); } });
  }
  W.spawn = async (vals, o = {}) => { if (+getComputedStyle(scale).opacity > .5) await sweep(vals); return spawn0(vals, o); };

  /* ---------- 7 · tension while choosing: a low drone + soft heartbeat, gone the moment they fire ---------- */
  let pad = null, beat = 0;
  gsap.ticker.add((t) => {
    const AC = snd.AC; if (!AC || !snd.music) return;
    if (!pad) {
      pad = AC.createGain(); pad.gain.value = 0; pad.connect(snd.music);
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.connect(pad);
      [[55, 'sine', .9], [82.4, 'sine', .6], [110, 'sawtooth', .18]].forEach(([fr, ty, g0]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = ty; o.frequency.value = fr; o.detune.value = (Math.random() - .5) * 14; g.gain.value = g0; o.connect(g); g.connect(f); o.start(); });
    }
    const choosing = !SD.paused && (W.waiting || (W._pairBoxes || []).some(b => !b._used && b.isConnected));
    pad.gain.setTargetAtTime(choosing ? .09 : 0, AC.currentTime, choosing ? .9 : .12);
    if (choosing && t - beat > .82) { beat = t; snd.tone('sine', 62, 44, .16, .07, 0, snd.music); snd.tone('sine', 60, 42, .14, .045, .2, snd.music); }
  });

  /* ---------- 9 · water movement: soft current streaks drift past, light shimmers down from the surface ----------
     pre-softened gradients (no blur filter, no blend modes), animated with transform + opacity only */
  const cur = $('#current');
  cur.innerHTML = '<div class="shimmer"><i></i><i></i></div><div class="haze"></div>';
  gsap.to(cur.querySelector('.shimmer'), { x: -480, duration: 22, repeat: -1, ease: 'none' });
  gsap.to(cur.querySelectorAll('.shimmer i'), { opacity: .35, scaleY: 1.25, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 1.6 });
  for (let i = 0; i < 6; i++) {
    const s = el('streak', cur, { top: (190 + i * 115 + Math.random() * 40) + 'px', width: (520 + Math.random() * 520) + 'px' });
    const go = first => {
      const dur = 16 + Math.random() * 12;
      gsap.fromTo(s, { x: first ? Math.random() * 2000 - 600 : 2000, y: 0, opacity: 0 },
        { x: -1200, y: (Math.random() - .5) * 60, duration: dur, ease: 'none', onComplete: () => go(false) });
      gsap.to(s, { keyframes: [{ opacity: .1 + Math.random() * .12, duration: dur * .3 }, { opacity: .1, duration: dur * .4 }, { opacity: 0, duration: dur * .3 }], ease: 'sine.inOut' });
    };
    go(true);
  }

  /* ---------- 8 · level complete: we surface into sunlight, the stars slam down ---------- */
  const done = $('#done'), wash = el('sunwash', $('#water'));
  new MutationObserver(() => {
    if (done.classList.contains('hidden')) { gsap.to(wash, { opacity: 0, duration: 1.2 }); gsap.to('#rays', { filter: 'brightness(1)', duration: 1.2 }); return; }
    gsap.to(wash, { opacity: 1, duration: 1.4, ease: 'sine.out' }); gsap.to('#rays', { filter: 'brightness(1.9)', duration: 1.4 });
    for (let i = 0; i < 14; i++) setTimeout(() => W.spawnBubble(true), i * 70);
    snd.noise(1.4, .12, 1800, 0, 300);
    [392, 494, 587, 784].forEach((f, i) => snd.tone('sine', f, 0, 1.6, .05, .1 + i * .08));
    const stars = done.querySelectorAll('#dstars img');
    stars.forEach((st, i) => gsap.delayedCall(.4 + i * .18 + .4, () => {   // as each star lands (levels.js pops them in with back.out)
      W.shake(3.5, .22); snd.tone('sine', 150, 55, .3, .3); snd.noise(.12, .12, 2500);
      if (!st.classList.contains('off')) snd.tone('triangle', [1047, 1319, 1568][i] || 1568, 0, .5, .1, .03);
    }));
  }).observe(done, { attributes: true, attributeFilter: ['class'] });
})();
