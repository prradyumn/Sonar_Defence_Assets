/* cockpit: the game is seen from inside the submarine.
   world.js still draws the sea, the scale, the enemy submarines and every effect; this file swaps the ship's launcher for the
   bow cannon that slides along under the scale and fires the torpedoes, puts Meera and Riya at their stations (their talking sheets play while they speak) and adds cockpit
   feedback: red warning lamps on a miss, a hull kick when a torpedo leaves, the engines rumbling when we sail on.
   The fun layer (bottom of the file) adds the hit moment, escape pods, sea life, the streak glow and the dive between levels. */
(function () {
  const { $, SFX } = SD, X = W.X, el = W.el, sea = $('#bubbles');   // sea: outside the glass, behind the scale

  /* ---- crew ---- */
  const crew = $('#crew');
  function mate(who, flip) {
    const t = SD.talker(who), d = document.createElement('div'); d.className = 'mate ' + who; d.dataset.edit = 'crew-' + who;
    if (flip) { const f = document.createElement('div'); f.className = 'flip'; f.appendChild(t.el); d.appendChild(f); } else d.appendChild(t.el);
    crew.appendChild(d);
    return v => { t.talk(v); d.classList.toggle('speaking', v); };
  }
  SD.crew = { meera: mate('meera'), riya: mate('riya', true) };   // core.js say() animates whoever is speaking

  /* ---- console screen: a slow sonar trace while nobody is talking (dialogue appears on the same screen) ---- */
  const scope = $('#scope'), comms = $('#comms');
  const SW = scope.clientWidth || 1068, SH = scope.clientHeight || 102, MID = SH / 2;
  scope.innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none"><path d="M0 ${MID} H${SW}" stroke="rgba(73,220,255,.18)" stroke-width="2"/>` +
    '<path id="trace" fill="none" stroke="#49dcff" stroke-width="3" stroke-linejoin="round" opacity=".7"/></svg><span class="lbl2">SONAR</span>';
  const trace = $('#trace');
  gsap.ticker.add(t => {
    const talk = +gsap.getProperty(comms, 'opacity'), mission = +gsap.getProperty('#strip', 'opacity');
    scope.style.opacity = (1 - talk) * (1 - mission) * .9;   // quiet during a mission: the trace + depth show only between missions
    if (talk > .95 || SD.paused) return;
    const ph = (t * .35) % 1.3 - .15; let d = '';
    for (let x = 0; x <= SW; x += 8) { const u = x / SW, k = Math.exp(-Math.pow((u - ph) / .035, 2)); d += (x ? ' L' : 'M') + x + ' ' + (MID - Math.sin(u * 90) * MID * .55 * k - Math.sin(u * 13 + t * 2) * 3).toFixed(1); }
    trace.setAttribute('d', d);
  });

  /* ---- the bow cannon (assets/img/cannon.webp): front-facing, its wheels ride the console rail. It slides along under
     the scale to the column of the submarine you tap, so it lines up with that number, then fires straight ahead.
     Home is under 0; it glides back there between missions. ---- */
  const cn = $('#cannon'), cflash = cn.querySelector('.flash'), cring = cn.querySelector('.ring');
  const ccs = getComputedStyle(cn), MUZZLE_Y = parseFloat(ccs.top) + .05 * parseFloat(ccs.height);   // the barrel's far end (5 % down the sprite)
  const C = { x: X(0) }, place = () => gsap.set(cn, { x: C.x });
  place();
  gsap.to(cring, { opacity: .9, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  // it sits out in the water: a few bubbles drift up off the muzzle now and then
  setInterval(() => {
    if (document.hidden || SD.paused) return;
    for (let i = 0; i < 2; i++) {
      const r = 3 + Math.random() * 4, b = el('pbub', sea, { left: (C.x + (Math.random() - .5) * 24) + 'px', top: (MUZZLE_Y + 4) + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.to(b, { y: -70 - Math.random() * 60, x: (Math.random() - .5) * 40, opacity: 0, duration: 1.8 + Math.random(), delay: i * .25, ease: 'sine.out', onComplete: () => b.remove() });
    }
  }, 1100);
  let move = null;
  function slideTo(x, dur) {
    if (move) move.kill();
    const d = x - C.x; if (Math.abs(d) < 1) return (move = null);
    const t = dur || Math.min(.8, .22 + Math.abs(d) / 2200), dir = Math.sign(d);
    gsap.killTweensOf(cn, 'rotation');
    gsap.timeline().to(cn, { rotation: -2.5 * dir, duration: t * .4, ease: 'power2.out' })     // the top lags as it sets off…
      .to(cn, { rotation: 2 * dir, duration: t * .6, ease: 'power1.inOut' })                     // …swings forward as it brakes…
      .to(cn, { rotation: 0, duration: .5, ease: 'elastic.out(1,.45)' });                          // …and settles
    return (move = gsap.to(C, { x, duration: t, ease: 'power2.inOut', onUpdate: place }));
  }
  const arrive = () => new Promise(r => { if (!move || !move.isActive()) return r(); move.then(() => r()); gsap.delayedCall(1, r); });
  W.aimHook = x => slideTo(x);                     // W.lock / W.wrong: line up under that submarine
  const clear0 = W.clearSubs;
  W.clearSubs = () => { slideTo(X(0), .9); return clear0(); };

  /* ---- hull kick: the whole cockpit jolts ---- */
  const kick = (k = 10, d = .35) => W.shake(k / 2, d);   // the whole view shakes as one piece (world.js)

  /* ---- torpedo: out of the cannon's muzzle, running away from us (it shrinks) to the target ---- */
  W.fire = async (s, ret) => {
    await arrive();
    const tx = X(s.v), ty = s.cy, sx = C.x, sy = MUZZLE_Y, cx = (sx + tx) / 2, cy = (sy + ty) / 2;
    SFX.launch(); kick(10, .3);
    // recoil + muzzle flash + a burst of bubbles
    gsap.fromTo(cn, { y: 0 }, { keyframes: [{ y: 16, duration: .06, ease: 'power2.out' }, { y: 0, duration: .5, ease: 'elastic.out(1,.45)' }] });
    gsap.fromTo(cflash, { opacity: 1, scale: .35 }, { opacity: 0, scale: 1.5, duration: .38, ease: 'power2.out' });
    for (let i = 0; i < 9; i++) { const b = el('pbub', sea, { left: (sx + (Math.random() - .5) * 60) + 'px', top: (sy - 20 + Math.random() * 20) + 'px', width: '14px', height: '14px' }); gsap.to(b, { y: -60 - Math.random() * 90, x: (Math.random() - .5) * 120, scale: 1.6, opacity: 0, duration: 1 + Math.random() * .6, onComplete: () => b.remove() }); }
    const t = new Image(); t.src = 'assets/img/torpedo.webp'; t.className = 'torp'; sea.appendChild(t);   // it runs outside, behind the scale on the glass
    const sup = cn.classList.contains('gold'); if (sup) { t.style.filter = 'sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.15) drop-shadow(0 0 12px #ffd66b)'; SFX.sparkle(); }
    const o = { p: 0 }; let last = 0;
    await new Promise(r => gsap.to(o, { p: 1, duration: .8, ease: 'power1.in', onUpdate() {
      const p = o.p, q = 1 - p, x = q * q * sx + 2 * q * p * cx + p * p * tx, y = q * q * sy + 2 * q * p * cy + p * p * ty;
      const dx = 2 * q * (cx - sx) + 2 * p * (tx - cx), dy = 2 * q * (cy - sy) + 2 * p * (ty - cy);
      t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scale(${1.3 - .75 * p})`;
      if (p - last > .06) { last = p; const b = el('tbub', sea, { left: x + 'px', top: y + 'px', width: (16 - 8 * p) + 'px', height: (16 - 8 * p) + 'px' }); if (sup) b.style.background = 'rgba(255,214,107,.7)'; gsap.to(b, { y: -30 - Math.random() * 30, scale: 1.8, opacity: 0, duration: 1.1, onComplete: () => b.remove() }); }
    }, onComplete: r }));
    t.remove(); if (ret) ret.remove();
    kick(sup ? 14 : 8, sup ? .6 : .45);
    if (sup) superBurst(tx, ty);
    await W.blast(s);
  };

  /* ---- a hit submarine sinks behind the scale (the scale is on the glass, the submarine is outside) ---- */
  const blast0 = W.blast;
  W.blast = s => { $('#sunk').appendChild(s.d); hitMoment(s); return blast0(s); };

  /* ---- a miss: the warning lamps flash red and the window glows ---- */
  const wrong0 = W.wrong;
  W.wrong = async s => {
    const lamps = $('#lamps').querySelectorAll('i'), edge = $('#lamps .edge');
    gsap.fromTo(lamps, { opacity: 0 }, { opacity: 1, duration: .14, yoyo: true, repeat: 5, ease: 'power1.inOut' });
    gsap.fromTo(edge, { opacity: 0 }, { opacity: .9, duration: .2, yoyo: true, repeat: 3 });
    setStreak(0); kick(5, .3); arrive().then(() => gsap.fromTo(cn, { rotation: 0 }, { rotation: 2.5, duration: .05, yoyo: true, repeat: 5 }));   // the cannon judders: no shot
    return wrong0(s);
  };

  /* ---- full speed ahead: the engines rumble ---- */
  const sail0 = W.sail;
  W.sail = async (dur = 1.6) => { kick(4, dur); visitor(); return sail0(dur); };

  /* ======================= fun layer ======================= */
  const top = $('#fxTop'), glassFx = $('#glassFx'), vis = $('#visitors'), DY = () => W.CONFIG.SCALE_DY;
  const fmt = SD.fmt || (v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v));

  // 1 · direct hit: the number under the sub pops up big (the screen shake comes from world.js)
  function hitMoment(s) {
    const x = X(s.v), y = s.cy, ly = 488 + DY() - 70;   // just above the scale's own label
    const lbl = document.querySelectorAll('#scale .lbl')[s.v + 8];
    if (lbl) gsap.fromTo(lbl, { scale: 1 }, { scale: 1.6, duration: .2, yoyo: true, repeat: 1, ease: 'back.out(3)' });
    const n = el('hitnum ' + (s.v < 0 ? 'neg' : s.v > 0 ? 'pos' : 'zero'), top, { left: x + 'px', top: ly + 'px' }); n.textContent = fmt(s.v);
    gsap.timeline({ onComplete: () => n.remove() })
      .fromTo(n, { scale: .2, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: -30, duration: .45, ease: 'back.out(2.6)' })
      .to(n, { y: -110, scale: .7, opacity: 0, duration: .55, ease: 'power2.in' }, '+=.45');
    W.scare(x, y);
    gsap.delayedCall(.35, () => escapePod(x, y));
    glassBubbles(x, y);
  }

  // 2 · escape pod: the enemy crew bail out with a white flag and bob away up out of sight (nobody gets hurt)
  function escapePod(x, y) {
    const p = new Image(); p.src = 'assets/img/escape_pod.webp'; Object.assign(p.style, { width: '92px', left: x - 46 + 'px', top: y - 60 + 'px' }); vis.appendChild(p);
    const side = Math.random() < .5 ? -1 : 1;
    gsap.timeline({ onComplete: () => p.remove() })
      .fromTo(p, { scale: .2, opacity: 0, rotation: -30 * side }, { scale: 1, opacity: 1, y: -70, x: 30 * side, rotation: 8 * side, duration: .45, ease: 'back.out(2.2)' })
      .to(p, { y: -480, x: 30 * side + 60 * side, rotation: -6 * side, duration: 2.6, ease: 'sine.in' })
      .to(p, { opacity: 0, duration: .6 }, '-=.6');
    gsap.to(p, { rotation: '+=10', duration: .4, yoyo: true, repeat: 7, ease: 'sine.inOut', delay: .45 });
  }

  // 3 · bubbles from the blast stick to the glass and slide down
  function glassBubbles(x, y) {
    for (let i = 0; i < 9; i++) {
      const r = 5 + Math.random() * 11, b = el('gbub', glassFx, { left: (x + (Math.random() - .5) * 440) + 'px', top: (y + (Math.random() - .5) * 240) + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.timeline({ delay: .1 + Math.random() * .3, onComplete: () => b.remove() })
        .fromTo(b, { scale: 0, opacity: 0 }, { scale: 1, opacity: .9, duration: .25, ease: 'back.out(3)' })
        .to(b, { y: 60 + Math.random() * 120, duration: 3 + Math.random() * 2, ease: 'power1.in' })
        .to(b, { opacity: 0, duration: .8 }, '-=.8');
    }
  }
  const knock = (x, y) => { SFX.tap(); const k = el('knock', glassFx, { left: x + 'px', top: y + 'px' }); gsap.fromTo(k, { scale: .2, opacity: 1 }, { scale: 1.7, opacity: 0, duration: .55, ease: 'power2.out', onComplete: () => k.remove() }); };

  // 4 · streak: three first-try hits in a row turn the cannon gold; the next shot is a super torpedo
  let streak = 0;
  function setStreak(n) {
    streak = n; const was = cn.classList.contains('gold'), on = streak >= 3; cn.classList.toggle('gold', on);
    if (on && !was) { SFX.sparkle(); gsap.fromTo(cn, { scale: 1 }, { scale: 1.12, duration: .22, yoyo: true, repeat: 1, ease: 'back.out(3)' }); W.sparkle(C.x, MUZZLE_Y + 40); }
  }
  const reward0 = W.reward;
  W.reward = o => { if (cn.classList.contains('gold') && W._superDone) { W._superDone = false; setStreak(0); } else setStreak(o && o.big ? streak + 1 : 0); return reward0(o); };
  function superBurst(x, y) {
    W._superDone = true;
    for (let i = 0; i < 3; i++) { const r = el('zboom', $('#fx'), { left: x + 'px', top: y + 'px' }); gsap.fromTo(r, { scale: .3, opacity: 1 }, { scale: 3 + i, opacity: 0, duration: .8, delay: i * .12, ease: 'power2.out', onComplete: () => r.remove() }); }
    gsap.delayedCall(.15, () => { W.sparkle(x - 80, y); W.sparkle(x + 80, y - 30); });
  }

  // 5 · sea life: every other time we sail on, a turtle, an octopus or a jellyfish comes up to the window and knocks
  const CREATURES = [
    { src: 'turtle.webp', w: 250, from: [-320, 300], at: [330, 270], away: [-340, 110], tap: [450, 285] },
    { src: 'octopus.webp', w: 200, from: [2180, 340], at: [1580, 290], away: [2200, 160], tap: [1490, 300] },
    { src: 'jelly.webp', w: 150, from: [2120, 420], at: [1560, 280], away: [1500, -340], tap: [1560, 330] },
  ];
  let sails = 0, nextC = 0;
  function visitor() {
    if (sails++ % 2 || SD.paused) return;
    const c = CREATURES[nextC++ % CREATURES.length], im = new Image(); im.src = 'assets/img/' + c.src; im.style.width = c.w + 'px'; vis.appendChild(im);
    gsap.set(im, { xPercent: -50, yPercent: -50, x: c.from[0], y: c.from[1], scale: .85 });
    gsap.timeline({ onComplete: () => im.remove() })
      .to(im, { x: c.at[0], y: c.at[1], scale: 1, duration: .9, ease: 'power2.out' })
      .to(im, { scale: 1.1, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out', onStart: () => knock(...c.tap) })
      .to(im, { scale: 1.1, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out', onStart: () => knock(c.tap[0] + 12, c.tap[1] - 10) }, '+=.12')
      .to(im, { x: c.away[0], y: c.away[1], scale: .8, duration: 1, ease: 'power2.in' }, '+=.25');
    gsap.to(im, { rotation: 4, duration: .5, yoyo: true, repeat: 5, ease: 'sine.inOut' });
  }

  // 6 · deeper each level: the sea darkens a step, glowing plankton appear, the depth on the console counts down
  const DEPTH = { 'LEVEL 1': [1, 60], 'LEVEL 2': [2, 110], 'LEVEL 3': [3, 160], 'FINAL MISSION': [4, 220] };
  const tint = $('#depthTint'), pk = $('#plankton'), pc = pk.getContext('2d'), PK = []; pc.scale(.5, .5);   // half-resolution canvas
  const dl = document.createElement('span'); dl.className = 'depth'; scope.appendChild(dl);
  const D = { m: 20, lvl: 0 }; const showDepth = () => { dl.textContent = 'DEPTH ' + Math.round(D.m) + ' m'; }; showDepth();
  gsap.ticker.add((t, dt) => {
    if (SD.paused || !PK.length) return; pc.clearRect(0, 0, 1920, 1080);   // nothing to draw until the first dive
    const s = dt / 1000 * SD.rate;
    for (const q of PK) {
      q.y -= q.v * s; q.x -= 12 * s * W.mult; if (q.y < 100) q.y = 920; if (q.x < 0) q.x = 1920;
      const a = (.35 + .65 * (.5 + .5 * Math.sin(t * q.f + q.ph))) * q.a;
      pc.globalAlpha = a; pc.fillStyle = q.c; pc.beginPath(); pc.arc(q.x, q.y, q.r, 0, 6.283); pc.fill();
      pc.globalAlpha = a * .35; pc.beginPath(); pc.arc(q.x, q.y, q.r * 3.6, 0, 6.283); pc.fill();
    }
  });
  const banner0 = W.banner;
  W.banner = (k, ...rest) => {
    const d = DEPTH[k];
    if (d && d[0] !== D.lvl) {
      D.lvl = d[0];
      gsap.to(tint, { opacity: [0, .12, .2, .27, .34][D.lvl], duration: 1.8, ease: 'sine.inOut' });
      gsap.to(D, { m: d[1], duration: 1.8, ease: 'power1.inOut', onUpdate: showDepth });
      for (let i = 0; i < 12; i++) setTimeout(() => W.spawnBubble(true), i * 90);   // we dive: bubbles rush up past the window
      while (PK.length < D.lvl * 14) PK.push({ x: Math.random() * 1920, y: 140 + Math.random() * 760, r: 2.4 + Math.random() * 3.2, v: 6 + Math.random() * 14,
        f: .8 + Math.random() * 1.6, ph: Math.random() * 6, a: .5 + Math.random() * .5, c: ['#9ff6ff', '#c7b3ff', '#7dffc8'][PK.length % 3] });
    }
    return banner0(k, ...rest);
  };

  // 7 · a level done: confetti and a glow at Meera's and Riya's stations (no jumping: the sheets stay as drawn)
  const done = $('#done');
  new MutationObserver(() => {
    if (done.classList.contains('hidden')) return;
    document.querySelectorAll('.mate').forEach(m => { m.classList.add('party'); setTimeout(() => m.classList.remove('party'), 2400); });
    [[190, 830], [1730, 830]].forEach(([x, y], i) => [0, .5, 1].forEach(d => gsap.delayedCall(d + i * .2, () => W.sparkle(x, y - 60 * Math.random()))));
  }).observe(done, { attributes: true, attributeFilter: ['class'] });
})();
