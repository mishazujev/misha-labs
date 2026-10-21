/* ===================== APP ===================== */
const S = {
  lang: 'en', view: 'home', tab: 'assign', owner: false, uid: null, profileName: '', name: '',
  db: null, user: null, dbReady: false, canSave: true, assignments: [], settings: { practice: true },
  results: [], myRuns: {}, run: null, resFilter: null, openRow: null, pendingAssign: null, delConfirm: null, resetConfirm: false,
};
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

function T(key, p) {
  let s = (I18N[S.lang] && I18N[S.lang][key]);
  if (s == null) s = I18N.en[key];
  if (s == null) return key;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => { const v = p[k]; if (v == null) return ''; if (typeof v === 'object' && v.k) return T(v.k, v.p); return v; });
  return s;
}
window.T = T;
const Lbl = l => (l && typeof l === 'object') ? l.raw : T(l);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
const fmt = (x, d) => Number(x).toFixed(d).replace('.', S.lang === 'en' ? '.' : ',');
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let toastTimer;
function toast(msg, kind) {
  const el = document.getElementById('toast'); el.textContent = msg; el.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', 3200);
}

/* ---------- run lifecycle ---------- */
function newRun(scId, assignId, keepCounters) {
  const sc = SC[scId];
  const key = assignId ? 'a_' + assignId : 'free_' + scId;
  const prior = keepCounters || S.myRuns[key] || {};
  const run = {
    sc, scId, assignId: assignId || null, key, secret: {}, flags: {}, log: [], mistakes: (prior.mistakes || []).slice(),
    attempts: prior.attempts || 0, retries: prior.retries || 0, success: !!prior.success, everSuccess: !!prior.success,
    startedAt: prior.startedAt || Date.now(), t0: Date.now(), secsPrior: prior.secs || 0,
    amount: 1, sel: 0, goggles: false, answers: {}, wrong: [], burette: { used: 0 }, reading: null, mistakeOnce: {}, solvedNow: false,
  };
  sc.setup(run);
  run.jobs = [];
  if (run.tools && sc.kind === 'bench' && !['neu2', 'neu3'].includes(scId) && !run.tools.includes('heat')) run.tools.splice(run.tools.indexOf('empty'), 0, 'heat');
  if (run.vessels) for (const v of run.vessels) {
    v.V = 0; v.tot = {}; v.ind = {}; v.residue = null; v.curve = []; v.fx = null; v.heating = false;
    if (v.pre) { v.V = v.pre.V; for (const k in R[v.pre.rid].tot) v.tot[k] = R[v.pre.rid].tot[k] * v.V; }
    equilibrate(v);
  }
  S.run = run; S.view = 'lab'; S.resetConfirm = false;
  logE('info', [['log.start', { t: { k: 'sc.' + scId + '.title' } }]]);
  render();
}
const elapsed = () => S.run ? (Date.now() - S.run.t0) / 1000 : 0;
function logE(type, parts, head) { S.run.log.push({ t: elapsed(), type, parts, head }); }
function mistake(k, p, once) {
  const run = S.run;
  if (once !== false && run.mistakeOnce[k]) return;
  run.mistakeOnce[k] = true;
  run.mistakes.push({ k, p: p || null, t: Math.round(elapsed()), at: Date.now() });
  if (run.mistakes.length > 80) run.mistakes.shift();
  logE('mistake', [['m.' + k, p]]);
  toast(T('m.' + k, p), 'err');
}
function needGoggles() {
  if (S.run.goggles) return true;
  mistake('goggles'); toast(T('tip.goggles'), 'err'); if (typeof refreshLog === 'function') refreshLog(); return false;
}

/* ---------- bench actions ---------- */
function snapV(v) {
  const e = v.eq || { ppt: {} }; const p = {};
  for (const k in e.ppt) if (e.ppt[k] > 0.0015) p[k] = e.ppt[k];
  const lk = vesselLook(v); return { p, ind: lk.indKey, inds: lk.inds.length, base: lk.baseKey, pH: e.pH };
}
function describe(b, a, gas, addedInd) {
  const out = [];
  for (const k in a.p) if (!b.p[k]) out.push(['obs.ppt', { c: { k: 'col.' + PPT[k][0] } }]);
  let dis = false; for (const k in b.p) if (!a.p[k] && b.p[k] > 0.002) dis = true;
  if (dis) out.push(['obs.dissolve']);
  else for (const k in a.p) if (b.p[k] && a.p[k] < b.p[k] * 0.5) { out.push(['obs.partDissolve']); break; }
  if (gas > 0.003) out.push(['obs.gas']);
  if (a.inds) { if (addedInd || a.ind !== b.ind) out.push(['obs.ind', { c: { k: 'col.' + a.ind } }]); }
  else if (a.base !== b.base && a.base !== 'colourless') out.push(['obs.colour', { c: { k: 'col.' + a.base } }]);
  if (!out.length) out.push(['obs.none']);
  return out;
}
function addReagent(b) {
  const run = S.run; if (!needGoggles()) return;
  const v = run.vessels[run.sel]; if (!v) return;
  let amt = run.amount, amtLbl;
  if (b.ind) { amt = 0.1; amtLbl = T('amt.2drops'); }
  else if (b.pipette) { amt = b.pipette; amtLbl = '10.00 mL'; }
  else amtLbl = amt === 0.05 ? T('amt.drop') : fmt(amt, amt < 1 ? 2 : 1) + ' mL';
  if (b.burette) {
    if (run.burette.used + amt > 50.0001) { toast(T('tip.buretteEmpty'), 'err'); return; }
    run.burette.used = Math.round((run.burette.used + amt) * 100) / 100;
  }
  if (v.evap) { toast(T('tip.busy'), 'err'); return; }
  const before = snapV(v);
  startPour(v, b, amt);
  v.V += amt;
  if (b.ind) v.ind[b.ind] = (v.ind[b.ind] || 0) + 1;
  else for (const k in b.tot) v.tot[k] = (v.tot[k] || 0) + b.tot[k] * amt;
  if (v.residue && v.V > 0) { v.residue = null; }
  let spilled = false;
  if (v.V > v.cap) { const keep = v.cap * 0.9 / v.V; for (const k in v.tot) v.tot[k] *= keep; v.V = v.cap * 0.9; spilled = true; vfx(v).spill = 2.2; }
  if (amt >= 0.5) vfx(v).stir = Math.min(.7, amt / v.cap * 4);
  const gas = equilibrate(v);
  if (gas > 0) vfx(v).gas += gas * 1.4 + (gas > 0.003 ? 0.03 : 0);
  const after = snapV(v);
  const parts = describe(before, after, gas, !!b.ind);
  logE('obs', parts, { v: v.label, amt: amtLbl, f: b.k === 'unk' ? b.f : b.f });
  if (spilled) mistake('overflow', null, false);
  if (v.meter && run.sc.id === 'neu3') v.curve.push([run.burette.used, v.eq.pH]);
  if (run.watchOvershoot && v.ind.phph && v.eq.pH > 11 && (v.tot.Cl || 0) > 0) { if (!run.flags.overNow) { run.flags.overNow = true; mistake('overshoot', null, false); } }
  if (v.eq.pH < 9) run.flags.overNow = false;
  render();
}
function tool(name) {
  const run = S.run; const v = run.vessels && run.vessels[run.sel];
  if (name === 'refill') { run.burette.used = 0; logE('info', [['log.refill']]); render(); return; }
  if (!v) return;
  if (name === 'empty') { v.V = 0; v.tot = {}; v.ind = {}; v.residue = null; v.curve = []; v.meter = false; v.heating = false; v.evap = false; resetFx(v); equilibrate(v); logE('info', [['log.empty', { v: v.label }]]); run.reading = null; render(); return; }
  if (!needGoggles()) return;
  if (name === 'heat') {
    if (v.evap) return;
    if (!v.heating && v.V < 0.05) { toast(T('tip.emptyVessel'), 'err'); return; }
    v.heating = !v.heating;
    logE('info', [[v.heating ? 'log.heatOn' : 'log.heatStop', { v: v.label }]]);
    if (v.heating && v.kind === 'tube' && v.V > v.cap / 3) mistake('heatFull', null, false);
    render(); return;
  }
  if (name !== 'phMeterLive' && (v.V < 0.05 || (v.eq && v.eq.dry))) { toast(T('tip.emptyVessel'), 'err'); return; }
  const pH = v.eq.pH;
  if (name === 'phPaper') {
    const ic = indColor('univ', pH); run.reading = { kind: 'paper', rgb: ic.rgb, v: v.label };
    logE('obs', [['obs.paper', { c: { k: 'col.' + ic.key } }]], { v: v.label, amt: '', f: T('tool.phPaper') });
  } else if (name === 'litmusPaper') {
    const res = pH < 5 ? 'obs.litAcid' : pH > 8.3 ? 'obs.litBase' : 'obs.litNeutral';
    run.reading = { kind: 'litmus', pH, v: v.label };
    logE('obs', [[res]], { v: v.label, amt: '', f: T('tool.litmusPaper') });
  } else if (name === 'phMeter') {
    const val = pH + (Math.random() - .5) * .04; run.reading = { kind: 'meter', val, v: v.label };
    logE('obs', [['obs.meter', { x: fmt(val, 2) }]], { v: v.label, amt: '', f: T('tool.phMeter') });
  } else if (name === 'phMeterLive') {
    v.meter = !v.meter;
    if (v.meter && v.V > 0) v.curve.push([run.burette.used, v.eq.pH]);
    logE('info', [[v.meter ? 'log.meterOn' : 'log.meterOff', { v: v.label }]]);
  } else if (name === 'evaporate') {
    if (v.evap) return;
    v.evap = true; v.heating = true; logE('info', [['log.evapStart', { v: v.label }]]);
  }
  render();
}

function evapFinish(v) {
  const run = S.run;
  const ex = (v.tot.Na || 0) - (v.tot.Cl || 0) - 2 * (v.tot.SO4 || 0);
  const neutral = Math.abs(ex) <= 0.006;
  v.residue = (v.tot.Cu ? 'blue' : v.tot.Fe3 ? 'brown' : 'white');
  if (run.sc.id === 'neu1') {
    if (neutral && (v.tot.Na || 0) > 0.05) { run.flags.saltOK = true; logE('ok', [['obs.evapNaCl']]); }
    else { run.flags.saltOK = false; logE('obs', [[ex < 0 ? 'obs.evapAcid' : 'obs.evapBase']]); mistake('evapNotNeutral', null, false); }
  } else logE('obs', [['obs.evap']]);
  if ((v.tot.Cl || 0) > (v.tot.Na || 0)) v.tot.Cl = v.tot.Na || 0;
  v.V = 0; v.ind = {}; equilibrate(v);
}

/* ---------- submit / save ---------- */
function submit() {
  const run = S.run; const sc = run.sc;
  const fields = sc.fields(run);
  for (const f of fields) {
    const a = run.answers[f.id];
    if (a == null || a === '' || (Array.isArray(a) && !a.length)) { toast(T('tip.fillAll'), 'err'); return; }
  }
  if (sc.kind === 'combust' && (run.comb.lit.lamp || run.comb.lit.burner)) mistake('flameLeft');
  run.attempts++;
  const wrong = sc.check(run, run.answers);
  run.wrong = wrong;
  if (!wrong.length) {
    run.success = true; run.everSuccess = true; run.solvedNow = true; run.finishedAt = Date.now();
    logE('ok', [['log.success', { n: run.attempts }]]);
    toast(T('log.successShort'), 'ok');
  } else {
    const names = wrong.map(w => w[0] === '_' ? T('whyS.' + w.slice(1)) : fieldName(fields, w)).join(', ');
    run.mistakes.push({ k: 'wrong', p: { f: names }, t: Math.round(elapsed()), at: Date.now() });
    logE('mistake', [['m.wrong', { f: names }]]);
    toast(T('m.wrong', { f: names }), 'err');
  }
  save(); render();
}
function fieldName(fields, id) { const f = fields.find(x => x.id === id); return f ? Lbl(f.label) : id; }
function summary() {
  const run = S.run;
  return {
    sc: run.scId, assign: run.assignId, attempts: run.attempts, retries: run.retries, success: run.everSuccess,
    mistakes: run.mistakes, startedAt: run.startedAt, finishedAt: run.finishedAt || null,
    secs: Math.round(run.secsPrior + elapsed()), updatedAt: Date.now(),
  };
}
let saveChain = Promise.resolve();
function save() {
  const run = S.run; if (!run) return;
  S.myRuns[run.key] = summary();
  if (S.owner || !S.db || !S.uid || !S.canSave) { if (!S.owner) S.canSave = false; return; }
  const body = { name: S.name || '', updatedAt: Date.now(), runs: JSON.parse(JSON.stringify(S.myRuns)) };
  saveChain = saveChain.then(() => S.db.doc('results/' + S.uid).set(body)).then(() => { S.saved = Date.now(); }, e => {
    if (e && e.code === 'unavailable') return; S.canSave = false; render();
  });
}
function reportCode() {
  const s = summary();
  const o = { v: 1, n: S.name || '', k: S.run.key, s: s.sc, a: s.attempts, r: s.retries, ok: s.success, d: s.secs, at: s.updatedAt, st: s.startedAt, m: s.mistakes.map(m => [m.k, m.t, m.p ? m.p.f || '' : '']) };
  return 'LAB1.' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function decodeReport(code) {
  try { const s = code.trim().replace(/^LAB1\./, ''); const o = JSON.parse(decodeURIComponent(escape(atob(s)))); if (o.v !== 1) return null; return o; } catch (e) { return null; }
}
function startOver() {
  const run = S.run;
  const keep = { attempts: run.attempts, retries: run.retries + 1, mistakes: run.mistakes, success: run.everSuccess, startedAt: run.startedAt, secs: run.secsPrior + elapsed() };
  stopSim();
  run.jobs = [];
  newRun(run.scId, run.assignId, keep);
  logE('info', [['log.retry', { n: keep.retries }]]);
  S.myRuns[S.run.key] = summary(); save(); render();
}
function leaveLab() { if (S.run) { S.myRuns[S.run.key] = summary(); if (S.run.attempts || S.run.mistakes.length) save(); } stopSim(); S.run = null; S.view = 'home'; render(); }

/* ---------- SVG helpers ---------- */
const css = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const gogglesSVG = on => `<svg viewBox="0 0 64 32" class="gogsvg" aria-hidden="true"><path d="M4 12 Q4 6 12 6 H52 Q60 6 60 12 V20 Q60 26 52 26 H40 Q36 26 34 21 Q32 18 30 21 Q28 26 24 26 H12 Q4 26 4 20 Z" fill="${on ? 'var(--accent)' : 'none'}" fill-opacity=".25" stroke="currentColor" stroke-width="2.5"/><path d="M10 12 H24 M40 12 H54" stroke="currentColor" stroke-width="1.5" opacity=".6"/></svg>`;

/* ---------- top-level render ---------- */
function render() {
  FXR.list = [];
  document.documentElement.lang = S.lang;
  document.body.classList.toggle('lab-active', S.view === 'lab' && !!S.run);
  const app = document.getElementById('app');
  const scrollLog = document.querySelector('.notebook .entries');
  const keepScroll = window.scrollY;
  app.replaceChildren(S.view === 'lab' && S.run ? renderLab() : (S.owner ? renderTeacher() : renderStudentHome()));
  renderTop();
  const nb = document.querySelector('.notebook .entries'); if (nb) nb.scrollTop = nb.scrollHeight;
  if (S.run && S.run.sc.kind === 'distill') drawDistCurve();
  if (S.run && S.run.sc.id === 'neu3') drawTitCurve();
  window.scrollTo(0, keepScroll);
}
function renderTop() {
  const sel = document.getElementById('lang'); sel.value = S.lang;
  document.getElementById('brandSub').textContent = T('brand.sub');
  const role = document.getElementById('role');
  role.textContent = S.owner ? T('role.teacher') : T('role.student');
}

/* ---------- student home ---------- */
function scCard(scId, onStart, extra) {
  const sc = SC[scId];
  return h('article', { class: 'sccard t-' + sc.topic },
    h('div', { class: 'scmeta' }, h('span', { class: 'chip lvl' }, T('lvl.' + sc.level)), h('span', { class: 'topicname' }, T('topic.' + sc.topic))),
    h('h3', null, T('sc.' + scId + '.title')),
    h('p', { class: 'scgoal' }, T('sc.' + scId + '.short')),
    extra || null,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: onStart }, T('btn.open'))));
}
function renderStudentHome() {
  const wrap = h('div', { class: 'home' });
  const nameIn = h('input', { id: 'stname', type: 'text', maxlength: '60', value: S.name, placeholder: T('ph.name'), autocomplete: 'name',
    oninput: e => { S.name = e.target.value; LS.set('lab.name', S.name); } });
  wrap.append(h('section', { class: 'intro' },
    h('div', null, h('h1', null, T('home.title')), h('p', { class: 'lede' }, T('home.lede'))),
    h('label', { class: 'namefield', for: 'stname' }, h('span', null, T('lbl.yourName')), nameIn)));
  if (!S.dbReady || !S.db) wrap.append(h('p', { class: 'notice' }, T('note.offline')));
  else if (!S.canSave) wrap.append(h('p', { class: 'notice' }, T('note.cannotSave')));
  const start = (scId, aId) => () => { if (!S.name.trim()) { toast(T('tip.nameFirst'), 'err'); nameIn.focus(); return; } newRun(scId, aId); };
  const act = S.assignments.filter(a => a.active);
  wrap.append(h('h2', { class: 'sect' }, T('home.assigned')));
  if (!act.length) wrap.append(h('p', { class: 'empty' }, S.dbReady ? T('home.noAssign') : T('home.loading')));
  else wrap.append(h('div', { class: 'grid' }, act.map(a => {
    const r = S.myRuns['a_' + a.id];
    const st = r ? h('p', { class: 'status ' + (r.success ? 'ok' : '') }, r.success ? T('st.done') : T('st.inprogress', { n: r.attempts })) : null;
    const note = a.note ? h('p', { class: 'anote' }, a.note) : null;
    return scCard(a.sc, start(a.sc, a.id), h('div', null, note, st));
  })));
  if (S.settings.practice !== false || !S.dbReady) {
    wrap.append(h('h2', { class: 'sect' }, T('home.practice')));
    wrap.append(renderMatrix((scId) => start(scId, null), 'btn.practice'));
  }
  return wrap;
}
function renderMatrix(onPick, btnKey) {
  const t = h('div', { class: 'matrix' });
  t.append(h('div', { class: 'mx-h' }), ...[1, 2, 3].map(l => h('div', { class: 'mx-h' }, T('lvl.' + l))));
  for (const tp of TOPICS) {
    t.append(h('div', { class: 'mx-topic t-' + tp }, h('strong', null, T('topic.' + tp)), h('span', null, T('topic.' + tp + '.d'))));
    for (const l of [1, 2, 3]) {
      const sc = SCEN.find(s => s.topic === tp && s.level === l);
      const r = S.myRuns['free_' + sc.id];
      t.append(h('div', { class: 'mx-cell' }, h('span', { class: 'mx-lvl' }, T('lvl.' + l)), h('strong', null, T('sc.' + sc.id + '.title')), h('p', null, T('sc.' + sc.id + '.short')),
        h('button', { class: 'btn small', onclick: onPick(sc.id) }, T(btnKey)), r && r.success && !S.owner ? h('span', { class: 'tick' }, '✓') : null));
    }
  }
  return h('div', { class: 'mx-wrap' }, t);
}

/* ---------- teacher ---------- */
function renderTeacher() {
  const wrap = h('div', { class: 'home teacher' });
  wrap.append(h('section', { class: 'intro' }, h('div', null, h('h1', null, T('t.title')), h('p', { class: 'lede' }, T('t.lede')))));
  if (!S.db) wrap.append(h('p', { class: 'notice' }, T('note.offlineTeacher')));
  const tabs = [['assign', 't.tabAssign'], ['results', 't.tabResults'], ['try', 't.tabTry']];
  wrap.append(h('nav', { class: 'tabs', role: 'tablist' }, tabs.map(([id, k]) => h('button', { role: 'tab', 'aria-selected': S.tab === id ? 'true' : 'false', class: 'tab' + (S.tab === id ? ' on' : ''), onclick: () => { S.tab = id; render(); } }, T(k)))));
  if (S.tab === 'assign') wrap.append(renderAssign());
  if (S.tab === 'results') wrap.append(renderResults());
  if (S.tab === 'try') { wrap.append(h('p', { class: 'muted' }, T('t.tryNote'))); wrap.append(renderMatrix(scId => () => newRun(scId, null), 'btn.try')); }
  return wrap;
}
function renderAssign() {
  const box = h('div', { class: 'assign' });
  box.append(h('h2', { class: 'sect' }, T('t.pick')));
  box.append(renderMatrix(scId => () => { S.pendingAssign = scId; render(); setTimeout(() => { const n = document.getElementById('anote'); if (n) n.focus(); }, 30); }, 'btn.assign'));
  if (S.pendingAssign) {
    const scId = S.pendingAssign;
    const note = h('input', { id: 'anote', type: 'text', maxlength: '140', placeholder: T('ph.note') });
    box.append(h('div', { class: 'panel newassign' }, h('h3', null, T('t.newFor'), ' ', h('em', null, T('sc.' + scId + '.title')), ' · ', T('lvl.' + SC[scId].level)),
      h('label', { for: 'anote' }, T('lbl.note')), note,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => createAssign(scId, note.value) }, T('btn.create')), h('button', { class: 'btn', onclick: () => { S.pendingAssign = null; render(); } }, T('btn.cancel')))));
  }
  box.append(h('h2', { class: 'sect' }, T('t.current')));
  if (!S.assignments.length) box.append(h('p', { class: 'empty' }, T('t.noAssign')));
  else box.append(h('div', { class: 'alist' }, S.assignments.map(a => {
    const n = S.results.filter(r => r.runs && r.runs['a_' + a.id]).length;
    const ok = S.results.filter(r => r.runs && r.runs['a_' + a.id] && r.runs['a_' + a.id].success).length;
    return h('div', { class: 'arow' + (a.active ? '' : ' off') },
      h('div', { class: 'ainfo' }, h('strong', null, T('sc.' + a.sc + '.title')), h('span', { class: 'chip lvl' }, T('lvl.' + SC[a.sc].level)), h('span', { class: 'muted' }, T('topic.' + SC[a.sc].topic)), a.note ? h('span', { class: 'anote' }, a.note) : null),
      h('div', { class: 'astats' }, T('t.stats', { n, ok })),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => updAssign(a, { active: !a.active }) }, a.active ? T('btn.hide') : T('btn.show')),
        h('button', { class: 'btn small', onclick: () => { S.tab = 'results'; S.resFilter = 'a_' + a.id; render(); } }, T('btn.results')),
        S.delConfirm === a.id ? h('span', { class: 'confirm' }, T('t.sure'), h('button', { class: 'btn small danger', onclick: () => delAssign(a) }, T('btn.delete')), h('button', { class: 'btn small', onclick: () => { S.delConfirm = null; render(); } }, T('btn.cancel')))
          : h('button', { class: 'btn small ghost', onclick: () => { S.delConfirm = a.id; render(); } }, T('btn.delete'))));
  })));
  const pr = h('input', { type: 'checkbox', id: 'practice', checked: S.settings.practice !== false ? true : null, onchange: e => setSetting({ practice: e.target.checked }) });
  box.append(h('label', { class: 'check', for: 'practice' }, pr, h('span', null, T('t.allowPractice'))));
  box.append(h('div', { class: 'panel howto' }, h('h3', null, T('t.howTitle')), h('ol', null, ['t.how1', 't.how2', 't.how3'].map(k => h('li', null, T(k))))));
  return box;
}
async function createAssign(scId, note) {
  if (!S.db) { toast(T('note.offlineTeacher'), 'err'); return; }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try { await S.db.doc('assignments/' + id).set({ sc: scId, note: (note || '').slice(0, 140), active: true, createdAt: Date.now() }); S.pendingAssign = null; toast(T('t.created'), 'ok'); render(); }
  catch (e) { toast(T('err.save'), 'err'); }
}
async function updAssign(a, patch) { try { await S.db.doc('assignments/' + a.id).update(patch); } catch (e) { toast(T('err.save'), 'err'); } }
async function delAssign(a) { try { await S.db.doc('assignments/' + a.id).delete(); S.delConfirm = null; } catch (e) { toast(T('err.save'), 'err'); } }
async function setSetting(p) { S.settings = Object.assign({}, S.settings, p); try { await S.db.doc('settings/main').set(S.settings); } catch (e) { toast(T('err.save'), 'err'); } }

function renderResults() {
  const box = h('div', { class: 'results' });
  const keys = new Map();
  for (const a of S.assignments) keys.set('a_' + a.id, T('sc.' + a.sc + '.title') + ' · ' + T('lvl.' + SC[a.sc].level) + (a.note ? ' · ' + a.note : ''));
  for (const r of S.results) for (const k in (r.runs || {})) if (!keys.has(k)) { const sc = r.runs[k].sc; keys.set(k, (k.startsWith('free_') ? T('t.practiceRun') + ': ' : T('t.removedAssign') + ': ') + (SC[sc] ? T('sc.' + sc + '.title') + ' · ' + T('lvl.' + SC[sc].level) : sc)); }
  if (!S.resFilter || !keys.has(S.resFilter)) S.resFilter = keys.keys().next().value || null;
  const sel = h('select', { id: 'resf', onchange: e => { S.resFilter = e.target.value; S.openRow = null; render(); } }, [...keys].map(([k, l]) => h('option', { value: k, selected: k === S.resFilter ? true : null }, l)));
  box.append(h('div', { class: 'resbar' }, h('label', { for: 'resf' }, T('t.showFor')), keys.size ? sel : h('span', { class: 'muted' }, T('t.noResults'))));
  const rows = S.results.filter(r => r.runs && r.runs[S.resFilter]).map(r => ({ r, s: r.runs[S.resFilter] }))
    .sort((a, b) => (b.s.updatedAt || 0) - (a.s.updatedAt || 0));
  if (S.resFilter) {
    const done = rows.filter(x => x.s.success).length;
    const avgM = rows.length ? (rows.reduce((t, x) => t + (x.s.mistakes || []).length, 0) / rows.length) : 0;
    box.append(h('div', { class: 'kpis' }, kpi(T('t.kStudents'), rows.length), kpi(T('t.kDone'), rows.length ? done + ' / ' + rows.length : '—'), kpi(T('t.kAvgMist'), rows.length ? fmt(avgM, 1) : '—')));
  }
  if (!rows.length) box.append(h('p', { class: 'empty' }, T('t.noResultsYet')));
  else {
    const tbl = h('table', { class: 'rtable' }, h('thead', null, h('tr', null, ['t.cStudent', 't.cStatus', 't.cAttempts', 't.cRetries', 't.cMistakes', 't.cTime', 't.cUpdated'].map(k => h('th', null, T(k))))));
    const tb = h('tbody');
    for (const { r, s } of rows) {
      const open = S.openRow === r.id;
      const mk = (s.mistakes || []);
      tb.append(h('tr', { class: 'rrow' + (open ? ' open' : ''), tabindex: '0', onclick: () => { S.openRow = open ? null : r.id; render(); }, onkeydown: e => { if (e.key === 'Enter') { S.openRow = open ? null : r.id; render(); } } },
        h('td', null, h('span', { class: 'sname', 'data-uid': r.imported ? '' : r.id }, r.name || '—'), r.imported ? h('span', { class: 'chip' }, T('t.imported')) : null),
        h('td', null, h('span', { class: 'pill ' + (s.success ? 'ok' : 'wip') }, s.success ? T('st.success') : T('st.notyet'))),
        h('td', { class: 'num' }, s.attempts || 0), h('td', { class: 'num' }, s.retries || 0),
        h('td', { class: 'num' }, h('span', { class: mk.length ? 'mcount' : '' }, mk.length)),
        h('td', { class: 'num' }, mmss(s.secs || 0)), h('td', { class: 'num muted' }, new Date(s.updatedAt || r.updatedAt || 0).toLocaleString(S.lang, { dateStyle: 'short', timeStyle: 'short' }))));
      if (open) tb.append(h('tr', { class: 'detail' }, h('td', { colspan: '7' },
        mk.length ? h('ol', { class: 'mlist' }, mk.map(m => h('li', null, h('span', { class: 'mt' }, mmss(m.t || 0)), T('m.' + m.k, m.p || { f: '' })))) : h('p', { class: 'muted' }, T('t.noMistakes')))));
    }
    tbl.append(tb);
    box.append(h('div', { class: 'tblwrap' }, tbl));
  }
  const ta = h('textarea', { id: 'imp', rows: '3', placeholder: 'LAB1.…' });
  box.append(h('div', { class: 'panel' }, h('h3', null, T('t.importTitle')), h('p', { class: 'muted' }, T('t.importText')), ta,
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => importCode(ta.value) }, T('btn.import')))));
  resolveNames();
  return box;
}
const kpi = (l, v) => h('div', { class: 'kpi' }, h('span', null, l), h('strong', null, String(v)));
async function resolveNames() {
  if (!S.user) return;
  const els = [...document.querySelectorAll('.sname[data-uid]')].filter(e => e.dataset.uid);
  if (!els.length) return;
  try {
    const ps = await S.user.profiles(els.map(e => e.dataset.uid));
    for (const e of els) { const p = ps[e.dataset.uid]; if (p && p.name && !e.dataset.done) { e.dataset.done = '1'; const s = document.createElement('span'); s.className = 'acct'; s.textContent = p.name; e.after(s); } }
  } catch (e) { }
}
async function importCode(code) {
  const o = decodeReport(code); if (!o) { toast(T('t.badCode'), 'err'); return; }
  if (!S.db) return;
  const id = 'imp-' + (o.n || 'x').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) + '-' + (o.st || 0).toString(36);
  const runs = {}; runs[o.k] = { sc: o.s, attempts: o.a, retries: o.r, success: !!o.ok, secs: o.d, updatedAt: o.at, startedAt: o.st, mistakes: (o.m || []).map(m => ({ k: m[0], t: m[1], p: m[2] ? { f: m[2] } : null })) };
  const ex = S.results.find(r => r.id === id);
  const body = { name: o.n || '?', imported: true, updatedAt: Date.now(), runs: Object.assign({}, ex ? ex.runs : {}, runs) };
  try { await S.db.doc('results/' + id).set(body); toast(T('t.importedOk', { n: o.n || '?' }), 'ok'); S.resFilter = o.k; } catch (e) { toast(T('err.save'), 'err'); }
}
