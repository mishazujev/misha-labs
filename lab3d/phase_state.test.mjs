import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { NACL, waterVolume, dissolutionDomain, solubilityAt, dissolutionRoom, dissolveSalt, liquidLayers, advancePhases, shakeSample } from './phase_state.mjs';
import { excessOf } from './sample_transfer.mjs';
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const vessel = (water = 10) => ({ chem: { V: water, tot: {}, ind: {}, solv: {}, eq: { ppt: {}, pH: 7 } }, solid: 20, temp: 20, stir: 0 });

test('NaCl stops at the sourced water capacity, preserving solid plus dissolved mass', () => {
  const v = vessel();
  for (let i = 0; i < 2000; i++) dissolveSalt(v, .1);
  near(v.solid, 16.42); near(v.chem.tot.Na * 58.44 / 1000, 3.58);
  near(v.solid + v.chem.tot.Cl * 58.44 / 1000, 20);
  v.chem.V = 20; near(dissolutionRoom(v.chem, NACL, 20), 3.58);
});
test('organic volume cannot act as water and existing chloride alone is not counted as dissolved NaCl', () => {
  const v = vessel(); v.chem.solv.hexane = 10;
  near(waterVolume(v.chem), 0); near(dissolveSalt(v, 100), 0);
  v.chem.V = 20; near(dissolutionRoom(v.chem, NACL, 20), 3.58);
  v.chem.tot.Cl = 100; near(dissolutionRoom(v.chem, NACL, 20), 3.58);
});
test('temperature and stirring alter capacity and rate in their separate roles', () => {
  const nitrate = { f: 'KNO3', M: 101, tot: { K: 1, NO3: 1 } }, c = vessel().chem;
  near(dissolutionRoom(c, nitrate, 20), 3.166); near(dissolutionRoom(c, nitrate, 60), 10.99);
  near(solubilityAt('KNO3', 30), (31.66 + 63.9) / 2);
  assert.equal(solubilityAt('NaCl', -1), null); assert.equal(solubilityAt('NaCl', 101), null);
  near(dissolutionRoom(c, nitrate, 120), 0);
  const cosolvent = { ...c, V: 20, solv: { ethanol: 10 } };
  assert.equal(dissolutionDomain(cosolvent, nitrate, 20), 'unsupported'); near(dissolutionRoom(cosolvent, nitrate, 20), 0);
  const still = vessel(), stirred = vessel(); stirred.stir = 1;
  assert.ok(dissolveSalt(stirred, 1) > dissolveSalt(still, 1));
  dissolveSalt(stirred, 10000); dissolveSalt(still, 10000); near(still.solid, stirred.solid);
});
test('the actual cabinet-piece update obeys the same KNO3 and NH4Cl limits', () => {
  const source = fs.readFileSync(new URL('./main3d.js', import.meta.url), 'utf8');
  const start = source.indexOf('function updateSolidReactions(dt)'), end = source.indexOf('\n}', start) + 2;
  for (const compound of [{ f: 'KNO3', M: 101, tot: { K: 1, NO3: 1 }, water: .03 }, { f: 'NH₄Cl', M: 53.5, tot: { NH3: 1, Cl: 1 }, water: .03 }]) {
    const v = vessel(2); v.solid = 0; v.b = 0; v.rxLog = new Set();
    const piece = { cmp: compound, m: 3, m0: 3, mesh: { scale: { setScalar() {} } } }; v.particles = [piece];
    const context = vm.createContext({ vessels: [v], ELP: [], waterVolume, dissolutionRoom, excessOf, levelOf: () => .04, logE() {} });
    vm.runInContext(source.slice(start, end), context); context.updateSolidReactions(10000);
    const firstKey = Object.keys(compound.tot)[0], dissolved = v.chem.tot[firstKey] * compound.M / 1000;
    near(dissolved + piece.m, 3); near(dissolutionRoom(v.chem, compound, 20), 0);
    const dry = vessel(2); dry.chem.solv.hexane = 2; dry.rxLog = new Set(); dry.particles = [{ ...piece, m: 3, mesh: { position: { y: 0 }, scale: { setScalar() {} } }, sz: .001 }]; dry.b = 0;
    context.vessels = [dry]; context.updateSolidReactions(10000); near(dry.particles[0].m, 3);
  }
});
test('binary layers follow both density orderings; miscible and unsupported controls are explicit', () => {
  for (const [id, bottom, top] of [['hexane', 'water', 'hexane'], ['dcm', 'dcm', 'water']]) {
    const c = { V: 60, solv: { [id]: 20 }, tot: {} }, layers = liquidLayers(c);
    assert.equal(layers.supported, true); assert.deepEqual(layers.layers.map(l => l.id), [bottom, top]);
    near(layers.layers.reduce((n, l) => n + l.volume, 0), 60);
  }
  assert.equal(liquidLayers({ V: 40, solv: { ethanol: 20 } }).layers.length, 1);
  assert.equal(liquidLayers({ V: 20, solv: { hexane: 20 } }).layers.length, 1);
  assert.equal(liquidLayers({ V: 40, solv: { hexane: 10, ethanol: 10 } }).supported, false);
  assert.equal(liquidLayers({ V: 40, solv: { toluene: 10 } }).supported, false);
});
test('shake and separation change observations without changing sample inventory', () => {
  const v = vessel(60); v.chem.solv = { hexane: 20 }; const before = JSON.stringify(v.chem);
  shakeSample(v); advancePhases(v, .1); near(v.layerSettle, 0);
  v.stir = 0; advancePhases(v, 30); assert.ok(v.layerSettle > .99);
  assert.equal(JSON.stringify(v.chem), before);
});
const chemistry = vm.createContext({}); vm.runInContext(fs.readFileSync(new URL('../lab/engine.js', import.meta.url), 'utf8'), chemistry);
test('AgCl particles and settling follow the actual equilibrium with a no-reaction control', () => {
  const v = vessel(20); v.chem.tot = { Ag: 1, NO3: 1, Na: 2, Cl: 2 };
  v.chem.eq = chemistry.speciate(v.chem.tot, v.chem.V);
  assert.ok(v.chem.eq.ppt.AgCl > .99); near(v.chem.eq.ppt.AgCl + v.chem.eq.dis.Ag * 20, 1, 1e-7);
  const before = JSON.stringify(v.chem);
  advancePhases(v, 40); assert.ok(v.agclState.settled > .99);
  shakeSample(v); near(v.agclState.settled, 0); advancePhases(v, .1); near(v.agclState.settled, 0);
  assert.equal(JSON.stringify(v.chem), before);
  v.chem.tot = { Ag: 1, NO3: 2, Na: 1 }; v.chem.eq = chemistry.speciate(v.chem.tot, 20);
  advancePhases(v, .1); near(v.agclState.amount, 0); near(v.agclState.settled, 0);
});
test('phase translations remain available in every existing language', () => {
  const c = vm.createContext({ I18N: { en: {}, et: {}, ru: {}, uk: {} } });
  vm.runInContext(fs.readFileSync(new URL('./i18n3d.js', import.meta.url), 'utf8'), c);
  for (const key of ['phaseSeparated', 'phaseBottom', 'agclSettled', 'shakeSample']) for (const lang of ['et', 'ru', 'uk']) {
    assert.ok(c.I18N[lang]['x.' + key]); assert.notEqual(c.I18N[lang]['x.' + key], c.I18N.en['x.' + key]);
  }
});
