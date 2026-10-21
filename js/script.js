/* script: every spoken line in the game (one source for the game AND tools/make_voices.py).
   Each line = { id, who, text }. Voice files live at assets/vo/<id>.wav.
   who: 'meera' (Commander Meera) | 'riya' (Cadet Riya). */
(function () {
  const f = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';     // true minus sign
  const WHO = { meera: { name: 'Commander Meera', short: 'Meera' }, riya: { name: 'Cadet Riya', short: 'Riya' },
    narrator: { name: 'Narrator', short: 'Narrator' }, system: { name: 'Defence System', short: 'System' } };
  const LINES = [], BY = {};
  function add(id, who, text) { if (BY[text]) return BY[text]; const l = { id, who, text }; LINES.push(l); BY[text] = l; return l; }
  const M = (id, t) => add(id, 'meera', t), R = (id, t) => add(id, 'riya', t), N = (id, t) => add(id, 'narrator', t), Y = (id, t) => add(id, 'system', t);
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

  /* ---------- static lines ---------- */
  const S = {
    // story — the storyboard (Integers- Submarine - Story): part 1 = rows 1–6 (then Level 1), part 2 = rows 7–11 (the L2 transition,
    // then How to play and Level 2), ending = row 12. "Officer", "Officer Veer" and "Officer 1st" are Commander Meera.
    // Row 7 has no dialogue: its line is the one in the OST column. Our territory is the negative side: −6 is close to our
    // border, +5 is farther (row 9's dialogue).
    n1: N('n1', 'Enemy submarines have entered the guarded sea route! They are hiding at different positions.'),
    a2: Y('a2', 'Alert! Alert! Alert! They are firing missiles!'),
    m3: M('m3', 'Oh no! Missiles are heading towards us!'),
    m4: M('m4', 'Contact the defence station immediately! We must launch our missiles to stop the attack!'),
    d5: Y('d5', 'Defence system ready! Enemy missiles detected!'),
    m6: M('m6', 'Targets confirmed! Launch the counterattack!'),
    s4: M('s4', 'We must find their positions before they cross our border!'),
    m8: M('m8', 'Submarine at −6 is inside our territory and close to our border!'),
    r9: R('r9', 'Another submarine at +5 is farther to our border!'),
    s10: M('s10', 'Don’t let those sneaky submarines escape!'),
    s11: M('s11', 'Ready? Launch the missiles.'),
    // how to play (four quick cards in the cockpit)
    hp1: M('hp1', 'Check the navigation scale.'),
    hp2: M('hp2', 'Find the submarine at the correct position!'),
    hp3: M('hp3', 'Aim at the right submarine to hit!'),
    hp4: M('hp4', 'Tap Fire!'),
      finEnd: M('finEnd', 'All enemy submarines are stopped. Mission complete! The sea route is safe again!'),   // story sheet ending
  };

  /* ======== the three game levels: the learning designer's sheets "Integers- Submarine - L1/L2/L3 V3".
     Every spoken line and on-screen text below is copied from the sheets (ids start with v3 so no old recording is reused).
     Each row: vo = Game Instruction / VO, ok = Correct Feedback, fb = Incorrect Feedback 1–3 with their animation,
     idle = Inactivity VO with its animation. Animation kinds are played by js/levels.js. ======== */
  const reg = (id, R) => {
    if (R.vo) R.voL = M(id + '_vo', R.vo);
    if (R.ok) R.okL = M(id + '_ok', R.ok);
    if (R.fb) R.fbL = R.fb.map(([t, k], i) => ({ line: M(id + '_f' + (i + 1), t), kind: k }));
    if (R.idle) R.idleL = { line: M(id + '_idle', R.idle[0]), kind: R.idle[1] };
  };

  /* ---------- Level 1 · launch as many opposite missiles (sheet L1 V3) ----------
     give = the missiles that come (positive = the enemy submarine's red missiles, negative = the defence system's blue ones);
     the child launches the same number of the opposite sign from the bow cannon, then FIRE: every pair cancels, 0 left.
     The sheet gives no incorrect or inactivity animations for this level: given = the missiles that came pulse one by one,
     launcher = the launcher glows, both = both. Inactivity (no line in the sheet) repeats the round's instruction. */
  const L1_TEACH = { vo: 'Enemy submarines are launching missiles! We have to launch negative missiles to cancel them.' };
  reg('v3l1_teach', L1_TEACH);
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
  L1.forEach((R, r) => reg('v3l1_r' + (r + 1), R));

  /* ---------- Level 2 · fire at the submarine close to our border (sheet L2 V3) ----------
     Our territory is the negative side: the smaller (more negative) number is closer to our border, so it is the one to fire,
     as the sheet's teaching line and Level 3 say. Rows 1, 2 and 9 are the sheet's own lines. In rows 3–8 and 10 the sheet
     picked the greater number; there the answer is the smaller one and the lines follow rows 1–2 ("… is smaller, and the
     submarine at … is closer to our border"). The sheet's "border 0" reads "our border" (0 is not the border).
     show = the comparison the Correct Animation shows after the lock. */
  const CHECK = 'Check which submarine is close to our border.', FIRE = 'Fire at the submarine close to our border.', FIRE1 = 'Fire the submarine closer to our border.';
  const FIND = 'Find the submarine close to our border.', WHICH = 'Which submarine is close to our border?';
  const L2_TEACH = { vo: 'The submarine at the smaller number is closer to our border. The submarine at the bigger number is farther away. So, hit the submarine at the smaller number.' };
  reg('v3l2_teach', L2_TEACH);
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

  /* ---------- Level 3 · fire in order, smaller number first (sheet L3 V3) ----------
     ost = the numbers shown on screen, in the sheet's order; the child fires them from the smallest up.
     Incorrect Feedback 3 names the submarine to fire next ("Start with the submarine with −12."). */
  const L3_TEACH = { vo: 'Oh no! There are many submarines now. Submarines that have smaller numbers are close to our border. First, we need to fire at them, then at the ones farther away.', ost: 'Smaller → Bigger' };
  reg('v3l3_teach', L3_TEACH);
  const ORD_FB1 = 'Check which submarine is closer to our border.', ORD_FB2 = 'Check which submarine has the smaller number and is closer to our border.';
  const ORD_IDLE = 'Start with the submarine with the smaller number.', ORD_OK = 'Great! You fired from closer to farther.', ORD_VO = 'Fire submarines that are closer and then farthest.';
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
  const startWith = v => M('v3l3_start_' + (v < 0 ? 'm' + -v : 'p' + v), `Start with the submarine with ${f(v)}.`);
  L3.forEach((R, r) => { reg('v3l3_r' + (r + 1), R); [...R.subs].sort((x, y) => x - y).forEach(startWith); });
  // (the sheet's OST says "LEVEL 2 COMPLETE!", a copy slip: this is the end of Level 3)
  const L3_END = { vo: 'Great work! You cleared all the submarines in the right order.', ok: 'The route is clear!', ost: 'LEVEL 3 COMPLETE!' };
  reg('v3l3_end', L3_END);

  /* how a line should be READ aloud (signs → words) — used by the browser voice and tools/make_voices.py */
  function spoken(t) {
    return t.replace(/\((.[^)]*)\)\s*\+\s*\((.[^)]*)\)/g, '$1 plus $2')
      .replace(/−\s?(\d)/g, 'minus $1').replace(/\+(\d)/g, 'plus $1')
      .replace(/\s<\s/g, ' is less than ').replace(/\s>\s/g, ' is greater than ')
      .replace(/·/g, ',')
      .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }

  window.SCRIPT = { WHO, LINES, S, D: { L1, L1_TEACH, L2, L2_TEACH, L3, L3_TEACH, L3_END, startWith }, f, spoken, find: t => BY[t] || null };
})();
