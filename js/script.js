/* script: every spoken line in the game (one source for the game AND tools/make_voices.py).
   Each line = { id, who, text }. Voice files live at assets/vo/<id>.wav.
   who: 'meera' (Commander Meera: the 7 lines in S) | 'narrator' (reads the mission panel: N() below) | 'riya' (not used now). */
(function () {
  const f = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';     // true minus sign
  const WHO = { meera: { name: 'Commander Meera', short: 'Meera' }, riya: { name: 'Cadet Riya', short: 'Riya' },
    narrator: { name: 'Narrator', short: 'Narrator' }, system: { name: 'Defence System', short: 'System' } };
  const LINES = [], BY = {};
  function add(id, who, text) { if (BY[text]) return BY[text]; const l = { id, who, text }; LINES.push(l); BY[text] = l; return l; }
  const M = (id, t) => add(id, 'meera', t);
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

  /* ---------- the spoken lines: ONLY these (the dialogue list for the Sonar Defence game: hook, and one intro per level).
     Everything else the levels say (the round's instruction, correct, wrong-answer hints) is on-screen text, below. ---------- */
  const S = {
    // hook (the story before Level 1)
    h1: M('h1', 'Enemy submarines are entering our sea territory! We have to protect our borders!'),
    h2: M('h2', 'Oh no! They’re firing missiles. We have to defuse them.'),
    // Level 1 (missiles defuse)
    l1a: M('l1a', 'Launch negative missiles to defuse the enemy missiles.'),
    l1b: M('l1b', 'Get ready! Let’s defend our territory!'),
    // Level 2 (fire and hit)
    l2a: M('l2a', 'Look at the submarine positions! Check this number line. The numbers on the left are smaller and closer to our border. The numbers on the right are bigger and farther away.'),
    l2b: M('l2b', 'We need to fire at the submarines closest to our border. Hit the submarines with the smaller number. Fire! Fire! Fire!'),
    // Level 3 (arrange)
    l3a: M('l3a', 'Oh no! More submarines are coming! The submarines with smaller numbers are closer to our border. Start with the smaller numbers, then move to the bigger ones. Fire them from closer to farther!'),
  };

  /* ======== the three game levels: the learning designer's sheets "Integers- Submarine - L1/L2/L3 V3".
     These lines show as text in the mission panel, and the narrator reads them aloud (N() below). Each row: ost = On-Screen Text, ok = Correct Feedback,
     fb = Incorrect Feedback 1–3 with their animation, idle = Inactivity line with its animation (played by js/levels.js).
     (vo = the sheet's old Game Instruction / VO, kept for reference only.) ======== */
  const reg = (id, R) => {
    if (R.fb) R.fbL = R.fb.map(([t, k]) => ({ line: t, kind: k }));
    if (R.idle) R.idleL = { line: R.idle[0], kind: R.idle[1] };
  };

  /* ---------- Level 1 · launch as many opposite missiles (sheet L1 V3) ----------
     give = the missiles that come (positive = the enemy submarine's red missiles, negative = the defence system's blue ones);
     the child launches the same number of the opposite sign from the bow cannon, then FIRE: every pair cancels, 0 left.
     The sheet gives no incorrect or inactivity animations for this level: given = the missiles that came pulse one by one,
     launcher = the launcher glows, both = both. Inactivity: the visual nudge only. */
  const DEFUSE = 'Launch Missiles to defuse the attack.';
  const pos = n => ({ give: n, ost: DEFUSE, vo: `${n} positive missiles are coming towards us. Launch as many negative missiles to defuse them.`,
    ok: `${n} positive and ${n} negative missiles cancel each other. 0 missiles left.`,
    fb: [['Check how many positive missiles are coming.', 'given'], ['Launch the same number of negative missiles.', 'launcher'], [`Launch ${n} negative missiles.`, 'both']] });
  const neg = n => ({ give: -n, ost: DEFUSE, vo: `Defence system launches ${n} negative missiles. Launch as many positive missiles to defuse them.`,
    ok: `${n} negative and ${n} positive missiles cancel each other. 0 missiles left.`,
    fb: [['Check how many negative missiles are launched.', 'given'], ['Launch the same number of positive missiles.', 'launcher'], [`Launch ${n} positive missiles.`, 'both']] });
  const L1 = [
    { ...pos(4), tutorial: true, vo: '4 positive missiles are coming towards us. Launch 4 negative missiles to defuse them.',
      ost: '4 positive missiles are coming towards us. Launch 4 negative missiles to cancel them.' },
    pos(5), pos(9), neg(10), neg(13), pos(7), neg(12),
  ];
  L1.forEach((R, r) => { R.ok = (r % 2 ? 'Good job! ' : 'Well done! ') + R.ok; reg('v3l1_r' + (r + 1), R); });   // the correct line opens with praise

  /* ---------- Level 2 · fire at the submarine close to our border (sheet L2 V3) ----------
     Our territory is the negative side: the smaller (more negative) number is closer to our border, so it is the one to fire,
     as the sheet's teaching line and Level 3 say. Rows 1, 2 and 9 are the sheet's own lines. In rows 3–8 and 10 the sheet
     picked the greater number; there the answer is the smaller one and the lines follow rows 1–2 ("… is smaller, and the
     submarine at … is closer to our border"). The sheet's "border 0" reads "our border" (0 is not the border).
     show = the comparison the Correct Animation shows after the lock. */
  const CHECK = 'Check which submarine is close to our border.', FIRE = 'Fire at the submarine with the smaller number.', FIRE1 = 'Fire the submarine closer to our border.';
  const FIND = 'Find the submarine close to our border.', WHICH = 'Which submarine is close to our border?';
  // a, b = the two positions as the sheet lists them; the answer is always the smaller
  const cmp = (a, b, ok, idle, o = {}) => { const t = Math.min(a, b), u = Math.max(a, b);
    return { subs: [a, b], target: t, vo: o.vo || FIRE1, ost: FIRE, ok, show: o.show || `${f(t)} < ${f(u)}`,
      fb: [[o.f1 || CHECK, o.k1 || 'both'], [`Check which is smaller: ${f(a)} or ${f(b)}?`, o.k2 || 'labels'], [o.f3 || `The smaller number is ${f(t)}, and that submarine is close to our border.`, o.k3 || 'target']],
      idle: [idle, 'target'] }; };
  const L2 = [
    cmp(8, 10, 'Yes! Nice. +8 is smaller, and the submarine at +8 is closer to our border.', WHICH, { f1: 'Check which submarine is closer to our border.', k2: 'labelsSeq', k3: 'targetRing' }),
    cmp(15, 17, 'Yes! Nice. +15 is smaller, and the submarine at +15 is closer to our border.', FIND),
    cmp(-10, -12, 'Yes! Nice. −12 is smaller than −10, and the submarine at −12 is closer to our border.', WHICH),
    cmp(-5, -8, 'Yes! −8 is smaller, and the submarine at −8 is closer to our border.', FIND),
    cmp(-14, -9, 'Yes! −14 is smaller, and the submarine at −14 is closer to our border.', FIND),
    cmp(-3, -7, 'Yes! −7 is smaller, and the submarine at −7 is closer to our border.', FIND),
    cmp(-8, 4, 'Yes! Nice. −8 is closer to our border. −8 is also smaller than +4.', FIND, { vo: 'Submarines are at −8 and +4. Fire at the submarine close to our border.', f3: '−8 is closer to our border.' }),
    cmp(-6, 3, 'Yes! −6 is closer to our border. −6 is smaller than +3.', FIND, { vo: FIRE, f3: '−6 is closer to our border.' }),
    cmp(-2, 7, 'Yes! −2 is closer to our border. But +7 is greater than −2.', FIND, { vo: FIRE, f3: '−2 is closer to our border.', show: '+7 > −2' }),
    cmp(-9, 5, 'Yes! −9 is closer to our border. −9 is smaller than +5.', FIND, { vo: FIRE, f3: '−9 is closer to our border.' }),
  ];
  L2.forEach((R, r) => reg('v3l2_r' + (r + 1), R));
  // after a guided replay: one more of the same kind, fresh numbers, no hints (not in the sheet; once per kind per level)
  const L2_EXTRA = {
    pos: cmp(14, 12, 'Yes! +12 is smaller, and the submarine at +12 is closer to our border.', FIND),
    neg: cmp(-11, -13, 'Yes! −13 is smaller, and the submarine at −13 is closer to our border.', FIND),
    mix: cmp(-7, 2, 'Yes! −7 is closer to our border. −7 is smaller than +2.', FIND, { f3: '−7 is closer to our border.' }),
  };
  Object.keys(L2_EXTRA).forEach(k => reg('v3l2_extra_' + k, L2_EXTRA[k]));

  /* ---------- Level 3 · fire in order, smaller number first (sheet L3 V3) ----------
     ost = the numbers shown on screen, in the sheet's order; the child fires them from the smallest up.
     Incorrect Feedback 3 names the submarine to fire next ("Select the submarine with −12."). */
  const L3_TEACH = { ost: 'Smaller → Bigger' };
  const ORD_FB1 = 'Check which submarine is closer to our border.', ORD_FB2 = 'Check which submarine has the smaller number and is closer to our border.';
  const ORD_IDLE = 'Select the submarine with the smaller number.', ORD_OK = 'Great! You fired from closer to farther.', ORD_VO = 'Fire submarines that are closer and then farthest.';
  const ord = (subs, cheer) => ({ subs, vo: ORD_VO, ost: subs.map(f).join(', '), ok: ORD_OK, cheer, fb: [[ORD_FB1, 'shake'], [ORD_FB2, 'numbers']], idle: [ORD_IDLE, 'smallest'] });
  const L3 = [
    ord([-3, -6, -9, -12], 'ROUTE CLEARED!'),
    ord([-2, -5, -8, -11]),
    ord([-4, -7, -10, -14]),
    ord([-8, 2, -5, 11], 'ROUTE CLEARED!'),
    ord([-3, 6, -9, 12]),
    ord([4, -7, 10, -13]),
    ord([9, 11, 6, 17], 'ALL TARGETS CLEARED!'),
  ];
  const startWith = v => `Select the submarine with ${f(v)}.`;   // ("select", not "start": it is said for every pick, not only the first)
  L3.forEach((R, r) => reg('v3l3_r' + (r + 1), R));
  // (the sheet's OST says "LEVEL 2 COMPLETE!", a copy slip: this is the end of Level 3)
  const L3_END = { ost: 'LEVEL 3 COMPLETE!' };

  /* ---------- the narrator reads the mission panel aloud: every round's instruction, the comparison shown after a hit, the correct
     line and the wrong-answer / inactivity hints (assets/vo/n_<hash>.ogg; Level 3's list of numbers and the banners are not read) ---------- */
  const hash = t => { let h = 5381; for (const c of t) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
  const N = t => t && add('n_' + hash(t), 'narrator', t);
  const MORE = 'One more like this!';
  [...L1, ...L2, ...Object.values(L2_EXTRA)].forEach(R => { N(R.ost); R.fbL.forEach(x => N(x.line)); if (R.idleL) N(R.idleL.line); N(R.show); N(R.ok); });
  L3.forEach(R => { R.fbL.forEach(x => N(x.line)); N(R.idleL.line); R.subs.forEach(v => N(startWith(v))); N(R.ok); });
  N(MORE);

  /* how a line should be READ aloud (signs → words) — used by the browser voice and tools/make_voices.py */
  function spoken(t) {
    return t.replace(/\((.[^)]*)\)\s*\+\s*\((.[^)]*)\)/g, '$1 plus $2')
      .replace(/−\s?(\d)/g, 'minus $1').replace(/\+(\d)/g, 'plus $1')
      .replace(/\s<\s/g, ' is less than ').replace(/\s>\s/g, ' is greater than ')
      .replace(/·/g, ',')
      .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }

  /* ---------- Hindi (?lang=hi, js/lang_hi.js): every line and every round's text is swapped for its Hindi; the voice ids stay
     the English ones (assets/vo/hi/<id>.ogg) ---------- */
  const HI = window.HI, HIN = !!(HI && HI.on);
  let D = { L1, L2, L2_EXTRA, L3, L3_TEACH, L3_END, startWith, MORE };
  if (HIN) {
    const T = t => (t && (HI.ui[t] || HI.tr(t))) || t;
    LINES.forEach(l => { l.en = l.text; l.text = T(l.text); });
    for (const k in BY) delete BY[k];
    LINES.forEach(l => { BY[l.text] = l; });
    [...L1, ...L2, ...Object.values(L2_EXTRA), ...L3, L3_TEACH, L3_END].forEach(R => {
      ['ost', 'ok', 'show', 'vo', 'cheer'].forEach(k => { if (R[k]) R[k] = T(R[k]); });
      (R.fbL || []).forEach(x => { x.line = T(x.line); });
      if (R.idleL) R.idleL.line = T(R.idleL.line);
    });
    D = { ...D, startWith: v => T(startWith(v)), MORE: T(MORE) };
  }
  window.SCRIPT = { WHO, LINES, S, D, f, lang: HIN ? 'hi' : 'en', spoken: HIN ? HI.spoken : spoken, find: t => BY[t] || null };
})();
