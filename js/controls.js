/* the player's controls, bottom right over the console: ◀ the previous round · pause / play · the next round ▶.
   Back and forward start that round fresh (the page reloads there, as a jump link does: ?autostart=1&at=l2&round=4; the order is
   the story, then every round of Levels 1–3). Pause holds the whole game (SD.hold 'player': the clock, the voice from the same
   word, the music, the CSS loops) under a tinted cover with the big play button; a tap anywhere on it, or the pause button
   again, carries on. The title covers the controls (it is above them) and so does a jump's loading screen (#boot). */
(function () {
  const { $ } = SD, D = SCRIPT.D, HI = SCRIPT.lang === 'hi';
  const PARTS = [{ at: 'hook', round: 1 }].concat(...[['l1', D.L1], ['l2', D.L2], ['l3', D.L3]].map(([at, R]) => R.map((_, i) => ({ at, round: i + 1 }))));
  const here = () => PARTS.findIndex(p => p.at === SD.where.at && p.round === SD.where.round);
  const ICON = {
    back: '<path d="M7 5h3v14H7zM19 5v14L10 12z"/>',
    pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    next: '<path d="M14 5h3v14h-3zM5 5v14l9-7z"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const cover = document.createElement('div'); cover.id = 'pauseCover'; cover.hidden = true;
  cover.innerHTML = `<b>${HI ? 'रुका हुआ' : 'PAUSED'}</b><i role="button" aria-label="${HI ? 'जारी रखें' : 'Play'}"></i>`;
  const bar = document.createElement('div'); bar.id = 'ctrl';
  bar.innerHTML = `<button id="cBack" title="${HI ? 'पिछला राउंड' : 'Previous round'}">${svg('back')}</button>`
    + `<button id="cPause" title="${HI ? 'रोकें' : 'Pause'}">${svg('pause')}</button>`
    + `<button id="cNext" title="${HI ? 'अगला राउंड' : 'Next round'}">${svg('next')}</button>`;
  const title = $('#title'); title.parentNode.insertBefore(cover, title); title.parentNode.insertBefore(bar, title);
  const back = $('#cBack'), pause = $('#cPause'), next = $('#cNext');
  bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-label', b.title));

  let paused = false;
  const setPause = on => {
    if (on === paused) return; paused = on;
    SD.hold('player', on); cover.hidden = !on;   // (held first: the cover's own fade is not caught by the hold)
    pause.innerHTML = svg(on ? 'play' : 'pause'); pause.title = on ? (HI ? 'जारी रखें' : 'Play') : (HI ? 'रोकें' : 'Pause'); pause.setAttribute('aria-label', pause.title);
    pause.classList.toggle('on', on);
  };
  const go = p => {
    const u = new URLSearchParams(location.search); ['at', 'round', 'scene', 'autostart'].forEach(k => u.delete(k));
    u.set('autostart', '1'); u.set('at', p.at); if (p.round > 1) u.set('round', p.round);
    location.search = u.toString();
  };
  const step = d => { const i = here(), p = i < 0 ? null : PARTS[i + d]; if (p) go(p); };
  // (pointerdown: the game's own taps listen on the stage, so the controls answer first and stop the tap there)
  const on = (el, f) => el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); f(); });
  on(back, () => step(-1)); on(next, () => step(1)); on(pause, () => setPause(!paused)); on(cover, () => setPause(false));
  // the ends: nothing before the story, nothing after Level 3's last round (or once the game is over)
  setInterval(() => { const i = here(); back.classList.toggle('off', i <= 0); next.classList.toggle('off', i < 0 || i >= PARTS.length - 1 || !!window.GAME_DONE); }, 400);
})();
