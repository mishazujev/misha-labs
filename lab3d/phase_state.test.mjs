import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { NACL, waterVolume, dissolutionDomain, solubilityAt, dissolutionRoom, dissolveSalt, liquidLayers, advancePhases, shakeSample, separatorSupported, drainLowerPhase, solubilityTrial } from './phase_state.mjs';
import { mixSample, excessOf } from './sample_transfer.mjs';
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

test('bicarbonate uses the correct mass basis and bounded reference range', () => {
  const C={f:'NaHCO₃',M:84,tot:{Na:1,Ct:1}},v=vessel(10);
  near(solubilityAt(C.f,20),9.6); near(solubilityAt(C.f,30),11.15);
  near(dissolutionRoom(v.chem,C,20),.96); assert.equal(solubilityAt(C.f,41),null);
  v.chem.tot={Na:10,Ct:10}; near(dissolutionRoom(v.chem,C,20),.12);
  v.chem.solv.hexane=10; near(dissolutionRoom(v.chem,C,20),0);
});
test('saturation does not stop acid attack, and acid capacity limits solid uptake', () => {
  const source=fs.readFileSync(new URL('./main3d.js',import.meta.url),'utf8');
  const start=source.indexOf('function updateSolidReactions(dt)'),end=source.indexOf('\n}',start)+2;
  const compound={f:'NaHCO₃',M:84,tot:{Na:1,Ct:1},water:.03,acid:.05};
  const v=vessel(10);v.chem.tot={Na:20,Ct:20,Cl:21};v.chem.eq.pH=1;v.rxLog=new Set();v.b=0;
  const piece={cmp:compound,m:3,m0:3,mesh:{scale:{setScalar(){}}}};v.particles=[piece];
  const context=vm.createContext({vessels:[v],ELP:[],waterVolume,dissolutionRoom,excessOf,levelOf:()=>.04,logE(){}});
  vm.runInContext(source.slice(start,end),context); context.updateSolidReactions(10000);
  near(3-piece.m,.084); near(v.chem.tot.Na,21); near(v.chem.tot.Ct,21); near(v.chem.baseEq,1);
});
test('lower-phase withdrawal respects density, stops at the interface, and conserves solutes/heat history', () => {
  for(const organic of ['hexane','dcm']) {
    const c={V:60,tot:{Na:4,Cl:4},ind:{},solv:{[organic]:20},temp:32,acidEq:3,baseEq:3,neutralised:3};
    const receivers=[{V:0,tot:{},ind:{},solv:{}},{V:0,tot:{},ind:{},solv:{}}];
    const first=drainLowerPhase(c,1000); assert.equal(first.boundary,true);
    near(first.volume,organic==='hexane'?40:20); assert.equal(first.phase,organic==='hexane'?'water':'dcm');
    mixSample(receivers[0],first.comp,first.volume);
    const second=drainLowerPhase(c,1000); mixSample(receivers[1],second.comp,second.volume);
    near(c.V,0); near(receivers.reduce((n,r)=>n+r.V,0),60);
    for(const key of ['Na','Cl']) near(receivers.reduce((n,r)=>n+(r.tot[key]||0),0),4);
    near(receivers.reduce((n,r)=>n+(r.solv[organic]||0),0),20);
    for(const key of ['acidEq','baseEq','neutralised']) near(receivers.reduce((n,r)=>n+r[key],0),3);
    receivers.forEach(r=>near(r.temp,32));
  }
});
test('partial aqueous withdrawal carries phase concentration, organic withdrawal leaves ions behind',()=>{
  const c={V:60,tot:{Na:4,Cl:4},ind:{},solv:{hexane:20}};
  const part=drainLowerPhase(c,10); near(part.comp.tot.Na,.1); near(c.tot.Na,3); near(c.V,50);near(c.solv.hexane,20);
  const dc={V:60,tot:{Na:4,Cl:4},ind:{},solv:{dcm:20}};
  const organic=drainLowerPhase(dc,10); assert.deepEqual(organic.comp.tot,{}); near(dc.tot.Na,4);near(dc.V,50);near(dc.solv.dcm,10);
});
test('unsupported separation and invalid doses leave the complete sample unchanged',()=>{
  for(const patch of [{solv:{hexane:10,ethanol:10}},{tot:{Na:1}},{tot:{Cl:1}},{tot:{Ac:1}},{ind:{univ:1}},{eq:{ppt:{AgCl:1}}},{V:20,solv:{hexane:20},tot:{Na:1,Cl:1}}]) {
    const c={V:60,tot:{Na:4,Cl:4},ind:{},solv:{hexane:20},...patch},before=JSON.stringify(c);
    assert.equal(separatorSupported(c),false);near(drainLowerPhase(c,10).volume,0); assert.equal(JSON.stringify(c),before);
  }
  const c={V:60,tot:{},ind:{},solv:{hexane:20}},before=JSON.stringify(c);
  for(const n of [-1,NaN,Infinity,0]) near(drainLowerPhase(c,n).volume,0);
  assert.equal(JSON.stringify(c),before);
});
test('K3-11 needs controlled solvent blanks, equal real doses, complete water dissolution and a no-dissolution control',()=>{
  const samples=[vessel(40),vessel(40)];samples.forEach((v,i)=>{v.letter=i?'B':'A';v.temp=22;v.solid=0;});samples[1].chem.solv.hexane=40;
  assert.ok(solubilityTrial(samples,{},true)); assert.equal(solubilityTrial(samples,{}),null);
  const dose={A:.5,B:.5};samples[0].chem.tot={Na:.5/58.44*1000,Cl:.5/58.44*1000};samples[1].solid=.5;
  assert.ok(solubilityTrial(samples,dose)); assert.equal(solubilityTrial(samples,dose,true),null);
  for(const bad of [()=>samples[1].chem.solv.hexane=0,()=>samples[0].temp=30,()=>samples[0].chem.tot.Cu=1,()=>samples[0].chem.V=45,()=>samples[0].solid=.1]) {
    const copy=structuredClone(samples);bad();assert.equal(solubilityTrial(samples,dose),null);samples.splice(0,2,...copy);
  }
  assert.equal(solubilityTrial(samples,{A:.5,B:.1}),null);
});
test('new activity and separator labels are translated in all supported languages',()=>{
  const c=vm.createContext({I18N:{en:{},et:{},ru:{},uk:{}}});vm.runInContext(fs.readFileSync(new URL('./i18n3d.js',import.meta.url),'utf8'),c);
  for(const key of ['k311.steps','k311.notReady','k311.option.water','sepHelp','sepNotReady','sepUnsupported']) for(const lang of ['et','ru','uk']) {assert.ok(c.I18N[lang]['x.'+key]);assert.notEqual(c.I18N[lang]['x.'+key],c.I18N.en['x.'+key]);}
});
