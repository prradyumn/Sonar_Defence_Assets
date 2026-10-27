/* lang_hi: the game in Hindi (pure Hindi: धनात्मक / ऋणात्मक, "ऋण बारह"). On with ?lang=hi.
   js/script.js builds every line in English first (so the voice ids stay the same), then runs each line and each round's text
   through HI.tr(); HI.spoken() is how a Hindi line is read aloud (numbers as words). HI.ui holds the screen's other words
   (banners, buttons, labels); core.js swaps them in wherever they appear on screen. Voice files: assets/vo/hi/<id>.ogg.
   Translations for review by the learning designer. */
(function () {
  const W = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह',
    'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस'];
  const word = n => W[n] || String(n);
  const N = '([+−]?\\d+)';   // a number as the screen shows it: +8, −12, 4

  // the spoken lines (Meera's 7), word for word
  const FIXED = {
    'Enemy submarines are entering our sea territory! We have to protect our borders!':
      'दुश्मन की पनडुब्बियाँ हमारी समुद्री सीमा में घुस रही हैं! हमें अपनी सीमाओं की रक्षा करनी है!',
    'Oh no! They’re firing missiles. We have to defuse them.':
      'अरे नहीं! वे मिसाइलें दाग रहे हैं। हमें उन्हें निष्क्रिय करना होगा।',
    'Launch negative missiles to defuse the enemy missiles.':
      'दुश्मन की मिसाइलों को निष्क्रिय करने के लिए ऋणात्मक मिसाइलें छोड़ो।',
    'Get ready! Let’s defend our territory!':
      'तैयार हो जाओ! चलो, अपनी सीमा की रक्षा करें!',
    'Look at the submarine positions! Check this number line. The numbers on the left are smaller and closer to our border. The numbers on the right are bigger and farther away.':
      'पनडुब्बियों की स्थिति देखो! इस संख्या रेखा को देखो। बाईं ओर की संख्याएँ छोटी हैं और हमारी सीमा के पास हैं। दाईं ओर की संख्याएँ बड़ी हैं और दूर हैं।',
    'We need to fire at the submarines closest to our border. Hit the submarines with the smaller number. Fire! Fire! Fire!':
      'हमें उन पनडुब्बियों पर वार करना है जो हमारी सीमा के सबसे पास हैं। छोटी संख्या वाली पनडुब्बियों पर निशाना लगाओ। दागो! दागो! दागो!',
    'Oh no! More submarines are coming! The submarines with smaller numbers are closer to our border. Start with the smaller numbers, then move to the bigger ones. Fire them from closer to farther!':
      'अरे नहीं! और पनडुब्बियाँ आ रही हैं! छोटी संख्या वाली पनडुब्बियाँ हमारी सीमा के ज़्यादा पास हैं। छोटी संख्याओं से शुरू करो, फिर बड़ी संख्याओं की ओर बढ़ो। पास वाली से दूर वाली की ओर दागो!',
    // the narrator's fixed lines
    'Launch Missiles to defuse the attack.': 'हमले को निष्क्रिय करने के लिए मिसाइलें छोड़ो।',
    'Check how many positive missiles are coming.': 'देखो, कितनी धनात्मक मिसाइलें आ रही हैं।',
    'Check how many negative missiles are launched.': 'देखो, कितनी ऋणात्मक मिसाइलें छोड़ी गई हैं।',
    'Launch the same number of negative missiles.': 'उतनी ही ऋणात्मक मिसाइलें छोड़ो।',
    'Launch the same number of positive missiles.': 'उतनी ही धनात्मक मिसाइलें छोड़ो।',
    'Fire at the submarine close to our border.': 'हमारी सीमा के पास वाली पनडुब्बी पर दागो।',
    'Check which submarine is closer to our border.': 'देखो, कौन-सी पनडुब्बी हमारी सीमा के ज़्यादा पास है।',
    'Check which submarine is close to our border.': 'देखो, कौन-सी पनडुब्बी हमारी सीमा के पास है।',
    'Which submarine is close to our border?': 'कौन-सी पनडुब्बी हमारी सीमा के पास है?',
    'Find the submarine close to our border.': 'हमारी सीमा के पास वाली पनडुब्बी ढूँढो।',
    'Check which submarine has the smaller number and is closer to our border.': 'देखो, किस पनडुब्बी की संख्या छोटी है और वह हमारी सीमा के ज़्यादा पास है।',
    'Start with the submarine with the smaller number.': 'छोटी संख्या वाली पनडुब्बी से शुरू करो।',
    'Great! You fired from closer to farther.': 'शाबाश! तुमने पास से दूर की ओर दागा।',
    'One more like this!': 'ऐसा एक और!',
  };
  // the narrator's lines with numbers (most specific first)
  const PAT = [
    [`^${N} positive missiles are coming towards us\\. Launch ${N} negative missiles to cancel them\\.$`, '$1 धनात्मक मिसाइलें हमारी ओर आ रही हैं। उन्हें निरस्त करने के लिए $2 ऋणात्मक मिसाइलें छोड़ो।'],
    [`^Launch ${N} negative missiles\\.$`, '$1 ऋणात्मक मिसाइलें छोड़ो।'],
    [`^Launch ${N} positive missiles\\.$`, '$1 धनात्मक मिसाइलें छोड़ो।'],
    [`^${N} positive and ${N} negative missiles cancel each other\\. ${N} missiles left\\.$`, '$1 धनात्मक और $2 ऋणात्मक मिसाइलें एक-दूसरे को निरस्त कर देती हैं। अब $3 मिसाइलें बचीं।'],
    [`^${N} negative and ${N} positive missiles cancel each other\\. ${N} missiles left\\.$`, '$1 ऋणात्मक और $2 धनात्मक मिसाइलें एक-दूसरे को निरस्त कर देती हैं। अब $3 मिसाइलें बचीं।'],
    [`^Check which is smaller: ${N} or ${N}\\?$`, 'देखो, कौन-सी संख्या छोटी है: $1 या $2?'],
    [`^The smaller number is ${N}, and that submarine is close to our border\\.$`, 'छोटी संख्या $1 है, और वही पनडुब्बी हमारी सीमा के पास है।'],
    [`^Yes! Nice\\. ${N} is smaller than ${N}, and the submarine at ${N} is closer to our border\\.$`, 'हाँ! बहुत बढ़िया। $1, $2 से छोटा है, और $3 वाली पनडुब्बी हमारी सीमा के ज़्यादा पास है।'],
    [`^Yes! Nice\\. ${N} is smaller, and the submarine at ${N} is closer to our border\\.$`, 'हाँ! बहुत बढ़िया। $1 छोटा है, और $2 वाली पनडुब्बी हमारी सीमा के ज़्यादा पास है।'],
    [`^Yes! ${N} is smaller, and the submarine at ${N} is closer to our border\\.$`, 'हाँ! $1 छोटा है, और $2 वाली पनडुब्बी हमारी सीमा के ज़्यादा पास है।'],
    [`^Yes! Nice\\. ${N} is closer to our border\\. ${N} is also smaller than ${N}\\.$`, 'हाँ! बहुत बढ़िया। $1 हमारी सीमा के ज़्यादा पास है। $2, $3 से छोटा भी है।'],
    [`^Yes! ${N} is closer to our border\\. But ${N} is greater than ${N}\\.$`, 'हाँ! $1 हमारी सीमा के ज़्यादा पास है। लेकिन $2, $3 से बड़ा है।'],
    [`^Yes! ${N} is closer to our border\\. ${N} is smaller than ${N}\\.$`, 'हाँ! $1 हमारी सीमा के ज़्यादा पास है। $2, $3 से छोटा है।'],
    [`^${N} is closer to our border\\.$`, '$1 हमारी सीमा के ज़्यादा पास है।'],
    [`^Start with the submarine with ${N}\\.$`, '$1 वाली पनडुब्बी से शुरू करो।'],
    [`^${N} < ${N}$`, '$1 < $2'],   // (the screen keeps the symbols; spoken() reads them)
    [`^${N} > ${N}$`, '$1 > $2'],
  ].map(([re, out]) => [new RegExp(re), out]);

  function tr(t) {
    if (t == null) return t;
    if (FIXED[t]) return FIXED[t];
    for (const [re, out] of PAT) if (re.test(t)) return t.replace(re, out);
    return t;   // not translated (shown in English): listed by HI.missing
  }
  // how a Hindi line is read aloud: −12 → ऋण बारह, +8 → धन आठ, 4 → चार, "a < b" → "a, b से छोटा है"
  function spoken(t) {
    const num = s => (s[0] === '−' ? 'ऋण ' : s[0] === '+' ? 'धन ' : '') + word(Math.abs(parseInt(s.replace('−', '-'), 10)));
    let m = t.match(new RegExp(`^${N} ([<>]) ${N}$`));
    if (m) return `${num(m[1])}, ${num(m[3])} से ${m[2] === '<' ? 'छोटा' : 'बड़ा'} है।`;
    return t.replace(/[+−]?\d+/g, num);
  }
  // the screen's other words (exact text → Hindi)
  const ui = {
    'LEVEL 1': 'स्तर 1', 'LEVEL 2': 'स्तर 2', 'LEVEL 3': 'स्तर 3',
    'LEVEL 1 COMPLETE!': 'स्तर 1 पूरा!', 'LEVEL 2 COMPLETE!': 'स्तर 2 पूरा!', 'LEVEL 3 COMPLETE!': 'स्तर 3 पूरा!',
    'ROUTE CLEARED!': 'रास्ता साफ़!', 'ALL TARGETS CLEARED!': 'सभी निशाने साफ़!', 'Smaller → Bigger': 'छोटी → बड़ी',
    'smaller · closer': 'छोटी · पास', 'bigger · farther': 'बड़ी · दूर', 'our border': 'हमारी सीमा',
    'Next': 'आगे', 'Commander Meera': 'कमांडर मीरा', 'Narrator': 'सूत्रधार', 'SHIELD': 'कवच', 'SHIELD DOWN!': 'कवच टूट गया!',
    'SINKING!': 'डूब रहे हैं!', 'TRY AGAIN!': 'फिर से कोशिश करो!', 'ALERT! ALERT!': 'चेतावनी! चेतावनी!',
    'Guard the sea route · Integers on the navigation scale': 'समुद्री रास्ते की रक्षा करो · नौवहन पैमाने पर पूर्णांक',
    'Skip story ▸▸': 'कहानी छोड़ो ▸▸', 'Next mission': 'अगला मिशन', 'tap to continue ▸': 'आगे बढ़ने के लिए छुओ ▸',
  };
  const UIRE = [[/^DEPTH (\d+) m$/, 'गहराई $1 मी']];
  const uiText = t => { const k = t.trim(); if (ui[k]) return t.replace(k, ui[k]); for (const [re, out] of UIRE) if (re.test(k)) return t.replace(k, k.replace(re, out)); return null; };
  const on = (window.SD_LANG || (window.location && new URLSearchParams(window.location.search).get('lang'))) === 'hi';
  // on screen: any text that appears (now or later) and is one of the words above is swapped for its Hindi
  function watch() {
    document.documentElement.lang = 'hi';
    const fix = n => { if (n.nodeType === 3) { const h = uiText(n.nodeValue); if (h != null && h !== n.nodeValue) n.nodeValue = h; } else if (n.nodeType === 1 && n.childNodes.length) n.childNodes.forEach(fix); };
    fix(document.body);
    new MutationObserver(ms => ms.forEach(m => m.type === 'characterData' ? fix(m.target) : m.addedNodes.forEach(fix)))
      .observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  if (on && typeof document !== 'undefined') document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', watch) : watch();
  window.HI = { on, tr, spoken, ui, word };
})();
