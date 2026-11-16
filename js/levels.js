/* levels: the hook → L1 launch opposite missiles → L2 closer to the border → L3 fire in order (sheets L1–L3 V3) → the ending.
   Only the 7 lines in SCRIPT.S are spoken (the hook + one intro per level); the rounds' instructions, correct lines and
   wrong-answer hints are on-screen text in the mission panel (note() below). */
(function () {
  const { $, Q, wait, fmt, SFX, say } = SD;
  const { S, D } = SCRIPT;
  const f = fmt;
  const SCORE = {};                      // level → [true/false first-try per mission]
  let LV = 'l1';
  const mark = ok => (SCORE[LV] = SCORE[LV] || []).push(ok);
  /* feedback shows in the mission panel and the narrator reads it aloud; back = the round's text, shown again after a while
     (once it has been said). Resolves when the line has been said and had time to be read.
     noteEnd() cancels a pending return (call it when the round moves on). */
  let noteN = 0;
  const note = (text, back, hold = 4) => { const n = ++noteN; W.strip(text); const said = SD.narrate(text);
    if (back) Promise.all([said, wait(hold)]).then(() => { if (n === noteN) W.strip(back); });
    return Promise.all([said, wait(readFor(text))]); };
  const noteEnd = () => { noteN++; };
  const readFor = t => Math.min(3.2, Math.max(1.6, t.split(' ').length * .32));   // time to read a line in the panel

  /* ---------- the sheets' hint animations ("Incorrect Animation" / "Inactivity Animation" columns) for Levels 2 and 3 ---------- */
  const sub = v => W.subAt(v);
  const ANIM = {
    both: R => R.subs.forEach((v, i) => W.pulseSub(sub(v), i * .1)),                                    // both submarines pulse
    labelsSeq: R => R.subs.forEach((v, i) => W.pulseLbl(v, i * 1.1)),                                   // the two numbers pulse one after another
    labels: R => R.subs.forEach(v => W.pulseLbl(v)),                                                    // both numbers glow
    targetRing: R => { W.pulseSub(sub(R.target)); W.pulseLbl(R.target); W.ring(sub(R.target)); },       // it pulses and the target ring appears
    target: R => { W.pulseSub(sub(R.target)); W.pulseLbl(R.target); },                                  // the answer pulses
  };

  /* ---------- fire at one submarine with the 3-strike rule ----------
     A wrong tap gets Incorrect Feedback 1, 2, 3 (with their animations); after the third only the right submarine answers.
     Idle: 6 s (o.nudge: Level 2 waits 9 s) → the inactivity animation · 12 s → the inactivity line too (as text) · 22 s → both again.
     o.guide (a level's first round, the tutorial): the helper glow shows what to tap, again after every miss.
     o.replay (Level 2): on the second wrong tap the guided replay runs instead of Incorrect Feedback 2; after it only the right
     submarine answers (o.didReplay is set). */
  async function strike(R, target, o = {}) {
    let wrong = 0, guided = false; W.expect = target;
    const idleAnim = o.idleAnim || (() => ANIM[R.idleL.kind](R)), idleLine = o.idleLine || R.idleL.line;
    for (let k = 0; ; k++) {
      if (o.guide) o.guide(k === 0);
      const only = wrong >= 3 || guided ? W.subAt(target) : null;
      /* from the 3rd miss (or after the guided replay) only the right submarine answers: the others grey out and the helper points
         at it, so it is clear what can be tapped; a tap on a grey one gets a soft "not this one" and the helper again (QA bug 26) */
      const point = () => { if (!only) return; W.dimOthers(only); W.ring(only); W.pulseSub(only); W.handTo(only.x, only.cy, .5); };
      point();
      const s = await W.waitTap({ nudge: o.nudge, onNudge: idleAnim, onIdle: () => { idleAnim(); note(idleLine, R.ost); }, onIdle2: () => { idleAnim(); note(idleLine, R.ost); }, only,
        onBlocked: b => { SFX.wrong(); W.nudgeNo(b); point(); } });
      SD.skip();
      if (s.v === target) { noteEnd(); W.clearHints(); if (R.unexplain) R.unexplain(); const r = await W.lock(s); SFX.right(); await W.fire(s, r); return wrong === 0; }
      wrong++;
      const red = await W.lock(s, 'red'); await W.wrong(s); red.remove(); W.clearHints();
      if (o.replay && wrong === 2) { await o.replay(); guided = o.didReplay = true; continue; }
      const fb = o.fb ? o.fb(wrong) : R.fbL[Math.min(wrong, 3) - 1];
      note(fb.line, R.ost);
      const shown = fb.anim ? fb.anim() : ANIM[fb.kind](R);   // (a promise when it takes time: Level 2's number line coming in, ~1.7 s)
      await Promise.all([shown, wait(.5)]);
    }
  }

  /* =====================================================================
     STORY — the storyboard told in ONE continuous underwater scene: the camera never cuts. The water is a WebGL
     canvas (js/water.js: refraction, caustics, god rays, depth blur); the Coast Guard ship is a silhouette at the
     surface; Meera speaks from a glass comms panel. The hook (before Level 1) is one short scene with her two lines;
     the ending (after Level 3) returns to the same water, with no words.
     ===================================================================== */
  const IMG = n => 'assets/img/story/' + n + '.webp';
  let WATER = null, waterP = null;
  /* the story's WebGL water: made once, while the title is still up (shaders compiled, the sea picture uploaded), so pressing Play
     doesn't stall on it (QA bug 5) — after the title's entrance, in an idle moment, so it doesn't stall that either (QA bug 1) */
  const waterReady = () => waterP || (waterP = (async () => {
    const k = Math.min(1, Math.max(.5, SD.stageScale() * (devicePixelRatio || 1)));   // as many pixels as the screen shows
    const cv = document.createElement('canvas'); cv.id = 'waterCv'; cv.width = Math.round(1920 * k); cv.height = Math.round(1080 * k); cv.style.display = 'none';
    $('#story').insertBefore(cv, $('#storyFx'));
    /* phones and tablets (SD.LOW): the full-resolution picture with the same slow camera drift and bubbles, not the WebGL water.
       The water there ran at half resolution, stretched 2-3× on a tablet's screen (blurry, QA), and full resolution is too much
       for their GPUs. */
    WATER = SD.LOW ? false : Water(cv) || false; if (WATER && !(await WATER.load(IMG('bg_under')))) WATER = false;
    return cv;
  })());
  SD.settled.then(() => new Promise(r => setTimeout(r, 1500))).then(SD.idle).then(waterReady);
  function storyKit(fade) {   // fade: the story fades in over the cockpit (part 2 and the ending come after a level)
    const st = $('#story'), bg = $('#storyBg'), cast = $('#cast'), sfx = $('#storyFx');
    st.classList.remove('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([st, bg, cast, sfx], { clearProps: 'all' });
    if (fade) gsap.set(st, { opacity: 0 });
    const K = { st, bg, cast, sfx, fade };   // (no tap-to-skip and no Skip button: the story always plays in order, QA bug 25)
    const mk = (tag, cls, css, parent = sfx) => { const d = document.createElement(tag); if (cls) d.className = cls; Object.assign(d.style, css || {}); parent.appendChild(d); return d; };
    K.mk = mk;
    K.img = (n, cls, css, parent) => { const i = mk('img', cls, css, parent); i.src = IMG(n); i.alt = ''; return i; };
    K.px = el => { const r = el.getBoundingClientRect(), s = $('#stage').getBoundingClientRect(), k = s.width / 1920; return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k, w: r.width / k, h: r.height / k }; };
    // the one scene: realistic water (WebGL) with the plain image as the fallback; a slow camera drift
    K.open = async () => {
      bg.style.backgroundImage = `url(${IMG('bg_under')})`;
      const cv = await waterReady();
      cv.style.display = WATER ? 'block' : 'none'; if (WATER) { Object.assign(WATER.state, { glow: 0, r: 1, g: 1, b: 1 }); WATER.start(); }
      K.cam = gsap.fromTo([cv, bg], { scale: 1.08 }, { scale: 1.02, duration: 30, ease: 'none' });
      if (K.fade) { gsap.set([cv, bg], { opacity: 1 }); await gsap.to(st, { opacity: 1, duration: .8, ease: 'power1.inOut' }); }   // over the cockpit: the water comes in with the overlay (no dark frame)
      else { gsap.set(st, { opacity: 1 }); gsap.fromTo([cv, bg], { opacity: 0 }, { opacity: 1, duration: .6 }); }   // the overlay is solid from the first frame; only the water fades in
      for (let i = 0; i < 9; i++) { const r = 4 + Math.random() * 9, b = mk('div', 'sx-bub', { left: 120 + Math.random() * 1680 + 'px', top: '1100px', width: 2 * r + 'px', height: 2 * r + 'px' });
        gsap.to(b, { y: -1250, x: (Math.random() - .5) * 120, duration: 7 + Math.random() * 6, delay: Math.random() * 5, repeat: -1, ease: 'none' }); }
    };
    K.close = () => { if (WATER) WATER.stop(); const cv = $('#waterCv'); if (cv) cv.style.display = 'none';
      gsap.killTweensOf([...sfx.querySelectorAll('*'), ...cast.querySelectorAll('*')]); if (K.cam) K.cam.kill(); };   // the story's looping bubbles and bobbing subs stop with it
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
      const who = L.who, side = who === 'riya' ? 'r' : 'l';
      const b = mk('div', `bubble ${who} sx-b ${side}`, {}, cast);
      b.innerHTML = `<span class="nm">${SCRIPT.WHO[who].name}</span><span class="txt"></span>`;
      if (who === 'narrator' || who === 'system') { for (const k in people) people[k].el.classList.add('dim'); }
      gsap.fromTo(b, { opacity: 0, y: 18, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .35, ease: 'back.out(2)' });
      if (extra) extra();
      await say(L, { bubble: b });
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
    return K;
  }

  /* the hook: one short scene before Level 1. Enemy submarines slip into our waters (Meera: h1); they fire missiles up at
     the ship, the water flushes red, ALERT (Meera: h2); then the cockpit frame closes in around the view. */
  async function hook() {
    SD.music('calm'); SD.ambience('waves');
    const K = storyKit(), { sfx, cast } = K;
    await K.open();   // (straight into the water: no sonar-room doors, QA bug 4)
    // the Coast Guard ship above us: a dark silhouette at the surface
    const ship = K.img('ship', 'sx-hull', {}); gsap.fromTo(ship, { x: -400 }, { x: 0, duration: 4, ease: 'power2.out' }); gsap.to(ship, { y: 5, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const subs = [];
    const sub = (x, y, i) => { const u = K.img('sub_bay', 'sx-sub', { left: x + 'px', top: y + 'px' });
      gsap.fromTo(u, { x: 1000, opacity: 0 }, { x: 0, opacity: 1, duration: 2.4, delay: .3 + i * .4, ease: 'power3.out',
        onComplete: () => { const p = K.px(u), r = K.mk('div', 'sx-ring', { left: p.x + 'px', top: p.y + 'px' }); gsap.fromTo(r, { scale: .2, opacity: .9 }, { scale: 2, opacity: 0, duration: 1, onComplete: () => r.remove() }); SFX.blip(); } });
      u.bob = gsap.to(u, { y: '+=8', duration: 1.6 + i * .2, yoyo: true, repeat: -1, ease: 'sine.inOut' }); subs.push(u); return u; };
    /* enemy submarines slip into our waters */
    sub(1180, 520, 0); sub(1520, 640, 1); sub(780, 440, 2);
    await wait(1);
    K.who('meera', 'determined');
    await K.say(S.h1);

    /* they fire missiles up at the ship: the water flushes red, ALERT */
    subs.forEach((u, i) => gsap.delayedCall(i * .35, () => { const p = K.px(u), m = K.img('missile_red', 'sx-mis', { left: p.x - 40 + 'px', top: p.y - 70 + 'px' }); SFX.launch(); K.trail(m);
      gsap.to(m, { x: -260 - i * 140, y: -620, rotation: -62, duration: 1.6, ease: 'power1.in', onComplete: () => m.remove() }); }));
    await wait(1.4);
    K.tint(1.5, .55, .5); SFX.alarm();
    const al = K.stamp('ALERT! ALERT!', 'red', 0); gsap.to(al, { opacity: .45, duration: .4, yoyo: true, repeat: -1, delay: .9 });
    K.who('meera', 'shocked');
    await K.say(S.h2, () => gsap.delayedCall(1.3, SFX.alarm));
    gsap.killTweensOf(al); gsap.to(al, { opacity: 0, duration: .3, onComplete: () => al.remove() });
    K.tint(1, 1, 1, 1); await wait(.5);

    /* into the game: the same water — the cockpit frame closes in around the view */
    SD.hush();
    SFX.swoosh(); SD.music('play'); SD.ambience('waves');
    gsap.to(cast, { opacity: 0, duration: .3 });
    await gsap.to(K.st, { opacity: 0, scale: 1.15, duration: .8, ease: 'power2.in' });
    K.close(); K.st.classList.add('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([K.st, K.bg, cast, sfx], { clearProps: 'all' });
    await W.sail(1.4);
  }

  /* ---- the ending: the same water, calm and bright, the route cleared (no words) ---- */
  async function storyEnd() {
    const K = storyKit(true);
    await K.open(); if (WATER) gsap.to(WATER.state, { glow: .6, duration: 2 });   // the light comes back
    const ship = K.img('ship', 'sx-hull', {}); gsap.fromTo(ship, { x: -500 }, { x: 260, duration: 6, ease: 'none' });
    for (let i = 0; i < 3; i++) { const fish = K.mk('div', 'sx-fish', { top: 360 + i * 120 + 'px' }); fish.innerHTML = '<i></i><i></i><i></i><i></i>'; gsap.fromTo(fish, { x: 2100 }, { x: -400, duration: 9 + i * 2, delay: i * .8, ease: 'none' }); }
    K.stamp('ROUTE CLEARED!', 'end', 0); SFX.tada();
    const COL = ['#ffd66b', '#7ff2ff', '#ff8fb1', '#9dff9a', '#ffffff', '#ffb070'];
    for (let i = 0; i < 40; i++) { const c = K.mk('div', 'sx-conf', { left: 200 + Math.random() * 1520 + 'px', top: '-30px', background: COL[i % COL.length] });
      gsap.to(c, { y: 700 + Math.random() * 400, x: (Math.random() - .5) * 240, rotation: (Math.random() - .5) * 900, opacity: 0, duration: 2.4 + Math.random() * 1.6, delay: .4 + Math.random() * .8, ease: 'power1.in', onComplete: () => c.remove() }); }
    await wait(3.6);
    // the game ends here: ROUTE CLEARED stays on the calm sea (no restart, no Play Again: QA bug 23)
    SD.music('calm'); SD.ambience('waves');
  }

  /* =====================================================================
     LEVEL 1 · launch as many opposite missiles (sheet L1 V3)
     The enemy submarine's missiles are positive (red), the defence system's negative (blue); they come into the top row.
     The bow cannon is the launcher of the other sign: each tap launches one missile into the launch bay above it (tap one in
     the bay to take it back), then FIRE. The same number: each one streaks to a missile that came and both are absorbed, 0 left.
     Any other number is a mistake, and it still fires: the pairs are absorbed; too few, and the missiles left over get through
     and hit the window (it cracks); too many, and ours are wasted. The enemy launches again and Incorrect Feedback 1, 2, 3 play
     in turn (the missiles that came are counted out loud on screen, 1, 2, 3 …); from the third on, the launcher stops at the
     right number, and from the fourth on FIRE stays off until the bay holds exactly that many (no loop of wrong volleys). No sinking. Row 1 is the teaching (the missiles come, the launcher activates) and the tutorial (the hand).
     ===================================================================== */
  const NAMED = new Set();   // the signs whose launcher label has been shown in this level
  async function launchRound(R, teach) {
    const n = Math.abs(R.give), given = Math.sign(R.give), mine = -given, room = 2;
    W.launcher(0); W.fireBtn('');
    await W.missiles(n, given);   // the missiles come towards the defence area
    if (teach) { await wait(.3); W.launcher(mine); await wait(.6); await say(S.l1a); await say(S.l1b); await wait(.2); }   // the launcher activates; Meera's two lines
    W.launcher(mine); W.bay(true); W.fireBtn('dim');
    W.strip(R.ost); SD.narrate(R.ost); await wait(.6);
    let strikes = 0, busy = false, tut = !!R.tutorial;   // tut: the hand shows what to tap
    const count = () => W.mslRow(1).length;
    const ANIM = {   // no incorrect animations in the sheet for Level 1: point at the count
      given: () => { W.mslPulse(W.mslRow(0), 0, .4); W.mslCount(W.mslRow(0), 0, .4); },   // the missiles that came glow one by one, counted 1, 2, 3 …
      launcher: () => { W.handTo(...pt('#launchHit')); if (!tut) gsap.delayedCall(2.6, () => W.hand(null)); },   // the launcher glows
      both: () => { ANIM.given(); ANIM.launcher(); },
    };
    const pt = sel => { const c = W.centreOf($(sel)); return [c.x, c.y]; };
    const guide = () => {   // the tutorial's glow: the launcher until there are enough, then FIRE (too many: the last one, to take back)
      if (!tut || busy) return;
      const k = count();
      if (k < n) W.handTo(...pt('#launchHit')); else if (k === n) W.handTo(...pt('#l1fire')); else { const m = W.mslRow(1)[k - 1]; W.handTo(m.x, m.y); }
    };
    // FIRE: every launched missile leaves the bay, meets one missile that came and both are absorbed
    const volley = async () => {
      SFX.launch(); const pairs = W.mslPairs().map(([p, q]) => p.row === 0 ? [p, q] : [q, p]), each = pairs.length > 6 ? .1 : .3;
      pairs.forEach(([g, m], i) => gsap.delayedCall(i * each, () => W.mslDefuse(g, m, pairs.length > 6)));
      await wait(pairs.length * each + .9);
    };
    const hitAt = i => ({ x: 600 + (i * 263) % 640, y: 480 + (i % 3) * 65 });   // where missiles that get through hit the window (clear of FIRE)
    const ok = await new Promise(resolve => {
      let calls = [];
      const nudge = () => { W.mslPulse(W.mslRow(0), 0, .18); gsap.fromTo('#cannon', { scale: 1 }, { scale: 1.06, duration: .3, yoyo: true, repeat: 3, transformOrigin: '50% 100%' }); };
      const arm = () => { calls.forEach(c => c.kill()); calls = [gsap.delayedCall(6, nudge), gsap.delayedCall(12, () => { nudge(); W.strip(R.ost); }), gsap.delayedCall(22, () => { nudge(); W.strip(R.ost); })]; };   // (the panel's text comes back)
      const stop = () => { calls.forEach(c => c.kill()); W.onLaunch(null); W.onMissile(null); W.onFire(null); };
      const locked = () => strikes >= 4 && count() !== n;   // after four mistakes FIRE works only with the right number
      const fireState = () => W.fireBtn(count() && !locked() ? 'lit' : 'dim');
      W.matching = true;
      W.onLaunch(() => {
        arm(); SD.skip(); if (busy) return; W.mslHintsOff();
        if (count() >= n + room || (strikes >= 3 && count() >= n)) return W.launcherNo();   // (after three mistakes it stops at the right number)
        const m = W.mslLaunch(mine, W.cannonShot()); fireState(); guide();
        if (!NAMED.has(mine)) { NAMED.add(mine); W.signTag(true); }   // the first launch of each sign in the level: the label in words (only then: QA)
      });
      W.onMissile(m => { if (m.row !== 1 || busy) return; arm(); SD.skip(); W.mslTakeBack(m, W.muzzle()); fireState(); guide(); });
      W.onFire(async () => {
        if (busy || !count()) return;
        if (locked()) { arm(); W.launcherNo(); ANIM.both(); return; }   // (it clunks and points at the count and the launcher)
        arm(); SD.skip(); W.hand(null); W.mslCountOff();
        if (count() === n) { stop(); noteEnd(); return resolve(true); }
        busy = true; strikes++; W.fireBtn('dim');
        // a wrong count still fires: the pairs are absorbed, and what is left over is the consequence
        const left = W.mslRemain(), through = left[0].row === 0;
        await volley(); W.mslBad(left); await wait(.7);
        if (through) await Promise.all(left.map((m, i) => wait(i * .2).then(() => W.mslHitUs(m, hitAt(i))).then(() => W.impact(hitAt(i).x, hitAt(i).y, i === 0))));   // too few: they get through and hit us
        else { await Promise.all(left.map((m, i) => wait(i * .12).then(() => W.mslFizzle(m)))); W.alarm(); }   // too many: ours are wasted
        await wait(.6);
        await W.missiles(n, given, true);   // the enemy launches again
        busy = false; fireState(); arm(); const fb = R.fbL[Math.min(strikes, 3) - 1]; ANIM[fb.kind](); guide(); note(fb.line, R.ost);
      });
      arm(); guide();
    });
    W.matching = false; W.hand(null); W.fireBtn(''); W.launcher(0); W.signTag(false);
    // Correct Animation: each launched missile leaves the bay, meets one missile that came and both are absorbed: all the pairs
    // disappear. The correct line is said as they cancel (not after), so a big volley doesn't hold the next mission up (QA bug 11).
    W.mslCountOff(); mark(strikes === 0);
    const said = note(R.ok);
    await volley(); W.bay(false); W.repair();   // (any cracks from this round seal up)
    W.reward({ big: strikes === 0, confetti: true, pip: W.pipDone, at: { x: 960, y: (W.CONFIG.SIG_Y1 + W.CONFIG.SIG_Y2) / 2 } });
    await said; await wait(.3); W.clearMissiles(); W.stripOff();
  }
  async function level1(start = 0) {
    LV = 'l1'; NAMED.clear(); W.dragRope(false); gsap.set('#scale', { opacity: 0 });   // Level 1 has no scale: it comes in the L2 transition
    await W.banner('', 'LEVEL 1', '');
    W.pips(D.L1.length, start);
    for (let r = start; r < D.L1.length; r++) {
      SD.where = { at: 'l1', round: r + 1 };
      await launchRound(D.L1[r], r === 0);
      W.pips(D.L1.length, r + 1);
      if (r < D.L1.length - 1) await W.sail();
    }
    await complete('l1', 'LEVEL 1 COMPLETE!');
  }

  /* =====================================================================
     LEVEL 2 · fire at the submarine with the smaller number (sheet L2 V3): our territory is the negative side, so the smaller
     number is closer to our border. The rope glides to each pair of positions (a 0 chip at the window's edge when 0 is out of view).
     ===================================================================== */
  async function level2(start = 0) {
    LV = 'l2'; await W.banner('', 'LEVEL 2', '');
    W.pips(D.L2.length, start);
    if (start === 0) {   // the intro: Meera's two lines; light sweeps left (smaller, closer to our border), then right (bigger, farther)
      SD.where = { at: 'l2', round: 1 };
      await W.panTo(0);
      const line = say(S.l2a); await wait(3.2);
      let off = await W.scan(-8, 'smaller · closer'); await wait(1.6); off();
      off = await W.scan(8, 'bigger · farther'); await line; await wait(.6); off();
      await say(S.l2b);
    }
    const kind = R => R.subs.every(v => v > 0) ? 'pos' : R.subs.every(v => v < 0) ? 'neg' : 'mix', extraDone = {};
    for (let r = start; r < D.L2.length; r++) {
      SD.where = { at: 'l2', round: r + 1 };
      const R = D.L2[r], guided = await l2round(R, { tut: r === 0, line: r === 0 });   // the number line: the first example only
      W.pips(D.L2.length, r + 1);
      if (guided && !extraDone[kind(R)]) { extraDone[kind(R)] = true; await W.sail(); await l2round(D.L2_EXTRA[kind(R)], { extra: true }); }   // one more like it, alone
      if (r < D.L2.length - 1) await W.sail();
    }
    gsap.set('#zchip', { visibility: '' });
    await complete('l2', 'LEVEL 2 COMPLETE!');
  }

  /* one Level 2 round. tut = the tutorial (the guiding glow); extra = the item after a guided replay (not scored, no replay).
     line = the number line is out (the first example only): the submarines sit above their numbers on it. Without it they float at
     random places with their numbers on them, and the child compares the numbers themselves; after a wrong tap the line comes in
     to show which number is smaller, then goes again for the shot (explain()); the guided replay brings it back the same way.
     Mistake 1: Incorrect Feedback 1 (+ the "◀ smaller · bigger ▶" tags). Mistake 2: the guided replay. Returns true when guided. */
  const lineOn = on => { gsap.to('#scale', { autoAlpha: on ? 1 : 0, duration: .5 }); gsap.set('#zchip', { visibility: on ? '' : 'hidden' }); };
  async function l2round(R, { tut, extra, line } = {}) {
    lineOn(line);
    await W.panFor(R.subs);   // (0 joins the view when it fits; without the line it is ready for the replay)
    if (extra) { W.strip(D.MORE, { big: true }); await Promise.all([SD.narrate(D.MORE), wait(1.4)]); }
    W.strip(R.ost); SD.narrate(R.ost); await W.spawn(R.subs, { stagger: .45, at: line ? null : skySpots(R.subs.length) });
    W.dragRope(!tut && line); await wait(.6);
    const o = {
      guide: tut && (async first => { const s = W.subAt(R.target); if (!s) return;   // the tutorial: the glow shows the smaller number, then its submarine
        if (first) { await W.handTo(W.X(R.target), W.LBL_Y + W.CONFIG.SCALE_DY, .5); W.pulseLbl(R.target); await wait(1.2); }
        if (W.waiting) W.handTo(s.x, s.cy, .8); }),
      fb: k => { const fb = R.fbL[Math.min(k, 3) - 1]; return { line: fb.line, anim: async () => { if (!line) await explain(R); ANIM[fb.kind](R); if (k === 1 && line) W.borderTag(true); } }; },
      replay: !tut && !extra && (() => replay(R)),
      nudge: 9,   // the inactivity hint shows the answer, so it waits 9 s (QA)
    };
    const first = await strike(R, R.target, o); W.dragRope(false);
    if (!extra) mark(first);
    W.reward({ big: first, pip: extra ? null : W.pipDone });
    await wait(.5); W.strip(R.show, { expr: true }); await Promise.all([SD.narrate(R.show), wait(1.4)]);   // Correct Animation: show −12 < −10
    await note(R.ok);
    await wait(1.4); W.borderTag(false); await W.clearSubs(); W.stripOff();
    return !!o.didReplay;
  }
  /* a wrong tap without the number line: the line comes in, the two numbers glow (the bigger, then the smaller) and a light runs
     from the bigger to the smaller, towards "◀ smaller". The child can answer as soon as the light has run (about 1.7 s): the line
     stays up to look at while they choose (QA bug 21) and goes with the right tap, instead of holding the screen for ~9 s and then
     vanishing on its own (QA bug 26). */
  async function explain(R) {
    const t = R.target, u = R.subs.find(v => v !== t);
    lineOn(true); await wait(.5);
    W.borderTag(true); W.pulseLbl(u); await wait(.6);
    W.pulseLbl(t); W.sweepTo(u, t); await wait(.6);
    R.unexplain = () => { R.unexplain = null; W.borderTag(false); lineOn(false); };
  }
  /* the guided replay (Level 2, the second wrong tap): the question in the two steps the child does, wrong options blocked.
     A · compare: both submarines grey out, only the two numbers answer ("Check which is smaller: −10 or −12?"); a wrong number
         → a light runs from it to the other, towards our border's side, and the question again.
     B · connect: "The smaller number is −12…", then only the submarine above −12 comes back, its sonar line lit; the other
         stays grey and does not answer ("Check which submarine is close to our border."). Without the line (after the first
         example) the line comes in for A and goes again for B: the child fires at the submarine itself. */
  async function replay(R) {
    const t = R.target, u = R.subs.find(v => v !== t), free = W.subs().some(s => s.free);
    if (free) { lineOn(true); await wait(.5); }   // the number line comes back to help
    W.dragRope(false); W.borderTag(true); W.subs().forEach(s => s.d.classList.add('dim'));
    note(R.fbL[1].line);
    while (await W.waitLabel(R.subs) !== t) { SFX.wrong(); W.sweepTo(u, t); await wait(1.4); W.clearHints(); W.subs().forEach(s => s.d.classList.add('dim')); }
    // the right number: its line is said while the submarine comes back (the child can fire after ~1.5 s, not after the whole line)
    SFX.ding(); W.pulseLbl(t); note(R.fbL[2].line, R.ost); await wait(1.2);
    if (free) { W.clearHints(); W.borderTag(false); lineOn(false); await wait(.3); }   // the line goes: now the shot
    const s = W.subAt(t); s.d.classList.remove('dim'); W.lineLit(t, true); W.pulseTag(s); SFX.ping();
  }

  /* =====================================================================
     LEVEL 3 · fire from the smaller number to the bigger (sheet L3 V3). The submarines float at random places in the water
     with their numbers on them (the rope is put away); each hit gets its firing number 1, 2, 3, 4.
     ===================================================================== */
  // Level 2 without the number line: random spots high in the water, apart, clear of the line when the replay brings it back
  function skySpots(n) {
    const out = [];
    for (let k = 0; k < 500 && out.length < n; k++) { const x = 380 + Math.random() * 1160, y = 272 + Math.random() * 90; if (out.every(p => Math.abs(p.x - x) > 420)) out.push({ x, y }); }   // (y: clear of the mission panel above)
    while (out.length < n) out.push({ x: 560 + out.length * 600, y: 310 });
    return out;
  }
  function scatter(n) {   // random spots in the open water, apart from each other and clear of the cannon
    const out = [];
    for (let k = 0; k < 2000 && out.length < n; k++) {
      const x = 340 + Math.random() * 1240, y = 262 + Math.random() * 270;   // (clear of the mission panel above)
      if (y > 420 && Math.abs(x - 960) < 280) continue;
      if (out.every(p => Math.abs(p.x - x) > 270 || Math.abs(p.y - y) > 175)) out.push({ x, y });
    }
    while (out.length < n) out.push({ x: 360 + out.length * 400, y: 320 });
    return out;
  }
  async function orderRound(R, tut) {   // tut: the level's first round, the glow shows the submarine to fire next
    const seq = [...R.subs].sort((a, b) => a - b);
    W.strip(R.ost, { big: true }); W.orderRow(seq.length);   // the empty places the numbers will fill
    await wait(.6);
    for (let i = 0; i < seq.length; i++) {
      const next = seq[i], pulseNext = () => { W.pulseSub(W.subAt(next)); W.pulseTag(W.subAt(next)); };
      const first = await strike(R, next, {
        fb: k => k === 1 ? { line: R.fbL[0].line, anim: () => {} }   // the wrong submarine shakes (W.wrong)
          : k === 2 ? { line: R.fbL[1].line, anim: () => W.subs().forEach((s, j) => W.pulseTag(s, j * .08)) }   // the numbers left pulse
          : { line: D.startWith(next), anim: pulseNext },   // "Select the submarine with −12." and it pulses
        idleAnim: pulseNext, idleLine: R.idleL.line,   // the smallest number left pulses
        guide: tut && (() => { const s = W.subAt(next); if (s) W.handTo(s.x, s.cy, .6); }) });
      mark(first);   // stars count each pick (one slip no longer costs the whole mission)
      await W.orderChip(next, W.lastHit);   // its number pops up and flies into the next place in the row
    }
    await W.orderDone();   // the row is in order: −12 < −9 < −6 < −3
    if (R.cheer) W.strip(R.cheer, { big: true });   // ROUTE CLEARED! / ALL TARGETS CLEARED!
    W.reward({ big: !!R.cheer, confetti: true, pip: W.pipDone, at: { x: 960, y: 300 } });
    await wait(.5); await note(R.ok);
    await wait(1.4); W.clearOrder(); await W.clearSubs(); W.stripOff();
  }
  async function level3(start = 0) {
    LV = 'l3'; W.dragRope(false); await W.panTo(0, .4); gsap.to('#scale', { autoAlpha: 0, duration: .5 });
    await W.banner('', 'LEVEL 3', '');   // "Level title appears."
    W.pips(D.L3.length, start);
    for (let r = start; r < D.L3.length; r++) {
      SD.where = { at: 'l3', round: r + 1 };
      const R = D.L3[r];
      await W.spawn(R.subs, { at: scatter(R.subs.length), stagger: .5 });   // the submarines appear at random places
      if (r === 0) { W.strip(D.L3_TEACH.ost, { big: true }); await wait(.4); await say(S.l3a); await wait(.6); }   // Meera's intro
      await orderRound(R, r === 0);
      W.pips(D.L3.length, r + 1);
      if (r < D.L3.length - 1) await W.sail();
    }
    // Level Completion: the sea calms, large confetti and the completion badge
    W.reward({ big: true, confetti: true, at: { x: 960, y: 320 } }); await wait(1.2);
    await complete('l3', D.L3_END.ost);
    await storyEnd();   // (the number line stays hidden: it used to flash on for a moment here)   // the story's ending (storyboard row 12)
  }

  /* ---------- level complete card (the completion badge): title + stars ----------
     Every finished level gets all three stars (the reviewers' call). How many answers were right first time is still
     recorded in GAME_RESULT (L1 / L2: each mission; L3: each submarine picked). */
  async function complete(lv, title) {
    const sc = SCORE[lv] || [], firsts = sc.filter(Boolean).length, n = sc.length || 1, stars = 3;
    (window.GAME_RESULT = window.GAME_RESULT || {})[lv] = { stars, firstTry: firsts, missions: n };
    $('#dt').innerHTML = '<svg viewBox="0 0 820 220"><path id="dArc" d="M120 136 Q410 64 700 136" fill="none"/><text><textPath href="#dArc" startOffset="50%" text-anchor="middle"></textPath></text></svg>';
    $('#dt textPath').textContent = title;   // (on the ribbon's arch)
    $('#ds').textContent = ''; $('#dchain').innerHTML = ''; $('#dcta').textContent = 'Next';
    $('#dstars').innerHTML = [0, 1, 2].map(i => `<img src="assets/img/${i < stars ? 'star_gold' : 'star_silver'}.webp" class="${i < stars ? '' : 'off'}">`).join('');
    const d = $('#done'); d.classList.remove('hidden'); SFX.tada();
    const tp = $('#dt text'), room = 560; if (tp.getComputedTextLength() > room) tp.style.fontSize = Math.floor(54 * room / tp.getComputedTextLength()) + 'px';   // a long title shrinks to stay on the ribbon
    // the card glides in and settles (no overshoot); the stars pop in place; Next stays still (only its glow pulses) and nothing
    // shakes the screen meanwhile (QA bug 15)
    gsap.fromTo('#done .card', { scale: .86, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'power2.out' });
    gsap.fromTo('#dstars img', { scale: 0 }, { scale: 1, duration: .4, stagger: .18, delay: .4, ease: 'back.out(1.6)', onStart: () => SFX.pop() });
    await new Promise(r => { $('#dcta').onclick = () => { $('#dcta').onclick = null; SFX.tap(); r(); }; });   // stays until Next (QA bug 15)
    await gsap.to('#done .card', { scale: .94, opacity: 0, duration: .3, ease: 'power1.in' }); d.classList.add('hidden');
    if (lv !== 'l3') await W.sail();   // (after the last level the ending follows straight away)
  }

  /* ---------- run: the hook → Level 1 → Level 2 → Level 3 → the ending (which stays) ---------- */
  // every line a part can say (Meera's intro lines, the narrated instructions, correct lines, hints, inactivity lines)
  const linesOf = k => {
    const R = { hook: [], l1: D.L1, l2: [...D.L2, ...Object.values(D.L2_EXTRA)], l3: D.L3 }[k] || [];
    const meera = { hook: [S.h1, S.h2], l1: [S.l1a, S.l1b], l2: [S.l2a, S.l2b], l3: [S.l3a] }[k] || [];
    return [...meera.map(L => L && L.text), ...(k === 'l2' ? [D.MORE] : []), ...R.flatMap(x => [x.ost, x.ok, x.show, x.idleL && x.idleL.line, ...(x.fbL || []).map(f => f.line)])].filter(Boolean);
  };
  async function run() {
    const r = parseInt(Q.get('round') || '1', 10) - 1;
    const at = Q.get('at') || 'hook';
    const order = ['hook', 'l1', 'l2', 'l3'];
    for (let i = Math.max(0, order.indexOf(at)); i < order.length; i++) {
      const k = order[i], st = k === at ? r : 0;
      SD.where = { at: k, round: st + 1 };
      // this part's lines a little later (the line wanted first loads on its own, never behind its own prefetch), the next part's after that
      gsap.delayedCall(5, () => SD.prefetchVO(linesOf(k))); if (order[i + 1]) gsap.delayedCall(12, () => SD.prefetchVO(linesOf(order[i + 1])));
      if (k !== 'hook' && k === at) { SD.music('play'); SD.ambience('waves'); }
      if (k === 'hook') await hook();
      if (k === 'l1') await level1(st);
      if (k === 'l2') { await W.scaleIntro(); await level2(st); }   // the number line switches on for Level 2
      if (k === 'l3') await level3(st);
    }
    window.GAME_DONE = true;   // (the ending stays on screen: the game does not go back to the title)
  }
  $('#btnSpeak').onclick = () => { const l = SD.lastLine; if (l) l.o.narr ? SD.narrate(l.x) : say(l.x, l.o.bubble ? {} : l.o); };
  $('#start').onclick = async () => {
    if ($('#start')._go) return; $('#start')._go = true;
    SD.titleSettled(); SD.audioOn(); SFX.ping();
    if (!sea.paused) gsap.to(sea, { volume: 0, duration: 1.6, onComplete: () => sea.pause() });   // the sea fades as the story opens
    // Play was the first press: the name is said now (QA bug 24) and the story waits for it; said before: it fades out
    const named = !heard && !SD.MUTE && Q.get('autostart') !== '1' ? new Promise(r => { const p = sayName(true); if (!p) return r(); p.catch(r); nameVo.addEventListener('ended', r, { once: true }); setTimeout(r, 3500); }) : null;
    if (!named && !nameVo.paused) gsap.to(nameVo, { volume: 0, duration: .4, onComplete: () => nameVo.pause() });
    const boot = $('#boot');
    if ((Q.get('at') || 'hook') === 'hook') { $('#story').classList.remove('hidden'); gsap.set('#story', { opacity: 1 }); }   // the story's solid backdrop goes up under the title first: the game never shows through
    await Promise.all([gsap.to('#title', { opacity: 0, duration: .5 }), SD.ready, named]);   // never start mid-load: that is where jumps used to hitch
    $('#title').classList.add('hidden'); gsap.killTweensOf(['#start', '#title .art']);   // the title's loops stop with it
    if (boot) await gsap.to(boot, { opacity: 0, duration: .45, onComplete: () => boot.remove() });
    window.SD_RUN = run();
  };
  /* the title's sound: a soothing bow-wave loop (assets/sfx/cover_sea.ogg) under Meera saying the game's name (line 'title').
     Both are tried as soon as the title is up; a browser plays no sound before the page's first click / tap / key press, so where it
     says no, the first press anywhere starts them (on Play too: the name is said as the title fades). Every later tap on the cover
     says the name again (from the start). Both fade as the game begins. (QA bug 24) */
  const onTitle = () => !$('#title').classList.contains('hidden');
  const SEA = .5, sea = new Audio('assets/sfx/cover_sea.ogg'), nameVo = new Audio((SCRIPT.lang === 'hi' ? 'assets/vo/hi/' : 'assets/vo/') + 'title.ogg');
  sea.loop = true; sea.volume = 0; sea.preload = nameVo.preload = 'auto';
  let heard = false; nameVo.addEventListener('playing', () => { heard = true; });
  const seaLevel = () => nameVo.paused ? SEA : SEA * .45;   // the sea dips under the voice
  const seaOn = () => { if (SD.MUTE || !sea.paused || !onTitle()) return; sea.play().then(() => gsap.to(sea, { volume: seaLevel(), duration: 2.5 })).catch(() => {}); };
  const sayName = again => {
    if (SD.MUTE || !onTitle()) return;
    if (!nameVo.paused) { if (!again || nameVo.currentTime < .6) return; nameVo.pause(); }   // a tap while it is being said: from the start (not for a double tap)
    nameVo.currentTime = 0; nameVo.volume = 1;
    const p = nameVo.play(); p.then(() => { if (!sea.paused) gsap.to(sea, { volume: seaLevel(), duration: .3 }); }).catch(() => {}); return p;
  };
  nameVo.onended = () => { if (!sea.paused && onTitle()) gsap.to(sea, { volume: SEA, duration: 1.2 }); };
  if (Q.get('autostart') !== '1') {
    // the first press anywhere (pointer, touch or key; on touch the sound is allowed only once the finger lifts, hence pointerup /
    // touchend / click too) and every tap on the cover after it (one tap fires several of these: only its first restarts the name)
    const first = e => { if (e.target && e.target.closest && e.target.closest('#start')) return; sayName(e.type === 'pointerdown'); seaOn(); };
    ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(k => addEventListener(k, first, true));
    addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('#start')) return; sayName(true); seaOn(); });
  }
  SD.onHold(on => { for (const a of [sea, nameVo]) { if (on && !a.paused) { a._held = true; a.pause(); } else if (!on && a._held) { a._held = false; if (onTitle()) a.play().catch(() => {}); } } });   // (the game paused: QA bugs 2, 3)
  /* the title comes all at once (QA): a still of the whole cover, logo and Play included, shows from the first frame (css/cover.css) and
     Play works from then on; once its pictures are all in and decoded the moving cover fades in over the still, from the same
     frame, so nothing drops or pops in. Then the name is said and the rest of the game loads (core.js) */
  const reveal = () => {
    const t = $('#title'); if (!t.classList.contains('wait') || $('#start')._go) return; t.classList.remove('wait', 'prep'); SD.titleShown();
    gsap.fromTo('#start', { scale: 1 }, { scale: 1.06, duration: .8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .5, immediateRender: false });   // Play breathes
    if (Q.get('autostart') !== '1') { seaOn(); gsap.delayedCall(.4, () => sayName()); }
    gsap.delayedCall(1, SD.titleSettled);
  };
  if (Q.get('autostart') === '1') reveal();
  else {
    const pics = [...new Set([...document.querySelectorAll('#title img')].map(i => i.src)
      .concat(['sky', 'islands', 'sea_base', 'waves_far', 'waves_mid', 'waves_near'].map(n => new URL('assets/img/cover/' + n + '.webp', location.href).href)))];
    pics.push(new URL('assets/img/cover/play_button.webp', location.href).href);
    const keep = pics.map(u => { const i = new Image(); i.src = u; return i; });
    // no time limit: until every picture is in, the cover's still is the cover (Play works on it), so a slow tablet never sees the
    // moving cover arrive in pieces (QA). Then one invisible paint (.prep: the decodes) and it fades in.
    Promise.all(keep.map(i => i.decode().catch(() => {})))
      .then(() => { $('#title').classList.add('prep'); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))); })
      .then(() => requestAnimationFrame(reveal));
  }
  if (window.SD_PLAY) $('#start').onclick();   // (Play was tapped on the still, before this script ran: index.html)
  $('#start').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#start').onclick(); } };
  if (Q.get('autostart') === '1') {   // a QA / editor jump: a quiet sonar screen covers the page while it loads, then the level fades in
    const boot = document.createElement('div'); boot.id = 'boot'; boot.innerHTML = '<i></i><i></i><span>SONAR CONTACT…</span>'; $('#stage').appendChild(boot);
    gsap.set('#title', { opacity: 0 }); $('#start').onclick();
  }
})();
