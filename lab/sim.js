/* ===================== TIME-BASED SIMULATION ===================== */
let simAcc = 0, logDirty = false;
function simTick(dt) {
  const run = S.run; if (!run) return;
  if (run.jobs && run.jobs.length) {
    for (const j of run.jobs) { j.t += dt; if (j.tick) j.tick(dt, Math.min(1, j.t / j.dur)); }
    const done = run.jobs.filter(j => j.t >= j.dur); if (done.length) { run.jobs = run.jobs.filter(j => j.t < j.dur); for (const j of done) if (j.end) j.end(); refreshLog(); refreshSide(); }
  }
  if (run.vessels) for (const v of run.vessels) vesselSim(v, dt);
  if (run.scene && run.scene.tick) run.scene.tick(dt);
  if (run.comb) vesselSim(run.comb.lime, dt);
  simAcc += dt;
  if (simAcc > .4) { simAcc = 0; if (logDirty) { logDirty = false; refreshLog(); refreshSide(); } if (run.sc.id === 'neu3') drawTitCurve(); }
}
function vlog(v, key) { logE('obs', [[key]], { v: v.label, amt: '', f: '' }); logDirty = true; }
function vesselSim(v, dt) {
  const fx = vfx(v);
  const heating = v.heating && v.V > 0.02;
  if (heating) {
    const rate = (v.kind === 'tube' ? 26 : 16) / (v.V + 2.5);
    fx.T = Math.min(100, fx.T + rate * dt * (1 + (100 - fx.T) / 80));
  } else fx.T += (22 - fx.T) * (1 - Math.exp(-dt / 30));
  if (v.heating && v.V <= 0.02) { v.heating = false; return; }
  const boiling = heating && fx.T >= 99.3;
  if (boiling) {
    if (!fx.boilLog) { fx.boilLog = 1; vlog(v, 'obs.boilTube'); }
    const er = v.kind === 'tube' ? .03 : .35;
    const dV = Math.min(v.V, er * dt); v.V -= dV;
    if ((v.tot.NH3 || 0) > 0 && v.eq && v.eq.nh3free > 0.001) v.tot.NH3 *= 1 - dt * .08;
    if (v.kind === 'tube' && v.V > v.cap / 3 && Math.random() < dt * .5) {
      const loss = Math.min(v.V * .15, .6); const k = 1 - loss / v.V; for (const x in v.tot) v.tot[x] *= k; v.V -= loss; fx.spurt = .5;
      mistake('spurt'); logDirty = true;
    }
    if (v.V < 1.2 && Math.random() < dt * 3) { for (let j = 0; j < 2; j++) fx.spl.push({ x: geoFor(v).cx + rnd(-15, 15), y: geoFor(v).levelY(fx.lvl) - 1, vx: rnd(-40, 40), vy: -rnd(40, 90), life: 0 }); }
  } else fx.boilLog = fx.boilLog && fx.T > 95 ? 1 : 0;
  fx.eqAcc = (fx.eqAcc || 0) + dt;
  if (heating && fx.eqAcc > .5) { fx.eqAcc = 0; if (v.V > 0.02) { const gas = equilibrate(v); if (gas > 0.001) fx.gas += gas * 2; } }
  const p = (v.eq && v.eq.ppt) || {};
  if ((p.FeOH2 || 0) > 0.0015 && v.V > 0) {
    fx.ox = Math.min(1, fx.ox + dt / 110 * (1 + Math.max(0, fx.T - 22) / 12) * (1 + fx.wave * 3));
    if (fx.ox > .3 && !fx.oxL1) { fx.oxL1 = 1; vlog(v, 'obs.feOx1'); }
    if (fx.ox > .85 && !fx.oxL2) { fx.oxL2 = 1; vlog(v, 'obs.feOx2'); }
  }
  if ((p.CuOH2 || 0) > 0.0015 && fx.T > 70) {
    fx.cuo = Math.min(1, fx.cuo + dt / 9 * ((fx.T - 70) / 30));
    if (fx.cuo > .35 && !fx.cuoL) { fx.cuoL = 1; vlog(v, 'obs.cuo'); }
  }
  if (heating && fx.T > 50 && v.eq && v.eq.nh3free > 0.002 && !fx.nh3L) { fx.nh3L = 1; vlog(v, 'obs.nh3smell'); }
  if (boiling && v.V <= 0.03) { v.V = 0; v.heating = false; evapFinish(v); logDirty = true; }
}
const geoFor = v => geo(v.kind, 0, 0);
function updateVesselLabels() {
  const run = S.run; if (!run || !run.vessels) return;
  run.vessels.forEach((v, i) => {
    const el = document.querySelector(`[data-vv="${i}"]`); if (!el) return;
    const T = vfx(v).T;
    el.textContent = (v.V > 0.01 ? fmt(v.V, v.V < 10 ? 2 : 1) + ' mL' : (v.residue ? T_('v.residue') : T_('v.empty'))) + (T > 30 ? ' · ' + Math.round(T) + ' °C' : '');
    const m = document.querySelector(`[data-vm="${i}"]`); if (m && v.eq) m.textContent = 'pH ' + fmt(v.eq.pH, 2);
  });
}
const T_ = k => T(k);
function refreshLog() {
  const nb = document.querySelector('.notebook'); if (!nb || !S.run) return;
  nb.replaceWith(renderNotebook()); const e = document.querySelector('.notebook .entries'); if (e) e.scrollTop = e.scrollHeight;
  const c = document.querySelector('.counters'); if (c) c.replaceWith(h('div', { class: 'counters' }, counter(T('c.attempts'), S.run.attempts), counter(T('c.retries'), S.run.retries), counter(T('c.mistakes'), S.run.mistakes.length, S.run.mistakes.length ? 'warn' : '')));
}
function addJob(run, j) { run.jobs = run.jobs || []; j.t = 0; run.jobs.push(j); }
const busy = run => run.jobs && run.jobs.length;

