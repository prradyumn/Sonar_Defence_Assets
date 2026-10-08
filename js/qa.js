/* qa: a jump menu for testers (not the layout editor). Only with ?qa=1 — players never see it.
   Jump to any story scene, the teaching, any round of any level; set speed / sound; skip a line or answer for you. */
(function () {
  const Q = new URLSearchParams(location.search);
  if (Q.get('qa') !== '1') return;
  const PARTS = [
    ['Story', [['Harbour', { at: 'hook', scene: 1 }], ['Control room', { at: 'hook', scene: 2 }], ['Dive', { at: 'hook', scene: 3 }]]],
    ['Teaching', [['Number line', { at: 'teach' }]]],
    ['Level 1 · Compare', [['R1 tutorial', { at: 'l1', round: 1 }], ['R2', { at: 'l1', round: 2 }], ['R3', { at: 'l1', round: 3 }]]],
    ['Level 2 · Order', [1, 2, 3].map(r => ['R' + r, { at: 'l2', round: r }])],
    ['Level 3 · Combine', [1, 2, 3, 4, 5].map(r => ['R' + r, { at: 'l3', round: r }])],
    ['Final mission', [['R1 order', { at: 'final', round: 1 }], ['R2 compare', { at: 'final', round: 2 }], ['R3 combine', { at: 'final', round: 3 }]]],
  ];
  const css = document.createElement('style');
  css.textContent = `
  #qa{position:fixed;left:12px;top:12px;z-index:2147482000;font:600 13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eaf6ff;user-select:none}
  #qa button{font:inherit;color:inherit;cursor:pointer;border:1px solid #2f5d86;background:#123456;border-radius:8px;padding:6px 10px}
  #qa button:hover{background:#1b4a75}
  #qa button.on{background:#f08a10;border-color:#ffd38a;color:#fff}
  #qa .tog{display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:20px;background:rgba(6,24,46,.92);border:2px solid #f08a10;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  #qa .tog b{color:#ffd38a}
  #qa .panel{margin-top:8px;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto;padding:12px;border-radius:14px;background:rgba(6,24,46,.96);border:1px solid #2f5d86;box-shadow:0 14px 40px rgba(0,0,0,.45)}
  #qa .panel[hidden]{display:none}
  #qa h5{margin:10px 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8fc1e3}
  #qa h5:first-child{margin-top:0}
  #qa .row{display:flex;flex-wrap:wrap;gap:6px}
  #qa .row button.here{outline:2px solid #7ff2ff}
  #qa hr{border:0;border-top:1px solid #2f5d86;margin:12px 0}`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.id = 'qa';
  const keep = { speed: Q.get('speed') || '1', mute: Q.get('mute') === '1' };
  const jump = p => {
    const u = new URLSearchParams({ qa: '1', autostart: '1', at: p.at });
    if (p.round > 1) u.set('round', p.round);
    if (p.scene > 1) u.set('scene', p.scene);
    if (keep.speed !== '1') u.set('speed', keep.speed);
    if (keep.mute) u.set('mute', '1');
    location.search = u.toString();
  };
  const cur = { at: Q.get('at') || 'hook', round: +(Q.get('round') || 1), scene: +(Q.get('scene') || 1) };
  const isHere = p => p.at === cur.at && (p.round || 1) === cur.round && (p.scene || 1) === cur.scene;
  root.innerHTML = `<div class="tog"><button data-a="open">QA ▾</button><span id="qaWhere"></span></div>
    <div class="panel" hidden>${PARTS.map(([title, items], gi) => `<h5>${title}</h5><div class="row">${items.map(([label, p], i) =>
      `<button data-g="${gi}" data-i="${i}"${isHere(p) && Q.get('at') ? ' class="here"' : ''}>${label}</button>`).join('')}</div>`).join('')}
      <hr><h5>While playing</h5><div class="row">
        <button data-a="skip" title="End the current line">Skip line ⏭</button>
        <button data-a="answer" title="Tap the right submarine / pair for you">Answer ✓</button>
        <button data-a="restart" title="Reload this part">Restart part ↻</button></div>
      <h5>Next jump</h5><div class="row">${['1', '2', '3'].map(s => `<button data-speed="${s}"${keep.speed === s ? ' class="on"' : ''}>${s}×</button>`).join('')}
        <button data-a="mute"${keep.mute ? ' class="on"' : ''}>Sound off</button></div></div>`;
  document.body.appendChild(root);
  const panel = root.querySelector('.panel'), where = root.querySelector('#qaWhere');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.g != null) return jump(PARTS[b.dataset.g][1][b.dataset.i][1]);
    if (b.dataset.speed) { keep.speed = b.dataset.speed; root.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); return; }
    const a = b.dataset.a;
    if (a === 'open') panel.hidden = !panel.hidden;
    if (a === 'mute') { keep.mute = !keep.mute; b.classList.toggle('on', keep.mute); }
    if (a === 'skip') window.SD && SD.skip();
    if (a === 'restart') { const w = (window.SD && SD.where) || {}; jump({ at: w.at && w.at !== 'title' ? w.at : cur.at, round: w.round || 1, scene: cur.scene }); }
    if (a === 'answer' && window.W) {
      const box = (W._pairBoxes || []).find(x => !x._used && x.isConnected);
      if (box) box.onpointerdown();
      else if (W.waiting && W.subAt(W.expect)) W.subAt(W.expect).d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
  });
  // the current part, kept up to date
  setInterval(() => { const w = (window.SD && SD.where) || {}; where.innerHTML = w.at ? `<b>${w.at}</b>${w.at !== 'title' && w.at !== 'hook' && w.at !== 'teach' ? ' · R' + w.round : ''}` : ''; }, 500);
})();
