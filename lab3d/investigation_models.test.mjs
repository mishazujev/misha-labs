import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {copperCycleObservation,makeSolubilityDesign,solubilityTrialRecord,chlorideObservation} from './investigation_models.mjs';
import {solubilityTrial} from './phase_state.mjs';
const engine=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../lab/engine.js',import.meta.url),'utf8'),engine);
const copper=()=>['A','B'].map(letter=>({letter,temp:22,solid:0,chem:{V:20,tot:{Cu:2,SO4:2,Cl:.2},solv:{},ind:{}}}));
const eq=samples=>samples.forEach(v=>v.chem.eq=engine.speciate(v.chem.tot,v.chem.V));
const positive=samples=>{samples[0].chem.V=30;samples[0].chem.tot.Na=5;samples[1].chem.V=30;eq(samples);};
const recover=samples=>{samples[0].chem.V=42;samples[0].chem.tot.Cl=6.2;samples[1].chem.V=42;eq(samples);};
test('native copper cycle records matched control, positive and acid recovery with conserved copper',()=>{
 const samples=copper();eq(samples);const evidence={baseline:copperCycleObservation(samples,'baseline')};assert.ok(evidence.baseline);
 positive(samples);evidence.positive=copperCycleObservation(samples,'positive',evidence);assert.ok(evidence.positive);assert.ok(evidence.positive[0].precipitate>1.99);assert.ok(evidence.positive[1].precipitate<1e-7);
 recover(samples);const final=copperCycleObservation(samples,'dissolved',evidence);assert.ok(final);assert.equal(final[0].copper,2);assert.ok(final[0].precipitate<1e-7);assert.equal(final[0].volume,final[1].volume);
 for(const v of samples)assert.ok(Math.abs(v.chem.eq.dis.Cu*v.chem.V-2)<1e-7);
});
test('wrong copper setups, missing stages, and contamination cannot manufacture observations',()=>{
 const samples=copper();eq(samples);assert.equal(copperCycleObservation(samples,'dissolved'),null);
 const baseline=copperCycleObservation(samples,'baseline');positive(samples);assert.equal(copperCycleObservation(samples,'positive'),null);
 const valid=structuredClone(samples);for(const mutate of [()=>samples[1].chem.V=20,()=>samples[1].chem.tot.Na=5,()=>samples[0].chem.tot.Cu=1,()=>samples[0].chem.ind.univ=1,()=>samples[0].solid=.5,()=>samples[1].held=true]){mutate();eq(samples);assert.equal(copperCycleObservation(samples,'positive',{baseline}),null);samples.splice(0,2,...structuredClone(valid));}
 const before=JSON.stringify(samples);const record=copperCycleObservation(samples,'positive',{baseline});record[0].copper=99;assert.equal(JSON.stringify(samples),before);
});
const solventSamples=()=>['A','B'].map((letter,i)=>({letter,temp:22,solid:0,chem:{V:40,tot:{},ind:{},solv:i?{hexane:40}:{}}}));
test('K3-11 design identifies solvent and all three controls before salt, and rejects wrong or late plans',()=>{
 const samples=solventSamples(),task={doses:{}};const design=makeSolubilityDesign(samples,task,'solvent','volumeDoseTemperature',2);assert.equal(design.independent,'solvent');assert.equal(design.controls.length,3);
 for(const [ind,controls]of [['dose','volumeDoseTemperature'],['solvent','volumeOnly'],['temperature','none']])assert.equal(makeSolubilityDesign(samples,task,ind,controls,2),null);
 assert.equal(makeSolubilityDesign(samples,{...task,design},'solvent','volumeDoseTemperature',3),null);
 assert.equal(makeSolubilityDesign(samples,{...task,saltStarted:true},'solvent','volumeDoseTemperature',3),null);
 samples[0].solid=.1;assert.equal(makeSolubilityDesign(samples,task,'solvent','volumeDoseTemperature',3),null);
});
test('retained trials are independent snapshots of hypothesis, controls, measurements, conclusion and notebook',()=>{
 const samples=solventSamples(),task={doses:{A:.5,B:.5},reached:true,hypothesis:{prediction:'hexane',reason:'Initial idea'},design:{independent:'solvent',controls:['volume','dose','temperature']},picks:{outcome:'water'}};
 samples[0].chem.tot={Na:.5/58.44*1000,Cl:.5/58.44*1000};samples[1].solid=.5;task.comparison=solubilityTrial(samples,task.doses);
 const notebook=[{parts:[['key',{reason:'Original'}]]}],record=solubilityTrialRecord(samples,task,notebook);assert.equal(record.skill,'K3-11');assert.equal(record.conclusion,'water');
 task.hypothesis.reason='Changed';task.comparison[0].dose=7;notebook[0].parts[0][1].reason='Changed';assert.equal(record.hypothesis.reason,'Initial idea');assert.equal(record.measurements[0].dose,.5);assert.equal(record.notebook[0].parts[0][1].reason,'Original');
 task.reached=false;assert.equal(solubilityTrialRecord(samples,task,notebook),null);
});
test('the new lab, controls, history and equation prompts have all four language entries',()=>{
 const c=vm.createContext({I18N:{en:{},et:{},ru:{},uk:{}}});vm.runInContext(fs.readFileSync(new URL('./i18n3d.js',import.meta.url),'utf8'),c);
 for(const key of ['copper.steps','copper.row.precip','copper.notReady','k311.designFirst','k311.startRepeat','k311.trialHistory'])for(const lang of ['en','et','ru','uk'])assert.ok(c.I18N[lang]['x.'+key]);
});

const chlorideSamples=key=>['A','B','C','D'].map(letter=>{const kind=letter==='C'?'chloride':letter==='D'?'nitrate':key[letter];return {letter,tilt:0,temp:22,solid:0,chem:{V:20,tot:kind==='chloride'?{Na:2,Cl:2,NO3:.2}:{Na:2,NO3:2.2},ind:{},solv:{}}};});
test('both blinded chloride assignments produce actual AgCl only in the unknown chloride and positive control',()=>{
 for(const key of [{A:'chloride',B:'nitrate'},{A:'nitrate',B:'chloride'}]){
  const samples=chlorideSamples(key);eq(samples);const baseline=chlorideObservation(samples,'baseline',key);assert.ok(baseline);
  for(const v of samples){v.chem.V+=.2;v.chem.tot.Ag=.02;v.chem.tot.NO3+=.02;}eq(samples);
  assert.equal(chlorideObservation(samples,'tested',key),null);const rows=chlorideObservation(samples,'tested',key,{baseline});assert.ok(rows);
  assert.ok(rows.find(r=>r.vessel==='C').precipitate>.019);assert.equal(rows.find(r=>r.vessel==='D').precipitate,0);
  for(const v of samples)assert.ok(Math.abs((v.chem.eq.ppt.AgCl||0)+(v.chem.eq.dis.Ag||0)*v.chem.V-.02)<1e-7);
  assert.equal(rows.find(r=>r.vessel==='A').appearance,key.A==='chloride'?'precipitate':'clear');
 }
});
test('chloride observation rejects missing, extra and contaminated reagent/control doses',()=>{
 const key={A:'chloride',B:'nitrate'},samples=chlorideSamples(key);eq(samples);const baseline=chlorideObservation(samples,'baseline',key);
 for(const v of samples){v.chem.V+=.2;v.chem.tot.Ag=.02;v.chem.tot.NO3+=.02;}eq(samples);const good=structuredClone(samples);
 for(const mutate of [()=>samples[0].chem.tot.Ag=.015,()=>samples[1].chem.V+=.05,()=>samples[3].chem.tot.Cl=1,()=>samples[2].chem.ind.univ=1,()=>samples[1].stowed=true]){mutate();eq(samples);assert.equal(chlorideObservation(samples,'tested',key,{baseline}),null);samples.splice(0,4,...structuredClone(good));}
});
