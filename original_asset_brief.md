# Sonar Defence — ChatGPT image prompts (concept + full asset pack)

How to use
1. Paste **Prompt 0 (Style Bible)** first in a new ChatGPT chat. Keep the whole asset run in that same chat so the style stays consistent.
2. Run **Part A** (4 concept screens) to see the game. Agree the look before making assets.
3. Run **Part B** one prompt at a time. After each image, ask ChatGPT for "the same, transparent PNG, no background" if it adds one.
4. Sprite sheets (marked 🎞): get the key poses from ChatGPT, then build the 6×6 sheet in ludo.ai like the Pari sheets.
5. Wide panoramas (marked ↔): ChatGPT's widest output is 1536×1024. Ask for "seamless left–right tile" and I'll stitch and resize.

---

## Prompt 0 — Style Bible (paste first)

```
You are the art director for "Sonar Defence", a 2D side-view underwater maths game for 11–12-year-olds (Grade 6, integers on a number line). Every image in this chat must follow this style exactly:

STYLE
- Stylised 3D cartoon render, game-asset clean, like a modern mobile game: chunky rounded shapes, soft bevels, glossy-but-not-plastic materials, gentle subsurface glow, soft ambient occlusion.
- Same family as our earlier game art (warm, friendly, Indian setting), but this world is the sea: teal / aqua / deep navy water, sunlit surface, warm coral and sand accents.
- Lighting: sunlight from the TOP-LEFT, soft caustic ripples on objects underwater, cyan rim light on underwater objects.
- Camera: strict SIDE VIEW (orthographic feel, no perspective tilt) unless I say otherwise.
- Child-safe: playful, never scary or violent. Explosions are big bubbly underwater "pops" with no fire, smoke plumes or debris of people. No crew visible in enemy subs. No blood, no weapons aimed at people.
- Our side: a FICTIONAL coast guard (white hull, navy blue and saffron-orange stripes, a simple anchor-and-wave emblem). Do NOT use any real country flag, real coast guard logo, real navy insignia or real ship names.
- Enemy side: fictional, toy-like dark gunmetal / charcoal submarines with red-orange glowing portholes and a simple fin emblem. No flags, no country markings.

TECHNICAL
- Unless told otherwise: single object, centred, on a TRANSPARENT background (PNG with alpha), no drop shadow on the ground, no text, no numbers, no letters, no watermarks. All numbers and words are added later in code.
- Leave clean margins (5%) around the object.
- Consistent scale: an enemy submarine is about 1/3 the length of our coast guard ship.

Reply "Style locked" and wait for my asset prompts.
```

---

## Part A — Concept screens (to visualise the game, 1536×1024, full scene)

**A1 · Hook / title**
```
Full scene, 16:9 landscape, side view. A bright coastal sea route at golden morning. On the surface at top: our white coast guard ship with a launcher turret on its deck. Below the waterline the view cuts away into a clear underwater cross-section: sunbeams, aqua water fading to navy, a sandy seabed with coral and kelp. Across the middle of the water runs a glowing cyan sonar "navigation scale" — a long horizontal line with evenly spaced tick marks and a brighter centre tick (leave the labels blank). Four dark toy-like enemy submarines with orange glowing portholes lurk under different ticks. A dashed red-orange laser "defence line" runs vertically near the right edge. Leave the top-centre empty for a game title. Follow the style bible.
```

**A2 · Level 1 gameplay (compare)**
```
Same world as A1, gameplay screen. Our ship small at top-left with its launcher turret rotated toward a target. Navigation scale across the middle (blank tick labels, centre tick brighter). Only TWO enemy submarines, one left of centre and one right of centre. A glowing cyan lock-on reticle ring around the right-hand submarine and a torpedo with a bubble trail heading to it. A clean empty strip across the top for a mission sentence, a small round speaker button top-left, a row of 6 small sonar pips at top-centre. Calm, uncluttered, big readable shapes. Follow the style bible.
```

**A3 · Level 2 gameplay (ordering sweep)**
```
Same world, gameplay screen. FIVE enemy submarines under five different ticks of the navigation scale. The two left-most are already hit: they are sinking with bubble bursts and each has a round gold badge above it (badges blank, numbers added later). A faint glowing sweep arrow along the scale points from left to right. Launcher turret aiming at the third submarine. Uncluttered. Follow the style bible.
```

**A4 · Level 3 gameplay (combining signals)**
```
Same world, gameplay screen. One enemy submarine releasing glowing "signal" pulses into the water: several arrow-shaped cyan pulses pointing RIGHT and several arrow-shaped orange pulses pointing LEFT, arranged in two rows above the navigation scale. One cyan and one orange pulse are touching and popping into a white sparkle bubble. A round glowing defence marker pin sits on the centre tick of the scale. Uncluttered. Follow the style bible.
```

---

## Part B — Asset pack (transparent PNG unless stated)

### Backgrounds & parallax (the "moving forward" feel)
Layers scroll at different speeds; the scale and submarines stay still.

**B1 · sky_and_surface ↔ (3840×360 → seamless tile)**
```
Seamless left-right tileable strip, side view: bright morning sky with soft clouds on top, the sea surface line across the bottom with gentle waves and sparkling highlights; below the waterline just the first few pixels of light aqua water. Opaque, no objects, no ships.
```

**B2 · water_gradient (1920×1080, opaque)**
```
Full-frame underwater background, side view: clear aqua just under the surface fading smoothly to deep navy at the bottom, very soft volumetric haze, a few distant faint particles. Completely empty: no seabed, no fish, no objects. Opaque.
```

**B3 · far_silhouettes ↔ (3840×700, transparent)**
```
Seamless left-right tileable strip of very distant underwater rock arches and reef silhouettes, low contrast navy-teal, heavily fogged by water, sitting along the bottom half. Transparent above. Side view.
```

**B4 · seabed_mid ↔ (3840×420, transparent)**
```
Seamless left-right tileable strip of sandy seabed with rounded rocks, coral clusters, sea fans and a few shells, mid-distance, soft caustic light on the sand. Flat top edge is transparent. Side view.
```

**B5 · foreground_kelp ↔ (3840×800, transparent)**
```
Seamless left-right tileable strip of close foreground kelp fronds and dark rocks, rising from the bottom edge, slightly out of focus and darker (very near the camera), with gaps so the middle of the screen stays clear. Transparent background.
```

**B6 · light_rays (1920×1080, transparent)**
```
Soft diagonal sunbeams (god rays) shining down from the top-left through water, pale cyan-white, semi-transparent, nothing else. Transparent PNG.
```

**B7 · caustics_tile (1024×1024, seamless both ways)**
```
Seamless tileable texture of underwater light caustics: thin bright wavy cell lines on transparent, white-cyan. Tiles left-right and top-bottom.
```

**B8 · bubbles_set (1536×1024, transparent)**
```
A loose set of 12 separate glossy underwater bubbles of different sizes (tiny to large) spread out with space between them, cartoon 3D, transparent background. I will cut them apart.
```

### Our side

**C1 · coast_guard_ship (1400×520)**
```
Our fictional coast guard patrol ship, strict side view facing RIGHT, floating: white hull with navy and saffron-orange stripes, anchor-and-wave emblem on the hull (no text), bridge with windows, radar mast, life rings. The deck has an EMPTY round mount near the front where a turret will sit (no turret). The lower hull below the waterline is visible and slightly tinted aqua.
```

**C2 · launcher_turret (480×480)**
```
A rotating defence launcher turret for the ship, side view: rounded navy-and-white housing with saffron trim and a single short barrel pointing straight DOWN-RIGHT at 45°, friendly toy-like look. Pivot centre clearly at the middle of the round base. Nothing else.
```

**C3 · torpedo (420×120)**
```
A friendly cartoon torpedo, side view pointing RIGHT: white-and-saffron body, navy fins, small glowing cyan tip, tiny propeller at the back. No text.
```

**C4 · torpedo_trail (600×160)**
```
A horizontal trail of small bubbles and a light wake streak, getting thinner and fading toward the LEFT end, as left behind by a moving torpedo. Transparent.
```

### Enemy submarines

**D1 · enemy_sub (720×300)**
```
A fictional enemy mini-submarine, strict side view facing LEFT, toy-like and rounded: dark gunmetal hull, a short conning tower with a periscope, three round portholes glowing red-orange, a small fin emblem, propeller at the back. Slightly mischievous but not scary. No flags, no text.
```

**D2 · enemy_sub_variants (1536×1024, three subs side by side)**
```
Three versions of the same enemy mini-submarine from the previous image, same size and angle, side by side with space between: (1) the normal one, (2) a teal-grey hull version, (3) a plum-purple hull version. Same portholes and emblem. Transparent.
```

**D3 · enemy_sub_hit (720×300)**
```
The same enemy submarine just after being hit: hull dented, portholes flickering dark, a few cracks letting out streams of bubbles, tilting nose-down 15°. Cartoon, not scary.
```

**D4 · bubble_blast 🎞 (keyframes)**
```
An underwater cartoon "pop" explosion with no fire: a big burst of white and cyan bubbles with a bright soft flash at the centre and a ring shockwave. Show 4 stages left to right on transparent: (1) small bright flash, (2) expanding bubble ring, (3) big bubble cloud, (4) bubbles drifting up and fading.
```

### Navigation scale & targeting (all blank — numbers are code)

**E1 · nav_scale_bar (3000×160)**
```
A long horizontal glowing sonar track for a number line: a sleek dark-navy glass rail with a bright cyan glowing line along it and soft light along its length, rounded ends. No ticks, no numbers. Transparent.
```

**E2 · scale_ticks (1536×1024, separate pieces)**
```
Separate pieces on transparent, spaced apart: (1) a small cyan glowing tick mark, (2) a taller brighter tick, (3) a special centre-zero tick: a glowing white-gold ring with a short vertical bar, (4) a small rounded number plate (dark glass with cyan edge, blank) to hold a number.
```

**E3 · lock_on_reticle (512×512)**
```
A circular targeting lock-on reticle: thin glowing cyan ring with four inward brackets and a small centre dot, sonar-style, friendly game UI. Transparent.
```

**E4 · defence_marker (300×360)**
```
A glowing defence marker pin that sits on the number line: a rounded saffron-orange buoy-shaped pin with a cyan glowing ring at its base and a small flag-less beacon light on top. Transparent.
```

**E5 · defence_line (240×1080)**
```
A vertical defence barrier made of a dashed red-orange glowing laser line with small floating buoys/emitters at the top and bottom, slightly pulsing. Transparent.
```

**E6 · sweep_arrow (1400×200)**
```
A long soft glowing chevron arrow pointing RIGHT made of several cyan chevrons fading from left to right, for showing a sweep direction along the scale. Transparent. (I will mirror it for left.)
```

### Level 3 signals

**F1 · signal_right (260×160)**
```
A glowing energy pulse shaped like a rounded arrow pointing RIGHT, bright cyan with a soft trail on its left side, sonar-wave style. Transparent.
```

**F2 · signal_left (260×160)**
```
The same energy pulse but pointing LEFT and coloured warm orange, soft trail on its right side. Transparent.
```

**F3 · zero_pair_pop (400×400)**
```
A cyan pulse and an orange pulse colliding and cancelling: a round white sparkle bubble burst with a soft ring, balanced cyan-and-orange sparks. Transparent.
```

**F4 · signal_pod (300×300)**
```
A small round signal buoy released from the enemy submarine: dark gunmetal sphere with a glowing ring that emits sonar waves. Transparent.
```

### UI

**G1 · mission_strip (1600×170)**
```
A wide rounded mission banner for game UI: dark navy glass with a thin cyan glowing border, small sonar-wave ornament at the left end, empty inside for text. Transparent.
```

**G2 · rule_card (700×300)**
```
A hint card for UI: rounded dark-navy glass panel with a cyan border, split into two halves — left half has a big orange arrow pointing LEFT, right half has a big cyan arrow pointing RIGHT; empty space under each arrow for words. No text. Transparent.
```

**G3 · hint_arrow (500×200)**
```
A big friendly glowing hint arrow pointing RIGHT, bright yellow-saffron with a soft glow, chunky 3D. Transparent. (I will mirror it.)
```

**G4 · sequence_badge (240×240)**
```
A round gold medal badge with a navy rim and a small anchor at the top, empty flat centre for a number. Transparent.
```

**G5 · ui_buttons (1536×1024, separate pieces)**
```
Separate game UI buttons on transparent, spaced apart, matching style: (1) round speaker/replay button, navy with cyan icon of a speaker; (2) round skip button with a double-chevron icon; (3) a sonar progress pip OFF (dark glass dot); (4) a sonar progress pip ON (bright cyan glowing dot); (5) a wide rounded pill button, saffron-orange, empty for text.
```

**G6 · route_progress (1600×120 + ship icon)**
```
A slim horizontal route progress bar: a wavy sea-route line from a small harbour/lighthouse icon on the LEFT to a small safe-harbour flag-less pier icon on the RIGHT, plus a separate tiny coast guard ship icon (side view, facing right) that slides along it. Transparent, no text.
```

**G7 · complete_card_frame (1000×1100)**
```
A level-complete card frame for game UI: rounded panel of light sea-foam glass with a navy and saffron border, a ribbon at the top (blank), soft bubbles around the edges, empty centre for stars and text. Transparent.
```

**G8 · stars (two images)**
```
A chunky glossy 3D gold star with a soft glow; then the same star in silver. Transparent.
```

### Characters (🎞 = make a sprite sheet afterwards)

**H1 · officer_turnaround (1536×1024)**
```
Character design sheet: a friendly Indian coast guard officer in her early 30s (fictional), confident and warm, short dark hair under a navy cap, white uniform shirt with navy and saffron shoulder tabs, navy trousers, a small anchor badge (no real insignia), binoculars round her neck. Same 3D cartoon style. Show front view, 3/4 view and side view, full body, neutral standing pose, on transparent.
```

**H2 · officer_poses (separate images, full body, transparent)**
```
The same coast guard officer, full body, 3/4 view facing RIGHT, in these poses (one image each): (1) idle, hands relaxed; (2) pointing to the right with an open hand, explaining; (3) pointing to the left; (4) thumbs-up, happy; (5) cheering with both arms up; (6) thinking, hand on chin; (7) looking through binoculars.
```

**H3 · officer_talk 🎞 (key poses for a 6×6 sheet)**
```
The same officer, waist-up, 3/4 view facing RIGHT, explaining while speaking: show 6 key frames of a natural talking-gesture loop (mouth open/closed variations, hands moving gently). Same size and position in every frame, transparent.
```

**H4 · cadet_player (optional) (1536×1024)**
```
Optional: a young cadet (11–12 years old, fictional Indian boy or girl in a junior coast guard cap and navy-white uniform) who stands at the launcher controls; show idle, aiming (looking right, focused) and cheering, full body, transparent.
```

### Hook story backgrounds (opaque, 1920×1080 → generate 1536×1024)

**I1 · harbour_dawn**
```
Opaque full scene: a peaceful Indian coastal harbour at dawn, lighthouse, fishing boats, our white coast guard ship docked; a sea route marked by floating buoys leading out to the horizon. Warm and calm. No text.
```

**I2 · sonar_room**
```
Opaque full scene: the ship's sonar room interior, side view, with a big wall screen showing a glowing cyan sonar line (blank, no numbers) and a few red-orange blips, consoles with soft lights, a porthole showing the sea. Friendly, not military-dark. No text.
```

---

## After generating — tell me

- Which files you have, and where you dropped them (folder name).
- If any piece needs a different angle (e.g. subs facing right).
I'll then trim, resize, cut the sheets and wire everything into the Figma clean build.
