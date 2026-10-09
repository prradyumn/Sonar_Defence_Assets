/* world: parallax sea, ship + launcher, navigation scale, submarines, targeting & effects, HUD. */
(function () {
  const { $, wait, fmt, SFX } = SD;
  /* positions that come from code, not CSS — tunable live in the layout editor, saved in js/layout.js (LAYOUT.config) */
  const DEFAULTS = {
    X0: 960,        // stage x of 0 on the navigation scale
    STEP: 100,      // px between whole numbers (scale shows −8 … +8)
    SUB_Y: 695,     // submarine centre y (row 1)
    SUB_ROW: 100,   // extra depth for a neighbour less than 2 apart
    SIG_Y1: 298,    // L3 signal rows: top
    SIG_Y2: 366,    //                 bottom
    SIG_GAP: 160,   // px between signal columns
    PIV_X: 600,     // launcher pivot on stage
    PIV_Y: 196,
    MUZZLE: 82,     // pivot → muzzle, where the torpedo starts
  };
  const CONFIG = Object.assign({}, DEFAULTS, window.LAYOUT && LAYOUT.config);
  const X = v => CONFIG.X0 + v * CONFIG.STEP;   // scale position → stage x
  const SUB_H = 90, LINE_TOP = 584;            // .sub height · .sonarline top (game.css)
  const play = $('#play'), fx = $('#fx'), sc = $('#scale'), sg = $('#sigs');   // sg: Level 3 signals + pair buttons, above the ship
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
    if (SD.paused) return;
    const s = dt / 1000 * W.mult * SD.rate; W.t = time;
    for (const L of LAYERS) { L.x = (L.x + L.speed * s) % (2 * L.w); L.t.style.transform = `translate3d(${-L.x}px,0,0)`; }
    caus.x = (caus.x + 26 * s) % 512; cEl.style.transform = `translate3d(${-caus.x}px,${Math.sin(time * .6) * 6}px,0)`;
    w1.setAttribute('d', wavePath(time, 6, 3, 0)); w2.setAttribute('d', wavePath(time * .8, 9, 4, 1.7));
    wakeFrame(time, dt / 1000 * SD.rate);
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
    if (SD.paused) return;
    const s = dt / 1000 * SD.rate; sctx.clearRect(0, 0, 1920, 832);
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
    const tick = (t, dt) => { if (SD.paused) return; o.x -= (v + 30 * depth * W.mult) * dt / 1000 * SD.rate; g.style.transform = `translate3d(${o.x}px,${o.y + Math.sin(t * .9 + y) * 14}px,0) scale(${depth})`; if (o.x < -500) { gsap.ticker.remove(tick); g.remove(); } };
    gsap.ticker.add(tick);
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
  // ship & officer ride the swell
  gsap.to('#ship', { y: 4, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.set('#offImg,#pSpr', { xPercent: -50 });
  gsap.to('#ship', { rotation: .7, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 75%' });
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
    gsap.to('#ship', { x: 30, duration: .6, ease: 'power2.out' });
    for (let i = 0; i < 10; i++) setTimeout(() => spawnBubble(true), i * 70);
    await wait(.5 + dur * .5);
    gsap.to(W, { mult: 1, duration: dur * .6, ease: 'power2.out' });
    gsap.to('#ship', { x: 0, duration: 1, ease: 'power2.inOut' });
    await wait(dur * .5);
  };

  /* ---- ship wake (SVG, ship px). Behind the hull: the long foam trail + propeller bubbles. In front: the sea itself
          (a translucent water layer so the lower hull sits IN the water), its foam edge, the bow wave + spray, the stern churn.
          Everything follows the sailing speed W.mult: a gentle lap at rest, white water at full speed. ---- */
  const NS = 'http://www.w3.org/2000/svg', WL = 160, STERN = 22, BOW = 598, SCREW = { x: 48, y: 194 };
  const svg = (tag, a, parent) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };
  const wakeSvg = $('#wakeFx'), foamSvg = $('#hullFoam');
  wakeSvg.innerHTML = foamSvg.innerHTML = '';
  const grad = (id, stops, [x1, y1, x2, y2], parent) => { const g = svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, svg('defs', {}, parent)); stops.forEach(([o, c, a]) => svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g)); };
  grad('wkTrail', [[0, '#ffffff', .95], [.3, '#eafcff', .75], [1, '#bff3ff', 0]], [STERN, 0, -420, 0], wakeSvg);
  grad('wkSheen', [[0, '#ffffff', .55], [.35, '#c8f4ff', .28], [1, '#7fd8ff', 0]], [0, WL - 2, 0, WL + 22], foamSvg);
  grad('wkBow', [[0, '#ffffff', 0], [.55, '#ffffff', .8], [1, '#ffffff', 1]], [BOW - 190, 0, BOW + 20, 0], foamSvg);
  grad('wkBow2', [[0, '#bff3ff', 0], [1, '#e9fcff', .7]], [BOW - 230, 0, BOW + 30, 0], foamSvg);
  // soft ends: the waterline sheen fades out before the stern and past the bow (no hard edges)
  const fadeG = svg('linearGradient', { id: 'wkFadeX', gradientUnits: 'userSpaceOnUse', x1: -10, y1: 0, x2: BOW + 40, y2: 0 }, svg('defs', {}, foamSvg));
  [[0, 0], [.1, 1], [.88, 1], [1, 0]].forEach(([o, a]) => svg('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, fadeG));
  const mask = svg('mask', { id: 'wkMask', maskUnits: 'userSpaceOnUse', x: -440, y: 96, width: 1160, height: 150 }, foamSvg.querySelector('defs'));
  svg('rect', { x: -440, y: 96, width: 1160, height: 150, fill: 'url(#wkFadeX)' }, mask);
  const trail = svg('path', { fill: 'url(#wkTrail)' }, wakeSvg);
  const bubs = Array.from({ length: 26 }, () => ({ e: svg('circle', { fill: 'rgba(255,255,255,.2)', stroke: 'rgba(235,252,255,.95)', 'stroke-width': 1.2, opacity: 0 }, wakeSvg), life: Math.random() }));
  const front = svg('g', { mask: 'url(#wkMask)' }, foamSvg);
  const sheenP = svg('path', { fill: 'url(#wkSheen)' }, front);
  const wash = svg('path', { fill: '#ffffff' }, front);
  const edge = svg('path', { fill: 'none', stroke: '#ffffff', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, front);
  const bowBack = svg('path', { fill: 'url(#wkBow2)' }, foamSvg), bowWave = svg('path', { fill: 'url(#wkBow)' }, foamSvg);
  const churn = Array.from({ length: 9 }, () => ({ e: svg('ellipse', { fill: '#ffffff', opacity: 0 }, foamSvg), life: Math.random() }));
  const spray = Array.from({ length: 16 }, () => ({ e: svg('circle', { fill: '#ffffff', opacity: 0 }, foamSvg), life: 1 }));
  const surf = (x, t, K) => WL + Math.sin(x * .045 + t * 2.2) * (1.6 + 1.4 * K) + Math.sin(x * .13 - t * 3.4) * (.7 + .9 * K);
  function wakeFrame(t, s) {
    const K = .15 + .85 * Math.min(1, Math.max(0, (W.mult - 1) / 8));
    // long foam trail behind the stern (behind the hull)
    let top = '', bot = ''; const len = 90 + 330 * K;
    for (let i = 0; i <= 26; i++) {
      const u = i / 26, x = STERN + 8 - u * len, f = Math.pow(1 - u, .7), hgt = 2 + (6 + 26 * K) * f;
      const c = (Math.sin(x * .11 + t * 7) * 2.6 + Math.sin(x * .3 - t * 12) * 1.4) * K * f;
      top += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + (WL - hgt * .65 + c).toFixed(1);
      bot = ' L' + x.toFixed(1) + ' ' + (WL + hgt * .35).toFixed(1) + bot;
    }
    trail.setAttribute('d', top + bot + ' Z');
    // the water's surface in front of the hull: a lapping foam line over a soft sheen (the hull sits IN the water)
    let line = '', under = ''; for (let x = -10; x <= BOW + 40; x += 14) { const y = surf(x, t, K); line += (line ? ' L' : 'M') + x + ' ' + y.toFixed(1); under = ' L' + x + ' ' + (y + 20).toFixed(1) + under; }
    sheenP.setAttribute('d', line + under + ' Z');
    edge.setAttribute('d', line); edge.setAttribute('stroke-width', (2.6 + 4.5 * K).toFixed(2)); edge.setAttribute('opacity', (.7 + .3 * K).toFixed(2));
    // white water pushed along the hull, thickest at the bow, only when she runs
    let wt = '', wb = '';
    for (let i = 0; i <= 20; i++) {
      const u = i / 20, x = STERN + u * (BOW - STERN), th = (3 + 20 * Math.pow(u, 1.8)) * (K - .15) * 1.25, y = surf(x, t, K);
      wt += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + (y - th + Math.sin(x * .2 + t * 9) * th * .25).toFixed(1); wb = ' L' + x.toFixed(1) + ' ' + (y + 1).toFixed(1) + wb;
    }
    wash.setAttribute('d', wt + wb + ' Z'); wash.setAttribute('opacity', Math.max(0, (K - .2) * 1.1).toFixed(2));
    // bow wave: two crests climbing the stem (a pale back one, a white front one) with a curling lip
    const h = 6 + 40 * K, w = 90 + 140 * K, wob = Math.sin(t * 6.5) * 2.4 * K, yb = surf(BOW, t, K);
    const crest = (hh, ww, dx) => `M${BOW - ww} ${yb + 1} Q${BOW - ww * .45} ${yb - hh * .3} ${BOW - 8 + dx} ${yb - hh + wob} Q${BOW + 6 + dx} ${yb - hh * 1.06} ${BOW + 18 + dx} ${yb - hh * .62} Q${BOW + 10 + dx} ${yb - hh * .45} ${BOW + 22 + dx} ${yb + 1} L${BOW + 22 + dx} ${yb + 10} Q${BOW - ww * .5} ${yb + 8} ${BOW - ww} ${yb + 1} Z`;
    bowBack.setAttribute('d', crest(h * 1.25, w * 1.2, 8)); bowBack.setAttribute('opacity', (.3 + .6 * K).toFixed(2));
    bowWave.setAttribute('d', crest(h, w, 0));
    // stern churn: foam boiling up where the propeller wash breaks the surface
    for (const c of churn) {
      c.life += s * (.7 + 1.4 * K);
      if (c.life >= 1) { c.life = 0; c.x = STERN - 6 + Math.random() * 34; c.r = 7 + Math.random() * 12; }
      c.x -= (20 + 120 * K) * s; const g = Math.sin(c.life * Math.PI);
      c.e.setAttribute('cx', c.x.toFixed(1)); c.e.setAttribute('cy', (WL - 1 - g * 4 * K).toFixed(1));
      c.e.setAttribute('rx', (c.r * (.6 + K) * (.6 + c.life)).toFixed(1)); c.e.setAttribute('ry', (c.r * .45 * (.6 + K)).toFixed(1)); c.e.setAttribute('opacity', (g * (.25 + .7 * K)).toFixed(2));
    }
    // propeller bubbles stream back and rise
    for (const b of bubs) {
      b.life += s * (.5 + 1.2 * K);
      if (b.life >= 1) { b.life = 0; b.x = SCREW.x - 4 + Math.random() * 8; b.y = SCREW.y - 4 + Math.random() * 10; b.v = (40 + 190 * K) * (.6 + Math.random() * .6); b.r = 1.4 + Math.random() * 3.4; }
      b.x -= b.v * s; b.y = Math.max(WL + 6, b.y - (12 + 18 * K) * s);
      b.e.setAttribute('cx', b.x.toFixed(1)); b.e.setAttribute('cy', b.y.toFixed(1)); b.e.setAttribute('r', (b.r * (1 + .8 * b.life)).toFixed(2));
      b.e.setAttribute('opacity', (Math.sin(b.life * Math.PI) * (.35 + .6 * K)).toFixed(2));
    }
    // spray thrown off the bow at speed
    for (const p of spray) {
      if (p.life >= 1) { if (K < .4 || Math.random() > .35) { p.e.setAttribute('opacity', 0); continue; } p.life = 0; p.x = BOW + 4 + Math.random() * 10; p.y = yb - h * .9; p.vx = 20 + Math.random() * 120; p.vy = -(80 + Math.random() * 150) * K; p.r = 1.5 + Math.random() * 3; }
      p.life += s * 1.7; p.x += p.vx * s; p.vy += 560 * s; p.y += p.vy * s;
      p.e.setAttribute('cx', p.x.toFixed(1)); p.e.setAttribute('cy', p.y.toFixed(1)); p.e.setAttribute('r', p.r.toFixed(1)); p.e.setAttribute('opacity', (Math.max(0, 1 - p.life) * K).toFixed(2));
    }
  }

  /* ================= navigation scale ================= */
  const back = el('', sc); back.id = 'scaleBack'; const sheen = el('sheen', back);
  const rail = el('', sc); rail.id = 'rail'; el('arrowL', rail); el('arrowR', rail);
  const LBL = {}, TICK = {}, side = v => v === 0 ? ' zero' : v < 0 ? ' neg' : ' pos';
  for (let v = -8; v <= 8; v++) {
    TICK[v] = el('tick' + side(v), sc, { left: X(v) + 'px' });
    const l = el('lbl' + side(v), sc, { left: X(v) + 'px' }); l.textContent = fmt(v); LBL[v] = l;
  }
  const scan = el('', sc); scan.id = 'scan';
  W.X = X; W.CONFIG = CONFIG; W.CONFIG_DEFAULTS = DEFAULTS;
  W.labelsOn = vals => { for (let v = -8; v <= 8; v++) LBL[v].classList.toggle('on', vals.includes(v)); };
  // power-on: the glass bar unfolds from 0, the rail draws out, ticks and numbers ripple outwards, a light sweeps left → right
  W.scaleIntro = async () => {
    gsap.set('#scale', { opacity: 1 });
    gsap.fromTo(back, { scaleX: .04, scaleY: .3, opacity: 0, transformOrigin: '50% 50%' }, { scaleX: 1, scaleY: 1, opacity: 1, duration: .75, ease: 'expo.out' });
    gsap.fromTo('#rail', { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: .7, ease: 'power3.out', delay: .1 });
    const ts = Object.values(TICK), ls = Object.values(LBL);
    gsap.fromTo(ts, { scaleY: 0 }, { scaleY: 1, duration: .35, ease: 'back.out(3)', stagger: { each: .03, from: 'center' }, delay: .3 });
    gsap.fromTo(ls, { opacity: 0, y: 14, scale: .6 }, { opacity: i => i === 8 ? 1 : .8, y: 0, scale: 1, duration: .4, ease: 'back.out(2.5)', stagger: { each: .03, from: 'center' }, delay: .4, clearProps: 'opacity,scale' });
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
  const VAR = { sub: 'sub.webp', teal: 'sub_teal.webp', plum: 'sub_plum.webp' };
  let SUBS = [];
  W.spawn = async (vals, o = {}) => {
    const sorted = [...vals].sort((a, b) => a - b), depth = {};
    sorted.forEach((v, i) => { const p = sorted[i - 1]; depth[v] = (p != null && v - p < 2 && depth[p] === 0) ? 1 : 0; });
    const list = vals.map((v, i) => {
      const dy = depth[v] * CONFIG.SUB_ROW;
      const d = el('sub', play, { left: X(v) + 'px', top: (CONFIG.SUB_Y - SUB_H / 2 + dy) + 'px' }); d.dataset.v = v;
      const line = el('sonarline', sc, { left: X(v) + 'px', height: (CONFIG.SUB_Y - SUB_H / 2 + dy - LINE_TOP) + 'px' });
      const bob = el('bob', d); el('glow', bob); el('shield', bob); el('ring', bob);
      const im = new Image(); im.src = 'assets/img/' + VAR[o.variant || 'sub']; bob.appendChild(im); if (o.variant && o.variant !== 'sub') Object.assign(im.style, { width: '200px', left: '25px', top: '-23px' });
      gsap.to(bob, { y: 6, duration: 1.4 + i * .17, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const s = { v, d, bob, im, line, alive: true, depth: depth[v], cy: CONFIG.SUB_Y + dy }; d._s = s; return s;
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
    if (document.hidden || SD.paused) return;
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
  function aim(x, y, dur = .45) { const a = Math.atan2(y - CONFIG.PIV_Y, x - CONFIG.PIV_X) * 180 / Math.PI; return gsap.to('#barrel', { rotation: a, svgOrigin: '0 0', duration: dur, ease: 'back.out(1.6)' }); }
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
    const a = gsap.getProperty('#barrel', 'rotation') * Math.PI / 180, mx = CONFIG.PIV_X + CONFIG.MUZZLE * Math.cos(a), my = CONFIG.PIV_Y + CONFIG.MUZZLE * Math.sin(a);
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
  W.hand = s => { const h = $('#hand'); if (!s) return gsap.to(h, { opacity: 0, duration: .2 }); gsap.killTweensOf(h); gsap.set(h, { left: X(s.v) + 10, top: s.cy + 34, opacity: 1 }); gsap.fromTo(h, { y: 30 }, { y: 0, duration: .45, yoyo: true, repeat: -1, ease: 'sine.inOut' }); };
  // guided hand: glide to a point, then tap (used for demos)
  W.handTo = async (x, y, dur = .7) => { const h = $('#hand'); gsap.killTweensOf(h); if (+getComputedStyle(h).opacity < .1) gsap.set(h, { left: x + 140, top: y + 160, y: 0 }); gsap.to(h, { opacity: 1, duration: .2 }); await gsap.to(h, { left: x, top: y, y: 0, duration: dur, ease: 'power2.inOut' }); };
  W.handTap = async (x, y) => { const h = $('#hand'); await gsap.to(h, { scale: .85, duration: .12, yoyo: true, repeat: 1 }); W.tapFx(x, y); SFX.tap(); };
  W.clearHints = () => { hintEls.forEach(a => { gsap.killTweensOf(a); gsap.to(a, { opacity: 0, duration: .25, onComplete: () => a.remove() }); }); hintEls = []; W.hand(null); W.dimOthers(null, false); };

  /* ================= badges (ordering) ================= */
  let BADGES = [];
  W.badge = (v, n) => { const b = el('badge', sc, { left: X(v) + 'px' }); b._v = v; b.innerHTML = `<span>${n}</span>`; gsap.fromTo(b, { scale: 0, y: 60 }, { scale: 1, y: 0, duration: .45, ease: 'back.out(2.5)' }); BADGES.push(b); };
  W.clearBadges = () => { BADGES.forEach(b => gsap.to(b, { opacity: 0, duration: .3, onComplete: () => b.remove() })); BADGES = []; };

  /* ================= HUD ================= */
  W.strip = (html, o = {}) => { const s = $('#strip'); s.innerHTML = o.big ? `<span class="big">${html}</span>` : html; s.classList.remove('glint'); void s.offsetWidth; s.classList.add('glint'); gsap.fromTo(s, { opacity: 0, y: -24, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2)' }); };
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
        const z = el('zero0', sg, { left: (p.x - 14) + 'px', top: (mid - 24) + 'px' }); z.textContent = '0'; gsap.to(z, { y: -60, opacity: 0, duration: 1.1, delay: .2, onComplete: () => z.remove() });
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
      await gsap.to(s.d, { left: X(L3.mv), top: parseFloat(getComputedStyle(L3.marker).top) + 20, scale: .5, duration: .35, ease: 'power2.in' });
      s.alive = false; s.d.remove(); SFX.step();
      await gsap.to(L3.marker, { left: X(to), duration: .3, ease: 'power2.out' }); L3.mv = to;
      gsap.fromTo(LBL[to], { scale: 1.5 }, { scale: 1, duration: .3 });
    }
  };
  W.clearSignals = () => { L3.sigs.forEach(s => s.d.remove()); L3.sigs = []; (W._pairBoxes || []).forEach(b => b.remove()); };

  /* ================= reward: a burst of confetti, the praise word, a star that flies into the next progress pip ================= */
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
    const to = centreOf(pip), st = el('flystar', top, { left: x + 'px', top: y + 'px' }), mx = (x + to.x) / 2 + 120, my = Math.min(y, to.y) - 220, pr = { p: 0 };
    gsap.timeline({ onComplete: () => st.remove() })
      .fromTo(st, { scale: 0, rotation: -90 }, { scale: 1.3, rotation: 0, duration: .35, ease: 'back.out(3)' })
      .to(pr, { p: 1, duration: .85, ease: 'power2.in', onUpdate() {
        const p = pr.p, q = 1 - p; st.style.left = (q * q * x + 2 * q * p * mx + p * p * to.x) + 'px'; st.style.top = (q * q * y + 2 * q * p * my + p * p * to.y) + 'px';
        gsap.set(st, { scale: 1.3 - .85 * p, rotation: 360 * p });
      }, onComplete() {
        SFX.ding(); pip.src = 'assets/img/pip_on.webp';
        gsap.fromTo(pip, { scale: 2.2 }, { scale: 1, duration: .5, ease: 'back.out(3)' });
        const b = el('pipburst', top, { left: to.x + 'px', top: to.y + 'px' }); gsap.fromTo(b, { scale: .3, opacity: 1 }, { scale: 2, opacity: 0, duration: .5, onComplete: () => b.remove() });
      } }, '-=.05');
  };

  /* re-place everything that was positioned from CONFIG (the editor calls this after a constant changes) */
  W.applyConfig = () => {
    for (let v = -8; v <= 8; v++) TICK[v].style.left = LBL[v].style.left = X(v) + 'px';
    rail.style.left = X(-8.5) + 'px'; rail.style.width = 17 * CONFIG.STEP + 'px';
    back.style.left = (X(-8.5) - 44) + 'px'; back.style.width = (17 * CONFIG.STEP + 88) + 'px';
    for (const s of SUBS) {
      const dy = s.depth * CONFIG.SUB_ROW; s.cy = CONFIG.SUB_Y + dy;
      s.d.style.left = s.line.style.left = X(s.v) + 'px'; s.d.style.top = (s.cy - SUB_H / 2) + 'px'; s.line.style.height = (s.cy - SUB_H / 2 - LINE_TOP) + 'px';
    }
    BADGES.forEach(b => { b.style.left = X(b._v) + 'px'; });
    for (const s of L3.sigs) if (s.alive) { s.x = sigX(s.col, L3.cols); s.y = s.row === 0 ? CONFIG.SIG_Y1 : CONFIG.SIG_Y2; gsap.set(s.d, { left: s.x, top: s.y }); }
    (W._pairBoxes || []).forEach(b => { b.style.left = b._p.x + 'px'; b.style.top = (CONFIG.SIG_Y1 - 36) + 'px'; });
    if (L3.marker && L3.mv != null) L3.marker.style.left = X(L3.mv) + 'px';
  };
  W.applyConfig();

  window.W = W;
})();
