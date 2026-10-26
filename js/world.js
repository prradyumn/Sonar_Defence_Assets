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
  const SHK = { amp: 0, t: 0, d: 1 }, TILT = { r: 0, y: 0, was: false };   // TILT: the whole view rolls (r, degrees) and drops (y) as we sink
  gsap.ticker.add((t, dt) => {
    const tilt = !!(TILT.r || TILT.y);
    if (!SHK.amp && !tilt && !TILT.was) return;
    TILT.was = tilt; let x = 0, y = 0;
    if (SHK.amp) { SHK.t += dt / 1000; const a = SHK.amp * Math.max(0, 1 - SHK.t / SHK.d);
      if (a < .5) SHK.amp = 0; else { x = Math.round((Math.random() - .5) * 2 * a); y = Math.round((Math.random() - .5) * 1.2 * a); } }
    shakeEl.style.transform = `translate3d(${x}px,${y + TILT.y}px,0)` + (tilt ? ` rotate(${TILT.r}deg) scale(${1 + Math.abs(TILT.r) * .032 + Math.abs(TILT.y) / 540})` : '');   // (scaled up so the edges never show)
  });
  const shake = (k = 8, d = .4) => { const left = SHK.amp * Math.max(0, 1 - SHK.t / SHK.d); if (k < left) return; SHK.amp = k; SHK.t = 0; SHK.d = d; };
  /* positions that come from code, not CSS — tunable live in the layout editor, saved in js/layout.js (LAYOUT.config) */
  const DEFAULTS = {
    X0: 960,        // stage x of 0 on the navigation scale
    STEP: 106,      // px between whole numbers when the scale shows −8 … +8 (a wider range packs them closer)
    SUB_Y: 350,     // submarine centre y (row 1), out in the water above the scale
    SUB_ROW: -105,  // row 2 (a neighbour less than 2 apart) sits this much lower (negative = higher)
    SIG_Y1: 330,    // Level 1 missile rows: top (the missiles that come)
    SIG_Y2: 545,    //                       the launch bay's top row (the ones the child launches collect there, rows of 5)
    SIG_GAP: 170,   // px between missile columns (at most: many missiles pack closer)
    SCALE_DY: -80,  // moves the whole scale group (rope, buoys, numbers, marker, hints) down
  };
  const CONFIG = Object.assign({}, DEFAULTS, window.LAYOUT && LAYOUT.config);
  /* the navigation scale is a long rope (−30 … +30) at full spacing; the view pans along it. #scale (rope, buoys, numbers,
     marker, sonar lines) and #play (the submarines) move together as two GPU layers, so a pan is one transform.
     XR(v) = a position on the rope (for anything inside #scale / #play) · X(v) = the same point on the stage now. */
  const PV = { c: 0, MIN: -30, MAX: 30 };
  const XR = v => CONFIG.X0 + v * CONFIG.STEP;
  const X = v => XR(v) - PV.c * CONFIG.STEP;
  const SUB_H = 90, LINE_TOP = 640, BAR_TOP = 554;   // .sub height · .sonarline top (below) · top of the buoys (game.css)
  // the dotted sonar line joins a submarine to the scale: down from the rail (subs below) or down from the sub (subs above)
  const lineAt = (ln, cy) => {   // (the line lives in #scale, which is shifted by SCALE_DY)
    const t = cy - SUB_H / 2, dy = CONFIG.SCALE_DY;
    if (t > BAR_TOP + dy) { ln.style.top = LINE_TOP + 'px'; ln.style.height = (t - dy - LINE_TOP) + 'px'; }
    else { ln.style.top = (t + SUB_H - dy) + 'px'; ln.style.height = (BAR_TOP + dy - t - SUB_H) + 'px'; }
  };
  const play = $('#play'), fx = $('#fx'), sc = $('#scale'), sg = $('#sigs');   // sg: Level 1 missiles
  const el = (cls, parent, css = {}) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); parent.appendChild(d); return d; };

  /* ================= parallax ================= */
  // Each strip is mirrored (A | flipped A) so the joins always match; the track wraps every 2 widths.
  const LAYERS = [];
  function strip(id, src, h, w, speed, par) {
    const t = $('#' + id); for (let i = 0; i < 4; i++) { const im = new Image(); im.src = 'assets/img/' + src; im.style.width = w + 'px'; if (i % 2) im.className = 'flip'; t.appendChild(im); }
    t.style.width = (4 * w) + 'px'; LAYERS.push({ t, w, speed, par, x: 0 });
  }
  strip('far', 'far.webp', 440, 2414, 18, .12);      // par: how much a strip follows a pan of the rope
  strip('seabed', 'seabed.webp', 260, 2377, 46, .35);
  const caus = { x: 0 }, cEl = $('#caustics');
  const W = { mult: 1, t: 0 };
  gsap.ticker.add((time, dt) => {
    if (SD.paused) return;
    const s = dt / 1000 * W.mult * SD.rate; W.t = time;
    const px = PV.c * CONFIG.STEP;   // parallax: the far reef and the seabed follow a pan of the rope a little
    for (const L of LAYERS) { L.x = (L.x + L.speed * s) % (2 * L.w); const t = ((L.x + px * L.par) % (2 * L.w) + 2 * L.w) % (2 * L.w); L.t.style.transform = `translate3d(${-t}px,0,0)`; }
    caus.x = (caus.x + 26 * s) % 512; cEl.style.transform = `translate3d(${-caus.x}px,${Math.sin(time * .6) * 6}px,0)`;
  });
  gsap.to('#rays', { x: 60, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut' });   // drift only: rotating this big layer redrew it every frame
  gsap.to('#rays', { opacity: .3, duration: 3.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#caustics', { opacity: .22, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('#far', { y: 8, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  /* ---- marine snow (tiny drifting specks: the strongest "we are underwater" cue) ---- */
  const snow = $('#snow'), sctx = snow.getContext('2d'), SN = []; sctx.scale(.5, .5);   // half-resolution canvas, CSS shows it full size
  for (let i = 0; i < 110; i++) SN.push({ x: Math.random() * 1920, y: Math.random() * 1080, z: .3 + Math.random() * .7, ph: Math.random() * 6 });
  let snowDt = 0, snowOdd = false;
  gsap.ticker.add((t, dt) => {
    if (SD.paused) return;
    snowDt += dt; snowOdd = !snowOdd; if (snowOdd) return;   // 30 fps is plenty for slow specks and halves the canvas uploads
    const s = snowDt / 1000 * SD.rate; snowDt = 0; sctx.clearRect(0, 0, 1920, 1080);
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
  setInterval(() => { if (!document.hidden && !SD.paused && $('#fishL').children.length < (SD.CALM ? 1 : 4)) school(false); }, 6500);
  // bubbles drifting past (rise + go backwards = we are moving forward)
  const bub = $('#bubbles');
  function spawnBubble(big) {
    const r = big ? 10 + Math.random() * 18 : 3 + Math.random() * 8, b = el('bub', bub, { width: 2 * r + 'px', height: 2 * r + 'px', left: (200 + Math.random() * 1900) + 'px', top: (1080 + r) + 'px', opacity: .3 + Math.random() * .5 });
    const o = { y: 0, x: 0 }, vy = 40 + Math.random() * 70 + (big ? 30 : 0), vx = 30 + Math.random() * 60;
    const tick = (t, dt) => { if (SD.paused) return; const s = dt / 1000 * SD.rate; o.y -= vy * s; o.x -= vx * s * W.mult * (big ? 1.4 : 1); b.style.transform = `translate3d(${o.x + Math.sin(t * 2 + r) * 6}px,${o.y}px,0)`; if (o.y < -830 || o.x < -2200) { gsap.ticker.remove(tick); b.remove(); } };
    gsap.ticker.add(tick);
  }
  setInterval(() => { if (!document.hidden && !SD.paused) spawnBubble(Math.random() < .15); }, SD.CALM ? 560 : 260);
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
  let LBL = {}, TICK = {}, ON = [];
  const side = v => v === 0 ? ' zero' : v < 0 ? ' neg' : ' pos', VALS = () => Object.keys(LBL).map(Number).sort((a, b) => a - b);
  function syncBuoys() {   // buoys exist only near the view (±11 around its centre): made and dropped as it pans
    const lo = Math.max(PV.MIN, Math.ceil(PV.c - 11)), hi = Math.min(PV.MAX, Math.floor(PV.c + 11));
    for (const v of VALS()) if (v < lo || v > hi) { gsap.killTweensOf([TICK[v], LBL[v]]); TICK[v].remove(); LBL[v].remove(); delete TICK[v]; delete LBL[v]; }
    for (let v = lo; v <= hi; v++) {
      if (LBL[v]) continue;
      TICK[v] = el('tick' + side(v) + (ON.includes(v) ? ' on' : ''), sc, { left: XR(v) + 'px' });
      el('bob', TICK[v], { animationDelay: (-(v + 30) * .37 % 3.2).toFixed(2) + 's' }); el('clamp', TICK[v]);   // each buoy bobs out of step
      const l = el('lbl' + side(v) + (ON.includes(v) ? ' on' : ''), sc, { left: XR(v) + 'px' }); l.textContent = fmt(v); LBL[v] = l;
    }
  }
  const scan = el('', sc); scan.id = 'scan';
  syncBuoys();
  W.X = X; W.XR = XR; W.CONFIG = CONFIG; W.CONFIG_DEFAULTS = DEFAULTS; W.el = el; W.shake = shake; W.tilt = TILT; W.spawnBubble = big => spawnBubble(big);
  // 0 (the border) out of view: a chip at that edge points to it (tap it to glide back)
  const zchip = el('', $('#fx')); zchip.id = 'zchip'; zchip.innerHTML = '<b>0</b>';
  zchip.onpointerdown = e => { e.stopPropagation(); W.panTo(0); };
  function applyPan() {
    const px = PV.c * CONFIG.STEP; gsap.set([sc, play], { x: -px }); gsap.set(rail, { x: px, backgroundPositionX: -px }); syncBuoys();
    const x0 = X(0), off = x0 < 230 ? -1 : x0 > 1690 ? 1 : 0;
    zchip.className = off ? (off < 0 ? 'l on' : 'r on') : '';
  }
  W.pan = () => PV.c;
  W.panTo = (c, dur = 1.3) => { c = Math.max(PV.MIN + 8, Math.min(PV.MAX - 8, c)); gsap.killTweensOf(PV); if (Math.abs(c - PV.c) < .01) return Promise.resolve();
    return new Promise(r => gsap.to(PV, { c, duration: dur, ease: 'power2.inOut', onUpdate: applyPan, onComplete: r })); };
  // centre the view on these values (and 0 as well when they all fit)
  W.panFor = (vals, dur) => { const lo = Math.min(...vals), hi = Math.max(...vals), lo0 = Math.min(lo, 0), hi0 = Math.max(hi, 0);
    return W.panTo(hi0 - lo0 <= 14 ? (lo0 + hi0) / 2 : (lo + hi) / 2, dur); };
  // keep a value in view while something runs along the rope
  W.follow = v => { const x = X(v); if (x > 1560) return W.panTo(PV.c + (x - 1560) / CONFIG.STEP + 3, .5); if (x < 360) return W.panTo(PV.c - (360 - x) / CONFIG.STEP - 3, .5); return Promise.resolve(); };
  /* the child can drag the rope to look along it (the levels switch this on); it glides on a little when let go */
  const drag = { on: false, id: null, x0: 0, c0: 0, last: 0, t: 0, v: 0 };
  W.dragRope = on => { drag.on = on; };
  stageEl.addEventListener('pointerdown', e => {
    if (!drag.on || e.target.closest('.sub,.msl,#hud,#zchip,.overlay,#story')) return;
    const y = SD.toStage(e.clientX, e.clientY).y, ry = W.LBL_Y + CONFIG.SCALE_DY - 60; if (Math.abs(y - ry) > 150) return;   // on the rope band only
    drag.id = e.pointerId; drag.x0 = e.clientX; drag.c0 = PV.c; drag.last = e.clientX; drag.t = performance.now(); drag.v = 0; gsap.killTweensOf(PV);
  });
  addEventListener('pointermove', e => {
    if (e.pointerId !== drag.id) return; const k = SD.stageScale(), now = performance.now();
    drag.v = (e.clientX - drag.last) / k / Math.max(1, now - drag.t); drag.last = e.clientX; drag.t = now;
    PV.c = Math.max(PV.MIN + 8, Math.min(PV.MAX - 8, drag.c0 - (e.clientX - drag.x0) / k / CONFIG.STEP)); applyPan();
  });
  addEventListener('pointerup', e => { if (e.pointerId !== drag.id) return; drag.id = null; W.panTo(PV.c - drag.v * 260 / CONFIG.STEP, .7); });
  addEventListener('pointercancel', () => { drag.id = null; });
  W.labelsOn = vals => { ON = vals.slice(); for (const v of VALS()) { LBL[v].classList.toggle('on', vals.includes(v)); TICK[v].classList.toggle('on', vals.includes(v)); } };
  W.lbl = v => LBL[v];
  W.LBL_Y = 687;   // centre of a number label (scale coords; add CONFIG.SCALE_DY on stage)
  // power-on: the glass bar unfolds from 0, the rail draws out, ticks and numbers ripple outwards, a light sweeps left → right
  W.scaleIntro = async () => {
    gsap.set('#scale', { opacity: 1 });
    gsap.fromTo(back, { scaleX: .04, scaleY: .3, opacity: 0, transformOrigin: '50% 50%' }, { scaleX: 1, scaleY: 1, opacity: 1, duration: .75, ease: 'expo.out' });
    gsap.fromTo('#rail', { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: .7, ease: 'power3.out', delay: .1 });
    const ts = VALS().map(v => TICK[v]), ls = VALS().map(v => LBL[v]), from = { each: .03, from: Math.max(0, VALS().indexOf(Math.round(PV.c))) };
    gsap.fromTo(ts, { scaleY: 0 }, { scaleY: 1, duration: .35, ease: 'back.out(3)', stagger: from, delay: .3 });
    gsap.fromTo(ls, { opacity: 0, y: 14, scale: .6 }, { opacity: 1, y: 0, scale: 1, duration: .4, ease: 'back.out(2.5)', stagger: from, delay: .4, clearProps: 'opacity,scale,y' });
    gsap.fromTo(sheen, { left: '-30%' }, { left: '110%', duration: 1.1, ease: 'power2.inOut', delay: .55 });
    SFX.ping(); await wait(1.1);
  };
  W.zeroGlow = () => gsap.fromTo([TICK[0], LBL[0]].filter(Boolean), { scale: 1 }, { scale: 1.5, duration: .35, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  // light scan from 0 to an end, labels brighten as it passes, a word appears at the end
  W.scan = async (to, word) => {
    const dir = Math.sign(to); gsap.set(scan, { left: XR(0), opacity: 1 }); SFX.ping();
    const lit = [];
    await new Promise(r => gsap.to(scan, { left: XR(to), duration: 2.2, ease: 'none', onUpdate() { const cur = Math.round((parseFloat(scan.style.left) - CONFIG.X0) / CONFIG.STEP); for (let v = 0; Math.abs(v) <= Math.abs(cur); v += dir || 1) { if (!lit.includes(v) && LBL[v]) { lit.push(v); gsap.fromTo(LBL[v], { scale: 1.6 }, { scale: 1, duration: .5 }); LBL[v].classList.add('on'); } if (!dir) break; } }, onComplete: r }));
    const w = el('word', sc, { left: (dir > 0 ? XR(to) - 340 : XR(to) + 20) + 'px', top: '400px' }); w.innerHTML = word || '';
    gsap.fromTo(w, { opacity: 0, x: -30 * dir }, { opacity: 1, x: 0, duration: .5 });
    const arrow = el(dir > 0 ? 'sweep' : 'sweep left', sc, { left: Math.min(XR(0), XR(to)) + 'px', width: Math.abs(XR(to) - XR(0)) + 'px', top: '478px' });
    gsap.fromTo(arrow, { opacity: 0 }, { opacity: .9, duration: .4 });
    gsap.to(scan, { opacity: 0, duration: .4 });
    return () => { gsap.to([w, arrow], { opacity: 0, duration: .3, onComplete: () => { w.remove(); arrow.remove(); } }); lit.forEach(v => LBL[v].classList.remove('on')); };
  };

  /* ================= submarines ================= */
  let SUBS = [];
  W.spawn = async (vals, o = {}) => {
    const sorted = [...vals].sort((a, b) => a - b), depth = {};   // a neighbour closer than a submarine's width goes up a row
    sorted.forEach((v, i) => { const p = sorted[i - 1]; depth[v] = (p != null && XR(v) - XR(p) < 230 && depth[p] === 0) ? 1 : 0; });
    const list = vals.map((v, i) => {
      const at = o.at && o.at[i], dy = at ? 0 : depth[v] * CONFIG.SUB_ROW, x = at ? at.x + PV.c * CONFIG.STEP : XR(v), cy = at ? at.y : CONFIG.SUB_Y + dy;   // (#play pans with the rope)
      const d = el('sub', play, { left: x + 'px', top: (cy - SUB_H / 2) + 'px' }); d.dataset.v = v;
      const line = el('sonarline', sc, { left: x + 'px' }); lineAt(line, cy); if (at) line.style.display = 'none';
      const bob = el('bob', d); el('glow', bob); el('shield', bob); el('ring', bob);
      const im = new Image(); im.src = 'assets/img/sub.webp'; bob.appendChild(im);
      let tag = null; if (at) { tag = el('subtag' + side(v), bob); tag.textContent = fmt(v); }   // free in the water: the number rides on the submarine
      gsap.to(bob, { y: 6, duration: 1.4 + i * .17, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const s = { v, d, bob, im, line, tag, free: !!at, alive: true, depth: at ? 0 : depth[v], cy, get x() { return at ? at.x : X(v); } }; d._s = s; return s;   // x: on the stage, now
    });
    SUBS.push(...list);
    W.labelsOn(SUBS.filter(s => s.alive && !s.free).map(s => s.v));
    // rise in from the deep, one by one, with a sonar ping
    for (const s of list) { gsap.fromTo(s.d, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power2.out' }); gsap.fromTo(s.line, { scaleY: 0, transformOrigin: s.cy < BAR_TOP + CONFIG.SCALE_DY ? '50% 100%' : '50% 0' }, { scaleY: 1, duration: .5, delay: .5 }); SFX.ping(); await wait(o.stagger == null ? .28 : o.stagger); }
    await wait(.5);
    return list;
  };
  // propellers keep churning: little bubbles stream from every live submarine's tail
  if (!SD.CALM) setInterval(() => {
    if (document.hidden || SD.paused) return;
    for (const s of SUBS) {
      if (!s.alive) continue;
      const x = s.x + 100, y = s.cy + 8 + gsap.getProperty(s.bob, 'y'), r = 3 + Math.random() * 5;
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
  W.pulseSub = (s, delay = 0) => { if (!s) return;   // a gold halo + ring while it pulses
    gsap.delayedCall(delay, () => s.d.classList.add('cue')); gsap.delayedCall(delay + 2.8, () => s.d.classList.remove('cue'));
    gsap.fromTo(s.d, { scale: 1 }, { scale: 1.15, duration: .4, yoyo: true, repeat: 5, delay, ease: 'sine.inOut' }); };
  W.pulseLbl = (v, delay = 0) => { const l = LBL[v]; if (!l) return; l.classList.add('on'); gsap.fromTo(l, { scale: 1 }, { scale: 1.45, duration: .4, yoyo: true, repeat: 5, delay, ease: 'sine.inOut', onComplete: () => { if (!W.subs().some(s => s.v === v && !s.free)) l.classList.remove('on'); } }); };
  W.pulseZero = (delay = 0) => { gsap.fromTo([TICK[0], LBL[0]].filter(Boolean), { scale: 1 }, { scale: 1.45, duration: .4, yoyo: true, repeat: 5, delay, ease: 'sine.inOut' }); if (defl) gsap.fromTo(defl, { opacity: 1 }, { opacity: .35, duration: .4, yoyo: true, repeat: 5, delay }); };
  W.pulseTag = (s, delay = 0) => s && s.tag && gsap.fromTo(s.tag, { scale: 1 }, { scale: 1.4, duration: .4, yoyo: true, repeat: 5, delay, ease: 'sine.inOut' });
  // the target ring: a cyan ring locks round a submarine and stays until the hints clear
  W.ring = s => { if (!s) return; const r = s.d.querySelector('.ring'); gsap.killTweensOf(r); gsap.set(r, { opacity: 1 }); gsap.fromTo(r, { scale: 1.6 }, { scale: 1, duration: .4, ease: 'back.out(2)' }); hintEls.push({ ring: r }); };

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
      o.noIdle ? null : gsap.delayedCall(o.nudge || 6, o.onNudge || (() => { play.classList.add('nudge'); W.pulseAll(); gsap.fromTo('#strip', { scale: 1 }, { scale: 1.04, duration: .25, yoyo: true, repeat: 3 }); })),
      o.onIdle ? gsap.delayedCall(o.idle || 12, o.onIdle) : null,
      o.onIdle2 ? gsap.delayedCall(o.idle2 || 22, o.onIdle2) : null,
    ].filter(Boolean);
    tapRes = s => { W.waiting = false; play.classList.remove('waiting', 'nudge'); calls.forEach(c => c.kill()); SFX.tap(); W.tapFx(s.x, s.cy); res(s); };
  });
  W.tapFx = (x, y) => { const t = el('tapfx', fx, { left: x + 'px', top: y + 'px' }); gsap.fromTo(t, { scale: .3, opacity: 1 }, { scale: 1.6, opacity: 0, duration: .45, onComplete: () => t.remove() }); };
  W.cancelTap = () => { tapRes = null; W.waiting = false; play.classList.remove('waiting', 'nudge'); };

  /* ================= targeting & blast (the cannon and its torpedo live in cockpit.js: W.aimHook, W.fire) ================= */
  const aim = (x, y, dur) => W.aimHook && W.aimHook(x, y, dur);
  W.lock = async (s, color) => {
    const r = new Image(); r.src = 'assets/img/reticle.webp'; r.className = 'reticle'; Object.assign(r.style, { left: s.x + 'px', top: s.cy + 'px' });
    if (color === 'red') r.style.filter = 'hue-rotate(165deg) saturate(2.2)';
    fx.appendChild(r); SFX.lock(); aim(s.x, s.cy);
    await gsap.fromTo(r, { scale: 1.9, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .38, ease: 'back.out(2)' });
    return r;
  };
  W.blast = async s => {
    SFX.boom(); s.alive = false;
    const b = el('blast', fx, { left: s.x + 'px', top: s.cy + 'px' });
    shake(5, .45);
    const fl = $('#flash'); fl.style.setProperty('--fx', s.x + 'px'); fl.style.setProperty('--fy', s.cy + 'px');
    gsap.fromTo(fl, { opacity: 1 }, { opacity: 0, duration: .6, ease: 'power2.out' });
    if (!SD.CALM) { const sh = el('shock', fx, { left: s.x + 'px', top: s.cy + 'px' });
    gsap.fromTo(sh, { scale: .2, opacity: 1 }, { scale: 3.4, opacity: 0, duration: .7, ease: 'power2.out', onComplete: () => sh.remove() }); }
    for (let i = 0; i < (SD.CALM ? 0 : 14); i++) {   // calm: the sub breaking in two (fx.js) carries the hit
      const a = Math.random() * 6.283, d = 80 + Math.random() * 150, r = 4 + Math.random() * 12;
      const bb = el(i < 5 ? 'debris' : 'pbub', fx, { left: s.x + 'px', top: s.cy + 'px', width: (i < 5 ? 14 : 2 * r) + 'px', height: (i < 5 ? 14 : 2 * r) + 'px' });
      gsap.to(bb, { x: Math.cos(a) * d, y: Math.sin(a) * d * .7 + (i < 5 ? 160 : -60), rotation: i < 5 ? 360 * Math.random() : 0, opacity: 0, duration: i < 5 ? 1.4 : 1 + Math.random(), ease: 'power2.out', onComplete: () => bb.remove() });
    }
    W.lastHit = { x: s.x, y: s.cy };
    for (let f = 0; f < 4; f++) gsap.delayedCall(f * .12, () => { b.style.backgroundPosition = `${-f * 340}px 0`; });
    gsap.fromTo(b, { scale: .6 }, { scale: 1.25, duration: .5, ease: 'power2.out' }); gsap.to(b, { opacity: 0, duration: .4, delay: .45, onComplete: () => b.remove() });
    await wait(.12);
    s.im.src = 'assets/img/sub_hit.webp'; gsap.killTweensOf(s.bob); gsap.delayedCall(.35, SFX.sink);
    gsap.to(s.d, { y: 220, rotation: 18, opacity: 0, duration: 1.4, ease: 'power1.in' });
    gsap.to(s.line, { opacity: 0, duration: .5 });
    await wait(.5);
  };
  W.wrong = async s => {
    SFX.wrong(); SFX.shield(); aim(s.x, s.cy, .25);
    const sh = s.d.querySelector('.shield');
    gsap.fromTo(sh, { opacity: 1, scale: .8 }, { opacity: 0, scale: 1.25, duration: .7 });
    await gsap.fromTo(s.d, { x: 0 }, { x: 12, duration: .06, yoyo: true, repeat: 7, ease: 'none', clearProps: 'x' });
  };

  /* ================= hints ================= */
  let hintEls = [];
  // the helper is a pulsing gold glow (no hand): it sits right on the thing to tap (#hand keeps its id for the levels + editor)
  W.hand = s => { const h = $('#hand'); if (!s) return gsap.to(h, { opacity: 0, duration: .2 }); gsap.killTweensOf(h); gsap.set(h, { left: s.x, top: s.cy, scale: 1.25 }); gsap.to(h, { opacity: 1, duration: .25 }); };
  // guided glow: appears on (or glides to) a point, then pulses as if tapped (used for demos)
  W.handTo = async (x, y, dur = .7) => { const h = $('#hand'); gsap.killTweensOf(h); const off = +getComputedStyle(h).opacity < .1; if (off) gsap.set(h, { left: x, top: y, scale: .4 }); gsap.to(h, { opacity: 1, scale: 1, duration: .3, ease: 'back.out(2)' }); if (!off) await gsap.to(h, { left: x, top: y, duration: dur, ease: 'power2.inOut' }); else await wait(Math.min(dur, .45)); };
  W.handTap = async (x, y) => { const h = $('#hand'); await gsap.to(h, { scale: 1.35, duration: .14, yoyo: true, repeat: 1, ease: 'power2.out' }); W.tapFx(x, y); SFX.tap(); };
  W.clearHints = () => {
    hintEls.forEach(a => { if (a.ring) return gsap.to(a.ring, { opacity: 0, duration: .25 }); gsap.killTweensOf(a); gsap.to(a, { opacity: 0, duration: .25, onComplete: () => a.remove() }); });
    hintEls = []; W.hand(null); W.dimOthers(null, false);
  };
  // the distance from 0 to a position: a band along the rope with the number of steps on it (stays until the hints clear)
  W.distance = (v, delay = 0) => {
    if (!v) return; const a = XR(Math.min(v, 0)), w = Math.abs(XR(v) - XR(0));
    const b = el('dist ' + (v < 0 ? 'neg' : 'pos'), sc, { left: a + 'px', width: w + 'px' }); b.innerHTML = `<span>${Math.abs(v)}</span>`;
    gsap.fromTo(b, { scaleX: 0, transformOrigin: v < 0 ? '100% 50%' : '0% 50%', opacity: 1 }, { scaleX: 1, duration: .6, delay, ease: 'power2.inOut' }); SFX.ping(); hintEls.push(b);
  };
  /* Level 2's guided replay: the numbers on the rope become the choice (the submarines are out of play meanwhile), a light
     runs from one number to another, a submarine's sonar line lights up, and the "◀ our border" tag at the left end of the line */
  W.waitLabel = vals => new Promise(res => {
    play.style.pointerEvents = 'none'; W.picking = true;
    const ls = vals.filter(v => LBL[v]);
    ls.forEach(v => { LBL[v].classList.add('pick'); LBL[v].onpointerdown = e => {
      e.stopPropagation(); ls.forEach(q => { if (!LBL[q]) return; LBL[q].classList.remove('pick'); LBL[q].onpointerdown = null; });
      play.style.pointerEvents = 'auto'; W.picking = false; SFX.tap(); W.tapFx(X(v), W.LBL_Y + CONFIG.SCALE_DY); res(v); }; });
  });
  W.sweepTo = (from, to) => {   // (stays until the hints clear)
    const lo = Math.min(from, to), hi = Math.max(from, to), a = el('sweep' + (to < from ? ' left' : ''), sc, { left: XR(lo) + 'px', width: (XR(hi) - XR(lo)) + 'px', top: '478px' });
    gsap.fromTo(a, { opacity: 0 }, { opacity: .95, duration: .4 }); SFX.ping(); hintEls.push(a);
    if (LBL[to]) gsap.fromTo(LBL[to], { scale: 1 }, { scale: 1.45, duration: .35, yoyo: true, repeat: 3, delay: .4 });
  };
  W.lineLit = (v, on) => { const s = W.subAt(v); if (s) s.line.classList.toggle('lit', on); };
  let btag = null;
  W.borderTag = on => {
    if (on && !btag) { btag = el('', fx); btag.id = 'bordertag'; btag.innerHTML = '<b>◀</b> our border'; gsap.fromTo(btag, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: .4, ease: 'back.out(2)' }); }
    if (on) gsap.fromTo(btag.querySelector('b'), { x: 0 }, { x: -10, duration: .3, yoyo: true, repeat: 5 });
    if (!on && btag) { const b = btag; btag = null; gsap.to(b, { opacity: 0, duration: .3, onComplete: () => b.remove() }); }
  };
  // the border: a glowing upright line at 0, from the rope up into the water (Level 2 talks about it)
  let defl = null;
  W.defLine = on => {
    if (on && !defl) { defl = el('', sc); defl.id = 'defline'; defl.style.left = XR(0) + 'px'; gsap.fromTo(defl, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: .6, ease: 'power2.out' }); }
    if (!on && defl) { const d = defl; defl = null; gsap.to(d, { opacity: 0, duration: .3, onComplete: () => d.remove() }); }
  };

  /* ================= badges (ordering) ================= */
  /* Level 3's order row: empty places above the cannon, one per submarine. Every submarine hit leaves its number: it pops up
     where the submarine was and flies down into the next place, so the row fills from the smallest up; when all are in,
     "<" signs pop in between them and the numbers light up left to right (−12 < −9 < −6 < −3). */
  let ORD = null;
  const ORD_Y = 655, ordX = i => CONFIG.X0 + (i - (ORD.n - 1) / 2) * 190;
  W.orderRow = n => {
    W.clearOrder(); ORD = { n, chips: [], slots: [], els: [] };
    for (let i = 0; i < n; i++) { const s = el('oslot', fx, { left: ordX(i) + 'px', top: ORD_Y + 'px' }); ORD.slots.push(s); ORD.els.push(s);
      gsap.fromTo(s, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, delay: i * .08, ease: 'back.out(2.5)' }); }
  };
  W.orderChip = async (v, at) => {
    if (!ORD) return; const i = ORD.chips.length, c = el('ochip' + side(v), fx, { left: at.x + 'px', top: at.y + 'px' }); c.textContent = fmt(v); ORD.chips.push(c); ORD.els.push(c);
    await gsap.fromTo(c, { scale: .2, opacity: 0 }, { scale: 1.5, opacity: 1, duration: .35, ease: 'back.out(3)' });
    await wait(.3);
    await gsap.to(c, { left: ordX(i), top: ORD_Y, scale: 1, duration: .6, ease: 'power2.inOut' });
    SFX.step(); ORD.slots[i].classList.add('full'); gsap.fromTo(c, { scale: 1.25 }, { scale: 1, duration: .3, ease: 'back.out(3)' });
  };
  W.orderDone = async () => {
    if (!ORD) return;
    for (let i = 0; i < ORD.n - 1; i++) { const t = el('olt', fx, { left: (ordX(i) + ordX(i + 1)) / 2 + 'px', top: ORD_Y + 'px' }); t.textContent = '<'; ORD.els.push(t);
      gsap.fromTo(t, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, delay: i * .15, ease: 'back.out(3)' }); }
    ORD.chips.forEach((c, i) => gsap.delayedCall(.4 + i * .18, () => { c.classList.add('lit'); SFX.ping(); gsap.fromTo(c, { y: 0 }, { y: -10, duration: .15, yoyo: true, repeat: 1 }); }));
    await wait(.6 + ORD.n * .18);
  };
  W.clearOrder = () => { if (!ORD) return; ORD.els.forEach(e => gsap.to(e, { opacity: 0, duration: .3, onComplete: () => e.remove() })); ORD = null; };

  /* ================= HUD ================= */
  W.strip = (html, o = {}) => { const s = $('#strip'); s.innerHTML = o.big ? `<span class="big">${html}</span>` : html; s.style.fontSize = ''; s.classList.remove('two');
    const t = s.firstElementChild && o.big ? s.firstElementChild : s; let fs = parseFloat(getComputedStyle(t).fontSize);   // a long line shrinks to fit the panel…
    while (s.scrollWidth > s.clientWidth + 1 && fs > 24) { fs -= 1; t.style.fontSize = fs + 'px'; }
    if (s.scrollWidth > s.clientWidth + 1) { s.classList.add('two'); t.style.fontSize = '24px'; }   // …and a very long one takes two lines
    s.classList.remove('glint'); void s.offsetWidth; s.classList.add('glint'); gsap.fromTo(s, { opacity: 0, y: -24, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2)' }); };
  W.stripOff = () => gsap.to('#strip', { opacity: 0, duration: .3 });
  W.pips = (n, done) => { const p = $('#pips'); p.innerHTML = ''; W.pipDone = done; for (let i = 0; i < n; i++) { const im = new Image(); im.src = 'assets/img/' + (i < done ? 'pip_on' : 'pip_off') + '.webp'; p.appendChild(im); } if (done > 0) gsap.fromTo(p.children[done - 1], { scale: 1.8 }, { scale: 1, duration: .4, ease: 'back.out(3)' }); if (p.children[done]) p.children[done].classList.add('now'); };
  W.banner = async (k, t, s, hold = 2.4) => {
    const b = $('#banner'); $('#bk').textContent = k; $('#bt').textContent = t; $('#bs').textContent = s; b.classList.remove('hidden');
    gsap.fromTo('#banner .card', { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }); SFX.ping();
    gsap.fromTo(['#bk', '#bt', '#bs'], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .12, delay: .15 });
    await wait(hold); await gsap.to('#banner .card', { scale: .9, opacity: 0, duration: .3 }); b.classList.add('hidden');
  };

  /* ================= Level 1: the missiles that come sit in a row up in the water (the enemy's positive ones, red, pointing
     right, or the defence system's negative ones, blue, pointing left). The child launches missiles of the other sign from the
     bow cannon: they collect in the launch bay above it, in rows of 5 (easy to count). FIRE: they leave the bay one by one, each
     streaks to one missile that came, and the two are absorbed into a bright core that collapses: defused. ================= */
  const MS = { list: [], marker: null, mv: 0, onTap: null, cols: 0, gap: 0, w: 0, bay: null };
  const BAY = { cols: 5, dx: 106, dy: 50, w: 96 };   // the launch bay: columns, spacing, missile size (its top row is CONFIG.SIG_Y2)
  W.marker = v => { if (!MS.marker) { MS.marker = el('', sc); MS.marker.id = 'marker'; } gsap.set(MS.marker, { left: XR(v), opacity: 1 }); gsap.fromTo(MS.marker, { y: -40 }, { y: 0, duration: .5, ease: 'bounce.out' }); MS.mv = v; };
  W.markerOff = () => { if (MS.marker) gsap.to(MS.marker, { opacity: 0, duration: .3 }); };
  W.markerPulse = () => MS.marker && gsap.fromTo(MS.marker, { scale: 1 }, { scale: 1.3, duration: .3, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  const mslX = k => CONFIG.X0 + (k - (MS.cols - 1) / 2) * MS.gap;
  const bayXY = k => ({ x: CONFIG.X0 + (k % BAY.cols - (BAY.cols - 1) / 2) * BAY.dx, y: CONFIG.SIG_Y2 + Math.floor(k / BAY.cols) * BAY.dy });
  function mkMsl(sign, row, k) {
    const at = row ? bayXY(k) : { x: mslX(k), y: CONFIG.SIG_Y1 }, x = at.x, y = at.y, w = row ? BAY.w : MS.w;
    const d = el('msl' + (sign < 0 ? ' neg' : '') + (row ? ' mine' : ''), sg, { left: x + 'px', top: y + 'px', width: w + 'px', height: (w * .33) + 'px', marginLeft: -w / 2 + 'px', marginTop: -w * .165 + 'px' });
    const im = new Image(); im.src = 'assets/img/story/' + (sign > 0 ? 'missile_red' : 'missile_blue') + '.webp'; d.appendChild(im);
    const m = { d, im, sign, row, col: k, x, y, alive: true }; d._m = m; MS.list.push(m);
    d.onpointerdown = e => { e.stopPropagation(); if (m.alive && MS.onTap) MS.onTap(m); };
    return m;
  }
  const bobMsl = (m, delay) => gsap.to(m.im, { y: 4, duration: 1.1 + (m.col % 4) * .13, yoyo: true, repeat: -1, ease: 'sine.inOut', delay });
  // the missiles that come: n of one sign fly in (red from the left, blue from the right); again = a new wave in the same round
  W.missiles = async (n, sign, again) => {
    if (again) MS.list = MS.list.filter(m => m.alive); else W.clearMissiles();
    MS.cols = n; MS.gap = Math.min(CONFIG.SIG_GAP, 1500 / n); MS.w = Math.min(150, MS.gap * .95);
    for (let k = 0; k < n; k++) {
      const m = mkMsl(sign, 0, k);
      gsap.fromTo(m.d, { x: sign > 0 ? -900 : 900, opacity: 0 }, { x: 0, opacity: 1, duration: .9, ease: 'power3.out', delay: k * .07 });
      bobMsl(m, .6);
    }
    SFX.whoosh ? SFX.whoosh() : SFX.pop(); gsap.delayedCall(.5, () => SFX.pop()); await wait(1 + n * .07);
  };
  // the launch bay: a glass tray above the cannon where launched missiles collect (rows of 5)
  W.bay = on => {
    if (on && !MS.bay) {
      const a = bayXY(0), rows = 3; MS.bay = el('', sg); MS.bay.id = 'bay';
      Object.assign(MS.bay.style, { left: a.x - BAY.w / 2 - 26 + 'px', top: a.y - 40 + 'px', width: (BAY.cols - 1) * BAY.dx + BAY.w + 52 + 'px', height: (rows - 1) * BAY.dy + 80 + 'px' });
      sg.insertBefore(MS.bay, sg.firstChild);
      gsap.fromTo(MS.bay, { opacity: 0, scale: .85 }, { opacity: 1, scale: 1, duration: .45, ease: 'back.out(2)' });
    }
    if (!on && MS.bay) { const b = MS.bay; MS.bay = null; gsap.to(b, { opacity: 0, duration: .3, onComplete: () => b.remove() }); }
  };
  // one missile from the cannon's muzzle (from) into the next free place in the bay
  W.mslLaunch = (sign, from) => {
    const m = mkMsl(sign, 1, W.mslRow(1).length);
    gsap.fromTo(m.d, { left: from.x, top: from.y, scale: .35, opacity: 0, rotation: sign > 0 ? -70 : 70 }, { left: m.x, top: m.y, scale: 1, opacity: 1, rotation: 0, duration: .4, ease: 'power2.out' });
    gsap.fromTo(m.d, { y: 0 }, { y: 5, duration: .1, yoyo: true, repeat: 1, delay: .4, ease: 'power1.out' });   // it settles into the bay
    bobMsl(m, .6); return m;
  };
  const reflow = () => W.mslRow(1).forEach((q, k) => { if (q.col === k) return; q.col = k; const p = bayXY(k); q.x = p.x; q.y = p.y; gsap.to(q.d, { left: q.x, top: q.y, duration: .3, ease: 'power2.out' }); });
  // a launched missile goes back into the cannon; the ones after it close up
  W.mslTakeBack = (m, to) => {
    m.alive = false; gsap.killTweensOf([m.d, m.im]); SFX.pop();
    gsap.to(m.d, { left: to.x, top: to.y, scale: .3, opacity: 0, duration: .35, ease: 'power2.in', onComplete: () => m.d.remove() });
    reflow();
  };
  W.mslAlive = () => MS.list.filter(m => m.alive);
  W.onMissile = fn => { MS.onTap = fn; sg.classList.toggle('live', !!fn); };
  // the pairs that can cancel (first + with first −, …) and the missiles left over after them
  W.mslPairs = () => { const p = W.mslAlive().filter(m => m.sign > 0), n = W.mslAlive().filter(m => m.sign < 0), out = []; for (let i = 0; i < Math.min(p.length, n.length); i++) out.push([p[i], n[i]]); return out; };
  W.mslRemain = () => { const p = W.mslAlive().filter(m => m.sign > 0), n = W.mslAlive().filter(m => m.sign < 0); return p.length > n.length ? p.slice(n.length) : n.slice(p.length); };
  W.mslHintsOff = () => MS.list.forEach(m => { if (!m.d.classList.contains('hint')) return; m.d.classList.remove('hint'); gsap.killTweensOf(m.d, 'scale'); gsap.set(m.d, { scale: 1 }); });
  W.mslRow = r => W.mslAlive().filter(m => m.row === r);
  W.mslPulse = (list, delay = 0, each = .04) => list.forEach((m, i) => { gsap.delayedCall(delay + i * each, () => m.d.classList.add('hint')); gsap.fromTo(m.d, { scale: 1 }, { scale: 1.25, duration: .4, yoyo: true, repeat: 5, delay: delay + i * each, ease: 'sine.inOut', onComplete: () => m.d.classList.remove('hint') }); });
  // a missile that came with no partner gets through: it dives at the window, growing as it comes at us (resolves on impact)
  W.mslHitUs = (m, to) => { m.alive = false; gsap.killTweensOf([m.d, m.im]); m.d.classList.remove('hint', 'bad');
    return new Promise(r => gsap.to(m.d, { left: to.x, top: to.y, scale: 4.2, rotation: (to.x < m.x ? -1 : 1) * 14, duration: .55, ease: 'power2.in', onComplete: () => { m.d.remove(); r(); } })); };
  // one of ours with nothing to cancel shoots on past the row and fizzles out in the water
  W.mslFizzle = m => { m.alive = false; gsap.killTweensOf([m.d, m.im]); m.d.classList.remove('hint', 'bad');
    const tx = m.x + (m.x - CONFIG.X0) * .8 + (Math.random() - .5) * 160, ty = CONFIG.SIG_Y1 - 150;
    return new Promise(r => gsap.timeline({ onComplete: () => { m.d.remove(); r(); } })
      .to(m.d, { rotation: m.sign > 0 ? -60 : 60, duration: .12 })
      .to(m.d, { left: tx, top: ty, duration: .7, ease: 'power1.in' })
      .add(() => { SFX.pop(); for (let k = 0; k < 6; k++) { const b = el('pbub', sg, { left: tx + 'px', top: ty + 'px', width: '12px', height: '12px' }); gsap.to(b, { x: (Math.random() - .5) * 80, y: -20 - Math.random() * 50, opacity: 0, duration: .7, onComplete: () => b.remove() }); } })
      .to(m.d, { scale: .2, opacity: 0, duration: .25 })); };
  W.mslBad = list => { SFX.wrong(); list.forEach(m => { m.d.classList.add('bad'); gsap.fromTo(m.d, { x: 0 }, { x: 10, duration: .06, yoyo: true, repeat: 7, ease: 'none', clearProps: 'x', onComplete: () => m.d.classList.remove('bad') }); }); };
  // FIRE: a launched missile (m) streaks from the bay to a missile that came (g); a bright core swells where they meet, both
  // spin into it and are absorbed, the core collapses and breathes out a soft ring, a small 0 is left for a moment
  W.mslDefuse = async (g, m, quick) => {
    g.alive = m.alive = false; gsap.killTweensOf([g.im, m.im, g.d, m.d]); [g, m].forEach(q => q.d.classList.remove('hint', 'bad'));
    const t = quick ? .4 : .55, ang = Math.atan2(g.y - m.y, g.x - m.x) * 180 / Math.PI;
    gsap.to(m.d, { rotation: m.sign > 0 ? ang : ang + 180, duration: .12 });   // it turns to face its target…
    const pos = { x: m.x, y: m.y }; let last = 0;
    await gsap.to(pos, { x: g.x, y: g.y, duration: t, ease: 'power2.in', onUpdate() {   // …and streaks up to it, leaving bubbles
      m.d.style.left = pos.x + 'px'; m.d.style.top = pos.y + 'px';
      if (this.progress() - last > .2) { last = this.progress(); const b = el('pbub', sg, { left: pos.x + 'px', top: pos.y + 'px', width: '10px', height: '10px' }); gsap.to(b, { y: 20 + Math.random() * 20, scale: 1.6, opacity: 0, duration: .6, onComplete: () => b.remove() }); } } });
    SFX.pop(); gsap.delayedCall(.18, () => SFX.blip());
    const core = el('dcore', sg, { left: g.x + 'px', top: g.y + 'px' });
    gsap.timeline({ onComplete: () => core.remove() }).fromTo(core, { scale: .2, opacity: 0 }, { scale: 1, opacity: 1, duration: .16, ease: 'power2.out' })
      .to(core, { scale: 0, opacity: .6, duration: .38, ease: 'power3.in' }, '+=.12').set(core, { opacity: 0 });
    const ring = el('zboom', sg, { left: g.x + 'px', top: g.y + 'px' });   // the pull inwards
    gsap.fromTo(ring, { scale: 1.6, opacity: 0 }, { scale: .1, opacity: .9, duration: .5, ease: 'power3.in', onComplete: () => ring.remove() });
    await gsap.to([g.d, m.d], { left: g.x, top: g.y, scale: 0, rotation: '+=260', opacity: 0, duration: .5, ease: 'power3.in' });
    g.d.remove(); m.d.remove();
    const puff = el('zboom', sg, { left: g.x + 'px', top: g.y + 'px' });   // a soft breath out
    gsap.fromTo(puff, { scale: .1, opacity: .7 }, { scale: 1, opacity: 0, duration: .45, ease: 'power2.out', onComplete: () => puff.remove() });
    for (let i = 0; i < (quick ? 4 : 8); i++) { const a = i / (quick ? 4 : 8) * 6.283, sp = el('pbub', sg, { left: g.x + 'px', top: g.y + 'px', width: '9px', height: '9px', background: i % 2 ? '#ffd66b' : '#8ff3ff', border: 'none' }); gsap.to(sp, { x: Math.cos(a) * 70, y: Math.sin(a) * 50, opacity: 0, scale: .4, duration: .45, ease: 'power2.out', onComplete: () => sp.remove() }); }
    const z = el('zero0', sg, { left: g.x + 'px', top: g.y + 'px' }); z.textContent = '0'; gsap.set(z, { xPercent: -50, yPercent: -50 });
    gsap.timeline({ onComplete: () => z.remove() }).fromTo(z, { scale: .2, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, ease: 'back.out(3)' })
      .to(z, { y: -30, opacity: 0, duration: .4, ease: 'power2.in' }, '+=.35');
  };
  W.clearMissiles = () => { MS.list.forEach(m => { gsap.killTweensOf([m.d, m.im]); m.d.remove(); }); MS.list = []; W.onMissile(null); W.bay(false); };

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
  W.centreOf = centreOf;
  W.sparkle = (x, y) => { SFX.sparkle(); confetti(x, y, 8, 110); };
  W.reward = (o = {}) => {
    const { x, y } = o.at || W.lastHit || { x: 960, y: 600 };
    SFX.reward(o.big);
    if (!SD.CALM || o.confetti) {   // calm: no ring or confetti unless the sheet asks for confetti (o.confetti)
      const ring = el('ringfx', top, { left: x + 'px', top: y + 'px' });
      gsap.fromTo(ring, { scale: .2, opacity: 1 }, { scale: 2.4, opacity: 0, duration: .75, ease: 'power2.out', onComplete: () => ring.remove() });
      confetti(x, y, o.big ? 26 : 14, o.big ? 300 : 200);
    }
    if (o.word && !SD.CALM) {   // the same words Riya says, so text and voice agree
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
    gsap.set(sc, { y: CONFIG.SCALE_DY });
    for (const v of VALS()) TICK[v].style.left = LBL[v].style.left = XR(v) + 'px';
    rail.style.left = '-40px'; rail.style.width = '2000px';   // the rope runs right across the sea under the window frame (it stays; its texture slides)
    back.style.left = (XR(-8.5) - 44) + 'px'; back.style.width = (17 * CONFIG.STEP + 88) + 'px';
    if (defl) defl.style.left = XR(0) + 'px';
    for (const s of SUBS) {
      if (s.free) continue;
      const dy = s.depth * CONFIG.SUB_ROW; s.cy = CONFIG.SUB_Y + dy;
      s.d.style.left = s.line.style.left = XR(s.v) + 'px'; s.d.style.top = (s.cy - SUB_H / 2) + 'px'; lineAt(s.line, s.cy);
    }
    if (MS.marker && MS.mv != null) MS.marker.style.left = XR(MS.mv) + 'px';
    applyPan();
  };
  W.applyConfig();

  window.W = W;
})();
