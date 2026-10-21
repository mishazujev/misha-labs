/* ===================== DRAG-AND-DROP SCENES ===================== */
const isWide = () => (window.innerWidth || 1000) > 760;
function hitObj(sc, p) {
  const list = sc.objs.filter(o => !o.held && !o.hidden && o.hit).sort((a, b) => (b.z || 0) - (a.z || 0));
  for (const o of list) if (o.hit(p.x, p.y)) return o;
  return null;
}
const inRect = (px, py, x0, y0, x1, y1) => px >= x0 && px <= x1 && py >= y0 && py <= y1;
function releaseHeld(sc) { if (sc.held) { const o = sc.held.o; sc.held = null; o.held = false; if (o.drop) o.drop(); if (!o.stay) o.returning = true; if (o.dispose) sc.objs = sc.objs.filter(x => x !== o); } }
function sceneEl(sc) {
  releaseHeld(sc);
  const el = fxCanvas(sc.W, sc.H, (ctx, w, h, dt, t) => sceneFrame(sc, ctx, dt, t), 'scene drag');
  el.style.width = '100%'; el.style.maxWidth = (sc.maxCss || sc.W) + 'px'; el.style.touchAction = 'none';
  el.setAttribute('role', 'application'); el.setAttribute('aria-label', T('lbl.bench'));
  const map = e => { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * sc.W / r.width, y: (e.clientY - r.top) * sc.H / r.height }; };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { }
    const p = map(e); sc.ptr = p; sc.down = { x: p.x, y: p.y, moved: false };
    const o = hitObj(sc, p);
    if (o && (o.drag || o.tap)) {
      if (o.drag && o.tap) sc.pending = { o, p };
      else if (o.drag) startHold(sc, o, p);
      else sc.tapObj = o;
    }
  });
  el.addEventListener('pointermove', e => {
    if (sc.down || sc.held || sc.pending || sc.tapObj) e.preventDefault();
    const p = map(e); sc.ptr = p;
    if (sc.down && Math.hypot(p.x - sc.down.x, p.y - sc.down.y) > 6) sc.down.moved = true;
    if (sc.pending && sc.down && sc.down.moved) { const q = sc.pending; sc.pending = null; startHold(sc, q.o, q.p); }
    if (sc.held) { const o = sc.held.o; let nx = p.x + sc.held.dx, ny = p.y + sc.held.dy; if (o.constrain) [nx, ny] = o.constrain(nx, ny); o.x = clamp(nx, 0, sc.W); o.y = clamp(ny, 0, sc.H); }
    else { sc.hover = hitObj(sc, p); el.style.cursor = sc.hover ? (sc.hover.drag ? 'grab' : 'pointer') : 'default'; }
  });
  const up = () => {
    if (sc.held) { const o = sc.held.o; if (sc.down && !sc.down.moved && o.tap) { sc.held = null; o.held = false; o.tap(); if (!o.stay) o.returning = true; } else releaseHeld(sc); }
    else if (sc.pending) { const o = sc.pending.o; sc.pending = null; o.tap(); }
    else if (sc.tapObj) { if (!sc.down || !sc.down.moved) sc.tapObj.tap(); sc.tapObj = null; }
    sc.down = null;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { if (!sc.held) sc.hover = null; });
  return el;
}
function startHold(sc, o, p) {
  const r = o.pick ? o.pick(p) : o;
  if (r) { sc.held = { o: r, dx: r.x - p.x, dy: r.y - p.y }; r.held = true; r.returning = false; if (!sc.objs.includes(r)) sc.objs.push(r); sc.hover = null; }
}
function sceneFrame(sc, ctx, dt, t) {
  if (sc.update) sc.update(dt, t);
  for (const o of sc.objs) {
    if (o.held && o.hold) o.hold(dt, t);
    if (o.returning && !o.held) { const k = 1 - Math.exp(-dt * 12); o.x += (o.hx - o.x) * k; o.y += (o.hy - o.y) * k; if (Math.hypot(o.hx - o.x, o.hy - o.y) < .5) { o.x = o.hx; o.y = o.hy; o.returning = false; } }
    if (!o.held && o.ang) o.ang = Math.max(0, o.ang - dt * 220);
  }
  sc.bg(ctx, dt, t);
  const list = sc.objs.filter(o => !o.hidden).sort((a, b) => (a.held ? 1 : 0) - (b.held ? 1 : 0) || (a.z || 0) - (b.z || 0));
  for (const o of list) { ctx.save(); o.draw(ctx, dt, t); ctx.restore(); }
  if (sc.fg) sc.fg(ctx, dt, t);
  // hover outline + label
  const Tk = tok();
  const lab = sc.held ? sc.held.o : sc.hover;
  if (lab && lab.label) {
    const txt = lab.label(); if (txt) {
      ctx.font = '500 13px "IBM Plex Sans", sans-serif'; const w = ctx.measureText(txt).width + 18;
      let x = sc.held ? sc.W / 2 - w / 2 : clamp(sc.ptr.x + 14, 4, sc.W - w - 4), y = sc.held ? 8 : clamp(sc.ptr.y + 16, 4, sc.H - 30);
      ctx.fillStyle = Tk.dark ? 'rgba(20,28,26,.92)' : 'rgba(255,255,255,.95)'; ctx.strokeStyle = Tk.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(x, y, w, 26); ctx.fill(); ctx.stroke(); ctx.fillStyle = Tk.ink; ctx.fillText(txt, x + 9, y + 17);
    }
  }
}

/* ---------- shared drawing ---------- */
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function bottleBody(ctx, w, h) { // local frame: spout at (0,0), body below
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-6, 14); ctx.quadraticCurveTo(-w / 2, 18, -w / 2, 28); ctx.lineTo(-w / 2, h - 4); ctx.quadraticCurveTo(-w / 2, h, -w / 2 + 4, h); ctx.lineTo(w / 2 - 4, h); ctx.quadraticCurveTo(w / 2, h, w / 2, h - 4); ctx.lineTo(w / 2, 28); ctx.quadraticCurveTo(w / 2, 18, 6, 14); ctx.lineTo(6, 0); ctx.closePath();
}
function drawBottle(ctx, b, x, y, ang, held, opts) {
  opts = opts || {}; const Tk = tok();
  const w = opts.w || 40, hh = opts.h || 90; const brown = b.id === 'AgNO3' || b.secret === 'AgNO3';
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang * Math.PI / 180);
  // shadow on shelf when upright
  bottleBody(ctx, w, hh);
  ctx.fillStyle = brown ? 'rgba(120,70,25,.45)' : (Tk.dark ? 'rgba(170,205,220,.1)' : 'rgba(230,242,246,.75)'); ctx.fill();
  // liquid, level in world space
  if (!opts.empty) {
    ctx.save(); bottleBody(ctx, w, hh); ctx.clip();
    const a = ang * Math.PI / 180; ctx.rotate(a);
    const [lx, ly] = rot(0, hh * .45 - Math.sin(a) * hh * .32, -a);
    ctx.fillStyle = rgba(opts.rgb || [195, 222, 238], brown ? .55 : .6); ctx.fillRect(-200, ly, 400, 400);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-200, ly); ctx.lineTo(200, ly); ctx.stroke();
    ctx.restore();
  }
  bottleBody(ctx, w, hh); ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-w / 2 + 4, 30, 4, hh - 40);
  // label
  ctx.fillStyle = Tk.dark ? '#E9EEEC' : '#FFFFFF'; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-w / 2 + 3, hh * .48, w - 6, hh * .3); ctx.strokeRect(-w / 2 + 3, hh * .48, w - 6, hh * .3);
  ctx.fillStyle = '#1B2622'; ctx.textAlign = 'center';
  if (b.k === 'unk') { ctx.font = '700 18px "Unbounded", sans-serif'; ctx.fillText(b.f, 0, hh * .48 + hh * .23); }
  else { const txt = b.burette ? 'NaOH' : b.f; ctx.font = `500 ${txt.length > 6 ? 8.5 : 10.5}px "IBM Plex Mono", monospace`; ctx.fillText(txt, 0, hh * .48 + hh * .19); }
  ctx.textAlign = 'left';
  if (!held && !opts.noCap) { ctx.fillStyle = b.k === 'acid' ? '#B5403A' : b.k === 'base' ? '#2F62A8' : b.k === 'unk' ? '#B5620C' : '#6C7773'; ctx.fillRect(-8, -7, 16, 9); }
  ctx.restore();
}
function drawDropper(ctx, x, y, rgb, squeeze, full) { // tip at (x,y)
  const Tk = tok();
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = Tk.dark ? 'rgba(200,225,235,.25)' : 'rgba(230,242,246,.9)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(-4, -14); ctx.lineTo(-4, -48); ctx.lineTo(4, -48); ctx.lineTo(4, -14); ctx.lineTo(1.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (full > 0) { ctx.fillStyle = rgba(rgb, .8); ctx.fillRect(-3, -14 - 30 * full, 6, 30 * full); }
  const sq = 1 - squeeze * .35;
  ctx.fillStyle = '#9C3A3A'; ctx.beginPath(); ctx.ellipse(0, -60, 8 * (2 - sq) * .55, 13 * sq, 0, 0, 7); ctx.fill(); ctx.fillRect(-5, -50, 10, 4);
  ctx.restore();
}
function drawPipette(ctx, x, y, rgb, frac) { // volumetric pipette, tip at (x,y)
  const Tk = tok();
  ctx.save(); ctx.translate(x, y); ctx.scale(.8, .8);
  ctx.fillStyle = Tk.dark ? 'rgba(200,225,235,.2)' : 'rgba(235,245,248,.9)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(-2.5, -50); ctx.lineTo(-7, -62); ctx.lineTo(-7, -100); ctx.lineTo(-2.5, -112); ctx.lineTo(-2.5, -170); ctx.lineTo(2.5, -170); ctx.lineTo(2.5, -112); ctx.lineTo(7, -100); ctx.lineTo(7, -62); ctx.lineTo(2.5, -50); ctx.lineTo(1.2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (frac > 0) { ctx.fillStyle = rgba(rgb, .7); const top = -10 - frac * 140; ctx.save(); ctx.clip(); ctx.fillRect(-8, top, 16, -top); ctx.restore(); }
  ctx.strokeStyle = '#C0392B'; ctx.beginPath(); ctx.moveTo(-4, -150); ctx.lineTo(4, -150); ctx.stroke();
  ctx.fillStyle = '#4B6C9E'; ctx.beginPath(); ctx.ellipse(0, -182, 7, 12, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawStream(ctx, x0, y0, x1, y1, rgb, w) {
  const wob = Math.sin(performance.now() / 33) * .8;
  ctx.fillStyle = rgba(rgb, .6); ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.quadraticCurveTo(x0 - w * .6 + wob, (y0 + y1) / 2, x1 - w * .45, y1); ctx.lineTo(x1 + w * .45, y1); ctx.quadraticCurveTo(x0 + w * .6 + wob, (y0 + y1) / 2, x0 + w, y0); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x0 - w * .3, y0); ctx.lineTo(x1 - w * .2 + wob, y1); ctx.stroke();
}
function drawDropShape(ctx, x, y, rgb) { ctx.fillStyle = rgba(rgb, .85); ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + 2.6, y + 1, x, y + 2.4); ctx.quadraticCurveTo(x - 2.6, y + 1, x, y - 4); ctx.fill(); }
function drawGoggles(ctx, x, y, s, worn) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = worn ? tok().accent : tok().ink; ctx.lineWidth = 2.5; ctx.fillStyle = worn ? 'rgba(76,187,172,.25)' : 'rgba(160,200,220,.3)';
  ctx.beginPath(); ctx.moveTo(-28, -4); ctx.quadraticCurveTo(-28, -10, -20, -10); ctx.lineTo(20, -10); ctx.quadraticCurveTo(28, -10, 28, -4); ctx.lineTo(28, 4); ctx.quadraticCurveTo(28, 10, 20, 10); ctx.lineTo(8, 10); ctx.quadraticCurveTo(4, 10, 2, 5); ctx.quadraticCurveTo(0, 2, -2, 5); ctx.quadraticCurveTo(-4, 10, -8, 10); ctx.lineTo(-20, 10); ctx.quadraticCurveTo(-28, 10, -28, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#3C4A45'; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-36, 0); ctx.moveTo(28, 0); ctx.lineTo(36, 0); ctx.stroke();
  ctx.restore();
}
function wallAndBench(ctx, W, H, benchY) {
  const Tk = tok();
  ctx.fillStyle = Tk.dark ? '#121A18' : '#E3EAE7'; ctx.fillRect(0, 0, W, benchY);
  ctx.strokeStyle = Tk.dark ? 'rgba(255,255,255,.035)' : 'rgba(0,40,30,.05)'; ctx.lineWidth = 1;
  for (let y = 40; y < benchY; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 40) for (let y = 0; y < benchY; y += 80) { ctx.beginPath(); ctx.moveTo(x + (y / 40 % 2 ? 20 : 0), y); ctx.lineTo(x + (y / 40 % 2 ? 20 : 0), y + 40); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, benchY, 0, H); g.addColorStop(0, Tk.dark ? '#28302D' : '#3A4441'); g.addColorStop(1, Tk.dark ? '#1A201E' : '#2B3331');
  ctx.fillStyle = g; ctx.fillRect(0, benchY, W, H - benchY);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, benchY, W, 2);
}
function vesselAt(sc, x, y, pad) { // vessel object whose mouth is near (x,y)
  pad = pad || 0;
  for (const o of sc.objs) if (o.kind === 'vessel' && !o.held && !o.hidden) { const g = geoFor(o.v); const hw = g.hw(g.top + 2); if (Math.abs(x - o.x) < hw + 8 + pad && y > o.y - 80 - pad && y < o.y + 30) return o; }
  return null;
}
function liquidAt(sc, x, y) { // vessel object whose liquid contains point (x,y)
  for (const o of sc.objs) if (o.kind === 'vessel' && !o.hidden) {
    const g = geoFor(o.v); const ly = y - (o.y - g.top); const lx = x - (o.x - g.cx);
    if (ly < g.top || ly > g.bot) continue; if (Math.abs(lx - g.cx) > g.hw(ly)) continue;
    const fx = vfx(o.v); if (o.v.V > 0.05 && ly > g.levelY(fx.lvl) - 1) return o;
  }
  return null;
}
const vesselSurfaceWorld = o => { const g = geoFor(o.v); return g.levelY(vfx(o.v).lvl) + (o.y - g.top); };
const vesselBottomWorld = o => { const g = geoFor(o.v); return g.bot + (o.y - g.top); };

/* ---------- liquid transfer + notebook sessions ---------- */
function compOfBottle(b) { return { tot: b.tot || {}, ind: b.ind ? { [b.ind]: 20 } : {}, rgb: streamRGB(b), f: b.k === 'unk' ? b.f : (b.burette ? 'NaOH' : b.f), isInd: !!b.ind, id: b.id }; }
function compOfVessel(v) { const tot = {}, ind = {}; if (v.V > 0) { for (const k in v.tot) tot[k] = v.tot[k] / v.V; for (const k in v.ind) ind[k] = v.ind[k] / v.V; } return { tot, ind, rgb: (v.fx && v.fx.rgb) || [195, 222, 238], f: T('v.' + v.kind) + ' ' + v.label, isInd: false, id: 'V' + v.id }; }
function addLiquid(v, comp, dV) {
  if (dV <= 0) return;
  const run = S.run; const ps = run.pourS;
  if (!ps || ps.v !== v || ps.id !== comp.id) { endPour(); run.pourS = { v, id: comp.id, comp, before: snapV(v), amt: 0, drops: 0, gas: 0, spilled: false, last: 0 }; }
  const s = run.pourS; s.amt += dV; s.last = performance.now();
  v.V += dV; for (const k in comp.tot) v.tot[k] = (v.tot[k] || 0) + comp.tot[k] * dV; for (const k in comp.ind) v.ind[k] = (v.ind[k] || 0) + comp.ind[k] * dV;
  if (v.residue && v.V > 0) v.residue = null;
  if (v.V > v.cap) { const keep = v.cap * .92 / v.V; for (const k in v.tot) v.tot[k] *= keep; for (const k in v.ind) v.ind[k] *= keep; v.V = v.cap * .92; vfx(v).spill = 2.2; s.spilled = true; }
  v.eqDirty = true; run.focus = v;
}
function removeLiquid(v, dV) {
  if (v.V <= 0) return 0; dV = Math.min(dV, v.V); const k = 1 - dV / v.V;
  for (const x in v.tot) v.tot[x] *= k; for (const x in v.ind) v.ind[x] *= k; v.V -= dV; v.eqDirty = true;
  if (v.V < 0.01) { v.V = 0; v.tot = {}; v.ind = {}; v.residue = null; v.curve = []; resetFx(v); equilibrate(v); }
  return dV;
}
function endPour() {
  const run = S.run; const s = run && run.pourS; if (!s) return; run.pourS = null;
  const v = s.v; if (v.eqDirty) { const g = equilibrate(v); s.gas += g; v.eqDirty = false; }
  const after = snapV(v);
  const nd = Math.max(1, Math.round(s.amt / 0.05)); const amtLbl = s.comp.isInd || s.amt < 0.21 ? (nd === 1 ? T('amt.drop') : T('amt.drops', { n: nd })) : fmt(s.amt, s.amt < 10 ? 2 : 1) + ' mL';
  logE('obs', describe(s.before, after, s.gas, s.comp.isInd), { v: v.label, amt: amtLbl, f: s.comp.f });
  if (s.spilled) mistake('overflow', null, false);
  logDirty = true;
}
function eqStep(sc, t) {
  const run = S.run;
  for (const v of run.vessels || []) if (v.eqDirty && (!v.lastEq || t - v.lastEq > .08)) {
    v.lastEq = t; v.eqDirty = false; const gas = equilibrate(v);
    if (gas > 0) { vfx(v).gas += gas * 1.4 + (gas > 0.003 ? 0.03 : 0); if (run.pourS && run.pourS.v === v) run.pourS.gas += gas; }
    if (run.watchOvershoot && v.ind.phph && v.eq.pH > 11 && (v.tot.Cl || 0) > 0) { if (!run.flags.overNow) { run.flags.overNow = true; mistake('overshoot', null, false); logDirty = true; } }
    if (v.eq.pH < 9) run.flags.overNow = false;
    if (v.meter && run.curve && sc.burette) { const last = v.curve[v.curve.length - 1]; if (!last || Math.abs(last[0] - run.burette.used) >= 0.049) v.curve.push([run.burette.used, v.eq.pH]); }
  }
  if (run.pourS && performance.now() - run.pourS.last > 700) endPour();
}

/* ---------- pouring behaviour shared by bottles and tubes ---------- */
function tiltRate(a) { return a < 50 ? 110 : a < 74 ? 30 : 40; }
function pourHold(sc, o, dt, t, src) {
  // src: {comp(), take(dV) -> dV actually available, maxRate}
  const tg = o.target = findTarget(sc, o);
  const k = 1 - Math.exp(-dt * 14);
  if (tg) { o.vx += (tg.sx - o.vx) * k; o.vy += (tg.sy - o.vy) * k; o.ang = Math.min(118, (o.ang || 0) + dt * tiltRate(o.ang || 0)); }
  else { o.vx += (o.x - o.vx) * k; o.vy += (o.y - o.vy) * k; o.ang = Math.max(0, (o.ang || 0) - dt * 220); }
  o.flowing = 0;
  if (!tg) return;
  const a = o.ang;
  if (a > 50 && a <= 74) {
    o.dAcc = (o.dAcc || 0) + dt / (0.75 - (a - 50) / 24 * 0.55);
    if (o.dAcc >= 1) { o.dAcc = 0; const dV = src.take(0.05); if (dV > 0) sc.drops.push({ x: o.vx, y: o.vy + 2, vy: 0, dV, comp: src.comp(), tg }); }
  } else if (a > 74) {
    const rate = Math.min(src.maxRate || 2.6, (a - 74) / 36 * 2.6);
    const dV = src.take(rate * dt); o.flowing = dV > 0 ? rate : 0;
    if (dV > 0) deliver(sc, tg, src.comp(), dV, o.vx, rate);
  }
}
function deliver(sc, tg, comp, dV, x, rate) {
  if (tg.kind === 'vessel') { const v = tg.o.v; addLiquid(v, comp, dV); const g = geoFor(v); const fx = vfx(v); fx.inflow = { x: x - (tg.o.x - g.cx), rate: rate || 1, rgb: comp.rgb, t: FXR.last / 1000 }; }
  else if (tg.kind === 'burette') { const r = S.run; r.burette.used = Math.max(0, r.burette.used - dV); r.flags.refilled = true; }
}
function findTarget(sc, o) {
  // where would this pourer pour? candidate mouths near the pointer-driven anchor
  if (o.kind === 'bottle' && o.b.burette && sc.burette) { const B = sc.burette; if (Math.abs(o.x - B.x) < 40 && o.y > B.top - 90 && o.y < B.top + 20) return { kind: 'burette', sx: B.x + 6, sy: B.top - 8 }; }
  if (sc.waste && (o.kind === 'vessel' || o.kind === 'bottle')) { const w = sc.waste; if (Math.abs(o.x - w.x) < 50 && o.y > w.top - 90 && o.y < w.top + 25) return { kind: 'waste', sx: w.x + 14, sy: w.top - 10 }; }
  if (o.kind === 'bottle' && o.b.burette) return null;
  const tgo = vesselAt(sc, o.x, o.y, 10);
  if (tgo && tgo !== o) { const g = geoFor(tgo.v); const hw = g.hw(g.top + 2); return { kind: 'vessel', o: tgo, sx: tgo.x + hw * .45, sy: tgo.y - 12 }; }
  return null;
}
function updateDrops(sc, dt, ctx) {
  for (let i = sc.drops.length - 1; i >= 0; i--) {
    const d = sc.drops[i]; d.vy += 900 * dt; d.y += d.vy * dt;
    let surf = sc.H;
    if (d.tg.kind === 'vessel') surf = vesselSurfaceWorld(d.tg.o) - 1; else if (d.tg.kind === 'waste') surf = sc.waste.top + 30; else if (d.tg.kind === 'burette') surf = sc.burette.top + 6;
    if (d.y >= surf) {
      sc.drops.splice(i, 1);
      if (d.tg.kind === 'vessel') { const v = d.tg.o.v; addLiquid(v, d.comp, d.dV); const g = geoFor(v); vesselDropHit(v, d.x - (d.tg.o.x - g.cx), d.comp.rgb); }
      else deliver(sc, d.tg, d.comp, d.dV, d.x, 0);
      continue;
    }
    if (ctx) drawDropShape(ctx, d.x, d.y, d.comp.rgb);
  }
}
