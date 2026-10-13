/* cockpit: the game is seen from inside the submarine.
   world.js still draws the sea, the scale, the enemy submarines and every effect; this file swaps the ship's launcher for the
   bow cannon that slides along under the scale and fires the torpedoes, puts Meera and Riya at their stations (their talking sheets play while they speak) and adds cockpit
   feedback: red warning lamps on a miss, a hull kick when a torpedo leaves, the engines rumbling when we sail on. */
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
    const talk = +gsap.getProperty(comms, 'opacity'); scope.style.opacity = (1 - talk) * .9;
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
  const kick = (k = 10, d = .35) => {
    const o = { t: 0 }, parts = ['#cockpit', '#crew', '#screen', '#scope', '#lamps', '#hud'];
    gsap.to(o, { t: 1, duration: d, onUpdate() { const a = (1 - o.t) * k; gsap.set(parts, { x: (Math.random() - .5) * a, y: (Math.random() - .5) * a * .6 }); }, onComplete: () => gsap.set(parts, { x: 0, y: 0 }) });
  };

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
    const o = { p: 0 }; let last = 0;
    await new Promise(r => gsap.to(o, { p: 1, duration: .8, ease: 'power1.in', onUpdate() {
      const p = o.p, q = 1 - p, x = q * q * sx + 2 * q * p * cx + p * p * tx, y = q * q * sy + 2 * q * p * cy + p * p * ty;
      const dx = 2 * q * (cx - sx) + 2 * p * (tx - cx), dy = 2 * q * (cy - sy) + 2 * p * (ty - cy);
      t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scale(${1.3 - .75 * p})`;
      if (p - last > .06) { last = p; const b = el('tbub', sea, { left: x + 'px', top: y + 'px', width: (16 - 8 * p) + 'px', height: (16 - 8 * p) + 'px' }); gsap.to(b, { y: -30 - Math.random() * 30, scale: 1.8, opacity: 0, duration: 1.1, onComplete: () => b.remove() }); }
    }, onComplete: r }));
    t.remove(); if (ret) ret.remove();
    kick(8, .45);
    await W.blast(s);
  };

  /* ---- a hit submarine sinks behind the scale (the scale is on the glass, the submarine is outside) ---- */
  const blast0 = W.blast;
  W.blast = s => { $('#sunk').appendChild(s.d); return blast0(s); };

  /* ---- a miss: the warning lamps flash red and the window glows ---- */
  const wrong0 = W.wrong;
  W.wrong = async s => {
    const lamps = $('#lamps').querySelectorAll('i'), edge = $('#lamps .edge');
    gsap.fromTo(lamps, { opacity: 0 }, { opacity: 1, duration: .14, yoyo: true, repeat: 5, ease: 'power1.inOut' });
    gsap.fromTo(edge, { opacity: 0 }, { opacity: .9, duration: .2, yoyo: true, repeat: 3 });
    kick(5, .3); arrive().then(() => gsap.fromTo(cn, { rotation: 0 }, { rotation: 2.5, duration: .05, yoyo: true, repeat: 5 }));   // the cannon judders: no shot
    return wrong0(s);
  };

  /* ---- full speed ahead: the engines rumble ---- */
  const sail0 = W.sail;
  W.sail = async (dur = 1.6) => { kick(4, dur); return sail0(dur); };
})();
