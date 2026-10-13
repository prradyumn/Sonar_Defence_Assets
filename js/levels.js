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
  const bezier = (x1, y1, x2, y2) => t => {          // CSS cubic-bezier as a GSAP ease (Newton on x, then y)
    let u = t;
    for (let i = 0; i < 8; i++) { const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t, dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2); if (Math.abs(x) < 1e-6 || !dx) break; u = Math.min(1, Math.max(0, u - x / dx)); }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const DOOR_EASE = bezier(.45, 0, .2, 1);

  /* ---------- one "fire at the right submarine" tap, with the 3-strike rule ---------- */
  // m: { target, lines: { oopsL, hintL, nudgeL, idleL } }
  async function strike(m) {
    let wrong = 0; W.expect = m.target;
    for (;;) {
      const s = await W.waitTap({
        onIdle: () => { say(m.lines.idleL || S.idle); W.pulseAll(); },
        onIdle2: () => say(S.take),
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
      if (wrong === 1) { W.hintArrow(s.v, dir); await say(m.lines.oopsL); }
      else if (wrong === 2) { W.hintArrow(s.v, dir); W.rule(true, 'compare'); await say(m.lines.hintL); }
      else { const t = W.subAt(m.target); W.dimOthers(t, true); W.hand(t); W.glow(t, true); W.rule(true, 'compare'); await say(m.lines.nudgeL); }
    }
  }
  async function mission(m, o = {}) {
    W.strip(m.text);
    if (o.intro !== false) await say(m.sayL);
    const first = await strike(m);
    mark(first);
    const cheer = first || Math.random() < .5 ? rnd(S.hits) : null;
    W.reward({ big: first, word: cheer && cheer.text, pip: W.pipDone });
    if (cheer) await say(cheer);
    if (m.show) W.strip(m.show, { big: true });
    await say(m.okL);
    return first;
  }

  /* =====================================================================
     HOOK — the story sheet with Commander Meera & Cadet Riya: harbour → control room (alert) → navigation screen
     → two submarines → missiles → targets confirmed, MISSION 1 → dive → how to play
     ===================================================================== */
  async function hook() {
    const st = $('#story'), bg = $('#storyBg'), cast = $('#cast'), sfx = $('#storyFx');
    SD.music('calm'); SD.ambience('harbour');                 // sunrise at the harbour: calm theme, waves and gulls
    st.classList.remove('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    let skipping = false;
    $('#skipStory').onclick = e => { e.stopPropagation(); skipping = true; SD.skip(); };
    st.onpointerdown = e => { if (e.target.id !== 'skipStory') SD.skip(); };   // tap = next line
    const SKIP = {};
    const chk = () => { if (skipping) throw SKIP; };

    // data-edit gives each story element a stable name, so the layout editor can move it (js/layout.js)
    const actor = (who, css, name, flip) => {   // the talking sheet (core.js) · flip: mirror the art so the two characters face each other
      const d = document.createElement('div'); d.className = 'actor'; d.dataset.edit = name; Object.assign(d.style, css);
      const t = SD.talker(who);
      if (flip) { const f = document.createElement('div'); f.className = 'flip'; f.appendChild(t.el); d.appendChild(f); } else d.appendChild(t.el);
      cast.appendChild(d); return { el: d, talk: t.talk };
    };
    // the sonar-room doors: latch, hiss, then both halves slide apart (timing + ease from door_opening.svg: 0.5 s, then 1.8 s at cubic-bezier(.45,0,.2,1))
    async function doors() {
      const d = document.createElement('div'); d.id = 'doors';
      d.innerHTML = '<div class="spill"></div><div class="door l"><img src="assets/img/door_left.webp" alt=""><i class="lamp"></i></div><div class="door r"><img src="assets/img/door_right.webp" alt=""><i class="lamp"></i></div><div class="seam"></div>';
      sfx.appendChild(d);
      const L = d.querySelector('.door.l'), R = d.querySelector('.door.r'), lamps = d.querySelectorAll('.lamp'), seam = d.querySelector('.seam'), spill = d.querySelector('.spill');
      gsap.fromTo(d, { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'power2.out' });
      await wait(.4); chk();
      for (let i = 0; i < 2; i++) { SFX.doorBeep(); gsap.fromTo(lamps, { opacity: .15 }, { opacity: 1, duration: .08, yoyo: true, repeat: 1 }); await wait(.22); }
      chk(); SFX.clunk(); gsap.to(lamps, { opacity: .85, duration: .2 });
      gsap.fromTo([L, R], { x: 0 }, { x: i => i ? 7 : -7, duration: .07, yoyo: true, repeat: 1, ease: 'power1.out' });   // the latch kicks
      SFX.hiss(); gsap.fromTo(seam, { opacity: 0 }, { opacity: 1, duration: .25 });
      for (let i = 0; i < 7; i++) {   // air escaping at the seam
        const p = document.createElement('div'); p.className = 'steam'; Object.assign(p.style, { left: '960px', top: (240 + i * 110) + 'px' }); d.appendChild(p);
        gsap.fromTo(p, { scale: .2, opacity: .9, x: 0 }, { scale: 1.6 + Math.random(), opacity: 0, x: (i % 2 ? 1 : -1) * (40 + Math.random() * 60), y: -30 - Math.random() * 40, duration: 1.1, ease: 'power2.out', onComplete: () => p.remove() });
      }
      await wait(.35); chk();
      SFX.doorSlide(1.8);
      gsap.to(L, { x: -960, duration: 1.8, ease: DOOR_EASE }); gsap.to(R, { x: 960, duration: 1.8, ease: DOOR_EASE });
      gsap.fromTo(spill, { opacity: 1, scaleX: .05 }, { opacity: 0, scaleX: 1.6, duration: 1.8, ease: DOOR_EASE });
      gsap.to(seam, { opacity: 0, duration: .3 });
      gsap.fromTo(bg, { scale: 1.12 }, { scale: 1.03, duration: 2.1, ease: 'power2.out' });
      await wait(1.5); gsap.delayedCall(.25, () => { SFX.clunk(); d.remove(); });   // characters start in as the doors finish
    }
    // two characters walk in through the doorway: small and far at the centre → their places, with a step bounce
    async function walkIn(list) {
      list.forEach(([a, dx, dl]) => {
        gsap.from(a.el, { x: dx, y: -170, scale: .42, opacity: 0, duration: 1.15, delay: dl, ease: 'power2.out' });   // a smooth glide in, no bounce
      });
      for (let i = 0; i < 6; i++) gsap.delayedCall(i * .19, SFX.foot);
      await wait(.7);                                   // the first line starts while they are still walking in
    }
    const bubble = (who, cls, css, name) => {
      const b = document.createElement('div'); b.className = `bubble ${who} ${cls}`; b.dataset.edit = name; Object.assign(b.style, css);
      b.innerHTML = `<span class="nm">${SCRIPT.WHO[who].name}</span><span class="txt"></span>`; cast.appendChild(b); return b;
    };
    let actors = [], frames = null;
    async function line(L, b, a, extra) {
      chk();
      actors.forEach(x => x.el.classList.toggle('dim', x !== a));   // the listener dims; nobody moves
      const origin = b.classList.contains('tr') ? '85% 110%' : b.classList.contains('lft') ? '-5% 50%' : b.classList.contains('rgt') ? '105% 50%' : '15% 110%';
      gsap.fromTo(b, { scale: .5, opacity: 0, transformOrigin: origin }, { scale: 1, opacity: 1, duration: .4, ease: 'back.out(2.2)' });
      const tn = gsap.fromTo('#tapNext', { opacity: 0 }, { opacity: .85, duration: .4, delay: 1.6 });
      if (extra) extra();
      await say(L, { bubble: b, talk: a.talk });
      tn.kill(); gsap.set('#tapNext', { opacity: 0 });
      await gsap.to(b, { opacity: 0, scale: .9, duration: .2 });
    }

    // the big screen in the control room: a navigation scale −8 … +8 with defence line 0 in the middle
    const NAV = { x0: 420, step: 44, y: 330 }, nx = v => NAV.x0 + v * NAV.step;
    const ost = (text, cls = '') => { const o = document.createElement('div'); o.className = 'ost ' + cls; o.textContent = text; sfx.appendChild(o); gsap.fromTo(o, { scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2.4)' }); return o; };

    const SCENE = Q.get('at') === 'hook' ? +(Q.get('scene') || 1) : 1;   // QA: start at scene 2 (control room) or 3 (dive)
    try {
      if (SCENE < 2) {
      /* ---- Scene 1 · the harbour: the Coast Guard ship on patrol, enemy submarines slip in under the water ---- */
      bg.style.backgroundImage = 'url(assets/img/harbour.webp)';
      gsap.fromTo(bg, { scale: 1.16, x: 70 }, { scale: 1.04, x: 0, duration: 14, ease: 'none' });
      gsap.fromTo(st, { opacity: 0 }, { opacity: 1, duration: .6 });
      const meera = actor('meera', { left: '40px', height: '820px', bottom: '-70px' }, 'harbour-meera');
      const riya = actor('riya', { left: '1390px', height: '640px', bottom: '-20px' }, 'harbour-riya', true);
      actors = [meera, riya];
      gsap.from(meera.el, { x: -600, duration: 1, ease: 'power3.out', delay: .2 });
      gsap.from(riya.el, { x: 620, duration: .9, ease: 'power3.out', delay: .6 });
      await wait(1.1); chk();
      const bM = bubble('meera', 'tl', { left: '470px', top: '150px' }, 'harbour-meera-bubble');
      await line(S.s1, bM, meera, () => {
        [[2000, 760, 0], [2150, 870, 1.1], [2300, 975, 2.2]].forEach(([x, y, dl]) => {   // three dark shapes glide in under the surface
          const u = new Image(); u.src = 'assets/img/sub.webp'; u.className = 'shadowsub'; Object.assign(u.style, { left: x + 'px', top: y + 'px' }); sfx.appendChild(u);
          gsap.to(u, { x: -1240 - Math.random() * 200, duration: 6.5, delay: dl, ease: 'sine.out' });
          gsap.to(u, { y: 10, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          gsap.delayedCall(dl + .4, SFX.blip);
        });
      });
      chk();
      }

      if (SCENE < 3) {
      /* ---- Scene 2 · the control-room doors open: red warning lights, the alarm ---- */
      SFX.swoosh();
      await gsap.to([bg, cast, sfx], { opacity: 0, duration: .4, ease: 'power2.in' });
      gsap.killTweensOf(bg); cast.innerHTML = sfx.innerHTML = ''; SD.ambience(null);   // indoors: no sea
      bg.style.backgroundImage = 'url(assets/img/sonar_room.webp)';
      gsap.set([bg, cast, sfx], { x: 0, opacity: 1 });
      await doors(); chk();
      gsap.to(bg, { scale: 1, duration: 14, ease: 'none' });
      const radar = document.createElement('div'); radar.className = 'radar'; sfx.appendChild(radar);
      radar.innerHTML = '<div class="sweep2"></div>';
      gsap.to(radar.firstChild, { rotation: 360, duration: 2.6, repeat: -1, ease: 'none' });
      const alarm = document.createElement('div'); alarm.className = 'alarmglow'; sfx.appendChild(alarm);
      const m2 = actor('meera', { left: '20px', height: '980px', bottom: '-380px' }, 'sonar-meera');
      const r2 = actor('riya', { left: '1190px', height: '820px', bottom: '-330px' }, 'sonar-riya', true);
      actors = [m2, r2];
      await walkIn([[m2, 640, 0], [r2, -480, .12]]); chk();
      const bM2 = bubble('meera', 'lft', { left: '600px', top: '700px' }, 'sonar-meera-bubble');
      const bR2 = bubble('riya', 'rgt', { right: '790px', top: '650px' }, 'sonar-riya-bubble');
      const alert = ost('ALERT! ALERT!', 'red');
      const flash = gsap.to(alarm, { opacity: 1, duration: .4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(alert, { opacity: .35, duration: .4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .45 });
      SFX.alarm();
      await line(S.s2, bR2, r2, () => gsap.delayedCall(1.2, SFX.alarm));
      await line(S.s3, bM2, m2);
      flash.kill(); gsap.to(alarm, { opacity: .25, duration: .5 }); gsap.killTweensOf(alert); gsap.to(alert, { opacity: 0, scale: .8, duration: .3, onComplete: () => alert.remove() });

      /* ---- Scene 3 · the navigation screen: a horizontal scale, 0 in the centre is our defence line ---- */
      const nav = document.createElement('div'); nav.className = 'nav'; radar.appendChild(nav);
      let h = '<div class="bar"></div>';
      for (let v = -8; v <= 8; v++) h += `<i class="${v ? '' : 'z'}" style="left:${nx(v)}px"></i><b class="${v < 0 ? 'n' : v > 0 ? 'p' : 'z'}" style="left:${nx(v)}px">${f(v)}</b>`;
      nav.innerHTML = h + `<div class="navd" style="left:${nx(0)}px"><span>DEFENCE LINE 0</span></div>`;
      const dline = nav.querySelector('.navd');
      await line(S.s4, bM2, m2, () => {
        gsap.fromTo(nav.querySelector('.bar'), { scaleX: 0 }, { scaleX: 1, duration: .6, ease: 'power2.out' });
        gsap.fromTo(nav.querySelectorAll('i,b'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .3, stagger: { each: .025, from: 'center' }, delay: .3 });
        gsap.fromTo(dline, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: .5, delay: .9, ease: 'back.out(2)' });
        SFX.ping();
      });

      /* ---- Scene 4 · two submarines at −6 and +5: +5 blinks, it is closer to the defence line ---- */
      const blip = v => { const b = document.createElement('div'); b.className = 'blip'; Object.assign(b.style, { left: nx(v) + 'px', top: (NAV.y - 70) + 'px' }); radar.appendChild(b); gsap.fromTo(b, { scale: 0 }, { scale: 1, duration: .35, ease: 'back.out(3)' }); SFX.blip(); return b; };
      const dist = (v, cls) => { const d = document.createElement('div'); d.className = 'dist ' + cls; const a = Math.min(nx(0), nx(v)); Object.assign(d.style, { left: a + 'px', width: Math.abs(nx(v) - nx(0)) + 'px', top: (NAV.y - 30) + 'px' }); d.innerHTML = `<span>${Math.abs(v)}</span>`; radar.appendChild(d); gsap.fromTo(d, { scaleX: 0, transformOrigin: v < 0 ? '100% 50%' : '0% 50%' }, { scaleX: 1, duration: .6, ease: 'power2.out' }); return d; };
      let bN, bP;
      await line(S.s5, bM2, m2, () => {
        bN = blip(-6); gsap.delayedCall(.3, () => { bP = blip(5); });
        gsap.delayedCall(.8, () => { dist(-6, 'n'); dist(5, 'p'); });
        gsap.delayedCall(1.4, () => { gsap.to(bP, { scale: 1.5, duration: .3, yoyo: true, repeat: 7, ease: 'sine.inOut' }); gsap.fromTo(dline, { filter: 'brightness(1)' }, { filter: 'brightness(1.8)', duration: .3, yoyo: true, repeat: 5 }); });
      });

      /* ---- Scene 5 · their missile bays open: red missiles launch, the sonar flashes red ---- */
      const missiles = [];
      const launch = (from, dl) => gsap.delayedCall(dl, () => {
        const m = document.createElement('div'); m.className = 'rmis'; Object.assign(m.style, { left: nx(from) + 'px', top: (NAV.y - 70) + 'px' }); radar.appendChild(m); missiles.push(m);
        gsap.to(m, { left: nx(from) + (from < 0 ? 1 : -1) * (60 + Math.random() * 60), top: NAV.y - 150 - Math.random() * 70, duration: 1.2, ease: 'power1.out' }); SFX.launch();
      });
      const wave = () => { const w = document.createElement('div'); w.className = 'sonarwave'; radar.appendChild(w); gsap.fromTo(w, { scale: .1, opacity: .9 }, { scale: 2.4, opacity: 0, duration: 1.6, ease: 'power1.out', onComplete: () => w.remove() }); };
      await line(S.s6, bM2, m2, () => { [-6, 5, -6, 5].forEach((v, i) => launch(v, .3 + i * .35)); });
      await line(S.s7, bM2, m2, () => {
        radar.classList.add('red'); SFX.alarm(); for (let i = 0; i < 4; i++) gsap.delayedCall(i * .5, wave);
        gsap.fromTo(alarm, { opacity: .25 }, { opacity: .9, duration: .35, yoyo: true, repeat: 3 });
      });

      /* ---- Scene 6 · targets confirmed: each missile gets a targeting circle, 0 glows → MISSION 1 ---- */
      await line(S.s8, bM2, m2, () => {
        radar.classList.remove('red');
        missiles.forEach((m, i) => gsap.delayedCall(.2 + i * .25, () => { const r = new Image(); r.src = 'assets/img/reticle.webp'; r.className = 'navlock'; m.appendChild(r); gsap.fromTo(r, { scale: 2, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .35, ease: 'back.out(2)' }); SFX.lock(); }));
        gsap.delayedCall(1.4, () => gsap.fromTo(nav.querySelectorAll('.z'), { filter: 'brightness(1)' }, { filter: 'brightness(2)', duration: .35, yoyo: true, repeat: 5 }));
      });
      await line(S.s9, bM2, m2);
      await line(S.s10, bM2, m2);
      await line(S.s11, bM2, m2);
      const m1 = ost('MISSION 1', 'stamp'); SFX.ping(); SFX.reward && SFX.reward(true);
      await wait(1.4); chk(); gsap.to(m1, { opacity: 0, scale: 1.2, duration: .3 });
      }
    } catch (e) { if (e !== SKIP) throw e; }

    /* ---- Dive · through the porthole into the sea ---- */
    SD.hush(); st.onpointerdown = null;
    gsap.set('#tapNext', { opacity: 0 });
    const dr = $('#doors'); if (dr) { gsap.killTweensOf(dr.querySelectorAll('*')); dr.remove(); }
    if (bg.style.backgroundImage.indexOf('sonar_room') < 0) { bg.style.backgroundImage = 'url(assets/img/sonar_room.webp)'; cast.innerHTML = sfx.innerHTML = ''; gsap.set([bg, cast, sfx], { x: 0, opacity: 1, scale: 1 }); }
    SFX.swoosh(); SFX.splash(); SD.music('play'); SD.ambience('waves');    // into the sea: the mission theme takes over
    for (let i = 0; i < 4; i++) { const r = document.createElement('div'); r.className = 'diveRing'; Object.assign(r.style, { left: '1710px', top: '380px', width: '200px', height: '200px', marginLeft: '-100px', marginTop: '-100px' }); sfx.appendChild(r); gsap.fromTo(r, { scale: .3, opacity: 1 }, { scale: 6, opacity: 0, duration: 1.2, delay: i * .15 }); }
    gsap.to(cast, { opacity: 0, duration: .4 });
    await gsap.to([bg, cast], { scale: 4.2, transformOrigin: '1710px 380px', duration: 1.3, ease: 'power3.in' });
    await gsap.to(st, { opacity: 0, duration: .45 });
    st.classList.add('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    await W.sail(1.4);
    await howTo();
  }

  /* ---------- how to play: four quick cards in the cockpit (story sheet), each lights up as Meera says it ---------- */
  async function howTo() {
    const CARDS = [
      [S.hp1, 'READ THE MISSION', '<div class="hscale"><i></i><i></i><i class="z"></i><i></i><i></i></div>'],
      [S.hp2, 'FIND THE TARGET', '<img src="assets/img/sub.webp" alt="">'],
      [S.hp3, 'AIM &amp; FIRE!', '<img src="assets/img/reticle.webp" alt="">'],
      [S.hp4, 'TARGET HIT!', '<b class="htick">✓</b>'],
    ];
    const box = document.createElement('div'); box.id = 'howto';
    box.innerHTML = '<div class="ht">HOW TO PLAY</div><div class="row">' + CARDS.map(([, t, ic], i) => `<div class="hc"><span class="n">${i + 1}</span><div class="ic">${ic}</div><div class="lb">${t}</div></div>`).join('') + '</div>';
    $('#stage').appendChild(box);
    const cards = box.querySelectorAll('.hc');
    let skip = false; box.onpointerdown = () => { skip = true; SD.skip(); };
    gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: .3 });
    gsap.fromTo(cards, { y: 40, opacity: 0, scale: .8 }, { y: 0, opacity: .45, scale: 1, duration: .45, stagger: .1, ease: 'back.out(2)' });
    await wait(.5);
    for (let i = 0; i < CARDS.length && !skip; i++) {
      cards.forEach((c, k) => c.classList.toggle('on', k === i));
      gsap.fromTo(cards[i], { scale: 1 }, { scale: 1.08, duration: .25, yoyo: true, repeat: 1, ease: 'back.out(3)' }); SFX.pop();
      if (i === 3) W.sparkle(960, 470);
      await say(CARDS[i][0]);
      gsap.to(cards[i], { opacity: .75, duration: .3 });
    }
    await gsap.to(box, { opacity: 0, duration: .35 }); box.remove();
  }

  /* ---------- Teaching the navigation scale ---------- */
  async function teach() {
    W.pips(0, 0);
    const intro = W.scaleIntro(); await say(S.g1); await intro; W.zeroGlow();
    W.strip('Navigation scale · <b>0</b> is the centre');
    await say(S.t1);
    let scan = W.scan(8, 'Greater ▶'), line = say(S.t2);   // she narrates while the light sweeps
    let off = await scan; await line; off();
    scan = W.scan(-8, '◀ Smaller'); line = say(S.t3);
    off = await scan; await line; off();
    await W.spawn([-3, 2]);
    W.glow(W.subAt(2), true); W.strip('<b>+2</b> is farther to the right', {});
    await say(S.t4);
    W.strip('+2 > −3', { big: true }); await wait(1.2);
    await W.clearSubs();
    await W.spawn([-2, -6]);
    W.glow(W.subAt(-6), true, 'rgba(255,150,90,.6)'); W.strip('<b>−6</b> is farther to the left');
    await say(S.t5);
    W.strip('−6 < −2', { big: true }); W.rule(true, 'compare');
    await say(S.t6);
    await say(S.t7);
    await W.clearSubs(); W.rule(false); W.stripOff();
  }

  /* ---------- first-mission tutorial: show HOW to read a submarine's position (without giving the answer) ---------- */
  async function tutorial() {
    const demo = W.subAt(-3), lx = W.X(-3), ly = 488 + W.CONFIG.SCALE_DY;   // the −3 label
    const p = say(S.tut1);
    await W.handTo(lx, ly, .9); await W.handTap(lx, ly);   // a glow pulses on the −3 label
    gsap.fromTo(document.querySelectorAll('.lbl')[5], { scale: 1 }, { scale: 1.45, duration: .3, yoyo: true, repeat: 3 });
    await p;
    const p2 = say(S.tut2);
    await W.handTo(lx, demo.cy, 1.1);                    // the glow slides along the sonar line to the submarine
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
      SD.where = { at: 'l1', round: r + 1 };
      const R = D.L1[r]; await W.spawn(R.subs);
      for (let i = 0; i < R.m.length; i++) {
        const m = R.m[i];
        if (r === 0 && i === 0) { await tutorial(); W.strip(m.text); await say(S.tut3); await mission(m, { intro: false }); }
        else await mission(m);
        done++; W.pips(total, done); await wait(.4);
      }
      await W.clearSubs(); W.stripOff(); if (r < D.L1.length - 1) await W.sail();
    }
    await say(S.l1end);
    await complete('l1', 'Level 1 cleared!', 'You compared positions on the scale.', 'Right → Greater &nbsp; Left → Smaller');
  }

  /* ---------- Level 2 · Order ---------- */
  const ORD = D.ORD;
  async function orderRound(R) {
    await W.spawn(R.subs, { stagger: .2 });
    const seq = [...R.subs].sort((a, b) => R.dir * (a - b));
    const txt = R.dir > 0 ? 'Clear the route from <b>left to right</b>.' : 'Clear the route from <b>right to left</b>.';
    W.strip(txt); W.sweepArrow(R.dir);                       // mission-start cue: which way to sweep
    await say(ORD.say(R.dir));
    let allFirst = true;
    for (let i = 0; i < seq.length; i++) {
      const next = seq[i];
      const m = { target: next, lines: { oopsL: ORD.oops(R.dir), hintL: ORD.hint(R.dir), nudgeL: ORD.nudge(next), idleL: ORD.idle(R.dir) } };
      if (i === 1) W.sweepArrow(R.dir);
      const first = await strike(m); allFirst = allFirst && first;
      W.badge(next, i + 1); SFX.right(); W.sparkle(W.lastHit.x, W.lastHit.y); await wait(.3);
    }
    W.clearHints(); mark(allFirst);
    W.strip(R.chain, { big: true });
    const cheer = rnd(S.hits); W.reward({ big: allFirst, word: cheer.text, pip: W.pipDone });
    await say(cheer);
    await say(R.okL);
    await wait(.6); W.clearBadges(); await W.clearSubs(); W.stripOff();
  }
  async function level2(start = 0) {
    LV = 'l2'; await W.banner('LEVEL 2', 'Order the Submarines', 'The launcher fires in a sweep');
    W.pips(D.L2.length, start);
    if (start === 0) await say(S.l2intro);
    for (let r = start; r < D.L2.length; r++) { SD.where = { at: 'l2', round: r + 1 }; await orderRound(D.L2[r]); W.pips(D.L2.length, r + 1); if (r < D.L2.length - 1) await W.sail(); }
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
      await say(L.intro);
      W.strip('Tap a pair to cancel it: one ▶ with one ◀');
      const showPair = async () => {                       // a glow pulses on an open pair
        const c = W.pairCentre(); if (!c) return;
        say(S.pairDemo); await W.handTo(c.x, c.y, .9); await W.handTap(c.x, c.y);
      };
      if (idx === 0) gsap.delayedCall(.1, showPair);       // first time: show where to tap
      // idle help while pairing: 6 s the pair boxes glow · 12 s spoken hint · 22 s a glow pulses on a pair
      await W.pairUp(() => W.hand(null), { idle: () => say(S.pairIdle), idle2: showPair });
      W.hand(null);
      await say(L.after);
    } else {
      await say(L.intro);
    }
    W.strip(eq(R.a, R.b) + ' = <b>?</b>', { big: true });
    await W.spawn(R.opts, { stagger: .15 });
    await say(S.l3ask);
    // 3-strike, but on the right answer the marker moves first, then we fire
    let wrong = 0; W.expect = res;
    for (;;) {
      const s = await W.waitTap({ onIdle: () => { say(S.l3idle); W.pulseAll(); }, onIdle2: () => say(S.take), only: wrong >= 3 ? W.subAt(res) : null });
      SD.skip();
      if (s.v === res) {
        W.clearHints(); const r = await W.lock(s); SFX.right();
        if (same) { const all = W.sigAlive(); await W.runMarker(all.slice(0, Math.abs(R.a))); await wait(.2); await W.runMarker(all.slice(Math.abs(R.a))); }
        else await W.runMarker();
        await W.fire(s, r); break;
      }
      wrong++; const red = await W.lock(s, 'red'); await W.wrong(s); red.remove(); W.clearHints();
      const dir = Math.sign(res - s.v);
      if (wrong === 1) { W.hintArrow(s.v, dir); await say(L.oops); }
      else if (wrong === 2) { W.hintArrow(s.v, dir); W.rule(true, same ? 'same' : 'pairs'); await say(L.hint); }
      else { const t = W.subAt(res); W.dimOthers(t, true); W.hand(t); W.glow(t, true); W.rule(true, same ? 'same' : 'pairs'); await say(L.nudge); }
    }
    W.rule(false); mark(wrong === 0);
    const cheer = wrong === 0 ? rnd(S.hits) : null;
    W.reward({ big: wrong === 0, word: cheer && cheer.text, pip: W.pipDone });
    if (cheer) await say(cheer);
    W.strip(eq(R.a, R.b) + ' = ' + f(res), { big: true });
    await say(L.ok);
    W.clearSignals(); W.markerOff(); await W.clearSubs(); W.stripOff();
  }
  async function level3(start = 0) {
    LV = 'l3'; await W.banner('LEVEL 3', 'Additive Integer Defence', 'Signals move the defence marker');
    W.pips(D.L3.length, start);
    if (start === 0) await say(S.l3intro);
    for (let r = start; r < D.L3.length; r++) { SD.where = { at: 'l3', round: r + 1 }; await signalRound(D.L3[r], r); W.pips(D.L3.length, r + 1); if (r < D.L3.length - 1) await W.sail(); }
    await complete('l3', 'Level 3 cleared!', 'You combined positive and negative moves.', 'Opposites cancel: +4 and −4 make 0');
  }

  /* ---------- Final mixed mission ---------- */
  async function finalMission(start = 0) {
    LV = 'fin'; await W.banner('FINAL MISSION', 'Protect the Route', 'Compare · Order · Combine', 2.4);
    W.pips(3, start);
    if (start < 1) { SD.where = { at: 'final', round: 1 }; await orderRound(D.FIN_ORD); W.pips(3, 1); await W.sail(); }
    if (start < 2) { SD.where = { at: 'final', round: 2 }; await W.spawn(D.FIN_CMP.subs); await mission(D.FIN_CMP.m); await W.clearSubs(); W.stripOff(); W.pips(3, 2); await W.sail(); }
    SD.where = { at: 'final', round: 3 };
    await signalRound(D.FIN_SIG, 5);
    W.pips(3, 3);
    const end = W.banner('MISSION COMPLETE', 'ROUTE CLEARED!', 'The sea route is safe again!', 3.4);   // story sheet ending
    await say(S.finEnd); await end;
    await complete('fin', 'Sea route protected!', 'You compared, ordered and combined integers.', 'Compare · Order · Combine', 'Play again');
  }

  /* ---------- level complete card ---------- */
  async function complete(lv, t, s, chain, cta = 'Next mission') {
    const sc = SCORE[lv] || [], firsts = sc.filter(Boolean).length, n = sc.length || 1, stars = firsts === n ? 3 : firsts / n >= .6 ? 2 : 1;
    (window.GAME_RESULT = window.GAME_RESULT || {})[lv] = { stars, firstTry: firsts, missions: n };
    $('#dt').textContent = t; $('#ds').textContent = s; $('#dchain').innerHTML = chain; $('#dcta').textContent = cta;
    $('#dstars').innerHTML = [0, 1, 2].map(i => `<img src="assets/img/${i < stars ? 'star_gold' : 'star_silver'}.webp" class="${i < stars ? '' : 'off'}">`).join('');
    const d = $('#done'); d.classList.remove('hidden'); SFX.tada();
    gsap.fromTo('#done .card', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .55, ease: 'back.out(1.7)' });
    gsap.fromTo('#dstars img', { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .45, stagger: .18, delay: .4, ease: 'back.out(3)', onStart: () => SFX.pop() });
    gsap.fromTo('#dcta', { scale: 1 }, { scale: 1.07, duration: .6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.2 });
    const cheer = say(cta === 'Play again' ? S.doneF : S.done1);
    await new Promise(r => { let c = null; cheer.then(() => { c = gsap.delayedCall(cta === 'Play again' ? 999 : 3, r); }); $('#dcta').onclick = () => { if (c) c.kill(); SD.skip(); r(); }; });
    gsap.killTweensOf('#dcta'); gsap.set('#dcta', { scale: 1 });
    await gsap.to('#done .card', { scale: .8, opacity: 0, duration: .3 }); d.classList.add('hidden');
    await W.sail();
  }

  /* ---------- run ---------- */
  async function run() {
    const at = Q.get('at') || 'hook', r = parseInt(Q.get('round') || '1', 10) - 1;
    const order = ['hook', 'teach', 'l1', 'l2', 'l3', 'final'];
    for (let i = order.indexOf(at); i < order.length; i++) {
      const k = order[i], st = k === at ? r : 0;
      SD.where = { at: k, round: st + 1 };
      if (k !== 'hook' && k === at) { SD.music('play'); SD.ambience('waves'); }
      if (k === 'hook') await hook();
      if (k === 'teach') await teach();
      if (k === 'l1') { if (k === at && at !== 'teach') await W.scaleIntro(); await level1(st); }
      if (k === 'l2') { if (k === at) await W.scaleIntro(); await level2(st); }
      if (k === 'l3') { if (k === at) await W.scaleIntro(); await level3(st); }
      if (k === 'final') { if (k === at) await W.scaleIntro(); await finalMission(st); location.search = Q.get('qa') === '1' ? '?qa=1' : ''; }
    }
  }
  $('#btnSpeak').onclick = () => { const l = SD.lastLine; if (l) say(l.x, l.o.bubble ? {} : l.o); };
  $('#start').onclick = async () => {
    SD.audioOn(); SFX.ping(); await gsap.to('#title', { opacity: 0, duration: .5 }); $('#title').classList.add('hidden');
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
  if (Q.get('autostart') === '1') $('#start').onclick();
})();
