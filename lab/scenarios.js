/* ===================== REAGENTS & SCENARIOS ===================== */
const R = {
  HCl: { f: 'HCl', k: 'acid', tot: { Cl: .1 } },
  H2SO4: { f: 'H₂SO₄', k: 'acid', tot: { SO4: .1 } },
  HAc: { f: 'CH₃COOH', k: 'acid', tot: { Ac: .1 } },
  NaOH: { f: 'NaOH', k: 'base', tot: { Na: .1 } },
  NH3: { f: 'NH₃·H₂O', k: 'base', tot: { NH3: .1 } },
  lime: { f: 'Ca(OH)₂', k: 'base', tot: { Ca: .01 } },
  H2O: { f: 'H₂O', k: 'water', tot: {} },
  NaCl: { f: 'NaCl', k: 'salt', tot: { Na: .1, Cl: .1 } },
  Na2CO3: { f: 'Na₂CO₃', k: 'salt', tot: { Na: .2, Ct: .1 } },
  NH4Cl: { f: 'NH₄Cl', k: 'salt', tot: { NH3: .1, Cl: .1 } },
  NaAc: { f: 'CH₃COONa', k: 'salt', tot: { Na: .1, Ac: .1 } },
  Na2SO4: { f: 'Na₂SO₄', k: 'salt', tot: { Na: .2, SO4: .1 } },
  NaNO3: { f: 'NaNO₃', k: 'salt', tot: { Na: .1, NO3: .1 } },
  CuSO4: { f: 'CuSO₄', k: 'salt', tot: { Cu: .1, SO4: .1 } },
  FeCl3: { f: 'FeCl₃', k: 'salt', tot: { Fe3: .1, Cl: .31 } },
  FeSO4: { f: 'FeSO₄', k: 'salt', tot: { Fe2: .1, SO4: .1 } },
  BaCl2: { f: 'BaCl₂', k: 'salt', tot: { Ba: .1, Cl: .2 } },
  AgNO3: { f: 'AgNO₃', k: 'salt', tot: { Ag: .05, NO3: .05 } },
  KI: { f: 'KI', k: 'salt', tot: { K: .1, I: .1 } },
  PbNO3: { f: 'Pb(NO₃)₂', k: 'salt', tot: { Pb: .1, NO3: .2 } },
  litmus: { f: 'Litmus', k: 'ind', ind: 'litmus' },
  phph: { f: 'Phph', k: 'ind', ind: 'phph' },
  mo: { f: 'MO', k: 'ind', ind: 'mo' },
  univ: { f: 'UI', k: 'ind', ind: 'univ' },
};
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LET = 'ABCDEF';
const bottle = (id, extra) => Object.assign({ id, f: R[id].f, k: R[id].k, tot: R[id].tot, ind: R[id].ind, nameKey: 'r.' + id }, extra || {});
const unknown = (label, rid) => ({ id: 'U' + label, f: label, k: 'unk', tot: R[rid].tot, nameKey: 'r.unknown', secret: rid });
const tube = (n) => ({ id: 'T' + n, kind: 'tube', cap: 15, label: String(n) });
const tubes = n => Array.from({ length: n }, (_, i) => tube(i + 1));
function unknownsSetup(run, list) {
  const sh = shuffle(list);
  run.secret.map = {};
  const us = sh.map((rid, i) => { run.secret.map[LET[i]] = rid; return unknown(LET[i], rid); });
  return us;
}
const identityFields = (run, opts) => Object.keys(run.secret.map).map(L => ({ id: L, type: 'select', label: { raw: (window.T ? T('ans.bottle', { x: L }) : L) }, options: opts }));
const checkMap = (run, ans, fn) => { const wrong = []; for (const L in run.secret.map) if (ans[L] !== fn(run.secret.map[L])) wrong.push(L); return wrong; };
const near = (x, target, rel) => isFinite(x) && Math.abs(x - target) <= Math.abs(target) * rel;

const SCEN = [
  // ---------- Acids, bases, indicators ----------
  { id: 'ind1', topic: 'ind', level: 1, kind: 'bench',
    setup(run) { run.shelf = [...unknownsSetup(run, ['HCl', 'NaOH', 'H2O']), bottle('litmus'), bottle('phph'), bottle('mo')];
      run.vessels = tubes(6); run.tools = ['litmusPaper', 'empty']; },
    fields(run) { return identityFields(run, [['acid', 'opt.acid'], ['alkali', 'opt.alkali'], ['neutral', 'opt.neutral']]); },
    check(run, a) { return checkMap(run, a, r => ({ HCl: 'acid', NaOH: 'alkali', H2O: 'neutral' })[r]); } },
  { id: 'ind2', topic: 'ind', level: 2, kind: 'bench',
    setup(run) { run.shelf = [...unknownsSetup(run, ['HCl', 'NaOH', 'NaCl', 'Na2CO3', 'NH4Cl']), bottle('HCl', { f: 'HCl', nameKey: 'r.HCl' }), bottle('univ'), bottle('phph'), bottle('mo'), bottle('litmus')];
      run.vessels = tubes(6); run.tools = ['phPaper', 'litmusPaper', 'empty']; },
    fields(run) { return identityFields(run, ['HCl', 'NaOH', 'NaCl', 'Na2CO3', 'NH4Cl'].map(x => [x, { raw: R[x].f }])); },
    check(run, a) { return checkMap(run, a, r => r); } },
  { id: 'ind3', topic: 'ind', level: 3, kind: 'bench',
    setup(run) { run.shelf = [...unknownsSetup(run, ['HCl', 'HAc', 'NaOH', 'NH3', 'NaAc', 'NH4Cl']), bottle('univ'), bottle('H2O')];
      run.vessels = tubes(6); run.tools = ['phMeter', 'phPaper', 'empty']; },
    fields(run) { return [...identityFields(run, ['HCl', 'HAc', 'NaOH', 'NH3', 'NaAc', 'NH4Cl'].map(x => [x, { raw: R[x].f }])),
      { id: 'pka', type: 'number', label: 'ans.pkaAc', step: '0.01' }]; },
    check(run, a) { const w = checkMap(run, a, r => r); const p = parseFloat(String(a.pka).replace(',', '.')); if (!(p >= 4.6 && p <= 4.95)) w.push('pka'); return w; } },

  // ---------- Neutralisation & salts ----------
  { id: 'neu1', topic: 'neu', level: 1, kind: 'bench',
    setup(run) { run.shelf = [bottle('NaOH'), bottle('HCl'), bottle('phph'), bottle('univ')];
      run.vessels = [{ id: 'B1', kind: 'beaker', cap: 100, label: 'B', pre: { rid: 'HCl', V: 10 } }];
      run.tools = ['phPaper', 'evaporate', 'empty']; run.watchOvershoot = true; },
    fields() { return [{ id: 'salt', type: 'select', label: 'ans.salt', options: [['NaCl', { raw: 'NaCl' }], ['Na2SO4', { raw: 'Na₂SO₄' }], ['NaOH', { raw: 'NaOH' }], ['HCl', { raw: 'HCl' }]] }]; },
    check(run, a) { const w = []; if (a.salt !== 'NaCl') w.push('salt'); if (!run.flags.saltOK) w.push('_salt'); return w; } },
  { id: 'neu2', topic: 'neu', level: 2, kind: 'bench',
    setup(run) { const c = Math.round((0.06 + Math.random() * 0.09) * 1000) / 1000; run.secret.c = c;
      run.shelf = [{ id: 'X', f: 'X', k: 'unk', tot: { Cl: c }, nameKey: 'r.acidX', pipette: 10 }, bottle('NaOH', { burette: true, f: 'NaOH 0.100 M' }), bottle('phph'), bottle('mo')];
      run.vessels = [{ id: 'F1', kind: 'flask', cap: 150, label: '1' }, { id: 'F2', kind: 'flask', cap: 150, label: '2' }];
      run.tools = ['phPaper', 'refill', 'empty']; run.watchOvershoot = false; },
    fields() { return [{ id: 'c', type: 'number', label: 'ans.cHCl', step: '0.001', unit: 'mol/L' }]; },
    check(run, a) { const x = parseFloat(String(a.c).replace(',', '.')); return near(x, run.secret.c, 0.02) ? [] : ['c']; } },
  { id: 'neu3', topic: 'neu', level: 3, kind: 'bench',
    setup(run) { const c = Math.round((0.06 + Math.random() * 0.09) * 1000) / 1000; run.secret.c = c;
      run.shelf = [{ id: 'Y', f: 'Y', k: 'unk', tot: { Ac: c }, nameKey: 'r.acidY', pipette: 10 }, bottle('NaOH', { burette: true, f: 'NaOH 0.100 M' }), bottle('phph'), bottle('mo')];
      run.vessels = [{ id: 'F1', kind: 'flask', cap: 150, label: '1' }, { id: 'F2', kind: 'flask', cap: 150, label: '2' }];
      run.tools = ['phMeterLive', 'refill', 'empty']; run.curve = true; },
    fields() { return [{ id: 'c', type: 'number', label: 'ans.cHAc', step: '0.001', unit: 'mol/L' }, { id: 'pka', type: 'number', label: 'ans.pkaAc', step: '0.01' },
      { id: 'ind', type: 'select', label: 'ans.bestInd', options: [['phph', 'r.phph'], ['mo', 'r.mo']] }]; },
    check(run, a) { const w = []; const x = parseFloat(String(a.c).replace(',', '.')); if (!near(x, run.secret.c, 0.02)) w.push('c');
      const p = parseFloat(String(a.pka).replace(',', '.')); if (!(p >= 4.6 && p <= 4.95)) w.push('pka'); if (a.ind !== 'phph') w.push('ind'); return w; } },

  // ---------- Precipitation ----------
  { id: 'pre1', topic: 'pre', level: 1, kind: 'bench',
    setup(run) { run.shelf = ['CuSO4', 'NaOH', 'AgNO3', 'NaCl', 'BaCl2', 'Na2SO4', 'NaNO3', 'H2O'].map(x => bottle(x)); run.vessels = tubes(6); run.tools = ['empty']; },
    fields() { return []; },
    check(run) { const need = ['CuOH2', 'AgCl', 'BaSO4']; const have = new Set();
      for (const v of run.vessels) for (const k in (v.eq && v.eq.ppt) || {}) if (v.eq.ppt[k] > 0.01) have.add(k);
      return need.filter(k => !have.has(k)).map(k => '_' + k); } },
  { id: 'pre2', topic: 'pre', level: 2, kind: 'bench',
    setup(run) { run.shelf = [...unknownsSetup(run, ['NaCl', 'Na2SO4', 'Na2CO3', 'NaNO3']), bottle('AgNO3'), bottle('BaCl2'), bottle('HCl')]; run.vessels = tubes(6); run.tools = ['empty']; },
    fields(run) { return identityFields(run, ['NaCl', 'Na2SO4', 'Na2CO3', 'NaNO3'].map(x => [x, { raw: R[x].f }])); },
    check(run, a) { return checkMap(run, a, r => r); } },
  { id: 'pre3', topic: 'pre', level: 3, kind: 'bench',
    setup(run) { run.shelf = [...unknownsSetup(run, ['CuSO4', 'FeCl3', 'FeSO4', 'PbNO3', 'KI', 'AgNO3']), bottle('NaOH'), bottle('BaCl2'), bottle('HCl'), bottle('Na2SO4')]; run.vessels = tubes(6); run.tools = ['empty']; },
    fields(run) { return identityFields(run, ['CuSO4', 'FeCl3', 'FeSO4', 'PbNO3', 'KI', 'AgNO3'].map(x => [x, { raw: R[x].f }])); },
    check(run, a) { return checkMap(run, a, r => r); } },

  // ---------- Organic: burning & distilling ----------
  { id: 'org1', topic: 'org', level: 1, kind: 'combust',
    setup(run) { run.comb = { src: 'lamp', lit: { lamp: false, burner: false }, air: true, glass: null, lime: { id: 'L', kind: 'tube', cap: 15, label: 'Ca(OH)₂', V: 5, tot: { Ca: .05 }, ind: {} }, dish: null, cobalt: null }; },
    fields() { return [
      { id: 'prod', type: 'checks', label: 'ans.products', options: ['CO2', 'H2O', 'CO', 'C', 'H2', 'O2'].map(x => [x, { raw: ({ CO2: 'CO₂', H2O: 'H₂O', CO: 'CO', C: 'C', H2: 'H₂', O2: 'O₂' })[x] }]) },
      { id: 'tw', type: 'select', label: 'ans.testWater', options: [['glass', 'opt.tGlass'], ['lime', 'opt.tLime'], ['dish', 'opt.tDish']] },
      { id: 'tc', type: 'select', label: 'ans.testCO2', options: [['glass', 'opt.tGlass'], ['lime', 'opt.tLime'], ['dish', 'opt.tDish']] },
      { id: 'inc', type: 'checks', label: 'ans.incomplete', options: ['CO2', 'H2O', 'CO', 'C'].map(x => [x, { raw: ({ CO2: 'CO₂', H2O: 'H₂O', CO: 'CO', C: 'C' })[x] }]) }]; },
    check(run, a) { const w = []; const eq = (arr, set) => { arr = arr || []; return arr.length === set.length && set.every(x => arr.includes(x)); };
      if (!eq(a.prod, ['CO2', 'H2O'])) w.push('prod'); if (a.tw !== 'glass') w.push('tw'); if (a.tc !== 'lime') w.push('tc'); if (!eq(a.inc, ['CO2', 'H2O', 'CO', 'C'])) w.push('inc');
      if (!run.flags.didGlass || !run.flags.didLime) w.push('_evidence');
      return w; } },
  { id: 'org2', topic: 'org', level: 2, kind: 'distill',
    setup(run) { const nE = 12.5 * 0.789 / 46.07, nW = 37.5 / 18.02;
      run.dist = { nE, nW, T: 20, Tth: 20, heating: false, started: false, chips: false, src: 'burner', thermo: 'liquid', water: 'top', tap: false, column: false,
        rec: [{ nE: 0, nW: 0 }, { nE: 0, nW: 0 }, { nE: 0, nW: 0 }], cur: 0, t: 0, speed: 10, curve: [], boilT: 0, bumped: false, measured: {}, burned: {}, fire: false, over: false }; },
    fields() { return [{ id: 'rec', type: 'select', label: 'ans.bestRec', options: [['0', { raw: 'R1' }], ['1', { raw: 'R2' }], ['2', { raw: 'R3' }]] }]; },
    check(run, a) { const d = run.dist; const r = d.rec[+a.rec]; const w = [];
      if (!r || mixVol(r.nE, r.nW) < 4 || volPct(r.nE, r.nW) < 60) w.push('rec');
      if (r && !d.burned[a.rec]) w.push('_burn');
      return w; } },
  { id: 'org3', topic: 'org', level: 3, kind: 'analysis',
    setup(run) { const C = shuffle([['CH4O', 1, 4, 1], ['C2H6O', 2, 6, 1], ['C3H8O', 3, 8, 1], ['C3H6O', 3, 6, 1], ['C4H10O', 4, 10, 1], ['C2H6O2', 2, 6, 2], ['C4H8O2', 4, 8, 2]])[0];
      const M = C[1] * 12.011 + C[2] * 1.008 + C[3] * 15.999; const m = Math.round((0.18 + Math.random() * 0.14) * 10000) / 10000;
      run.secret = { f: C[0], x: C[1], y: C[2], z: C[3], M, m };
      run.an = { o2: 'air', order: 'naoh', before: null, after: null, burned: false, tubeA0: 0, tubeB0: 0 }; },
    fields() { return [{ id: 'x', type: 'number', label: { raw: 'C' }, step: '1', small: true }, { id: 'y', type: 'number', label: { raw: 'H' }, step: '1', small: true }, { id: 'z', type: 'number', label: { raw: 'O' }, step: '1', small: true }]; },
    check(run, a) { const s = run.secret; const w = []; if (+a.x !== s.x) w.push('x'); if (+a.y !== s.y) w.push('y'); if (+a.z !== s.z) w.push('z'); return w; } },
];
const SC = Object.fromEntries(SCEN.map(s => [s.id, s]));
const TOPICS = ['ind', 'neu', 'pre', 'org'];
