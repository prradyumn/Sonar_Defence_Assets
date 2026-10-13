/* cockpit: sub.html only — the same game seen from inside the submarine.
   world.js still draws the sea, the scale, the enemy submarines and every effect; this file swaps the ship's launcher for the
   bow torpedo tube, puts Meera and Riya at their stations (their talking sheets play while they speak) and adds cockpit
   feedback: red warning lamps on a miss, a hull kick when a torpedo leaves, the engines rumbling when we sail on. */
(function () {
  const { $, SFX } = SD, X = W.X, el = W.el, sea = $('#bubbles');   // sea: outside the glass, behind the scale
  const TUBE = { x: 960, y: 820 };                 // the bow tube, just below the window (the frame hides the start)

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
  scope.innerHTML = '<svg viewBox="0 0 1064 212" preserveAspectRatio="none"><path d="M0 106 H1064" stroke="rgba(73,220,255,.18)" stroke-width="2"/>' +
    '<path id="trace" fill="none" stroke="#49dcff" stroke-width="3" stroke-linejoin="round" opacity=".7"/></svg><span class="lbl2">SONAR</span>';
  const trace = $('#trace');
  gsap.ticker.add(t => {
    const talk = +gsap.getProperty(comms, 'opacity'); scope.style.opacity = (1 - talk) * .9;
    if (talk > .95 || SD.paused) return;
    const ph = (t * .35) % 1.3 - .15; let d = '';
    for (let x = 0; x <= 1064; x += 8) { const u = x / 1064, k = Math.exp(-Math.pow((u - ph) / .035, 2)); d += (x ? ' L' : 'M') + x + ' ' + (106 - Math.sin(u * 90) * 46 * k - Math.sin(u * 13 + t * 2) * 3).toFixed(1); }
    trace.setAttribute('d', d);
  });

  /* ---- aiming: the reticle does it; nothing on board rotates ---- */
  W.aimHook = () => null;

  /* ---- hull kick: the whole cockpit jolts ---- */
  const kick = (k = 10, d = .35) => {
    const o = { t: 0 }, parts = ['#cockpit', '#crew', '#screen', '#lamps', '#hud'];
    gsap.to(o, { t: 1, duration: d, onUpdate() { const a = (1 - o.t) * k; gsap.set(parts, { x: (Math.random() - .5) * a, y: (Math.random() - .5) * a * .6 }); }, onComplete: () => gsap.set(parts, { x: 0, y: 0 }) });
  };

  /* ---- torpedo: out of the bow tube, running away from us (it shrinks) to the target ---- */
  W.fire = async (s, ret) => {
    const tx = X(s.v), ty = s.cy, sx = TUBE.x, sy = TUBE.y, cx = (sx + tx) / 2, cy = ty + (sy - ty) * .55;
    SFX.launch(); kick(12, .3);
    const fl = el('tubeflash', sea, { left: sx + 'px', top: '760px' }); gsap.fromTo(fl, { scale: .4, opacity: 1 }, { scale: 1.8, opacity: 0, duration: .5, onComplete: () => fl.remove() });
    for (let i = 0; i < 8; i++) { const b = el('pbub', sea, { left: (sx + (Math.random() - .5) * 120) + 'px', top: (740 + Math.random() * 20) + 'px', width: '16px', height: '16px' }); gsap.to(b, { y: -80 - Math.random() * 120, x: (Math.random() - .5) * 120, scale: 1.6, opacity: 0, duration: 1 + Math.random() * .6, onComplete: () => b.remove() }); }
    const t = new Image(); t.src = 'assets/img/torpedo.webp'; t.className = 'torp'; sea.appendChild(t);   // it runs outside, behind the scale on the glass
    const o = { p: 0 }; let last = 0;
    await new Promise(r => gsap.to(o, { p: 1, duration: .8, ease: 'power1.in', onUpdate() {
      const p = o.p, q = 1 - p, x = q * q * sx + 2 * q * p * cx + p * p * tx, y = q * q * sy + 2 * q * p * cy + p * p * ty;
      const dx = 2 * q * (cx - sx) + 2 * p * (tx - cx), dy = 2 * q * (cy - sy) + 2 * p * (ty - cy);
      t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.transform = `rotate(${Math.atan2(dy, dx)}rad) scale(${1.7 - 1.05 * p})`;
      if (p - last > .06) { last = p; const b = el('tbub', sea, { left: x + 'px', top: y + 'px', width: (16 - 8 * p) + 'px', height: (16 - 8 * p) + 'px' }); gsap.to(b, { y: -30 - Math.random() * 30, scale: 1.8, opacity: 0, duration: 1.1, onComplete: () => b.remove() }); }
    }, onComplete: r }));
    t.remove(); if (ret) ret.remove();
    kick(8, .45);
    await W.blast(s);
  };

  /* ---- a miss: the warning lamps flash red and the window glows ---- */
  const wrong0 = W.wrong;
  W.wrong = async s => {
    const lamps = $('#lamps').querySelectorAll('i'), edge = $('#lamps .edge');
    gsap.fromTo(lamps, { opacity: 0 }, { opacity: 1, duration: .14, yoyo: true, repeat: 5, ease: 'power1.inOut' });
    gsap.fromTo(edge, { opacity: 0 }, { opacity: .9, duration: .2, yoyo: true, repeat: 3 });
    kick(5, .3);
    return wrong0(s);
  };

  /* ---- full speed ahead: the engines rumble ---- */
  const sail0 = W.sail;
  W.sail = async (dur = 1.6) => { kick(4, dur); return sail0(dur); };
})();
