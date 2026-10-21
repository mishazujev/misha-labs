/* ===================== LAB VIEW ===================== */
function renderLab() {
  const run = S.run, sc = run.sc;
  const root = h('div', { class: 'lab k-' + sc.kind });
  root.append(h('div', { class: 'labbar' },
    h('button', { class: 'btn ghost', onclick: leaveLab }, '← ', T('btn.back')),
    h('div', { class: 'labtitle' }, h('span', { class: 'chip lvl' }, T('lvl.' + sc.level)), h('span', { class: 'topicname' }, T('topic.' + sc.topic))),
    h('div', { class: 'counters' },
      counter(T('c.attempts'), run.attempts), counter(T('c.retries'), run.retries), counter(T('c.mistakes'), run.mistakes.length, run.mistakes.length ? 'warn' : ''))));
  const grid = h('div', { class: 'labgrid' });
  grid.append(renderTask());
  const mid = h('div', { class: 'benchcol' });
  mid.append(h('p', { class: 'draghint' }, T('tip.drag')));
  if (sc.kind === 'bench') mid.append(renderBench());
  if (sc.kind === 'distill') mid.append(renderDistill());
  if (sc.kind === 'combust') mid.append(renderCombust());
  if (sc.kind === 'analysis') mid.append(renderAnalysis());
  mid.append(renderNotebook());
  grid.append(mid);
  root.append(grid);
  return root;
}
const counter = (l, v, c) => h('div', { class: 'counter ' + (c || '') }, h('strong', null, String(v)), h('span', null, l));
function renderGoggles() {
  const run = S.run;
  return h('button', { class: 'goggles' + (run.goggles ? ' on' : ''), 'aria-pressed': run.goggles ? 'true' : 'false', onclick: () => { run.goggles = !run.goggles; logE('info', [[run.goggles ? 'log.gogOn' : 'log.gogOff']]); render(); } },
    h('span', { html: gogglesSVG(run.goggles) }), h('span', null, run.goggles ? T('gog.on') : T('gog.off')));
}

function renderTask() {
  const run = S.run, sc = run.sc;
  const p = h('aside', { class: 'task' });
  p.append(h('h1', null, T('sc.' + sc.id + '.title')));
  p.append(h('p', { class: 'goal' }, T('sc.' + sc.id + '.goal')));
  const steps = T('sc.' + sc.id + '.steps').split('|');
  p.append(h('ol', { class: 'steps' }, steps.map(s => h('li', null, s))));
  if (sc.id === 'neu3') p.append(h('div', { class: 'curvebox' }, h('div', { class: 'cap' }, T('lbl.curve')), h('canvas', { id: 'titc', width: '320', height: '180' })));
  if (run.attempts >= 2 && !run.solvedNow) p.append(h('div', { class: 'hint' }, h('strong', null, T('lbl.hint')), ' ', T('sc.' + sc.id + '.hint')));
  // answer form
  const fields = sc.fields(run);
  const form = h('form', { class: 'answer', onsubmit: e => { e.preventDefault(); submit(); } });
  form.append(h('h2', null, T('lbl.answer')));
  if (sc.id === 'org3') form.append(h('p', { class: 'muted' }, T('ans.formula')));
  const fg = h('div', { class: 'fields' + (sc.id === 'org3' ? ' inline' : '') });
  for (const f of fields) {
    const id = 'f_' + f.id; const bad = run.wrong.includes(f.id);
    const val = run.answers[f.id];
    let ctl;
    if (f.type === 'select') {
      ctl = h('select', { id, onchange: e => { run.answers[f.id] = e.target.value; } }, h('option', { value: '' }, '—'), f.options.map(([v, l]) => h('option', { value: v, selected: val === v ? true : null }, Lbl(l))));
    } else if (f.type === 'number') {
      ctl = h('input', { id, type: 'text', inputmode: 'decimal', value: val || '', class: f.small ? 'small' : '', oninput: e => { run.answers[f.id] = e.target.value.trim(); } });
    } else if (f.type === 'checks') {
      ctl = h('div', { class: 'checks', id }, f.options.map(([v, l]) => h('label', { class: 'cbx' }, h('input', { type: 'checkbox', id: id + '_' + v, checked: (val || []).includes(v) ? true : null, onchange: e => {
        const arr = new Set(run.answers[f.id] || []); e.target.checked ? arr.add(v) : arr.delete(v); run.answers[f.id] = [...arr]; } }), h('span', null, Lbl(l)))));
    }
    fg.append(h('div', { class: 'field' + (bad ? ' bad' : '') }, h('label', { for: id }, Lbl(f.label), f.unit ? h('span', { class: 'unit' }, ' (' + f.unit + ')') : null), ctl));
  }
  if (fields.length) form.append(fg); else form.append(h('p', { class: 'muted' }, T('ans.auto')));
  const otherWrong = run.wrong.filter(w => w[0] === '_');
  if (otherWrong.length) form.append(h('ul', { class: 'whylist' }, otherWrong.map(w => h('li', null, T('why.' + w.slice(1))))));
  form.append(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, T('btn.submit'))));
  p.append(form);
  if (run.solvedNow) p.append(h('div', { class: 'success' }, h('strong', null, T('succ.title')), h('p', null, T('succ.text', { a: run.attempts, m: run.mistakes.length })),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { run.solvedNow = false; startOver(); } }, T('btn.again')), h('button', { class: 'btn primary', onclick: leaveLab }, T('btn.finish')))));
  // retry
  p.append(S.resetConfirm
    ? h('div', { class: 'confirm' }, T('tip.resetSure'), h('button', { class: 'btn small danger', onclick: startOver }, T('btn.startOver')), h('button', { class: 'btn small', onclick: () => { S.resetConfirm = false; render(); } }, T('btn.cancel')))
    : h('button', { class: 'btn ghost', onclick: () => { S.resetConfirm = true; render(); } }, '↺ ', T('btn.startOver')));
  if (!S.owner && (!S.db || !S.canSave)) {
    const code = reportCode();
    const ta = h('textarea', { readonly: true, rows: '3', class: 'code', id: 'rcode' }, code);
    p.append(h('div', { class: 'panel report' }, h('h3', null, T('rep.title')), h('p', { class: 'muted' }, T('rep.text')), ta,
      h('button', { class: 'btn small', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(code).then(() => toast(T('rep.copied'), 'ok'), () => { ta.select(); }); if (!navigator.clipboard) ta.select(); } }, T('btn.copy'))));
  }
  return p;
}

/* ---------- bench ---------- */
function renderBench() {
  const run = S.run; const sc = benchScene(run);
  const b = h('section', { class: 'bench scenewrap' }, sceneEl(sc));
  return b;
}
function renderReading(r) {
  if (r.kind === 'paper') {
    const chart = h('div', { class: 'phchart' }, Array.from({ length: 14 }, (_, i) => { const c = indColor('univ', i + 1).rgb; return h('span', { style: `background:${css(c, 1)}` }, String(i + 1)); }));
    return h('div', { class: 'reading' }, h('span', null, T('read.paper', { v: r.v })), h('span', { class: 'strip', style: `background:${css(r.rgb, 1)}` }), chart);
  }
  if (r.kind === 'litmus') {
    const red = r.pH > 8.3 ? '#2E5FA8' : '#C0392B', blue = r.pH < 5 ? '#C0392B' : '#2E5FA8';
    return h('div', { class: 'reading' }, h('span', null, T('read.litmus', { v: r.v })), h('span', { class: 'strip', style: `background:${red}` }), h('small', null, T('read.redLit')), h('span', { class: 'strip', style: `background:${blue}` }), h('small', null, T('read.blueLit')));
  }
  if (r.kind === 'meter') return h('div', { class: 'reading' }, h('span', null, T('read.meter', { v: r.v })), h('strong', { class: 'lcd' }, fmt(r.val, 2)));
}
function renderNotebook() {
  const run = S.run;
  const nb = h('section', { class: 'notebook' }, h('h2', null, T('lbl.notebook')));
  const ent = h('ol', { class: 'entries' });
  for (const e of run.log.slice(-120)) {
    const txt = e.parts.map(([k, p]) => T(k, p)).join(' ');
    ent.append(h('li', { class: 'e-' + e.type }, h('span', { class: 'lt' }, mmss(e.t)),
      e.head ? h('span', { class: 'lh' }, '[' + e.head.v + '] ' + (e.head.amt ? '+ ' + e.head.amt + ' ' : '') + (e.head.f ? e.head.f + ' → ' : '')) : null, h('span', null, txt)));
  }
  nb.append(ent);
  return nb;
}

/* ---------- titration curve ---------- */
function tokens() { const cs = getComputedStyle(document.documentElement); const g = n => cs.getPropertyValue(n).trim(); return { ink: g('--ink'), muted: g('--muted'), line: g('--line'), accent: g('--accent'), amber: g('--amber') }; }
function drawAxes(ctx, W, H, pad, xMax, yMin, yMax, xl, yl, tk, yStep) {
  ctx.clearRect(0, 0, W, H); ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = tk.muted; ctx.strokeStyle = tk.line; ctx.lineWidth = 1;
  for (let y = yMin; y <= yMax; y += yStep) { const py = H - pad.b - (y - yMin) / (yMax - yMin) * (H - pad.t - pad.b); ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(W - pad.r, py); ctx.stroke(); ctx.fillText(String(y), 4, py + 3); }
  const xs = xMax <= 20 ? 5 : 10;
  for (let x = 0; x <= xMax; x += xs) { const px = pad.l + x / xMax * (W - pad.l - pad.r); ctx.fillText(String(x), px - 4, H - pad.b + 13); }
  ctx.fillText(xl, W - pad.r - ctx.measureText(xl).width, H - 2); ctx.fillText(yl, pad.l + 2, 10);
}
function drawTitCurve() {
  const cv = document.getElementById('titc'); if (!cv) return;
  const run = S.run; const v = run.vessels.find(x => x.meter) || run.focus || run.vessels[0]; const pts = (v.curve || []).slice().sort((a, b) => a[0] - b[0]);
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = { l: 24, r: 8, t: 14, b: 22 }, tk = tokens();
  const xMax = Math.max(20, Math.ceil(((pts.length ? pts[pts.length - 1][0] : 0) + 1) / 5) * 5);
  drawAxes(ctx, W, H, pad, xMax, 0, 14, 'V(NaOH), mL', 'pH', tk, 2);
  if (!pts.length) { ctx.fillStyle = tk.muted; ctx.fillText(T('lbl.curveEmpty'), pad.l + 10, H / 2); return; }
  const X = x => pad.l + x / xMax * (W - pad.l - pad.r), Y = y => H - pad.b - y / 14 * (H - pad.t - pad.b);
  ctx.strokeStyle = tk.accent; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
  ctx.fillStyle = tk.accent; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), 2, 0, 7); ctx.fill(); }
}

/* ---------- distillation ---------- */
let simTimer = null;
function stopSim() { if (simTimer) { clearInterval(simTimer); simTimer = null; } }
function distTick() {
  const run = S.run; if (!run || !run.dist) return stopSim();
  const d = run.dist; if (!d.heating) return;
  const dt = 0.1 * d.speed;
  for (let step = 0; step < 4; step++) distStep(run, d, dt / 4);
  if (Math.round(d.t) % 2 === 0) { const vtot = d.rec.reduce((s, r) => s + mixVol(r.nE, r.nW), 0); const last = d.curve[d.curve.length - 1]; if (!last || vtot - last[0] > 0.05 || d.t - last[2] > 5) d.curve.push([vtot, d.Tth, d.t]); }
  updateDistill();
}
function distStep(run, d, dt) {
  const n = d.nE + d.nW; if (n <= 0) { d.heating = false; return; }
  const x = d.nE / n;
  let [y, bp] = vle(x);
  let Ttop = bp;
  if (d.column) { let yy = y, xl = x; for (let i = 0; i < 2; i++) { xl = yy; [yy] = vle(xl); } Ttop = vle(xl)[1]; y = yy; }
  const P = !d.src ? 0 : d.src === 'burner' ? 110 : d.src === 'mantle' ? 60 : Math.max(0, 2.4 * (99.5 - d.T));
  const C = d.nE * 112 + d.nW * 75.3 + 60;
  let boiling = false;
  d.rateMl = 0; d.escMl = 0;
  if (d.T < bp - 0.01) { d.T = Math.min(bp, d.T + P * dt / C); d.ring = Math.max(0, (d.ring || 0) - dt * .01); }
  else {
    boiling = true; d.T = bp;
    if (!d.boilT) { d.boilT = d.t; logE('obs', [['obs.boil', { t: fmt(bp, 1) }]]); }
    const prevRing = d.ring || 0;
    d.ring = Math.min(1.3, prevRing + dt * (P / 60) * (d.column ? .011 : .02));
    if (prevRing < .05 && d.ring >= .05) logE('obs', [['obs.ring']]);
    if (prevRing < 1 && d.ring >= 1) logE('obs', [['obs.vapThermo']]);
    if (prevRing < 1 && d.ring >= 1) { if (d.thermo === 'liquid') mistake('thermoLiquid'); else if (d.thermo === 'above') mistake('thermoHigh'); else if (d.thermo === 'below') mistake('thermoLow'); }
    if (d.ring < 1.1) { d.Tth += ((d.thermo === 'liquid' ? d.T : 20 + d.ring * 6) - d.Tth) * Math.min(1, dt * .2); d.t += dt; d.boiling = true; return; }
    if (prevRing < 1.1 && d.ring >= 1.1) logE('obs', [['obs.firstDrops']]);
    const Hv = x * 38600 + (1 - x) * 40700;
    let dn = P * dt / Hv * (d.column ? 0.7 : 1);
    let dE = Math.min(d.nE, dn * y), dW = Math.min(d.nW, dn * (1 - y));
    d.nE -= dE; d.nW -= dW;
    const eff = !d.tap || !d.water ? 0.1 : d.water === 'top' ? 0.55 : 1;
    const r = d.cur >= 0 ? d.rec[d.cur] : null; if (r) { r.nE += dE * eff; r.nW += dW * eff; } else mistake('noReceiver');
    d.rateMl = mixVol(dE, dW) * eff / dt; d.escMl = mixVol(dE, dW) * (1 - eff) / dt;
    if (!d.tap || !d.water) mistake('waterOff');
    else if (d.water === 'top') mistake('condenserTop');
    if (eff < 1 && d.src === 'burner') { d.esc = (d.esc || 0) + (dE + dW) * (1 - eff); if (d.esc > 0.004) { d.fire = true; d.heating = false; mistake('fire', null, false); logE('mistake', [['obs.fire']]); stopSim(); render(); return; } }
    if (!d.chips && !d.bumped && d.t - d.boilT > 8 && Math.random() < 0.05 * dt) {
      d.bumped = true; const mv = 3 / mixVol(d.nE, d.nW); const bE = d.nE * mv, bW = d.nW * mv; d.nE -= bE; d.nW -= bW; r.nE += bE; r.nW += bW;
      mistake('noChips', null, false); logE('mistake', [['obs.bump']]); d.bumpFx = .4; logDirty = true;
    }
    if (mixVol(d.nE, d.nW) < 4) { d.heating = false; mistake('dryness', null, false); stopSim(); logDirty = true; return; }
  }
  d.boiling = boiling;
  // thermometer
  if (d.thermo === 'liquid') d.Tth = d.T;
  else { const target = boiling && d.ring >= 1 ? Ttop + (d.thermo === 'below' ? 2.5 : d.thermo === 'above' ? -9 : 0) : Math.max(20, 20 + (d.ring || 0) * 6); d.Tth += (target - d.Tth) * Math.min(1, dt * (boiling ? 0.25 : 0.05)); }
  d.t += dt;
}
function renderDistill() {
  const run = S.run, d = run.dist; const sc = distScene2(run);
  const sec = h('section', { class: 'bench scenewrap' }, sceneEl(sc));
  sec.append(h('div', { class: 'distctrl' }, h('div', { class: 'seg', role: 'group', 'aria-label': T('lbl.speed') }, h('span', null, T('lbl.speed')), [1, 10, 30].map(sp => h('button', { class: 'amt' + (d.speed === sp ? ' on' : ''), onclick: () => { d.speed = sp; render(); } }, '×' + sp)))));
  sec.append(h('div', { class: 'distgrid' }, h('div', { id: 'sideinfo' }, renderSideInfo()), h('div', { class: 'curvebox' }, h('div', { class: 'cap' }, T('lbl.distCurve')), h('canvas', { id: 'distc', width: '360', height: '170' }))));
  if (d.fire) sec.append(h('p', { class: 'notice err' }, T('obs.fireOut')));
  return sec;
}
function renderSideInfo() {
  const run = S.run;
  if (run.dist) return renderRecs();
  if (run.an) { const a = run.an; const rows = [['cacl2', 'CaCl₂'], ['naoh', 'NaOH']];
    const tbl = h('table', { class: 'rtable mtable' }, h('thead', null, h('tr', null, [T('an.tube'), T('an.before'), T('an.after'), 'Δm'].map(x => h('th', null, x)))));
    const tb = h('tbody'); for (const [id, nm] of rows) { const b = a.w0 ? a.w0[id] : null, af = a.w1 ? a.w1[id] : null; tb.append(h('tr', null, h('td', null, nm), h('td', { class: 'num' }, b != null ? fmt(b, 4) + ' g' : '—'), h('td', { class: 'num' }, af != null ? fmt(af, 4) + ' g' : '—'), h('td', { class: 'num' }, b != null && af != null ? fmt(af - b, 4) + ' g' : '—'))); }
    tbl.append(tb); return h('div', { class: 'tblwrap' }, tbl); }
  return h('div');
}
function refreshSide() { const el = document.getElementById('sideinfo'); if (el) el.replaceChildren(renderSideInfo()); }
function renderRecs() {
  const d = S.run.dist;
  return h('div', { class: 'recs' }, d.rec.map((r, i) => h('div', { class: 'rec' + (d.cur === i ? ' cur' : '') },
    h('strong', null, 'R' + (i + 1)), h('span', { class: 'mono' }, fmt(mixVol(r.nE, r.nW), 1) + ' mL'),
    h('span', { class: 'muted small' }, T('lbl.alcoholReading')), h('span', { class: 'mono' }, d.measured[i] != null ? fmt(d.measured[i], 0) + ' % v/v' : '—'), h('span', { class: 'muted small' }, d.burned[i] ? '🔥 ' + T('w.tested') : ''))));
}
function measureRec(i) {
  const d = S.run.dist, r = d.rec[i]; const v = mixVol(r.nE, r.nW);
  if (v < 2) { toast(T('tip.tooLittle'), 'err'); return false; }
  d.measured[i] = Math.round(volPct(r.nE, r.nW) + (Math.random() - .5) * 2);
  logE('obs', [['obs.measure', { r: 'R' + (i + 1), p: d.measured[i] }]]); logDirty = true; refreshSide();
  return true;
}
function burnRec(i) {
  const d = S.run.dist, r = d.rec[i]; const v = mixVol(r.nE, r.nW);
  if (v < 1) { toast(T('tip.tooLittle'), 'err'); return; }
  const pct = volPct(r.nE, r.nW); d.burned[i] = true;
  const take = Math.min(1, 0.5 / v); r.nE *= 1 - take; r.nW *= 1 - take;
  logE('obs', [[pct >= 50 ? 'obs.burnYes' : 'obs.burnNo', { r: 'R' + (i + 1) }]]); logDirty = true; refreshSide();
}
function updateDistill() {
  const t = performance.now(); if (S.run._ud && t - S.run._ud < 400) return; S.run._ud = t;
  refreshSide(); drawDistCurve();
}
function drawDistCurve() {
  const cv = document.getElementById('distc'); if (!cv || !S.run.dist) return;
  const pts = S.run.dist.curve; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = { l: 26, r: 8, t: 14, b: 22 }, tk = tokens();
  const xMax = Math.max(20, Math.ceil(((pts.length ? pts[pts.length - 1][0] : 0) + 1) / 10) * 10);
  drawAxes(ctx, W, H, pad, xMax, 20, 100, T('lbl.distVol'), '°C', tk, 20);
  if (!pts.length) return;
  const X = x => pad.l + x / xMax * (W - pad.l - pad.r), Y = y => H - pad.b - (y - 20) / 80 * (H - pad.t - pad.b);
  ctx.strokeStyle = tk.amber; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = tk.muted; ctx.beginPath(); ctx.moveTo(pad.l, Y(78.3)); ctx.lineTo(W - pad.r, Y(78.3)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = tk.muted; ctx.fillText('78 °C', W - pad.r - 36, Y(78.3) - 3);
}

/* ---------- combustion (org1) ---------- */
function renderCombust() {
  const sc = combScene2(S.run);
  return h('section', { class: 'bench scenewrap' }, sceneEl(sc));
}
function renderAnalysis() {
  const run = S.run, s = run.secret; const sc = anScene2(run);
  const sec = h('section', { class: 'bench analysis' });
  sec.append(h('div', { class: 'given' },
    h('div', { class: 'kpi' }, h('span', null, T('an.sample')), h('strong', { class: 'mono' }, fmt(s.m, 4) + ' g')),
    h('div', { class: 'kpi' }, h('span', null, T('an.M')), h('strong', { class: 'mono' }, fmt(s.M, 1) + ' g/mol')),
    h('div', { class: 'kpi' }, h('span', null, T('an.elements')), h('strong', null, 'C, H, O?'))));
  sec.append(h('div', { class: 'scenewrap' }, sceneEl(sc)));
  sec.append(h('div', { id: 'sideinfo' }, renderSideInfo()));
  return sec;
}

/* ===================== BOOT ===================== */
function pickLang() {
  const saved = LS.get('lab.lang'); if (saved && I18N[saved]) return saved;
  const n = (navigator.language || 'en').slice(0, 2); return n === 'et' ? 'et' : n === 'uk' ? 'uk' : n === 'ru' ? 'ru' : 'en';
}
async function boot() {
  S.lang = pickLang(); S.name = LS.get('lab.name') || '';
  const sel = document.getElementById('lang');
  sel.addEventListener('change', e => { S.lang = e.target.value; LS.set('lab.lang', S.lang); render(); });
  render();
  const cl = window.claude;
  if (!cl || !cl.use) { S.dbReady = true; S.db = null; render(); return; }
  try { S.user = await cl.use('user'); } catch (e) { S.user = null; }
  try { S.db = await cl.use('db'); } catch (e) { S.db = null; }
  if (S.user) {
    try { const me = await S.user.me(); S.owner = !!me.isOwner; S.uid = me.id; S.profileName = me.name || ''; if (!S.name && S.profileName) { S.name = S.profileName; } } catch (e) { }
  }
  if (S.db) {
    S.db.collection('assignments').onSnapshot(snap => {
      S.assignments = snap.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      S.dbReady = true; if (S.view === 'home') render();
    }, () => { S.dbReady = true; render(); });
    S.db.doc('settings/main').onSnapshot(d => { if (d.exists) S.settings = Object.assign({ practice: true }, d.data()); if (S.view === 'home') render(); }, () => { });
    if (S.owner) {
      S.db.collection('results').onSnapshot(snap => { S.results = snap.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data())); if (S.view === 'home') render(); }, () => { });
    } else if (S.uid) {
      S.db.doc('results/' + S.uid).onSnapshot(d => { if (d.exists) { const data = d.data(); const runs = data.runs || {}; for (const k in runs) if (!S.myRuns[k] || (runs[k].updatedAt || 0) > (S.myRuns[k].updatedAt || 0)) S.myRuns[k] = runs[k]; if (!S.name && data.name) S.name = data.name; } if (S.view === 'home') render(); }, () => { });
    } else S.canSave = false;
    try { if (S.user && !S.owner) { const c = await S.user.can('data.write'); if (c === false) { /* own subtree rule may still allow; test on first save */ } } } catch (e) { }
  } else { S.dbReady = true; S.canSave = false; }
  setTimeout(() => { S.dbReady = true; if (S.view === 'home') render(); }, 4000);
  render();
}
document.addEventListener('DOMContentLoaded', boot);
requestAnimationFrame(fxLoop);
