export const EVAPORATION_MODEL = Object.freeze({
  water: Object.freeze({ drop: 3.5, duration: 60 }),
  ethanol: Object.freeze({ drop: 8, duration: 30 }),
  methanol: Object.freeze({ drop: 10, duration: 22 }),
  acetone: Object.freeze({ drop: 14, duration: 12 }),
  etoac: Object.freeze({ drop: 11, duration: 16 }),
  hexane: Object.freeze({ drop: 9, duration: 12 }),
  ether: Object.freeze({ drop: 18, duration: 6 }),
  dcm: Object.freeze({ drop: 16, duration: 8 }),
  toluene: Object.freeze({ drop: 5, duration: 40 }),
  chex: Object.freeze({ drop: 8, duration: 15 }),
});

export const HEAT_CONDUCTION_ORDER = Object.freeze(['cu', 'al', 'fe', 'glass']);

export const UNKNOWN_SOLIDS = Object.freeze({
  nacl: Object.freeze({ appearance: 'white crystals', magnet: false, water: 'soluble', conductivity: 'bright', heating: 'no visible change' }),
  sucrose: Object.freeze({ appearance: 'white crystals', magnet: false, water: 'soluble', conductivity: 'off', heating: 'melts, then browns and decomposes' }),
  paraffin: Object.freeze({ appearance: 'waxy white solid', magnet: false, water: 'insoluble', conductivity: 'off', heating: 'melts to a colourless liquid' }),
  sand: Object.freeze({ appearance: 'pale grains', magnet: false, water: 'insoluble', conductivity: 'off', heating: 'no visible change' }),
  iron: Object.freeze({ appearance: 'grey metallic grains', magnet: true, water: 'insoluble', conductivity: 'bright', heating: 'no visible change under gentle heating' }),
});

export function unknownSolidObservation(sample, test) {
  const profile = UNKNOWN_SOLIDS[sample];
  return profile && test in profile ? profile[test] : null;
}

export function carbonateReactionTime({ concentration = 1, temperature = 20, form = 'chips' } = {}) {
  const c = Math.max(0.05, Number(concentration) || 1);
  const t = Number(temperature) || 20;
  const surfaceFactor = form === 'powder' ? 2.4 : 1;
  const temperatureFactor = Math.pow(1.8, (t - 20) / 10);
  return Math.round(48 / (c * surfaceFactor * temperatureFactor) * 10) / 10;
}

export function peroxideOxygenRate(catalysed = false) {
  return catalysed
    ? Object.freeze({ seconds: 6, observation: 'rapid bubbling; a glowing splint relights' })
    : Object.freeze({ seconds: 90, observation: 'very slow bubbling; little oxygen is collected during the observation period' });
}

export const MOLECULE_MODELS = Object.freeze({
  co2: Object.freeze({ formula: 'CO₂', geometry: 'linear', angle: 180, polar: false }),
  ch4: Object.freeze({ formula: 'CH₄', geometry: 'tetrahedral', angle: 109.5, polar: false }),
  nh3: Object.freeze({ formula: 'NH₃', geometry: 'trigonal pyramidal', angle: 107, polar: true }),
  h2o: Object.freeze({ formula: 'H₂O', geometry: 'bent', angle: 104.5, polar: true }),
  c2h4: Object.freeze({ formula: 'C₂H₄', geometry: 'trigonal planar around each carbon', angle: 120, polar: false }),
});

export const C4H10O_ISOMERS = Object.freeze({
  butanol: Object.freeze({ name: 'butan-1-ol', boilingPoint: 117.7, waterSolubility: 'partly soluble', hydrogenBondDonor: true, sodiumTest: 'steady hydrogen bubbles' }),
  ether: Object.freeze({ name: 'ethoxyethane', boilingPoint: 34.6, waterSolubility: 'slightly soluble; a separate layer forms', hydrogenBondDonor: false, sodiumTest: 'no hydrogen under the same dry conditions' }),
});

const SOLVENT_DENSITY = Object.freeze({ water: 0.997, ethanol: 0.789, acetone: 0.785, methanol: 0.792, etoac: 0.902, hexane: 0.659, ether: 0.713, dcm: 1.326, toluene: 0.867, chex: 0.779 });
const BOTTLE_DENSITY = Object.freeze({ hcl: 1.010, hcl01: 1.002, hcl001: 0.998, acetic01: 1.001, vinegar: 1.010, naoh: 1.020, naoh01: 1.004, na2co3: 1.035, water: 0.997, nacl: 1.004, na2so4: 1.018, cuso4: 1.012 });

export function solutionMass(chem, molarMasses = {}) {
  const volume = Math.max(0, Number(chem && chem.V) || 0);
  const solvents = chem && chem.solv || {};
  let trackedVolume = 0, mass = 0;
  for (const key in solvents) {
    const solventVolume = Math.max(0, Math.min(volume - trackedVolume, Number(solvents[key]) || 0));
    trackedVolume += solventVolume;
    mass += solventVolume * (SOLVENT_DENSITY[key] || SOLVENT_DENSITY.water);
  }
  mass += Math.max(0, volume - trackedVolume) * SOLVENT_DENSITY.water;
  for (const key in (chem && chem.tot || {})) mass += Math.max(0, Number(chem.tot[key]) || 0) * (molarMasses[key] || 30) / 1000 * 0.7;
  return mass;
}

export function reagentBottleMass(id, volume, open = false) {
  const glassAndLabel = 132.6, cap = open ? 0 : 5.4;
  return glassAndLabel + cap + Math.max(0, Number(volume) || 0) * (BOTTLE_DENSITY[id] || 1);
}

export function ionicConductivity(chem, divalentIons = []) {
  const volume = Number(chem && chem.V) || 0;
  if (volume < 0.3) return 0;
  const totals = chem.tot || {};
  const equilibrium = chem.eq || { pH: 7, ppt: {} };
  const concentration = key => Math.max(0, Number(totals[key]) || 0) / volume;
  let value = concentration('Na') + concentration('K') + concentration('Ag') + concentration('Cl') +
    concentration('NO3') + concentration('I') + 2 * concentration('SO4') +
    3 * (concentration('Fe3') + concentration('Al'));
  for (const key of divalentIons) value += 2 * concentration(key);
  for (const key in (equilibrium.ppt || {})) value -= 2 * (Number(equilibrium.ppt[key]) || 0) / volume;
  const pH = equilibrium.pH == null ? 7 : equilibrium.pH;
  // Ac is the analytical total of acetic acid + acetate. Only dissociated
  // acetate carries charge, so derive it from the equilibrium pH.
  const hydrogen = Math.pow(10, -pH), acetateKa = 1.8e-5;
  value += concentration('Ac') * acetateKa / (hydrogen + acetateKa);
  return Math.max(0, value) + 3.5 * Math.pow(10, -pH) + 2 * Math.pow(10, pH - 14);
}

export function conductivityCategory(brightness) {
  return brightness < 0.03 ? 'off' : brightness < 0.3 ? 'faint' : brightness < 0.7 ? 'dim' : 'bright';
}

export function conductivityBrightness(chem, divalentIons = []) {
  return 1 - Math.exp(-ionicConductivity(chem, divalentIons) / 0.015);
}

export function evaporativeCoolingAt(solvent, elapsed, roomTemperature = 22) {
  const model = EVAPORATION_MODEL[solvent] || EVAPORATION_MODEL.water;
  const active = elapsed < model.duration;
  return { active, target: active ? roomTemperature - model.drop : roomTemperature, drop: model.drop, duration: model.duration };
}
