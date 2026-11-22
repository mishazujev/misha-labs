# Chemistry migration audit — 22 November 2026

The live site's source repository is `mishazujev/misha-labs`. The server maps `/chemistry/lab3d/lab3d.html` to `lab3d/lab3d.html`, generated from `head3d.html`, shared `lab/` code, translations, decor, elements and `main3d.js`. Imported modules must be included in both `scripts/prepare-deploy.mjs` and the public file list in `server.mjs`.

Previous work remains in `C:/Users/user/coding/chemistry-labs-daily`, branch `chemistry/granular-transfer-k1-k3`, commit `9e7279c0bcd7bf235e7a2a03fd0ca746446a44f3`, [classroom-connect-91 PR #1](https://github.com/mishazujev/classroom-connect-91/pull/1). Do not copy its generated page over this project's page: this project has newer capability-based mechanics, equipment, lessons, Ukrainian support, heating, distillation and analytics.

| Previous work | Current source and migration status |
| --- | --- |
| Granular transfer | `GRAVITY_SOLIDS` already transfers discrete pieces and aggregate NaCl via falling particles. It is not the previous per-grain wall/settling model. Bench deposition and complete source/receiver/spill mass checks remain to be migrated or verified. |
| K1-16 standard solution | No K1-16 task/catalogue entry or equivalent standard-solution workflow found. Existing balance and sample chemistry can support a native activity. Port the lesson only after reconciling equipment and curriculum IDs. |
| K3-06/07 molecular editor | K3.04 shape views and K3.05 isomer/property comparisons exist. They do not implement the previous editable valence-aware molecular graph. The editor and its specific error feedback remain unmigrated. |
| Sample-preserving liquid transfer | **Ported this run.** Previously beaker transfers omitted thermal/reaction history and pipettes also omitted solvents. `sample_transfer.mjs` now supplies one composition/mixing/draining model to the actual bench paths. Six numerical tests cover conservation, dilution, temperature, heat history, preset reagents and partial/rejected dosing. |
| Read-only sample inspector | The current inspector is the procedure/action-log panel; it is not the previous sample selector showing component amounts and concentrations. Migration and language verification pending. |
| Overflow and spill cleanup | `addLiquid` still rejects a dose near capacity, and upstream pour paths can already have removed liquid. Splash effects do not establish a persistent, conserved spill/waste ledger. The previous capacity/overflow/cleanup feature remains pending. |
| Cap-controlled flow | Cabinet caps and phase-based mechanical profiles exist. The stock-bottle `flowFrom` path lacks the previous explicit cap/stopcock flow gate. Port and test controls against these mechanics instead of replacing the mechanics layer. |
| Density layers and shaken separation | Solvent amounts, evaporation models and shake interactions exist. No equivalent binary layer renderer/state model found. Water/hexane and water/DCM layer and recovery checks remain pending. |

## Publishing

[The latest observed deployment](https://github.com/mishazujev/misha-labs/actions/runs/41769281023) failed at target validation. On 22 November, both repository and production environment variable lists were empty, and no secret names were listed at either scope. Code cannot recreate the dedicated private key or trusted host-key record. Configure the six documented variables and two secrets in the production environment using [DEPLOYMENT.md](DEPLOYMENT.md). No production settings were changed and no deployment was triggered in this run.

The new preflight reports missing setting names together and checks path, port, URL and remote command fields before SSH configuration. It does not prove that credentials work or that the target server is reachable. Those checks await restored configuration and authorization to publish.

## Next developer actions

- [ ] Port read-only sample inspection and verify amounts, concentration, temperature and all existing languages.
- [ ] Port capacity-limited acceptance, overflow composition and cleanup/waste accounting together; verify both pour and pipette paths.
- [ ] Port explicit cap-controlled flow using the current mechanical profiles; verify immediate stop/restart and closed-bottle pipetting.

Then reconcile the granular and lesson ports, condition-limited dissolution, AgCl settling, and K3-11 solvent comparisons. Keep the Notion history linked to its original project while marking migration state explicitly. A checked implementation item is not proof of deployment.
