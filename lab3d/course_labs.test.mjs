import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conductivityBrightness, conductivityCategory, evaporativeCoolingAt, HEAT_CONDUCTION_ORDER, reagentBottleMass, solutionMass } from './course_lab_models.mjs';

const pureWater = { V: 30, tot: {}, eq: { pH: 7, ppt: {} } };
const saltSolution = { V: 30, tot: { Na: 3, Cl: 3 }, eq: { pH: 7, ppt: {} } };
const sugarSolution = { V: 30, tot: { Suc: 3 }, eq: { pH: 7, ppt: {} } };
const hydrochloricAcid = { V: 30, tot: { Cl: 3 }, eq: { pH: 1, ppt: {} } };
const aceticAcid = { V: 30, tot: { Ac: 3 }, eq: { pH: 2.9, ppt: {} } };
assert.equal(conductivityCategory(conductivityBrightness(pureWater)), 'off');
assert.equal(conductivityCategory(conductivityBrightness(saltSolution)), 'bright');
assert.equal(conductivityCategory(conductivityBrightness(sugarSolution)), 'off');
assert.equal(conductivityCategory(conductivityBrightness(hydrochloricAcid)), 'bright');
assert.equal(conductivityCategory(conductivityBrightness(aceticAcid)), 'dim');
assert.deepEqual(HEAT_CONDUCTION_ORDER, ['cu', 'al', 'fe', 'glass']);
assert.ok(evaporativeCoolingAt('acetone', 1).drop > evaporativeCoolingAt('ethanol', 1).drop);
assert.ok(evaporativeCoolingAt('ethanol', 1).drop > evaporativeCoolingAt('water', 1).drop);
assert.equal(evaporativeCoolingAt('acetone', 12).active, false);
const waterMass = solutionMass({ V: 30, tot: {}, solv: {} });
const saltMass = solutionMass({ V: 30, tot: { Na: 3, Cl: 3 }, solv: {} }, { Na: 22.99, Cl: 35.45 });
const ethanolMass = solutionMass({ V: 30, tot: {}, solv: { ethanol: 28.8 } });
assert.ok(waterMass > 29.8 && waterMass < 30, '30 mL water should weigh about 29.9 g');
assert.ok(saltMass > waterMass, 'dissolved salt should increase solution mass');
assert.ok(ethanolMass < waterMass, 'ethanol solution should be lighter than the same volume of water');
assert.equal(Number((reagentBottleMass('water', 180, false) - reagentBottleMass('water', 180, true)).toFixed(1)), 5.4, 'an open bottle excludes the cap from the pan load');

const source = fs.readFileSync(new URL('./main3d.js', import.meta.url), 'utf8');
const decor = fs.readFileSync(new URL('./decor3d.js', import.meta.url), 'utf8');
for (const id of ['k111', 'k112', 'k113', 'k3v01', 'k3v02']) {
  assert.match(source, new RegExp(`id: '${id}'`), `${id} task must be registered`);
  assert.match(source, new RegExp(`${id}: \\[`), `${id} demo must be registered`);
}
for (const item of ['beaker:A', 'bottle:water', 'bottle:hcl01', 'bottle:acetic01', 'bottle:vinegar', 'bottle:naoh01', 'cond', 'glass:lamp', 'glass:matches', 'decor:ethanol', 'decor:acetone', 'thermo:1', 'thermo:2', 'thermo:3']) {
  assert.ok(source.includes(`'${item}'`), `${item} must be included in the K1 lab inventory`);
}
assert.match(source, /return \[\.\.\.vessels, \.\.\.bottles/, 'all beakers and reagent bottles must be balance items');
assert.ok(source.includes('landingOnPan'), 'the balance pan must accept carried equipment instead of repelling it');
assert.ok(source.includes('drawStream(container, mouth, landing'), 'demo pouring must show a stream aligned to the vessel');
assert.ok(source.includes('if (S.demoPose)'), 'cabinet bottles must follow demo poses');
assert.ok(source.includes('function updateBurette'), 'K3-V02 must provide a functional burette');
assert.ok(source.includes("slotFor('bottle:vinegar'"), 'the vinegar bottle must have a cabinet slot');
assert.ok(source.includes("slotFor('bottle:naoh01'"), 'the 0.10 M NaOH bottle must have a cabinet slot');
assert.ok(source.includes('function ensureInventorySlots()'), 'new inventory items must receive a fallback slot instead of crashing startup');
assert.ok(source.indexOf('ensureInventorySlots();') < source.indexOf('function buildTags()'), 'inventory slots must be completed before tag construction');
assert.match(source, /const flammables = D\.chem\.filter\(it => it\.grp === 'flam'\)/, 'flammable bottles must be rendered individually');
assert.match(source, /function viewFlammables\(\)/, 'flammables cabinet needs a dedicated close-up view');
assert.match(decor, /k: 'ethanol'.*mark: 'EtOH'.*accent:/, '96% ethanol needs a distant-recognition label and colour band');
assert.match(decor, /k: 'etohabs'.*mark: 'EtOH ABS'.*accent:/, 'absolute ethanol must be distinguishable from 96% ethanol');
assert.ok(source.includes("Math.abs(x - task.targetC) <= task.targetC * .03"), 'vinegar concentration must be checked to ±3%');

const built = fs.readFileSync(new URL('./lab3d.html', import.meta.url), 'utf8');
for (const id of ['k111', 'k112', 'k113', 'k3v01', 'k3v02']) {
  assert.ok(built.includes(`id: '${id}'`), `${id} must be present in the generated page`);
  assert.match(built, new RegExp(`${id}: \\[`), `${id} demo must be present in the generated page`);
}
assert.ok(built.includes('landingOnPan'), 'the generated page must contain the balance landing zone fix');
assert.ok(built.includes('drawStream(container, mouth, landing'), 'the generated page must contain aligned demo pouring');
console.log('course_labs: models, inventory, demos and generated page passed');
