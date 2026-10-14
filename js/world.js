/* world: the sea outside the bow window, the navigation scale, submarines, targeting & effects, HUD.
   js/cockpit.js adds the cockpit itself: the bow cannon, the crew at their stations and the console screen. */
(function () {
  const { $, wait, fmt, SFX } = SD;
  /* screen shake: every game layer sits in one wrapper (#shake) that moves as one piece, in whole pixels only.
     It stays on its own GPU layer all the time (game.css), so a shake never makes the browser redraw the scene;
     the few pixels it uncovers at the stage edge are the frame's navy (#stage background). The overlays stay still. */
  const stageEl = $('#stage'), shakeEl = document.createElement('div'); shakeEl.id = 'shake';
  [...stageEl.children].filter(c => !c.classList.contains('overlay')).forEach(c => shakeEl.appendChild(c));
  stageEl.insertBefore(shakeEl, stageEl.firstChild);
  const SHK = { amp: 0, t: 0, d: 1 };
  gsap.ticker.add((t, dt) => {
    if (!SHK.amp) return;
    SHK.t += dt / 1000; const a = SHK.amp * Math.max(0, 1 - SHK.t / SHK.d);
    if (a < .5) { SHK.amp = 0; shakeEl.style.transform = 'translate3d(0,0,0)'; return; }
    shakeEl.style.transform = `translate3d(${Math.round((Math.random() - .5) * 2 * a)}px,${Math.round((Math.random() - .5) * 1.2 * a)}px,0)`;
  });
  const shake = (k = 8, d = .4) => { const left = SHK.amp * Math.max(0, 1 - SHK.t / SHK.d); if (k < left) return; SHK.amp = k; SHK.t = 0; SHK.d = d; };
  /* positions that come from code, not CSS — tunable live in the layout editor, saved in js/layout.js (LAYOUT.config) */
  const DEFAULTS = {
    X0: 960,        // stage x of 0 on the navigation scale
    STEP: 100,      // px between whole numbers (scale shows −8 … +8)
    SUB_Y: 440,     // submarine centre y (row 1), out in the water above the scale
    SUB_ROW: -105,  // row 2 (a neighbour less than 2 apart) sits this much lower (negative = higher)
    SIG_Y1: 200,    // L3 signal rows: top
    SIG_Y2: 268,    //                 bottom
    SIG_GAP: 160,   // px between signal columns
    SCALE_DY: 100,  // moves the whole scale group (bar, numbers, marker, hints) down, low on the glass
  };
  const CONFIG = Object.assign({}, DEFAULTS, window.LAYOUT && LAYOUT.config);
  const X = v => CONFIG.X0 + v * CONFIG.STEP;   // scale position → stage x
  const SUB_H = 90, LINE_TOP = 584, BAR_TOP = 446;   // .sub height · .sonarline top · #scaleBack top (game.css)
  // the dotted sonar line joins a submarine to the scale: down from the rail (subs below) or down from the sub (subs above)
  const lineAt = (ln, cy) => {   // (the line lives in #scale, which is shifted by SCALE_DY)
    const t = cy - SUB_H / 2, dy = CONFIG.SCALE_DY;
    if (t > BAR_TOP + dy) { ln.style.top = LINE_TOP + 'px'; ln.style.height = (t - dy - LINE_TOP) + 'px'; }
    else { ln.style.top = (t + SUB_H - dy) + 'px'; ln.style.height = (BAR_TOP + dy - t - SUB_H) + 'px'; }
  };
  const play = $('#play'), fx = $('#fx'), sc = $('#scale'), sg = $('#sigs');   // sg: Level 3 signals + pair buttons
  const el = (cls, parent, css = {}) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); parent.appendChild(d); return d; };

  /* ================= parallax ================= */
  // Each strip is mirrored (A | flipped A) so the joins always match; the track wraps every 2 widths.
  const LAYERS = [];
  function strip(id, src, h, w, speed) {
    const t = $('#' + id); for (let i = 0; i < 4; i++) { const im = new Image(); im.src = 'assets/img/' + src; im.style.width = w + 'px'; if (i % 2) im.className = 'flip'; t.appendChild(im); }
    t.style.width = (4 * w) + 'px'; LAYERS.push({ t, w, speed, x: 0 });
  }
  strip('far', 'far.webp', 440, 2414, 18);
  strip('seabed', 'seabed.webp', 260, 2377, 46);
  const caus = { x: 0 }, cEl = $('#caustics');
  const W = { mult: 1, t: 0 };
  gsap.ticker.add((time, dt) => {
    if (SD.paused) return;
    const s = dt / 1000 * W.mult * SD.rate; W.t = time;
    for (const L of LAYERS) { L.x = (L.x + L.speed * s) % (2 * L.w); L.t.style.transform = `translate3d(${-L.x}px,0,0)`; }
    caus.x = (caus.x + 26 * s) % 512; cEl.style.transform = `translate3d(${-caus.x}px,${Math.sin(time * .6) * 6}px,0)`;
  });
  gsap.to('#rays', { rotation: 3.5, x: 60, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#rays', { opacity: .3, duration: 3.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#caustics', { opacity: .22, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#far', { y: 8, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  /* ---- marine snow (tiny drifting specks: the strongest "we are underwater" cue) ---- */
  const snow = $('#snow'), sctx = snow.getContext('2d'), SN = []; sctx.scale(.5, .5);   // half-resolution canvas, CSS shows it full size
  for (let i = 0; i < 110; i++) SN.push({ x: Math.random() * 1920, y: Math.random() * 1080, z: .3 + Math.random() * .7, ph: Math.random() * 6 });
  gsap.ticker.add((t, dt) => {
    if (SD.paused) return;
    const s = dt / 1000 * SD.rate; sctx.clearRect(0, 0, 1920, 1080);
    for (const p of SN) {
      p.y += (6 + 14 * p.z) * s; p.x -= (8 + 34 * p.z) * s * W.mult; p.x += Math.sin(t * .8 + p.ph) * .25;
      if (p.y > 1088) p.y = -6; if (p.x < -10) p.x = 1930;
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
  const SCHOOLS = [];
  // an explosion nearby: the school darts away from it, then drifts back into line
  W.scare = (x, y) => SCHOOLS.forEach(({ o, k, depth }) => {
    const cx = o.x + 180 * depth, dx = cx - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1; if (d > 900) return;
    const f = (1 - d / 900) * 320;
    gsap.killTweensOf(k); gsap.timeline().to(k, { x: dx / d * f * 1.4, y: dy / d * f, duration: .35, ease: 'power3.out' }).to(k, { x: 0, y: 0, duration: 2.8, ease: 'sine.inOut' });
  });
  function school(first) {
    const n = 4 + Math.floor(Math.random() * 6), c = FISHC[Math.floor(Math.random() * FISHC.length)];
    const depth = .45 + Math.random() * .5, y = 725 + Math.random() * 70;   // below the scale: never behind the submarine row
    const g = el('school', $('#fishL'), { opacity: .55 + depth * .4, filter: `saturate(${.6 + depth * .4}) brightness(${.8 + depth * .25})` });
    let h = ''; for (let i = 0; i < n; i++) h += fishSVG(c, { x: i * 46 + Math.random() * 30, y: (Math.random() - .5) * 70, d: Math.random() * .3 });
    g.innerHTML = h;
    const o = { x: first ? 400 + Math.random() * 1200 : 2000, y }, v = 40 + Math.random() * 50, k = { x: 0, y: 0 }, me = { o, k, depth };
    const tick = (t, dt) => { if (SD.paused) return; o.x -= (v + 30 * depth * W.mult) * dt / 1000 * SD.rate; g.style.transform = `translate3d(${o.x + k.x}px,${o.y + k.y + Math.sin(t * .9 + y) * 14}px,0) scale(${depth})`; if (o.x < -500) { gsap.ticker.remove(tick); g.remove(); SCHOOLS.splice(SCHOOLS.indexOf(me), 1); } };
    gsap.ticker.add(tick); SCHOOLS.push(me);
  }
  school(true); setTimeout(() => school(true), 300);
  setInterval(() => { if (!document.hidden && !SD.paused && $('#fishL').children.length < 4) school(false); }, 6500);
  // a giant manta glides far behind, now and then
  $('#manta').innerHTML = `<svg width="420" height="200" viewBox="0 0 420 200" style="position:absolute;left:0;top:0;opacity:.22"><g id="mantaWing" fill="#0b3a63">
    <path d="M210 70 C150 40 70 30 10 80 C80 90 150 110 190 140 L230 140 C270 110 340 90 410 80 C350 30 270 40 210 70 Z"/><path d="M200 130 L210 196 L220 130 Z"/></g></svg>`;
  function manta() {
    const m = $('#manta svg'); gsap.set(m, { x: 2000, y: Math.random() * 80 });
    gsap.to(m, { x: -500, duration: 38, ease: 'none', onComplete: () => setTimeout(manta, 14000) });
  }
  gsap.to('#mantaWing', { scaleY: .55, transformOrigin: '50% 45%', duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  setTimeout(manta, 4000);
  // bubbles drifting past (rise + go backwards = we are moving forward)
  const bub = $('#bubbles');
  function spawnBubble(big) {
    const r = big ? 10 + Math.random() * 18 : 3 + Math.random() * 8, b = el('bub', bub, { width: 2 * r + 'px', height: 2 * r + 'px', left: (200 + Math.random() * 1900) + 'px', top: (1080 + r) + 'px', opacity: .3 + Math.random() * .5 });
    const o = { y: 0, x: 0 }, vy = 40 + Math.random() * 70 + (big ? 30 : 0), vx = 30 + Math.random() * 60;
    const tick = (t, dt) => { if (SD.paused) return; const s = dt / 1000 * SD.rate; o.y -= vy * s; o.x -= vx * s * W.mult * (big ? 1.4 : 1); b.style.transform = `translate3d(${o.x + Math.sin(t * 2 + r) * 6}px,${o.y}px,0)`; if (o.y < -830 || o.x < -2200) { gsap.ticker.remove(tick); b.remove(); } };
    gsap.ticker.add(tick);
  }
  setInterval(() => { if (!document.hidden && !SD.paused) spawnBubble(Math.random() < .15); }, 260);
  for (let i = 0; i < 14; i++) setTimeout(() => spawnBubble(false), i * 60);

  W.sail = async (dur = 1.6) => {     // short "full speed ahead" burst between missions
    SFX.sail();
    gsap.to(W, { mult: 9, duration: .5, ease: 'power2.in' });
    for (let i = 0; i < 10; i++) setTimeout(() => spawnBubble(true), i * 70);
    await wait(.5 + dur * .5);
    gsap.to(W, { mult: 1, duration: dur * .6, ease: 'power2.out' });
    await wait(dur * .5);
  };

  /* ================= navigation scale ================= */
  const back = el('', sc); back.id = 'scaleBack'; const sheen = el('sheen', back);
  const rail = el('', sc); rail.id = 'rail'; el('arrowL', rail); el('arrowR', rail);
  const LBL = {}, TICK = {}, side = v => v === 0 ? ' zero' : v < 0 ? ' neg' : ' pos';
  for (let v = -8; v <= 8; v++) {
    TICK[v] = el('tick' + side(v), sc, { left: X(v) + 'px' });
    const l = el('lbl' + side(v), sc, { left: X(v) + 'px' }); l.textContent = fmt(v); LBL[v] = l;
  }
  const scan = el('', sc); scan.id = 'scan';
  W.X = X; W.CONFIG = CONFIG; W.CONFIG_DEFAULTS = DEFAULTS; W.el = el; W.shake = shake; W.spawnBubble = big => spawnBubble(big);
  W.labelsOn = vals => { for (let v = -8; v <= 8; v++) LBL[v].classList.toggle('on', vals.includes(v)); };
  // power-on: the glass bar unfolds from 0, the rail draws out, ticks and numbers ripple outwards, a light sweeps left → right
  W.scaleIntro = async () => {
    gsap.set('#scale', { opacity: 1 });
    gsap.fromTo(back, { scaleX: .04, scaleY: .3, opacity: 0, transformOrigin: '50% 50%' }, { scaleX: 1, scaleY: 1, opacity: 1, duration: .75, ease: 'expo.out' });
    gsap.fromTo('#rail', { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: .7, ease: 'power3.out', delay: .1 });
    const ts = Object.values(TICK), ls = Object.values(LBL);
    gsap.fromTo(ts, { scaleY: 0 }, { scaleY: 1, duration: .35, ease: 'back.out(3)', stagger: { each: .03, from: 'center' }, delay: .3 });
    gsap.fromTo(ls, { opacity: 0, y: 14, scale: .6 }, { opacity: i => i === 8 ? 1 : .5, y: 0, scale: 1, duration: .4, ease: 'back.out(2.5)', stagger: { each: .03, from: 'center' }, delay: .4, clearProps: 'opacity,scale' });
    gsap.fromTo(sheen, { left: '-30%' }, { left: '110%', duration: 1.1, ease: 'power2.inOut', delay: .55 });
    SFX.ping(); await wait(1.1);
  };
  W.zeroGlow = () => gsap.fromTo([TICK[0], LBL[0]], { scale: 1 }, { scale: 1.5, duration: .35, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  // light scan from 0 to an end, labels brighten as it passes, a word appears at the end
  W.scan = async (to, word) => {
    const dir = Math.sign(to); gsap.set(scan, { left: X(0), opacity: 1 }); SFX.ping();
    const lit = [];
    await new Promise(r => gsap.to(scan, { left: X(to), duration: 2.2, ease: 'none', onUpdate() { const cur = Math.round((parseFloat(scan.style.left) - CONFIG.X0) / CONFIG.STEP); for (let v = 0; Math.abs(v) <= Math.abs(cur); v += dir || 1) { if (!lit.includes(v)) { lit.push(v); gsap.fromTo(LBL[v], { scale: 1.6 }, { scale: 1, duration: .5 }); LBL[v].classList.add('on'); } if (!dir) break; } }, onComplete: r }));
    const w = el('word', sc, { left: (dir > 0 ? X(to) - 340 : X(to) + 20) + 'px', top: '400px' }); w.innerHTML = word;
    gsap.fromTo(w, { opacity: 0, x: -30 * dir }, { opacity: 1, x: 0, duration: .5 });
    const arrow = el(dir > 0 ? 'sweep' : 'sweep left', sc, { left: Math.min(X(0), X(to)) + 'px', width: Math.abs(X(to) - X(0)) + 'px', top: '612px' });
    gsap.fromTo(arrow, { opacity: 0 }, { opacity: .9, duration: .4 });
    gsap.to(scan, { opacity: 0, duration: .4 });
    return () => { gsap.to([w, arrow], { opacity: 0, duration: .3, onComplete: () => { w.remove(); arrow.remove(); } }); lit.forEach(v => LBL[v].classList.remove('on')); };
  };

  /* ================= submarines ================= */
  let SUBS = [];
  W.spawn = async (vals, o = {}) => {
    const sorted = [...vals].sort((a, b) => a - b), depth = {};
    sorted.forEach((v, i) => { const p = sorted[i - 1]; depth[v] = (p != null && v - p < 2 && depth[p] === 0) ? 1 : 0; });
    const list = vals.map((v, i) => {
      const dy = depth[v] * CONFIG.SUB_ROW;
      const d = el('sub', play, { left: X(v) + 'px', top: (CONFIG.SUB_Y - SUB_H / 2 + dy) + 'px' }); d.dataset.v = v;
      const line = el('sonarline', sc, { left: X(v) + 'px' }); lineAt(line, CONFIG.SUB_Y + dy);
      const bob = el('bob', d); el('glow', bob); el('shield', bob); el('ring', bob);
      const im = new Image(); im.src = 'assets/img/sub.webp'; bob.appendChild(im);
      gsap.to(bob, { y: 6, duration: 1.4 + i * .17, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const s = { v, d, bob, im, line, alive: true, depth: depth[v], cy: CONFIG.SUB_Y + dy }; d._s = s; return s;
    });
    SUBS.push(...list);
    W.labelsOn(SUBS.filter(s => s.alive).map(s => s.v));
    // rise in from the deep, one by one, with a sonar ping
    for (const s of list) { gsap.fromTo(s.d, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power2.out' }); gsap.fromTo(s.line, { scaleY: 0, transformOrigin: s.cy < BAR_TOP + CONFIG.SCALE_DY ? '50% 100%' : '50% 0' }, { scaleY: 1, duration: .5, delay: .5 }); SFX.ping(); await wait(o.stagger == null ? .28 : o.stagger); }
    await wait(.5);
    return list;
  };
  // propellers keep churning: little bubbles stream from every live submarine's tail
  setInterval(() => {
    if (document.hidden || SD.paused) return;
    for (const s of SUBS) {
      if (!s.alive) continue;
      const x = X(s.v) + 100, y = s.cy + 8 + gsap.getProperty(s.bob, 'y'), r = 3 + Math.random() * 5;
      const b = el('pbub', fx, { left: x + 'px', top: y + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.to(b, { x: 40 + Math.random() * 50, y: -20 - Math.random() * 40, opacity: 0, duration: 1.4 + Math.random(), ease: 'power1.out', onComplete: () => b.remove() });
    }
  }, 360);   // (fewer, still a steady stream: each one is a DOM element + tween)
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

  /* ================= targeting & blast (the cannon and its torpedo live in cockpit.js: W.aimHook, W.fire) ================= */
  const aim = (x, y, dur) => W.aimHook && W.aimHook(x, y, dur);
  W.lock = async (s, color) => {
    const r = new Image(); r.src = 'assets/img/reticle.webp'; r.className = 'reticle'; Object.assign(r.style, { left: X(s.v) + 'px', top: s.cy + 'px' });
    if (color === 'red') r.style.filter = 'hue-rotate(165deg) saturate(2.2)';
    fx.appendChild(r); SFX.lock(); aim(X(s.v), s.cy);
    await gsap.fromTo(r, { scale: 1.9, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .38, ease: 'back.out(2)' });
    return r;
  };
  W.blast = async s => {
    SFX.boom(); s.alive = false;
    const b = el('blast', fx, { left: X(s.v) + 'px', top: s.cy + 'px' });
    shake(5, .45);
    const fl = $('#flash'); fl.style.setProperty('--fx', X(s.v) + 'px'); fl.style.setProperty('--fy', s.cy + 'px');
    gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: .6, ease: 'power2.out' });
    const sh = el('shock', fx, { left: X(s.v) + 'px', top: s.cy + 'px' });
    gsap.fromTo(sh, { scale: .2, opacity: 1 }, { scale: 3.4, opacity: 0, duration: .7, ease: 'power2.out', onComplete: () => sh.remove() });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, d = 80 + Math.random() * 150, r = 4 + Math.random() * 12;
      const bb = el(i < 5 ? 'debris' : 'pbub', fx, { left: X(s.v) + 'px', top: s.cy + 'px', width: (i < 5 ? 14 : 2 * r) + 'px', height: (i < 5 ? 14 : 2 * r) + 'px' });
      gsap.to(bb, { x: Math.cos(a) * d, y: Math.sin(a) * d * .7 + (i < 5 ? 160 : -60), rotation: i < 5 ? 360 * Math.random() : 0, opacity: 0, duration: i < 5 ? 1.4 : 1 + Math.random(), ease: 'power2.out', onComplete: () => bb.remove() });
    }
    W.lastHit = { x: X(s.v), y: s.cy };
    for (let f = 0; f < 4; f++) gsap.delayedCall(f * .12, () => { b.style.backgroundPosition = `${-f * 340}px 0`; });
    gsap.fromTo(b, { scale: .6 }, { scale: 1.25, duration: .5, ease: 'power2.out' }); gsap.to(b, { opacity: 0, duration: .4, delay: .45, onComplete: () => b.remove() });
    await wait(.12);
    s.im.src = 'assets/img/sub_hit.webp'; gsap.killTweensOf(s.bob); gsap.delayedCall(.35, SFX.sink);
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
  const RULES = { compare: $('#rule').innerHTML,
    pairs: '<span class="r"><i>▶</i> + <i>◀</i> = 0</span><span class="l">Count what is left</span>',
    same: '<span class="r">Same way</span><span class="l">Count every step</span>' };
  W.rule = (on, kind = 'compare') => {
    const r = $('#rule'); if (on && r.dataset.kind !== kind) { r.innerHTML = RULES[kind]; r.dataset.kind = kind; }
    gsap.to(r, { opacity: on ? 1 : 0, y: on ? 0 : -10, scale: on ? 1 : .96, duration: .35, ease: on ? 'back.out(2)' : 'power1.out' });
  };
  // the helper is a pulsing gold glow (no hand): it sits right on the thing to tap (#hand keeps its id for the levels + editor)
  W.hand = s => { const h = $('#hand'); if (!s) return gsap.to(h, { opacity: 0, duration: .2 }); gsap.killTweensOf(h); gsap.set(h, { left: X(s.v), top: s.cy, scale: 1.25 }); gsap.to(h, { opacity: 1, duration: .25 }); };
  // guided glow: appears on (or glides to) a point, then pulses as if tapped (used for demos)
  W.handTo = async (x, y, dur = .7) => { const h = $('#hand'); gsap.killTweensOf(h); const off = +getComputedStyle(h).opacity < .1; if (off) gsap.set(h, { left: x, top: y, scale: .4 }); gsap.to(h, { opacity: 1, scale: 1, duration: .3, ease: 'back.out(2)' }); if (!off) await gsap.to(h, { left: x, top: y, duration: dur, ease: 'power2.inOut' }); else await wait(Math.min(dur, .45)); };
  W.handTap = async (x, y) => { const h = $('#hand'); await gsap.to(h, { scale: 1.35, duration: .14, yoyo: true, repeat: 1, ease: 'power2.out' }); W.tapFx(x, y); SFX.tap(); };
  W.clearHints = () => { hintEls.forEach(a => { gsap.killTweensOf(a); gsap.to(a, { opacity: 0, duration: .25, onComplete: () => a.remove() }); }); hintEls = []; W.hand(null); W.dimOthers(null, false); };

  /* ================= badges (ordering) ================= */
  let BADGES = [];
  W.badge = (v, n) => { const b = el('badge', sc, { left: X(v) + 'px' }); b._v = v; b.innerHTML = `<span>${n}</span>`; gsap.fromTo(b, { scale: 0, y: 60 }, { scale: 1, y: 0, duration: .45, ease: 'back.out(2.5)' }); BADGES.push(b); };
  W.clearBadges = () => { BADGES.forEach(b => gsap.to(b, { opacity: 0, duration: .3, onComplete: () => b.remove() })); BADGES = []; };

  /* ================= HUD ================= */
  W.strip = (html, o = {}) => { $('#hudbar').classList.add('live'); const s = $('#strip'); s.innerHTML = o.big ? `<span class="big">${html}</span>` : html; s.classList.remove('glint'); void s.offsetWidth; s.classList.add('glint'); gsap.fromTo(s, { opacity: 0, y: -24, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2)' }); };
  W.stripOff = () => gsap.to('#strip', { opacity: 0, duration: .3 });
  W.pips = (n, done) => { const p = $('#pips'); p.innerHTML = ''; W.pipDone = done; for (let i = 0; i < n; i++) { const im = new Image(); im.src = 'assets/img/' + (i < done ? 'pip_on' : 'pip_off') + '.webp'; p.appendChild(im); } if (done > 0) gsap.fromTo(p.children[done - 1], { scale: 1.8 }, { scale: 1, duration: .4, ease: 'back.out(3)' }); if (p.children[done]) p.children[done].classList.add('now'); };
  W.banner = async (k, t, s, hold = 1.7) => {
    const b = $('#banner'); $('#bk').textContent = k; $('#bt').textContent = t; $('#bs').textContent = s; b.classList.remove('hidden');
    gsap.fromTo('#banner .card', { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }); SFX.ping();
    gsap.fromTo(['#bk', '#bt', '#bs'], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .12, delay: .15 });
    await wait(hold); await gsap.to('#banner .card', { scale: .9, opacity: 0, duration: .3 }); b.classList.add('hidden');
  };

  /* ================= Level 3: movement signals + defence marker ================= */
  const L3 = { sigs: [], marker: null };
  W.marker = v => { if (!L3.marker) { L3.marker = el('', sc); L3.marker.id = 'marker'; } gsap.set(L3.marker, { left: X(v), opacity: 1 }); gsap.fromTo(L3.marker, { y: -40 }, { y: 0, duration: .5, ease: 'bounce.out' }); L3.mv = v; };
  W.markerOff = () => { if (L3.marker) gsap.to(L3.marker, { opacity: 0, duration: .3 }); };
  // two rows (CONFIG.SIG_Y1 / SIG_Y2) meeting in the middle; each signal is ±1 step.
  const SIG_MID = () => (CONFIG.SIG_Y1 + CONFIG.SIG_Y2) / 2, sigX = (k, cols) => CONFIG.X0 + (k - (cols - 1) / 2) * CONFIG.SIG_GAP;
  W.signals = async (rows) => {   // rows: [{n:5,sign:+1},{n:3,sign:-1}]
    L3.sigs = []; const mid = SIG_MID(), pod = el('pod', sg, { left: CONFIG.X0 + 'px', top: mid + 'px' });
    gsap.fromTo(pod, { scale: 0 }, { scale: 1, duration: .4, ease: 'back.out(2)' }); SFX.ping(); await wait(.5);
    const cols = Math.max(...rows.map(r => r.n)); L3.cols = cols;
    for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].n; k++) {
      const x = sigX(k, cols), y = r === 0 ? CONFIG.SIG_Y1 : CONFIG.SIG_Y2;
      const d = el('sig' + (rows[r].sign < 0 ? ' neg' : ''), sg, { left: x + 'px', top: y + 'px' });
      const s = { d, sign: rows[r].sign, row: r, col: k, x, y, alive: true }; L3.sigs.push(s);
      gsap.fromTo(d, { left: CONFIG.X0, top: mid, opacity: 0, scale: .3 }, { left: x, top: y, opacity: 1, scale: 1, duration: .5, ease: 'back.out(1.6)' }); SFX.pop();
      await wait(.12);
    }
    gsap.to(pod, { scale: 0, opacity: 0, duration: .3, delay: .2, onComplete: () => pod.remove() });
    await wait(.6);
  };
  W.sigAlive = () => L3.sigs.filter(s => s.alive);
  // child taps a column to cancel one + and one − ; resolves when no opposite pairs remain
  W.pairUp = (onPair, help = {}) => new Promise(res => {
    const pos = () => W.sigAlive().filter(s => s.sign > 0), neg = () => W.sigAlive().filter(s => s.sign < 0);
    let calls = [];
    const idleCall = { kill() { calls.forEach(c => c.kill()); calls = []; } };
    const arm = () => { idleCall.kill(); calls = [gsap.delayedCall(6, W.hintPairs), help.idle && gsap.delayedCall(12, help.idle), help.idle2 && gsap.delayedCall(22, help.idle2)].filter(Boolean); };
    arm();
    const boxes = [];
    const pairs = Math.min(pos().length, neg().length);
    for (let k = 0; k < pairs; k++) {
      const p = L3.sigs.find(s => s.sign > 0 && s.col === k), n = L3.sigs.find(s => s.sign < 0 && s.col === k);
      const b = el('pairbox', sg, { left: p.x + 'px', top: (CONFIG.SIG_Y1 - 36) + 'px' }); b._p = p; boxes.push(b); b.style.pointerEvents = 'auto';
      sg.insertBefore(b, L3.sigs[0].d);   // the button sits under its two arrows
      gsap.fromTo(b, { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, delay: k * .08, ease: 'back.out(2)' });
      gsap.to([p.d, n.d], { y: -4, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: k * .1 });
      b.onpointerdown = async () => {
        if (b._used) return; b._used = true; arm(); boxes.forEach(x => x.classList.remove('hint'));
        p.alive = n.alive = false; gsap.killTweensOf([p.d, n.d]); p.d.classList.add('pair'); n.d.classList.add('pair');
        const mid = SIG_MID();
        await Promise.all([gsap.to(p.d, { top: mid, duration: .28, ease: 'power2.in' }), gsap.to(n.d, { top: mid, duration: .28, ease: 'power2.in' })]);
        SFX.pop(); const pop = el('pop', sg, { left: p.x + 'px', top: mid + 'px' }); gsap.fromTo(pop, { scale: .3 }, { scale: 1.1, opacity: 0, duration: .7, onComplete: () => pop.remove() });
        // ▶ + ◀ collide: a ring bursts and a big glowing 0 springs out, then fizzles into sparkles
        const ring = el('zboom', sg, { left: p.x + 'px', top: mid + 'px' }); gsap.fromTo(ring, { scale: .2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: .6, ease: 'power2.out', onComplete: () => ring.remove() });
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, sp = el('pbub', sg, { left: p.x + 'px', top: mid + 'px', width: '10px', height: '10px', background: i % 2 ? '#ffd66b' : '#8ff3ff', border: 'none' }); gsap.to(sp, { x: Math.cos(a) * 110, y: Math.sin(a) * 80, opacity: 0, scale: .4, duration: .55, ease: 'power2.out', onComplete: () => sp.remove() }); }
        const z = el('zero0 big', sg, { left: p.x + 'px', top: mid + 'px' }); z.textContent = '0'; gsap.set(z, { xPercent: -50, yPercent: -50 });
        gsap.timeline({ onComplete: () => z.remove() }).fromTo(z, { scale: .2, rotation: -20 }, { scale: 1.3, rotation: 0, duration: .45, ease: 'back.out(3)' })
          .to(z, { scale: .6, y: -50, opacity: 0, duration: .45, ease: 'power2.in', onStart: () => W.sparkle && gsap.delayedCall(.3, () => W.sparkle(p.x, mid - 50)) }, '+=.35');
        p.d.remove(); n.d.remove(); b.remove(); onPair && onPair();
        if (!boxes.some(x => !x._used)) { idleCall.kill(); res(); }
      };
    }
    if (!pairs) { idleCall.kill(); res(); }
    W._pairBoxes = boxes;
  });
  W.hintPairs = () => { const open = (W._pairBoxes || []).filter(b => !b._used); open.forEach(b => b.classList.add('hint')); gsap.fromTo(open, { scale: 1 }, { scale: 1.07, duration: .3, yoyo: true, repeat: 3, ease: 'sine.inOut' }); };
  W.pairCentre = () => { const b = (W._pairBoxes || []).find(x => !x._used); if (!b) return null; const r = b.getBoundingClientRect(), st = $('#stage').getBoundingClientRect(), k = st.width / 1920; return { x: (r.left - st.left + r.width / 2) / k, y: (r.top - st.top + r.height / 2) / k }; };
  // leftover signals fly into the marker one by one; marker steps 1 each time
  W.runMarker = async (group) => {
    const left = group || W.sigAlive();
    for (const s of left) {
      const to = L3.mv + s.sign;
      await gsap.to(s.d, { left: X(L3.mv), top: parseFloat(getComputedStyle(L3.marker).top) + 20 + CONFIG.SCALE_DY, scale: .5, duration: .35, ease: 'power2.in' });
      s.alive = false; s.d.remove(); SFX.step();
      await gsap.to(L3.marker, { left: X(to), duration: .3, ease: 'power2.out' }); L3.mv = to;
      gsap.fromTo(LBL[to], { scale: 1.5 }, { scale: 1, duration: .3 });
    }
  };
  W.clearSignals = () => { L3.sigs.forEach(s => s.d.remove()); L3.sigs = []; (W._pairBoxes || []).forEach(b => b.remove()); };

  /* ================= reward: a burst of confetti, the praise word, a sonar contact (glowing blip with pulsing rings) that flies up and lights the next progress lamp ================= */
  const top = $('#fxTop'), COL = ['#ffd66b', '#ffb070', '#7ff2ff', '#ffffff', '#ff8fb1', '#9dff9a'];
  const centreOf = e => { const r = e.getBoundingClientRect(), st = $('#stage').getBoundingClientRect(), k = st.width / 1920; return { x: (r.left - st.left + r.width / 2) / k, y: (r.top - st.top + r.height / 2) / k }; };
  function confetti(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const c = el('confetti' + (i % 3 ? '' : ' star'), top, { left: x + 'px', top: y + 'px', background: COL[i % COL.length] });
      const a = Math.random() * Math.PI * 2, d = spread * (.45 + Math.random() * .75);
      gsap.timeline({ onComplete: () => c.remove() })
        .fromTo(c, { scale: 0 }, { scale: 1, x: Math.cos(a) * d, y: Math.sin(a) * d * .75 - 50, rotation: (Math.random() - .5) * 720, duration: .65, ease: 'power3.out' })
        .to(c, { y: '+=150', rotation: '+=180', opacity: 0, duration: .9, ease: 'power1.in' }, '-=.1');
    }
  }
  W.sparkle = (x, y) => { SFX.sparkle(); confetti(x, y, 8, 110); };
  W.reward = (o = {}) => {
    const { x, y } = o.at || W.lastHit || { x: 960, y: 600 };
    SFX.reward(o.big);
    const ring = el('ringfx', top, { left: x + 'px', top: y + 'px' });
    gsap.fromTo(ring, { scale: .2, opacity: 1 }, { scale: 2.4, opacity: 0, duration: .75, ease: 'power2.out', onComplete: () => ring.remove() });
    confetti(x, y, o.big ? 26 : 14, o.big ? 300 : 200);
    if (o.word) {   // the same words Riya says, so text and voice agree
      const p = el('praise' + (o.big ? '' : ' soft'), top, { left: x + 'px', top: (y - 40) + 'px' }); p.textContent = o.word;
      gsap.timeline({ delay: o.pip != null ? .5 : 0, onComplete: () => p.remove() })
        .fromTo(p, { scale: 0, rotation: -14 }, { scale: 1, rotation: 0, duration: .6, ease: 'elastic.out(1,.45)', immediateRender: true })
        .to(p, { y: -80, opacity: 0, duration: .55, ease: 'power2.in' }, '+=.75');
    }
    const pip = o.pip != null && $('#pips').children[o.pip];
    if (!pip) return;
    // a sonar contact rises from the wreck: a glowing blip with rings pulsing out, it flies up and lights its contact lamp
    const to = centreOf(pip), st = el('flyping', top, { left: x + 'px', top: y + 'px' }), mx = (x + to.x) / 2 + 120, my = Math.min(y, to.y) - 220, pr = { p: 0 };
    st.innerHTML = '<i></i><i></i>';
    const pingRing = () => { const r = el('pingring', top, { left: st.style.left, top: st.style.top }); gsap.fromTo(r, { scale: .3, opacity: .9 }, { scale: 2.2, opacity: 0, duration: .7, ease: 'power1.out', onComplete: () => r.remove() }); };
    SFX.blip(); pingRing();
    gsap.timeline({ onComplete: () => st.remove() })
      .fromTo(st, { scale: 0 }, { scale: 1.25, duration: .35, ease: 'back.out(3)' })
      .to(pr, { p: 1, duration: .85, ease: 'power2.in', onUpdate() {
        const p = pr.p, q = 1 - p; st.style.left = (q * q * x + 2 * q * p * mx + p * p * to.x) + 'px'; st.style.top = (q * q * y + 2 * q * p * my + p * p * to.y) + 'px';
        gsap.set(st, { scale: 1.25 - .7 * p });
        if (p > .3 && !st._r1) { st._r1 = 1; pingRing(); } if (p > .65 && !st._r2) { st._r2 = 1; pingRing(); }   // it keeps pinging on the way up
      }, onComplete() {
        SFX.ping(); SFX.ding(); pip.src = 'assets/img/pip_on.webp';
        gsap.fromTo(pip, { scale: 2.2 }, { scale: 1, duration: .5, ease: 'back.out(3)' });
        const b = el('pipburst', top, { left: to.x + 'px', top: to.y + 'px' }); gsap.fromTo(b, { scale: .3, opacity: 1 }, { scale: 2, opacity: 0, duration: .5, onComplete: () => b.remove() });
      } }, '-=.05');
  };

  /* re-place everything that was positioned from CONFIG (the editor calls this after a constant changes) */
  W.applyConfig = () => {
    sc.style.transform = CONFIG.SCALE_DY ? `translateY(${CONFIG.SCALE_DY}px)` : '';
    for (let v = -8; v <= 8; v++) TICK[v].style.left = LBL[v].style.left = X(v) + 'px';
    rail.style.left = X(-8.5) + 'px'; rail.style.width = 17 * CONFIG.STEP + 'px';
    back.style.left = (X(-8.5) - 44) + 'px'; back.style.width = (17 * CONFIG.STEP + 88) + 'px';
    for (const s of SUBS) {
      const dy = s.depth * CONFIG.SUB_ROW; s.cy = CONFIG.SUB_Y + dy;
      s.d.style.left = s.line.style.left = X(s.v) + 'px'; s.d.style.top = (s.cy - SUB_H / 2) + 'px'; lineAt(s.line, s.cy);
    }
    BADGES.forEach(b => { b.style.left = X(b._v) + 'px'; });
    for (const s of L3.sigs) if (s.alive) { s.x = sigX(s.col, L3.cols); s.y = s.row === 0 ? CONFIG.SIG_Y1 : CONFIG.SIG_Y2; gsap.set(s.d, { left: s.x, top: s.y }); }
    (W._pairBoxes || []).forEach(b => { b.style.left = b._p.x + 'px'; b.style.top = (CONFIG.SIG_Y1 - 36) + 'px'; });
    if (L3.marker && L3.mv != null) L3.marker.style.left = X(L3.mv) + 'px';
  };
  W.applyConfig();

  window.W = W;
})();
