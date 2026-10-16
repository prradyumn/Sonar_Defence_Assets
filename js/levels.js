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
     STORY — the storyboard as clean motion graphics: one idea per scene on a calm background, glass UI in code,
     waist-up characters that slide in to speak. Part 1 = rows 1–6, part 2 = rows 7–11 (both play here, before the
     levels), the ending (row 12) plays after the final mission. ?at=hook&scene=2 starts at part 2, scene=3 at the dive.
     ===================================================================== */
  const IMG = n => 'assets/img/story/' + n + '.webp';
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
    // background: a quick cross-fade, then a very slow push-in
    const iris = mk('div', 'sx-iris', {}, st);
    K.scene = async (name, push = 1.06, from = [960, 540], to = from) => {
      const first = !bg.style.backgroundImage;
      if (!first) {   // the sonar disc floods out of the focal point…
        SFX.swoosh(); gsap.set(iris, { left: from[0], top: from[1], scale: 0, opacity: 1 });
        await gsap.to(iris, { scale: 11.5, duration: .45, ease: 'power3.in' });   // a small disc scaled up: one cheap layer
      }
      sfx.innerHTML = ''; gsap.killTweensOf(bg); bg.style.backgroundImage = `url(${IMG(name)})`;
      gsap.set([bg, sfx], { opacity: 1 }); gsap.fromTo(bg, { scale: 1.02 }, { scale: push, duration: 16, ease: 'none' });
      if (first) gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: .5 });
      else { gsap.set(iris, { left: to[0], top: to[1] }); gsap.to(iris, { scale: 0, duration: .5, ease: 'power3.out' }); }   // …and drains into the next one
      if (/under/.test(name)) K.bubbles();
    };
    // a few slow bubbles in the underwater scenes (secondary motion, nothing busy)
    K.bubbles = () => { for (let i = 0; i < 9; i++) { const r = 4 + Math.random() * 9, b = mk('div', 'sx-bub', { left: 120 + Math.random() * 1680 + 'px', top: '1100px', width: 2 * r + 'px', height: 2 * r + 'px' });
      gsap.to(b, { y: -1250, x: (Math.random() - .5) * 120, duration: 7 + Math.random() * 6, delay: Math.random() * 5, repeat: -1, ease: 'none' }); } };
    // a missile leaves a short trail of bubbles
    K.trail = (m, every = .08, n = 14) => { for (let i = 0; i < n; i++) gsap.delayedCall(i * every, () => { if (!m.isConnected) return; const r = m.getBoundingClientRect(), stg = $('#stage').getBoundingClientRect(), k = stg.width / 1920;
      const b = mk('div', 'sx-bub small', { left: (r.left + r.width * .2 - stg.left) / k + 'px', top: (r.top + r.height / 2 - stg.top) / k + 'px' }); gsap.to(b, { y: -30 - Math.random() * 30, scale: 1.8, opacity: 0, duration: .9, onComplete: () => b.remove() }); }); };
    // characters: still waist-up expressions; whoever speaks is up front, the other dims
    const people = {};
    K.who = (who, look, side) => {
      let p = people[who];
      if (!p) {
        p = people[who] = { el: mk('div', 'sx-char ' + who, {}, cast) }; p.im = mk('img', '', {}, p.el); p.im.alt = '';
        gsap.set(p.el, { x: who === 'riya' ? 520 : -520, opacity: 0 });
      }
      const src = IMG(who + '_' + look);
      if (!p.im.src.endsWith(src)) { if (p.on) gsap.fromTo(p.im, { scale: .96 }, { scale: 1, duration: .25, ease: 'back.out(3)' }); p.im.src = src; }
      if (!p.on) { p.on = true; gsap.to(p.el, { x: 0, opacity: 1, duration: .6, ease: 'back.out(1.3)' }); }
      for (const k in people) people[k].el.classList.toggle('dim', k !== who);
      return p;
    };
    K.leave = (who) => { const p = people[who]; if (!p || !p.on) return; p.on = false; gsap.to(p.el, { x: who === 'riya' ? 520 : -520, opacity: 0, duration: .4, ease: 'power2.in' }); };
    K.leaveAll = () => Object.keys(people).forEach(K.leave);
    // a line: the speaker's bubble (or the glass caption for the narrator / the system voice)
    K.say = async (L, extra) => {
      K.chk();
      const who = L.who, side = who === 'riya' ? 'r' : 'l';
      const b = mk('div', `bubble ${who} sx-b ${side}`, {}, cast);
      b.innerHTML = `<span class="nm">${SCRIPT.WHO[who].name}</span><span class="txt"></span>`;
      const p = people[who];   // sit just past the speaker (a pointing arm reaches far), never on top of them
      if (p && p.on) {
        const stg = $('#stage').getBoundingClientRect(), k = stg.width / 1920, r = p.im.getBoundingClientRect();
        if (side === 'l') b.style.left = Math.min(1180, Math.max(420, (r.right - stg.left) / k - 30)) + 'px';
        else b.style.right = Math.min(1180, Math.max(420, (stg.right - r.left) / k - 30)) + 'px';
      }
      if (who === 'narrator' || who === 'system') { for (const k in people) people[k].el.classList.add('dim'); }
      gsap.fromTo(b, { opacity: 0, y: 18, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .35, ease: 'back.out(2)' });
      const tn = gsap.fromTo('#tapNext', { opacity: 0 }, { opacity: .85, duration: .4, delay: 1.8 });
      if (extra) extra();
      await say(L, { bubble: b });
      tn.kill(); gsap.set('#tapNext', { opacity: 0 });
      await gsap.to(b, { opacity: 0, y: -8, duration: .2 }); b.remove();
    };
    // big glass stamp for the on-screen text
    K.stamp = (text, cls = '', hold = 1.5) => {
      const o = mk('div', 'sx-stamp ' + cls); SFX.ping();
      o.innerHTML = [...text].map(c => c === ' ' ? '<span>&nbsp;</span>' : `<span>${c}</span>`).join('') + '<i class="sheen"></i>';
      const L = o.querySelectorAll('span');
      const tl = gsap.timeline();
      tl.fromTo(L, { y: 46, scale: .4, opacity: 0, rotation: () => (Math.random() - .5) * 24 }, { y: 0, scale: 1, opacity: 1, rotation: 0, duration: .42, stagger: .035, ease: 'back.out(2.6)' })
        .fromTo(o.querySelector('.sheen'), { xPercent: -120, opacity: 1 }, { xPercent: 360, duration: .7, ease: 'power2.inOut' }, '-=.1').set(o.querySelector('.sheen'), { opacity: 0 });
      if (hold) tl.to(L, { y: -24, opacity: 0, duration: .3, stagger: .015, ease: 'power2.in' }, '+=' + hold);
      o.tl = tl; return o;
    };
    // the glass screen (on the control-room wall, or floating underwater): a −8 … +8 scale with 0 glowing
    K.screen = (css) => {
      const s = mk('div', 'sx-screen', css);
      let h = '<div class="bar"></div>';
      for (let v = -8; v <= 8; v++) h += `<i class="${v ? '' : 'z'}" style="left:${50 + (v + 8) * 46}px"></i><b class="${v < 0 ? 'n' : v > 0 ? 'p' : 'z'}" style="left:${50 + (v + 8) * 46}px">${f(v)}</b>`;
      s.innerHTML = h + '<i class="sheen"></i>';
      gsap.fromTo(s, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .45, ease: 'back.out(1.6)' });
      gsap.fromTo(s.querySelector('.sheen'), { xPercent: -120, opacity: 1 }, { xPercent: 360, duration: .9, delay: .2, ease: 'power2.inOut', onComplete() { this.targets()[0].style.opacity = 0; } });
      gsap.fromTo(s.querySelector('.bar'), { scaleX: 0 }, { scaleX: 1, duration: .55, delay: .15, ease: 'power2.out' });
      gsap.fromTo(s.querySelectorAll('i,b'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .25, stagger: { each: .02, from: 'center' }, delay: .3 });
      s.x = v => 50 + (v + 8) * 46;
      s.zero = () => gsap.fromTo(s.querySelectorAll('.z'), { scale: 1 }, { scale: 1.5, duration: .3, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      s.blip = (v, y = 90) => { const d = mk('div', 'blip', { left: s.x(v) + 'px', top: y + 'px' }, s); gsap.fromTo(d, { scale: 0 }, { scale: 1, duration: .35, ease: 'back.out(3)' }); SFX.blip(); return d; };
      s.toZero = (v, cls) => { const a = mk('div', 'sx-dist ' + cls, { left: Math.min(s.x(0), s.x(v)) + 'px', width: Math.abs(s.x(v) - s.x(0)) + 'px' }, s); a.innerHTML = `<span>${Math.abs(v)}</span>`;
        gsap.fromTo(a, { scaleX: 0, transformOrigin: v < 0 ? '0% 50%' : '100% 50%' }, { scaleX: 1, duration: .6, ease: 'power2.out' }); return a; };
      return s;
    };
    return K;
  }

  async function hook() {
    SD.music('calm'); SD.ambience('waves');
    const K = storyKit(), { bg, sfx, cast } = K, SCENE = Q.get('at') === 'hook' ? +(Q.get('scene') || 1) : 1;
    try {
      if (SCENE < 2) {
        /* ---- 1 · a calm sea, the Coast Guard ship on patrol; three enemy submarines slip in underwater and take positions ---- */
        await K.scene('bg_sea', 1.05);
        const ship = K.img('ship', 'sx-ship', {});
        gsap.fromTo(ship, { x: -700 }, { x: 0, duration: 2.4, ease: 'power2.out' });
        gsap.to(ship, { y: 6, rotation: .8, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        const subs = [[1060, 560], [1420, 640], [760, 700]].map(([x, y], i) => {
          const u = K.img('sub_bay', 'sx-sub', { left: x + 'px', top: y + 'px' });
          gsap.fromTo(u, { x: 900, opacity: 0 }, { x: 0, opacity: .92, duration: 2.6, delay: .6 + i * .45, ease: 'power3.out',
            onComplete: () => { const r = K.mk('div', 'sx-ring', { left: x + 110 + 'px', top: y + 50 + 'px' }); gsap.fromTo(r, { scale: .2, opacity: .9 }, { scale: 2, opacity: 0, duration: 1, onComplete: () => r.remove() }); SFX.blip(); } });
          gsap.to(u, { y: 8, duration: 1.6 + i * .2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          return u;
        });
        await K.say(S.n1);

        /* ---- 2 · underwater: the subs launch missiles towards the ship · cut to the control room: alarm ---- */
        await K.scene('bg_under', 1.04, [1200, 660], [900, 820]);
        [[260, 760], [760, 860], [1260, 780]].forEach(([x, y], i) => {
          const u = K.img('sub_bay', 'sx-sub big', { left: x + 'px', top: y + 'px' }); gsap.to(u, { y: 8, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          gsap.delayedCall(.5 + i * .35, () => { const m = K.img('missile_red', 'sx-mis', { left: x + 190 + 'px', top: y - 30 + 'px' }); SFX.launch();
            gsap.to(m, { x: 520, y: -720, rotation: -50, duration: 1.4, ease: 'power1.in' }); K.trail(m); });
        });
        await wait(2.2); K.chk();
        await K.scene('bg_room', 1.03, [1500, 120], [750, 300]);
        const alarm = K.mk('div', 'alarmglow'); gsap.to(alarm, { opacity: 1, duration: .4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        SFX.alarm(); const al = K.stamp('ALERT! ALERT!', 'red', 0);
        gsap.to(al, { opacity: .45, duration: .4, yoyo: true, repeat: -1, delay: .9 });
        await K.say(S.a2, () => gsap.delayedCall(1.3, SFX.alarm));
        gsap.killTweensOf(al); gsap.to(al, { opacity: 0, duration: .3 });

        /* ---- 3 · Meera sees the incoming missiles on the navigation screen ---- */
        const scr = K.screen({});
        const dots = [-7, -4, 6, 3].map((v, i) => { const d = K.mk('div', 'rmis', { left: scr.x(v) + 'px', top: '40px' }, scr); gsap.to(d, { top: 110, left: scr.x(v * .6), duration: 4, delay: i * .2, ease: 'none' }); return d; });
        K.who('meera', 'shocked');
        await K.say(S.m3);

        /* ---- 4 · contact the defence station ---- */
        K.who('meera', 'determined');
        scr.zero();
        const com = K.mk('div', 'sx-comms'); com.innerHTML = '<i></i><i></i><i></i><span>DEFENCE STATION</span>';
        gsap.fromTo(com, { x: 260, opacity: 0 }, { x: 0, opacity: 1, duration: .45, ease: 'power3.out' });
        gsap.to(com.querySelectorAll('i'), { opacity: .2, duration: .3, stagger: .15, yoyo: true, repeat: -1 });
        K.stamp('CONTACT DEFENCE STATION');
        await K.say(S.m4, () => gsap.delayedCall(.6, () => { SFX.doorBeep(); }));
        gsap.to(alarm, { opacity: 0, duration: .5 }); gsap.killTweensOf(alarm);
        K.leaveAll();

        /* ---- 5 · the defence system activates: the launcher rises and turns into position ---- */
        await K.scene('bg_under', 1.03, [750, 300], [960, 860]);
        const ln = K.mk('div', 'sx-launcher'); const base = K.img('launcher_base', 'base', {}, ln), barrel = K.img('launcher_barrel', 'barrel', {}, ln);
        gsap.fromTo(ln, { y: 360 }, { y: 0, duration: .8, ease: 'back.out(1.4)' }); SFX.doorSlide(1);
        gsap.fromTo(barrel, { rotation: 0 }, { rotation: -32, duration: 1.2, delay: .7, ease: 'power2.inOut', onStart: () => SFX.clunk() });
        const reds = [[1160, 260], [1420, 180], [1660, 300]].map(([x, y], i) => { const m = K.img('missile_red', 'sx-mis', { left: x + 'px', top: y + 'px' }); gsap.set(m, { rotation: 155 });
          gsap.to(m, { x: -120, y: 60, duration: 6, ease: 'none' }); return m; });
        K.stamp('DEFENCE SYSTEM READY');
        await K.say(S.d5);

        /* ---- 6 · sonar scans the missiles, target rings lock on, 0 glows → counterattack ---- */
        for (let i = 0; i < 3; i++) { const w = K.mk('div', 'sx-wave'); gsap.fromTo(w, { scale: .2, opacity: .9 }, { scale: 3.2, opacity: 0, duration: 1.6, delay: i * .4, onComplete: () => w.remove() }); }
        SFX.ping();
        reds.forEach((m, i) => gsap.delayedCall(.6 + i * .35, () => { const r = K.img('../reticle', 'sx-lock', {}); const b = m.getBoundingClientRect(), stg = $('#stage').getBoundingClientRect(), k = stg.width / 1920;
          Object.assign(r.style, { left: ((b.left + b.width / 2 - stg.left) / k) + 'px', top: ((b.top + b.height / 2 - stg.top) / k) + 'px' }); gsap.fromTo(r, { scale: 2, rotation: -90, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .35, ease: 'back.out(2)' }); SFX.lock();
          gsap.to(r, { x: -120 * (1 - i * .1), y: 60, duration: 5, ease: 'none' }); }));
        const zero = K.mk('div', 'sx-zero'); zero.textContent = '0'; gsap.fromTo(zero, { scale: 0 }, { scale: 1, duration: .4, delay: 1.6, ease: 'back.out(3)' });
        gsap.to(zero, { scale: 1.2, duration: .5, yoyo: true, repeat: -1, delay: 2, ease: 'sine.inOut' });
        K.who('meera', 'determined');
        K.stamp('TARGETS CONFIRMED!');
        await K.say(S.m6);
        // the counterattack: blue missiles meet the red ones
        reds.forEach((m, i) => gsap.delayedCall(i * .25, () => {
          const b = K.img('missile_blue', 'sx-mis', { left: '920px', top: '700px' }); SFX.launch(); gsap.set(b, { rotation: -40 }); K.trail(b, .05, 12);
          const tb = m.getBoundingClientRect(), stg = $('#stage').getBoundingClientRect(), k = stg.width / 1920;
          gsap.to(b, { left: (tb.left - stg.left) / k, top: (tb.top - stg.top) / k, duration: .7, ease: 'power1.in', onComplete: () => { b.remove(); m.remove(); SFX.boom(); const p = K.mk('div', 'sx-ring hit', { left: (tb.left - stg.left) / k + 60 + 'px', top: (tb.top - stg.top) / k + 20 + 'px' }); gsap.fromTo(p, { scale: .3, opacity: 1 }, { scale: 2.4, opacity: 0, duration: .6, onComplete: () => p.remove() }); } });
        }));
        await wait(1.6); K.chk();
        K.leaveAll();
        sfx.querySelectorAll('.sx-lock').forEach(r => r.remove());
      }

      if (SCENE < 3) {
        /* ---- 7 · part 2: the navigation screen, submarines blink at their positions ---- */
        await K.scene('bg_room', 1.03, [960, 540], [750, 300]);
        const scr = K.screen({});
        const pos = { '-6': scr.blip(-6), '-2': scr.blip(-2), '3': scr.blip(3), '5': scr.blip(5) };
        Object.values(pos).forEach((d, i) => gsap.to(d, { opacity: .35, duration: .5, yoyo: true, repeat: -1, delay: i * .2 }));
        K.who('meera', 'determined');
        await K.say(S.s4);

        /* ---- 8 · −6 blinks, an arrow runs from it towards the defence line 0 ---- */
        gsap.killTweensOf(pos['-6']); gsap.to(pos['-6'], { opacity: 1, scale: 1.5, duration: .3, yoyo: true, repeat: 5 });
        scr.toZero(-6, 'n'); scr.zero();
        K.who('meera', 'pointing');
        await K.say(S.m8);

        /* ---- 9 · +5 blinks: it is closer to 0 (distance 5 vs 6) ---- */
        gsap.killTweensOf(pos['5']); gsap.to(pos['5'], { opacity: 1, scale: 1.5, duration: .3, yoyo: true, repeat: 5 });
        scr.toZero(5, 'p');
        K.who('riya', 'alert');
        await K.say(S.r9);

        /* ---- 10 · mission begins: one submarine blinks, the FIRE button lights up ---- */
        K.leave('riya');
        const fire = K.mk('div', 'sx-fire'); const off = K.img('fire_off', '', {}, fire), lit = K.img('fire_lit', 'lit', {}, fire);
        gsap.fromTo(fire, { scale: 0 }, { scale: 1, duration: .5, ease: 'back.out(2.4)' });
        gsap.fromTo(lit, { opacity: 0 }, { opacity: 1, duration: .45, yoyo: true, repeat: -1, delay: .6, ease: 'sine.inOut' });
        K.who('meera', 'pointing');
        await K.say(S.s10);

        /* ---- 11 · gameplay transition: "Ready? Launch the missiles." → the child presses FIRE → MISSION 1 ---- */
        K.who('meera', 'determined');
        await K.say(S.s11);
        await pressFire(K, fire, lit);
        K.leaveAll(); gsap.to(fire, { scale: 0, duration: .3, delay: .25 });
        await gsap.to(scr, { scale: 2.3, opacity: 0, duration: .9, ease: 'power2.in' });
        const m1 = K.stamp('MISSION 1', 'big', 0); SFX.reward && SFX.reward(true); await wait(1.3); K.chk();
        gsap.to(m1, { scale: 3, opacity: 0, duration: .6, ease: 'power2.in' });
      }
    } catch (e) { if (e !== K.SKIP) throw e; }

    /* ---- into the sea: the view rushes forward, the cockpit takes over ---- */
    SD.hush(); K.st.onpointerdown = null; gsap.set('#tapNext', { opacity: 0 });
    SFX.swoosh(); SFX.splash(); SD.music('play'); SD.ambience('waves');
    gsap.to(cast, { opacity: 0, duration: .3 });
    await gsap.to([bg, sfx], { scale: 2.4, opacity: 0, duration: .9, ease: 'power3.in' });
    await gsap.to(K.st, { opacity: 0, duration: .35 });
    K.st.classList.add('hidden'); cast.innerHTML = sfx.innerHTML = ''; gsap.set([K.st, bg, cast, sfx], { clearProps: 'all' });
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

  /* ---- row 12 · the ending: a calm sea, the ship sails on, the route cleared ---- */
  async function storyEnd() {
    const K = storyKit();
    $('#skipStory').style.display = 'none';
    try {
      await K.scene('bg_sea', 1.04);
      const ship = K.img('ship', 'sx-ship end', {}); gsap.fromTo(ship, { x: -700 }, { x: 0, duration: 2.2, ease: 'power2.out' });
      gsap.to(ship, { y: 6, rotation: .8, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const rc = K.stamp('ROUTE CLEARED!', 'end', 0); SFX.tada();
      // confetti rains down (a short burst, then it settles)
      const COL = ['#ffd66b', '#7ff2ff', '#ff8fb1', '#9dff9a', '#ffffff', '#ffb070'];
      for (let i = 0; i < 40; i++) { const c = K.mk('div', 'sx-conf', { left: 200 + Math.random() * 1520 + 'px', top: '-30px', background: COL[i % COL.length] });
        gsap.to(c, { y: 700 + Math.random() * 400, x: (Math.random() - .5) * 240, rotation: (Math.random() - .5) * 900, opacity: 0, duration: 2.4 + Math.random() * 1.6, delay: .4 + Math.random() * .8, ease: 'power1.in', onComplete: () => c.remove() }); }
      K.who('riya', 'cheering'); K.who('meera', 'proud');
      await K.say(S.finEnd);
      await wait(.8);
    } catch (e) { if (e !== K.SKIP) throw e; }
    await gsap.to(K.st, { opacity: 0, duration: .4 });
    K.st.classList.add('hidden'); K.cast.innerHTML = K.sfx.innerHTML = ''; gsap.set([K.st, K.bg, K.cast, K.sfx], { clearProps: 'all' }); $('#skipStory').style.display = '';
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
    const demo = W.subAt(-3), lx = W.X(-3), ly = W.LBL_Y + W.CONFIG.SCALE_DY;   // the −3 label
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
    W.stripOff(); await storyEnd();   // storyboard row 12
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
    if ($('#start')._go) return; $('#start')._go = true;
    SD.audioOn(); SFX.ping();
    const boot = $('#boot');
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
