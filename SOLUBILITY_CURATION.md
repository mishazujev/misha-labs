# Cabinet solubility curation

Status: 25 November 2026, review branch; unpublished.

The reference source is the [Sigma-Aldrich temperature table](https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/solubility-table-compounds-water-temperature). Its stated basis is grams solute per 100 g water. A product specification that says a sample is soluble at a tested concentration is not evidence that this is its saturation concentration.

| Configured solid | Current implementation | Remaining validation |
| --- | --- | --- |
| NaCl | Finite curve, 0–100 °C | Single-salt aqueous approximation only |
| KNO3 | Finite curve, 0–100 °C | Same scope |
| NH4Cl | Finite curve, 0–100 °C | Same scope |
| NaHCO3 | Finite curve, conservatively restricted to 0–40 °C; acid attack separate | Reactive mixtures and thermal decomposition are outside the saturation reference |
| Na2SO4 | Legacy uptake, no curated saturation limit | Source distinguishes anhydrous and decahydrate; do not join those rows into a room-temperature anhydrous curve |
| CuSO4·5H2O | Legacy uptake | Confirm hydrate versus anhydrous mass basis and account for crystal water before activation |
| FeSO4·7H2O | Legacy uptake | Confirm mass basis, crystal water and valid temperature domain |
| CaCl2 | Legacy uptake | Configured formula is anhydrous; the reviewed source row is dihydrate |
| CaCO3 | Existing acid-reaction model, no new saturation curve | Validate aqueous carbonate equilibrium and reaction conditions rather than assigning a soluble-salt curve |
| Citric acid | Legacy uptake | Validate acid speciation; current cabinet uses acetate-equivalent bookkeeping |
| Sucrose | Legacy uptake | Find a verified saturation curve and temperature domain |
| Glucose | Legacy uptake | Find a verified saturation curve and replace the shared sucrose-equivalent species before assessing glucose-specific amounts |

Four of the twelve configured solid compound definitions with uptake/reaction coefficients now have finite reference curves. The broad remaining-cabinet roadmap action stays open.

## Bicarbonate implementation

Use 6.89, 9.6 and 12.7 g NaHCO3 per 100 g water at 0, 20 and 40 °C, interpolating within that interval only. The upper bound is a conservative implementation choice, not a claimed decomposition threshold. Remaining water is approximated as 1 g/mL; additive volumes and analytical formula units are used. Organic volume does not increase aqueous capacity. Mixed salts, activity/common-ion effects, crystal growth and cooling crystallisation are not predicted.

Water-driven uptake is limited by remaining saturation capacity. The existing acid-driven channel is independent of that limit and is bounded by available acid equivalents. This avoids freezing acid attack merely because a water saturation limit has been reached. It does not turn the reference curve into a validated acid-mixture solubility model.

## Selective phase withdrawal

The mounted separator implements only water/hexane and water/DCM with aqueous NaCl. Na and Cl and their reaction history stay in the water phase; organic volume stays with its solvent. Unsupported solutes, indicators, precipitates and mixed organic solvents close/block the valve. No partition coefficient is invented. Other vessels retain representative bulk transfers, and the legacy ionic equilibrium solver still uses bulk volume.

The lower phase drains first, with automatic stop at its boundary. Reopening is an explicit learner action after changing receivers. The stop is a usability aid, not a simulation of a human's uncertain endpoint. Solvent tints and settling time are explanatory illustrations. No mutual solubility, dissolved-organic partitioning, emulsion stability or separatory-funnel pressure/venting model is claimed; ester separation needs those additional models.
