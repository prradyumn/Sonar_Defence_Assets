# Sonar Defence: handover prompt for Claude in VS Code

Paste this whole file into Claude in VS Code, with the `Sonar_Defence_Game` folder open.

---

## 1. Context: what this project is

**Sonar Defence** is a Grade 6 maths game about integers on a number line ("navigation scale"). It is written in plain **HTML + CSS + JS**, with GSAP vendored in `js/gsap.min.js`. There is no build step: double-click `index.html` to play.

- **Stage:** fixed **1920×1080**, scaled to the window by `fit()` in `core.js` (`#stage` uses `transform: translate() scale()`).
- **Art style:** 3D-cartoon webp sprites live in `assets/img/`. The source pack is the parent folder `Sonar_Defence_Assets/`.
- **Characters:**
  - **Commander Meera**: the coast-guard officer. On the ship she uses full-body poses `off_*.webp`; her talking portrait uses `meera_talk_1..6.webp`.
  - **Cadet Riya**: the young cadet. Sprites are `riya_idle.webp` and `riya_cheer.webp`.
- **Flow:**
  1. Hook story (harbour → sonar room → dive through the porthole).
  2. Teaching the scale.
  3. **L1 Compare:** tutorial hand demo, then missions.
  4. **L2 Order:** sweep left→right or right→left.
  5. **L3 Combine signals:** pair opposite signals to cancel them, then the marker moves.
  6. **Final mixed mission.**
- **Pedagogy rules (keep them):**
  - **3-strike loop:** wrong 1 = "Oops" + direction arrow. Wrong 2 = hint + rule card. Wrong 3 = others dimmed, hand appears, only the right submarine is tappable.
  - **Idle help:** 6 s visual nudge → 12 s spoken hint → 22 s reminder.
  - **Low cognitive load:** never crowd the screen.

### Files
| File | Role |
|---|---|
| `index.html` | DOM layers (world → scale → play → fx → ship → kelp → HUD → overlays) |
| `css/game.css` | All layout. Positions are in stage px (1920×1080). |
| `js/script.js` | **Every spoken line** `{id, who, text}` plus level data. `SCRIPT.LINES`, `SCRIPT.spoken(text)` (turns −3 into "minus 3", `<` into "is less than"…), `SCRIPT.find(text)`. |
| `js/core.js` | `SD` namespace: stage fit, Web-Audio SFX, tanpura/underwater music (ducked under voice), `say(line, opts)`, VO playback, comms portrait, Meera's poses. |
| `js/world.js` | `W` namespace: parallax sea and life (fish, manta, marine snow, kelp sway), ship + turret, scale (`X(v) = 960 + 100·v`, v = −8…+8), submarines, tapping (`W.waitTap`), lock/fire/blast, hints, hand demos, L3 signals and marker. |
| `js/levels.js` | Flow and missions (`hook`, `teach`, `tutorial`, `level1/2/3`, `finalMission`, `complete`, `run`). |
| `assets/vo/` | Voice files `<id>.wav` + `vo_manifest.js` (`window.VO_HAVE = [ids]`). The game plays only the ids listed there; otherwise it falls back to browser speech. |
| `tools/voice_studio.html` | Old browser-based TTS page. It is replaced by the Python script in Task 1. |

### Test URLs
- Start at a section: `index.html?at=hook|teach|l1|l2|l3|final&round=2`
- Other flags: `&speed=2`, `&mute=1`, `&autostart=1`
- In the console: `GAME_RESULT` holds stars per level, and `SD_MISSING` lists spoken lines that are not in `script.js` (it must stay empty).

### Hard rules
- **Never write an API key into any file:** no `.env`, no code, no config, no logs. Read it only from the environment variable `GEMINI_API_KEY`.
- Don't rename line ids in `script.js` without regenerating their audio.
- Keep everything working when opened by double-click (`file://`): no `fetch` of local JSON at runtime. Use `<script>` files instead.

---

## 2. Task 1: generate all voices with Python (Gemini TTS)

Create `tools/make_voices.py` (standard library only: `urllib`, `json`, `base64`, `wave`, `subprocess`, `argparse`).

1. **Get the lines.** Run `node -e` to load `js/script.js` with a fake `window` object, then print JSON of `SCRIPT.LINES` with `spoken` added to each line (`SCRIPT.spoken(text)`). Fail with a clear message if node is missing.
2. **Get the key.** Read it from `os.environ["GEMINI_API_KEY"]`. If it is missing, print `export GEMINI_API_KEY=...` usage and exit. Never print the key.
3. **Pick the model.** Default to `--model auto`: call `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=200` (header `x-goog-api-key`), keep names containing `tts`, and prefer the highest version that has `flash`.
4. **Set the voices.** Defaults: `meera=Kore`, `riya=Leda`, overridable with `--meera` and `--riya`.
5. **Build the prompt** for each line using the persona and director's notes. Copy `PROFILE` from `tools/voice_studio.html`: natural **Indian English** accent, numbers slow and clear, Meera warm-but-firm, Riya a bright 11-year-old girl. The prompt format is:
   ```
   # AUDIO PROFILE: <name>\n<persona>\n### DIRECTOR'S NOTES\nStyle: <style>\nAccent: Indian English.\n#### TRANSCRIPT\n<spoken text>
   ```
6. **Call the API:** `POST .../models/{model}:generateContent` with this body:
   ```
   {contents:[{parts:[{text}]}], generationConfig:{responseModalities:["AUDIO"], speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}}}}
   ```
   The reply contains `inlineData` (base64 **PCM 16-bit mono**; read the rate from the mimeType, default 24000). Write it to `assets/vo/<id>.wav` with the `wave` module.
7. **Optional polish:** trim leading and trailing silence and normalise the peak to about −1 dBFS (pure Python on the samples).
8. **Command-line options:**
   - Skip ids that already have a wav unless `--force`.
   - `--only h1,h2` and `--who riya` select a subset.
   - On 429 or 5xx, retry using `retryDelay` from the error details (backoff, 6 tries). Stop on 401/403.
9. **After every file,** rewrite `assets/vo/vo_manifest.js` as `window.VO_HAVE = [...ids that have a wav...];`.
10. **Finish** by printing a summary (made / skipped / failed) and a README line: `export GEMINI_API_KEY=… && python3 tools/make_voices.py`.

Then delete `tools/voice_studio.html` and update `README.md`.

**Verify:**
- Generate `--only h1,h2` and listen to both.
- Open `index.html?at=hook` and confirm Meera and Riya speak with the recorded audio. The captions should stay in sync and the music should duck under the voices.

---

## 3. Task 2: in-game pause and layout editor (a "Figma inside the game")

Add `js/editor.js` and `css/editor.css`, loaded last in `index.html`. Turn it on with `?edit=1` or by pressing **E**. Players must never see it unless they use those.

### Pause and step
- **P** pauses or resumes everything:
  - `gsap.globalTimeline.pause()` together with `gsap.ticker.sleep()`/`wake()`, so parallax, fish, snow and bubbles freeze.
  - `AC.suspend()`/`resume()` for Web Audio. Expose `SD.audioCtx` from `core.js` for this.
  - Pause the current VO `<audio>` and `speechSynthesis`.
  - Freeze the `setInterval` spawners: guard them with a global `SD.paused` flag.
- **.** (period) advances one frame while paused.
- **[ / ]** slows down or speeds up the game (`timeScale` 0.25×–3×).
- Show a top bar with: section/round, timeScale, and buttons for Pause, Step, Restart section, and a "Jump to" menu (hook / teach / l1 / l2 / l3 / final + round). The jump reloads with `?at=&round=&edit=1`.

### Select, move and resize (Figma-like)
- **Selecting:**
  - Click selects the deepest element marked as editable.
  - Mark editable elements with `data-edit="name"`, or put them in a list in `editor.js`. Include: `#ship`, `#officer`, `#deckRail`, `#turret`, `#strip`, `#pips`, `#btnSpeak`, `#rule`, `#comms`, `#portrait`, `#caption`, `#pName`, `#rail`, `.lbl`, `.sub`, `#marker`, `#hand`, `#kelp`, `#far`, `#seabed`, `#banner .card`, `#done .card` and its children, `#title .logo`, `#start`, the story `.actor`/`.bubble`.
  - **Alt-click** selects the parent. **Tab** cycles through overlapping elements.
- **The selection box** shows 8 resize handles, a rotate handle, and a live readout of **x, y, w, h, rotation in stage px**. Convert the mouse position with the stage scale: `(clientX − stageRect.left) / scale`.
- **Editing:**
  - Drag to move. Arrow keys nudge 1 px; Shift+arrow nudges 10 px.
  - Shift-drag keeps the aspect ratio while resizing.
  - Smart guides snap to the stage centre and edges and to other elements' edges and centres (magenta lines, like Figma). Hold Ctrl to turn snapping off.
- **Panels:**
  - Layers panel on the left: tree of editable elements, eye icon (hide), lock icon.
  - Inspector on the right: numeric x/y/w/h/rotation/opacity/z-index fields, plus font-size for text elements.
- **Undo/redo:** Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z.

### Saving edits
- Store edits as overrides keyed by a stable selector: `{ "#strip": {left, top, width, height, rotate, fontSize, ...} }`.
- Apply them at boot from `js/layout.js` (`window.LAYOUT = {...}`) by injecting a `<style id="layoutOverrides">` with `!important` rules. Elements created at runtime (subs, bubbles) pick up the rules automatically through their class selectors.
- **Save** writes `js/layout.js`:
  - Add `tools/dev_server.py`, a small `http.server` that serves the folder and accepts `POST /save-layout` to write `js/layout.js`.
  - When opened via `file://`, fall back to "Copy JSON" and "Download layout.js".
- **Reset element** and **Reset all** buttons.
- **Positions set by script:** some positions come from code, not CSS — submarine depth `SUB_Y`, the scale mapping `X(v)`, signal rows, turret pivot `PIV`. Move these numbers into one `CONFIG` object in `world.js` and show them in an Inspector "Game constants" section, so they can be tuned live and saved into `layout.js` as well.

**Verify:**
1. Pause mid-torpedo and confirm everything freezes, audio included.
2. Move and resize `#strip`, save, reload, and confirm the change is kept.
3. With `?edit` off, there must be no editor UI and no extra listeners.
4. Run a full game at `&speed=3` and confirm `GAME_RESULT` has all four levels and `SD_MISSING` is empty.

---

## 4. Order of work
1. Task 1 (voices).
2. Task 2 (pause/step first, then select/move/resize, then save).
3. Update `README.md` after each task.

Make small commits. Ask before changing pedagogy, line text or art.
