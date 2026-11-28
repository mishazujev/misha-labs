import { solubilityTrial } from './phase_state.mjs';
const near = (a, b, tolerance = .03) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
// Native K1-17 reference: matched, mildly acidified CuSO4 samples. A receives
// 10 mL 0.5 M NaOH, then 12 mL 0.5 M HCl; B remains a no-added-base control.
export function copperCycleObservation(samples, stage, evidence = {}) {
  if (samples.length !== 2 || !['baseline', 'positive', 'dissolved'].includes(stage)) return null;
  const [a,b] = samples;
  for (const v of samples) {
    if (!v || v.stowed || v.held || v.fly || !v.chem.eq || (v.solid || 0) > 1e-8 || (v.particles || []).some(p => p.m > 1e-8)) return null;
    for (const map of [v.chem.ind, v.chem.solv]) if (Object.values(map || {}).some(n => n > 1e-8)) return null;
    if (Object.entries(v.chem.tot).some(([key,n]) => !['Cu','SO4','Na','Cl'].includes(key) && n > 1e-8)) return null;
    if (!near(v.chem.tot.Cu,2) || !near(v.chem.tot.SO4,2)) return null;
  }
  const expected = stage === 'baseline' ? [20,0,.2] : stage === 'positive' ? [30,5,.2] : [42,5,6.2];
  const check = (v, [V,Na,Cl]) => near(v.chem.V,V,.3) && near(v.chem.tot.Na || 0,Na,.08) && near(v.chem.tot.Cl || 0,Cl,.08);
  if (!check(a,expected) || !check(b,[expected[0],0,.2]) || (b.chem.eq.ppt?.CuOH2 || 0) > .0015) return null;
  const ppt = a.chem.eq.ppt?.CuOH2 || 0;
  if (stage === 'baseline' ? ppt > .0015 : stage === 'positive' ? !evidence.baseline || ppt < 1.9 : !evidence.positive || ppt > 1e-7) return null;
  return samples.map(v => ({ vessel:v.letter,volume:v.chem.V,copper:v.chem.tot.Cu,precipitate:v.chem.eq.ppt?.CuOH2 || 0,pH:v.chem.eq.pH,temperature:v.temp }));
}
export function makeSolubilityDesign(samples, task, independent, controls, recordedAt) {
  if (task.design || task.saltStarted || independent !== 'solvent' || controls !== 'volumeDoseTemperature' || !solubilityTrial(samples,task.doses,true)) return null;
  return { independent, controls:['solventVolume','saltDose','temperature'], recordedAt };
}
export function solubilityTrialRecord(samples, task, notebook) {
  if (!task.reached || !task.hypothesis || !task.design || !task.comparison || !solubilityTrial(samples,task.doses)) return null;
  return JSON.parse(JSON.stringify({course:'K3',skill:'K3-11',hypothesis:task.hypothesis,design:task.design,blanks:task.blank,measurements:task.comparison,conclusion:task.picks.outcome,notebook}));
}

// Acidified, matched sodium chloride/nitrate matrices, tested with four 0.05 mL drops of
// 0.10 M AgNO3. C is the positive control; D is the nitrate blank.
export function chlorideObservation(samples, stage, key, evidence = {}) {
 if(samples.length!==4 || !['baseline','tested'].includes(stage) || !key || !['chloride','nitrate'].every(id=>Object.values(key).includes(id)))return null;
 const tested=stage==='tested';if(tested&&!evidence.baseline)return null;
 const rows=[];
 for(const v of samples){
  if(!v||v.held||v.stowed||v.fly||!v.chem.eq||(v.solid||0)>1e-8||(v.particles||[]).some(p=>p.m>1e-8))return null;
  const c=v.chem,kind=v.letter==='C'?'chloride':v.letter==='D'?'nitrate':key[v.letter];
  if(!['chloride','nitrate'].includes(kind)||Object.values(c.ind||{}).some(n=>n>1e-8)||Object.values(c.solv||{}).some(n=>n>1e-8))return null;
  const expected={Na:2,Cl:kind==='chloride'?2:0,NO3:(kind==='nitrate'?2:0)+.2+(tested?.02:0),Ag:tested?.02:0};
  if(!near(c.V,tested?20.2:20,.02)||Object.entries(expected).some(([k,n])=>!near(c.tot[k]||0,n,k==='Ag'?.001:.015))||Object.entries(c.tot).some(([k,n])=>!(k in expected)&&n>1e-8))return null;
  const ppt=c.eq.ppt?.AgCl||0;if(tested?(kind==='chloride'?ppt<.019:ppt>1e-8):ppt>1e-8)return null;
  rows.push({vessel:v.letter,volume:c.V,temperature:v.temp,precipitate:ppt,appearance:ppt>.0015?'precipitate':'clear'});
 }
 return rows;
}
