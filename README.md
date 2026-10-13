# Sonar Defence — integers on the navigation scale (Grade 6)

Open `index.html` in Chrome: double-click it, or press **Go Live** in VS Code (Live Server serves this folder, so the game opens straight away).

The game is played from inside the submarine cockpit (see *The cockpit* below).

Flow: Story (from the story sheet, with Commander Meera & Cadet Riya: harbour with enemy submarines slipping in → the control-room doors open on a red alert → the navigation screen with defence line 0 → submarines at −6 and +5 → missiles launch → targets confirmed, MISSION 1 → dive through the porthole → How to play: a live demo round in the cockpit — the glow shows the mission, the number and the submarine, the cannon slides over and fires, with a step chip for each of the sheet's four steps) → Navigation-scale teaching → Level 1 Compare (with a first-mission tutorial) → Level 2 Order → Level 3 Combine signals → Final mixed mission.

```
index.html          the game
css/                game.css (layout, stage px) · cockpit.css (window frame, cannon, crew, console screen) · editor.css (layout editor only)
js/                 script.js (every spoken line) · core · world · cockpit · levels · qa · editor · layout.js · gsap.min.js
assets/img/         all art, .webp (cover.webp = the title screen)      assets/vo/   all voice lines, .ogg + vo_manifest.js      assets/fonts/
tools/              make_voices.py (records the voices) · dev_server.py (lets the editor save)
```
The original art pack (PNG sources, concepts, briefs) is not needed by the game; it was moved out to `~/Downloads/Sonar_Defence_Archive_2026-10-09/` and is also in this repo's git history.

## Deploy (Vercel)
It is a static site: no build step. Import the repo (or drag this folder into Vercel) and keep **Framework Preset: Other**, no build command, **Root Directory `./`**. `vercel.json` pins the preset; `.vercelignore` leaves `tools/` and the docs out of the upload. If the Vercel project was created while the game lived in `Sonar_Defence_Game/`, set its Root Directory back to `./`. The layout editor's Save needs `tools/dev_server.py`, so on Vercel it offers Copy / Download instead.

## Voices (Indian English, Gemini TTS)
Every spoken line lives in `js/script.js`. `tools/make_voices.py` records them (Python 3 standard library + `node` to read the script):

```sh
export GEMINI_API_KEY=…            # from https://aistudio.google.com/apikey — never put it in a file
python3 tools/make_voices.py       # makes every line that has no wav yet
```
- Writes `assets/vo/<id>.ogg` (Ogg Opus, 48 kbps mono, through `ffmpeg`; `.wav` if ffmpeg is missing or with `--wav`) and rewrites `assets/vo/vo_manifest.js` (the list the game plays) after every file. Reload the game.
- `--check` transcribes the recorded lines and lists any whose words differ (TTS sometimes ad-libs); `--verify` re-takes a line until the words match.
- `--only h1,h2` / `--who riya` pick lines · `--force` re-records · `--dry-run` shows what would be made (no key needed)
- `--meera Kore --riya Leda` change the prebuilt voices · `--model auto` (default) picks the newest Flash TTS model · `--lang en-IN` also sends a language code
- The director's notes (accent, acting) are `PROFILE` at the top of the script. Audio is trimmed, faded and normalised to −1 dBFS (`--no-polish` keeps it raw). Newer TTS models return a whole WAV with a C2PA block: only its audio data is kept.
- Rate limits are retried automatically; if the daily quota runs out, just run it again later — finished lines are skipped.
- Without recorded files the game falls back to the browser's voice (en-IN when the computer has one), then to reading time.

## The cockpit
The camera is inside the submarine, looking out through the big bow window (`assets/img/cockpit.webp`, the window glass is transparent; glass y 112–914).
- The enemy submarines are out in the water; the navigation scale sits low on the glass, flat and evenly spaced (the same −8 … +8). Dotted sonar lines join each submarine to its number.
- The bow cannon (`assets/img/cannon.webp`, made with Nano Banana 2) is seen from behind, aiming out to sea, and rides the console rail under the scale. Tap a submarine and it slides along to that submarine's column (it lines up with the number), then fires straight ahead: recoil, muzzle flash, and the torpedo runs away from us (it shrinks) behind the scale to the target. Home is under 0; it glides back there between missions. The cockpit jolts on launch and hit; a hit submarine sinks behind the scale.
- A miss: the cannon lines up under the wrong submarine and judders (no shot), the two ceiling lamps flash red and the window edge glows red.
- Meera (left) and Riya (right) stand at their stations; whoever speaks plays their talking sheet and lights up. Dialogue appears on the console screen, which shows a slow sonar trace when nobody is talking.
- Level 3 pair buttons sit high in the window, above the submarines. Cancelling a pair: the ▶ and ◀ collide, a ring bursts and a big glowing **0** springs out.
- Fun layer (`js/cockpit.js`, bottom): every hit shakes the view (one whole-pixel shake of all layers, `W.shake` in `js/world.js`) and the submarine's number pops up big over its label; fish scatter from the blast; the enemy crew bail out in an escape pod with a white flag (`escape_pod.webp`); blast bubbles stick to the glass and slide down. Three first-try hits in a row turn the cannon gold and the next shot is a golden super torpedo. Every other time we sail on, a turtle, octopus or jellyfish (`turtle/octopus/jelly.webp`, Nano Banana 2) swims up and knocks on the window. Each level dives deeper: the sea darkens a step, glowing plankton appear, and the console shows the depth (60 → 110 → 160 → 220 m). When a level is done, Meera's and Riya's stations glow and sparkle.
- Art: the cockpit frame (`assets/img/cockpit.webp`, glass cut out) and the cannon are Gemini images in the game's style; the cannon's muzzle position is `MUZZLE_Y` in `js/cockpit.js` (read from `#cannon` in `css/cockpit.css`).
- Code: `js/world.js` draws the sea, scale, submarines and effects; `js/cockpit.js` adds the sliding bow cannon (`W.aimHook`, `W.fire`), the crew and the cockpit effects; `css/cockpit.css` holds its layout. Layout constants (`SUB_Y`, `SUB_ROW`, `SIG_Y1/2`, `SCALE_DY`) are `DEFAULTS` in `js/world.js`.
- The earlier ship-at-the-surface version was removed; it is still in the git history (before commit "Keep only the submarine cockpit version").

## QA jumper (for testers)
Press **Q** in the game (Q again hides it), or add `?qa=1` to the URL (e.g. `https://<your-vercel-link>/?qa=1`). A small **QA ▾** panel (top-left) jumps straight into any part and starts playing:
story (Harbour · Control room · Dive), Teaching, every round of Level 1–3 and the Final mission. While playing: **Skip line**, **Answer ✓** (taps the right submarine / pair), **Restart part**; choose 1×/2×/3× speed and sound for the next jump. After a jump the panel stays on. (URL equivalents: `?at=hook&scene=2`, `?at=l3&round=4`, `?at=final&round=3`.)

## Sound
Recorded music + ambience + effects live in `assets/sfx/` (all `.ogg`): two loops composed for the game with Google Lyria (calm for the story, playful for the missions, crossfading at the dive), harbour gulls + waves, sea waves, and CC0 Freesound effects (sonar, torpedo, underwater explosion, splash, water rush, sci-fi door, bubbles) — see `assets/sfx/CREDITS.md`. Taps, chimes and the reward arpeggio are synthesized. Music dips under every voice line. Over http(s) everything plays through Web Audio; from `file://` through `<audio>` elements.

## Characters
In the story conversations (harbour + control room) and at their cockpit stations, Meera and Riya are the Ludo talking sheets `meera_talk_sheet.webp` / `riya_talk_sheet.webp`: 6×6 whole full-body frames, played exactly as drawn while that character's line is spoken (Meera 79 ms/frame, Riya 90 ms/frame). When the line ends the character runs on to the next closed-mouth frame and holds it; the listener stays still. Frame sizes and the closed-mouth frame lists are in `SHEET` in `js/core.js`; the source PNG + JSON are in the archive folder.

## Pause + layout editor ("Figma inside the game")
Players never see it. Open `index.html?edit=1`, or press **E** in the game.

```sh
python3 tools/dev_server.py        # serves the game and lets Save write js/layout.js
open http://localhost:8000/?edit=1
```
- **P** pause/resume everything (animations, sea life, CSS loops, music, voice: it resumes mid-word) · **.** one frame · **[ ]** speed 0.25×–3× · **E** hide/show the editor
- Top bar: section/round, Restart section, Jump to (hook / teach / l1–l3 / final + round), Select **V** / Play **H** (Play passes clicks to the game), undo/redo, Save
- Select: click = topmost element · **Alt**-click = its parent · **Tab** = the next one under the cursor · **Esc** deselects
- Move: drag (⇧ = one axis), arrows 1 px / ⇧ 10 px. Resize: the 8 handles (⇧ keeps the ratio). Rotate: the knob (⇧ = 15° steps). Magenta smart guides snap to the stage centre/edges and other elements; hold **Ctrl/⌘** to turn snapping off
- Layers (left): eye = hide while editing, lock = can't be picked on the stage. Inspector (right): X/Y/W/H/rotation/opacity/z/font size (drag a label to scrub), "Show while editing" for things that are faded out, Reset element
- **Game constants** (Inspector): numbers that come from code (`CONFIG` in `js/world.js`): scale origin/step, submarine rows, L3 signal rows, scale offset
- **Save** writes `js/layout.js` through `tools/dev_server.py`. From `file://` the browser can't write files: use Copy JSON / Download layout.js and put it in `js/`. ⌘/Ctrl+Z, ⇧⌘/Ctrl+Z undo/redo; unsaved edits survive Jump/Restart
- `js/layout.js` = `window.LAYOUT = { overrides: { "<selector>": { left, top, width, height, rotate, scale, opacity, zIndex, fontSize … } }, config: { SUB_Y: … } }`, applied at boot by `core.js` as one `<style id="layoutOverrides">` (so submarines and story bubbles created later pick it up too). Story actors/bubbles are keyed by their `data-edit` name
- Rotation/scale on things the game itself rotates or scales (the cannon's lean, pop-ins) are overwritten by those animations

## Test shortcuts (URL)
- `?at=teach | l1 | l2 | l3 | final` start at a section, `&round=2` start at a round
- `&speed=2` faster animations, `&mute=1` no sound/voice, `&autostart=1` skip the title button
- In the story: tap = next line, "Skip story" jumps to the dive.

## Files
- `js/script.js` EVERY spoken line ({id, who, text}) + level data. The game and `tools/make_voices.py` both read it — edit lines here (and re-record: `--only <id> --force`).
- `js/core.js` stage fit, sound (Web-Audio sfx + tanpura/underwater music bed, ducked under voice), voice playback (recorded VO → browser voice), captions + name tag, the talking sheets
- `js/world.js` parallax sea (far reef, seabed, fish schools, manta, rays, caustics, marine snow, bubbles), navigation scale (x = 960 + 100·value, −8…+8), submarines (tap rings, propeller bubbles), lock-on/blast (flash, shockwave, debris), hints, the helper glow (tutorial + nudges), badges, L3 signals + defence marker
- `js/cockpit.js` the bow cannon + torpedo, the crew at their stations, console screen, warning lamps, hull kick
- `js/qa.js` the QA jumper (`?qa=1`)
- `js/editor.js` + `css/editor.css` the pause + layout editor (inert unless `?edit=1` / E) · `js/layout.js` saved layout overrides · `tools/dev_server.py` local server that saves them
- `js/levels.js` flow + pedagogy: story scenes (lines `s1`–`s11`, how-to `hp1`–`hp4`, ending `finEnd` → ROUTE CLEARED!), teaching, tutorial, 3-strike (Oops + direction arrow → Hint + rule card → Nudge + pulsing glow on the answer), idle help (6 s visual → 12 s spoken → 22 s reminder), stars
- `tools/make_voices.py` makes the voice files
- `assets/img` web versions of the art pack (all `.webp`; the sonar-room doors are `door_left/right.webp`)

## Placeholders still in code (replace when the art arrives)
- rule card → CSS (`#rule`)
- left signal → `sig.webp` mirrored + recoloured in CSS (`.sig.neg`)
- fish & manta → inline SVG in `world.js`

## HUD
During play, what Meera or Riya says appears in a speech bubble beside her (Meera bottom-left, Riya bottom-right) with its tail pointing at the speaker.
One bar on the ceiling holds the hear-again button, the mission text and the progress pips (`#hudbar`). The ceiling lamps are toned down (`#lampDim`), the crew are 15 % smaller and dim until they speak, the console shows the sonar trace + depth only between missions, fish swim below the scale (never behind the submarine row), and number labels not in play are faded to 50 %.
