# Sonar Defence — integers on the navigation scale (Grade 6)

Open `index.html` in Chrome (double-click works; a local server is fine too).

Flow: Hook (Commander Meera & Cadet Riya: harbour → sonar room → dive through the porthole) → Navigation-scale teaching → Level 1 Compare (with a first-mission tutorial) → Level 2 Order → Level 3 Combine signals → Final mixed mission.

## Voices (Indian English, Gemini TTS)
1. In Terminal: `cd Sonar_Defence_Game && python3 -m http.server` then open http://localhost:8000/tools/voice_studio.html in Chrome.
2. Paste your Gemini API key into the page (it stays in that tab only — it is never written to any file).
3. "Choose the Sonar_Defence_Game folder" → "Test Meera + Riya" → "Generate missing lines".
   Files land in `assets/vo/<id>.wav` and `assets/vo/vo_manifest.js` (the list the game reads). Reload the game.
- Not Indian enough? Change the voice or the director's notes and press ↻ on a line.
- Without recorded files the game falls back to the browser's voice (en-IN when the computer has one), then to reading time.

## Test shortcuts (URL)
- `?at=teach | l1 | l2 | l3 | final` start at a section, `&round=2` start at a round
- `&speed=2` faster animations, `&mute=1` no sound/voice, `&autostart=1` skip the title button
- In the story: tap = next line, "Skip story" jumps to the dive.

## Files
- `js/script.js` EVERY spoken line ({id, who, text}) + level data. The game and the Voice Studio both read it — edit lines here.
- `js/core.js` stage fit, sound (Web-Audio sfx + tanpura/underwater music bed, ducked under voice), voice playback (recorded VO → browser voice), comms portrait + captions, Meera's poses on the ship
- `js/world.js` parallax sea (sky, far reef, fish schools, manta, rays, caustics, marine snow, kelp sway, bubbles, waves), ship + launcher, navigation scale (x = 960 + 100·value, −8…+8), submarines (tap rings, propeller bubbles), lock-on/torpedo/blast (flash, shockwave, debris), hints, hand demos, badges, L3 signals + defence marker
- `js/levels.js` flow + pedagogy: hook scenes, teaching, tutorial, 3-strike (Oops + direction arrow → Hint + rule card → Nudge + hand), idle help (6 s visual → 12 s spoken → 22 s reminder), stars
- `tools/voice_studio.html` makes the voice files
- `assets/img` web versions of the art pack

## Placeholders still in code (replace when the art arrives)
- launcher turret → inline SVG in index.html (`#turret`)
- rule card → CSS (`#rule`)
- left signal → `sig.webp` mirrored + recoloured in CSS (`.sig.neg`)
- fish & manta → inline SVG in `world.js`
