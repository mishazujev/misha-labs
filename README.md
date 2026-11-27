# Bench Chemistry Lab

**Public Chemistry lab:** <https://labs.mishazujev.com/chemistry/lab3d/lab3d.html>

## Current development — 27 November 2026

**New daily lab: Copper precipitate and acid recovery** — K1 General chemistry, primary skill **K1-17** (investigate ion reactions), with two net-ionic-equation choices supporting **K1-18**. Native catalogue/task ID: `k117-copper`, under **K1 · General chemistry → Acids, bases and oxides**. This is a distinct staged investigation with its own apparatus, controls, observations and assessment; it is not a renamed legacy precipitation task.

Implemented on `chemistry/copper-cycle-and-repeat-trials`, stacked on [draft PR #8](https://github.com/mishazujev/misha-labs/pull/8). Review link will be added after pushing. Earlier drafts #5 → #6 → #7 → #8 remain dependencies. The source is implemented locally; nothing in this batch is merged or published. The live site remains on the verified 22 November baseline.

- [x] Deliver the new K1 copper-cycle lab. A and B start with identical 20 mL acidified 0.10 M CuSO4 samples. Record their baseline; add 10 mL water to B and 10 mL 0.50 M NaOH to A; record the positive precipitate and no-added-base control at matched 30 mL volumes. Add 12 mL water to B and 12 mL 0.50 M HCl to A; record acid-driven redissolution at matched 42 mL volumes. State-driven checks require the correct sequence, copper/solute inventory, volumes, control and actual equilibrium precipitate amounts. Goggles/gloves, clean-transfer instructions, two net ionic equations, incorrect setup/answer feedback and reset/retry are included in EN/ET/RU/UK. It reuses verified native pipettes, chemistry and Cu(OH)2 visuals. This is one lab and a limited K1-18 equation exercise, not completion of either whole skill or a general equation editor.
- [x] K3-11 — Identify the independent variable and controls before salt delivery. Learners select solvent identity and matched volume, salt dose and temperature. Wrong/incomplete/late designs are rejected; the valid plan is locked, logged, required for observed comparison/completion and retained with repeat records.
- [x] K3-11 — Retain completed trials while starting a repeat. The repeat action archives an independent snapshot of the original hypothesis, design, blanks, measured amounts, conclusion and trial notebook, then prepares fresh samples and new entries. A comparison table shows archived/current runs with units, and the chronological notebook persists. Start over explicitly clears the investigation; save/resume/export remains future work. The backend now accepts `k311` and `k117-copper` analytics IDs, with aggregation/idempotency checks.

**Verification:** all existing suites plus 43 numerical/language/deployment/host checks pass. Five new model checks cover the actual-engine copper cycle and copper balance, rejected stages/contamination, controlled experimental design, independent trial snapshots and translations. The maintained sources were rebuilt and the production package includes/serves `investigation_models.mjs`. Chrome launched the new lab through its actual catalogue card and verified four-language controls, missing-PPE rejection, an incorrect NaOH-in-control setup, reset/retry, real pipette uptake/delivery, matched positive/control volumes, acid removal, premature/wrong/correct answers and 4 mmol conserved total copper. K3-11 checks passed wrong-plan rejection, plan locking, two independent trials with different recorded doses/hypotheses, unchanged archive snapshots, chronological notebook, retained hood fan, language persistence, mobile bounds and keyboard table scrolling. Backend analytics requests returned 204 for the native attempts. Desktop/mobile screenshots were inspected. Both updated K3-11/hydration scenarios and the earlier sample-control/phase scenarios also pass.

**Scope:** the lab reuses the existing equilibrium/thermal model and its constants. It does not add complexation, filtering, quantitative reaction enthalpy or a free-form molecular/ionic equation editor. Model pH/amount observations are labelled separately from physical instrument readings. The Cu(OH)2 visual timing/particle geometry remain illustrative. K3-11 retains its documented single-salt reference limits. Browser fixtures prepare doses/time through native functions; a full pointer-driven release attempt remains open. The broad cabinet-solubility and remaining curriculum checkboxes stay open.

Next developer actions should include another distinct K1/K3 lab each day. Priorities: a new blinded chloride/nitrate identification lab with positive/blank controls (K1-17), a source/receiver/solid-spill conservation check (F2), and report export with skill IDs and retained trials (F9). **User attention:** review the stacked drafts before authorizing publication, and resolve the existing K3-19 curriculum mapping. No deployment is included.

Reproduce the new optional browser scenario with `node scripts/check-chemistry-copper-repeat.cjs` after rebuilding and `npm run deploy:prepare`, using `PLAYWRIGHT_MODULE` and `LAB_SCREENSHOT_DIR` as documented below.

## Earlier review batch — 26 November 2026

The next three green actions are implemented on `chemistry/hypothesis-hydration-copper`, stacked on [draft PR #7](https://github.com/mishazujev/misha-labs/pull/7). PR #7 depends on #6, which depends on #5. See [draft PR #8](https://github.com/mishazujev/misha-labs/pull/8); review in order #5 → #6 → #7 → #8. Main and the verified 22 November public release are unchanged; this batch is unpublished.

- [x] K3-11 — Save a prediction and written reason before salt delivery. Saving locks the original prediction with notebook time; missing, short, contaminated or late records are rejected. The spatula marks the start of delivery before grains land. The recorded comparison reports whether the result supports the prediction or calls for revision. An incorrect prediction is valid inquiry and does not prevent a correct evidence-based conclusion. Reset clears the prediction and unlocks a fresh attempt.
- [x] K3-11 — Link actual recorded amounts to an interactive hydration/polarity explanation. Switch between correctly oriented water around Na+ and Cl−, the nonpolar hexane/ionic-solid reference, and a separate water–water hydrogen-bond view. Each has a text alternative in EN/ET/RU/UK. The diagrams identify themselves as schematic, not literal particle counts; changing a sample outside the controlled trial hides the explanation until a valid comparison is restored. The scientific distinction is ion–dipole hydration versus water–water hydrogen bonding, following [OpenStax Electrolytes](https://openstax.org/books/chemistry-2e/pages/11-2-electrolytes) and [The Dissolution Process](https://openstax.org/books/chemistry-2e/pages/11-1-the-dissolution-process).
- [x] K1-17/18 — Add independent blue Cu(OH)2 particles, a sediment bed, resuspension and removal driven by the actual equilibrium amount. Copper and AgCl histories/colours coexist without changing analytical amounts. Settling reduces suspended cloud contribution while leaving dissolved colour to the existing engine. Acid addition that redissolves Cu(OH)2 removes the blue particles/bed. An explicitly acidified CuSO4 sample without added base is the negative control; unacidified CuSO4 is not asserted to have exactly zero precipitate in the existing equilibrium approximation.

**Verification:** all required suites and 38 numerical/language/deployment/host checks pass, including five new tests for copper formation/acid removal/amount balance, independent mixed precipitate state, pre-dose prediction validation, observation-linked explanation and translated observations. The page was rebuilt from maintained sources and the production package prepared. Chrome verified prediction locking and language persistence, incorrect prediction/revision, missing/late records, reset/retry, all three explanation views in four languages, unchanged chemical inventories, invalidated evidence, and 390 px mobile bounds. Native sample addition verified blue copper particles/bed, an acidified no-base control, concurrent AgCl/Cu(OH)2, actual Shake, acid-driven removal and reset with no page errors. Desktop/mobile/diagram/copper screenshots were inspected. The updated K3-11/separator scenario and both earlier sample-control and phase scenarios also pass.

**Limits:** diagrams explain the verified NaCl reference; they do not compute hydration shells or predict general solubility. Particle sizes, sediment geometry and eight-second visual settling are illustrative, not validated kinetics. Copper uses the existing engine constants; this batch does not add complex-ion chemistry, precipitate transfer/filtering or other precipitate visuals. Browser sample delivery and time are prepared through the debug API; a complete pointer-driven release attempt remains open. The previously documented four-of-twelve cabinet saturation coverage remains unchanged.

Next developer actions: let K3-11 learners identify the independent variable and controls; require recorded Cu(OH)2 positive/control/redissolution evidence in the ion-reaction station; and retain the first trial when starting a K3-11 repeat for comparison. **User attention:** review the stacked batches before authorizing a new release; resolve the existing K3-19 curriculum-ID conflict. No merge or deployment is included.

Run the optional new scenario with `node scripts/check-chemistry-hydration.cjs` after rebuilding and `npm run deploy:prepare`; it uses the same `PLAYWRIGHT_MODULE` and `LAB_SCREENSHOT_DIR` options documented below. The previous K3-11 scenario now also records a hypothesis, preserving its separator/overflow regression coverage.

## Earlier review batch — 25 November 2026

The next batch is implemented on `chemistry/k311-separation` in **mishazujev/misha-labs**, stacked on the unmerged [PR #6](https://github.com/mishazujev/misha-labs/pull/6), which depends on [PR #5](https://github.com/mishazujev/misha-labs/pull/5). See [draft PR #7](https://github.com/mishazujev/misha-labs/pull/7); review in order #5 → #6 → #7. This work is unpublished; the live site remains on the verified 22 November baseline below.

- [x] K3-11 — Add the native **Salt in water and hexane** reference activity. Learners record clean solvent blanks, deliver 0.50 g NaCl to each 40 mL sample, compare dissolved material/residue and choose a justified conclusion. The assessment reads actual landed grain mass and current sample state; unequal/missing doses, changed solvents, contaminated samples, incomplete water dissolution and unrecorded observations cannot complete it. Goggles and the hood fan are required for evidence recording. English, Estonian, Russian and Ukrainian instructions and controls are included. This is one reference variant, not completion of the entire solubility skill.
- [x] F6 — Make the cabinet separatory funnel a mounted, fillable apparatus with a physical stopcock, labelled phase volumes, receiving-beaker controls and automatic stop at the interface. Water drains before hexane, DCM before water. The next fraction requires explicit reopening; changing receivers closes the valve and moves the old beaker aside. Closed/moving/unsettled/unsupported setups do not drain. Full receivers preserve excess as accounted spills. A waste action recovers unsupported samples without resetting other work.
- [x] F3 — Curate and apply the NaHCO3 saturation reference, conservatively restricted to 0–40 °C, and audit all twelve configured solid uptake/reaction definitions. Water uptake obeys saturation; acid uptake has a separate acid-equivalent limit. Four definitions now have finite curves. **The broader remaining-cabinet action stays unchecked:** eight definitions need additional data or species/hydrate validation. See [the curation register](SOLUBILITY_CURATION.md).

**Verification:** `npm test` passes the existing reaction, chemistry, distillation, course and analytics suites plus 33 numerical/language/deployment/SSH checks. Seven new tests cover bicarbonate, saturation versus acid attack, selective-phase conservation, density reversal, unsupported/invalid doses, controlled K3-11 evidence and translations. `lab3d/build3d.sh` regenerated the page and `npm run deploy:prepare` packaged its modules. The packaged Chrome scenario passes the actual native guide and four-language instructions, blank/observation/answer gating, successful and wrong conclusions, reset, native funnel targeting/filling, a physical 3D stopcock click, closed/unsettled setup rejection, both density orderings, selective NaCl conservation, receiver replacement, overflow, unsupported-sample retention/waste recovery and reset. Desktop/mobile/close-up screenshots were inspected; the mobile answer selector stays within 390 px. Both previous sample-control and phase-model browser scenarios also pass. Sample delivery and simulation time are controlled through the debug API; a full pointer-driven attempt remains a release check.

**Model and release limits:** the separator is a reference for water/hexane or water/DCM with aqueous NaCl only. It rejects other solutes, indicators, precipitates and mixed organic solvents. No distribution coefficients, mutual solubility, pressure/venting or validated separation kinetics are supplied. Tints identify phases; they are not natural solvent colours. The automatic interface stop is a usability aid. Other vessel transfers remain representative bulk transfers. K3-11 uses the same documented aqueous single-salt approximation, not a general predictor of organic solubility. Read [SOLUBILITY_CURATION.md](SOLUBILITY_CURATION.md) before extending either model.

Next developer actions: add explicit K3-11 hypothesis recording, add the linked ion-hydration/polarity representation, and extend precipitate particles/settling/removal to the Cu(OH)2 reference with a no-reaction and acid-redissolution control. **User attention:** review the stacked batches before authorizing publication; resolve the existing K3-19 curriculum-ID conflict. No merge or production deployment is included in this batch.

### Reproduce the optional browser acceptance scenario

After rebuilding and running `npm run deploy:prepare`, install/use Playwright with Chrome available and run `node scripts/check-chemistry-k311.cjs`. If Playwright is provided externally, set `PLAYWRIGHT_MODULE` to its module location. `LAB_SCREENSHOT_DIR` optionally selects an existing screenshot directory; otherwise screenshots go to the system temporary directory. The scenario starts a local packaged server on a free port, checks the native guide/assessment and physical stopcock click, and always closes its browser/server. It prepares samples and simulation time through the debug API; it is not a complete pointer-driven apparatus-to-conclusion attempt.

## Earlier review batch — 23 November 2026

Today's three green actions are implemented in [draft PR #6](https://github.com/mishazujev/misha-labs/pull/6), on `chemistry/phases-and-solubility`, based on the still-open [PR #5](https://github.com/mishazujev/misha-labs/pull/5). This is a separate review batch depending on PR #5; neither batch is merged or published. The live baseline remains the verified 22 November release below.

- [x] F3 — Limit dissolution for the configured NaCl, KNO3 and NH4Cl reference cases. Sodium chloride from the spatula and curated cabinet pieces obey the same remaining-water and temperature capacity. Adding water or warming KNO3 raises the available capacity; stirring changes uptake rate, not the final limit. Pure hexane is not counted as water. Unsupported cosolvents or temperatures pause the curated dissolution model and are identified in the inspector. Other cabinet compounds retain their previous model and still need curated saturation data.
- [x] F3 — Render density-ordered binary liquid layers. Water/hexane puts water below hexane; water/dichloromethane puts DCM below water. The cabinet now recognises both solvents. Separate liquid volumes and an interface appear after settling. Shake sample disperses the interface and the layers return without changing amounts. The inspector reports order and phase volumes in EN/ET/RU/UK, with an explicit unsupported-mixture message. Water/ethanol is a single-phase comparison.
- [x] K1-17/18 — Show AgCl particles and a white sediment bed driven by the existing equilibrium amount. Quiet samples settle, shaking resuspends them, and dilution that redissolves the precipitate removes the particles/bed. A no-chloride control stays clear. Visual settling and particle count never change the chemical ledger.

**Verification:** all existing suites and 26 numerical/language/deployment checks pass. Eight new checks cover finite dissolution, mass balance, actual cabinet-piece updates, temperature/water/stirring effects, both density orderings, unsupported mixtures, equilibrium-based AgCl amount and conserved shaking. The regenerated page and `npm run deploy:prepare` include the new `phase_state.mjs` module in the actual server route. Chrome checked the packaged lab's actual layer meshes and interface, four-language phase text, Shake/Refresh, AgCl settling/resuspension, no-reaction control, actual dilution-driven redissolution, NaCl saturation, cabinet KNO3 uptake and reset. Desktop, close-up and mobile screenshots were inspected. The previous inspection/overflow/cap browser scenario also passed. Samples and simulation time were controlled through the debug API; a full pointer-driven lab attempt remains a release check.

**Scientific scope:** aqueous curves use the [Sigma-Aldrich solubility table](https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/solubility-table-compounds-water-temperature), in grams per 100 g water, with linear interpolation only between 0 and 100 Celsius. The model approximates water as 1 g/mL, uses additive liquid volumes and analytical single-salt formula units, and does not model activity/common-ion effects, volume expansion or cooling-induced crystallisation. These data are not extended to the remaining cabinet compounds. Binary layers use fixed room-temperature density ordering from the [hexane specification](https://www.sigmaaldrich.com/US/en/product/sial/296090) and [dichloromethane specification](https://www.sigmaaldrich.com/US/en/product/saj/072190), with water approximated as 0.998 g/mL. Mutual solubility, ternary phase equilibria and solute partitioning are omitted. Bulk transfers still carry representative composition, and the existing ionic solver uses bulk sample volume; selective phase withdrawal and phase-specific ion concentrations are not supplied. Separation and sedimentation timing and particle sizes are illustrative, not validated rate predictions. AgCl chemistry retains the existing engine's equilibrium constants.

Next work is a native K3-11 water/nonpolar reference trial, selective lower-phase withdrawal and curated solubility coverage for the remaining cabinet compounds. The K3-19 curriculum-ID decision and review/publication of the pending batches remain user attention items.

## Earlier review batch — inspection, overflow and caps

The next three scheduled actions are implemented in [draft PR #5](https://github.com/mishazujev/misha-labs/pull/5), on `chemistry/inspection-overflow-caps` in this repository. This batch is prepared for review and has not been merged or published; the live baseline is documented below.

- [x] F4 — Inspect a selected sample without changing it. Select a beaker in the lab guide or tap one on the bench. The report shows volume, temperature, analytical amounts/concentrations, organic solvent amounts, indicator identity and solid residue. Refresh and switching samples preserve the sample. When the guide is open the report stays inside it, with scrollable mobile controls; otherwise tapping a beaker opens a floating note. English, Estonian, Russian and Ukrainian controls are provided. Concentrations include analytical material in precipitates; they are not free-ion concentrations or proof of separate liquid layers.
- [x] F3 — Preserve overflow. A receiver accepts exactly its remaining capacity. Excess liquid becomes a persistent, chemistry-coloured puddle with its solutes, indicators, solvents and thermal/reaction history retained. A pipette or partial pour consumes the released dose only once, including a full receiver and 0.05 mL falling drops. Clean liquid spills moves their contents into a collected-waste ledger while keeping the current vessels and trial intact. Reset clears waste, puddles and in-flight drops/grains. Solid-spill cleanup and disposal compatibility remain separate work.
- [x] F3 — Stop flow at a closed cap or stopcock. Stock-bottle flow, cabinet pouring and closed-bottle pipetting respect the shared gate. An active bottle has a close/open cap control. Explicit cap choices persist through later drags; automatic opening still supports the original first-use gesture. The existing burette closed mode remains available.

`npm test` passes, including 18 transfer/language/deployment/host-identity checks and the existing reaction, indicator, course, distillation and analytics suites. The page was regenerated from maintained sources, and `npm run deploy:prepare` includes the new `bench_state.mjs` module in the production package and server route. Local Chrome checked actual sample selection/Refresh, four language controls, overflow composition, liquid cleanup, full-vessel pipetting, a falling 0.05 mL overflow drop, cap stop/restart, closed-bottle pipetting and reset. Desktop/mobile screenshots were inspected. Test samples and active-pour state were prepared through the debug API with physics paused; a full pointer-driven apparatus-to-conclusion attempt remains a release check.

Next developer work is condition-limited dissolution, binary liquid layers and visible AgCl precipitation/settling, respecting K1/K3 priority. The K3-19 mapping decision remains with the user. Layer equilibria, selective layer withdrawal and solid-spill accounting are not supplied by this batch.

## Published baseline — 22 November 2026

The daily job now works in **mishazujev/misha-labs**, using the maintained sources in this repository. This run was merged through [misha-labs PR #1](https://github.com/mishazujev/misha-labs/pull/1), with GitHub validation passing. The old `classroom-connect-91` chemistry branch is preserved as a migration reference; its completed checkboxes do not establish that a feature exists here or on the public site. See [the migration audit](CHEMISTRY_MIGRATION.md) and the [curriculum roadmap and journey](https://app.notion.com/p/4069e7589a238073b9faf331f2e3fd06).

This run selected the three transition steps:

- [x] Restore publishing. Seven production variables and the dedicated private-key/passphrase secrets are configured. The owner enabled the public key in Zone and confirmed the server fingerprint. The workflow unlocks the temporary key, verifies both public identities, uploads the production package and restarts the application. [Deployment succeeded](https://github.com/mishazujev/misha-labs/actions/runs/45002306163) on 22 November; see [DEPLOYMENT.md](DEPLOYMENT.md).
- [x] Audit the previous work against this project's current source. The audit covers granular transfer, K1-16, K3-06/07, sample transfers, inspection, overflow/cleanup, caps and liquid layers. It distinguishes existing mechanisms from features still needing migration and verification.
- [x] Port sample-preserving transfer into maintained sources. Beaker pours and pipette aliquots now carry solutes, indicators, solvents, temperature and acid/base reaction history. A neutralised sample keeps its warmth without generating or logging a second heat pulse. Dilution uses final solution volume. Existing preset acid/base samples remain reactive, including after partial transfer. The page was regenerated with `lab3d/build3d.sh`.

**Verification:** `npm test` passes, including six new numerical transfer tests, five deployment-preflight tests, three host-fingerprint verification tests and the existing reaction, indicator, course, distillation and analytics checks. `npm run deploy:prepare` includes the new module, and the production server serves it at the actual chemistry route. Local Chrome checked the packaged page, actual pipette functions, conservation of salt/indicator/solvent and neutralisation history, inherited temperature, notebook, reset and EN/ET/RU/UK language controls. Desktop and 390 px mobile screenshots were inspected. Transfer samples were prepared through the debug API with simulation paused; a complete pointer-driven pouring exercise remains a release check.

**Live verification:** release `1e3d445f9a90d66cd186fde9fb76aaf0c84fae32` is published at the public Chemistry URL above. The live HTML, sample-transfer module, course models and mechanics module match the merged source after normalising line endings. Chrome loaded the live Three.js scene without page errors, switched all four language controls and opened the lab guide. Live desktop and mobile screenshots were inspected. These deployment smoke checks complement the local numerical and transfer checks; they do not replace a full pointer-driven lab attempt.

**Limits and next work:** temperature mixing assumes equal volumetric heat capacity. The previous project's sample inspector, overflow/waste handling, explicit cap flow gate and binary layers have not been migrated. Near-full-vessel rejection still uses the existing model; this run does not claim overflow recovery. Next developer steps are sample inspection, overflow accounting/cleanup, and explicit cap-controlled flow. K1/K3 remain first priority, K2 next, then K8/K9. The K3-19 curriculum-ID decision remains with the user. PR #1 and the deployment fixes are merged and published; future feature releases still require authorization.

- `lab3d/lab3d.html` — Chemistry Bench 3D, ready to open in a browser (loads three.js from a CDN).
- `lab3d/` sources: `main3d.js` (scene and interaction), `i18n3d.js` (EN/RU/ET/UK texts), `decor3d.js` (closet and cabinet inventory), `elements3d.js` (periodic table data), `head3d.html` (page shell and styles).
- `lab/` — the 2D lab; `engine.js` (chemistry engine) and its translations are shared with the 3D version.
- Rebuild the 3D page after editing: `cd lab3d && bash build3d.sh` (writes `lab3d.html`).
- `HANDOFF_lab3d.md` — feature notes and code map, version by version.
- `CHEMISTRY_ENGINE.md` — layered design and validation rules for the reusable reaction engine.

## Run on localhost

Requirements: Node.js 22.5 or newer (for the built-in SQLite module). No package installation is needed.

From this directory in PowerShell:

```powershell
npm.cmd start
```

Then open <http://127.0.0.1:4173>. Keep the terminal running. Stop the server with `Ctrl+C`.

The application is organized for its permanent public address:

- `/` is the simulations hub;
- `/chemistry/` is the chemistry subject page;
- `/chemistry/lab3d/lab3d.html` and `/chemistry/lab/lab.html` open the two chemistry simulators;
- `/teacher` remains the private, shared teacher statistics area.

To use another port:

```powershell
$env:PORT=4174
npm.cmd start
```

## Deploy on Zone

The checked-in `zone-start.mjs` binds the application to the Zone virtual server's assigned loopback IP on port 4173. Upload the contents of this directory to the `labs.mishazujev.com` DocumentRoot, configure the subdomain's `mod_proxy` backend port as `4173`, and add `zone-start.mjs` as an application under `Webhosting` → `PM2 and Node.js`.

If Zone assigns a different loopback IP in the future, update `HOST` in `zone-start.mjs` before restarting the PM2 application.

Routine production updates are automated through GitHub Actions. See `DEPLOYMENT.md` for the one-time GitHub/SSH configuration and the normal push-to-deploy workflow.

## Share it publicly for testing

The machine already has ngrok installed. With the local server still running, open a second PowerShell window in this directory and run:

```powershell
npm.cmd run share
```

Open the HTTPS forwarding address printed by ngrok. Anyone with that temporary address can access the lab while both terminals and this computer remain online. Stop sharing with `Ctrl+C` in the ngrok terminal.

Treat a tunnel URL as public: do not add secrets or private student data to this static project. For a permanent URL, deploy this directory to a static host instead of relying on a tunnel.

## Private teacher statistics

The Node server records anonymous aggregate laboratory activity: sessions, active time, labs completed or abandoned, reagent/equipment use, major actions and safety mistakes. It does not record pointer movement, camera movement, student names or detailed timelines.

After starting the server, create the one private teacher account from the laboratory computer:

1. Open <http://127.0.0.1:4173/teacher>.
2. Choose a password of at least 12 characters.
3. Thereafter, use `/teacher` on either the local or current ngrok address and sign in.

First-time account creation is accepted only through localhost. The unlinked public teacher URL permits login but never account creation. Analytics are stored in `.data/lab-analytics.sqlite`; keep this file to preserve reports and include it in private backups. It is excluded from Git.

## 3D navigation

- Free rotation is the default: drag empty space with one finger on a touchscreen or the left mouse button on a computer.
- Use the named bench, cupboard and shelf buttons when you want an exact fixed viewpoint.
- Pan with two fingers, the right mouse button, or by selecting Move in the navigation bar.
- Pinch or use the mouse wheel to zoom toward the pointer.
- The `‹` and `›` buttons beside **Go to** provide the same view switching on desktop and for keyboard/switch users.
- Shelf presets use a near-eye-level camera, and free rotation is limited to avoid accidental ceiling views.
- On a desktop trackpad, a horizontal two-finger swipe produces the same snap navigation. A vertical two-finger gesture continues to zoom.

## Inspector and notebook

The **Lab notebook** button opens a collapsible inspector over the laboratory. It contains the current task, safety guidance, detailed controls, answers and the complete chronological action/observation log. Closing it leaves the full screen available to the 3D bench; live pH, temperature and balance readings remain visible on the bench.

## K1 bonding labs

The high-school **Bonding and physical properties** catalogue includes:

- K1.11 — electrical conductivity of dry salt, deionised water, salt solution and sucrose solution;
- K1.12 — electrical, thermal and mechanical comparison of copper, aluminium, iron and glass;
- K1.13 — evaporative cooling of water, ethanol and acetone under equal conditions.

These labs use the normal action log and anonymous major-action analytics. Their conductivity, heat-transfer and evaporation behaviours are reusable simulation systems rather than fixed demo recordings.

The catalogue also includes K1.14 (identifying five solids), K1.15 (factors affecting reaction rate), K3.04 (three-dimensional molecular geometry), and K3.05 (functional-group isomers). Their controlled observations are written to the same copyable laboratory notebook and counted as major anonymous activities.

## Curriculum catalogue maintenance

Every runnable online lab must have one page in the Notion **Katsed** database and at least one relation to its curriculum row in **Tunniteemad**. The relation is reciprocal, so set it on either database and verify it appears on both pages. Before adding a lab, search **Katsed** by its curriculum code and title to avoid duplicates; keep the code (for example `K1.15` or `K3.04`) in both the Notion title and the application task. Add or verify this relation as part of every future catalogue update, together with the full procedure in Notion and the concise student steps in the online lab.

## Chemistry tests

Run the renderer-independent reaction checks with:

```powershell
npm.cmd test
```
