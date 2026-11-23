// Water/solute reference model. Amounts: grams, mL, mmol; temperature: Celsius.
// g solute / 100 g water at 0,20,40,60,80,100 C:
// https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
const CURVES = {
  NaCl: [35.6, 35.8, 36.42, 37.05, 38.05, 39.2],
  KNO3: [13.25, 31.66, 63.9, 109.9, 169, 245.2],
  NH4Cl: [29.7, 37.56, 46, 55.3, 65.6, 77.3]
};
const canonical = f => String(f || '').replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080));
export const NACL = Object.freeze({ f: 'NaCl', M: 58.44, tot: { Na: 1, Cl: 1 } });
export const waterVolume = c => Math.max(0, c.V - Object.values(c.solv || {}).reduce((sum, n) => sum + n, 0));
export function solubilityAt(formula, temperature) {
  const curve = CURVES[canonical(formula)];
  if (!curve || temperature < 0 || temperature > 100 || !Number.isFinite(temperature)) return null;
  const i = Math.min(4, Math.floor(temperature / 20)), f = (temperature - i * 20) / 20;
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
  const amount = Math.max(0, v.chem.eq?.ppt?.AgCl || 0), prev = v.agclState || { amount: 0, settled: 0 };
  let settled = amount > 0 ? prev.settled : 0;
  if (amount > prev.amount) settled *= prev.amount / amount;
  if (amount > 0) settled = stirring ? 0 : 1 - (1 - settled) * Math.exp(-time / 8);
  v.agclState = { amount, settled };
}
export function shakeSample(v) {
  v.stir = 1; v.layerSettle = 0;
  if (v.agclState) v.agclState = { ...v.agclState, settled: 0 };
}
