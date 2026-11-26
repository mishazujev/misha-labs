import { sampleComposition, drainSample } from './sample_transfer.mjs';
// Water/solute reference model. Amounts: grams, mL, mmol; temperature: Celsius.
// g solute / 100 g water at 0,20,40,60,80,100 C:
// https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
const CURVES = {
  NaCl: [35.6, 35.8, 36.42, 37.05, 38.05, 39.2],
  KNO3: [13.25, 31.66, 63.9, 109.9, 169, 245.2],
  NH4Cl: [29.7, 37.56, 46, 55.3, 65.6, 77.3],
  NaHCO3: [6.89, 9.6, 12.7] // Conservative 0–40 C domain; no thermal decomposition model.
};
const canonical = f => String(f || '').replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080));
export const NACL = Object.freeze({ f: 'NaCl', M: 58.44, tot: { Na: 1, Cl: 1 } });
export const waterVolume = c => Math.max(0, c.V - Object.values(c.solv || {}).reduce((sum, n) => sum + n, 0));
export function solubilityAt(formula, temperature) {
  const curve = CURVES[canonical(formula)];
  if (!curve || temperature < 0 || temperature > (curve.length - 1) * 20 || !Number.isFinite(temperature)) return null;
  const i = Math.min(curve.length - 2, Math.floor(temperature / 20)), f = (temperature - i * 20) / 20;
  return curve[i] + (curve[i + 1] - curve[i]) * f;
}
export function dissolutionDomain(c, compound, temperature) {
  if (!CURVES[canonical(compound.f)]) return 'uncurated';
  if (solubilityAt(compound.f, temperature) == null) return 'unsupported';
  if (Object.entries(c.solv || {}).some(([id, volume]) => volume > 1e-8 && id !== 'hexane' && id !== 'dcm')) return 'unsupported';
  return 'aqueous';
}
export function dissolutionRoom(c, compound, temperature) {
  const domain = dissolutionDomain(c, compound, temperature);
  if (domain === 'uncurated') return null; // Uncurated cabinet compounds retain their previous model.
  if (domain === 'unsupported') return 0;
  const limit = solubilityAt(compound.f, temperature);
  if (limit == null) return 0; // No extrapolation outside the reference range.
  const units = Math.min(...Object.entries(compound.tot).map(([key, stoich]) => (c.tot[key] || 0) / stoich));
  const dissolved = Math.max(0, units) * compound.M / 1000;
  // Approximation: remaining water is 1 g/mL, volumes additive, ideal single salt.
  return Math.max(0, waterVolume(c) * limit / 100 - dissolved);
}
export function dissolveSalt(v, dt) {
  const room = dissolutionRoom(v.chem, NACL, v.temp);
  const mass = Math.min(v.solid || 0, room, Math.max(0, dt) * .07 * (1 + 6 * (v.stir || 0)));
  if (mass > 0) {
    v.solid -= mass;
    for (const key of ['Na', 'Cl']) v.chem.tot[key] = (v.chem.tot[key] || 0) + mass / NACL.M * 1000;
    v.eqDirty = true;
  }
  return mass;
}
// Fixed near-room-temperature densities. Mutual solubility is neglected.
// Hexane: https://www.sigmaaldrich.com/US/en/product/sial/296090
// DCM: https://www.sigmaaldrich.com/US/en/product/saj/072190
const DENSITY = { water: .998, hexane: .659, dcm: 1.325 };
const MISCIBLE = new Set(['ethanol', 'acetone', 'methanol']);
export function liquidLayers(c) {
  if (!(c.V > 1e-8)) return { supported: true, layers: [] };
  const solvents = Object.entries(c.solv || {}).filter(([, n]) => n > 1e-8);
  const water = waterVolume(c);
  const mixed = supported => ({ supported, layers: [{ id: 'mixed', volume: c.V, density: null }] });
  if (solvents.reduce((sum, [, n]) => sum + n, 0) > c.V + 1e-7) return mixed(false);
  if (!solvents.length) return { supported: true, layers: [{ id: 'water', volume: c.V, density: DENSITY.water }] };
  if (solvents.every(([id]) => MISCIBLE.has(id))) return mixed(true);
  if (solvents.length !== 1 || !(solvents[0][0] in DENSITY)) return mixed(false);
  const [id, volume] = solvents[0], layers = [{ id, volume, density: DENSITY[id] }];
  if (water > 1e-8) layers.push({ id: 'water', volume: water, density: DENSITY.water });
  return { supported: true, layers: layers.sort((a, b) => b.density - a.density) };
}
export function advancePhases(v, dt) {
  const time = Math.max(0, dt), stirring = (v.stir || 0) > .1;
  if (liquidLayers(v.chem).layers.length < 2) v.layerSettle = 1;
  else v.layerSettle = stirring ? 0 : 1 - (1 - (v.layerSettle ?? 1)) * Math.exp(-time / 3);
  v.precipitates ||= {};
  for (const id of ['AgCl', 'CuOH2']) {
    const amount = Math.max(0, v.chem.eq?.ppt?.[id] || 0), prev = v.precipitates[id] || (id === 'AgCl' ? v.agclState : null) || { amount: 0, settled: 0 };
    let settled = amount > 0 ? prev.settled : 0;
    if (amount > prev.amount) settled *= prev.amount / amount;
    if (amount > 0) settled = stirring ? 0 : 1 - (1 - settled) * Math.exp(-time / 8);
    v.precipitates[id] = { amount, settled };
  }
  v.agclState = v.precipitates.AgCl;
}
export function shakeSample(v) {
  v.stir = 1; v.layerSettle = 0;
  for (const id of Object.keys(v.precipitates || {})) v.precipitates[id] = { ...v.precipitates[id], settled: 0 };
  if (v.precipitates?.AgCl) v.agclState = v.precipitates.AgCl;
  else if (v.agclState) v.agclState = { ...v.agclState, settled: 0 };
}

// Selective withdrawal is deliberately limited to the verified reference system:
// water/hexane or water/DCM, with NaCl confined to the aqueous phase. No
// distribution coefficients or organic-solute/indicator partitioning are inferred.
export function separatorSupported(c) {
  const phase = liquidLayers(c);
  return phase.supported && Math.abs((c.tot?.Na || 0) - (c.tot?.Cl || 0)) < 1e-7 && phase.layers.every(l => ['water', 'hexane', 'dcm'].includes(l.id)) &&
    Object.entries(c.tot || {}).every(([k, n]) => n < 1e-8 || ['Na', 'Cl'].includes(k)) &&
    Object.values(c.ind || {}).every(n => n < 1e-8) &&
    Object.values(c.eq?.ppt || {}).every(n => n < 1e-8) &&
    (waterVolume(c) > 1e-8 || Object.values(c.tot || {}).every(n => n < 1e-8));
}
export function drainLowerPhase(c, requested) {
  const empty = { volume: 0, boundary: false, comp: null };
  if (!Number.isFinite(requested) || requested <= 0 || !separatorSupported(c)) return empty;
  const layers = liquidLayers(c).layers, lower = layers[0];
  if (!lower) return empty;
  const volume = Math.min(requested, lower.volume), aqueous = lower.id === 'water';
  // Build an independent phase sample; drainSample carries the reaction history
  // without scaling solutes by total (water + organic) volume.
  const phase = { V: lower.volume, temp: c.temp ?? 22,
    tot: aqueous ? { ...c.tot } : {}, ind: {},
    solv: aqueous ? {} : { [lower.id]: lower.volume },
    acidEq: aqueous ? c.acidEq : 0, baseEq: aqueous ? c.baseEq : 0,
    neutralised: aqueous ? c.neutralised : 0 };
  const comp = sampleComposition(phase, { id: 'separator:' + lower.id, f: lower.id });
  drainSample(phase, volume);
  if (aqueous) {
    c.tot = phase.tot; c.ind = phase.ind;
    for (const key of ['acidEq', 'baseEq', 'neutralised']) c[key] = phase[key];
  } else c.solv[lower.id] = Math.max(0, (c.solv[lower.id] || 0) - volume);
  c.V = Math.max(0, c.V - volume);
  if (c.V < 1e-8) { c.V = 0; c.tot = {}; c.ind = {}; c.solv = {}; }
  return { volume, comp, phase: lower.id, boundary: volume >= lower.volume - 1e-8 };
}

// K3-11 is assessed from actual controlled bench samples, never preset results.
export function solubilityTrial(samples, doses, blank = false) {
  const rows = [];
  for (const [i, v] of samples.entries()) {
    if (!v || v.stowed || v.held || v.fly || Math.abs(v.temp - 22) > 2 || Math.abs(v.chem.V - 40) > .2) return null;
    const c = v.chem, expected = i === 0 ? 0 : 40;
    if (Math.abs((c.solv?.hexane || 0) - expected) > .2 ||
      Object.entries(c.solv || {}).some(([k, n]) => k !== 'hexane' && n > 1e-8) ||
      Object.entries(c.tot || {}).some(([k, n]) => !['Na', 'Cl'].includes(k) && n > 1e-8) ||
      Object.values(c.ind || {}).some(n => n > 1e-8) || (v.particles || []).some(p => p.m > 1e-8)) return null;
    const na = c.tot.Na || 0, cl = c.tot.Cl || 0;
    if (Math.abs(na - cl) > 1e-7) return null;
    const dissolved = na * NACL.M / 1000, residue = v.solid || 0, dose = doses[v.letter] || 0;
    if (blank ? dissolved + residue > 1e-8 || dose > 0 : dose < .45 || dose > .55 || Math.abs(dissolved + residue - dose) > .001) return null;
    rows.push({ vessel: v.letter, volume: c.V, temperature: v.temp, dose, dissolved, residue });
  }
  if (samples.length !== 2 || Math.abs(samples[0].temp - samples[1].temp) > 1) return null;
  if (!blank && (rows[0].residue > .01 || rows[1].dissolved > .001)) return null;
  return rows;
}

export function makeSolubilityHypothesis(samples, task, prediction, reason, recordedAt) {
  const text = String(reason || '').trim();
  if (task.hypothesis || task.saltStarted || !['water', 'hexane', 'same'].includes(prediction) || text.length < 8 || text.length > 500 || !solubilityTrial(samples, task.doses, true)) return null;
  return { prediction, reason: text, recordedAt };
}
export function hydrationEvidence(samples, task) {
  if (!task.hypothesis || !task.comparison || !solubilityTrial(samples, task.doses)) return null;
  const rows = task.comparison;
  const observed = rows[0].dissolved > rows[1].dissolved + .01 ? 'water' : rows[1].dissolved > rows[0].dissolved + .01 ? 'hexane' : 'same';
  return { rows: rows.map(r => ({ ...r })), observed, supported: task.hypothesis.prediction === observed };
}
