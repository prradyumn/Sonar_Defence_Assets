/* levels: hook (story) → L1 positive + negative missiles → L2 closer to the defence line → L3 fire in order (sheets L1–L3 V3) → story ending.
   Every spoken line comes from js/script.js (SCRIPT.S / SCRIPT.D) so recorded voices match by id. */
(function () {
  const { $, Q, wait, fmt, SFX, say } = SD;
  const { S, D } = SCRIPT;
  const f = fmt;
  const SCORE = {};                      // level → [true/false first-try per mission]
  let LV = 'l1';
  const mark = ok => (SCORE[LV] = SCORE[LV] || []).push(ok);

  /* ---------- the sheets' hint animations ("Incorrect Animation" / "Inactivity Animation" columns) for Levels 2 and 3 ---------- */
  const sub = v => W.subAt(v);
  const ANIM = {
    zeroBoth: R => { W.pulseZero(); R.subs.forEach((v, i) => W.pulseSub(sub(v), .15 + i * .1)); },      // 0 and both submarines pulse
    both: R => R.subs.forEach((v, i) => W.pulseSub(sub(v), i * .1)),                                    // both submarines pulse
    labelsSeq: R => R.subs.forEach((v, i) => W.pulseLbl(v, i * 1.1)),                                   // the two numbers pulse one after another
    labels: R => R.subs.forEach(v => W.pulseLbl(v)),                                                    // both numbers glow
    dist: R => R.subs.forEach((v, i) => W.distance(v, i * .5)),                                         // the distance from 0 to each position appears
    targetRing: R => { W.pulseSub(sub(R.target)); W.pulseLbl(R.target); W.ring(sub(R.target)); },       // it pulses and the target ring appears
    target: R => { W.pulseSub(sub(R.target)); W.pulseLbl(R.target); },                                  // the answer pulses
    zeroTarget: R => { W.pulseZero(); W.pulseSub(sub(R.target), .15); W.pulseLbl(R.target, .15); },     // 0 and the answer pulse
  };

  /* ---------- fire at one submarine with the 3-strike rule ----------
     A wrong tap gets Incorrect Feedback 1, 2, 3 (with their animations); after the third only the right submarine answers.
     Idle: 6 s → the inactivity animation · 12 s → the inactivity line too · 22 s → both again. */
  async function strike(R, target, o = {}) {
    let wrong = 0; W.expect = target;
    const idleAnim = o.idleAnim || (() => ANIM[R.idleL.kind](R)), idleLine = o.idleLine || R.idleL.line;
    for (;;) {
      const s = await W.waitTap({ onNudge: idleAnim, onIdle: () => { idleAnim(); say(idleLine); }, onIdle2: () => { idleAnim(); say(idleLine); }, only: wrong >= 3 ? W.subAt(target) : null });
      SD.skip();
      if (s.v === target) { W.clearHints(); const r = await W.lock(s); SFX.right(); await W.fire(s, r); return wrong === 0; }
      wrong++;
      const red = await W.lock(s, 'red'); await W.wrong(s); red.remove(); W.clearHints();
      const fb = o.fb ? o.fb(wrong) : R.fbL[Math.min(wrong, 3) - 1];
      if (fb.anim) fb.anim(); else ANIM[fb.kind](R);
      await say(fb.line);
    }
  }

  /* =====================================================================
     STORY — the storyboard told in ONE continuous underwater scene: the camera never cuts. The water is a WebGL
     canvas (js/water.js: refraction, caustics, god rays, depth blur); the Coast Guard ship is a silhouette at the
     surface; Meera and Riya speak from glass comms panels; the navigation scale floats in the water and the enemy
     subs swim onto their numbers. Part 1 = rows 1–6, part 2 = rows 7–11, then FIRE → the game (also underwater).
     The ending (row 12) returns to the same scene. ?at=hook&scene=2 starts at part 2, scene=3 at How to play.
     ===================================================================== */
  const IMG = n => 'assets/img/story/' + n + '.webp';
  const bezier = (x1, y1, x2, y2) => t => {          // CSS cubic-bezier as a GSAP ease (Newton on x, then y)
    let u = t;
    for (let i = 0; i < 8; i++) { const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t, dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2); if (Math.abs(x) < 1e-6 || !dx) break; u = Math.min(1, Math.max(0, u - x / dx)); }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const DOOR_EASE = bezier(.45, 0, .2, 1);           // door_opening.svg: 0.5 s, then 1.8 s at cubic-bezier(.45,0,.2,1)
  let WATER = null;
  function storyKit() {
    const st = $('#story'), bg = $('#storyBg'), cast = $('#cast'), sfx = $('#storyFx');
    st.classList.remove('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    const K = { st, bg, cast, sfx, skipping: false, SKIP: {} };
    K.chk = () => { if (K.skipping) throw K.SKIP; };
    $('#skipStory').onclick = e => { e.stopPropagation(); K.skipping = true; SD.skip(); };
    st.onpointerdown = e => { if (e.target.id !== 'skipStory') SD.skip(); };   // tap = next line
    const mk = (tag, cls, css, parent = sfx) => { const d = document.createElement(tag); if (cls) d.className = cls; Object.assign(d.style, css || {}); parent.appendChild(d); return d; };
    K.mk = mk;
    K.img = (n, cls, css, parent) => { const i = mk('img', cls, css, parent); i.src = IMG(n); i.alt = ''; return i; };
    K.px = el => { const r = el.getBoundingClientRect(), s = $('#stage').getBoundingClientRect(), k = s.width / 1920; return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k, w: r.width / k, h: r.height / k }; };
    // the one scene: realistic water (WebGL) with the plain image as the fallback; a slow camera drift
    K.open = async () => {
      bg.style.backgroundImage = `url(${IMG('bg_under')})`;
      let cv = $('#waterCv');
      if (!cv) { cv = document.createElement('canvas'); cv.id = 'waterCv'; cv.width = SD.LOW ? 960 : 1920; cv.height = SD.LOW ? 540 : 1080; st.insertBefore(cv, sfx); }   // half resolution on phones
      if (WATER === null) { WATER = Water(cv) || false; if (WATER && !(await WATER.load(IMG('bg_under')))) WATER = false; }
      cv.style.display = WATER ? 'block' : 'none'; if (WATER) { Object.assign(WATER.state, { glow: 0, r: 1, g: 1, b: 1 }); WATER.start(); }
      K.cam = gsap.fromTo([cv, bg], { scale: 1.08 }, { scale: 1.02, duration: 30, ease: 'none' });
      gsap.set(st, { opacity: 1 }); gsap.fromTo([cv, bg], { opacity: 0 }, { opacity: 1, duration: .6 });   // the overlay is solid from the first frame; only the water fades in
      for (let i = 0; i < 9; i++) { const r = 4 + Math.random() * 9, b = mk('div', 'sx-bub', { left: 120 + Math.random() * 1680 + 'px', top: '1100px', width: 2 * r + 'px', height: 2 * r + 'px' });
        gsap.to(b, { y: -1250, x: (Math.random() - .5) * 120, duration: 7 + Math.random() * 6, delay: Math.random() * 5, repeat: -1, ease: 'none' }); }
    };
    // the opening: the sonar-room doors — two lamp blinks, the latch kicks, air hisses, then both halves slide apart onto the sea
    K.doors = async () => {
      const d = document.createElement('div'); d.id = 'doors';
      d.innerHTML = '<div class="spill"></div><div class="door l"><img src="assets/img/door_left.webp" alt=""><i class="lamp"></i></div><div class="door r"><img src="assets/img/door_right.webp" alt=""><i class="lamp"></i></div><div class="seam"></div>';
      st.insertBefore(d, $('#skipStory'));
      const L = d.querySelector('.door.l'), R = d.querySelector('.door.r'), lamps = d.querySelectorAll('.lamp'), seam = d.querySelector('.seam'), spill = d.querySelector('.spill');
      try {
        await wait(.5); K.chk();
        for (let i = 0; i < 2; i++) { SFX.doorBeep(); gsap.fromTo(lamps, { opacity: .15 }, { opacity: 1, duration: .08, yoyo: true, repeat: 1 }); await wait(.22); }
        K.chk(); SFX.clunk(); gsap.to(lamps, { opacity: .85, duration: .2 });
        gsap.fromTo([L, R], { x: 0 }, { x: i => i ? 7 : -7, duration: .07, yoyo: true, repeat: 1, ease: 'power1.out' });   // the latch kicks
        SFX.hiss(); gsap.fromTo(seam, { opacity: 0 }, { opacity: 1, duration: .25 });
        for (let i = 0; i < 7; i++) {   // air escaping at the seam
          const p = document.createElement('div'); p.className = 'steam'; Object.assign(p.style, { left: '960px', top: (240 + i * 110) + 'px' }); d.appendChild(p);
          gsap.fromTo(p, { scale: .2, opacity: .9, x: 0 }, { scale: 1.6 + Math.random(), opacity: 0, x: (i % 2 ? 1 : -1) * (40 + Math.random() * 60), y: -30 - Math.random() * 40, duration: 1.1, ease: 'power2.out', onComplete: () => p.remove() });
        }
        await wait(.35); K.chk();
        SFX.doorSlide(1.8);
        gsap.to(L, { x: -960, duration: 1.8, ease: DOOR_EASE }); gsap.to(R, { x: 960, duration: 1.8, ease: DOOR_EASE });
        gsap.fromTo(spill, { opacity: 1, scaleX: .05 }, { opacity: 0, scaleX: 1.6, duration: 1.8, ease: DOOR_EASE });
        gsap.to(seam, { opacity: 0, duration: .3 });
        await wait(1.5); gsap.delayedCall(.25, () => { SFX.clunk(); d.remove(); });
      } catch (e) { d.remove(); throw e; }
    };
    K.close = () => { if (WATER) WATER.stop(); const cv = $('#waterCv'); if (cv) cv.style.display = 'none'; };
    K.tint = (r, g, b, d = .6) => WATER && gsap.to(WATER.state, { r, g, b, duration: d });
    K.trail = (m, every = .08, n = 14) => { for (let i = 0; i < n; i++) gsap.delayedCall(i * every, () => { if (!m.isConnected) return; const p = K.px(m);
      const b = mk('div', 'sx-bub small', { left: p.x - p.w * .3 + 'px', top: p.y + 'px' }); gsap.to(b, { y: -30 - Math.random() * 30, scale: 1.8, opacity: 0, duration: .9, onComplete: () => b.remove() }); }); };
    // Meera and Riya speak from glass comms panels (a video call from the sub); whoever speaks is lit
    const people = {};
    K.who = (who, look) => {
      let p = people[who];
      if (!p) {
        p = people[who] = { el: mk('div', 'sx-comm ' + who, {}, cast) };
        p.el.innerHTML = '<i class="scan"></i><b class="live">● LIVE</b>'; p.im = mk('img', '', {}, p.el); p.im.alt = '';
        gsap.set(p.el, { x: who === 'riya' ? 420 : -420, opacity: 0 });
      }
      const src = IMG(who + '_' + look);
      if (!p.im.src.endsWith(src)) { if (p.on) gsap.fromTo(p.im, { opacity: .3 }, { opacity: 1, duration: .25 }); p.im.src = src; }
      if (!p.on) { p.on = true; gsap.to(p.el, { x: 0, opacity: 1, duration: .6, ease: 'back.out(1.3)' }); SFX.blip(); }
      for (const k in people) people[k].el.classList.toggle('dim', k !== who);
      return p;
    };
    K.leave = (who) => { const p = people[who]; if (!p || !p.on) return; p.on = false; gsap.to(p.el, { x: who === 'riya' ? 420 : -420, opacity: 0, duration: .4, ease: 'power2.in' }); };
    K.leaveAll = () => Object.keys(people).forEach(K.leave);
    K.say = async (L, extra) => {
      K.chk();
      const who = L.who, side = who === 'riya' ? 'r' : 'l';
      const b = mk('div', `bubble ${who} sx-b ${side}`, {}, cast);
      b.innerHTML = `<span class="nm">${SCRIPT.WHO[who].name}</span><span class="txt"></span>`;
      if (who === 'narrator' || who === 'system') { for (const k in people) people[k].el.classList.add('dim'); }
      gsap.fromTo(b, { opacity: 0, y: 18, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .35, ease: 'back.out(2)' });
      const tn = gsap.fromTo('#tapNext', { opacity: 0 }, { opacity: .85, duration: .4, delay: 1.8 });
      if (extra) extra();
      await say(L, { bubble: b });
      tn.kill(); gsap.set('#tapNext', { opacity: 0 });
      await gsap.to(b, { opacity: 0, y: -8, duration: .2 }); b.remove();
    };
    K.stamp = (text, cls = '', hold = 1.5) => {
      const o = mk('div', 'sx-stamp ' + cls); SFX.ping();
      o.innerHTML = [...text].map(c => c === ' ' ? '<span>&nbsp;</span>' : `<span>${c}</span>`).join('') + '<i class="sheen"></i>';
      const L = o.querySelectorAll('span'), tl = gsap.timeline();
      tl.fromTo(L, { y: 46, scale: .4, opacity: 0, rotation: () => (Math.random() - .5) * 24 }, { y: 0, scale: 1, opacity: 1, rotation: 0, duration: .42, stagger: .035, ease: 'back.out(2.6)' })
        .fromTo(o.querySelector('.sheen'), { xPercent: -120, opacity: 1 }, { xPercent: 360, duration: .7, ease: 'power2.inOut' }, '-=.1').set(o.querySelector('.sheen'), { opacity: 0 });
      if (hold) tl.to(L, { y: -24, opacity: 0, duration: .3, stagger: .015, ease: 'power2.in', onComplete: () => o.remove() }, '+=' + hold);
      o.tl = tl; return o;
    };
    // the navigation scale floating in the water (glass): −8 … +8, 0 glowing
    K.scale = () => {
      const s = mk('div', 'sx-nav');
      let h = '<div class="bar"></div>';
      for (let v = -8; v <= 8; v++) h += `<i class="${v ? '' : 'z'}" style="left:${(v + 8) * 80 + 60}px"></i><b class="${v < 0 ? 'n' : v > 0 ? 'p' : 'z'}" style="left:${(v + 8) * 80 + 60}px">${f(v)}</b>`;
      s.innerHTML = h + '<i class="sheen"></i>';
      gsap.fromTo(s, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' });
      gsap.fromTo(s.querySelector('.bar'), { scaleX: 0 }, { scaleX: 1, duration: .6, delay: .1, ease: 'power2.out' });
      gsap.fromTo(s.querySelectorAll('i:not(.sheen),b'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .25, stagger: { each: .02, from: 'center' }, delay: .3 });
      gsap.fromTo(s.querySelector('.sheen'), { xPercent: -120, opacity: 1 }, { xPercent: 560, duration: 1.1, delay: .3, ease: 'power2.inOut', onComplete() { this.targets()[0].style.opacity = 0; } });
      s.x = v => 300 + (v + 8) * 80 + 60;            // stage x (the scale's left is 300 px)
      s.zero = () => gsap.fromTo(s.querySelectorAll('.z'), { scale: 1 }, { scale: 1.5, duration: .3, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      s.toZero = (v, cls) => { const a = mk('div', 'sx-dist ' + cls, { left: Math.min(s.x(0), s.x(v)) - 300 + 'px', width: Math.abs(s.x(v) - s.x(0)) + 'px' }, s); a.innerHTML = `<span>${Math.abs(v)}</span>`;
        gsap.fromTo(a, { scaleX: 0, transformOrigin: v < 0 ? '0% 50%' : '100% 50%' }, { scaleX: 1, duration: .6, ease: 'power2.out' }); return a; };
      return s;
    };
    return K;
  }

  async function hook() {
    SD.music('calm'); SD.ambience('waves');
    const K = storyKit(), { sfx, cast } = K, SCENE = Q.get('at') === 'hook' ? +(Q.get('scene') || 1) : 1;
    await K.open();
    if (SCENE < 2) await K.doors().catch(e => { if (e !== K.SKIP) throw e; });   // the story opens through the sonar-room doors
    // the Coast Guard ship above us: a dark silhouette at the surface
    const ship = K.img('ship', 'sx-hull', {}); gsap.fromTo(ship, { x: -400 }, { x: 0, duration: 4, ease: 'power2.out' }); gsap.to(ship, { y: 5, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const subs = [];
    const sub = (x, y, i, bay = true) => { const u = K.img(bay ? 'sub_bay' : '../sub', 'sx-sub', { left: x + 'px', top: y + 'px' });
      gsap.fromTo(u, { x: 1000, opacity: 0 }, { x: 0, opacity: 1, duration: 2.4, delay: .3 + i * .4, ease: 'power3.out',
        onComplete: () => { const p = K.px(u), r = K.mk('div', 'sx-ring', { left: p.x + 'px', top: p.y + 'px' }); gsap.fromTo(r, { scale: .2, opacity: .9 }, { scale: 2, opacity: 0, duration: 1, onComplete: () => r.remove() }); SFX.blip(); } });
      u.bob = gsap.to(u, { y: '+=8', duration: 1.6 + i * .2, yoyo: true, repeat: -1, ease: 'sine.inOut' }); subs.push(u); return u; };
    try {
      if (SCENE < 2) {
        /* 1 · enemy submarines slip in and take positions */
        sub(1180, 520, 0); sub(1520, 640, 1); sub(780, 440, 2);
        await K.say(S.n1);

        /* 2 · they fire missiles up at the ship: the water flushes red, ALERT */
        subs.forEach((u, i) => gsap.delayedCall(i * .35, () => { const p = K.px(u), m = K.img('missile_red', 'sx-mis', { left: p.x - 40 + 'px', top: p.y - 70 + 'px' }); SFX.launch(); K.trail(m);
          gsap.to(m, { x: -260 - i * 140, y: -620, rotation: -62, duration: 1.6, ease: 'power1.in', onComplete: () => m.remove() }); }));
        await wait(1.4); K.chk();
        K.tint(1.5, .55, .5); SFX.alarm();
        const al = K.stamp('ALERT! ALERT!', 'red', 0); gsap.to(al, { opacity: .45, duration: .4, yoyo: true, repeat: -1, delay: .9 });
        await K.say(S.a2, () => gsap.delayedCall(1.3, SFX.alarm));
        gsap.killTweensOf(al); gsap.to(al, { opacity: 0, duration: .3, onComplete: () => al.remove() });

        /* 3 · Meera calls in: missiles heading towards us (a radar on her panel) */
        const radar = K.mk('div', 'sx-radar'); radar.innerHTML = '<i class="sw"></i>'; gsap.to(radar.firstChild, { rotation: 360, duration: 2.4, repeat: -1, ease: 'none' });
        gsap.fromTo(radar, { scale: 0 }, { scale: 1, duration: .45, ease: 'back.out(2)' });
        [[60, 150], [110, 70], [190, 120]].forEach(([x, y], i) => { const d = K.mk('div', 'rmis', { left: x + 'px', top: y + 'px' }, radar); gsap.to(d, { left: 120, top: 120, duration: 5, delay: i * .2, ease: 'none' }); });
        K.who('meera', 'shocked');
        await K.say(S.m3);

        /* 4 · contact the defence station */
        K.who('meera', 'determined');
        const com = K.mk('div', 'sx-comms'); com.innerHTML = '<i></i><i></i><i></i><span>DEFENCE STATION</span>';
        gsap.fromTo(com, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'back.out(2)' });
        gsap.to(com.querySelectorAll('i'), { opacity: .2, duration: .3, stagger: .15, yoyo: true, repeat: -1 });
        K.stamp('CONTACT DEFENCE STATION');
        await K.say(S.m4, () => gsap.delayedCall(.6, SFX.doorBeep));
        K.tint(1, 1, 1, 1.2); gsap.to([com, radar], { opacity: 0, scale: .9, duration: .35 });

        /* 5 · the defence launcher rises from the seabed and turns into position */
        K.leaveAll();
        const ln = K.mk('div', 'sx-launcher'); K.img('launcher_base', 'base', {}, ln); const barrel = K.img('launcher_barrel', 'barrel', {}, ln);
        gsap.fromTo(ln, { y: 420 }, { y: 0, duration: .9, ease: 'back.out(1.3)' }); SFX.doorSlide(1);
        gsap.fromTo(barrel, { rotation: 0 }, { rotation: -38, duration: 1.2, delay: .8, ease: 'power2.inOut', onStart: () => SFX.clunk() });
        const reds = [[1220, 200], [1480, 130], [1700, 260]].map(([x, y]) => { const m = K.img('missile_red', 'sx-mis', { left: x + 'px', top: y + 'px' }); gsap.set(m, { rotation: 155 }); gsap.to(m, { x: -110, y: 50, duration: 7, ease: 'none' }); return m; });
        K.stamp('DEFENCE SYSTEM READY');
        await K.say(S.d5);

        /* 6 · sonar scans the missiles, target rings lock on, 0 glows → counterattack */
        for (let i = 0; i < 3; i++) { const w = K.mk('div', 'sx-wave'); gsap.fromTo(w, { scale: .2, opacity: .9 }, { scale: 3.2, opacity: 0, duration: 1.6, delay: i * .4, onComplete: () => w.remove() }); }
        SFX.ping();
        reds.forEach((m, i) => gsap.delayedCall(.6 + i * .35, () => { const p = K.px(m), r = K.img('../reticle', 'sx-lock', { left: p.x + 'px', top: p.y + 'px' });
          gsap.fromTo(r, { scale: 2, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .35, ease: 'back.out(2)' }); SFX.lock(); gsap.to(r, { x: -100, y: 46, duration: 5.5, ease: 'none' }); m._lock = r; }));
        const zero = K.mk('div', 'sx-zero'); zero.textContent = '0'; gsap.fromTo(zero, { scale: 0 }, { scale: 1, duration: .4, delay: 1.6, ease: 'back.out(3)' }); gsap.to(zero, { scale: 1.15, duration: .5, yoyo: true, repeat: -1, delay: 2, ease: 'sine.inOut' });
        K.who('meera', 'determined');
        K.stamp('TARGETS CONFIRMED!');
        await K.say(S.m6);
        reds.forEach((m, i) => gsap.delayedCall(i * .25, () => {
          const b = K.img('missile_blue', 'sx-mis', { left: '1080px', top: '600px' }); SFX.launch(); gsap.set(b, { rotation: -38 }); K.trail(b, .05, 12);
          const p = K.px(m);
          gsap.to(b, { left: p.x - 70, top: p.y - 30, duration: .7, ease: 'power1.in', onComplete: () => { b.remove(); m.remove(); if (m._lock) m._lock.remove(); SFX.boom(); W.shake && W.shake(3, .25);
            const r = K.mk('div', 'sx-ring hit', { left: p.x + 'px', top: p.y + 'px' }); gsap.fromTo(r, { scale: .3, opacity: 1 }, { scale: 2.6, opacity: 0, duration: .6, onComplete: () => r.remove() });
            for (let j = 0; j < 8; j++) { const q = K.mk('div', 'sx-bub small', { left: p.x + 'px', top: p.y + 'px' }); gsap.to(q, { x: (Math.random() - .5) * 160, y: (Math.random() - .5) * 120 - 40, scale: 2, opacity: 0, duration: .9, onComplete: () => q.remove() }); } } });
        }));
        await wait(1.6); K.chk();
        K.leaveAll(); gsap.to([zero, ln], { opacity: 0, y: 60, duration: .5 });
        subs.forEach(u => { u.bob.kill(); gsap.to(u, { x: 1100, opacity: 0, duration: 1.2, ease: 'power2.in', onComplete: () => u.remove() }); }); subs.length = 0;
        await wait(1.2); K.chk();
      }

      if (SCENE < 3) {
        /* 7 · the navigation scale floats into the water; subs swim onto their positions */
        const nav = K.scale();
        const at = { };
        [-6, -2, 2, 5].forEach((v, i) => { at[v] = sub(nav.x(v) - 105, 380, i, false); });
        K.who('meera', 'determined');
        await K.say(S.s4);

        /* 8 · −6 blinks, its distance to 0 lights up */
        gsap.to(at[-6], { scale: 1.12, duration: .3, yoyo: true, repeat: 5 }); nav.toZero(-6, 'n'); nav.zero();
        K.who('meera', 'pointing');
        await K.say(S.m8);

        /* 9 · +5 blinks: its distance (5) is shorter, so it is closer */
        gsap.to(at[5], { scale: 1.12, duration: .3, yoyo: true, repeat: 5 }); nav.toZero(5, 'p');
        K.who('riya', 'alert');
        await K.say(S.r9);

        /* 10 · mission begins: the FIRE button lights up */
        K.leave('riya');
        const fire = K.mk('div', 'sx-fire'); K.img('fire_off', '', {}, fire); const lit = K.img('fire_lit', 'lit', {}, fire);
        gsap.fromTo(fire, { scale: 0 }, { scale: 1, duration: .5, ease: 'back.out(2.4)' });
        gsap.fromTo(lit, { opacity: 0 }, { opacity: 1, duration: .45, yoyo: true, repeat: -1, delay: .6, ease: 'sine.inOut' });
        K.who('meera', 'pointing');
        await K.say(S.s10);

        /* 11 · "Ready? Launch the missiles." → the child presses FIRE → MISSION 1 */
        K.who('meera', 'determined');
        await K.say(S.s11);
        await pressFire(K, fire, lit);
        K.leaveAll(); gsap.to(fire, { scale: 0, duration: .3, delay: .25 }); gsap.to(nav, { opacity: 0, y: 40, duration: .5 });
        subs.forEach(u => gsap.to(u, { opacity: 0, duration: .5 }));
        const m1 = K.stamp('MISSION 1', 'big', 0); SFX.reward && SFX.reward(true); await wait(1.3); K.chk();
        gsap.to(m1, { scale: 3, opacity: 0, duration: .6, ease: 'power2.in' });
      }
    } catch (e) { if (e !== K.SKIP) throw e; }

    /* into the game: the same water — the cockpit frame closes in around the view */
    SD.hush(); K.st.onpointerdown = null; gsap.set('#tapNext', { opacity: 0 });
    SFX.swoosh(); SD.music('play'); SD.ambience('waves');
    gsap.to(cast, { opacity: 0, duration: .3 });
    await gsap.to(K.st, { opacity: 0, scale: 1.15, duration: .8, ease: 'power2.in' });
    K.close(); K.st.classList.add('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([K.st, K.bg, cast, sfx], { clearProps: 'all' });
    await W.sail(1.4);
    await howTo();
  }

  // wait for the child to press the glowing FIRE button (taps elsewhere do nothing here; Skip story still skips)
  function pressFire(K, fire, lit) {
    return new Promise(res => {
      if (K.skipping) return res();
      fire.classList.add('ready'); gsap.killTweensOf(lit); gsap.set(lit, { opacity: 1 });
      const pulse = gsap.to(fire, { scale: 1.08, duration: .55, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const rings = setInterval(() => { const r = K.mk('div', 'sx-ring', { left: '0', top: '0' }, fire); gsap.fromTo(r, { scale: .8, opacity: .9, left: 100, top: 100 }, { scale: 2.2, opacity: 0, duration: 1.1, onComplete: () => r.remove() }); }, 700);
      const hint = gsap.delayedCall(6, () => { const t = K.mk('div', 'sx-press', {}, fire); t.textContent = 'TAP FIRE!'; gsap.fromTo(t, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .3 }); });   // 6 s: a nudge
      const prevTap = K.st.onpointerdown; K.st.onpointerdown = null;
      const done = () => { clearInterval(rings); pulse.kill(); hint.kill(); fire.onpointerdown = null; K.st.onpointerdown = prevTap; res(); };
      fire.onpointerdown = e => {
        e.stopPropagation(); SFX.tap(); SFX.launch(); W.shake && W.shake(4, .3);
        gsap.fromTo(fire, { scale: .86 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
        for (let i = 0; i < 3; i++) { const r = K.mk('div', 'sx-ring hit', { left: '100px', top: '100px' }, fire); gsap.fromTo(r, { scale: .5, opacity: 1 }, { scale: 3 + i, opacity: 0, duration: .7, delay: i * .08, onComplete: () => r.remove() }); }
        done();
      };
      const sk = $('#skipStory'), skip0 = sk.onclick; sk.onclick = e => { done(); skip0(e); };
    });
  }

  /* ---- row 12 · the ending: the same water, calm and bright, the route cleared ---- */
  async function storyEnd() {
    const K = storyKit();
    $('#skipStory').style.display = 'none';
    try {
      await K.open(); if (WATER) gsap.to(WATER.state, { glow: .6, duration: 2 });   // the light comes back
      const ship = K.img('ship', 'sx-hull', {}); gsap.fromTo(ship, { x: -500 }, { x: 260, duration: 6, ease: 'none' });
      for (let i = 0; i < 3; i++) { const fish = K.mk('div', 'sx-fish', { top: 360 + i * 120 + 'px' }); fish.innerHTML = '<i></i><i></i><i></i><i></i>'; gsap.fromTo(fish, { x: 2100 }, { x: -400, duration: 9 + i * 2, delay: i * .8, ease: 'none' }); }
      K.stamp('ROUTE CLEARED!', 'end', 0); SFX.tada();
      const COL = ['#ffd66b', '#7ff2ff', '#ff8fb1', '#9dff9a', '#ffffff', '#ffb070'];
      for (let i = 0; i < 40; i++) { const c = K.mk('div', 'sx-conf', { left: 200 + Math.random() * 1520 + 'px', top: '-30px', background: COL[i % COL.length] });
        gsap.to(c, { y: 700 + Math.random() * 400, x: (Math.random() - .5) * 240, rotation: (Math.random() - .5) * 900, opacity: 0, duration: 2.4 + Math.random() * 1.6, delay: .4 + Math.random() * .8, ease: 'power1.in', onComplete: () => c.remove() }); }
      K.who('riya', 'cheering'); K.who('meera', 'proud');
      await K.say(S.finEnd);
      await wait(.8);
    } catch (e) { if (e !== K.SKIP) throw e; }
    await gsap.to(K.st, { opacity: 0, duration: .4 });
    K.close(); K.st.classList.add('hidden'); K.cast.innerHTML = K.sfx.innerHTML = ''; gsap.set([K.st, K.bg, K.cast, K.sfx], { clearProps: 'all' }); $('#skipStory').style.display = '';
  }



  /* ---------- how to play (story sheet): a live demo round, played for the child ----------
     Two real submarines come up; the helper glow shows the mission, the number, then the submarine;
     the cannon slides over and fires, the torpedo hits. A step chip names each step as Meera says it. */
  async function howTo() {
    const chip = document.createElement('div'); chip.id = 'howchip'; $('#stage').appendChild(chip); gsap.set(chip, { xPercent: -50 });
    const step = (n, t) => { chip.innerHTML = `<span class="k">HOW TO PLAY</span><b>${n}</b><span class="t">${t}</span>`; gsap.fromTo(chip, { y: -16, opacity: 0, scale: .9 }, { y: 0, opacity: 1, scale: 1, duration: .35, ease: 'back.out(2.4)' }); SFX.pop(); };
    const T = 3;
    // 1 · read the mission + check the scale
    step(1, 'READ THE MISSION');
    const intro = W.scaleIntro();
    await W.spawn([-4, T], { stagger: .25 });
    W.strip(`Fire at the submarine at <b>${f(T)}</b>.`);
    const p1 = say(S.hp1);
    await intro; await W.handTo(960, 72, .3); await W.handTap(960, 72);   // the glow pulses on the mission text…
    await W.handTo(W.X(0), W.LBL_Y + W.CONFIG.SCALE_DY, .7);                 // …then on 0 in the middle of the scale
    await p1;
    // 2 · find the submarine at the correct position: the glow runs along the scale to +3, then up its sonar line
    step(2, 'FIND THE TARGET');
    const sub = W.subAt(T), lx = W.X(T), ly = W.LBL_Y + W.CONFIG.SCALE_DY;   // the +3 label
    const p2 = say(S.hp2);
    await W.handTo(lx, ly, 1); W.labelsOn([T]); await W.handTap(lx, ly);
    await W.handTo(lx, sub.cy, .8); W.glow(sub, true, 'rgba(255,214,107,.6)');
    await p2;
    // 3 · aim: tap it, the target locks and the cannon slides under it
    step(3, 'AIM & FIRE!');
    const p3 = say(S.hp3);
    await W.handTap(lx, sub.cy); W.tapFx(lx, sub.cy); SFX.tap(); W.hand(null);
    const ret = await W.lock(sub); SFX.right();
    await p3;
    // 4 · fire: the torpedo runs out and hits
    step(4, 'TARGET HIT!');
    const p4 = say(S.hp4);
    W.glow(sub, false); await W.fire(sub, ret);
    W.sparkle(lx, sub.cy - 40); await p4; await wait(.8);
    gsap.to(chip, { opacity: 0, duration: .3, onComplete: () => chip.remove() });
    await W.clearSubs(); W.stripOff(); W.labelsOn([]);
    await gsap.to('#scale', { opacity: 0, duration: .4 });   // the teaching switches the scale on again, properly
  }

  /* =====================================================================
     LEVEL 1 · positive and negative missiles (sheet L1 V3)
     The enemy's red missiles are positive, the defence system's blue ones negative. The child taps one missile and then
     an opposite one: the pair meets and cancels (0). Then they fire at the submarine on the answer (rows 2–10).
     Two missiles of the same sign, or a wrong submarine, is a mistake: Incorrect Feedback 1, 2, 3 in turn.
     On the right answer the rest of the pairs cancel, the missiles left fly into the marker (it steps along the rope) and we fire.
     ===================================================================== */
  const eq = (a, b) => `(${f(a)}) + (${f(b)})`;
  async function missileRound(R) {
    const res = R.a + R.b, opp = Math.sign(R.a) !== Math.sign(R.b); W.expect = res;
    await W.panFor(R.opts || [0]);
    W.strip(eq(R.a, R.b) + ' = ?', { big: true });
    W.marker(0);
    await W.missiles([{ n: Math.abs(R.a), sign: Math.sign(R.a) }, { n: Math.abs(R.b), sign: Math.sign(R.b) }]);
    if (R.opts) await W.spawn(R.opts, { stagger: .15 });
    await say(R.voL);
    let strikes = 0, sel = null, busy = false, onCancel = () => {};
    const K = {   // the sheet's animation kinds
      pair: () => { const p = W.mslPairs()[0]; if (p) W.mslPulse(p); },                       // one opposite pair pulses
      pairs: () => W.mslPairs().forEach((p, i) => W.mslPulse(p, i * .06)),                      // all possible pairs glow
      demoPair: async () => { const p = W.mslPairs()[0]; if (!p || busy) return; busy = true; if (sel) { W.mslSel(sel, false); sel = null; } await W.mslCancel(p[0], p[1]); busy = false; onCancel(); },   // one pair moves together and disappears
      remain: () => W.mslPulse(W.mslRemain()),                                                  // the missiles that will remain pulse
      groupsEq: () => { W.mslPulse(W.mslRow(0)); W.mslPulse(W.mslRow(1)); },                    // both groups highlight equally
      groups: () => { W.mslPulse(W.mslRow(0)); W.mslPulse(W.mslRow(1)); },                      // both missile groups pulse (together)
      groupsMove: () => W.mslTogether(),                                                        // the groups move together
      total: () => { W.mslPulse(W.mslAlive()); W.pulseSub(W.subAt(res)); W.pulseLbl(res); },  // the whole group and the total pulse
    };
    W.matching = true; W.dragRope(true);
    const hit = await new Promise(resolve => {
      let calls = [];
      const idle = () => K[R.idleL.kind]();
      const arm = () => { calls.forEach(c => c.kill()); calls = [gsap.delayedCall(6, idle), gsap.delayedCall(12, () => { idle(); say(R.idleL.line); }), gsap.delayedCall(22, () => { idle(); say(R.idleL.line); })]; };
      const stop = () => { calls.forEach(c => c.kill()); W.onMissile(null); };
      const mistake = async () => { strikes++; const fb = R.fbL[Math.min(strikes, 3) - 1]; K[fb.kind](); await say(fb.line); };
      onCancel = () => { if (!R.opts && !W.mslPairs().length) { stop(); resolve(null); } };   // row 1: done when every pair is cancelled
      W.onMissile(async m => {
        arm(); SD.skip(); if (busy) return;
        if (!sel) { sel = m; W.mslSel(m, true); return; }
        if (sel === m) { W.mslSel(m, false); sel = null; return; }
        const a = sel; sel = null;
        if (a.sign !== m.sign) { busy = true; await W.mslCancel(a.sign > 0 ? a : m, a.sign > 0 ? m : a); busy = false; onCancel(); }
        else { W.mslSel(a, false); W.mslBad(a, m); mistake(); }
      });
      if (R.opts) (async () => {
        for (;;) {
          const s = await W.waitTap({ noIdle: true, only: strikes >= 3 ? W.subAt(res) : null });
          arm(); SD.skip();
          if (s.v === res) { stop(); return resolve(s); }
          busy = true; const red = await W.lock(s, 'red'); await W.wrong(s); red.remove(); busy = false; mistake();
        }
      })();
      arm();
    });
    W.matching = false; W.dragRope(false); if (sel) W.mslSel(sel, false);
    // Correct Animation: the opposite pairs disappear, the missiles left move the marker from 0, then the shot
    if (hit) W.glow(hit, true);
    for (const [p, n] of W.mslPairs()) await W.mslCancel(p, n, true);
    await (Math.abs(res) <= 14 ? W.panFor([0, res], .6) : W.panTo(Math.sign(res) * 7, .6));
    if (opp) await W.runMarker(W.mslRemain());
    else { await W.runMarker(W.mslRow(0)); await wait(.25); await W.runMarker(W.mslRow(1)); }
    if (!res) W.markerPulse();   // the marker stays at 0
    if (hit) { W.glow(hit, false); await W.follow(res); const r = await W.lock(hit); SFX.right(); await W.fire(hit, r); }
    mark(strikes === 0);
    W.reward({ big: false, confetti: true, pip: W.pipDone, at: hit ? null : { x: 960, y: 260 } });   // small confetti
    W.strip(eq(R.a, R.b) + ' = ' + f(res), { big: true });
    await say(R.okL);
    await wait(.4); W.clearMissiles(); W.markerOff(); await W.clearSubs(); W.stripOff();
  }
  async function level1(start = 0) {
    LV = 'l1'; await W.banner('', 'LEVEL 1', '');
    W.pips(D.L1.length, start);
    for (let r = start; r < D.L1.length; r++) {
      SD.where = { at: 'l1', round: r + 1 };
      await missileRound(D.L1[r]); W.pips(D.L1.length, r + 1);
      if (r < D.L1.length - 1) await W.sail();
    }
    await complete('l1', 'LEVEL 1 COMPLETE!');
  }

  /* =====================================================================
     LEVEL 2 · fire at the submarine close to our defence line 0 (sheet L2 V3). The rope glides to each pair of positions;
     0 keeps a glowing defence line (and a chip at the edge of the window when it is out of view).
     ===================================================================== */
  async function level2(start = 0) {
    LV = 'l2'; await W.banner('', 'LEVEL 2', '');
    W.pips(D.L2.length, start); W.defLine(true);
    if (start === 0) {   // Teaching: "The smaller number closer to 0."
      SD.where = { at: 'l2', round: 1 };
      await W.panTo(5); W.zeroGlow();
      const line = say(D.L2_TEACH.voL); await wait(1.4);
      const off = await W.scan(11, ''); await line; off();
    }
    for (let r = start; r < D.L2.length; r++) {
      SD.where = { at: 'l2', round: r + 1 };
      const R = D.L2[r];
      await W.panFor(R.subs);   // (0 joins the view when it fits)
      W.strip(R.ost); await W.spawn(R.subs);
      W.dragRope(true); await say(R.voL);
      const first = await strike(R, R.target); W.dragRope(false);
      mark(first);
      W.reward({ big: first, pip: W.pipDone });
      W.strip(R.show, { big: true });   // Correct Animation: show +8 < +10
      await say(R.okL);
      W.pips(D.L2.length, r + 1); await wait(.4); await W.clearSubs(); W.stripOff();
      if (r < D.L2.length - 1) await W.sail();
    }
    W.defLine(false);
    await complete('l2', 'LEVEL 2 COMPLETE!');
  }

  /* =====================================================================
     LEVEL 3 · fire from the smaller number to the bigger (sheet L3 V3). The submarines float at random places in the water
     with their numbers on them (the rope is put away); each hit gets its firing number 1, 2, 3, 4.
     ===================================================================== */
  function scatter(n) {   // random spots in the open water, apart from each other and clear of the cannon
    const out = [];
    for (let k = 0; k < 2000 && out.length < n; k++) {
      const x = 340 + Math.random() * 1240, y = 235 + Math.random() * 290;
      if (y > 420 && Math.abs(x - 960) < 280) continue;
      if (out.every(p => Math.abs(p.x - x) > 270 || Math.abs(p.y - y) > 175)) out.push({ x, y });
    }
    while (out.length < n) out.push({ x: 360 + out.length * 400, y: 300 });
    return out;
  }
  async function orderRound(R) {
    const seq = [...R.subs].sort((a, b) => a - b);
    W.strip(R.ost, { big: true });
    await say(R.voL);
    let allFirst = true;
    for (let i = 0; i < seq.length; i++) {
      const next = seq[i], pulseNext = () => { W.pulseSub(W.subAt(next)); W.pulseTag(W.subAt(next)); };
      const first = await strike(R, next, {
        fb: k => k === 1 ? { line: R.fbL[0].line, anim: () => {} }   // the wrong submarine shakes (W.wrong)
          : k === 2 ? { line: R.fbL[1].line, anim: () => W.subs().forEach((s, j) => W.pulseTag(s, j * .08)) }   // the numbers left pulse
          : { line: D.startWith(next), anim: pulseNext },   // "Start with the submarine with −12." and it pulses
        idleAnim: pulseNext, idleLine: R.idleL.line });   // the smallest number left pulses
      allFirst = allFirst && first;
      W.badge(next, i + 1, W.lastHit); await wait(.3);
    }
    mark(allFirst);
    if (R.cheer) W.strip(R.cheer, { big: true });   // ROUTE CLEARED! / ALL TARGETS CLEARED!
    W.reward({ big: !!R.cheer, confetti: true, pip: W.pipDone, at: { x: 960, y: 300 } });
    await say(R.okL);
    await wait(.6); W.clearBadges(); await W.clearSubs(); W.stripOff();
  }
  async function level3(start = 0) {
    LV = 'l3'; W.dragRope(false); await W.panTo(0, .4); gsap.to('#scale', { autoAlpha: 0, duration: .5 });
    await W.banner('', 'LEVEL 3', '');   // "Level title appears."
    W.pips(D.L3.length, start);
    for (let r = start; r < D.L3.length; r++) {
      SD.where = { at: 'l3', round: r + 1 };
      const R = D.L3[r];
      await W.spawn(R.subs, { at: scatter(R.subs.length), stagger: .3 });   // the submarines appear at random places
      if (r === 0) { W.strip(D.L3_TEACH.ost, { big: true }); await say(D.L3_TEACH.voL); }
      await orderRound(R);
      W.pips(D.L3.length, r + 1);
      if (r < D.L3.length - 1) await W.sail();
    }
    // Level Completion: the sea calms, large confetti and the completion badge
    W.reward({ big: true, confetti: true, at: { x: 960, y: 320 } });
    await say(D.L3_END.voL); await say(D.L3_END.okL);
    await complete('l3', D.L3_END.ost);
    gsap.set('#scale', { autoAlpha: 1, opacity: 0 });
    await storyEnd();   // the story's ending (storyboard row 12)
  }

  /* ---------- level complete card (the completion badge): title + stars ---------- */
  async function complete(lv, title) {
    const sc = SCORE[lv] || [], firsts = sc.filter(Boolean).length, n = sc.length || 1, stars = firsts === n ? 3 : firsts / n >= .6 ? 2 : 1;
    (window.GAME_RESULT = window.GAME_RESULT || {})[lv] = { stars, firstTry: firsts, missions: n };
    $('#dt').textContent = title; $('#ds').textContent = ''; $('#dchain').innerHTML = ''; $('#dcta').textContent = 'Next';
    $('#dstars').innerHTML = [0, 1, 2].map(i => `<img src="assets/img/${i < stars ? 'star_gold' : 'star_silver'}.webp" class="${i < stars ? '' : 'off'}">`).join('');
    const d = $('#done'); d.classList.remove('hidden'); SFX.tada();
    gsap.fromTo('#done .card', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .55, ease: 'back.out(1.7)' });
    gsap.fromTo('#dstars img', { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .45, stagger: .18, delay: .4, ease: 'back.out(3)', onStart: () => SFX.pop() });
    gsap.fromTo('#dcta', { scale: 1 }, { scale: 1.07, duration: .6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.2 });
    await new Promise(r => { const c = gsap.delayedCall(5, r); $('#dcta').onclick = () => { c.kill(); r(); }; });
    gsap.killTweensOf('#dcta'); gsap.set('#dcta', { scale: 1 });
    await gsap.to('#done .card', { scale: .8, opacity: 0, duration: .3 }); d.classList.add('hidden');
    await W.sail();
  }

  /* ---------- run: story → Level 1 → Level 2 → Level 3 (→ the story's ending) → back to the title ---------- */
  async function run() {
    const at = Q.get('at') || 'hook', r = parseInt(Q.get('round') || '1', 10) - 1;
    const order = ['hook', 'l1', 'l2', 'l3'];
    for (let i = Math.max(0, order.indexOf(at)); i < order.length; i++) {
      const k = order[i], st = k === at ? r : 0;
      SD.where = { at: k, round: st + 1 };
      if (k !== 'hook' && k === at) { SD.music('play'); SD.ambience('waves'); }
      if (k === 'hook') await hook();
      if (k === 'l1') { await W.scaleIntro(); await level1(st); }
      if (k === 'l2') { if (k === at) await W.scaleIntro(); await level2(st); }
      if (k === 'l3') await level3(st);
    }
    location.search = Q.get('qa') === '1' ? '?qa=1' : '';
  }
  $('#btnSpeak').onclick = () => { const l = SD.lastLine; if (l) say(l.x, l.o.bubble ? {} : l.o); };
  $('#start').onclick = async () => {
    if ($('#start')._go) return; $('#start')._go = true;
    SD.audioOn(); SFX.ping();
    const boot = $('#boot');
    if ((Q.get('at') || 'hook') === 'hook') { $('#story').classList.remove('hidden'); gsap.set('#story', { opacity: 1 }); }   // the story's solid backdrop goes up under the title first: the game never shows through
    await Promise.all([gsap.to('#title', { opacity: 0, duration: .5 }), SD.ready]);   // never start mid-load: that is where jumps used to hitch
    $('#title').classList.add('hidden');
    if (boot) await gsap.to(boot, { opacity: 0, duration: .45, onComplete: () => boot.remove() });
    window.SD_RUN = run();
  };
  // title screen breathes
  gsap.fromTo('#start', { scale: 1 }, { scale: 1.06, duration: .8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2.1, immediateRender: false });   // breathes once it has popped in
  const logo = $('#title .logo');
  logo.innerHTML = [...logo.textContent].map(c => c === ' ' ? '<span>&nbsp;</span>' : `<span>${c}</span>`).join('');
  gsap.from('#title .logo span', { y: -160, opacity: 0, rotation: () => (Math.random() - .5) * 40, duration: .9, stagger: .05, ease: 'back.out(1.8)' });
  gsap.to('#title .logo span', { y: -10, duration: .7, ease: 'sine.inOut', stagger: { each: .08, repeat: -1, yoyo: true }, delay: 1.4 });
  gsap.fromTo('#title .art', { scale: 1.1 }, { scale: 1, duration: 2.6, ease: 'power2.out' });   // a slow push-in on the cover
  gsap.to('#title .art', { scale: 1.025, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2.6 });
  gsap.from('#start', { scale: 0, rotation: -120, opacity: 0, duration: .9, delay: 1.1, ease: 'back.out(2.2)' });
  $('#start').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#start').onclick(); } };
  if (Q.get('autostart') === '1') {   // a QA / editor jump: a quiet sonar screen covers the page while it loads, then the level fades in
    const boot = document.createElement('div'); boot.id = 'boot'; boot.innerHTML = '<i></i><i></i><span>SONAR CONTACT…</span>'; $('#stage').appendChild(boot);
    gsap.set('#title', { opacity: 0 }); $('#start').onclick();
  }
})();
