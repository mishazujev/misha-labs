# Bench Chemistry Lab

**Public Chemistry lab:** <https://labs.mishazujev.com/chemistry/lab3d/lab3d.html>

## Daily development status — 22 November 2026

The daily job now works in **mishazujev/misha-labs**, using the maintained sources in this repository. This run is prepared in [misha-labs draft PR #1](https://github.com/mishazujev/misha-labs/pull/1), with GitHub validation passing. The old `classroom-connect-91` chemistry branch is preserved as a migration reference; its completed checkboxes do not establish that a feature exists here or on the public site. See [the migration audit](CHEMISTRY_MIGRATION.md) and the [curriculum roadmap and journey](https://app.notion.com/p/4069e7589a238073b9faf331f2e3fd06).

This run selected the three transition steps:

- [ ] Restore publishing. Inspection found no repository or production-environment variables and no listed deployment secrets. The last failed run stopped with an empty `ZONE_TARGET_PATH`. Added a preflight that reports all missing settings before creating SSH files and retains validation of the remote target. The actual lab page and its new transfer module are included in post-deployment checks. The remaining setup is described in [DEPLOYMENT.md](DEPLOYMENT.md); publication still requires authorization.
- [x] Audit the previous work against this project's current source. The audit covers granular transfer, K1-16, K3-06/07, sample transfers, inspection, overflow/cleanup, caps and liquid layers. It distinguishes existing mechanisms from features still needing migration and verification.
- [x] Port sample-preserving transfer into maintained sources. Beaker pours and pipette aliquots now carry solutes, indicators, solvents, temperature and acid/base reaction history. A neutralised sample keeps its warmth without generating or logging a second heat pulse. Dilution uses final solution volume. Existing preset acid/base samples remain reactive, including after partial transfer. The page was regenerated with `lab3d/build3d.sh`.

**Verification:** `npm test` passes, including six new numerical transfer tests, four deployment-preflight tests and the existing reaction, indicator, course, distillation and analytics checks. `npm run deploy:prepare` includes the new module, and the production server serves it at the actual chemistry route. Local Chrome checked the packaged page, actual pipette functions, conservation of salt/indicator/solvent and neutralisation history, inherited temperature, notebook, reset and EN/ET/RU/UK language controls. Desktop and 390 px mobile screenshots were inspected. Transfer samples were prepared through the debug API with simulation paused; a complete pointer-driven pouring exercise remains a release check.

**Limits and next work:** temperature mixing assumes equal volumetric heat capacity. The previous project's sample inspector, overflow/waste handling, explicit cap flow gate and binary layers have not been migrated. Near-full-vessel rejection still uses the existing model; this run does not claim overflow recovery. Next developer steps are sample inspection, overflow accounting/cleanup, and explicit cap-controlled flow. K1/K3 remain first priority, K2 next, then K8/K9. The K3-19 curriculum-ID decision remains with the user. No merge or live deployment has been performed.

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
