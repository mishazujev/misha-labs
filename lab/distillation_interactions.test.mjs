import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./scenes2.js', import.meta.url), 'utf8');
const measured = [];
const sandbox = {
  console,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  T: k => k,
  mixVol: (e, w) => e + w,
  sphereLevel: () => 0,
  addGoggles() {},
  needGoggles: () => true,
  logE() {},
  refreshSide() {},
  toast() {},
  measureRec(i) { measured[i] = 64; return true; },
  fmt: v => String(v),
  stopSim() {},
  setInterval() {},
  distTick() {},
  mistake() {},
  drawFlame(ctx, f, x, y, a, b, dt, t, strength) { sandbox.lastFlame = strength; },
  logDirty: false,
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nglobalThis.testDistScene = distScene2; globalThis.testMatch = makeMatch;`, sandbox);

const dist = {
  nE: 1, nW: 1, T: 20, Tth: 20, measured: [null, null, null], burned: [false, false, false],
  rec: [{ nE: 3, nW: 1 }, { nE: 0, nW: 0 }, { nE: 0, nW: 0 }],
};
const sc = sandbox.testDistScene({ dist });

const chips = sc.objs.find(o => o.kind === 'chips');
chips.x = 400; chips.y = 300; chips.drop();
assert.equal(chips.y, 520, 'an invalid drop leaves boiling chips on the bench');
assert.equal(chips.stay, true, 'an invalid drop must not trigger return-to-home');

const receiver = sc.objs.find(o => o.kind === 'rec' && o.i === 1);
receiver.x = 430; receiver.y = 300; receiver.drop();
assert.equal(receiver.y, 520, 'a misplaced receiver stays on the bench');
assert.equal(receiver.stay, true);

const firstReceiver = sc.objs.find(o => o.kind === 'rec' && o.i === 0);
const alcoholometer = sc.objs.find(o => o.kind === 'alc');
alcoholometer.x = firstReceiver.x; alcoholometer.y = firstReceiver.y - 20; alcoholometer.drop();
assert.equal(dist.alcRec, 0, 'the alcoholometer attaches to the receiver');
assert.equal(alcoholometer.stay, true, 'the attached alcoholometer does not jump home');
assert.equal(alcoholometer.x, firstReceiver.x);
assert.equal(alcoholometer.y, firstReceiver.y);

firstReceiver.pick();
assert.equal(dist.alcRec, null, 'moving the receiver safely detaches the alcoholometer');
assert.equal(alcoholometer.y, 520, 'the detached alcoholometer is placed on the bench');

const match = sandbox.testMatch(sc, { x: 300, y: 200 }, () => false);
match.drop();
assert.equal(match.y, 520, 'a released match remains on the bench');
assert.equal(match.stay, true);
const ctx = new Proxy({}, { get: (obj, key) => obj[key] || (() => {}) });
match.draw(ctx, 1, 0);
assert.equal(sandbox.lastFlame, 1, 'a released match continues burning');
match.life = 12;
match.draw(ctx, 0, 0);
assert.equal(sandbox.lastFlame, 0, 'a match eventually burns out');

console.log('distillation_interactions: placement, alcoholometer and matches passed');
