/* ===================== CHEMISTRY ENGINE ===================== */
const KW = 1e-14, KA_NH4 = 5.6e-10, KA_AC = 1.75e-5, K1 = 4.45e-7, K2 = 4.69e-11, CO2_SOL = 0.035;
const METALS = {
  Ag: { z: 1, koh: 2e-8, oh: 'Ag2O' },
  Ba: { z: 2, kco: 2.6e-9, co: 'BaCO3' },
  Ca: { z: 2, koh: 5.5e-6, oh: 'CaOH2', kco: 3.4e-9, co: 'CaCO3' },
  Cu: { z: 2, koh: 2.2e-20, oh: 'CuOH2', kco: 1.4e-10, co: 'CuCO3' },
  Fe2: { z: 2, koh: 8e-16, oh: 'FeOH2', kco: 3.1e-11, co: 'FeCO3' },
  Fe3: { z: 3, koh: 1e-36, oh: 'FeOH3' },
  Pb: { z: 2, koh: 1.2e-15, oh: 'PbOH2', kco: 7.4e-14, co: 'PbCO3' },
};
// [name, metal, anion, anion-per-formula, Ksp]
const SALTS = [
  ['AgI', 'Ag', 'I', 1, 8.5e-17], ['AgCl', 'Ag', 'Cl', 1, 1.8e-10], ['PbI2', 'Pb', 'I', 2, 7e-9],
  ['BaSO4', 'Ba', 'SO4', 1, 1.1e-10], ['PbSO4', 'Pb', 'SO4', 1, 1.6e-8], ['PbCl2', 'Pb', 'Cl', 2, 1.7e-5],
];
// precipitate appearance: colour key + swatch
const PPT = {
  AgCl: ['white', '#F4F4F0'], AgI: ['paleyellow', '#EFE3A0'], PbI2: ['brightyellow', '#F2C81C'],
  BaSO4: ['white', '#F7F7F4'], PbSO4: ['white', '#F2F2EE'], PbCl2: ['white', '#EDEDE8'],
  Ag2O: ['brownblack', '#4A3426'], CaOH2: ['white', '#F0F0EC'], CuOH2: ['blue', '#3D7FD1'],
  FeOH2: ['dirtygreen', '#7F9A62'], FeOH3: ['rustbrown', '#A0521C'], PbOH2: ['white', '#EFEFEA'],
  BaCO3: ['white', '#F6F6F2'], CaCO3: ['white', '#F7F7F3'], CuCO3: ['bluegreen', '#4FA39A'],
  FeCO3: ['greywhite', '#C9CCC0'], PbCO3: ['white', '#F3F3EF'],
};

function pptSalt(a, b, mx, V, K) {
  // a mmol metal, b mmol anion, 1:mx stoichiometry, V mL, Ksp in M units
  const g = x => ((a - x) / V) * Math.pow((b - mx * x) / V, mx) - K;
  if (g(0) <= 0) return 0;
  let lo = 0, hi = Math.min(a, b / mx);
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
  return lo;
}

function speciate(tot, V) {
  const t = Object.assign({}, tot);
  const ppt = {};
  for (const [name, M, X, mx, K] of SALTS) {
    if ((t[M] || 0) > 1e-12 && (t[X] || 0) > 1e-12) {
      const x = pptSalt(t[M], t[X], mx, V, K);
      if (x > 1e-12) { ppt[name] = (ppt[name] || 0) + x; t[M] -= x; t[X] -= mx * x; }
    }
  }
  const c = k => Math.max(0, t[k] || 0) / V;
  const evalAt = (pH, detail) => {
    const H = Math.pow(10, -pH), OH = KW / H;
    const D = H * H + K1 * H + K1 * K2, a1 = K1 * H / D, a2 = K1 * K2 / D;
    let Cf = c('Ct');
    let cat = c('Na') + c('K') + H + c('NH3') * H / (H + KA_NH4);
    const p = {}, dis = {};
    for (const m in METALS) {
      const cM = c(m); if (!cM) continue;
      const me = METALS[m];
      const cap = me.koh ? me.koh / Math.pow(OH, me.z) : Infinity;
      let pc = 0;
      if (me.kco && Cf > 0 && a2 > 0) {
        const kk = me.kco / a2;
        if (cM * Cf > kk) { const s = cM + Cf; pc = (s - Math.sqrt(Math.max(0, s * s - 4 * (cM * Cf - kk)))) / 2; }
      }
      const dC = cM - pc;
      let d;
      if (pc > 0 && dC < cap) { d = dC; Cf -= pc; p[me.co] = pc; }
      else { d = Math.min(cM, cap); if (cM - d > 0) p[me.oh] = cM - d; }
      dis[m] = d; cat += me.z * d;
    }
    const an = c('Cl') + c('Br') + c('NO3') + 2 * c('SO4') + c('I') + c('Ac') * KA_AC / (H + KA_AC) + Cf * (a1 + 2 * a2) + OH;
    if (!detail) return cat - an;
    return { f: cat - an, H, OH, p, dis, h2co3: Cf * H * H / D, nh3free: c('NH3') * KA_NH4 / (H + KA_NH4) };
  };
  let lo = -1.5, hi = 15.5;
  for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (evalAt(m) > 0) lo = m; else hi = m; }
  const pH = (lo + hi) / 2;
  const d = evalAt(pH, true);
  for (const k in d.p) ppt[k] = (ppt[k] || 0) + d.p[k] * V;
  return { pH, ppt, dis: d.dis, h2co3: d.h2co3, nh3free: d.nh3free };
}

/* A vessel: { V (mL), tot{mmol}, ind{name: drops} } */
function equilibrate(v) {
  let gas = 0;
  if (v.V <= 1e-6) { v.eq = { pH: 7, ppt: {}, dis: {}, dry: true }; return 0; }
  for (let i = 0; i < 4; i++) {
    const e = speciate(v.tot, v.V);
    v.eq = e;
    if (e.h2co3 > CO2_SOL + 1e-4) {
      const esc = (e.h2co3 - CO2_SOL) * v.V;
      v.tot.Ct = Math.max(0, (v.tot.Ct || 0) - esc); gas += esc;
    } else break;
  }
  return gas;
}

/* ---------- colours ---------- */
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lerpC(a, b, t) { return a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t)))); }
function ramp(stops, x) {
  if (x <= stops[0][0]) return hex2rgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) {
    const [x0, c0] = stops[i - 1], [x1, c1] = stops[i];
    return lerpC(hex2rgb(c0), hex2rgb(c1), (x - x0) / (x1 - x0));
  }
  return hex2rgb(stops[stops.length - 1][1]);
}
/* Seven recognisable universal-indicator families.  Interpolation between the
   anchors is continuous, so even a small real pH change begins changing the
   rendered liquid instead of jumping between arbitrary colour bands. */
const UNIV = [[1, '#D7263D'], [3.5, '#F06428'], [5.5, '#F2C230'], [7, '#42A84B'], [9, '#287FBE'], [11, '#3F51A3'], [13.5, '#762E91']];
// indicator -> {rgb, alpha, key(colour word)}
function indColor(ind, pH) {
  switch (ind) {
    case 'univ': {
      const rgb = ramp(UNIV, pH);
      const key = pH < 2.25 ? 'red' : pH < 4.5 ? 'orange' : pH < 6.25 ? 'yellow' : pH < 8 ? 'green' : pH < 10 ? 'blue' : pH < 12.25 ? 'indigo' : 'violet';
      return { rgb, a: .85, key };
    }
    case 'litmus': {
      const rgb = ramp([[4.5, '#C0392B'], [6.5, '#8E3B8E'], [8.3, '#2E5FA8']], pH);
      return { rgb, a: .8, key: pH < 5 ? 'red' : pH < 8 ? 'purple' : 'blue' };
    }
    case 'phph': {
      const a = pH < 8.2 ? 0 : Math.min(.9, (pH - 8.2) / 1.6 * .9);
      return { rgb: hex2rgb(pH > 9.6 ? '#C2186B' : '#E8509E'), a, key: a < .05 ? 'colourless' : pH < 9 ? 'palepink' : 'crimson' };
    }
    case 'mo': {
      const rgb = ramp([[3.1, '#D6303A'], [3.8, '#EE7A2A'], [4.4, '#F2C230']], pH);
      return { rgb, a: .8, key: pH < 3.2 ? 'red' : pH < 4.3 ? 'orange' : 'yellow' };
    }
  }
}
function vesselLook(v) {
  // returns {liquid: css rgba, cloud: css or null, ppt list, colourKey}
  const e = v.eq || { pH: 7, ppt: {}, dis: {} };
  let rgb = [190, 220, 235], a = .28;
  const conc = (m) => (e.dis && e.dis[m]) || 0;
  const mix = (c2, w) => { rgb = lerpC(rgb, c2, w); a = Math.max(a, .28 + w * .5); };
  let baseKey = 'colourless';
  if (conc('Cu') > .004) { mix([60, 140, 225], Math.min(.85, conc('Cu') * 9)); baseKey = 'lightblue'; }
  if (conc('Fe3') > .004) { mix([205, 140, 40], Math.min(.85, conc('Fe3') * 9)); baseKey = 'yellowbrown'; }
  if (conc('Fe2') > .004) { mix([160, 205, 130], Math.min(.6, conc('Fe2') * 6)); baseKey = 'palegreen'; }
  // Molecular halogens are distinct from their colourless halide ions. This
  // makes the visible colour follow the displacement reaction in the beaker.
  for (const [key, colour, name] of [['Cl2', [190, 215, 70], 'yellowgreen'], ['Br2', [178, 74, 25], 'redbrown'], ['I2', [112, 55, 92], 'violetbrown']]) {
    const amount = Math.max(0, v.tot[key] || 0) / Math.max(1, v.V);
    if (amount > .00002) { mix(colour, Math.min(.9, .22 + amount * 34)); baseKey = name; }
  }
  let indKey = null;
  const inds = Object.keys(v.ind || {}).filter(k => v.ind[k] > 0);
  for (const k of inds) {
    const ic = indColor(k, e.pH);
    // Hue follows the indicator's own transition range and the calculated pH;
    // saturation follows indicator concentration, so dilution makes the colour
    // paler instead of leaving a permanently opaque dye in the vessel.
    const strength = Math.min(1, v.ind[k] * 20 / Math.max(1, v.V));
    const w = ic.a * Math.min(1, .12 + strength * .92);
    if (w > .02) { rgb = lerpC(rgb, ic.rgb, w); a = Math.max(a, .3 + w * .6); }
    indKey = ic.key;
  }
  // suspended precipitate makes it cloudy
  let cloud = null, total = 0, main = null;
  for (const k in e.ppt) if (e.ppt[k] > 0.0015) { total += e.ppt[k]; if (!main || e.ppt[k] > e.ppt[main]) main = k; }
  if (main) cloud = PPT[main][1];
  return { rgb, a: Math.min(.92, a), cloud, pptMain: main, pptTotal: total, baseKey, indKey, inds };
}

/* ---------- ethanol–water VLE (1 atm) ---------- */
const VLE = [
  [0, 0, 100], [0.019, 0.17, 95.5], [0.0721, 0.3891, 89.0], [0.0966, 0.4375, 86.7], [0.1238, 0.4704, 85.3],
  [0.1661, 0.5089, 84.1], [0.2337, 0.5445, 82.7], [0.2608, 0.558, 82.3], [0.3273, 0.5826, 81.5], [0.3965, 0.6122, 80.7],
  [0.5079, 0.6564, 79.8], [0.5732, 0.6841, 79.3], [0.6763, 0.7385, 78.74], [0.7472, 0.7815, 78.41], [0.8943, 0.8943, 78.15], [1, 1, 78.3]];
function vle(x, col) {
  x = Math.max(0, Math.min(1, x));
  for (let i = 1; i < VLE.length; i++) if (x <= VLE[i][0]) {
    const [x0, y0, T0] = VLE[i - 1], [x1, y1, T1] = VLE[i], f = (x - x0) / (x1 - x0);
    return [y0 + (y1 - y0) * f, T0 + (T1 - T0) * f];
  }
  return [1, 78.3];
}
const ML_E = 58.4, ML_W = 18.07;
function mixVol(nE, nW) { return nE * ML_E + nW * ML_W; }
function volPct(nE, nW) { const v = mixVol(nE, nW); return v > 0 ? nE * ML_E / v * 100 : 0; }

if (typeof module !== 'undefined') module.exports = { speciate, equilibrate, vesselLook, indColor, vle, volPct, mixVol };
