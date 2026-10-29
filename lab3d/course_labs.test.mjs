import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { C4H10O_ISOMERS, conductivityBrightness, conductivityCategory, carbonateReactionTime, evaporativeCoolingAt, HEAT_CONDUCTION_ORDER, MOLECULE_MODELS, peroxideOxygenRate, reagentBottleMass, solutionMass, UNKNOWN_SOLIDS, unknownSolidObservation } from './course_lab_models.mjs';
import { MECHANICAL_PROFILES, PHYSICAL_PHASES, applyMechanicalProfile, hasMechanicalCapability, mechanicalRadius, mechanicalCarryHeight, canTransferPhase, phaseMechanics } from './mechanics.mjs';

const waterBottle = applyMechanicalProfile({ chemical: 'water' }, 'reagentBottle');
const acidBottle = applyMechanicalProfile({ chemical: 'hydrochloric-acid' }, 'reagentBottle');
const genericFlask = applyMechanicalProfile({}, 'openVessel', { geometry: 'conical-flask', collisionRadius: .05 });
assert.deepEqual([...waterBottle.mechanics.capabilities], [...acidBottle.mechanics.capabilities], 'chemical identity must not alter mechanical behaviour');
assert.ok(hasMechanicalCapability(genericFlask, 'pourLiquid'));
assert.ok(hasMechanicalCapability(genericFlask, 'pourSolid'));
assert.ok(hasMechanicalCapability(genericFlask, 'heat'));
assert.equal(canTransferPhase(genericFlask, 'solid'), true);
assert.equal(canTransferPhase(genericFlask, 'powder'), true);
assert.equal(canTransferPhase(genericFlask, 'granularSolid'), true);
assert.equal(phaseMechanics('solidPiece').gravity, true);
assert.equal(PHYSICAL_PHASES.gas.flowsOnTilt, false);
assert.equal(mechanicalRadius(genericFlask), .05);
assert.equal(mechanicalCarryHeight(genericFlask), .16);
assert.ok(Object.keys(MECHANICAL_PROFILES).includes('probe'));

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
assert.equal(Object.keys(UNKNOWN_SOLIDS).length, 5);
assert.equal(unknownSolidObservation('iron', 'magnet'), true);
assert.equal(unknownSolidObservation('nacl', 'conductivity'), 'bright');
assert.equal(unknownSolidObservation('sucrose', 'conductivity'), 'off');
assert.equal(unknownSolidObservation('missing', 'water'), null);
const baselineRate = carbonateReactionTime({ concentration: 1, temperature: 20, form: 'chips' });
assert.ok(carbonateReactionTime({ concentration: 2, temperature: 20, form: 'chips' }) < baselineRate);
assert.ok(carbonateReactionTime({ concentration: 1, temperature: 35, form: 'chips' }) < baselineRate);
assert.ok(carbonateReactionTime({ concentration: 1, temperature: 20, form: 'powder' }) < baselineRate);
assert.ok(peroxideOxygenRate(true).seconds < peroxideOxygenRate(false).seconds);
assert.equal(MOLECULE_MODELS.co2.angle, 180);
assert.equal(MOLECULE_MODELS.h2o.geometry, 'bent');
assert.equal(C4H10O_ISOMERS.butanol.hydrogenBondDonor, true);
assert.ok(C4H10O_ISOMERS.butanol.boilingPoint > C4H10O_ISOMERS.ether.boilingPoint);
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
const dictionarySource = [
  '../lab/i18n_en.js', '../lab/i18n_ru.js', '../lab/i18n_et.js', '../lab/i18n_uk.js', './i18n3d.js'
].map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const dictionaryContext = {};
vm.runInNewContext(`${dictionarySource}\n;globalThis.__i18n = I18N;`, dictionaryContext);
const instructionKeys = ['x.steps', 'lab.ph.steps', 'lab.comb.steps',
  'x.lab.ind1', 'x.lab.ind2', 'x.lab.ind3', 'x.lab.pre1', 'x.lab.pre2', 'x.lab.pre3',
  'x.lab.nonmetalsSpc', 'x.lab.halogens', 'x.lab.k111', 'x.lab.k112', 'x.lab.k113', 'x.lab.k3v01', 'x.lab.k3v02'];
for (const lang of ['ru', 'et', 'uk']) {
  for (const key of instructionKeys) {
    assert.ok(dictionaryContext.__i18n[lang][key], `${lang}.${key} must be translated`);
    assert.notEqual(dictionaryContext.__i18n[lang][key], dictionaryContext.__i18n.en[key], `${lang}.${key} must not fall back to English`);
  }
  for (const key of ['x.k3v01.title', 'x.k3v01.goal', 'x.k3v01.desc', 'x.lab.k3v01', 'x.lab.k3v01.done', 'x.lab.k3v01.sensory',
    'x.k3v02.title', 'x.k3v02.goal', 'x.k3v02.desc', 'x.lab.k3v02', 'x.lab.k3v02.done', 'x.lab.k3v02.sensory']) {
    assert.ok(dictionaryContext.__i18n[lang][key], `${lang}.${key} must be translated`);
    assert.notEqual(dictionaryContext.__i18n[lang][key], dictionaryContext.__i18n.en[key], `${lang}.${key} must not fall back to English`);
  }
}
for (const id of ['k111', 'k112', 'k113', 'k3v01', 'k3v02']) {
  assert.match(source, new RegExp(`id: '${id}'`), `${id} task must be registered`);
  assert.match(source, new RegExp(`${id}: \\[`), `${id} demo must be registered`);
}
for (const id of ['k114', 'k115', 'k304', 'k305']) {
  assert.match(source, new RegExp(`id: '${id}'`), `${id} task must be registered`);
  assert.match(source, new RegExp(`id: '${id}', run: '${id}'`), `${id} must be visible in the lab catalogue`);
}
for (const id of ['nonmetals-spc', 'nonmetals-halogens']) {
  assert.match(source, new RegExp(`id: '${id}', run: '${id}'`), `${id} must be visible and runnable in the lab catalogue`);
  assert.ok(source.includes(`id: '${id}'`), `${id} task must be registered`);
}
assert.ok(source.includes("['nonmetals', T('topic.nonmetals')]"), 'the catalogue must expose the Nonmetals topic filter');
for (const Z of [6, 15, 16]) assert.ok(source.includes(`['el:${Z}']`), `element ${Z} must be preloaded by the S/P/C lab`);
for (const reagent of ['chlorineWater', 'bromineWater', 'iodineSolution', 'kbr', 'ki']) assert.ok(source.includes(`['bottle:${reagent}']`), `${reagent} must be a working halogen-lab reagent`);
assert.ok(source.includes('function reactHalogens'), 'the halogen lab must calculate displacement reactions from mixed reagents');
assert.ok(source.includes('function stageTaskInHood'), 'hazardous nonmetal labs must stage their apparatus in the fume cupboard');
assert.match(source, /id: 'nonmetals-spc'.*hoodLab: true/, 'the S/P/C lab must launch in the fume cupboard');
assert.match(source, /id: 'nonmetals-halogens'.*hoodLab: true/, 'the halogen lab must launch in the fume cupboard');
assert.ok(source.includes('const GRAVITY_SOLIDS'), 'all vessel-borne solids must share one name-independent gravity behaviour');
assert.ok(source.includes("if (canTransferPhase(o, 'solid')) GRAVITY_SOLIDS.update(o, tg, dt)"), 'solid gravity must run through the generic phase-transfer capability');
assert.ok(!source.includes('o.metal && o.metal.length'), 'pouring must not depend on a metal-specific contents field');
assert.ok(source.includes("applyMechanicalProfile(v, 'openVessel'"), 'working vessels must receive a reusable mechanics profile');
assert.ok(source.includes("applyMechanicalProfile(o, 'reagentBottle'"), 'all reagent identities must share the bottle mechanics profile');
assert.ok(source.includes("const HELD_R = mechanicalRadius"), 'collision radius must come from geometry rather than object names');
assert.ok(source.includes('const carryH = mechanicalCarryHeight'), 'carry behaviour must come from the mechanics profile');
assert.ok(source.includes("hasMechanicalCapability(o, 'tilt') && o.pour"), 'release/docking must use capabilities rather than named container classes');
assert.ok(source.includes("if (k === 'tripod') S.heatStand"), 'tripod and wire gauze must be a functional heat support');
assert.ok(source.includes('function snapVesselToHeatStand'), 'beakers must snap onto the generic heat support');
assert.ok(source.includes('function snapHeatSource'), 'spirit lamps and Bunsen burners must snap beneath the heat support');
assert.ok(source.includes('function updateVesselHeating'), 'all vessel contents must use the global heating model');
assert.match(source, /function updateVessel\(v, dt, t\)[\s\S]*?updateVesselHeating\(v, dt\)/, 'heating must run for every active beaker, independent of lab id');
assert.ok(source.includes('function runActivityTrial'), 'controlled evidence labs must use the reusable activity station');
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
assert.ok(source.includes('const functionalChem = new Set'), 'working chemical bottles must replace duplicate display-only shelf models');
assert.ok(source.includes('ROOM.flam.x'), 'the flammables cabinet must live in the Chemicals side of the room');
assert.ok(source.includes("if (!TAP.on && v.chem.V > FILM + .3) v.sinkDrain"), 'a filled beaker released into the sink with the tap off must drain');
assert.match(decor, /k: 'ethanol'.*mark: 'EtOH'.*accent:/, '96% ethanol needs a distant-recognition label and colour band');
assert.match(decor, /k: 'etohabs'.*mark: 'EtOH ABS'.*accent:/, 'absolute ethanol must be distinguishable from 96% ethanol');
assert.ok(source.includes("Math.abs(x - task.targetC) <= task.targetC * .03"), 'vinegar concentration must be checked to ±3%');

const built = fs.readFileSync(new URL('./lab3d.html', import.meta.url), 'utf8');
for (const id of ['k111', 'k112', 'k113', 'k3v01', 'k3v02']) {
  assert.ok(built.includes(`id: '${id}'`), `${id} must be present in the generated page`);
  assert.match(built, new RegExp(`${id}: \\[`), `${id} demo must be present in the generated page`);
}
for (const id of ['k114', 'k115', 'k304', 'k305']) {
  assert.ok(built.includes(`id: '${id}'`), `${id} must be present in the generated page`);
}
for (const id of ['nonmetals-spc', 'nonmetals-halogens']) {
  assert.ok(built.includes(`id: '${id}', run: '${id}'`), `${id} must be present in the generated catalogue`);
}
assert.ok(built.includes('landingOnPan'), 'the generated page must contain the balance landing zone fix');
assert.ok(built.includes('drawStream(container, mouth, landing'), 'the generated page must contain aligned demo pouring');
assert.ok(built.includes('const functionalChem = new Set'), 'the generated page must omit duplicate working chemical models');
assert.ok(built.includes('v.sinkDrain'), 'the generated page must contain sink draining behavior');
assert.ok(built.includes("from './mechanics.mjs'"), 'the generated page must load the shared mechanics layer');
console.log('course_labs: models, inventory, demos and generated page passed');
