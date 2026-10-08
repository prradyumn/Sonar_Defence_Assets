/* editor: in-game pause + layout editor ("Figma inside the game").
   Players never see it: it boots only with ?edit=1 or the E key (that one keydown listener is all it adds otherwise).
   Edits are CSS overrides keyed by selector + game constants (W.CONFIG) → js/layout.js (window.LAYOUT).
   Save goes through tools/dev_server.py; opened from file:// it offers Copy JSON / Download layout.js. */
(function () {
  const isField = t => !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if (new URLSearchParams(location.search).get('edit') === '1') boot();
  else addEventListener('keydown', function first(e) {
    if ((e.key !== 'e' && e.key !== 'E') || e.metaKey || e.ctrlKey || e.altKey || isField(e.target)) return;
    removeEventListener('keydown', first); boot();
  });

  function boot() {
    const $ = s => document.querySelector(s), stage = $('#stage');
    const DRAFT = 'sdEditorDraft', PREFS = 'sdEditorPrefs';
    const clone = o => JSON.parse(JSON.stringify(o || {}));
    const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch (e) { return {}; } })();
    prefs.hidden = prefs.hidden || {}; prefs.locked = prefs.locked || {};
    const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {} };

    /* ---------------- what can be edited ----------------
       mv: CSS axes you can drag (x → left, y → top) · sz: '' | 'w' | 'h' | 'wh' | 'scale' · wp / hp: CSS property behind W / H
       mx: margin-left follows −W·mx (element sits centred on a script-set x) · cy: vertical drag edits this game constant
       also: mirror a property onto another selector · t: text (font size) · piv: moving it re-aims the launcher pivot */
    const GROUPS = [
      ['World', [['#far', 'Far reef', { mv: 'y' }], ['#seabed', 'Seabed', { mv: 'y' }], ['#kelp', 'Kelp (front)', { mv: 'y' }]]],
      ['Ship', [['#ship', 'Ship', { mv: 'xy', sz: 'scale', piv: 1 }, [
        ['#officer', 'Commander Meera (deck)', { mv: 'xy', sz: 'h', also: { height: '#officer img' } }],
        ['#deckRail', 'Deck rail', { mv: 'xy', sz: 'wh' }],
        ['#turret', 'Launcher', { mv: 'xy', sz: 'wh', piv: 1 }]]]]],
      ['Navigation scale', [['#scaleBack', 'Scale panel', { mv: 'xy', sz: 'wh' }], ['#rail', 'Scale rail', { mv: 'xy', sz: 'wh' }], ['.lbl', 'Scale numbers', { mv: 'y', sz: 'w', mx: .5, t: 1 }],
        ['.sub', 'Submarines', { cy: 'SUB_Y' }], ['#marker', 'Defence marker (L3)', { mv: 'y', sz: 'wh', mx: .5 }]]],
      ['HUD', [['#strip', 'Mission strip', { mv: 'xy', sz: 'wh', hp: 'minHeight', t: 1 }], ['#pips', 'Progress pips', { mv: 'xy', sz: 'scale' }],
        ['#btnSpeak', 'Hear-again button', { mv: 'xy', sz: 'wh' }], ['#rule', 'Rule card', { mv: 'xy', sz: 'wh', t: 1 }],
        ['#hand', 'Helper hand', { sz: 'wh', mx: 1 / 3 }],
        ['#comms', 'Comms (portrait + caption)', { mv: 'xy', sz: 'scale' }, [
          ['#portrait', 'Portrait', { mv: 'xy', sz: 'wh' }], ['#pName', 'Name tag', { mv: 'xy', t: 1 }],
          ['#caption', 'Caption', { mv: 'xy', sz: 'wh', wp: 'maxWidth', hp: 'minHeight', t: 1 }]]]]],
      ['Cards', [['#banner .card', 'Level banner', { mv: 'xy', sz: 'wh' }], ['#done .card', 'Level-complete card', { mv: 'xy', sz: 'wh' }, [
        ['#dt', 'Title', { mv: 'xy', sz: 'w', t: 1 }], ['#ds', 'Subtitle', { mv: 'xy', sz: 'w', t: 1 }], ['#dstars', 'Stars', { mv: 'xy', sz: 'w' }],
        ['#dchain', 'Rule line', { mv: 'xy', sz: 'w', t: 1 }], ['#dcta', 'Next button', { mv: 'xy', t: 1 }]]]]],
      ['Title', [['#title .logo', 'Logo', { mv: 'xy', t: 1 }], ['#title .sub2', 'Tagline', { mv: 'xy', t: 1 }], ['#start', 'Start button', { mv: 'xy', t: 1 }]]],
      ['Story', [['#skipStory', 'Skip story', { mv: 'xy', t: 1 }], ['#tapNext', 'Tap to continue', { mv: 'xy', t: 1 }]]],
    ];
    const ENT = {}, ORDER = [];
    for (const [group, list] of GROUPS) (function walk(list, parent, depth) {
      for (const [sel, name, o, kids] of list) { const e = { sel, name, o, group, parent, depth }; ENT[sel] = e; ORDER.push(e); if (kids) walk(kids, e, depth + 1); }
    })(list, null, 0);
    // story actors / bubbles carry data-edit names (levels.js)
    const storyEnt = name => {
      const sel = `[data-edit="${name}"]`;
      return ENT[sel] || (ENT[sel] = { sel, name: name.replace(/-/g, ' '), group: 'Story', parent: null, depth: 0, dyn: 1,
        o: /bubble$/.test(name) ? { mv: 'xy', sz: 'w', wp: 'maxWidth', t: 1 } : { mv: 'xy', sz: 'h' } });
    };
    function entries() {
      document.querySelectorAll('#stage [data-edit]').forEach(el => storyEnt(el.dataset.edit));
      Object.keys(state.overrides).forEach(k => { const m = k.match(/^\[data-edit="(.+)"\]$/); if (m) storyEnt(m[1]); });
      return ORDER.concat(Object.values(ENT).filter(e => e.dyn).sort((a, b) => a.name < b.name ? -1 : 1));
    }
    const elsOf = e => { try { return [...document.querySelectorAll(e.sel)].filter(el => stage.contains(el)); } catch (x) { return []; } };
    function entryOf(el) { for (const e of entries()) { try { if (el.matches(e.sel)) return e; } catch (x) {} } return null; }

    /* ---------------- geometry (stage px = the 1920×1080 design space) ---------------- */
    const SR = () => stage.getBoundingClientRect(), K = () => SR().width / 1920;
    const toStage = (cx, cy) => { const r = SR(), k = r.width / 1920; return { x: (cx - r.left) / k, y: (cy - r.top) / k }; };
    function rectOf(el) {   // client rect; elements with no size of their own (#officer is 0 wide) use their children
      const r = el.getBoundingClientRect(); if (r.width >= 2 && r.height >= 2) return r;
      let a = null;
      for (const c of el.querySelectorAll('*')) { const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) continue;
        a = a ? { left: Math.min(a.left, q.left), top: Math.min(a.top, q.top), right: Math.max(a.right, q.right), bottom: Math.max(a.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; }
      return a ? { left: a.left, top: a.top, width: a.right - a.left, height: a.bottom - a.top } : r;
    }
    function boxOf(el) { const r = rectOf(el), s = SR(), k = s.width / 1920; return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k }; }
    const inBox = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    function shown(el) {
      if (!el.isConnected || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
      let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) o *= +getComputedStyle(e).opacity;
      return o > .04;
    }
    function cssVal(el, prop) {
      const cs = getComputedStyle(el), n = v => { v = parseFloat(v); return isNaN(v) ? 0 : v; };
      if (prop === 'maxWidth' || prop === 'width') return n(cs.width);
      if (prop === 'minHeight' || prop === 'height') return n(cs.height);
      if (prop === 'zIndex') return cs.zIndex === 'auto' ? 0 : +cs.zIndex;
      if (prop === 'opacity') return +cs.opacity;
      if (prop === 'rotate' || prop === 'scale') return prop === 'scale' ? 1 : 0;
      return n(cs[prop]);
    }

    /* ---------------- state: overrides + constants, undo/redo, dirty ---------------- */
    let state = { overrides: clone(window.LAYOUT && LAYOUT.overrides), config: clone(window.LAYOUT && LAYOUT.config) };
    let saved = JSON.stringify(state), restored = false;
    try { const d = sessionStorage.getItem(DRAFT); if (d) { state = JSON.parse(d); restored = true; sessionStorage.removeItem(DRAFT); } } catch (e) {}
    const snap = () => JSON.stringify(state), dirty = () => snap() !== saved;
    const undo = [], redo = []; let pending = null, nudgeT = 0;
    const begin = () => { if (pending == null) pending = snap(); };
    const end = () => { if (pending != null && pending !== snap()) { undo.push(pending); if (undo.length > 300) undo.shift(); redo.length = 0; } pending = null; };
    const flush = () => { clearTimeout(nudgeT); end(); };
    const RND = { rotate: 10, scale: 1000, opacity: 100 };
    function setProps(sel, props) {
      const o = state.overrides[sel] || (state.overrides[sel] = {});
      for (const k in props) { const v = props[k]; if (v == null || (k === 'rotate' && Math.abs(v) < .05)) delete o[k]; else o[k] = Math.round(v * (RND[k] || 1)) / (RND[k] || 1); }
      if (!Object.keys(o).length) delete state.overrides[sel];
    }
    function setConfig(k, v) { if (v == null || v === W.CONFIG_DEFAULTS[k]) delete state.config[k]; else state.config[k] = Math.round(v * 100) / 100; }
    // set one field of an entry, following its rules (axis locks, centring, mirrored props, constants)
    function setField(e, field, v) {
      const o = e.o, wp = o.wp || 'width', hp = o.hp || 'height', p = {};
      if (field === 'y' && o.cy) return setConfig(o.cy, v);
      const prop = { x: 'left', y: 'top', w: wp, h: hp }[field] || field;
      p[prop] = v;
      if (field === 'w' && o.mx != null) p.marginLeft = v == null ? null : -v * o.mx;
      setProps(e.sel, p);
      if (o.also) for (const k in o.also) if (prop === k) setProps(o.also[k], { [k]: v });
    }

    let previewed = {};
    function apply(light) {
      SD.applyLayout(state.overrides);
      // rotate/scale: the game's GSAP owns transforms, so live previews go through gsap (core.js layoutCSS explains)
      const want = {};
      for (const sel in state.overrides) { const p = state.overrides[sel]; if (p.rotate != null || p.scale != null) want[sel] = { r: p.rotate || 0, s: p.scale == null ? 1 : p.scale }; }
      for (const sel of new Set(Object.keys(want).concat(Object.keys(previewed)))) {
        const w = want[sel] || { r: 0, s: 1 }, was = previewed[sel] || { r: 0, s: 1 };
        if (w.r === was.r && w.s === was.s && previewed[sel]) continue;
        let t = []; try { t = document.querySelectorAll(sel); } catch (x) {}
        if (t.length) gsap.set(t, { rotation: w.r, scale: w.s, immediateRender: true });
      }
      previewed = want;
      Object.assign(W.CONFIG, W.CONFIG_DEFAULTS, state.config); W.applyConfig();
      viewCSS(); barUI(); syncInspector();
      if (!light) { renderInspector(); renderTree(true); }
    }
    function syncPivot() {   // the launcher fires from the turret wherever the ship / turret now sit
      const ship = $('#ship'), tur = $('#turret'), sv = p => (state.overrides[p.sel] || {});
      const so = sv(ENT['#ship']), to = sv(ENT['#turret']), s = so.scale == null ? 1 : so.scale;
      const sl = so.left != null ? so.left : cssVal(ship, 'left'), st = so.top != null ? so.top : cssVal(ship, 'top');
      const [ox, oy] = getComputedStyle(ship).transformOrigin.split(' ').map(parseFloat);
      const tw = to.width != null ? to.width : cssVal(tur, 'width'), th = to.height != null ? to.height : cssVal(tur, 'height');
      const tl = to.left != null ? to.left : cssVal(tur, 'left'), tt = to.top != null ? to.top : cssVal(tur, 'top');
      setConfig('PIV_X', Math.round(sl + ox + (tl + tw / 2 - ox) * s)); setConfig('PIV_Y', Math.round(st + oy + (tt + th / 2 - oy) * s));
      setConfig('MUZZLE', Math.round(82 * tw / 120 * s));
    }
    function edited(e) { if (e && e.o.piv) syncPivot(); }

    /* ---------------- pause / step / speed ----------------
       The root timeline renders at (ticker time − its startTime) × timeScale and has no parent to re-align it,
       so after every resume / step / speed change we put startTime back where the game time froze (no jump). */
    const ROOT = gsap.globalTimeline, SPEEDS = [.25, .5, .75, 1, 1.5, 2, 3];
    let ts = ROOT.timeScale(), frames = 0;
    const realign = gameTime => ROOT.startTime(gsap.ticker.time - gameTime / ts);
    function setSpeed(v) {
      const t = ROOT.time(); ts = Math.min(3, Math.max(.25, v));
      ROOT.timeScale(ts); realign(t); SD.rate = ts / (SD.SPEED || 1); barUI();
    }
    const speedStep = d => setSpeed(d > 0 ? (SPEEDS.find(s => s > ts + 1e-6) || 3) : (SPEEDS.slice().reverse().find(s => s < ts - 1e-6) || .25));
    function pause() {
      if (SD.paused) return; SD.paused = true; frames = 0;
      ROOT.pause(); gsap.ticker.sleep();
      const ac = SD.audioCtx; if (ac && ac.state === 'running') ac.suspend();
      SD.holdVoice(true); document.body.classList.add('sde-paused'); barUI();
    }
    function resume() {
      if (!SD.paused) return;
      const t = ROOT.time(); SD.paused = false;
      gsap.ticker.wake(); ROOT.resume(); realign(t);
      const ac = SD.audioCtx; if (ac && ac.state === 'suspended') ac.resume();
      SD.holdVoice(false); document.body.classList.remove('sde-paused'); barUI();
    }
    function step() {   // exactly one 60 fps frame of game time (ticker-driven sea life + tweens), then frozen again
      if (!SD.paused) return pause();
      const t = ROOT.time();
      SD.paused = false; gsap.ticker.lagSmoothing(17, 1000 / 60); gsap.ticker.tick();   // asleep → this tick is 1/60 s
      gsap.ticker.lagSmoothing(500, 33); SD.paused = true;
      ROOT.time(t + ts / 60);                         // scrub the paused root: tweens and the game's waits move one frame
      gsap.ticker.sleep(); frames++; barUI();
    }
    const togglePause = () => SD.paused ? resume() : pause();

    /* ---------------- reload into a section ---------------- */
    const ROUNDS = { l1: SCRIPT.D.L1.length, l2: SCRIPT.D.L2.length, l3: SCRIPT.D.L3.length };
    function stash() { try { if (dirty()) sessionStorage.setItem(DRAFT, snap()); else sessionStorage.removeItem(DRAFT); } catch (e) {} }
    function jump(at, round) {
      stash(); const u = new URLSearchParams(location.search);
      u.set('at', at); if (round > 1) u.set('round', round); else u.delete('round'); u.set('edit', '1'); u.set('autostart', '1');
      location.search = u.toString();
    }
    addEventListener('beforeunload', stash);

    /* ---------------- UI ---------------- */
    const root = document.createElement('div'); root.id = 'sde';
    const ICON = {
      eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
      eyeOff: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2l12 12M6.6 3.7A6 6 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.8 2.3M4.2 5A11 11 0 0 0 1.5 8S3.9 12.5 8 12.5c.9 0 1.7-.2 2.4-.5"/></svg>',
      lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>',
      unlock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 5.8-1"/></svg>',
    };
    root.innerHTML = `
      <div id="sde-bar" class="sde-chrome">
        <span class="ttl">✥ Layout editor</span><span class="where" id="sde-where"></span><span class="sep"></span>
        <button class="pause" id="sde-pause" title="Pause / resume everything (P)">⏸ Pause</button>
        <button id="sde-step" title="One frame forward while paused (.)">Step ›</button>
        <button id="sde-slow" title="Slower ([)">−</button><span class="spd" id="sde-spd"></span><button id="sde-fast" title="Faster (])">+</button>
        <span class="sep"></span>
        <button id="sde-restart" title="Reload this section and round">↻ Restart section</button>
        <select id="sde-at" title="Jump to a section">${['hook', 'teach', 'l1', 'l2', 'l3', 'final'].map(a => `<option>${a}</option>`).join('')}</select>
        <select id="sde-round" title="Round"></select><button id="sde-go">Jump</button>
        <span class="sep"></span>
        <button id="sde-tsel" title="Select & move (V)">Select V</button><button id="sde-tplay" title="Play the game; clicks go to the game (H)">Play H</button>
        <span class="sep"></span>
        <button id="sde-undo" title="Undo (⌘/Ctrl Z)">↶</button><button id="sde-redo" title="Redo (⇧⌘/Ctrl Z)">↷</button>
        <span class="grow"></span><span class="dirty" id="sde-dirty"></span>
        <button id="sde-revert" title="Throw away unsaved edits">Revert</button><button class="on" id="sde-saveb" title="Write js/layout.js (⌘/Ctrl S)">Save</button>
        <button id="sde-close" title="Hide the editor (E)">✕</button>
      </div>
      <div id="sde-layers" class="sde-side sde-chrome"><div class="sde-h">Layers</div><div id="sde-tree"></div></div>
      <div id="sde-insp" class="sde-side sde-chrome"><div id="sde-props"></div><div id="sde-consts" class="sde-sec"></div>
        <div class="sde-sec"><h4>Layout file</h4><div class="sde-btns"><button id="sde-save2" class="on">Save layout.js</button><button id="sde-export">Copy / Download…</button><button id="sde-resetall">Reset all</button></div>
        <div class="sde-note" id="sde-savehint"></div></div>
        <div class="sde-sec sde-help"><h4>Shortcuts</h4>
          <kbd>P</kbd> pause · <kbd>.</kbd> step · <kbd>[</kbd> <kbd>]</kbd> speed · <kbd>E</kbd> hide editor<br>
          <kbd>V</kbd> select · <kbd>H</kbd> play · <kbd>Esc</kbd> deselect<br>
          click = topmost · <kbd>Alt</kbd>-click = parent · <kbd>Tab</kbd> = next one under the cursor<br>
          drag = move (<kbd>⇧</kbd> one axis) · handles = resize (<kbd>⇧</kbd> keep ratio) · knob = rotate (<kbd>⇧</kbd> 15°)<br>
          <kbd>←↑↓→</kbd> 1 px · <kbd>⇧</kbd>+arrows 10 px · hold <kbd>Ctrl</kbd>/<kbd>⌘</kbd> = no snapping<br>
          <kbd>⌘Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo · <kbd>⌘S</kbd> save · drag a field's label to scrub</div>
      </div>
      <div id="sde-ov"><div id="sde-insts"></div><div id="sde-hover" class="sde-box" hidden></div>
        <div id="sde-sel" class="sde-box" hidden>${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rot'].map(h => `<i data-h="${h}"></i>`).join('')}</div>
        <div id="sde-read" hidden></div><div id="sde-guides"></div></div>
      <div id="sde-toast"></div>
      <div id="sde-modal" hidden><div class="card"><p id="sde-mmsg"></p><textarea id="sde-mtext" readonly></textarea>
        <div class="sde-btns"><button id="sde-copy" class="on">Copy JSON</button><button id="sde-dl">Download layout.js</button><span class="grow" style="flex:1"></span><button id="sde-mclose">Close</button></div></div></div>`;
    document.body.appendChild(root);
    const view = document.createElement('style'); view.id = 'sde-view'; document.head.appendChild(view);
    const q = id => root.querySelector('#sde-' + id);

    let toastT = 0;
    function toast(msg) { const t = q('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

    let visible = true, tool = 'select';
    function layout() {
      Object.assign(SD.inset, visible ? { l: 232, t: 40, r: 288, b: 0 } : { l: 0, t: 0, r: 0, b: 0 }); SD.fit();
      root.classList.toggle('off', !visible);
      document.body.classList.toggle('sde-select', visible && tool === 'select');
    }
    const setTool = t => { tool = t; if (t === 'play') { hover = null; } layout(); barUI(); };
    const toggleUI = () => { visible = !visible; layout(); toast(visible ? 'Editor on' : 'Editor hidden: press E to bring it back'); };

    function barUI() {
      q('pause').classList.toggle('on', SD.paused); q('pause').textContent = SD.paused ? '▶ Resume' : '⏸ Pause';
      q('step').textContent = SD.paused && frames ? `Step › (${frames})` : 'Step ›';
      q('spd').textContent = (Math.round(ts * 100) / 100) + '×';
      q('tsel').classList.toggle('on', tool === 'select'); q('tplay').classList.toggle('on', tool === 'play');
      q('undo').disabled = !undo.length; q('redo').disabled = !redo.length;
      const d = dirty(); q('dirty').textContent = d ? '● unsaved' : ''; q('revert').disabled = !d;
    }
    function roundOptions() {
      const at = q('at').value, n = ROUNDS[at] || 0, r = q('round');
      r.innerHTML = n ? Array.from({ length: n }, (_, i) => `<option value="${i + 1}">round ${i + 1}</option>`).join('') : '<option value="1">—</option>';
      r.disabled = !n;
    }
    let whereTxt = '';
    function whereUI() {
      const w = SD.where || {}, t = `<b>${w.at || '—'}</b>${ROUNDS[w.at] ? ' · round ' + w.round : ''}${SD.paused ? ' · paused' : ''}`;
      if (t !== whereTxt) { q('where').innerHTML = whereTxt = t; }
    }
    const U = new URLSearchParams(location.search);
    q('at').value = ['hook', 'teach', 'l1', 'l2', 'l3', 'final'].includes(U.get('at')) ? U.get('at') : 'hook'; roundOptions();
    if (!q('round').disabled) q('round').value = U.get('round') || '1';
    q('at').onchange = roundOptions;
    q('go').onclick = () => jump(q('at').value, +q('round').value || 1);
    q('restart').onclick = () => { const w = SD.where || {}; jump(w.at && w.at !== 'title' ? w.at : 'hook', w.round || 1); };
    q('pause').onclick = togglePause; q('step').onclick = step;
    q('slow').onclick = () => speedStep(-1); q('fast').onclick = () => speedStep(1);
    q('tsel').onclick = () => setTool('select'); q('tplay').onclick = () => setTool('play');
    q('undo').onclick = doUndo; q('redo').onclick = doRedo;
    q('saveb').onclick = q('save2').onclick = save; q('export').onclick = () => exportDialog('Copy the JSON, or download layout.js and put it in the js/ folder:');
    q('revert').onclick = () => { if (!confirm('Throw away unsaved edits and go back to js/layout.js?')) return; flush(); undo.push(snap()); state = JSON.parse(saved); apply(); toast('Reverted to the saved layout'); };
    q('resetall').onclick = () => { if (!confirm('Reset every element and constant to the game defaults?')) return; flush(); begin(); state = { overrides: {}, config: {} }; end(); apply(); toast('Everything back to defaults (Save to keep it)'); };
    q('close').onclick = toggleUI;

    function doUndo() { flush(); if (!undo.length) return toast('Nothing to undo'); redo.push(snap()); state = JSON.parse(undo.pop()); apply(); toast('Undo'); }
    function doRedo() { flush(); if (!redo.length) return toast('Nothing to redo'); undo.push(snap()); state = JSON.parse(redo.pop()); apply(); toast('Redo'); }

    /* ---------------- save / export ---------------- */
    const payload = () => ({ overrides: state.overrides, config: state.config });
    const fileText = L => '/* layout overrides written by the in-game editor (index.html?edit=1 → Save). Hand-editing is fine. */\nwindow.LAYOUT = ' + JSON.stringify(L, null, 2) + ';\n';
    const served = /^https?:$/.test(location.protocol);
    q('savehint').innerHTML = served ? 'Saves through <code>tools/dev_server.py</code> into <code>js/layout.js</code>.'
      : 'Opened from a file: Save can’t write files. Run <code>python3 tools/dev_server.py</code> and open <code>localhost:8000/?edit=1</code>, or use Copy / Download.';
    async function save() {
      flush();
      if (!served) return exportDialog('This page was opened from a file, so the browser can’t write js/layout.js. Download it into the js/ folder (or run python3 tools/dev_server.py and open http://localhost:8000/?edit=1):');
      try {
        const r = await fetch('save-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || 'HTTP ' + r.status);
        saved = snap(); window.LAYOUT = clone(payload()); try { sessionStorage.removeItem(DRAFT); } catch (e) {}
        barUI(); toast('Saved js/layout.js ✓');
      } catch (err) { exportDialog(`Save didn’t reach the dev server (${err.message}). Start it with python3 tools/dev_server.py, or export instead:`); }
    }
    function exportDialog(msg) { q('mmsg').textContent = msg; q('mtext').value = fileText(payload()); q('modal').hidden = false; }
    q('mclose').onclick = () => { q('modal').hidden = true; };
    q('copy').onclick = async () => {
      const txt = JSON.stringify(payload(), null, 2);
      try { await navigator.clipboard.writeText(txt); } catch (e) { const ta = q('mtext'); ta.value = txt; ta.select(); document.execCommand('copy'); ta.value = fileText(payload()); }
      toast('JSON copied: paste it after  window.LAYOUT =  in js/layout.js');
    };
    q('dl').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([fileText(payload())], { type: 'text/javascript' }));
      a.download = 'layout.js'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('layout.js downloaded: move it into js/');
    };

    /* ---------------- selection ---------------- */
    let sel = null, hover = null, stack = [], stackI = 0, peekOn = false;
    function select(it, quiet) {
      if (it && !it.el) { const list = elsOf(it.ent); it.el = list.find(shown) || list[0] || null; }
      sel = it; peekOn = false; viewCSS(); renderInspector(); renderTree(true);
      if (it && !quiet && it.el && !shown(it.el)) toast(`${it.ent.name} is not visible right now`);
    }
    function viewCSS() {   // editor-only view rules: hidden layers, "show while editing"
      let css = Object.keys(prefs.hidden).filter(s => prefs.hidden[s]).map(s => `${s}{visibility:hidden!important}`).join('\n');
      if (peekOn && sel) css += `\n${sel.ent.sel}{opacity:1!important;visibility:visible!important}`;
      view.textContent = css;
    }
    const occluders = ['#title', '#story'];
    function hits(p) {   // editable elements under a stage point, topmost first
      let out = [];
      for (const e of entries()) {
        if (prefs.locked[e.sel] || prefs.hidden[e.sel]) continue;
        for (const el of elsOf(e)) if (shown(el) && inBox(boxOf(el), p)) out.push({ ent: e, el });
      }
      const occ = occluders.map(s => $(s)).find(o => o && shown(o) && inBox(boxOf(o), p));
      if (occ) out = out.filter(h => occ.contains(h.el));
      return out.sort((a, b) => a.el === b.el ? 0 : (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : -1);
    }
    function parentOf(it) {
      for (let el = it.el.parentElement; el && el !== stage; el = el.parentElement) { const e = entryOf(el); if (e && !prefs.locked[e.sel]) return { ent: e, el }; }
      return null;
    }

    /* ---------------- gestures: move / resize / rotate ---------------- */
    let G = null, lines = [];
    function snapTargets(it) {
      const xs = [0, 960, 1920], ys = [0, 540, 1080];
      for (const e of entries()) {
        if (e === it.ent || prefs.hidden[e.sel]) continue;
        for (const el of elsOf(e)) {
          if (el.contains(it.el) || it.el.contains(el) || !shown(el)) continue;
          const b = boxOf(el); if (b.w < 2 || b.h < 2) continue;
          xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
        }
      }
      return { xs, ys };
    }
    function nearest(ms, ts) { const tol = 6 / K(); let best = null; for (const m of ms) for (const t of ts) { const d = t - m; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; } return best; }
    const cur = (e, prop) => { const o = state.overrides[e.sel] || {}; return o[prop] != null ? o[prop] : null; };
    function startGesture(kind, ev, it, dir) {
      flush();
      const el = it.el, e = it.ent, o = e.o, b0 = boxOf(el), p0 = toStage(ev.clientX, ev.clientY);
      const v = (prop, fb) => { const c = cur(e, prop); return c != null ? c : fb(); };
      G = { kind, dir, it, p0, b0, moved: false, T: snapTargets(it),
        L: v('left', () => cssVal(el, 'left')), Tp: v('top', () => cssVal(el, 'top')),
        W0: v(o.wp || 'width', () => cssVal(el, 'width')), H0: v(o.hp || 'height', () => cssVal(el, 'height')),
        S0: v('scale', () => 1), R0: v('rotate', () => 0), C0: o.cy ? W.CONFIG[o.cy] : 0 };
      if (kind === 'rot') { G.c = { x: b0.x + b0.w / 2, y: b0.y + b0.h / 2 }; G.a0 = Math.atan2(p0.y - G.c.y, p0.x - G.c.x); }
    }
    function moveGesture(ev) {
      const p = toStage(ev.clientX, ev.clientY), e = G.it.ent, o = e.o, noSnap = ev.ctrlKey || ev.metaKey;
      let dx = p.x - G.p0.x, dy = p.y - G.p0.y;
      if (!G.moved) { if (Math.hypot(dx, dy) * K() < 3) return; G.moved = true; begin(); }
      lines = [];
      if (G.kind === 'move') {
        const canX = /x/.test(o.mv || ''), canY = /y/.test(o.mv || '') || !!o.cy;
        if (!canX && !canY) { if (!G.warned) { G.warned = 1; toast(`${e.name}: position is set by the game`); } return; }
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (!canX) dx = 0; if (!canY) dy = 0;
        if (!noSnap && !G.R0) {
          const b = G.b0, sx = canX && nearest([b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], G.T.xs), sy = canY && nearest([b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], G.T.ys);
          if (sx) { dx += sx.d; lines.push({ x: sx.t }); } if (sy) { dy += sy.d; lines.push({ y: sy.t }); }
        }
        if (o.cy) setConfig(o.cy, Math.round(G.C0 + dy));
        else { const pr = {}; if (canX) pr.left = G.L + dx; if (canY) pr.top = G.Tp + dy; setProps(e.sel, pr); }
      } else if (G.kind === 'size') {
        const r = G.R0 * Math.PI / 180; if (r) { const c = Math.cos(r), s = Math.sin(r); [dx, dy] = [dx * c + dy * s, -dx * s + dy * c]; }
        const d = G.dir, hx = /e/.test(d) ? 1 : /w/.test(d) ? -1 : 0, hy = /s/.test(d) ? 1 : /n/.test(d) ? -1 : 0, b = G.b0;
        if (o.sz === 'scale') {
          const fx = hx ? (b.w + hx * dx) / b.w : 0, fy = hy ? (b.h + hy * dy) / b.h : 0;
          const f = hx && hy ? (Math.abs(fx - 1) > Math.abs(fy - 1) ? fx : fy) : (fx || fy);
          setProps(e.sel, { scale: Math.max(.1, G.S0 * f) });
        } else {
          if (!noSnap && !G.R0) {
            const sx = hx && nearest([hx > 0 ? b.x + b.w + dx : b.x + dx], G.T.xs), sy = hy && nearest([hy > 0 ? b.y + b.h + dy : b.y + dy], G.T.ys);
            if (sx) { dx += sx.d; lines.push({ x: sx.t }); } if (sy) { dy += sy.d; lines.push({ y: sy.t }); }
          }
          const kx = b.w / G.W0 || 1, ky = b.h / G.H0 || 1;   // screen px per CSS px (scaled parents)
          let w = G.W0 + hx * dx / kx, h = G.H0 + hy * dy / ky;
          const both = /w/.test(o.sz) && /h/.test(o.sz);
          if (ev.shiftKey && both) {
            const ar = G.W0 / G.H0;
            if (hx && hy) { if (Math.abs(w / G.W0 - 1) > Math.abs(h / G.H0 - 1)) h = w / ar; else w = h * ar; }
            else if (hx) h = w / ar; else w = h * ar;
          }
          w = Math.max(4, w); h = Math.max(4, h);
          const pr = {};
          if (/w/.test(o.sz)) { pr.w = w; if (hx < 0 && /x/.test(o.mv || '') && o.mx == null) pr.x = G.L + (G.W0 - w); }
          if (/h/.test(o.sz)) { pr.h = h; if (hy < 0 && /y/.test(o.mv || '')) pr.y = G.Tp + (G.H0 - h); }
          for (const k in pr) setField(e, k, pr[k]);
        }
      } else if (G.kind === 'rot') {
        let a = G.R0 + (Math.atan2(p.y - G.c.y, p.x - G.c.x) - G.a0) * 180 / Math.PI;
        a = ((a + 540) % 360) - 180; if (ev.shiftKey) a = Math.round(a / 15) * 15;
        setProps(e.sel, { rotate: a });
      }
      edited(e); apply(true);
    }
    function endGesture() {
      if (!G) return;
      const was = G; G = null; lines = [];
      if (was.moved) { end(); apply(); }
    }
    root.querySelectorAll('#sde-sel i').forEach(h => h.addEventListener('pointerdown', ev => {
      if (!sel || !sel.el) return; ev.preventDefault(); ev.stopPropagation();
      startGesture(h.dataset.h === 'rot' ? 'rot' : 'size', ev, sel, h.dataset.h);
    }));

    /* ---------------- input routing: the editor owns the stage in Select mode and while paused ---------------- */
    const onStage = ev => stage.contains(ev.target) || ev.target === document.body || ev.target === document.documentElement;
    addEventListener('pointerdown', ev => {
      if (!visible || ev.target.closest('#sde') || !onStage(ev)) return;
      if (tool === 'play' && !SD.paused) return;
      ev.stopPropagation(); ev.preventDefault();
      if (tool === 'play') return toast('Paused: press P to play');
      const ac = SD.audioCtx; if (ac && ac.state === 'suspended' && !SD.paused) ac.resume();   // a reload with autostart has no gesture yet
      const p = toStage(ev.clientX, ev.clientY), H = hits(p);
      let it;
      const underSel = sel && sel.el && sel.el.isConnected && inBox(boxOf(sel.el), p);
      if (ev.altKey) { const base = underSel ? sel : H[0]; it = base ? (parentOf(base) || base) : null; }
      else it = underSel ? sel : H[0];
      stack = H; stackI = Math.max(0, H.findIndex(h => it && h.el === it.el));
      if (!it) { if (sel) select(null); return; }
      if (!sel || sel.el !== it.el || sel.ent !== it.ent) select(it, true);
      startGesture('move', ev, it);
    }, true);
    for (const t of ['pointerup', 'click', 'dblclick', 'mousedown', 'mouseup', 'touchstart', 'touchend']) addEventListener(t, ev => {
      if (!visible || ev.target.closest('#sde') || !onStage(ev) || (tool === 'play' && !SD.paused)) return;
      ev.stopPropagation(); if (ev.cancelable && t !== 'pointerup') ev.preventDefault();
    }, true);
    let hoverPt = null, hoverDue = false;
    addEventListener('pointermove', ev => { if (G) return moveGesture(ev); hoverPt = visible && tool === 'select' && onStage(ev) ? toStage(ev.clientX, ev.clientY) : null; hoverDue = true; });
    // capture phase: the stage blockers above stop propagation, and listeners on the same phase still run
    addEventListener('pointerup', endGesture, true); addEventListener('pointercancel', endGesture, true); addEventListener('blur', endGesture);

    function nudge(dx, dy) {
      if (!sel) return; const e = sel.ent, o = e.o;
      const canX = /x/.test(o.mv || ''), canY = /y/.test(o.mv || '') || !!o.cy;
      if ((dx && !canX) || (dy && !canY)) return toast(`${e.name}: that direction is set by the game`);
      begin();
      if (o.cy) setConfig(o.cy, W.CONFIG[o.cy] + dy);
      else { const pr = {}; if (dx) pr.left = (cur(e, 'left') != null ? cur(e, 'left') : cssVal(sel.el, 'left')) + dx; if (dy) pr.top = (cur(e, 'top') != null ? cur(e, 'top') : cssVal(sel.el, 'top')) + dy; setProps(e.sel, pr); }
      edited(e); apply(true); clearTimeout(nudgeT); nudgeT = setTimeout(() => { end(); apply(); }, 700);
    }
    addEventListener('keydown', ev => {
      if (isField(ev.target)) { if (ev.key === 'Escape') ev.target.blur(); return; }
      const k = ev.key, mod = ev.metaKey || ev.ctrlKey;
      if ((k === 'e' || k === 'E') && !mod && !ev.altKey) { ev.preventDefault(); return toggleUI(); }
      if (mod && (k === 'z' || k === 'Z')) { ev.preventDefault(); return ev.shiftKey ? doRedo() : doUndo(); }
      if (mod && k === 'y') { ev.preventDefault(); return doRedo(); }
      if (mod && k === 's') { ev.preventDefault(); return save(); }
      if (mod || ev.altKey) return;
      if (k === 'p' || k === 'P') return togglePause();
      if (k === '.') return step();
      if (k === '[') return speedStep(-1);
      if (k === ']') return speedStep(1);
      if (!visible) return;
      if (k === 'v' || k === 'V') return setTool('select');
      if (k === 'h' || k === 'H') return setTool('play');
      if (k === 'Escape') { if (!q('modal').hidden) q('modal').hidden = true; else select(null); return; }
      if (k === 'Tab' && stack.length) {
        ev.preventDefault(); stackI = (stackI + (ev.shiftKey ? stack.length - 1 : 1)) % stack.length; select(stack[stackI], true);
        return toast(`${stackI + 1} / ${stack.length} · ${stack[stackI].ent.name}`);
      }
      const n = ev.shiftKey ? 10 : 1, A = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[k];
      if (A && sel) { ev.preventDefault(); nudge(A[0], A[1]); }
    });

    /* ---------------- layers panel ---------------- */
    let treeSig = '';
    function renderTree(force) {
      const list = entries(), present = list.map(e => elsOf(e).some(shown) ? 1 : elsOf(e).length ? 2 : 0);
      const sig = [sel && sel.ent.sel, present.join(''), Object.keys(state.overrides).join('|'), JSON.stringify(prefs), list.length].join('#');
      if (!force && sig === treeSig) return; treeSig = sig;
      let html = '', grp = null;
      list.forEach((e, i) => {
        if (e.group !== grp) { grp = e.group; html += `<div class="sde-grp">${grp}</div>`; }
        const n = elsOf(e).length, set = state.overrides[e.sel] || (e.o.cy && state.config[e.o.cy] != null);
        html += `<div class="sde-row${sel && sel.ent === e ? ' sel' : ''}${present[i] === 1 ? '' : ' off'}" data-sel='${e.sel.replace(/'/g, '&#39;')}' style="padding-left:${12 + e.depth * 14}px" title="${e.sel.replace(/"/g, '&quot;')}${present[i] ? '' : ' · not on screen now'}">
          <span class="nm">${e.name}</span>${n > 1 ? `<span class="n">×${n}</span>` : ''}${set ? '<span class="dot" title="edited"></span>' : ''}
          <span class="ic${prefs.hidden[e.sel] ? ' act' : ''}" data-act="hide" title="Hide while editing">${prefs.hidden[e.sel] ? ICON.eyeOff : ICON.eye}</span>
          <span class="ic${prefs.locked[e.sel] ? ' act' : ''}" data-act="lock" title="Lock (can't be picked on the stage)">${prefs.locked[e.sel] ? ICON.lock : ICON.unlock}</span></div>`;
      });
      q('tree').innerHTML = html;
    }
    q('tree').addEventListener('click', ev => {
      const row = ev.target.closest('.sde-row'); if (!row) return;
      const e = ENT[row.dataset.sel], act = ev.target.closest('[data-act]');
      if (act) { const m = act.dataset.act === 'hide' ? prefs.hidden : prefs.locked; m[e.sel] = !m[e.sel]; if (!m[e.sel]) delete m[e.sel]; savePrefs(); viewCSS(); renderTree(true); return; }
      select({ ent: e, el: null });
    });

    /* ---------------- inspector ---------------- */
    const FIELDS = [['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H'], ['rotate', '↻'], ['scale', 'Sc'], ['opacity', 'Op'], ['zIndex', 'Z'], ['fontSize', 'Aa']];
    function fieldInfo(e, f) {
      const o = e.o, wp = o.wp || 'width', hp = o.hp || 'height';
      const prop = { x: 'left', y: 'top', w: wp, h: hp }[f] || f;
      const ok = { x: /x/.test(o.mv || ''), y: /y/.test(o.mv || '') || !!o.cy, w: /w/.test(o.sz || ''), h: /h/.test(o.sz || ''), rotate: !o.cy, scale: o.sz === 'scale', opacity: true, zIndex: true, fontSize: !!o.t }[f];
      if (f === 'y' && o.cy) return { prop: o.cy, ok, cfg: o.cy, val: W.CONFIG[o.cy], set: state.config[o.cy] != null };
      const c = cur(e, prop), el = sel && sel.el;
      return { prop, ok, val: c != null ? c : el ? cssVal(el, prop) : '', set: c != null };
    }
    function renderInspector() {
      const box = q('props');
      if (!sel) { box.innerHTML = '<div class="sde-sec"><div class="sde-name">Nothing selected</div><div class="sde-meta">Click something on the stage, or a layer. Pause (P) first to catch moving things.</div></div>'; renderConsts(); return; }
      const e = sel.ent, n = elsOf(e).length, o = e.o;
      const hide = f => (f === 'scale' && o.sz !== 'scale') || (f === 'fontSize' && !o.t) || ((f === 'w' || f === 'h') && o.sz === 'scale');
      box.innerHTML = `<div class="sde-sec"><div class="sde-name">${e.name}</div><div class="sde-meta"><code>${e.sel.replace(/</g, '&lt;')}</code> · ${n ? n + ' on screen' : 'not on screen now'}</div></div>
        <div class="sde-sec"><h4>Layout <span>stage px</span></h4><div class="sde-grid">${FIELDS.filter(([f]) => !hide(f)).map(([f, lab]) => {
          const fi = fieldInfo(e, f);
          return `<div class="sde-f${fi.set ? ' set' : ''}${fi.ok ? '' : ' dis'}" data-f="${f}" title="${fi.ok ? (fi.cfg ? 'game constant ' + fi.cfg : fi.prop) : 'set by the game'}"><label>${lab}</label><input type="number" step="${f === 'scale' || f === 'opacity' ? .01 : f === 'rotate' ? .5 : 1}" ${fi.ok ? '' : 'disabled'}></div>`;
        }).join('')}</div>
        ${o.cy ? `<div class="sde-note">Submarines sit where the game puts them: Y edits the constant <code>${o.cy}</code>.</div>` : ''}
        ${!o.mv && !o.cy ? '<div class="sde-note">The game moves this one itself; you can size it.</div>' : ''}
        <label class="sde-chk"><input type="checkbox" id="sde-peek"${peekOn ? ' checked' : ''}> Show while editing (ignores its fades)</label>
        <div class="sde-btns"><button id="sde-reset1">Reset element</button></div></div>`;
      syncInspector(true);
      box.querySelectorAll('.sde-f:not(.dis)').forEach(fd => {
        const f = fd.dataset.f, inp = fd.querySelector('input');
        const commit = v => { flush(); begin(); if (fieldInfo(e, f).cfg) setConfig(e.o.cy, v); else if (['x', 'y', 'w', 'h'].includes(f)) setField(e, f, v); else setProps(e.sel, { [f]: v }); edited(e); end(); apply(); };
        inp.addEventListener('change', () => commit(inp.value === '' ? null : +inp.value));
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); });
        fd.querySelector('label').addEventListener('pointerdown', ev => {   // drag the label to scrub the value
          ev.preventDefault(); const x0 = ev.clientX, v0 = +inp.value || 0, st = +inp.step || 1; begin();
          const mv = m => { const v = Math.round((v0 + (m.clientX - x0) * st * (m.shiftKey ? 10 : 1)) / st) * st; inp.value = +v.toFixed(3);
            if (fieldInfo(e, f).cfg) setConfig(e.o.cy, +inp.value); else if (['x', 'y', 'w', 'h'].includes(f)) setField(e, f, +inp.value); else setProps(e.sel, { [f]: +inp.value }); edited(e); apply(true); };
          const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); end(); apply(); };
          addEventListener('pointermove', mv); addEventListener('pointerup', up);
        });
      });
      q('peek').onchange = ev => { peekOn = ev.target.checked; viewCSS(); };
      q('reset1').onclick = () => {
        flush(); begin(); delete state.overrides[e.sel]; if (o.also) Object.values(o.also).forEach(s => delete state.overrides[s]);
        if (o.cy) setConfig(o.cy, null); edited(e); end(); apply(); toast(`${e.name} back to default`);
      };
      renderConsts();
    }
    function syncInspector(all) {
      if (!sel) return;
      q('props').querySelectorAll('.sde-f').forEach(fd => {
        const inp = fd.querySelector('input'); if (!all && document.activeElement === inp) return;
        const fi = fieldInfo(sel.ent, fd.dataset.f), v = typeof fi.val === 'number' ? Math.round(fi.val * 100) / 100 : fi.val;
        if (inp.value !== String(v)) inp.value = v; fd.classList.toggle('set', !!fi.set);
      });
      q('consts').querySelectorAll('.sde-k').forEach(r => { const inp = r.querySelector('input'), k = r.dataset.k; if (document.activeElement !== inp) inp.value = W.CONFIG[k]; r.classList.toggle('set', state.config[k] != null); });
    }
    const CNOTE = { X0: 'x of 0 on the scale', STEP: 'px per whole number', SUB_Y: 'submarine centre y', SUB_ROW: 'extra depth for a close neighbour', SIG_Y1: 'L3 top signal row', SIG_Y2: 'L3 bottom signal row', SIG_GAP: 'px between signal columns', PIV_X: 'launcher pivot x', PIV_Y: 'launcher pivot y', MUZZLE: 'pivot → torpedo start' };
    let constsBuilt = false;
    function renderConsts() {
      if (constsBuilt) return syncInspector(); constsBuilt = true;
      q('consts').innerHTML = `<h4>Game constants <button id="sde-piv" title="Aim from the turret's current position">Pivot ← turret</button></h4>` +
        Object.keys(W.CONFIG_DEFAULTS).map(k => `<div class="sde-k" data-k="${k}"><span>${k}<small>${CNOTE[k] || ''} · default ${W.CONFIG_DEFAULTS[k]}</small></span><input type="number" step="1"><button class="rs" title="Back to ${W.CONFIG_DEFAULTS[k]}">↺</button></div>`).join('');
      q('consts').querySelectorAll('.sde-k').forEach(r => {
        const k = r.dataset.k, inp = r.querySelector('input');
        inp.addEventListener('change', () => { flush(); begin(); setConfig(k, inp.value === '' ? null : +inp.value); end(); apply(); });
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); });
        r.querySelector('.rs').onclick = () => { flush(); begin(); setConfig(k, null); end(); apply(); };
      });
      q('piv').onclick = () => { flush(); begin(); syncPivot(); end(); apply(); toast('Launcher pivot follows the turret'); };
      syncInspector();
    }

    /* ---------------- overlay: drawn every frame (things move even while you edit) ---------------- */
    const pool = []; let guideSig = '';
    const place = (d, r) => { d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px'; };
    let lastPresence = 0;
    (function draw(t) {
      requestAnimationFrame(draw);
      if (!visible) return;
      whereUI();
      if (t - lastPresence > 700) { lastPresence = t; renderTree(); }
      const s = SR(), k = s.width / 1920, selBox = q('sel'), read = q('read');
      // selection (rotated around its centre when it has a rotate override)
      if (sel && sel.el && sel.el.isConnected) {
        const r = rectOf(sel.el), rot = (state.overrides[sel.ent.sel] || {}).rotate || 0;
        let box = { left: r.left, top: r.top, width: r.width, height: r.height };
        if (rot) {
          const sc = gsap.getProperty(sel.el, 'scaleX') || 1, w = (parseFloat(getComputedStyle(sel.el).width) || r.width / k) * k * sc, h = (parseFloat(getComputedStyle(sel.el).height) || r.height / k) * k * sc;
          box = { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h };
        }
        place(selBox, box); selBox.style.transform = rot ? `rotate(${rot}deg)` : ''; selBox.hidden = false;
        selBox.classList.toggle('ghost', !shown(sel.el));
        const o = sel.ent.o, hs = o.sz === 'scale' || o.sz === 'wh' ? 'nw n ne e se s sw w' : o.sz === 'w' ? 'e w' : o.sz === 'h' ? 'n s' : '';
        selBox.querySelectorAll('i').forEach(h => { h.style.display = (h.dataset.h === 'rot' ? !o.cy : hs.split(' ').includes(h.dataset.h)) ? '' : 'none'; });
        const x = (box.left - s.left) / k, y = (box.top - s.top) / k;
        read.textContent = `${Math.round(x)}, ${Math.round(y)} · ${Math.round(box.width / k)} × ${Math.round(box.height / k)}${rot ? ' · ' + Math.round(rot * 10) / 10 + '°' : ''}`;
        read.style.left = (r.left + r.width / 2) + 'px'; read.style.top = (r.top + r.height + 8) + 'px'; read.hidden = false;
      } else { selBox.hidden = true; read.hidden = true; }
      // the other instances one rule changes (all scale numbers, all submarines…)
      const others = sel ? elsOf(sel.ent).filter(el => el !== sel.el && shown(el)) : [];
      while (pool.length < others.length) { const d = document.createElement('div'); d.className = 'sde-box sde-inst'; q('insts').appendChild(d); pool.push(d); }
      pool.forEach((d, i) => { d.hidden = i >= others.length; if (!d.hidden) place(d, rectOf(others[i])); });
      // hover
      const hv = q('hover');
      if (G || !hoverPt) hover = null; else if (hoverDue) { hoverDue = false; hover = hits(hoverPt)[0] || null; }
      if (hover && (!sel || hover.el !== sel.el)) { place(hv, rectOf(hover.el)); hv.hidden = false; } else hv.hidden = true;
      // smart guides
      const gsig = lines.map(l => l.x != null ? 'x' + l.x : 'y' + l.y).join() + s.left + s.width;
      if (gsig !== guideSig) guideSig = gsig, q('guides').innerHTML = lines.map(l => l.x != null
        ? `<div class="sde-guide v" style="left:${s.left + l.x * k}px;top:${s.top}px;height:${s.height}px"></div>`
        : `<div class="sde-guide h" style="top:${s.top + l.y * k}px;left:${s.left}px;width:${s.width}px"></div>`).join('');
    })(0);

    layout(); apply(); renderInspector();
    toast(restored ? 'Unsaved edits restored (Save to keep them)' : 'Editor on · P pause · V select · H play · E hide');
    window.SDE = { pause, resume, step, setSpeed, select: s => select({ ent: ENT[s] || storyEnt(s), el: null }), get state() { return clone(state); }, save, toggleUI };
  }
})();
