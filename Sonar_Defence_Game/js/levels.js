/* levels: hook (story) → scale teaching → L1 compare → L2 order → L3 combine → final mixed mission.
   Every spoken line comes from js/script.js (SCRIPT.S / SCRIPT.D) so recorded voices match by id. */
(function () {
  const { $, Q, wait, fmt, SFX, say } = SD;
  const { S, D } = SCRIPT;
  const f = fmt;
  const SCORE = {};                      // level → [true/false first-try per mission]
  let LV = 'l1';
  const mark = ok => (SCORE[LV] = SCORE[LV] || []).push(ok);
  const rnd = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- one "fire at the right submarine" tap, with the 3-strike rule ---------- */
  // m: { target, lines: { oopsL, hintL, nudgeL, idleL } }
  async function strike(m) {
    let wrong = 0; W.expect = m.target;
    for (;;) {
      const s = await W.waitTap({
        onIdle: () => { say(m.lines.idleL || S.idle, { pose: 'think' }); W.pulseAll(); },
        onIdle2: () => say(S.take, { pose: 'idle' }),
        only: wrong >= 3 ? W.subAt(m.target) : null });
      SD.skip();
      if (s.v === m.target) {
        W.clearHints(); W.rule(false);
        const r = await W.lock(s); SFX.right();
        await W.fire(s, r);
        return wrong === 0;
      }
      wrong++;
      const dir = Math.sign(m.target - s.v);
      const red = await W.lock(s, 'red'); await W.wrong(s); red.remove();
      W.clearHints();
      if (wrong === 1) { W.hintArrow(s.v, dir); await say(m.lines.oopsL, { pose: 'think' }); }
      else if (wrong === 2) { W.hintArrow(s.v, dir); W.rule(true); await say(m.lines.hintL, { pose: dir > 0 ? 'right' : 'left' }); }
      else { const t = W.subAt(m.target); W.dimOthers(t, true); W.hand(t); W.glow(t, true); W.rule(true); await say(m.lines.nudgeL, { pose: dir > 0 ? 'right' : 'left' }); }
    }
  }
  async function mission(m, o = {}) {
    W.strip(m.text);
    if (o.intro !== false) await say(m.sayL, { pose: 'bino' });
    const first = await strike(m);
    mark(first); SD.pose('thumb');
    if (first || Math.random() < .5) await say(rnd(S.hits), { mood: 'cheer' });
    if (m.show) W.strip(m.show, { big: true });
    await say(m.okL, { pose: 'thumb' });
    return first;
  }

  /* =====================================================================
     HOOK — Commander Meera & Cadet Riya: harbour → sonar room → dive
     ===================================================================== */
  async function hook() {
    const st = $('#story'), bg = $('#storyBg'), cast = $('#cast'), sfx = $('#storyFx');
    st.classList.remove('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    let skipping = false;
    $('#skipStory').onclick = e => { e.stopPropagation(); skipping = true; SD.skip(); };
    st.onpointerdown = e => { if (e.target.id !== 'skipStory') SD.skip(); };   // tap = next line
    const SKIP = {};
    const chk = () => { if (skipping) throw SKIP; };

    const actor = (src, css) => {
      const d = document.createElement('div'); d.className = 'actor'; Object.assign(d.style, css);
      const im = new Image(); im.src = 'assets/img/' + src; d.appendChild(im); cast.appendChild(d); return { el: d, im };
    };
    const bubble = (who, cls, css) => {
      const b = document.createElement('div'); b.className = `bubble ${who} ${cls}`; Object.assign(b.style, css);
      b.innerHTML = `<span class="nm">${SCRIPT.WHO[who].name}</span><span class="txt"></span>`; cast.appendChild(b); return b;
    };
    let actors = [], frames = null;
    async function line(L, b, a, extra) {
      chk();
      actors.forEach(x => { x.el.classList.toggle('dim', x !== a); gsap.to(x.el, { scale: x === a ? 1.03 : 1, duration: .3 }); });
      const origin = b.classList.contains('tr') ? '85% 110%' : b.classList.contains('lft') ? '-5% 50%' : b.classList.contains('rgt') ? '105% 50%' : '15% 110%';
      gsap.fromTo(b, { scale: .5, opacity: 0, transformOrigin: origin }, { scale: 1, opacity: 1, duration: .4, ease: 'back.out(2.2)' });
      const bob = gsap.to(a.im, { y: -6, duration: .22, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      let ft = null; if (a.talk) { let k = 0; ft = setInterval(() => { k = (k + 1) % 6; a.im.src = `assets/img/meera_talk_${k + 1}.webp`; }, 560 / SD.SPEED); }
      const tn = gsap.fromTo('#tapNext', { opacity: 0 }, { opacity: .85, duration: .4, delay: 1.6 });
      if (extra) extra();
      await say(L, { bubble: b });
      bob.kill(); gsap.to(a.im, { y: 0, duration: .15 }); clearInterval(ft); tn.kill(); gsap.set('#tapNext', { opacity: 0 });
      await gsap.to(b, { opacity: 0, scale: .9, duration: .2 });
    }

    try {
      /* ---- Scene 1 · the harbour at sunrise ---- */
      bg.style.backgroundImage = 'url(assets/img/harbour.webp)';
      gsap.fromTo(bg, { scale: 1.16, x: 70 }, { scale: 1.04, x: 0, duration: 14, ease: 'none' });
      gsap.fromTo(st, { opacity: 0 }, { opacity: 1, duration: .6 });
      const meera = actor('meera_right_big.webp', { left: '40px', height: '820px', bottom: '-70px' });
      const riya = actor('riya_idle.webp', { left: '1390px', height: '640px', bottom: '-20px' });
      actors = [meera, riya];
      gsap.from(meera.el, { x: -600, duration: 1, ease: 'power3.out', delay: .2 });
      gsap.from(riya.el, { x: 620, duration: .9, ease: 'power3.out', delay: .6 });
      gsap.fromTo(riya.el, { y: 0 }, { y: -40, duration: .18, yoyo: true, repeat: 3, delay: 1.3, ease: 'power1.out' });
      await wait(1.6); chk();
      const bR = bubble('riya', 'tr', { left: '780px', top: '220px' });
      const bM = bubble('meera', 'tl', { left: '470px', top: '150px' });
      await line(S.h1, bR, riya);
      const alarm = document.createElement('div'); alarm.className = 'alarmglow'; sfx.appendChild(alarm);
      await line(S.h2, bM, meera, () => {
        gsap.delayedCall(.8, () => { SFX.alarm(); SFX.ping(); gsap.to(alarm, { opacity: 1, duration: .35, yoyo: true, repeat: 5 }); gsap.fromTo(riya.el, { y: 0 }, { y: -50, duration: .16, yoyo: true, repeat: 1 }); });
      });
      chk();

      /* ---- Scene 2 · the sonar room ---- */
      SFX.swoosh();
      await gsap.to([bg, cast, sfx], { x: -300, opacity: 0, duration: .35, ease: 'power2.in' });
      cast.innerHTML = sfx.innerHTML = '';
      bg.style.backgroundImage = 'url(assets/img/sonar_room.webp)';
      gsap.set([cast, sfx], { x: 0, opacity: 1 });
      gsap.fromTo(bg, { x: 300, opacity: 0, scale: 1.1 }, { x: 0, opacity: 1, duration: .45, ease: 'power2.out' });
      gsap.to(bg, { scale: 1, duration: 16, ease: 'none', delay: .45 });
      const radar = document.createElement('div'); radar.className = 'radar'; sfx.appendChild(radar);
      radar.innerHTML = '<div class="sweep2"></div>';
      gsap.to(radar.firstChild, { rotation: 360, duration: 2.6, repeat: -1, ease: 'none' });
      const blip = (x, y) => { const b = document.createElement('div'); b.className = 'blip'; Object.assign(b.style, { left: x + 'px', top: y + 'px' }); radar.appendChild(b); gsap.fromTo(b, { scale: 0 }, { scale: 1, duration: .35, ease: 'back.out(3)' }); SFX.blip(); return b; };
      const m2 = actor('meera_talk_1.webp', { left: '0px', height: '600px', bottom: '-10px' }); m2.talk = true;
      const r2 = actor('riya_idle.webp', { left: '1190px', height: '820px', bottom: '-330px' });
      actors = [m2, r2];
      gsap.from(m2.el, { y: 300, duration: .6, ease: 'back.out(1.4)', delay: .2 });
      gsap.from(r2.el, { y: 360, duration: .6, ease: 'back.out(1.4)', delay: .35 });
      await wait(.8); chk();
      const bM2 = bubble('meera', 'lft', { left: '500px', top: '700px' });
      const bR2 = bubble('riya', 'rgt', { right: '790px', top: '650px' });
      const blips = [];
      await line(S.h3, bM2, m2, () => { [[560, 120], [690, 300], [480, 250]].forEach(([x, y], i) => gsap.delayedCall(.4 + i * .5, () => blips.push(blip(x, y)))); });
      await line(S.h4, bR2, r2, () => { [[770, 150], [620, 390], [720, 220], [520, 360]].forEach(([x, y], i) => gsap.delayedCall(.2 + i * .3, () => blips.push(blip(x, y)))); });
      await line(S.h5, bM2, m2, () => {
        const dl = document.createElement('div'); dl.className = 'dline'; dl.innerHTML = '<span>DEFENCE LINE</span>'; radar.appendChild(dl);
        gsap.fromTo(dl, { scaleY: 0, transformOrigin: '50% 0' }, { scaleY: 1, duration: .6, delay: .6 });
        blips.forEach(b => gsap.to(b, { x: -60 - Math.random() * 40, duration: 8, ease: 'none' }));
      });
      await line(S.h6, bR2, r2);
      await line(S.h7, bM2, m2, () => {
        const mini = document.createElement('div'); mini.className = 'mini'; radar.appendChild(mini);
        mini.innerHTML = [-3, -2, -1, 0, 1, 2, 3].map(v => `<i class="${v ? '' : 'z'}" style="left:${300 + v * 90}px"></i><b class="${v ? '' : 'z'}" style="left:${300 + v * 90}px">${f(v)}</b>`).join('');
        gsap.fromTo(mini, { scaleX: 0 }, { scaleX: 1, duration: .6, delay: .5, ease: 'power2.out' });
        // blips snap onto marked positions above the mini scale
        const spots = [-3, -1, 2];
        blips.forEach((b, i) => { gsap.killTweensOf(b); if (i < spots.length) gsap.to(b, { left: 150 + 300 + spots[i] * 90, top: 330, x: 0, duration: .6, delay: 1.2 + i * .2, ease: 'back.out(1.6)' }); else gsap.to(b, { opacity: 0, duration: .4, delay: 1 }); });
      });
      r2.im.src = 'assets/img/riya_cheer.webp'; r2.el.style.height = '760px'; r2.el.style.bottom = '-200px';
      gsap.fromTo(r2.el, { y: 0 }, { y: -60, duration: .25, yoyo: true, repeat: 1, ease: 'power2.out' });
      await line(S.h8, bR2, r2);
    } catch (e) { if (e !== SKIP) throw e; }

    /* ---- Dive · through the porthole into the sea ---- */
    SD.hush(); st.onpointerdown = null;
    gsap.set('#tapNext', { opacity: 0 });
    if (bg.style.backgroundImage.indexOf('sonar_room') < 0) { bg.style.backgroundImage = 'url(assets/img/sonar_room.webp)'; cast.innerHTML = sfx.innerHTML = ''; gsap.set([bg, cast, sfx], { x: 0, opacity: 1, scale: 1 }); }
    SFX.swoosh();
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'diveRing'; Object.assign(r.style, { left: '1710px', top: '380px', width: '200px', height: '200px', marginLeft: '-100px', marginTop: '-100px' }); sfx.appendChild(r); gsap.fromTo(r, { scale: .3, opacity: 1 }, { scale: 6, opacity: 0, duration: 1.2, delay: i * .15 }); }
    gsap.to(cast, { opacity: 0, duration: .4 });
    await gsap.to([bg, cast], { scale: 4.2, transformOrigin: '1710px 380px', duration: 1.3, ease: 'power3.in' });
    await gsap.to(st, { opacity: 0, duration: .45 });
    st.classList.add('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    await W.sail(1.4);
  }

  /* ---------- Teaching the navigation scale ---------- */
  async function teach() {
    W.pips(0, 0);
    const intro = W.scaleIntro(); await say(S.g1, { mood: 'cheer' }); await intro; W.zeroGlow();
    W.strip('Navigation scale · <b>0</b> is the centre');
    await say(S.t1, { pose: 'idle' });
    let off = await W.scan(8, 'Greater ▶');
    await say(S.t2, { pose: 'right' });
    off();
    off = await W.scan(-8, '◀ Smaller');
    await say(S.t3, { pose: 'left' });
    off();
    await W.spawn([-3, 2]);
    W.glow(W.subAt(2), true); W.strip('<b>+2</b> is farther to the right', {});
    await say(S.t4, { pose: 'right' });
    W.strip('+2 > −3', { big: true }); await wait(1.2);
    await W.clearSubs();
    await W.spawn([-2, -6]);
    W.glow(W.subAt(-6), true, 'rgba(255,150,90,.6)'); W.strip('<b>−6</b> is farther to the left');
    await say(S.t5, { pose: 'left' });
    W.strip('−6 < −2', { big: true }); W.rule(true);
    await say(S.t6, { pose: 'thumb' });
    await say(S.t7, { mood: 'cheer' });
    await W.clearSubs(); W.rule(false); W.stripOff();
  }

  /* ---------- first-mission tutorial: show HOW to read a submarine's position (without giving the answer) ---------- */
  async function tutorial() {
    const demo = W.subAt(-3), lx = W.X(-3);
    const p = say(S.tut1, { pose: 'idle' });
    await W.handTo(lx + 10, 500, .9); await W.handTap(lx, 488);
    gsap.fromTo(document.querySelectorAll('.lbl')[5], { scale: 1 }, { scale: 1.45, duration: .3, yoyo: true, repeat: 3 });
    await p;
    const p2 = say(S.tut2, { pose: 'left' });
    await W.handTo(lx + 10, demo.cy + 34, 1.1);           // slide down the sonar line to the submarine
    W.glow(demo, true, 'rgba(160,240,255,.6)');
    await p2;
    W.glow(demo, false); W.hand(null);
  }

  /* ---------- Level 1 · Compare ---------- */
  async function level1(start = 0) {
    LV = 'l1'; await W.banner('LEVEL 1', 'Compare Positions', 'Right is greater · Left is smaller');
    const total = 5; let done = [0, 1, 4][start];
    W.pips(total, done);
    for (let r = start; r < D.L1.length; r++) {
      const R = D.L1[r]; await W.spawn(R.subs);
      for (let i = 0; i < R.m.length; i++) {
        const m = R.m[i];
        if (r === 0 && i === 0) { await tutorial(); W.strip(m.text); await say(S.tut3, { pose: 'bino' }); await mission(m, { intro: false }); }
        else await mission(m);
        done++; W.pips(total, done); await wait(.4);
      }
      await W.clearSubs(); W.stripOff(); if (r < D.L1.length - 1) await W.sail();
    }
    await say(S.l1end, { pose: 'cheer' });
    await complete('l1', 'Level 1 cleared!', 'You compared positions on the scale.', 'Right → Greater &nbsp; Left → Smaller');
  }

  /* ---------- Level 2 · Order ---------- */
  const ORD = D.ORD;
  async function orderRound(R) {
    await W.spawn(R.subs, { stagger: .2 });
    const seq = [...R.subs].sort((a, b) => R.dir * (a - b));
    const txt = R.dir > 0 ? 'Clear the route from <b>left to right</b>.' : 'Clear the route from <b>right to left</b>.';
    W.strip(txt); W.sweepArrow(R.dir);                       // mission-start cue: which way to sweep
    await say(ORD.say(R.dir), { pose: R.dir > 0 ? 'right' : 'left' });
    let allFirst = true;
    for (let i = 0; i < seq.length; i++) {
      const next = seq[i];
      const m = { target: next, lines: { oopsL: ORD.oops(R.dir), hintL: ORD.hint(R.dir), nudgeL: ORD.nudge(next), idleL: ORD.idle(R.dir) } };
      if (i === 1) W.sweepArrow(R.dir);
      const first = await strike(m); allFirst = allFirst && first;
      W.badge(next, i + 1); SFX.right(); await wait(.3);
    }
    W.clearHints(); mark(allFirst);
    W.strip(R.chain, { big: true }); SD.pose('thumb');
    await say(rnd(S.hits), { mood: 'cheer' });
    await say(R.okL, { pose: 'thumb' });
    await wait(.6); W.clearBadges(); await W.clearSubs(); W.stripOff();
  }
  async function level2(start = 0) {
    LV = 'l2'; await W.banner('LEVEL 2', 'Order the Submarines', 'The launcher fires in a sweep');
    W.pips(D.L2.length, start);
    if (start === 0) await say(S.l2intro, { pose: 'bino' });
    for (let r = start; r < D.L2.length; r++) { await orderRound(D.L2[r]); W.pips(D.L2.length, r + 1); if (r < D.L2.length - 1) await W.sail(); }
    await complete('l2', 'Level 2 cleared!', 'You ordered the submarines.', 'Left → Right: smallest to greatest');
  }

  /* ---------- Level 3 · Combine movement signals ---------- */
  const eq = (a, b) => `(${f(a)}) + (${f(b)})`;
  async function signalRound(R, idx) {
    const res = R.a + R.b, same = Math.sign(R.a) === Math.sign(R.b), L = R.L;
    W.strip(eq(R.a, R.b), { big: true });
    W.marker(0);
    await W.signals([{ n: Math.abs(R.a), sign: Math.sign(R.a) }, { n: Math.abs(R.b), sign: Math.sign(R.b) }]);
    if (!same) {
      await say(L.intro, { pose: 'idle' });
      W.strip('Tap a pair to cancel it: one ▶ with one ◀');
      let demo = null;
      if (idx === 0) {                                     // first time: show where to tap
        demo = (async () => { await wait(.1); const b = (W._pairBoxes || [])[0]; if (!b) return; const r = b.getBoundingClientRect(), st = $('#stage').getBoundingClientRect(), k = st.width / 1920;
          const x = (r.left - st.left + r.width / 2) / k, y = (r.top - st.top + r.height / 2) / k;
          say(S.pairDemo, { pose: 'right' }); await W.handTo(x, y + 20, .9); await W.handTap(x, y);
          gsap.to('#hand', { y: 18, duration: .45, yoyo: true, repeat: -1, ease: 'sine.inOut' }); })();
      }
      await W.pairUp(() => W.hand(null), () => { W.hintPairs(); say(S.pairIdle, { pose: 'think' }); });
      W.hand(null);
      await say(L.after, { pose: res > 0 ? 'right' : res < 0 ? 'left' : 'thumb' });
    } else {
      await say(L.intro, { pose: R.a > 0 ? 'right' : 'left' });
    }
    W.strip(eq(R.a, R.b) + ' = <b>?</b>', { big: true });
    await W.spawn(R.opts, { stagger: .15 });
    await say(S.l3ask, { pose: 'bino' });
    // 3-strike, but on the right answer the marker moves first, then we fire
    let wrong = 0; W.expect = res;
    for (;;) {
      const s = await W.waitTap({ onIdle: () => { say(S.l3idle, { pose: 'think' }); W.pulseAll(); }, onIdle2: () => say(S.take, { pose: 'idle' }), only: wrong >= 3 ? W.subAt(res) : null });
      SD.skip();
      if (s.v === res) {
        W.clearHints(); const r = await W.lock(s); SFX.right();
        if (same) { const all = W.sigAlive(); await W.runMarker(all.slice(0, Math.abs(R.a))); await wait(.2); await W.runMarker(all.slice(Math.abs(R.a))); }
        else await W.runMarker();
        await W.fire(s, r); break;
      }
      wrong++; const red = await W.lock(s, 'red'); await W.wrong(s); red.remove(); W.clearHints();
      const dir = Math.sign(res - s.v);
      if (wrong === 1) { W.hintArrow(s.v, dir); await say(L.oops, { pose: 'think' }); }
      else if (wrong === 2) { W.hintArrow(s.v, dir); await say(L.hint, { pose: dir > 0 ? 'right' : 'left' }); }
      else { const t = W.subAt(res); W.dimOthers(t, true); W.hand(t); W.glow(t, true); await say(L.nudge, { pose: dir > 0 ? 'right' : 'left' }); }
    }
    mark(wrong === 0);
    if (wrong === 0) await say(rnd(S.hits), { mood: 'cheer' });
    W.strip(eq(R.a, R.b) + ' = ' + f(res), { big: true });
    await say(L.ok, { pose: 'thumb' });
    W.clearSignals(); W.markerOff(); await W.clearSubs(); W.stripOff();
  }
  async function level3(start = 0) {
    LV = 'l3'; await W.banner('LEVEL 3', 'Additive Integer Defence', 'Signals move the defence marker');
    W.pips(D.L3.length, start);
    if (start === 0) await say(S.l3intro, { pose: 'idle' });
    for (let r = start; r < D.L3.length; r++) { await signalRound(D.L3[r], r); W.pips(D.L3.length, r + 1); if (r < D.L3.length - 1) await W.sail(); }
    await complete('l3', 'Level 3 cleared!', 'You combined positive and negative moves.', 'Opposites cancel: +4 and −4 make 0');
  }

  /* ---------- Final mixed mission ---------- */
  async function finalMission() {
    LV = 'fin'; await W.banner('FINAL MISSION', 'Protect the Route', 'Compare · Order · Combine', 2.4);
    W.pips(3, 0);
    await orderRound(D.FIN_ORD);
    W.pips(3, 1); await W.sail();
    await W.spawn(D.FIN_CMP.subs);
    await mission(D.FIN_CMP.m);
    await W.clearSubs(); W.stripOff(); W.pips(3, 2); await W.sail();
    await signalRound(D.FIN_SIG, 5);
    W.pips(3, 3);
    await say(S.finEnd, { pose: 'cheer' });
    await complete('fin', 'Sea route protected!', 'You compared, ordered and combined integers.', 'Compare · Order · Combine', 'Play again');
  }

  /* ---------- level complete card ---------- */
  async function complete(lv, t, s, chain, cta = 'Next mission') {
    const sc = SCORE[lv] || [], firsts = sc.filter(Boolean).length, n = sc.length || 1, stars = firsts === n ? 3 : firsts / n >= .6 ? 2 : 1;
    (window.GAME_RESULT = window.GAME_RESULT || {})[lv] = { stars, firstTry: firsts, missions: n };
    $('#dt').textContent = t; $('#ds').textContent = s; $('#dchain').innerHTML = chain; $('#dcta').textContent = cta;
    $('#dstars').innerHTML = [0, 1, 2].map(i => `<img src="assets/img/${i < stars ? 'star_gold' : 'star_silver'}.webp" class="${i < stars ? '' : 'off'}">`).join('');
    const d = $('#done'); d.classList.remove('hidden'); SFX.tada(); SD.pose('cheer');
    gsap.fromTo('#done .card', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .55, ease: 'back.out(1.7)' });
    gsap.fromTo('#dstars img', { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .45, stagger: .18, delay: .4, ease: 'back.out(3)', onStart: () => SFX.pop() });
    gsap.fromTo('#dcta', { scale: 1 }, { scale: 1.07, duration: .6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.2 });
    const cheer = say(cta === 'Play again' ? S.doneF : S.done1, { mood: 'cheer' });
    await new Promise(r => { let c = null; cheer.then(() => { c = gsap.delayedCall(cta === 'Play again' ? 999 : 3, r); }); $('#dcta').onclick = () => { if (c) c.kill(); SD.skip(); r(); }; });
    gsap.killTweensOf('#dcta'); gsap.set('#dcta', { scale: 1 });
    await gsap.to('#done .card', { scale: .8, opacity: 0, duration: .3 }); d.classList.add('hidden'); SD.pose('idle');
    await W.sail();
  }

  /* ---------- run ---------- */
  async function run() {
    const at = Q.get('at') || 'hook', r = parseInt(Q.get('round') || '1', 10) - 1;
    const order = ['hook', 'teach', 'l1', 'l2', 'l3', 'final'];
    for (let i = order.indexOf(at); i < order.length; i++) {
      const k = order[i], st = k === at ? r : 0;
      if (k === 'hook') await hook();
      if (k === 'teach') await teach();
      if (k === 'l1') { if (k === at && at !== 'teach') await W.scaleIntro(); await level1(st); }
      if (k === 'l2') { if (k === at) await W.scaleIntro(); await level2(st); }
      if (k === 'l3') { if (k === at) await W.scaleIntro(); await level3(st); }
      if (k === 'final') { if (k === at) await W.scaleIntro(); await finalMission(); location.search = ''; }
    }
  }
  $('#btnSpeak').onclick = () => { const l = SD.lastLine; if (l) say(l.x, l.o.bubble ? {} : l.o); };
  $('#start').onclick = async () => {
    SD.audioOn(); SFX.ping(); await gsap.to('#title', { opacity: 0, duration: .5 }); $('#title').classList.add('hidden');
    window.SD_RUN = run();
  };
  // title screen breathes
  gsap.fromTo('#start', { scale: 1 }, { scale: 1.06, duration: .8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.from('#title .logo', { y: -40, opacity: 0, duration: .9, ease: 'back.out(1.6)' });
  if (Q.get('autostart') === '1') $('#start').onclick();
})();
