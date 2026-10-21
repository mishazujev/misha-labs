# Bench Chemistry Lab — 3D handoff (Chemistry Bench 3D)

This is the brief for the next developer or AI who will take the 3D prototype (`lab3d.html`, "Acid–Alkali Bench 3D") to production quality and extend it to every experiment. The 2D lab (`lab.html`) remains the reference for content, chemistry, teacher dashboard and scoring.

## 1. What exists

| Piece | 2D lab (`lab.html`) | 3D prototype (`lab3d.html`) |
|---|---|---|
| Experiments | 12 (4 topics × 3 levels) | 1: acid + alkali (+ carbonate fizz) |
| Languages | Estonian, Russian, English | same strings + `x.*` keys |
| Teacher dashboard, assignments, results | yes (shared database) | not yet |
| Chemistry engine | `engine.js` | the same file, unchanged |
| Rendering | 2.5D canvas | three.js r160, physically based materials |
| Interaction | drag, hold to tilt and pour | the same rules in 3D |

## 2. Architecture (keep these layers separate)

1. **Chemistry engine** (`engine.js`, plain functions, no rendering)
   - `speciate(tot, V)` solves pH by charge balance (strong acids and bases, NH₄⁺/NH₃, acetate, carbonate), metal hydroxides and carbonates (Ksp), and salts (AgCl, AgI, PbI₂, BaSO₄, PbSO₄, PbCl₂).
   - `equilibrate(vessel)` also releases CO₂ above solubility (0.035 M) and returns the mmol of gas.
   - `indColor(ind, pH)` and `vesselLook(vessel)` give the colour of indicators and ions.
   - Units: `tot` in mmol, `V` in mL.
2. **State**
   - `chem = {V, tot, ind, cap}` describes what is in the beaker.
   - `S` holds temperature, gas, stirring and the notebook.
   - Every action becomes an `addLiquid(comp, dV, x, z)` call.
   - A notebook entry is written when a pour "session" ends, after 0.8 s with no flow.
3. **Assets**: `make*()` factories, each a procedural placeholder (see §4). Every asset must keep the same pivot, size and named sub-parts when replaced.
4. **FX**:
   - liquid surface (meniscus, ripples, stirring vortex);
   - colour plumes and colour easing;
   - bubbles (nucleation sites plus air dragged in by pouring), foam, splash droplets;
   - pour stream (tube along a curve) and falling drops.
5. **Input**: raycast pick → carry on a horizontal plane → magnet zone over the beaker → tilt → flow.

## 3. Interaction rules (must stay identical across all experiments)

- **No buttons for lab actions.** Everything is done by picking up, carrying, holding and releasing. Buttons are allowed only for the language, reset and answer form.
- **Pouring (bottles and beakers), physically based:**
  - Each container has a shape model (`makeShape`): the cavity volume is sampled once; for any tilt θ it returns the height of a level surface holding V mL (a local point's world height is y·cosθ − u·sinθ, u towards the spout) and the capacity below the lowest point of the mouth.
  - The liquid is drawn as the cavity mesh clipped by a world-space horizontal plane at that height, so the surface stays level and drops as liquid leaves.
  - Liquid above the capacity flows out: Q = min(Qmax, 4·excess + 0.25) mL/s (bottle Qmax 25, beaker 30). Below 0.8 mL/s it falls as single 0.05 mL drops.
  - Mouth-down, capacity is 0, so the container empties (a beaker keeps its 0.4 mL wall film).
  - Bottles hold a finite stock (180 mL each, refilled by "New experiment"); an empty bottle is logged.
  - Tilt is controlled by the student: bringing a container over a target snaps the spout over the near side of its mouth and tilts it to 4° short of the pouring angle for its current fill. Dragging down tilts further (0.45 °/px), dragging up tilts back; a large sideways drag or dragging up past upright ends the pour. A floating note under the target explains this while pouring.
- **Putting down:** everything stays where it is released. `findSpot` nudges it off other objects, the balance and the sink. The glass rod and electrode go back into their stands when released near them, otherwise lie flat on the bench. Droppers return to their own bottle.
- **Pipettes** (3 mL plastic transfer pipette read to 0.1 mL; 10 mL glass graduated pipette with pump read to 0.05 mL):
  - Carry one into a beaker or upright reagent bottle and rest there for 0.2 s; the tip dips to the bottom.
  - While still holding, drag up to draw liquid in, drag down to let it out (3 mL: 0.015 mL/px; 10 mL: 0.04 mL/px; flow 2 and 4 mL/s). A note above the pipette shows the volume.
  - Released inside a beaker, it stands there; released elsewhere, it lies on the bench and any liquid in it is spilled (logged as a mistake).
  - Mistakes logged: dipping a used pipette into a different reagent bottle; letting liquid out into a stock bottle.
- **Touch comfort** (the finger must never hide what matters):
  - On touch screens the held object is aimed 72 px above the fingertip, so it stays visible.
  - While pouring, pipetting or dropping, a status pill at the top of the view shows live values (tilt angle and mL poured; volume in the pipette; drop count) and the gesture reminder. The view toolbar and ? fade out while something is held.
  - Auto-zoom (on by default, toggle in the view toolbar): when a pour or pipette engages, the camera flies close to the target, keeping the current viewing side, and frames the container and target in the upper part of the view; it flies back when the pour ends.
  - Short vibrations (where the device supports them) when liquid starts to flow, on each drop, and when a pipette is full or empty.
- **Shake / swirl:** while holding an object, a quick side-to-side wiggle of the finger or mouse (3+ direction changes of 12 px or more within 0.7 s) counts as a shake; so does a real phone shake (acceleration > 14 m/s² three times within 0.7 s) where the browser delivers motion events. A shaken beaker mixes fully (stir = 1), ripples, splashes when nearly full, and the notebook logs "swirled". Every held object jiggles visibly. `onShake(o)` is the hook new equipment uses (rinsing test tubes, dissolving solids).
- **Phone tilt while pouring:** where the browser delivers orientation events, tipping the phone sideways adds 1.6° of bottle tilt per degree of phone roll on top of the drag gesture. iPhone asks once for motion permission on the first touch. Drag control always remains, so desktop and interactive whiteboards work unchanged.
- **Quick places:** a "Go to" row above the bench flies the camera to the whole bench, work area, reagents, balance, pH meter or sink (portrait screens step back 35 %). Double-tap still flies to any tapped spot. Each experiment should define its own place list.
- **All buttons sit above the bench, outside the 3D view;** only the live status pill and help notes appear on top of it.
- **Pipette reading:** when a pipette engages, auto-zoom frames the whole pipette from almost eye level (12°), so the pump and scale stay in view. The pipette turns its scale towards the camera; the scale carries numbered majors (1 mL on the 10 mL pipette, 0.5 mL on the 3 mL one) and a dark meniscus line marks the liquid top. A square magnifier (top right, 30 % of the short side, 38 % on phones) shows the meniscus and nearby marks at eye level, rendered by a second camera into a scissored viewport. In a reagent bottle the tip dips just 2 cm under the surface so the scale stays above the label, and the bottle cap is off while the pipette is in it.
- **Pipette control is speed-sensitive:** slow drags move 0.006 mL/px (10 mL) or 0.002 mL/px (3 mL); fast drags up to 0.06 / 0.02 mL/px. Pour and pipette modes stay engaged even when the finger leaves the bench area of the screen.
- **Docking (one-hand use):** letting go while pouring or pipetting leaves the bottle, beaker or pipette where it is, still engaged. Any drag on the bench (not on another object) then controls it: up/down tilts the container, or fills/empties the pipette (speed-sensitive). Tapping empty space puts a docked bottle or beaker back where it was picked up; a docked pipette stays standing until picked up again. Phone tilt, where available, keeps working while docked.
- **Tap water:** the swan-neck tap has a blue lever (tap to toggle). A beaker held within 7 cm of the spout snaps upright beneath it and fills at 7 mL/s with tap water; the stream otherwise splashes into the sink. Moving the beaker off to the side over the sink pours it out as before.
- **Edge pan:** carrying an object into the outer 48 px of the bench view slides the view that way (0.3 × camera distance per second), so objects can be moved anywhere on the bench.
- **Spatula** keeps its salt when put down; salt is thrown away only when the spatula is released over the jar (logged).
- **Pipette pick-up** turns the pipette upright smoothly (quaternion slerp) and carries it with the tip at 6 cm.
- **Whole bench** computes the camera distance that fits every item from the pH meter to the sink for the current screen shape (steeper angle on portrait screens).
- **Phone sensors inside claude.ai:** the hosted page does not receive motion events on the tested Android phone; 4 s after the first touch without sensor data, the notebook says so and points to the wiggle and drag gestures. A self-hosted copy would receive them.
- **Targets engage after a short rest** (0.22 s) over them, so carrying an object past a beaker does not grab it.
- **pH meter** has a red ON/OFF key on top: tap it, a 1.2 s self-test follows, then the electrode reading shows. Off, the display is blank.
- **Help (?)**: the round ? button at the top right of the bench; tap it, then tap any object. A note (name, what it is for, how to use it, current state such as volume left or on/off) opens beside the tap point. Every scene object carries a `userData.help` key; texts are `x.h.<key>.t/.b` in all three languages.
- **Hint text** sits below the bench view, outside the 3D area.
- **Droppers** squeeze out one drop (0.05 mL) every 0.6 s while held over the mouth.
- **Beakers** can be carried, put down anywhere on the bench, put on the balance pan, and poured from (rules above).
  - About 0.4 mL always stays on the walls after emptying, so rinsing really dilutes what's left (factor ≈ 0.4 / (0.4 + rinse volume)).
  - Moving a beaker while it's upright swirls and mixes it.
- **Exact drops:** release a dropper over a beaker and it rests in the mouth. Each tap on the bulb releases exactly one 0.05 mL drop; a counter shows the total, and the notebook logs the session as "3 drops".
- **Wash bottle** squirts distilled water at 2.5 mL/s while held over a beaker.
- **Sink:** pour any beaker or bottle out over it.
- **Balance:**
  - ON/OFF shows a self-test, then 0.00 g. TARE zeroes it with what's on the pan.
  - The reading settles over about 1 s, and the last digit wanders until it's stable; a dot marks a stable reading.
  - Mass = glass + liquid (V × 0.998 + solutes) + undissolved solid.
  - Stable readings are logged in the notebook.
- **Solids:**
  - Dip the spatula in the jar to load it (up to 1.6 g); hold it over a beaker and the crystals fall in at 0.45 g/s.
  - Crystals dissolve at a rate set by stirring, up to solubility (360 g/L).
  - Salt left on the spatula is thrown away, never returned to the jar.
- **View:** drag empty space to rotate; the Move mode, right-drag, two fingers or the arrow keys slide the view sideways; scroll, pinch or the + and − buttons zoom towards the pointer. Double-tap a spot to fly close to it. "pH meter" flies to the meter's display; "Whole bench" returns to the start view. Floating notes are always placed inside the stage.
- **Aiming:** the pointer is projected onto a plane at beaker-rim height (7.5 cm), so the object goes where the student is looking.
- **Rods and electrodes** dip in automatically inside the zone. Released inside, they stay leaning on the wall. Moving the rod inside the liquid adds stirring energy.
- **Heat sources** (2D lab): placing one under a vessel turns heating on, removing it turns heating off.
- **Safety and procedure mistakes** are detected from the state, never from a "mistake button". Examples:
  - no goggles;
  - overflow;
  - a tube more than ⅓ full when heated;
  - the thermometer bulb at the wrong height;
  - the condenser water entering from the top;
  - absorbers in the wrong order.

## 3b. Equipment library, free bench and task cards (step 1)

- **Library:** every item is created once at load (`ITEMS` in `main3d.js`): beakers A–D, 3 mL and 10 mL pipettes, glass rod, spatula (closet); HCl, NaOH, Na₂CO₃, water, the three indicator dropper bottles, NaCl jar (chemical shelf). Items not in use are *stowed*: hidden, moved far below the bench, excluded from picking, targets, placement and updates. `placeItem(it, x?, z?)` puts one on the bench (free spot via `findSpot` near a per-item preferred area); `stowItem(it)` hides it and detaches anything resting in it.
- **Fixed bench equipment** (always present): sink with tap, balance, pH meter with electrode and storage beaker, wash bottle, rod holder.
- **Closet and shelf UI:** "Glassware" and "Chemicals" buttons above the bench open a panel of icon cards. Tap = take (logged "Took: …"); tap again = put back (logged). Put-back rules: let go first; beakers must hold ≤ 1 mL and no solid (otherwise a note asks to empty and rinse; residue > 0.05 mmol is logged as a mistake); pipettes must be empty; the spatula must be free of salt. On phones the panel closes after taking an item.
- **Start screen / "Choose experiment":** a picker with *Free bench* and the task cards. Free bench starts empty and shows the safety rules on the card. A task card defines `setup` (items and starting contents at their reference positions), `check()` (goal test, run every frame) and texts; reaching the goal logs a success entry and marks the card. Card 1: *Acid meets alkali* (goal: a beaker with Na⁺, Cl⁻, universal indicator and pH 6.5–7.5).
- **3D closet and shelf (replaces the panel):** wall-mounted open shelf units: glassware closet on the left wall (x −1.02…−0.56), chemical shelf on the right wall (x 0.62…1.08), two levels each (y 0.30 and 0.56). Every item has a fixed slot (`SLOT`). A stowed item stands visibly in its slot; tapping it moves it onto the bench (it glides there). Each slot has a shelf label: white = item on the shelf; yellow with ↩ = item is on the bench, tap the label to put it back (same put-back rules). The "Closet" and "Chemicals" buttons fly the camera to the units; pressing again returns to the work area. A status pill explains this while a unit is in view.
- **Lab room (replaces the wall shelves):** floor at y = −0.9 (bench top 90 cm), bench base and a yellow flammables cabinet under the bench. Turning 90° left: a floor-standing glassware closet on the left wall (x −2.2…−1.75), three 0.9 m sections (Right, Middle, Left as seen when facing it). Turning 90° right: four chemical cabinets on the right wall (x 1.9…2.35): Acids, General, Oxidisers + locked box + sealed dry box, Bases; six gas cylinders (O₂, CO₂, air, N₂, Ar, H₂) chained to the wall further right, hydrogen and oxygen at opposite ends. An 0.8 m aisle separates the bench from both walls.
- **Shelf rule:** four levels in every unit: bottom −0.86 (big or heavy, concentrated acids), lower middle 0.02, eye level 0.40 (used most; all usable items), top 0.78 (large but light). A layout engine (`placeIn`) fills each shelf in two rows, deep items first.
- **Inventory on display:** every item of the "Virtual Lab Inventory" doc is on its shelf (`decor3d.js`: ~70 glassware entries, ~70 chemicals with formula labels and hazard marks, gas cylinders). They are built from simple shapes and merged into four meshes (glass, amber glass, coloured opaque, one label atlas) to stay light on phones. Tapping one opens a note: name (3 languages), sizes or formula/concentration, level, hazards, storage group, and "on display for now". The locked box, sealed box and flammables cabinet list their contents.
- **Element cabinet (front wall):** a periodic table built as a wall cabinet above the bench (x −0.77…0.77, y 0.30…1.10), 118 compartments 8.6 cm square (`elements3d.js`: symbol, mass, electron configuration, group, state, names in 3 languages). Door labels come from two 2048² atlases redrawn on language change. Tap a door → it swings open and a note shows the element's data; tap the sample → it moves to the bench (max 8; draggable; tap it to put it back); tap the open door or the empty compartment → it closes and refills. Tc, Pm and Z ≥ 84 stay sealed. "Periodic table" is in the Go-to row. It opens a **wall view** (`viewPT(part, half)`, `shelfView = {sh:"pt"}`): the camera faces the wall square-on, one-finger/left-mouse drag pans up, down and sideways (`screenSpacePanning` on, target clamped to the cabinet), pinch/scroll zooms. Sub-buttons frame Whole table, Periods 1–3, 4–5, 6–7 and Lanthanides·actinides (`ptFrame` fits the rows to the screen); on narrow screens Left/Right half buttons appear. A drag that starts on a door, button or stowed item now moves the view and opens nothing. Phone layout: tool rows scroll sideways and the bench view fits the screen height.
- **Looking up:** the camera may now orbit down to 108° from vertical, so the top shelves can be seen from below.
- **Navigation:** "Closet" / "Chemicals" buttons fly to the furniture; while there, the Go-to row shows ← Bench, the sections or cabinets, gas cylinders, and Top / Eye level / Lower middle / Bottom.
- **Picking aid:** if the ray misses, the object whose on-screen outline is within 26 px (touch) / 12 px (mouse) of the pointer is picked, so thin pipettes and rods are easy to grab.
- **Drop guide:** while carrying, a vertical line and a ring show where the object would land on the bench (or the sink floor). A potential target (beaker, bottle mouth, sink) gets a pulsing turquoise ring; it turns solid once pouring/pipetting engages.
- **Camera follow:** the outer 20 % of the bench view is a follow zone; the deeper the pointer goes into it, the faster the view slides that way.
- **Sink:** an empty beaker (≤ FILM + 0.3 mL) released over the sink stands on the sink floor, snapping under the tap when within 7 cm; with the tap on it fills. Pouring into the sink engages only for beakers with liquid. Carried objects are kept out of the tap's column.
- **Light theme only:** dark-mode colours were removed; overlays and notes are light.
- **To add a task:** append an object to `TASKS` with ids of the items it needs, starting fills, a `check` function and three i18n keys (title, goal, steps). No new code is needed unless it introduces new equipment.
- **Not yet connected:** the teacher dashboard and saved results (2D lab) — planned once more cards exist.

## 4. Asset list (replace placeholders with glTF/GLB models)

| Asset | Real-world spec | Pivot | Sub-parts the code drives |
|---|---|---|---|
| Beaker 250 mL | Borosilicate griffin, Ø70 × 95 mm, wall 1.6 mm, rolled rim, white enamel scale 25–250 mL | base centre | glass shell; the liquid is generated by the code inside inner radius 33.2 mm from y = 3.2 mm |
| Reagent bottle 250 mL | Narrow neck, Ø58 × 142 mm, screw cap in hazard colour, paper label, GHS pictogram | base centre; spout at (0, 0.142, 0) | glass, liquid (clipped by a world-space plane), cap (hidden when lifted), label (texture changes per reagent and language) |
| Dropper bottle 30 mL | Amber glass Ø34 × 72 mm | base centre | glass, liquid, label |
| Dropper | Glass pipette with red rubber teat | tip | teat (scaled to show squeezing) |
| pH meter | Bench meter 120 × 90 × 40 mm, LCD | base centre | LCD texture (canvas, 256×128) |
| pH electrode | Combination electrode Ø12 × 180 mm, glass bulb, cable | tip | cable start and end points |
| Glass rod | Ø5 × 200 mm | lower end | — |
| Transfer pipette 3 mL | PE, graduated every 0.5 mL, bulb | tip | liquid column (scaled), scale sleeve |
| Graduated pipette 10 mL + pump | Glass, graduated every 0.1 mL, green pipette pump with thumbwheel | tip | liquid column, pump wheel (rotates with volume) |
| Spare beakers B, C | as beaker A, each with its own glass mass (98.62 g, 101.14 g) | base centre | same as beaker |
| Wash bottle | PE squeeze bottle 250 mL with bent nozzle | base centre; nozzle tip (0.05, 0.19, 0) | body (scaled when squeezed) |
| Sink | Stainless basin 190 × 250 × 120 mm cut into the bench, swan-neck tap | — | — |
| Top-loading balance | 0.01 g / 620 g, stainless pan Ø140 mm, ON/OFF and TARE keys, green display | base centre; pan centre | display texture (canvas), two key hit-areas |
| Reagent jar + spatula | Wide-mouth PE jar of NaCl crystals; stainless scoopula 200 mm | jar base; spatula scoop | load (crystal heap scaled by grams) |
| Small beakers 50 mL | electrode storage (with KCl), rod holder | base centre | — |
| Bench | Light grey phenolic resin top, matte-satin | — | — |
| Wall | White ceramic tiles, light grout | — | — |

Materials should stay physically based:
- **Glass:** IOR 1.5, transmission or alpha-blended with strong environment reflections.
- **Liquids:** IOR 1.333, transmission with attenuation colour.
- **Rubber:** sheen.
- **Plastic:** clearcoat.

Lighting should be image-based: replace `RoomEnvironment` with an HDRI of a real lab, keeping the directional key light for shadows.

## 5. Quality criteria (how to judge a finished simulation)

**Physical scale and behaviour**
1. Real dimensions in metres. The liquid level follows volume exactly (h = V / πr²).
2. Liquids refract and tint what is behind them. Glass shows reflections and edge brightening. The meniscus curves up at the wall.
3. The liquid surface stays level when a container tilts, and its height follows the volume left; flow starts only when the liquid reaches the lip, and a container turned mouth-down empties.
4. A stream thins as it falls, and its thickness follows the flow rate. Drops are teardrop-shaped and make a ripple and a small splash.

**Chemistry made visible**
5. Colour changes start where the liquid lands, using the local mixture's pH, then spread and even out. Stirring speeds this up.
6. Gas bubbles come from nucleation sites (bottom, walls, impact zone), grow while rising and rise faster when larger. They burst at the surface, building foam that decays. Their number follows the calculated gas release (mmol/s).
7. Precipitates (2D lab already does this) appear as a cloud at the impact point, swirl and settle into a layer over seconds. How fast they settle depends on the substance. They dissolve gradually when conditions change.
8. Heat effects are measurable (neutralisation +57 kJ/mol) and visible: steam above 55 °C, boiling at 100 °C, spitting near dryness.
9. Slow reactions run in real time, for example Fe(OH)₂ browning in air in about 2 minutes, faster when warm or stirred.

**Interaction and teaching**
10. Every action is a gesture with a physical meaning. The amount poured depends on how long and how steeply the bottle is held.
11. Mistakes are recorded with a timestamp and a plain-language reason. The notebook records observations, never answers (e.g. "a white precipitate forms", not "AgCl forms").
12. Every text is in Estonian, Russian and English. Numbers use the local decimal separator.

**Performance and access**
13. 60 fps on a 2020 school laptop with integrated graphics. On low-end devices, degrade gracefully: fewer bubbles, shadows off, lower resolution.
14. Touch and mouse both work. Dragging on empty space orbits the camera, and pinching zooms.
15. Results are saved per student (see 2D lab: `results/<uid>` with attempts, restarts and timed mistakes). A report code is the fallback when saving isn't possible.

## 5b. Target devices: smartphones (Android and iPhone)

- **Start quality:** phones (coarse pointer or short side < 700 px) start at pixel ratio ≤ 1.5 and a 1024 px shadow map.
- **Frame-rate watchdog:** measured every 2 s. Below 34 fps twice in a row, quality steps down: level 1 = 75 % resolution and 60 % bubbles; level 0 = resolution 1, no cast shadows, 35 % bubbles. Above 55 fps five times in a row, it steps back up.
- **iPhone:** Safari has no vibration API, so the status pill flashes instead. Long-press callouts, text selection and double-tap page zoom are off on the bench; `100svh` keeps the bench clear of the browser bars.
- **Portrait layout:** one-row header, the bench fills the screen height minus the header, the card follows below. Portrait screens get their own start view (higher, steeper) and the portrait field of view is 56°.
- **Next step for portrait:** each experiment should define a compact portrait arrangement of its equipment (deeper rather than wider), because a wide bench in a narrow view leaves the sides off-screen.

## 6. Hosting constraints (claude.ai artifacts)

- Scripts may load only from cdnjs, jsdelivr/npm, unpkg; the prototype imports three.js 0.160.0 from jsdelivr through an import map. Fonts come only from Google Fonts.
- No fetch to other hosts: textures, HDRIs and models must be inlined (data: URIs) or published as files beside the page, within the 16 MB limit.
- Inside the claude.ai viewer, the page saves shared data through `window.claude.use('db')`; the 2D lab shows the rules.

## 7. Next steps suggested

1. Approve the look and feel of this one simulation against §5.
2. Replace the placeholder assets and the HDRI. Tune the materials.
3. Port the other 11 experiments with the same interaction rules. The chemistry and scoring logic can be reused unchanged.
4. Join the 3D bench to the existing teacher dashboard and results store.

## v16 — Labs menu and takable closet items
- **Start:** the page always opens as a free bench (`setupTask(TASKS[0])`). The top-bar button is now "Start over" (restarts the current bench or lab).
- **Labs menu** (`openLabs`, button "Labs" at the left of the tool row): step 1 Level (Grades 8–9 / 10–12 / University, plus Free bench), step 2 Type (the four 2D topics: ind, neu, pre, org), step 3 Lab. `LABS` lists the twelve 2D scenarios (titles and goals come from the 2D translations `sc.<id>.title/.goal`) plus the 3D card "Acid meets alkali" under Grades 8–9 · Neutralisation. Entries with `run` start a 3D task; the others are marked "In preparation" until their 3D setup exists. Breadcrumb chips jump back a step.
- **Every glassware and chemical item in the closets is takable** (121 items). Each decor item records its vertex ranges in the merged shelf meshes (`info.ranges`). `takeProp` copies those vertices into a mesh of its own, moves the shelf copy out of sight, and carries the item to a free bench spot; it behaves like an element sample (drag to move, tap to put back, which restores the shelf vertices). Max 8 on the bench; reset returns all. Locked/sealed boxes, the flammables cabinet and gas cylinders still show notes. These items are carried and placed; their experiment functions arrive with later rounds.

## v17 — the same touch gestures everywhere
- One finger (or left mouse): turn the view all the way round. Pinch (or wheel): zoom. Two fingers (or right mouse): slide. The element-cabinet wall view keeps these gestures; its two-finger slide follows the wall (`screenSpacePanning`).
- A capture-phase `pointerdown` on the stage counts touches. When a second finger lands and nothing is being carried, it cancels the pending tap or remote control and re-enables the camera controls. Pinching over doors, buttons or bench objects therefore zooms and opens nothing.

## v18 — pinch toward the fingers, level two-finger pan, digital thermometers
- **Two-finger gesture is our own** (stage capture listeners, `TT` map). When two fingers are down, OrbitControls is paused.
  - Pinch scales camera and target about the world point under the midpoint (plane through the target, normal = view direction), so that point stays under the fingers.
  - Sliding moves camera and target along the horizontal right vector and world Y. Content follows the fingers and the view direction never changes, so the view stays level.
  - One finger still orbits through OrbitControls. The earlier library pinch used `pageX` against `getBoundingClientRect`, so on a scrolled phone page it zoomed toward the wrong spot.
- **Clamps:** a clamped target now moves the camera by the same amount, so the view no longer tips. The camera stays above the bench top (y ≥ 0.05) over the bench and 25 cm above the floor elsewhere.
- **Digital thermometers ×3** (`thermos`, kind `thermo`, items `thermo:1..3`, glassware closet eye level).
  - Shape: steel probe 12 cm, body with LCD (0.1 °C, labelled T1–T3).
  - Use: drag one into a beaker to dip it (reuses `updateStick`); elsewhere it lies on the bench.
  - Reading: approaches the vessel's `temp` with a 2.5 s time constant while the probe is below the liquid level. Otherwise it shows room temperature (22 °C).

## v19 — fume cupboard on the back wall, element jars
- **Back wall** at z 3.3, behind the student. **Fume cupboard** (`HOOD`) built in place:
  - Structure: x −0.78…0.78, depth to z 2.52. Base cabinet with doors, epoxy worktop at bench height, side walls, back panel with baffle slots, lit canopy with sign, extraction duct to the ceiling.
  - Sliding glass sash: tap it to raise or lower it.
  - Fan switch with LED; when the fan runs, a red streamer at the sash flutters.
  - Go-to place "Fume cupboard". Help key `hood`.
  - Used for burning and distillation in step 5.
- **Element samples are sealed, labelled jars** (`sampleMesh(e, Z)`, `formOf`).
  - Contents by element (`FORM_OF`):
    - under paraffin oil: Li, Na, K, Rb, Cs, Sr, Ba, Eu
    - stoppered bottle: Hg, Br
    - wire coil: Fe, Cu, Ni, W, Pt, Ta, Nb
    - ribbon: Mg
    - granules: Zn, Al, Sn, Pb, Ca, Cd, In, Tl, Mn, Co, Cr, Ti, V, Zr, Hf
    - powder: S, P, Si, B, Se, As, Te, Mo, Re
    - crystals: I
    - gas (any element gaseous at 25 °C): sealed jar, tinted for Cl and F
    - everything else: lump
  - Label wraps the front of each jar: atomic number, mass, symbol, name, with a category colour bar. It is redrawn on language change (`JAR_LABELS`).
- Tapping a jar on the bench shows its information; the jar stays on the bench. Up to 16 jars; "Start over" clears them.

## v20 — jar lids, quiet periodic table, level camera controls, no overlaps
- **Jar lids:** tap a jar on the bench to open or close it (`toggleJar`, `animLid`). The lid lifts off and lies upside down on a free side of the jar (`lidOff`, chosen against `obstacles`). Gas jars, Hg and Br stay sealed ("opened only in the fume cupboard"). Notebook logs opened and closed jars.
- **Notes:** doors, cubby jars and bench jars no longer show the floating hover tip (`noTip`). Element information appears in the corner note (`cornerNote`).
- **Camera:** ▲ ▼ buttons (hold) and arrow keys raise and lower the view without tipping it; ← → arrow keys slide sideways; PageUp and PageDown also raise and lower (`liftView`). "Eye level" (`eyeLevel`) turns the view horizontal at the target's height. Over the bench the camera may go down to 1.2 cm above the bench top, so jar bottoms and cylinder scales can be read side-on.
- **No overlaps:** `obstacles(self)` lists bench footprints, including open-jar lids and lying thermometers. `findSpot` uses it on release. `keepApart` pushes a carried beaker, bottle, wash bottle, jar or closet item out of other footprints, unless the beaker, bottle or wash bottle is lined up over a vessel to pour.
- **Balance:** jars can stand on the balance pan (`onBal`) and are weighed (`jarMass`, made-up jar-plus-contents masses).

## v21 — pouring from jars, simple metal reactions, every element, single shelf pieces
- **Jar lid lives in the room** (`S.lid`, world space). On the jar it moves with the jar; taken off, it stays where it was laid (`lidHome`). Tap the jar or the lid to close.
- **Pouring:** carry an open jar over a beaker; it lines up at the rim (`pourJar`). Drag down to tilt it, which locks onto that beaker while the pointer stays within ±90 px sideways. Past about 70° the contents fall as pieces (`ELP`, sizes and masses in `PIECE`) and land in the beaker (`v.metal`, `landPiece`). Jar contents shrink and empty (`S.left`/`S.full`); "Start over" refills.
- **Reactions** (`updateMetals`):
  - Water: Li/Na/K/Rb/Cs/Ca/Sr/Ba (`WATERRX`).
  - Acid, rate ∝ [H⁺]: Mg/Zn/Fe/Al/Mn/Ni/Co/Cd/Sn (`ACIDRX`).
  - Dissolved metal goes into `chem.tot` (`ION` map: Li→Na, Rb/Cs→K, Sr→Ca, Fe→Fe2); new species are added to the engine's `METALS`/`PPT` at runtime, so pH, hydroxide precipitates and colours follow.
  - H₂ bubbles via `v.gas`; heat via `temp` with the "reaction releases heat" log.
  - Li, Na and K float and skate on the surface.
  - Notebook: reacts with water / reacts with acid / no reaction.
  - Solids poured into the sink are logged as a mistake.
- **All 118 elements hand out a jar.** Radioactive ones carry ☢ on the label and a safe-to-explore note; Ra, Ac, Pm, Po, Pu, Cm and Es glow. Z ≥ 99 shows as a symbolic glowing speck ("only a few atoms ever made").
- **Shelf sets are split:** parts whose footprints overlap form one piece (`place()` union-find), so two spirit lamps, three flasks and so on are taken one at a time (167 pieces).
- **Closet items on the bench:** a tap shows info with a "Put back on the shelf" button (note actions in `showNoteRaw(..., actions)`); they no longer vanish on tap.
- **Rod holder is movable** (`rodHolder`); a standing rod moves with it.
- **Camera:**
  - Wheel and pinch use `zoomAbout`: straight toward the cursor or fingers, never turning. The OrbitControls zoom is disabled.
  - Floor: within x ±1.0 m and z < 1.9 m (in front of and over the bench) the camera stays at least 1.2 cm above the bench top, so it cannot go under the bench.

## v22 — six labs, pourable cabinet chemicals, fume cupboard cycle, PPE, equipment manual
- **Labs running in 3D**, besides "Acid meets alkali" (`TASKS`, built by `labTask`):
  - Indicators: ind1, ind2, ind3. Precipitation: pre1, pre2, pre3.
  - **Unknown bottles:** A–F (`bottle:uA…uF`, `REAG.uX`). `dealUnknowns` deals their contents at random from `SOL` each time a lab starts, and `tintBottle` colours the bottle liquid.
  - **Answer form** in the card (`TASK.answer`): one select per bottle, plus pKₐ for ind3. `checkAnswers` logs success or the number wrong.
  - **pre1** is checked automatically: Cu(OH)₂, AgCl and BaSO₄ must each be in a different beaker.
  - **New reagents:** bottles NaCl, Na₂SO₄ and CuSO₄; droppers AgNO₃ and BaCl₂.
  - Still in preparation: neu1–neu3 (evaporation, titration) and org1–org3 (burning, distillation).
- **Precipitates:**
  - Shown as a cloudy colour in the beaker (`lookWithCloud`).
  - Notebook (`describe`, ported from 2D): precipitate colour, dissolving, gas, colour change.
- **Heat of neutralisation** now comes from acid and base equivalents actually mixed (`excessOf`, `chem.acidEq` / `chem.baseEq`), so mixing salt solutions no longer "warms" the beaker.
- **Cabinet chemicals** (decor chem props):
  - **Liquid in the bottles:** a new `liquid` bucket in the merged decor, tinted by formula (`LIQCOL`).
  - **Caps:** taking a container splits its cap off by triangle height (`CAPH`) into a world-space lid. Open and close from the note.
  - **Pouring:** an open container tilts over a beaker like the jars (`poseOver`, `pourProp`).
  - Liquids use `CHEMDATA`: species per mol/L, scaled by concentration parsed from the label. Unknown formulas behave like water, and the note says so.
  - Solids fall as pieces and dissolve or react (`cmp` pieces in `updateMetals`), e.g. CaCO₃ fizzes in acid, CuSO₄·5H₂O dissolves blue. Metals use the element rules.
- **Fume cupboard as a second work surface** (`AREAS.hood`, `areaRect`):
  - The "Move to the fume cupboard / to the bench" note action sends an item along an arc (`flyArc`) and moves the camera to the worktop.
  - Dragging, `findSpot` and edge-panning respect the item's area.
- **Spirit lamp** (decor `lamp`; its cap is split off like a bottle cap) and **Matches** (new decor item, glassware closet, lower shelf):
  - Open the lamp, then "Light with a match"; the matches must be in the same area. A match flies from the box to the wick.
  - Close the cap to put the flame out ("The flame goes out under the cap").
  - **Flame tests and combustion:** hold an open element jar beside a lit lamp (`burnInFlame`).
    - Flame colours (`FLAMEC`); observations for Li…Ba, Cu, B, Mg, S, P, C, Fe, Zn.
    - Sparks for Fe and C; white smoke for Mg, P and Zn.
    - Elements that give toxic fumes (`NEEDHOOD`) log a mistake unless the lamp is in the fume cupboard with the fan on. Smoke drifts into the baffle when the fan runs.
- **PPE:** 🥽 and 🧤 buttons (`setPPE`); goggles add a blue frame and gloves a glove icon. `ppeCheck` in `addLiquid` logs "no goggles" and "corrosive without gloves" once per run; lighting a flame without goggles is logged too.
- **Equipment manual** (`showManual`): a card above the task card (on phones, an overlay at the right of the view) with "In this lab" and "In a real lab". It covers about 30 categories, mapped from decor keys (`MAN_OF`) and item kinds (`MAN_KIND`), plus element jars, chemicals, the fume cupboard and PPE.
- **Hand cursor and arcs:**
  - The cursor is a hand over anything takeable (including shelf items) and a closed hand while carrying.
  - Closet items and element jars fly in an arc from shelf or cubby to the bench. "Put back" flies them back before they reappear on the shelf.
- **Shelf rebalanced:**
  - Thermometers moved to the closet's top shelf; NaCl/Na₂SO₄/CuSO₄ to the General cabinet's bottom shelf.
  - AgNO₃/BaCl₂ droppers to the oxidiser cabinet; unknowns on the Bases cabinet's lower shelf.
