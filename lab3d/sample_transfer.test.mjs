import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { sampleComposition, mixSample, drainSample, excessOf } from './sample_transfer.mjs';

// Exercise the actual bench entry points, with rendering/logging isolated.
const source = fs.readFileSync(new URL('./main3d.js', import.meta.url), 'utf8');
function namedFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('\n}', start) + 2;
  return source.slice(start, end);
}
const engine = fs.readFileSync(new URL('../lab/engine.js', import.meta.url), 'utf8');
function bench() {
  const logs = [];
  const context = vm.createContext({ sampleComposition, mixSample, drainSample, excessOf, performance, console, window: {},
    NB: { session: null }, TASK: {}, FILM: .4,
    logE: (...args) => logs.push(args), endSession() {}, ppeCheck() {}, spawnPlume() {}, addWave() {},
    snap: v => ({ V: v.chem.V }), T: key => key, fmt: x => String(x), worldToLocal: () => ({ x: 0, z: 0 }), SPL: [] });
  const remove = source.slice(source.indexOf('function removeLiquid('), source.indexOf('\nfunction doEq('));
  const comp = source.slice(source.indexOf('const compOfVessel ='), source.indexOf('\nconst MW ='));
  vm.runInContext(engine + '\n' + comp + '\n' + remove + '\n' + ['addLiquid', 'doEq', 'pipTake', 'pipGive'].map(namedFunction).join('\n') + '\nthis.compOfVessel = compOfVessel;', context);
  return { ...context, logs };
}
const vessel = (V = 0) => ({ letter: 'A', chem: { V, tot: {}, ind: {}, solv: {}, cap: 250 }, temp: 22, neutPrev: 0, warmLogT: 22, gas: 0 });
const pipette = () => ({ chem: { V: 0, tot: {}, ind: {} }, g: { position: { x: 0, z: 0 } } });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('pipetting a warm neutralised sample conserves components and reaction history', () => {
  const core = bench(), from = vessel(40), to = vessel(), pip = pipette();
  Object.assign(from.chem, { tot: { Na: 2, Cl: 2 }, ind: { univ: 1 }, solv: { ethanol: 4 }, acidEq: 2, baseEq: 2 });
  from.temp = 35; from.neutPrev = 2;
  assert.equal(core.pipTake(pip, { kind: 'vessel', v: from }, 10), 10);
  assert.equal(pip.chem.temp, 35);
  assert.equal(core.pipGive(pip, { kind: 'vessel', v: to }, 10), 10);
  core.doEq(to);
  assert.equal(to.temp, 35);
  assert.equal(to.neutPrev, .5);
  assert.equal(core.logs.length, 0, 'inherited warmth must not be logged as new heat');
  for (const [field, key, original] of [['tot', 'Na', 2], ['tot', 'Cl', 2], ['ind', 'univ', 1], ['solv', 'ethanol', 4]]) near(from.chem[field][key] + to.chem[field][key], original);
  assert.equal(pip.chem.V, 0); assert.equal(Object.keys(pip.chem.solv).length, 0);
  assert.equal(pip.chem.acidEq, 0); assert.equal(pip.chem.baseEq, 0);
});

test('fresh acid and base still produce one heat pulse, which survives a later pour', () => {
  const core = bench(), v = vessel();
  core.addLiquid(v, { id: 'acid', tot: { Cl: .1 }, ind: {} }, 20);
  core.addLiquid(v, { id: 'base', tot: { Na: .1 }, ind: {} }, 20);
  core.doEq(v);
  near(v.temp, 22 + 2 * 57.3 / (40 * 4.18));
  const warm = v.temp, target = vessel(), comp = core.compOfVessel(v);
  const removed = core.removeLiquid(v, 10);
  core.addLiquid(target, comp, removed); core.doEq(target);
  near(target.temp, warm); near(v.neutPrev + target.neutPrev, 2);
});

test('serial dilution preserves solute and final-volume concentration', () => {
  const core = bench(), from = vessel(100), to = vessel(), pip = pipette();
  from.chem.tot = { Na: 10, Cl: 10 };
  core.pipTake(pip, { kind: 'vessel', v: from }, 10);
  core.pipGive(pip, { kind: 'vessel', v: to }, 10);
  core.addLiquid(to, { id: 'water', tot: {}, ind: {} }, 90);
  near(to.chem.tot.Na / to.chem.V, .01); near(from.chem.tot.Na + to.chem.tot.Na, 10);
});

test('preset acid without historical fields remains reactive after a partial pipette transfer', () => {
  const core = bench(), from = vessel(20), to = vessel(10), pip = pipette();
  from.chem.tot = { Cl: 2 }; to.chem.tot = { Na: 1 };
  core.pipTake(pip, { kind: 'vessel', v: from }, 10);
  core.pipGive(pip, { kind: 'vessel', v: to }, 10);
  core.doEq(to);
  near(to.temp, 22 + 57.3 / (20 * 4.18));
  near(from.chem.acidEq, 1); near(to.chem.acidEq, 1); near(to.chem.baseEq, 1);
});

test('partial pipette release and rejected full-vessel dose preserve the remaining sample', () => {
  const core = bench(), from = vessel(20), to = vessel(), pip = pipette();
  from.chem.solv = { ethanol: 16 }; from.temp = 40;
  core.pipTake(pip, { kind: 'vessel', v: from }, 8);
  core.pipGive(pip, { kind: 'vessel', v: to }, 3);
  near(pip.chem.V, 5); near(pip.chem.solv.ethanol, 4); near(to.chem.solv.ethanol, 2.4);
  const full = vessel(244), before = JSON.stringify(pip.chem);
  assert.equal(core.pipGive(pip, { kind: 'vessel', v: full }, 1), 0);
  assert.equal(JSON.stringify(pip.chem), before);
});

test('mixing temperatures and aliquots are read-only and concentration correct', () => {
  const v = { V: 10, tot: { Na: 1 }, ind: {}, solv: {}, temp: 20 };
  const before = JSON.stringify(v), comp = sampleComposition(v);
  assert.equal(JSON.stringify(v), before); comp.tot.Na = 999; assert.equal(v.tot.Na, 1);
  mixSample(v, { tot: {}, temp: 40 }, 10); near(v.temp, 30);
  const aliquot = sampleComposition(v); near(aliquot.tot.Na, .05);
  drainSample(v, 100); assert.equal(v.V, 0); assert.equal(Object.keys(v.tot).length, 0);
  assert.equal(sampleComposition(v).acidEq, 0);
});
