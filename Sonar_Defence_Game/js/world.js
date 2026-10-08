/* world: parallax sea, ship + launcher, navigation scale, submarines, targeting & effects, HUD. */
(function () {
  const { $, wait, fmt, SFX } = SD;
  const X = v => 960 + v * 100;            // scale position → stage x  (−8 … +8)
  const SUB_Y = 695;                        // submarine centre y (row 1); neighbours one step apart sit one row deeper
  const play = $('#play'), fx = $('#fx'), sc = $('#scale');
  const el = (cls, parent, css = {}) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); parent.appendChild(d); return d; };

  /* ================= parallax ================= */
  // Each strip is mirrored (A | flipped A) so the joins always match; the track wraps every 2 widths.
  const LAYERS = [];
  function strip(id, src, h, w, speed) {
    const t = $('#' + id); for (let i = 0; i < 4; i++) { const im = new Image(); im.src = 'assets/img/' + src; im.style.width = w + 'px'; if (i % 2) im.className = 'flip'; t.appendChild(im); }
    t.style.width = (4 * w) + 'px'; LAYERS.push({ t, w, speed, x: 0 });
  }
  strip('skyTrack', 'sky_surface.webp', 300, 3200, 6);
  strip('far', 'far.webp', 440, 2414, 18);
  strip('seabed', 'seabed.webp', 260, 2377, 46);
  strip('kelp', 'kelp.webp', 280, 1344, 115);
  const caus = { x: 0 }, cEl = $('#caustics');
  const W = { mult: 1, t: 0 };
  // surface waves
  const w1 = $('#wave1'), w2 = $('#wave2');
  function wavePath(t, a, b, ph) { let d = 'M0 60 L0 ' + (24 + a * Math.sin(ph)); for (let x = 0; x <= 1920; x += 40) d += ` L${x} ${(24 + a * Math.sin(x * .011 + t * 1.6 + ph) + b * Math.sin(x * .027 - t * 2.4)).toFixed(1)}`; return d + ' L1920 60 Z'; }
  gsap.ticker.add((time, dt) => {
    const s = dt / 1000 * W.mult; W.t = time;
    for (const L of LAYERS) { L.x = (L.x + L.speed * s) % (2 * L.w); L.t.style.transform = `translate3d(${-L.x}px,0,0)`; }
    caus.x = (caus.x + 26 * s) % 512; cEl.style.transform = `translate3d(${-caus.x}px,${Math.sin(time * .6) * 6}px,0)`;
    w1.setAttribute('d', wavePath(time, 6, 3, 0)); w2.setAttribute('d', wavePath(time * .8, 9, 4, 1.7));
  });
  gsap.to('#rays', { rotation: 3.5, x: 60, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#rays', { opacity: .3, duration: 3.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.fromTo('#kelp', { '--sk': '-3deg' }, { '--sk': '3.5deg', duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#caustics', { opacity: .34, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#far', { y: 8, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  /* ---- marine snow (tiny drifting specks: the strongest "we are underwater" cue) ---- */
  const snow = $('#snow'), sctx = snow.getContext('2d'), SN = [];
  for (let i = 0; i < 110; i++) SN.push({ x: Math.random() * 1920, y: Math.random() * 832, z: .3 + Math.random() * .7, ph: Math.random() * 6 });
  gsap.ticker.add((t, dt) => {
    const s = dt / 1000; sctx.clearRect(0, 0, 1920, 832);
    for (const p of SN) {
      p.y += (6 + 14 * p.z) * s; p.x -= (8 + 34 * p.z) * s * W.mult; p.x += Math.sin(t * .8 + p.ph) * .25;
      if (p.y > 840) p.y = -6; if (p.x < -10) p.x = 1930;
      sctx.globalAlpha = .25 + .5 * p.z; sctx.fillStyle = '#e6fbff'; sctx.beginPath(); sctx.arc(p.x, p.y, .7 + 1.8 * p.z, 0, 6.283); sctx.fill();
    }
  });

  /* ---- fish schools swim past (they move left = we sail right) ---- */
  const FISHC = [['#ffb347', '#ff7b2e'], ['#ffe066', '#f4a91c'], ['#7ff0d9', '#1fb5a3'], ['#a7c7ff', '#5b7fe0'], ['#ff9ec2', '#e8578d']];
  function fishSVG(c, k) {
    return `<svg class="fish" width="70" height="34" viewBox="0 0 70 34" style="left:${k.x}px;top:${k.y}px;animation-delay:${k.d}s">
      <path class="tail" d="M50 17 L68 4 Q63 17 68 30 Z" fill="${c[1]}" style="animation-delay:-${k.d}s"/>
      <ellipse cx="30" cy="17" rx="23" ry="12.5" fill="${c[0]}"/><path d="M20 6 Q30 0 40 6" stroke="${c[1]}" stroke-width="4" fill="none"/>
      <path d="M33 6 Q37 17 33 28" stroke="${c[1]}" stroke-width="4" fill="none" opacity=".7"/>
      <circle cx="15" cy="14" r="4.6" fill="#fff"/><circle cx="14" cy="14" r="2.4" fill="#0a1f3a"/></svg>`;
  }
  function school(first) {
    const n = 4 + Math.floor(Math.random() * 6), c = FISHC[Math.floor(Math.random() * FISHC.length)];
    const depth = .45 + Math.random() * .5, y = 330 + Math.random() * 380;
    const g = el('school', $('#fishL'), { opacity: .55 + depth * .4, filter: `saturate(${.6 + depth * .4}) brightness(${.8 + depth * .25})` });
    let h = ''; for (let i = 0; i < n; i++) h += fishSVG(c, { x: i * 46 + Math.random() * 30, y: (Math.random() - .5) * 70, d: Math.random() * .3 });
    g.innerHTML = h;
    const o = { x: first ? 400 + Math.random() * 1200 : 2000, y }, v = 40 + Math.random() * 50;
    const tick = (t, dt) => { o.x -= (v + 30 * depth * W.mult) * dt / 1000; g.style.transform = `translate3d(${o.x}px,${o.y + Math.sin(t * .9 + y) * 14}px,0) scale(${depth})`; if (o.x < -500) { gsap.ticker.remove(tick); g.remove(); } };
    gsap.ticker.add(tick);
  }
  school(true); setTimeout(() => school(true), 300);
  setInterval(() => { if (!document.hidden && $('#fishL').children.length < 4) school(false); }, 6500);
  // a giant manta glides far behind, now and then
  $('#manta').innerHTML = `<svg width="420" height="200" viewBox="0 0 420 200" style="position:absolute;left:0;top:0;opacity:.22"><g id="mantaWing" fill="#0b3a63">
    <path d="M210 70 C150 40 70 30 10 80 C80 90 150 110 190 140 L230 140 C270 110 340 90 410 80 C350 30 270 40 210 70 Z"/><path d="M200 130 L210 196 L220 130 Z"/></g></svg>`;
  function manta() {
    const m = $('#manta svg'); gsap.set(m, { x: 2000, y: Math.random() * 80 });
    gsap.to(m, { x: -500, duration: 38, ease: 'none', onComplete: () => setTimeout(manta, 14000) });
  }
  gsap.to('#mantaWing', { scaleY: .55, transformOrigin: '50% 45%', duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  setTimeout(manta, 4000);
  // ship & officer ride the swell
  gsap.to('#ship', { y: 4, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.set('#offImg,#pImg', { xPercent: -50 });
  // Meera shifts her weight now and then, so she never looks pasted on
  (function idleSway() { gsap.to('#officer', { rotation: (Math.random() - .5) * 3, duration: 1.6 + Math.random(), ease: 'sine.inOut', transformOrigin: '50% 100%', onComplete: idleSway }); })();
  gsap.to('#ship', { rotation: .7, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 75%' });
  // bubbles drifting past (rise + go backwards = we are moving forward)
  const bub = $('#bubbles');
  function spawnBubble(big) {
    const r = big ? 10 + Math.random() * 18 : 3 + Math.random() * 8, b = el('bub', bub, { width: 2 * r + 'px', height: 2 * r + 'px', left: (200 + Math.random() * 1900) + 'px', top: (1080 + r) + 'px', opacity: .3 + Math.random() * .5 });
    const o = { y: 0, x: 0 }, vy = 40 + Math.random() * 70 + (big ? 30 : 0), vx = 30 + Math.random() * 60;
    const tick = (t, dt) => { const s = dt / 1000; o.y -= vy * s; o.x -= vx * s * W.mult * (big ? 1.4 : 1); b.style.transform = `translate3d(${o.x + Math.sin(t * 2 + r) * 6}px,${o.y}px,0)`; if (o.y < -830 || o.x < -2200) { gsap.ticker.remove(tick); b.remove(); } };
    gsap.ticker.add(tick);
  }
  setInterval(() => { if (!document.hidden) spawnBubble(Math.random() < .15); }, 260);
  for (let i = 0; i < 14; i++) setTimeout(() => spawnBubble(false), i * 60);

  W.sail = async (dur = 1.6) => {     // short "full speed ahead" burst between missions
    SFX.swoosh();
    gsap.to(W, { mult: 9, duration: .5, ease: 'power2.in' });
    gsap.to('#wake', { opacity: .9, duration: .4 }); gsap.to('#ship', { x: 30, duration: .6, ease: 'power2.out' });
    for (let i = 0; i < 10; i++) setTimeout(() => spawnBubble(true), i * 70);
    await wait(.5 + dur * .5);
    gsap.to(W, { mult: 1, duration: dur * .6, ease: 'power2.out' });
    gsap.to('#wake', { opacity: 0, duration: .6 }); gsap.to('#ship', { x: 0, duration: 1, ease: 'power2.inOut' });
    await wait(dur * .5);
  };
  // wake foam (svg-less: stacked radial blobs)
  $('#wake').style.background = 'radial-gradient(ellipse at 80% 50%,rgba(255,255,255,.95),rgba(255,255,255,0) 65%)';

  /* ================= navigation scale ================= */
  const rail = el('', sc); rail.id = 'rail'; el('arrowL', rail); el('arrowR', rail);
  const LBL = {}, TICK = {};
  for (let v = -8; v <= 8; v++) {
    TICK[v] = el('tick' + (v === 0 ? ' zero' : ''), sc, { left: X(v) + 'px' });
    const l = el('lbl' + (v === 0 ? ' zero' : ''), sc, { left: X(v) + 'px' }); l.textContent = fmt(v); LBL[v] = l;
  }
  const scan = el('', sc); scan.id = 'scan';
  W.X = X; W.SUB_Y = SUB_Y;
  W.labelsOn = vals => { for (let v = -8; v <= 8; v++) LBL[v].classList.toggle('on', vals.includes(v)); };
  W.scaleIntro = async () => {
    gsap.set('#scale', { opacity: 1 });
    gsap.fromTo('#rail', { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: .7, ease: 'power2.out' });
    const ts = Object.values(TICK), ls = Object.values(LBL);
    gsap.fromTo(ts, { scaleY: 0 }, { scaleY: 1, duration: .3, stagger: { each: .03, from: 'center' }, delay: .3 });
    gsap.fromTo(ls, { opacity: 0, y: 10 }, { opacity: (i) => i === 8 ? .85 : .42, y: 0, duration: .3, stagger: { each: .03, from: 'center' }, delay: .4, clearProps: 'opacity' });
    SFX.ping(); await wait(1.1);
  };
  W.zeroGlow = () => gsap.fromTo([TICK[0], LBL[0]], { scale: 1 }, { scale: 1.5, duration: .35, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  // light scan from 0 to an end, labels brighten as it passes, a word appears at the end
  W.scan = async (to, word) => {
    const dir = Math.sign(to); gsap.set(scan, { left: X(0), opacity: 1 }); SFX.ping();
    const lit = [];
    await new Promise(r => gsap.to(scan, { left: X(to), duration: 2.2, ease: 'none', onUpdate() { const cur = Math.round((parseFloat(scan.style.left) - 960) / 100); for (let v = 0; Math.abs(v) <= Math.abs(cur); v += dir || 1) { if (!lit.includes(v)) { lit.push(v); gsap.fromTo(LBL[v], { scale: 1.6 }, { scale: 1, duration: .5 }); LBL[v].classList.add('on'); } if (!dir) break; } }, onComplete: r }));
    const w = el('word', sc, { left: (dir > 0 ? X(to) - 340 : X(to) + 20) + 'px', top: '400px' }); w.innerHTML = word;
    gsap.fromTo(w, { opacity: 0, x: -30 * dir }, { opacity: 1, x: 0, duration: .5 });
    const arrow = el(dir > 0 ? 'sweep' : 'sweep left', sc, { left: Math.min(X(0), X(to)) + 'px', width: Math.abs(X(to) - X(0)) + 'px', top: '612px' });
    gsap.fromTo(arrow, { opacity: 0 }, { opacity: .9, duration: .4 });
    gsap.to(scan, { opacity: 0, duration: .4 });
    return () => { gsap.to([w, arrow], { opacity: 0, duration: .3, onComplete: () => { w.remove(); arrow.remove(); } }); lit.forEach(v => LBL[v].classList.remove('on')); };
  };

  /* ================= submarines ================= */
  const VAR = { sub: 'sub.webp', teal: 'sub_teal.webp', plum: 'sub_plum.webp' };
  let SUBS = [];
  W.spawn = async (vals, o = {}) => {
    const sorted = [...vals].sort((a, b) => a - b), depth = {};
    sorted.forEach((v, i) => { const p = sorted[i - 1]; depth[v] = (p != null && v - p < 2 && depth[p] === 0) ? 1 : 0; });
    const list = vals.map((v, i) => {
      const dy = depth[v] * 100;
      const d = el('sub', play, { left: X(v) + 'px', top: (650 + dy) + 'px' }); d.dataset.v = v;
      const line = el('sonarline', sc, { left: X(v) + 'px', height: (66 + dy) + 'px' });
      const bob = el('bob', d); el('glow', bob); el('shield', bob); el('ring', bob);
      const im = new Image(); im.src = 'assets/img/' + VAR[o.variant || 'sub']; bob.appendChild(im); if (o.variant && o.variant !== 'sub') Object.assign(im.style, { width: '200px', left: '25px', top: '-23px' });
      gsap.to(bob, { y: 6, duration: 1.4 + i * .17, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const s = { v, d, bob, im, line, alive: true, cy: SUB_Y + dy }; d._s = s; return s;
    });
    SUBS.push(...list);
    W.labelsOn(SUBS.filter(s => s.alive).map(s => s.v));
    // rise in from the deep, one by one, with a sonar ping
    for (const s of list) { gsap.fromTo(s.d, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power2.out' }); gsap.fromTo(s.line, { scaleY: 0, transformOrigin: '50% 0' }, { scaleY: 1, duration: .5, delay: .5 }); SFX.ping(); await wait(o.stagger == null ? .28 : o.stagger); }
    await wait(.5);
    return list;
  };
  // propellers keep churning: little bubbles stream from every live submarine's tail
  setInterval(() => {
    if (document.hidden) return;
    for (const s of SUBS) {
      if (!s.alive) continue;
      const x = X(s.v) + 100, y = s.cy + 8 + gsap.getProperty(s.bob, 'y'), r = 3 + Math.random() * 5;
      const b = el('pbub', fx, { left: x + 'px', top: y + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.to(b, { x: 40 + Math.random() * 50, y: -20 - Math.random() * 40, opacity: 0, duration: 1.4 + Math.random(), ease: 'power1.out', onComplete: () => b.remove() });
    }
  }, 220);
  W.subs = () => SUBS.filter(s => s.alive);
  W.subAt = v => SUBS.find(s => s.alive && s.v === v);
  W.clearSubs = async () => {
    const all = SUBS; SUBS = [];
    all.forEach(s => { gsap.killTweensOf(s.bob); gsap.to([s.d, s.line], { opacity: 0, duration: .4, onComplete: () => { s.d.remove(); s.line.remove(); } }); });
    W.labelsOn([]); await wait(.4);
  };
  W.glow = (s, on = true, color) => { const g = s.d.querySelector('.glow'); if (color) g.style.background = `radial-gradient(ellipse,${color},rgba(0,0,0,0) 65%)`; gsap.to(g, { opacity: on ? 1 : 0, duration: .3 }); if (on) gsap.fromTo(s.d, { scale: 1 }, { scale: 1.12, duration: .3, yoyo: true, repeat: 1 }); };
  W.dimOthers = (keep, on = true) => SUBS.forEach(s => s.alive && s !== keep && s.d.classList.toggle('dim', on));
  W.pulseAll = () => W.subs().forEach((s, i) => gsap.fromTo(s.d, { scale: 1 }, { scale: 1.1, duration: .35, yoyo: true, repeat: 3, delay: i * .08 }));

  /* ================= tapping ================= */
  let tapRes = null, tapFilter = null;
  play.addEventListener('pointerdown', e => {
    const d = e.target.closest('.sub'); if (!d || !tapRes || !d._s.alive) return;
    if (tapFilter && !tapFilter(d._s)) return; const r = tapRes; tapRes = null; r(d._s);
  });
  // waits for a sub tap. Escalating help while the child is stuck:
  //   6 s → rings turn gold & subs wiggle (no words) · 12 s → onIdle (spoken nudge) · 22 s → onIdle2 (gentle reminder)
  W.waitTap = (o = {}) => new Promise(res => {
    tapFilter = o.only ? (s => s === o.only) : null; play.style.pointerEvents = 'auto'; W.waiting = true; play.classList.add('waiting');
    const calls = [
      gsap.delayedCall(o.nudge || 6, () => { play.classList.add('nudge'); W.pulseAll(); gsap.fromTo('#strip', { scale: 1 }, { scale: 1.04, duration: .25, yoyo: true, repeat: 3 }); }),
      o.onIdle ? gsap.delayedCall(o.idle || 12, o.onIdle) : null,
      o.onIdle2 ? gsap.delayedCall(o.idle2 || 22, o.onIdle2) : null,
    ].filter(Boolean);
    tapRes = s => { W.waiting = false; play.classList.remove('waiting', 'nudge'); calls.forEach(c => c.kill()); SFX.tap(); W.tapFx(X(s.v), s.cy); res(s); };
  });
  W.tapFx = (x, y) => { const t = el('tapfx', fx, { left: x + 'px', top: y + 'px' }); gsap.fromTo(t, { scale: .3, opacity: 1 }, { scale: 1.6, opacity: 0, duration: .45, onComplete: () => t.remove() }); };
  W.cancelTap = () => { tapRes = null; };

  /* ================= launcher, torpedo, blast ================= */
  const PIV = { x: 600, y: 196 };     // turret pivot on stage
  function aim(x, y, dur = .45) { const a = Math.atan2(y - PIV.y, x - PIV.x) * 180 / Math.PI; return gsap.to('#barrel', { rotation: a, svgOrigin: '0 0', duration: dur, ease: 'back.out(1.6)' }); }
  gsap.set('#barrel', { rotation: 35, svgOrigin: '0 0' });
  W.aimAt = s => aim(X(s.v), s.cy);
  W.lock = async (s, color) => {
    const r = new Image(); r.src = 'assets/img/reticle.webp'; r.className = 'reticle'; Object.assign(r.style, { left: X(s.v) + 'px', top: s.cy + 'px' });
    if (color === 'red') r.style.filter = 'hue-rotate(165deg) saturate(2.2)';
    fx.appendChild(r); SFX.lock(); aim(X(s.v), s.cy);
    await gsap.fromTo(r, { scale: 1.9, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .38, ease: 'back.out(2)' });
    return r;
  };
  W.fire = async (s, ret) => {
    const a = gsap.getProperty('#barrel', 'rotation') * Math.PI / 180, mx = PIV.x + 82 * Math.cos(a), my = PIV.y + 82 * Math.sin(a);
    const tx = X(s.v), ty = s.cy, cx = (mx + tx) / 2, cy = Math.max(my, ty) + 40;
    SFX.launch(); gsap.fromTo('#barrel', { x: 0 }, { x: -8, duration: .08, yoyo: true, repeat: 1 });
    const t = new Image(); t.src = 'assets/img/torpedo.webp'; t.className = 'torp'; fx.appendChild(t);
    const o = { p: 0 }; let last = 0;
    await new Promise(r => gsap.to(o, { p: 1, duration: .75, ease: 'power1.in', onUpdate() {
      const p = o.p, q = 1 - p, x = q * q * mx + 2 * q * p * cx + p * p * tx, y = q * q * my + 2 * q * p * cy + p * p * ty;
      const dx = 2 * q * (cx - mx) + 2 * p * (tx - cx), dy = 2 * q * (cy - my) + 2 * p * (ty - cy);
      t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      if (p - last > .05) { last = p; const b = el('tbub', fx, { left: x + 'px', top: y + 'px', width: '12px', height: '12px' }); gsap.to(b, { y: -40 - Math.random() * 30, x: -20, scale: 1.8, opacity: 0, duration: 1.2, onComplete: () => b.remove() }); }
    }, onComplete: r }));
    t.remove(); if (ret) ret.remove();
    await W.blast(s);
  };
  W.blast = async s => {
    SFX.boom(); s.alive = false;
    const b = el('blast', fx, { left: X(s.v) + 'px', top: s.cy + 'px' });
    const shake = { x: 0 }; gsap.to(shake, { x: 1, duration: .45, onUpdate() { const k = (1 - shake.x) * 9; $('#stage').style.translate = `${(Math.random() - .5) * k}px ${(Math.random() - .5) * k}px`; }, onComplete: () => { $('#stage').style.translate = ''; } });
    const fl = $('#flash'); fl.style.setProperty('--fx', X(s.v) + 'px'); fl.style.setProperty('--fy', s.cy + 'px');
    gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: .6, ease: 'power2.out' });
    const sh = el('shock', fx, { left: X(s.v) + 'px', top: s.cy + 'px' });
    gsap.fromTo(sh, { scale: .2, opacity: 1 }, { scale: 3.4, opacity: 0, duration: .7, ease: 'power2.out', onComplete: () => sh.remove() });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, d = 80 + Math.random() * 150, r = 4 + Math.random() * 12;
      const bb = el(i < 5 ? 'debris' : 'pbub', fx, { left: X(s.v) + 'px', top: s.cy + 'px', width: (i < 5 ? 14 : 2 * r) + 'px', height: (i < 5 ? 14 : 2 * r) + 'px' });
      gsap.to(bb, { x: Math.cos(a) * d, y: Math.sin(a) * d * .7 + (i < 5 ? 160 : -60), rotation: i < 5 ? 360 * Math.random() : 0, opacity: 0, duration: i < 5 ? 1.4 : 1 + Math.random(), ease: 'power2.out', onComplete: () => bb.remove() });
    }
    for (let f = 0; f < 4; f++) setTimeout(() => { b.style.backgroundPosition = `${-f * 300}px 0`; }, f * 110 / SD.SPEED);
    gsap.fromTo(b, { scale: .6 }, { scale: 1.25, duration: .5, ease: 'power2.out' }); gsap.to(b, { opacity: 0, duration: .4, delay: .45, onComplete: () => b.remove() });
    await wait(.12);
    s.im.src = 'assets/img/sub_hit.webp'; gsap.killTweensOf(s.bob);
    gsap.to(s.d, { y: 220, rotation: 18, opacity: 0, duration: 1.4, ease: 'power1.in' });
    gsap.to(s.line, { opacity: 0, duration: .5 });
    await wait(.5);
  };
  W.wrong = async s => {
    SFX.wrong(); SFX.shield(); aim(X(s.v), s.cy, .25);
    const sh = s.d.querySelector('.shield');
    gsap.fromTo(sh, { opacity: 1, scale: .8 }, { opacity: 0, scale: 1.25, duration: .7 });
    await gsap.fromTo(s.d, { x: 0 }, { x: 12, duration: .06, yoyo: true, repeat: 7, ease: 'none', clearProps: 'x' });
  };

  /* ================= hints ================= */
  let hintEls = [];
  W.hintArrow = (fromV, dir) => {
    const w = 300, x = dir > 0 ? X(fromV) + 30 : X(fromV) - 30 - w;
    const a = el('hintarrow' + (dir < 0 ? ' left' : ''), sc, { left: x + 'px', width: w + 'px' });
    gsap.fromTo(a, { opacity: 0, x: -30 * dir }, { opacity: 1, x: 0, duration: .4 });
    gsap.to(a, { x: 24 * dir, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .4 });
    hintEls.push(a); return a;
  };
  W.sweepArrow = dir => {
    const a = el('sweep' + (dir < 0 ? ' left' : ''), sc, { left: '260px', width: '1400px', top: '412px' });
    gsap.fromTo(a, { opacity: 0 }, { opacity: .85, duration: .4 }); hintEls.push(a); return a;
  };
  W.rule = on => gsap.to('#rule', { opacity: on ? 1 : 0, y: on ? 0 : -10, duration: .35 });
  W.hand = s => { const h = $('#hand'); if (!s) return gsap.to(h, { opacity: 0, duration: .2 }); gsap.killTweensOf(h); gsap.set(h, { left: X(s.v) + 10, top: s.cy + 34, opacity: 1 }); gsap.fromTo(h, { y: 30 }, { y: 0, duration: .45, yoyo: true, repeat: -1, ease: 'sine.inOut' }); };
  // guided hand: glide to a point, then tap (used for demos)
  W.handTo = async (x, y, dur = .7) => { const h = $('#hand'); gsap.killTweensOf(h); if (+getComputedStyle(h).opacity < .1) gsap.set(h, { left: x + 140, top: y + 160, y: 0 }); gsap.to(h, { opacity: 1, duration: .2 }); await gsap.to(h, { left: x, top: y, y: 0, duration: dur, ease: 'power2.inOut' }); };
  W.handTap = async (x, y) => { const h = $('#hand'); await gsap.to(h, { scale: .85, duration: .12, yoyo: true, repeat: 1 }); W.tapFx(x, y); SFX.tap(); };
  W.clearHints = () => { hintEls.forEach(a => { gsap.killTweensOf(a); gsap.to(a, { opacity: 0, duration: .25, onComplete: () => a.remove() }); }); hintEls = []; W.hand(null); W.dimOthers(null, false); };

  /* ================= badges (ordering) ================= */
  let BADGES = [];
  W.badge = (v, n) => { const b = el('badge', sc, { left: X(v) + 'px' }); b.innerHTML = `<span>${n}</span>`; gsap.fromTo(b, { scale: 0, y: 60 }, { scale: 1, y: 0, duration: .45, ease: 'back.out(2.5)' }); BADGES.push(b); };
  W.clearBadges = () => { BADGES.forEach(b => gsap.to(b, { opacity: 0, duration: .3, onComplete: () => b.remove() })); BADGES = []; };

  /* ================= HUD ================= */
  W.strip = (html, o = {}) => { const s = $('#strip'); s.innerHTML = o.big ? `<span class="big">${html}</span>` : html; s.classList.remove('glint'); void s.offsetWidth; s.classList.add('glint'); gsap.fromTo(s, { opacity: 0, y: -24, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2)' }); };
  W.stripOff = () => gsap.to('#strip', { opacity: 0, duration: .3 });
  W.pips = (n, done) => { const p = $('#pips'); p.innerHTML = ''; for (let i = 0; i < n; i++) { const im = new Image(); im.src = 'assets/img/' + (i < done ? 'pip_on' : 'pip_off') + '.webp'; p.appendChild(im); } if (done > 0) gsap.fromTo(p.children[done - 1], { scale: 1.8 }, { scale: 1, duration: .4, ease: 'back.out(3)' }); if (p.children[done]) p.children[done].classList.add('now'); };
  W.banner = async (k, t, s, hold = 2.2) => {
    const b = $('#banner'); $('#bk').textContent = k; $('#bt').textContent = t; $('#bs').textContent = s; b.classList.remove('hidden');
    gsap.fromTo('#banner .card', { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }); SFX.ping();
    gsap.fromTo(['#bk', '#bt', '#bs'], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .12, delay: .15 });
    await wait(hold); await gsap.to('#banner .card', { scale: .9, opacity: 0, duration: .3 }); b.classList.add('hidden');
  };

  /* ================= Level 3: movement signals + defence marker ================= */
  const L3 = { sigs: [], marker: null };
  W.marker = v => { if (!L3.marker) { L3.marker = el('', sc); L3.marker.id = 'marker'; } gsap.set(L3.marker, { left: X(v), opacity: 1 }); gsap.fromTo(L3.marker, { y: -40 }, { y: 0, duration: .5, ease: 'bounce.out' }); L3.mv = v; };
  W.markerOff = () => { if (L3.marker) gsap.to(L3.marker, { opacity: 0, duration: .3 }); };
  // rows: top row y 340, bottom row y 418. each signal is ±1 step.
  W.signals = async (rows) => {   // rows: [{n:5,sign:+1},{n:3,sign:-1}]
    L3.sigs = []; const pod = el('pod', fx, { left: '960px', top: '332px' });
    gsap.fromTo(pod, { scale: 0 }, { scale: 1, duration: .4, ease: 'back.out(2)' }); SFX.ping(); await wait(.5);
    const cols = Math.max(...rows.map(r => r.n));
    for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].n; k++) {
      const x = 960 + (k - (cols - 1) / 2) * 160, y = r === 0 ? 298 : 366;
      const d = el('sig' + (rows[r].sign < 0 ? ' neg' : ''), fx, { left: x + 'px', top: y + 'px' });
      const s = { d, sign: rows[r].sign, row: r, col: k, x, y, alive: true }; L3.sigs.push(s);
      gsap.fromTo(d, { left: 960, top: 332, opacity: 0, scale: .3 }, { left: x, top: y, opacity: 1, scale: 1, duration: .5, ease: 'back.out(1.6)' }); SFX.pop();
      await wait(.12);
    }
    gsap.to(pod, { scale: 0, opacity: 0, duration: .3, delay: .2, onComplete: () => pod.remove() });
    await wait(.6);
  };
  W.sigAlive = () => L3.sigs.filter(s => s.alive);
  // child taps a column to cancel one + and one − ; resolves when no opposite pairs remain
  W.pairUp = (onPair, onIdle) => new Promise(res => {
    const pos = () => W.sigAlive().filter(s => s.sign > 0), neg = () => W.sigAlive().filter(s => s.sign < 0);
    let idleCall = gsap.delayedCall(12, () => onIdle && onIdle());
    const boxes = [];
    const pairs = Math.min(pos().length, neg().length);
    for (let k = 0; k < pairs; k++) {
      const p = L3.sigs.find(s => s.sign > 0 && s.col === k), n = L3.sigs.find(s => s.sign < 0 && s.col === k);
      const b = el('pairbox', fx, { left: p.x + 'px', top: '262px' }); boxes.push(b); b.style.pointerEvents = 'auto';
      gsap.to([p.d, n.d], { y: -4, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: k * .1 });
      b.onpointerdown = async () => {
        if (b._used) return; b._used = true; idleCall.kill(); idleCall = gsap.delayedCall(10, () => onIdle && onIdle());
        p.alive = n.alive = false; gsap.killTweensOf([p.d, n.d]); p.d.classList.add('pair'); n.d.classList.add('pair');
        await Promise.all([gsap.to(p.d, { top: 332, duration: .28, ease: 'power2.in' }), gsap.to(n.d, { top: 332, duration: .28, ease: 'power2.in' })]);
        SFX.pop(); const pop = el('pop', fx, { left: p.x + 'px', top: '332px' }); gsap.fromTo(pop, { scale: .3 }, { scale: 1.1, opacity: 0, duration: .7, onComplete: () => pop.remove() });
        const z = el('zero0', fx, { left: (p.x - 14) + 'px', top: '308px' }); z.textContent = '0'; gsap.to(z, { y: -60, opacity: 0, duration: 1.1, delay: .2, onComplete: () => z.remove() });
        p.d.remove(); n.d.remove(); b.remove(); onPair && onPair();
        if (!boxes.some(x => !x._used)) { idleCall.kill(); res(); }
      };
    }
    if (!pairs) { idleCall.kill(); res(); }
    W._pairBoxes = boxes;
  });
  W.hintPairs = () => (W._pairBoxes || []).filter(b => !b._used).forEach(b => b.classList.add('hint'));
  // leftover signals fly into the marker one by one; marker steps 1 each time
  W.runMarker = async (group) => {
    const left = group || W.sigAlive();
    for (const s of left) {
      const to = L3.mv + s.sign;
      await gsap.to(s.d, { left: X(L3.mv), top: 400, scale: .5, duration: .35, ease: 'power2.in' });
      s.alive = false; s.d.remove(); SFX.step();
      await gsap.to(L3.marker, { left: X(to), duration: .3, ease: 'power2.out' }); L3.mv = to;
      gsap.fromTo(LBL[to], { scale: 1.5 }, { scale: 1, duration: .3 });
    }
  };
  W.clearSignals = () => { L3.sigs.forEach(s => s.d.remove()); L3.sigs = []; (W._pairBoxes || []).forEach(b => b.remove()); };

  window.W = W;
})();
