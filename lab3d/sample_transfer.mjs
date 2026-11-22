// Analytical amounts are mmol; liquid and solvent amounts are mL.
// Temperature mixing assumes equal volumetric heat capacity.
const DIVALENT = ['Ba', 'Ca', 'Cu', 'Fe2', 'Pb', 'Mg', 'Zn', 'Mn', 'Ni', 'Co', 'Cd', 'Sn'];
export function excessOf(t) {
  const g = k => t[k] || 0;
  let e = g('Cl') + g('Br') + g('NO3') + 2 * g('SO4') + g('I') + g('Ac') - g('Na') - g('K') - g('NH3') - g('Ag') - 3 * (g('Fe3') + g('Al'));
  for (const k of DIVALENT) e -= 2 * g(k);
  return e;
}

export function sampleComposition(chem, { id, f, temp = chem.temp ?? 22, neutralised = chem.neutralised || 0 } = {}) {
  const comp = { id, f, isInd: false, temp, tot: {}, ind: {}, solv: {}, acidEq: 0, baseEq: 0, neutralised: 0 };
  if (!(chem.V > 0)) return comp;
  for (const field of ['tot', 'ind', 'solv']) for (const key in (chem[field] || {})) comp[field][key] = chem[field][key] / chem.V;
  const excess = excessOf(chem.tot || {});
  comp.acidEq = (chem.acidEq ?? Math.max(0, excess)) / chem.V;
  comp.baseEq = (chem.baseEq ?? Math.max(0, -excess)) / chem.V;
  comp.neutralised = neutralised / chem.V;
  return comp;
}

export function mixSample(chem, comp, volume) {
  if (!(volume > 0)) return;
  const initial = chem.V || 0;
  const initialExcess = excessOf(chem.tot || {});
  chem.acidEq ??= Math.max(0, initialExcess);
  chem.baseEq ??= Math.max(0, -initialExcess);
  chem.temp = ((chem.temp ?? 22) * initial + (comp.temp ?? 22) * volume) / (initial + volume);
  for (const field of ['tot', 'ind', 'solv']) {
    chem[field] ||= {};
    for (const key in (comp[field] || {})) chem[field][key] = (chem[field][key] || 0) + comp[field][key] * volume;
  }
  // Stock reagents infer equivalents from analytical composition; transferred
  // samples carry their history explicitly so neutralisation is not counted twice.
  const excess = excessOf(comp.tot || {});
  chem.acidEq = (chem.acidEq || 0) + (comp.acidEq ?? Math.max(0, excess)) * volume;
  chem.baseEq = (chem.baseEq || 0) + (comp.baseEq ?? Math.max(0, -excess)) * volume;
  chem.neutralised = (chem.neutralised || 0) + (comp.neutralised || 0) * volume;
  chem.V = initial + volume;
}

export function drainSample(chem, requested) {
  const volume = Math.min(Math.max(0, requested), chem.V || 0);
  if (!(volume > 0)) return 0;
  const excess = excessOf(chem.tot || {});
  chem.acidEq ??= Math.max(0, excess);
  chem.baseEq ??= Math.max(0, -excess);
  const remaining = 1 - volume / chem.V;
  for (const field of ['tot', 'ind', 'solv']) for (const key in (chem[field] || {})) chem[field][key] *= remaining;
  for (const key of ['acidEq', 'baseEq', 'neutralised']) chem[key] = (chem[key] || 0) * remaining;
  chem.V -= volume;
  if (chem.V === 0) {
    chem.tot = {}; chem.ind = {}; chem.solv = {}; chem.temp = 22;
  }
  return volume;
}
