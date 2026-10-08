/* script: every spoken line in the game (one source for the game AND tools/voice_studio.html).
   Each line = { id, who, text }. Voice files live at assets/vo/<id>.wav.
   who: 'meera' (Commander Meera) | 'riya' (Cadet Riya). */
(function () {
  const f = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';     // true minus sign
  const WHO = { meera: { name: 'Commander Meera', short: 'Meera' }, riya: { name: 'Cadet Riya', short: 'Riya' } };
  const LINES = [], BY = {};
  function add(id, who, text) { if (BY[text]) return BY[text]; const l = { id, who, text }; LINES.push(l); BY[text] = l; return l; }
  const M = (id, t) => add(id, 'meera', t), R = (id, t) => add(id, 'riya', t);
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');

  /* ---------- static lines ---------- */
  const S = {
    // hook — harbour, then the sonar room
    h1: R('h1', 'Good morning, Commander Meera! The sea looks so calm today.'),
    h2: M('h2', 'Not for long, Riya. Listen… the sonar is beeping!'),
    h3: M('h3', 'Enemy submarines have entered our guarded sea route.'),
    h4: R('h4', 'So many of them! Where are they hiding?'),
    h5: M('h5', 'At different marked positions. We must find the right targets before they cross the defence line.'),
    h6: R('h6', 'But how will we know which one to hit?'),
    h7: M('h7', 'With the navigation scale! Read each mission, find the submarine, and fire at the right target.'),
    h8: R('h8', 'Ready, Commander! Let’s protect the route!'),
    // on patrol — teaching the scale
    g1: R('g1', 'Whoa! The navigation scale is switching on!'),
    t1: M('t1', 'This is our navigation scale. The centre point is zero.'),
    t2: M('t2', 'Watch the navigation scale. As we move to the right, the numbers become greater.'),
    t3: M('t3', 'As we move to the left, the numbers become smaller.'),
    t4: M('t4', '+2 is farther to the right, so it is greater than −3.'),
    t5: M('t5', '−6 is farther to the left, so it is smaller than −2.'),
    t6: M('t6', 'Remember: right means greater, left means smaller.'),
    t7: R('t7', 'Got it! Right is greater, left is smaller!'),
    // first-mission tutorial
    tut1: M('tut1', 'Your turn, cadet! Every submarine sits below a number on the scale.'),
    tut2: M('tut2', 'See? This submarine is at −3.'),
    tut3: M('tut3', 'Now find the submarine at +2. Tap it to fire!'),
    // generic nudges
    tap: M('tap', 'Tap a submarine to fire!'),
    take: M('take', 'Take your time. Read the mission, then tap a submarine.'),
    idle: M('idle', 'Read the mission again, then look at where each submarine is on the scale.'),
    // Riya's reactions
    hit1: R('hit1', 'Direct hit!'), hit2: R('hit2', 'Bullseye!'), hit3: R('hit3', 'Yes! Got it!'), hit4: R('hit4', 'Great shot!'),
    done1: R('done1', 'Woohoo! Level cleared! Shabash!'),
    doneF: R('doneF', 'We did it! The sea route is safe!'),
    // level wrap-ups / intros
    l1end: M('l1end', 'Right means greater. Left means smaller. Shabash, cadet!'),
    l2intro: M('l2intro', 'Our launcher fires in a sweeping order. Follow the direction in each mission.'),
    l3intro: M('l3intro', 'Enemy submarines now release movement signals. A signal moving right is positive. A signal moving left is negative.'),
    l3ask: M('l3ask', 'Fire at the submarine where the marker will stop.'),
    l3idle: M('l3idle', 'Where will the marker stop? Fire at that submarine.'),
    pairIdle: M('pairIdle', 'Tap where a right signal and a left signal stand together.'),
    pairDemo: M('pairDemo', 'Tap here! One right signal and one left signal cancel each other.'),
    finEnd: M('finEnd', 'Mission complete! The sea route is safe.'),
  };
  S.hits = [S.hit1, S.hit2, S.hit3, S.hit4];

  /* ---------- Level 1 · Compare ---------- */
  const L1 = [
    { subs: [-3, 2], m: [{ target: 2, text: 'Fire at the submarine at <b>+2</b>.', ok: 'Correct! +2 is farther to the right.', show: '+2 is greater than −3 &nbsp;·&nbsp; +2 > −3',
      lines: { oops: 'Oops! That submarine is at −3. Find +2 on the scale.', hint: '+2 is on the right side of zero. Look to the right.', nudge: 'Here is the submarine at +2. Fire!' } }] },
    { subs: [-6, -2], m: [{ target: -2, text: 'Fire at the submarine <b>farther to the right</b>.', ok: 'Correct! −2 is farther to the right, so it is greater.', show: '−2 > −6',
      lines: { oops: 'Oops! −6 is farther to the left.', hint: '6 is bigger than 2, but −6 sits farther left. Farther right means greater.', nudge: '−2 is farther to the right. Fire at −2!' } }] },
    { subs: [-4, 0, 3], m: [
      { target: 0, text: 'Fire at the submarine at <b>0</b>.', ok: 'Correct! That one is at 0, the centre.', show: '0 is the centre',
        lines: { oops: 'Oops! Find the centre of the scale — that is 0.', hint: 'Zero is the bright gold mark in the middle.', nudge: 'This submarine is at 0. Fire!' } },
      { target: 3, text: 'Fire at the submarine <b>to the right of 0</b>.', ok: 'Correct! +3 is to the right of 0, so it is greater than 0.', show: '+3 > 0',
        lines: { oops: 'Oops! That one is on the left of 0.', hint: 'To the right of 0 means on the right side of the gold mark.', nudge: '+3 is to the right of 0. Fire!' } },
      { target: -4, text: 'Fire at the submarine <b>to the left of 0</b>.', ok: 'Correct! −4 is to the left of 0, so it is smaller than 0.', show: '−4 < 0',
        lines: { oops: 'Oops! Look on the left side of 0.', hint: 'To the left of 0 means on the left side of the gold mark.', nudge: '−4 is to the left of 0. Fire!' } }] },
  ];
  // the final mission's compare round uses the same shape
  const FIN_CMP = { subs: [-4, 2], m: { target: 2, text: 'Fire at the submarine <b>farther to the right</b>.', ok: 'Correct! +2 is farther to the right, so it is greater.', show: '+2 > −4',
    lines: { oops: 'Oops! −4 is on the left.', hint: 'Farther right means greater. Look right.', nudge: '+2 is farther to the right. Fire!' } } };
  function regMission(id, m) {
    m.sayL = M(id + '_say', strip(m.text)); m.okL = M(id + '_ok', m.ok);
    for (const k of ['oops', 'hint', 'nudge']) m.lines[k + 'L'] = M(id + '_' + k, m.lines[k]);
  }
  L1.forEach((R1, r) => R1.m.forEach((m, i) => regMission(`l1_r${r + 1}_${i + 1}`, m)));

  /* ---------- Level 2 · Order ---------- */
  const L2 = [
    { subs: [-6, -2, 1, 4], dir: 1, ok: 'Great! Left to right gives smallest to greatest.', chain: '−6 < −2 < +1 < +4' },
    { subs: [-5, -1, 2, 6], dir: -1, ok: 'Great! Right to left gives greatest to smallest.', chain: '+6 > +2 > −1 > −5' },
    { subs: [-7, -3, 0, 2, 5], dir: 1, ok: 'Excellent! Negatives, zero, then positives — smallest to greatest.', chain: '−7 < −3 < 0 < +2 < +5' },
  ];
  const FIN_ORD = { subs: [-5, -1, 0, 3], dir: -1, ok: 'Route cleared from right to left!', chain: '+3 > 0 > −1 > −5' };
  const ORD = {
    say: d => d > 0 ? S.ordL || (S.ordL = M('ord_say_lr', 'Clear the route from left to right.')) : S.ordR || (S.ordR = M('ord_say_rl', 'Clear the route from right to left.')),
    oops: d => M('ord_oops_' + (d > 0 ? 'lr' : 'rl'), `Not that one yet. Sweep from the ${d > 0 ? 'left' : 'right'}: which submarine is next?`),
    hint: d => M('ord_hint_' + (d > 0 ? 'lr' : 'rl'), d > 0 ? 'Left to right means smallest first. Find the one farthest left.' : 'Right to left means greatest first. Find the one farthest right.'),
    idle: d => M('ord_idle_' + (d > 0 ? 'lr' : 'rl'), d > 0 ? 'Start from the left end of the scale.' : 'Start from the right end of the scale.'),
    nudge: v => M('ord_next_' + (v < 0 ? 'm' + -v : v > 0 ? 'p' + v : '0'), `${f(v)} is next. Fire!`),
  };
  const regOrder = (id, R2) => { ORD.say(R2.dir); ORD.oops(R2.dir); ORD.hint(R2.dir); ORD.idle(R2.dir); R2.subs.forEach(ORD.nudge); R2.okL = M(id + '_ok', R2.ok); };
  L2.forEach((R2, r) => regOrder('l2_r' + (r + 1), R2)); regOrder('fin_r1', FIN_ORD);
  regMission('fin_r2', FIN_CMP.m);

  /* ---------- Level 3 · Combine movement signals ---------- */
  const L3 = [
    { a: 4, b: -4, opts: [-8, 0, 8], ok: 'Equal moves in opposite directions cancel each other. +4 and −4 make 0.' },
    { a: 5, b: -3, opts: [-2, 2, 8], ok: 'Two positive moves remain, so the final position is +2.' },
    { a: 3, b: -5, opts: [-2, 2, 8], ok: 'Two negative moves remain, so the final position is −2.' },
    { a: 2, b: 3, opts: [-5, 1, 5], ok: 'Both moves go right, so they combine. The final position is +5.' },
    { a: -2, b: -3, opts: [-5, -1, 5], ok: 'Both moves go left, so they combine. The final position is −5.' },
  ];
  const FIN_SIG = { a: 4, b: -6, opts: [-6, -2, 2], ok: 'Four pairs cancel. Two negative moves remain, so the final position is −2.' };
  const dw = n => n > 0 ? 'right' : 'left';
  function regSignal(id, R3, first) {
    const res = R3.a + R3.b, same = Math.sign(R3.a) === Math.sign(R3.b), A = Math.abs(R3.a), B = Math.abs(R3.b);
    const L = R3.L = {};
    if (!same) {
      L.intro = first ? M(id + '_intro', 'Four signals move right and four move left. Tap a pair to cancel it.') : M(id + '_intro', `${A} ${dw(R3.a)} moves and ${B} ${dw(R3.b)} moves. Tap the pairs to cancel them.`);
      const left = Math.abs(res);
      L.after = left === 0 ? M(id + '_after', 'All four pairs cancel. Nothing is left.') : M(id + '_after', `${Math.min(A, B)} pairs cancel. ${left} ${res > 0 ? 'positive' : 'negative'} moves remain.`);
    } else L.intro = M(id + '_intro', `Both signals move ${dw(R3.a)}.`);
    L.oops = same ? M('sig_oops_same_' + dw(R3.a), `Oops! Both moves go ${dw(R3.a)} from 0.`) : M('sig_oops_pairs', 'Oops! Count the moves that are left after the pairs cancel.');
    L.hint = M(id + '_hint', same ? `${f(R3.a)} then ${f(R3.b)}: count every step ${R3.a > 0 ? 'to the right' : 'to the left'} from 0.` : (res === 0 ? 'Everything cancelled, so the marker does not move.' : `${Math.abs(res)} ${dw(res)} moves are left. Go ${Math.abs(res)} steps ${dw(res)} from 0.`));
    L.nudge = M('sig_nudge_' + (res < 0 ? 'm' + -res : res > 0 ? 'p' + res : '0'), `The marker stops at ${f(res)}. Fire!`);
    L.ok = M(id + '_ok', R3.ok);
  }
  L3.forEach((R3, r) => regSignal('l3_r' + (r + 1), R3, r === 0)); regSignal('fin_r3', FIN_SIG, false);

  /* how a line should be READ aloud (signs → words) — used by the browser voice and the Voice Studio */
  function spoken(t) {
    return t.replace(/\((.[^)]*)\)\s*\+\s*\((.[^)]*)\)/g, '$1 plus $2')
      .replace(/−\s?(\d)/g, 'minus $1').replace(/\+(\d)/g, 'plus $1')
      .replace(/\s<\s/g, ' is less than ').replace(/\s>\s/g, ' is greater than ')
      .replace(/·/g, ',')
      .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }

  window.SCRIPT = { WHO, LINES, S, D: { L1, L2, L3, FIN_ORD, FIN_CMP, FIN_SIG, ORD }, f, spoken, find: t => BY[t] || null };
})();
