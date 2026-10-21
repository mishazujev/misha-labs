# Chemistry simulation architecture

Scientific correctness takes priority over spectacle. The simulation is divided into three layers so chemical calculations can be tested independently of Three.js.

## 1. Chemical state and equilibrium

This layer owns amounts, volume, temperature, phase, pH, dissolved species and equilibrium. The existing `lab/engine.js` currently covers:

- strong acids and bases;
- ammonium/ammonia, acetate and carbonate equilibria;
- selected hydroxide, carbonate, halide and sulfate precipitates;
- indicator colour as a function of pH;
- carbon dioxide release above its dissolved limit.

## 2. Reaction and kinetics

`lab/reaction_engine.js` adds reusable, renderer-independent calculations. Its first version includes:

- formula parsing, including Unicode subscripts and grouped formulas;
- neutralisation extent, heat release and expected temperature rise;
- hydrocarbon and oxygenated-fuel combustion;
- oxygen-limited combustion with balanced CO₂, CO, soot and water products;
- heat release and normalized effect signals;
- gas-to-bubble/foam scaling.

Future rules belong here: redox, complex ions, solvent partitioning, esterification, hydrolysis, reaction rates, evaporation and phase changes.

## 3. Presentation and observations

The renderer translates reaction outputs into bounded visual effects:

- gas rate → bubble count, size and foam;
- precipitate amount → cloud density and settling mass;
- heat flux → temperature, convection, steam or boiling;
- combustion rate and oxygen ratio → flame size, colour, smoke and soot;
- absorbing species → liquid colour and mixing plumes;
- hazardous vapour or odour → a textual observation and fume-cupboard requirement.

Smell is never presented as something a student should physically test. The simulation records an odour observation only when educationally appropriate and pairs hazardous vapours with safety guidance.

## Validation rule

Every reaction rule should have automated conservation tests for atoms and charge where applicable, plus reference values for equilibrium constants, enthalpy and expected observations. Visual tuning must not change calculated chemistry.
