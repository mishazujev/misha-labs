/* Reusable reaction/visual bridge. Pure calculations live here; Three.js rendering stays in lab3d/main3d.js. */
(function (root) {
  'use strict';

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  const FUELS = {
    'CH4': { name: 'methane', heatKJMol: 890.3, phase: 'gas', soot: 0.05, flame: '#5aa7ff' },
    'CH3OH': { name: 'methanol', heatKJMol: 726.1, phase: 'liquid', soot: 0.06, flame: '#69a9ff' },
    'C2H6O': { name: 'ethanol', heatKJMol: 1366.8, phase: 'liquid', soot: 0.08, flame: '#629dff' },
    'C6H14': { name: 'hexane', heatKJMol: 4163, phase: 'liquid', soot: 0.62, flame: '#ffc45a' },
    'C7H8': { name: 'toluene', heatKJMol: 3910, phase: 'liquid', soot: 0.92, flame: '#ffad38' },
    'C4H10O': { name: 'diethyl ether', heatKJMol: 2723, phase: 'liquid', soot: 0.32, flame: '#78a9ff' },
    'C8H18': { name: 'octane', heatKJMol: 5471, phase: 'liquid', soot: 0.72, flame: '#ffba45' }
  };

  function asciiFormula(formula) {
    return String(formula || '')
      .replace(/[₀-₉]/g, c => SUB[c])
      .replace(/\((aq|s|l|g)\)/gi, '')
      .replace(/\s+/g, '')
      .replace(/C2H5OH/g, 'C2H6O')
      .replace(/\(C2H5\)2O/g, 'C4H10O');
  }

  function parseFormula(formula) {
    const src = asciiFormula(formula).split(/[·.]/)[0];
    let i = 0;
    function count() { const m = src.slice(i).match(/^\d+/); if (!m) return 1; i += m[0].length; return Number(m[0]); }
    function group(stop) {
      const out = {};
      while (i < src.length && src[i] !== stop) {
        if (src[i] === '(') {
          i++; const inner = group(')'); if (src[i] !== ')') throw new Error(`Unclosed group in ${formula}`); i++; const n = count();
          for (const [el, q] of Object.entries(inner)) out[el] = (out[el] || 0) + q * n;
          continue;
        }
        const m = src.slice(i).match(/^([A-Z][a-z]?)/); if (!m) throw new Error(`Unsupported formula near "${src.slice(i)}"`);
        i += m[1].length; out[m[1]] = (out[m[1]] || 0) + count();
      }
      return out;
    }
    const atoms = group(null); if (i !== src.length) throw new Error(`Unexpected token in ${formula}`); return atoms;
  }

  function hillFormula(atoms) {
    const keys = Object.keys(atoms).filter(k => atoms[k]);
    keys.sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b)));
    return keys.map(k => k + (atoms[k] === 1 ? '' : atoms[k])).join('');
  }

  function neutralization({ acidMmol = 0, baseMmol = 0, previousMmol = 0, solutionMl = 0, heatLoss = 0 }) {
    const reactedMmol = Math.max(0, Math.min(acidMmol, baseMmol) - previousMmol);
    const heatJ = reactedMmol * 57.3;
    const retainedJ = heatJ * (1 - clamp(heatLoss, 0, 1));
    return { kind: 'neutralization', reactedMmol, heatJ, deltaC: solutionMl > 0 ? retainedJ / (solutionMl * 4.18) : 0,
      effects: reactedMmol > 0 ? [{ type: 'heat', joules: retainedJ, intensity: clamp(retainedJ / 120, 0, 1) }] : [] };
  }

  function combustion(formula, amountMol, options = {}) {
    const atoms = parseFormula(formula), C = atoms.C || 0, H = atoms.H || 0, O = atoms.O || 0;
    if (!C || !H || Object.keys(atoms).some(k => !['C', 'H', 'O'].includes(k))) throw new Error(`${formula} is not a supported hydrocarbon/oxygenated fuel`);
    const key = hillFormula(atoms), fuel = FUELS[key] || { name: formula, heatKJMol: 650 * C + 120 * H, phase: 'unknown', soot: clamp((C / H - .2) * 1.4, .08, .9), flame: '#ffbd4a' };
    const fuelMol = Math.max(0, Number(amountMol) || 0), o2PerFuel = Math.max(0, C + H / 4 - O / 2), o2Need = fuelMol * o2PerFuel;
    const oxygenMol = options.oxygenMol == null ? Infinity : Math.max(0, options.oxygenMol);
    const oxygenRatio = o2Need ? clamp(oxygenMol / o2Need, 0, 1.5) : 1;
    const minimumO2PerFuel = Math.max(.001, (H / 2 - O) / 2);
    const burnedMol = Math.min(fuelMol, oxygenMol / minimumO2PerFuel);
    const complete = clamp((oxygenRatio - .55) / .45, 0, 1);
    const usedO2Mol = Math.min(o2Need, oxygenMol), oxygenAtomsPerFuel = burnedMol ? O + 2 * usedO2Mol / burnedMol : 0;
    const carbonO = Math.max(0, oxygenAtomsPerFuel - H / 2);
    const co2PerFuel = clamp(carbonO - C, 0, C);
    const coPerFuel = carbonO <= C ? clamp(carbonO, 0, C) : clamp(2 * C - carbonO, 0, C);
    const sootPerFuel = Math.max(0, C - co2PerFuel - coPerFuel);
    const co2Mol = burnedMol * co2PerFuel, coMol = burnedMol * coPerFuel, sootMol = burnedMol * sootPerFuel;
    const waterMol = burnedMol * H / 2;
    const heatKJ = burnedMol * fuel.heatKJMol * (.55 + .45 * complete);
    const soot = clamp((sootMol / Math.max(1e-12, burnedMol * C)) * .8 + fuel.soot * (1 - complete), 0, 1);
    const flameIntensity = clamp((options.rateMolS == null ? burnedMol : options.rateMolS) * fuel.heatKJMol / 2.5, 0, 1);
    return {
      kind: 'combustion', formula, fuel: fuel.name, fuelMol, burnedMol, oxygenRatio, complete: complete > .98,
      reactants: { fuelMol: burnedMol, oxygenMol: usedO2Mol },
      products: { CO2: co2Mol, H2O: waterMol, CO: coMol, sootC: sootMol, unburnedFuel: fuelMol - burnedMol }, heatKJ,
      effects: [
        { type: 'flame', intensity: flameIntensity, color: complete > .8 ? fuel.flame : '#ff9b2f', soot },
        { type: 'gas', species: 'CO2', mmol: co2Mol * 1000, intensity: clamp(co2Mol * 20, 0, 1) },
        { type: 'vapour', species: 'H2O', mmol: waterMol * 1000, intensity: clamp(waterMol * 15, 0, 1) },
        ...(soot > .02 ? [{ type: 'smoke', species: soot > .35 ? 'soot' : 'trace soot', intensity: soot }] : []),
        ...(oxygenRatio < .9 ? [{ type: 'hazard', species: 'CO', intensity: clamp(1 - oxygenRatio, 0, 1) }] : [])
      ]
    };
  }

  function gasVisual(mmol, seconds = 1) {
    const rate = Math.max(0, mmol) / Math.max(.05, seconds);
    return { bubbleRate: clamp(rate * 18, 0, 240), foam: clamp(rate / 4, 0, 1), intensity: clamp(rate / 5, 0, 1) };
  }

  function visualSignal(effect) {
    if (!effect) return null;
    if (effect.type === 'gas') return { type: 'bubbles', ...gasVisual(effect.mmol || 0, effect.seconds || 1) };
    if (effect.type === 'heat') return { type: 'heat', intensity: clamp(effect.intensity || effect.joules / 120, 0, 1) };
    if (effect.type === 'flame') return { type: 'flame', intensity: clamp(effect.intensity, 0, 1), color: effect.color, soot: clamp(effect.soot || 0, 0, 1) };
    return { ...effect, intensity: clamp(effect.intensity || 0, 0, 1) };
  }

  root.ReactionSimulation = Object.freeze({ version: 1, FUELS, asciiFormula, parseFormula, hillFormula, neutralization, combustion, gasVisual, visualSignal });
})(typeof globalThis !== 'undefined' ? globalThis : window);
