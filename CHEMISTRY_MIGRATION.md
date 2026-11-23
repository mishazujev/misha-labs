# Chemistry migration audit — 22 November 2026

The live site's source repository is `mishazujev/misha-labs`. The server maps `/chemistry/lab3d/lab3d.html` to `lab3d/lab3d.html`, generated from `head3d.html`, shared `lab/` code, translations, decor, elements and `main3d.js`. Imported modules must be included in both `scripts/prepare-deploy.mjs` and the public file list in `server.mjs`.

Previous work remains in `C:/Users/user/coding/chemistry-labs-daily`, branch `chemistry/granular-transfer-k1-k3`, commit `9e7279c0bcd7bf235e7a2a03fd0ca746446a44f3`, [classroom-connect-91 PR #1](https://github.com/mishazujev/classroom-connect-91/pull/1). Do not copy its generated page over this project's page: this project has newer capability-based mechanics, equipment, lessons, Ukrainian support, heating, distillation and analytics.

| Previous work | Current source and migration status |
| --- | --- |
| Granular transfer | `GRAVITY_SOLIDS` already transfers discrete pieces and aggregate NaCl via falling particles. It is not the previous per-grain wall/settling model. Bench deposition and complete source/receiver/spill mass checks remain to be migrated or verified. |
| K1-16 standard solution | No K1-16 task/catalogue entry or equivalent standard-solution workflow found. Existing balance and sample chemistry can support a native activity. Port the lesson only after reconciling equipment and curriculum IDs. |
| K3-06/07 molecular editor | K3.04 shape views and K3.05 isomer/property comparisons exist. They do not implement the previous editable valence-aware molecular graph. The editor and its specific error feedback remain unmigrated. |
| Sample-preserving liquid transfer | **Ported this run.** Previously beaker transfers omitted thermal/reaction history and pipettes also omitted solvents. `sample_transfer.mjs` now supplies one composition/mixing/draining model to the actual bench paths. Six numerical tests cover conservation, dilution, temperature, heat history, preset reagents and partial/rejected dosing. |
| Read-only sample inspector | **Implemented in the current review branch.** Beaker selection/tap and Refresh show analytical amounts, concentration, temperature and liquid/solid inventory without changing the sample. The report is inside the open guide, and four languages were checked in Chrome. Not yet published. |
| Overflow and spill cleanup | **Liquid overflow/cleanup implemented in the current review branch.** Capacity acceptance, persistent coloured puddles, composition and collected waste are conserved through pour, pipette and 0.05 mL drop paths. Cleanup preserves the trial. Solid-spill accounting/cleanup remains pending. Not yet published. |
| Cap-controlled flow | **Implemented in the current review branch.** The shared gate blocks closed caps/stopcocks, including stock flow, cabinet pouring and closed-bottle pipetting. Explicit cap choices survive later drags; an active bottle has close/open controls. Numerical and actual UI stop/restart checks passed. Not yet published. |
| Density layers and shaken separation | **Implemented in the 23 November review branch, depending on PR #5.** Water/hexane and water/DCM render density-ordered binary layers and an interface, with UI shake/recovery and conserved amounts. Unknown mixtures are explicitly unmodelled. Mutual solubility, solute partitioning and selective withdrawal remain pending. Not published. |

## Publishing

[Publishing is restored](https://github.com/mishazujev/misha-labs/actions/runs/45002306163). At the initial 22 November inspection, both repository and production environment variable lists were empty, and no secret names were listed at either scope. The owner authorized the release, approved a dedicated key, enabled its public half in Zone and supplied the server fingerprint. Seven variables plus the private-key/passphrase secrets are configured. The workflow unlocks its temporary key and verifies the server identity before connecting; no known-hosts secret is needed. See [DEPLOYMENT.md](DEPLOYMENT.md) for current setup and troubleshooting.

The preflight, tests, remote access, upload, PM2 restart and public route checks passed for release `1e3d445f9a90d66cd186fde9fb76aaf0c84fae32`. Independent live-file comparisons matched the source, and Chrome loaded the public Three.js scene with language controls and lab guide on desktop and mobile. This confirms publication of the migrated transfer feature, not completion of the remaining curriculum or a full pointer-driven lab attempt. New feature releases remain subject to authorization.

## Next developer actions

- [x] Port read-only sample inspection and verify amounts, concentration, temperature and all existing languages (review branch; not published).
- [x] Port capacity-limited acceptance, liquid overflow composition and cleanup/waste accounting; verify pour, pipette and small-drop paths (review branch; solid-spill handling remains pending).
- [x] Port explicit cap-controlled flow using the current mechanical profiles; verify immediate stop/restart and closed-bottle pipetting (review branch; not published).
- [x] Limit dissolution for configured NaCl/KNO3/NH4Cl water-based reference cases; actual spatula and cabinet paths tested (23 November review branch; uncurated compounds remain pending).
- [x] Implement density-ordered water/hexane and water/DCM layers, shake and recovery (23 November review branch; not published).
- [x] Show AgCl particles, settling/resuspension and dilution-driven removal using the existing precipitation model (23 November review branch; not published).
- [ ] Author a native K3-11 water/nonpolar reference activity.
- [ ] Implement selective lower-phase withdrawal.
- [ ] Curate and apply saturation data for the remaining cabinet compounds.

Then reconcile the granular and lesson ports, condition-limited dissolution, AgCl settling, and K3-11 solvent comparisons. Keep the Notion history linked to its original project while marking migration state explicitly. A checked implementation item is not proof of deployment.
