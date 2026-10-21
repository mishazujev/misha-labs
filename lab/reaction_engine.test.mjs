import assert from 'node:assert/strict';
import './reaction_engine.js';

const R = globalThis.ReactionSimulation;
assert.deepEqual(R.parseFormula('C₂H₅OH'), { C: 2, H: 6, O: 1 });
assert.deepEqual(R.parseFormula('(C₂H₅)₂O'), { C: 4, H: 10, O: 1 });

const n = R.neutralization({ acidMmol: 10, baseMmol: 7, solutionMl: 100 });
assert.equal(n.reactedMmol, 7);
assert.ok(Math.abs(n.heatJ - 401.1) < 1e-9);
assert.ok(Math.abs(n.deltaC - 0.95956937799) < 1e-6);

const methane = R.combustion('CH₄', 1);
assert.equal(methane.products.CO2, 1);
assert.equal(methane.products.H2O, 2);
assert.equal(methane.reactants.oxygenMol, 2);
assert.equal(methane.complete, true);

const starved = R.combustion('C₆H₁₄', 1, { oxygenMol: 4 });
assert.equal(starved.complete, false);
assert.ok(starved.products.CO > 0);
assert.ok(starved.products.sootC > 0);
assert.ok(starved.effects.some(e => e.type === 'hazard' && e.species === 'CO'));
assert.ok(Math.abs(starved.products.CO2 + starved.products.CO + starved.products.sootC - 6 * starved.burnedMol) < 1e-10);
assert.ok(Math.abs(2 * starved.reactants.oxygenMol - (2 * starved.products.CO2 + starved.products.CO + starved.products.H2O)) < 1e-10);

console.log('reaction_engine: all tests passed');
