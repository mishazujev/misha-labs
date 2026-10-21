/* ===================== COMBUSTION SCENE (org1) ===================== */
const SPH = (() => { const R = 62, N = 100, cum = [0]; let acc = 0; for (let i = 1; i <= N; i++) { const hh = 2 * R * (i - .5) / N; const r2 = R * R - (R - hh) ** 2; acc += Math.max(0, r2); cum.push(acc); } return { R, N, cum, acc }; })();
function sphereLevel(frac) { const tgt = frac * SPH.acc; for (let i = 1; i <= SPH.N; i++) if (SPH.cum[i] >= tgt) return 2 * SPH.R * i / SPH.N; return 2 * SPH.R; }
function combScene2(run) {
  if (run.scene && run.scene.kind === 'comb') return run.scene;
  const c = run.comb;
  const W = 900, H = 480, bench = 420;
  const sc = run.scene = { kind: 'comb', W, H, objs: [], drops: [], ptr: { x: 0, y: 0 } };
  const LAMP = { x: 170, wick: bench - 49 }, BUR = { x: 470, top: bench - 64 };
  c.capOn = true; c.gas = false; c.air = 1; c.lit = { lamp: false, burner: false };
  const F = c.fx = { lamp: { p: [], s: [] }, burner: { p: [], s: [] }, match: { p: [], s: [] }, fog: 0, drops: [], soot: 0, cob: 0, gasT: 0, mix: 0 };
  const flames = () => { const out = []; if (c.lit.lamp) out.push({ x: LAMP.x, y: LAMP.wick - 3, lum: false, kind: 'lamp' }); if (c.lit.burner) out.push({ x: BUR.x, y: BUR.top - 1, lum: F.mix > .5, kind: 'burner' }); return out; };
  const overFlame = (x, y) => flames().find(f => Math.abs(x - f.x) < 30 && y < f.y - 10 && y > f.y - 130);
  // lamp cap
  const cap = { kind: 'cap', x: LAMP.x, y: LAMP.wick - 2, hx: LAMP.x, hy: LAMP.wick - 2, z: 30, drag: true, stay: true,
    hit(px, py) { return inRect(px, py, this.x - 12, this.y - 16, this.x + 12, this.y + 8); },
    label() { return T('obj.cap'); },
    pick() { if (!needGoggles()) return null; if (c.capOn) { c.capOn = false; logE('info', [['log.capOff']]); logDirty = true; } return this; },
    drop() { if (Math.abs(this.x - LAMP.x) < 26 && Math.abs(this.y - LAMP.wick) < 40) { this.x = LAMP.x; this.y = LAMP.wick - 2; c.capOn = true; if (c.lit.lamp) { c.lit.lamp = false; logE('info', [['obs.capped']]); } else logE('info', [['log.capOn']]); logDirty = true; } else { this.x = clamp(this.x, 20, W - 20); this.y = bench - 6; } },
    draw(ctx) { ctx.fillStyle = '#6C7773'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(this.x - 10, this.y + 6); ctx.lineTo(this.x - 8, this.y - 14); ctx.quadraticCurveTo(this.x, this.y - 18, this.x + 8, this.y - 14); ctx.lineTo(this.x + 10, this.y + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); } };
  // matchbox -> lit match
  const matchbox = { kind: 'matchbox', x: 300, y: bench + 22, z: 20, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 28, this.y - 12, this.x + 28, this.y + 12); },
    label() { return T('obj.matches'); },
    pick(p) { if (!needGoggles()) return null; return makeMatch(sc, p, (x, y) => {
      if (!c.capOn && !c.lit.lamp && Math.hypot(x - LAMP.x, y - LAMP.wick) < 22) { c.lit.lamp = true; logE('obs', [['obs.lampLit']]); logDirty = true; return true; }
      if (c.gas && !c.lit.burner && Math.abs(x - BUR.x) < 22 && y < BUR.top + 6 && y > BUR.top - 40) { c.lit.burner = true; F.gasT = 0; logE('obs', [[c.air > .5 ? 'obs.burnerBlue' : 'obs.burnerYellow']]); logDirty = true; return true; }
      return false; }); },
    draw(ctx) { drawMatchbox(ctx, this.x, this.y); } };
  // gas valve
  const valve = { kind: 'valve', x: 580, y: bench + 16, z: 20,
    hit(px, py) { return inRect(px, py, this.x - 22, this.y - 16, this.x + 22, this.y + 16); },
    label() { return T('obj.gasTap') + ' · ' + (c.gas ? T('w.open') : T('w.closed')); },
    tap() { if (!needGoggles()) return; c.gas = !c.gas; if (!c.gas && c.lit.burner) { c.lit.burner = false; logE('info', [['obs.tapClosed']]); } else logE('info', [[c.gas ? 'log.gasOn' : 'log.gasOff']]); F.gasT = 0; logDirty = true; },
    draw(ctx) { const Tk = tok(); ctx.strokeStyle = Tk.dark ? '#A06A3B' : '#C0782F'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(this.x - 14, this.y); ctx.bezierCurveTo(this.x - 50, this.y + 10, BUR.x + 60, bench + 10, BUR.x + 20, bench - 6); ctx.stroke();
      ctx.fillStyle = '#C9A227'; ctx.fillRect(this.x - 14, this.y - 6, 28, 12); ctx.save(); ctx.translate(this.x, this.y - 6); ctx.rotate(c.gas ? 0 : Math.PI / 2); ctx.fillStyle = '#B3261E'; ctx.fillRect(-14, -3, 28, 6); ctx.restore(); } };
  // air collar
  const collar = { kind: 'collar', x: BUR.x + 15, y: BUR.top + 30, z: 25, drag: true, stay: true,
    hit(px, py) { return inRect(px, py, BUR.x - 18, BUR.top + 22, BUR.x + 18, BUR.top + 40); },
    constrain(x) { return [clamp(x, BUR.x - 15, BUR.x + 15), BUR.top + 30]; },
    label() { return T('obj.collar') + ' · ' + Math.round(c.air * 100) + ' %'; },
    hold() { const prev = c.air; c.air = (this.x - (BUR.x - 15)) / 30; if (c.lit.burner && (prev > .5) !== (c.air > .5)) { logE('obs', [[c.air > .5 ? 'obs.burnerBlue' : 'obs.burnerYellow']]); logDirty = true; } },
    draw(ctx) { const Tk = tok(); ctx.fillStyle = Tk.dark ? '#57625E' : '#8E9894'; ctx.fillRect(BUR.x - 12, BUR.top + 23, 24, 15); ctx.fillStyle = '#111'; const hole = c.air * 8; ctx.fillRect(BUR.x - hole / 2, BUR.top + 26, hole, 9); ctx.fillStyle = Tk.accent; ctx.fillRect(this.x - 2, BUR.top + 21, 4, 19); } };
  // cold glass (inverted beaker), held by its base; anchor = rim centre
  const glass = { kind: 'glass', x: 650, y: bench, hx: 650, hy: bench, z: 35, drag: true, logged: false,
    hit(px, py) { return inRect(px, py, this.x - 40, this.y - 72, this.x + 40, this.y + 2); },
    label() { return T('obj.glass'); },
    pick() { if (!needGoggles()) return null; this.logged = false; return this; },
    hold(dt) { const f = overFlame(this.x, this.y - 4); if (f) { F.fog = Math.min(1, F.fog + dt * .45); if (F.fog > .3 && F.drops.length < 28 && Math.random() < dt * 12) F.drops.push({ x: rnd(-32, 32), y: rnd(-60, -6), r: .4, max: rnd(1.2, 3) }); if (F.fog > .6 && !this.logged) { this.logged = true; run.flags.didGlass = true; logE('obs', [['obs.glass']]); logDirty = true; } } },
    draw(ctx, dt) { const Tk = tok(); F.fog = Math.max(F.drops.length ? .25 : 0, F.fog - dt * .03);
      ctx.translate(this.x, this.y); ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.6)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-38, -64); ctx.quadraticCurveTo(-38, -70, -32, -70); ctx.lineTo(32, -70); ctx.quadraticCurveTo(38, -70, 38, -64); ctx.lineTo(38, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0, 38, 5, 0, 0, 7); ctx.stroke();
      if (F.fog > 0) { ctx.fillStyle = `rgba(236,241,243,${.55 * F.fog})`; ctx.fillRect(-37, -69, 74, 68); }
      for (const d of F.drops) { d.r = Math.min(d.max, d.r + dt * .6); if (d.r > 2.4) d.y = Math.min(-4, d.y + dt * 5); ctx.fillStyle = 'rgba(140,185,225,.8)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); }
      if (F.cob > 0) { ctx.fillStyle = css(lerpC([60, 90, 200], [235, 120, 170], Math.min(1, F.cob)), 1); ctx.fillRect(4, -40, 26, 10); } } };
  // cobalt chloride paper
  const cob = { kind: 'cobalt', x: 712, y: bench + 26, hx: 712, hy: bench + 26, z: 36, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 16, this.y - 8, this.x + 16, this.y + 8); },
    label() { return T('obj.cobalt'); },
    pick() { if (!needGoggles()) return null; return this; },
    drop() { if (F.drops.length && inRect(this.x, this.y, glass.x - 38, glass.y - 70, glass.x + 38, glass.y)) { this.hidden = true; addJob(run, { kind: 'cobalt', dur: 1.6, tick: d => { F.cob = Math.min(1, F.cob + d * .7); }, end: () => { run.flags.didCobalt = true; logE('obs', [['obs.cobalt']]); } }); } },
    draw(ctx) { ctx.fillStyle = '#3C5AC8'; ctx.fillRect(this.x - 14, this.y - 5, 28, 10); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeRect(this.x - 14, this.y - 5, 28, 10); } };
  // porcelain dish in tongs; anchor = dish centre
  const dish = { kind: 'dish', x: 770, y: bench - 8, hx: 770, hy: bench - 8, z: 37, drag: true, t0: 0, logged: false,
    hit(px, py) { return inRect(px, py, this.x - 40, this.y - 12, this.x + 80, this.y + 14); },
    label() { return T('obj.dish'); },
    pick() { if (!needGoggles()) return null; this.t0 = 0; this.logged = false; return this; },
    hold(dt) { const f = overFlame(this.x, this.y + 4); if (f) { this.t0 += dt; if (f.lum) F.soot = Math.min(1, F.soot + dt * .45); if (!this.logged && this.t0 > 2) { this.logged = true; if (F.soot > .3) run.flags.didSoot = true; logE('obs', [[F.soot > .3 ? 'obs.soot' : 'obs.noSoot']]); logDirty = true; } } },
    draw(ctx) { const Tk = tok(); ctx.translate(this.x, this.y); ctx.strokeStyle = Tk.dark ? '#9AA5A1' : '#4B5652'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, -2); ctx.lineTo(90, -26); ctx.moveTo(30, 2); ctx.lineTo(90, -20); ctx.stroke();
      ctx.fillStyle = Tk.dark ? '#D8D6CF' : '#F5F3EC'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-34, -4); ctx.quadraticCurveTo(0, 18, 34, -4); ctx.quadraticCurveTo(0, 4, -34, -4); ctx.fill(); ctx.stroke();
      if (F.soot > 0) { const g = ctx.createRadialGradient(0, 6, 0, 0, 6, 22); g.addColorStop(0, `rgba(20,18,16,${Math.min(.95, F.soot)})`); g.addColorStop(1, 'rgba(20,18,16,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 5, 26, 7, 0, 0, 7); ctx.fill(); } } };
  // funnel connected to limewater
  const limeG = geoFor(c.lime); const LIME = { x: 850, top: bench - 186 };
  const funnel = { kind: 'funnel', x: 760, y: 200, hx: 760, hy: 200, z: 34, drag: true, t0: 0, before: null,
    hit(px, py) { return inRect(px, py, this.x - 30, this.y - 50, this.x + 30, this.y + 4); },
    label() { return T('obj.funnel'); },
    pick() { if (!needGoggles()) return null; this.t0 = 0; this.before = snapV(c.lime); return this; },
    hold(dt) { const f = overFlame(this.x, this.y + 6); if (f) { this.t0 += dt; const v = c.lime; v.tot.Ct = (v.tot.Ct || 0) + .016 * dt; vfx(v).gas += dt * .06; vfx(v).ix = limeG.cx; v.eqDirty = true; if (this.t0 > 1.5) run.flags.didLime = true; } },
    drop() { if (this.t0 > .8 && this.before) { equilibrate(c.lime); const af = snapV(c.lime), b = this.before; const turned = af.p.CaCO3 && !b.p.CaCO3, gone = b.p.CaCO3 && (!af.p.CaCO3 || af.p.CaCO3 < b.p.CaCO3 * .6); logE('obs', [[turned ? 'obs.limeMilky' : gone ? 'obs.limeClear' : af.p.CaCO3 ? 'obs.limeMore' : 'obs.none']]); logDirty = true; } },
    draw(ctx) { const Tk = tok(); ctx.strokeStyle = Tk.dark ? '#8C6A4A' : '#7A5A3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.x, this.y - 50); ctx.bezierCurveTo(this.x, this.y - 140, LIME.x, LIME.top - 90, LIME.x, LIME.top + 10); ctx.stroke();
      ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.75)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(this.x - 28, this.y); ctx.lineTo(this.x - 4, this.y - 30); ctx.lineTo(this.x - 4, this.y - 50); ctx.lineTo(this.x + 4, this.y - 50); ctx.lineTo(this.x + 4, this.y - 30); ctx.lineTo(this.x + 28, this.y); ctx.closePath(); ctx.fill(); ctx.stroke(); } };
  sc.objs.push(cap, matchbox, valve, collar, glass, cob, dish, funnel); addGoggles(sc, 330, 40);
  sc.objs.push({ kind: 'deco', z: 32, hit(px, py) { return inRect(px, py, LIME.x - 20, LIME.top, LIME.x + 20, LIME.top + 170); }, label() { return T('lbl.limewater'); }, draw(ctx, dt, t) { ctx.translate(LIME.x - limeG.cx, LIME.top - limeG.top); drawVessel(ctx, c.lime, limeG, dt, t, { noLamp: true }); } });
  sc.update = (dt, t) => {
    if (c.lime.eqDirty && (!c.lime.lastEq || t - c.lime.lastEq > .1)) { c.lime.lastEq = t; c.lime.eqDirty = false; equilibrate(c.lime); }
    F.mix += ((c.air < .5 ? 1 : 0) - F.mix) * (1 - Math.exp(-dt * 2.5));
    if (c.gas && !c.lit.burner) { F.gasT += dt; if (F.gasT > 5) { F.gasT = -999; mistake('gasLeak'); logDirty = true; } }
  };
  sc.bg = (ctx, dt, t) => { wallAndBench(ctx, W, H, bench); const Tk = tok();
    // stand for limewater tube
    ctx.fillStyle = Tk.dark ? '#7E8A86' : '#59635F'; ctx.fillRect(LIME.x + 30, LIME.top - 40, 5, bench - LIME.top + 40); ctx.fillRect(LIME.x - 10, LIME.top + 40, 45, 4); ctx.fillRect(LIME.x - 10, bench - 6, 60, 6);
    drawLamp(ctx, LAMP.x, LAMP.wick, 1.3);
    // burner
    ctx.fillStyle = Tk.dark ? '#7E8A86' : '#59635F'; ctx.fillRect(BUR.x - 10, BUR.top, 20, 54); ctx.fillRect(BUR.x - 32, BUR.top + 54, 64, 10);
  };
  sc.fg = (ctx, dt, t) => {
    drawFlame(ctx, F.lamp, LAMP.x, LAMP.wick - 3, 1.15, 2, dt, t, c.lit.lamp ? 1 : 0);
    F.burner.mix = F.mix; drawFlame(ctx, F.burner, BUR.x, BUR.top - 1, 1.3, 0, dt, t, c.lit.burner ? 1 : 0);
    if (c.gas && !c.lit.burner) { ctx.fillStyle = 'rgba(180,200,190,.12)'; ctx.beginPath(); ctx.arc(BUR.x + Math.sin(t * 2) * 4, BUR.top - 20, 14 + Math.sin(t * 3) * 3, 0, 7); ctx.fill(); }
  };
  return sc;
}
function drawMatchbox(ctx, x, y) { ctx.fillStyle = '#C8452C'; ctx.fillRect(x - 26, y - 10, 52, 20); ctx.fillStyle = '#F2E2B8'; ctx.fillRect(x - 20, y - 6, 40, 12); ctx.fillStyle = '#5A3B2A'; ctx.fillRect(x - 26, y + 7, 52, 3); ctx.fillStyle = '#1B1B1B'; ctx.font = '700 7px "IBM Plex Sans", sans-serif'; ctx.fillText('MATCHES', x - 17, y + 3); }
function makeMatch(sc, p, onTouch) {
  const m = { kind: 'match', x: p.x, y: p.y - 4, z: 60, drag: true, stay: true, life: 0, F: { p: [], s: [] }, used: false,
    label() { return T('obj.matchLit'); },
    hold() { if (!this.used && this.life < 12 && onTouch(this.x, this.y)) this.used = true; },
    drop() { this.x = clamp(this.x, 12, sc.W - 46); this.y = sc.benchY || this.y; this.hx = this.x; this.hy = this.y; this.stay = true; },
    draw(ctx, dt, t) { this.life += dt; ctx.strokeStyle = '#D9B47C'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + 34, this.y + 34); ctx.stroke(); ctx.fillStyle = '#4A2A1F'; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, 7); ctx.fill(); drawFlame(ctx, this.F, this.x, this.y - 1, .45, 1, dt, t, this.life < 12 ? 1 : 0); } };
  return m;
}

/* ===================== DISTILLATION SCENE (org2) ===================== */
function distScene2(run) {
  if (run.scene && run.scene.kind === 'dist') return run.scene;
  const d = run.dist; const W = 1000, H = 660, bench = 520;
  const sc = run.scene = { kind: 'dist', W, H, benchY: bench, objs: [], drops: [], ptr: { x: 0, y: 0 } };
  const fcx = 170, fcy = 300, R = 62;
  d.src = null; d.water = null; d.tap = false; d.chips = false; d.column = false; d.cur = 0; d.alcRec = null; d.thY = 140; d.thermo = 'above';
  d.fx = { flame: { p: [], s: [] }, bubs: [], cd: [], drips: [], vap: [], fire: { p: [], s: [] }, spl: [], flow: 0, ripple: 0, esc: [], splint: null };
  const geom = () => { const neckTop = d.column ? 100 : 165, armY = neckTop + 20, C0 = [312, armY + 30], C1 = [600, 345]; const L = Math.hypot(C1[0] - C0[0], C1[1] - C0[1]), ca = Math.atan2(C1[1] - C0[1], C1[0] - C0[0]);
    const at = (s, perp) => [C0[0] + s * Math.cos(ca) - perp * Math.sin(ca), C0[1] + s * Math.sin(ca) + perp * Math.cos(ca)];
    return { neckTop, armY, C0, C1, L, ca, at, nLow: at(L - 40, 22), nHigh: at(40, -22), outEnd: at(L + 14, 0) }; };
  sc.geom = geom;
  const parkOnBench = (o, margin = 20) => { o.x = clamp(o.x, margin, W - margin); o.y = bench; o.hx = o.x; o.hy = o.y; o.stay = true; o.returning = false; };
  const leavePlaced = o => { o.x = clamp(o.x, 12, W - 12); o.y = clamp(o.y, 40, H - 12); o.hx = o.x; o.hy = o.y; o.stay = true; o.returning = false; };
  const potLevel = () => fcy + R - sphereLevel(Math.min(1, mixVol(d.nE, d.nW) / 100));
  // heat sources
  const homes = { burner: [110, 520], mantle: [300, 540], bath: [530, 540] };
  for (const k of ['burner', 'mantle', 'bath']) {
    sc.objs.push({ kind: 'heat', src: k, x: homes[k][0], y: homes[k][1], hx: homes[k][0], hy: homes[k][1], z: 10, drag: true,
      hit(px, py) { const r = heatRect(k, this.x, this.y); return inRect(px, py, r[0], r[1], r[2], r[3]); },
      label() { return T('obj.' + k) + (d.src === k ? ' · ' + (d.heating ? T('w.on') : T('w.off')) : ''); },
      pick() { if (!needGoggles()) return null; if (d.src === k) { if (d.heating) { stopHeat(); } d.src = null; } this.stay = false; return this; },
      tap() { if (d.src !== k) return; if (!needGoggles()) return; if (d.heating) stopHeat(); else startHeat(); },
      drop() { if (Math.hypot(this.x - fcx, this.y - fcy) < 110 && !d.src) { this.x = fcx; this.y = fcy; this.stay = true; d.src = k; logE('info', [['log.srcPlaced', { s: { k: 'src.' + k } }]]); logDirty = true; } else parkOnBench(this, 115); },
      draw(ctx, dt, t) { drawHeatSrc(ctx, k, this.x, this.y, d.src === k && d.heating, d, dt, t, this.x === fcx && this.y === fcy); } });
  }
  function startHeat() { if (!d.src) return; if (d.fire) return; d.heating = true; if (!d.started) { d.started = true; } if (d.src === 'burner') mistake('openFlame'); logE('info', [['log.heatOn2', { s: { k: 'src.' + d.src } }]]); logDirty = true; stopSim(); simTimer = setInterval(distTick, 100); }
  function stopHeat() { d.heating = false; d.boiling = false; d.rateMl = 0; stopSim(); logE('info', [['log.heatOff']]); logDirty = true; }
  sc.stopHeat = stopHeat;
  // thermometer (vertical drag)
  sc.objs.push({ kind: 'thermo', x: fcx, y: d.thY, hx: fcx, hy: d.thY, z: 40, drag: true, stay: true,
    hit(px, py) { return inRect(px, py, fcx - 10, this.y - 160, fcx + 10, this.y + 6); },
    constrain(x, y) { const G = geom(); return [fcx, clamp(y, G.neckTop - 40, fcy + 46)]; },
    label() { return T('obj.thermo') + ' · ' + fmt(d.Tth, 1) + ' °C'; },
    pick() { this.y = d.thY; return this; },
    hold() { d.thY = this.y; }, drop() { d.thY = this.y; },
    draw(ctx) { this.y = d.thY; this.hy = d.thY; drawThermo(ctx, fcx, d.thY, d.Tth); } });
  // hose end
  const hose = { kind: 'hose', x: 720, y: 600, hx: 720, hy: 600, z: 42, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 12, this.y - 12, this.x + 12, this.y + 12); },
    label() { return T('obj.hose'); },
    pick() { if (d.water) { d.water = null; logE('info', [['log.hoseOff']]); logDirty = true; } this.stay = false; return this; },
    drop() { const G = geom(); for (const [nm, p] of [['bottom', G.nLow], ['top', G.nHigh]]) if (Math.hypot(this.x - p[0], this.y - p[1]) < 30) { d.water = nm; this.x = p[0]; this.y = p[1]; this.stay = true; logE('info', [['log.hoseOn', { p: { k: 'wa.' + nm } }]]); logDirty = true; return; } leavePlaced(this); },
    draw(ctx) { const Tk = tok(); if (d.water) { const G = geom(); const p = d.water === 'bottom' ? G.nLow : G.nHigh; this.x = p[0]; this.y = p[1]; }
      ctx.strokeStyle = d.tap && d.water ? '#3E7BE0' : (Tk.dark ? '#8C6A4A' : '#7A5A3A'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(760, 640); ctx.bezierCurveTo(760, 560, this.x + 40, this.y + 80, this.x, this.y); ctx.stroke(); ctx.fillStyle = '#5A4030'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, 7); ctx.fill(); } };
  const tap = { kind: 'tap', x: 760, y: 640, z: 41,
    hit(px, py) { return inRect(px, py, this.x - 26, this.y - 30, this.x + 26, this.y + 8); },
    label() { return T('obj.tap') + ' · ' + (d.tap ? T('w.open') : T('w.closed')); },
    tap() { d.tap = !d.tap; logE('info', [[d.tap ? 'log.tapOn' : 'log.tapOff']]); if (d.tap && !d.water) { mistake('hoseLoose'); } logDirty = true; },
    draw(ctx, dt, t) { const Tk = tok(); ctx.fillStyle = Tk.dark ? '#9AA5A1' : '#6F7A76'; ctx.fillRect(this.x - 6, this.y - 26, 12, 26); ctx.save(); ctx.translate(this.x, this.y - 26); ctx.rotate(d.tap ? 0 : Math.PI / 2); ctx.fillStyle = '#2B6CB0'; ctx.fillRect(-16, -4, 32, 8); ctx.restore();
      if (d.tap && !d.water) { ctx.fillStyle = 'rgba(80,150,230,.6)'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(hose.x + Math.sin(t * 9 + k) * 12, hose.y + ((t * 80 + k * 9) % 40), 2, 0, 7); ctx.fill(); } } } };
  sc.objs.push(hose, tap); addGoggles(sc, 600, 40);
  // boiling chips jar
  sc.objs.push({ kind: 'chips', x: 810, y: bench, hx: 810, hy: bench, z: 30, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 18, this.y - 44, this.x + 18, this.y); },
    label() { return T('obj.chips'); },
    pick() { if (!needGoggles()) return null; return this; },
    drop() { const G = geom(); if (Math.abs(this.x - fcx) < 34 && this.y < G.neckTop + 40 && this.y > G.neckTop - 80) { if (d.chips) { parkOnBench(this); return; } d.chips = true; if (d.T > 60) { mistake('chipsHot', null, false); d.bumpFx = .6; } logE('info', [['obs.chipsAdded']]); logDirty = true; } else parkOnBench(this); },
    draw(ctx) { const Tk = tok(); ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.8)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.4; ctx.fillRect(this.x - 16, this.y - 40, 32, 40); ctx.strokeRect(this.x - 16, this.y - 40, 32, 40); ctx.fillStyle = '#8A948F'; for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc(this.x - 12 + (k * 7 % 24), this.y - 4 - Math.floor(k / 4) * 5, 2.4, 0, 7); ctx.fill(); } ctx.fillStyle = '#6C7773'; ctx.fillRect(this.x - 17, this.y - 46, 34, 7); } });
  // fractionating column (loose piece)
  const col = { kind: 'column', x: 880, y: bench, hx: 880, hy: bench, z: 30, drag: true,
    hit(px, py) { if (d.column) { const G = geom(); return inRect(px, py, fcx - 14, G.neckTop, fcx + 14, G.neckTop + 60); } return inRect(px, py, this.x - 12, this.y - 72, this.x + 12, this.y); },
    label() { return T('obj.column'); },
    pick(p) { if (d.heating || d.T > 45) { toast(T('tip.hot'), 'err'); return null; } if (d.column) { d.column = false; this.hidden = false; this.x = p.x; this.y = p.y + 36; logE('info', [['log.colOff']]); logDirty = true; } return this; },
    drop() { if (Math.abs(this.x - fcx) < 40 && this.y < 260 && this.y > 120) { d.column = true; this.hidden = true; this.x = this.hx; this.y = this.hy; logE('info', [['log.colOn']]); logDirty = true; } else parkOnBench(this); },
    draw(ctx) { if (d.column) return; const Tk = tok(); ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.8)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.4; ctx.fillRect(this.x - 10, this.y - 70, 20, 70); ctx.strokeRect(this.x - 10, this.y - 70, 20, 70); ctx.globalAlpha = .5; for (let yy = this.y - 62; yy < this.y - 6; yy += 8) { ctx.beginPath(); ctx.moveTo(this.x - 9, yy); ctx.lineTo(this.x + 9, yy + 4); ctx.stroke(); } } };
  col.hidden = false; sc.objs.push(col);
  // receivers
  const slotX = () => geom().outEnd[0] + 18;
  const spare = [692, 738, 784];
  [0, 1, 2].forEach(i => {
    const hx = i === 0 ? slotX() : spare[i];
    sc.objs.push({ kind: 'rec', i, x: hx, y: bench, hx, hy: bench, z: 28, drag: true,
      hit(px, py) { return inRect(px, py, this.x - 18, this.y - 86, this.x + 18, this.y); },
      label() { const r = d.rec[i]; return T('obj.rec', { r: 'R' + (i + 1) }) + ' · ' + fmt(mixVol(r.nE, r.nW), 1) + ' mL'; },
      pick() { if (d.cur === i) d.cur = -1; if (d.alcRec === i) { const alc = sc.objs.find(o => o.kind === 'alc'); d.alcRec = null; if (alc) parkOnBench(alc); } this.stay = false; return this; },
      drop() { const sx = slotX(); if (Math.abs(this.x - sx) < 30 && this.y > bench - 70) { const other = sc.objs.find(o => o.kind === 'rec' && o !== this && d.cur === o.i); if (other) { other.hx = spare[other.i]; other.hy = bench; other.stay = false; other.returning = true; } d.cur = i; this.x = sx; this.y = bench; this.hx = sx; this.hy = bench; this.stay = true; logE('info', [['log.recv', { r: 'R' + (i + 1), t: fmt(d.Tth, 1) }]]); logDirty = true; refreshSide(); } else { parkOnBench(this); refreshSide(); } },
      draw(ctx, dt, t) { drawCyl(ctx, this.x, this.y, d.rec[i], 'R' + (i + 1), d.fx, t, d.cur === i, d.measured[i]); } });
  });
  // alcoholometer
  sc.objs.push({ kind: 'alc', x: 940, y: bench, hx: 940, hy: bench, z: 44, drag: true, stay: true,
    hit(px, py) { return inRect(px, py, this.x - 10, this.y - 100, this.x + 10, this.y + 2); },
    label() { const p = d.alcRec != null ? d.measured[d.alcRec] : null; return T('obj.alc') + (p != null ? ' · ' + Math.round(p) + ' % v/v' : ''); },
    pick() { if (!needGoggles()) return null; d.alcRec = null; this.stay = false; return this; },
    drop() { const r = sc.objs.find(o => o.kind === 'rec' && Math.abs(this.x - o.x) < 24 && this.y > o.y - 92 && this.y < o.y + 12); if (r && measureRec(r.i)) { d.alcRec = r.i; this.x = r.x; this.y = r.y; this.hx = this.x; this.hy = this.y; this.stay = true; return; } parkOnBench(this); if (!r) toast(T('tip.alcReceiver'), 'err'); },
    draw(ctx) { const Tk = tok(), attached = d.alcRec != null, p = attached ? d.measured[d.alcRec] : null;
      ctx.fillStyle = Tk.dark ? 'rgba(220,235,240,.42)' : 'rgba(250,252,253,.98)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.2;
      ctx.fillRect(this.x - 3.5, this.y - 96, 7, 63); ctx.strokeRect(this.x - 3.5, this.y - 96, 7, 63);
      ctx.strokeStyle = '#5E6B66'; ctx.lineWidth = .8; for (let yy = this.y - 89; yy < this.y - 39; yy += 7) { ctx.beginPath(); ctx.moveTo(this.x + 1, yy); ctx.lineTo(this.x + 5, yy); ctx.stroke(); }
      ctx.fillStyle = Tk.dark ? 'rgba(220,235,240,.42)' : 'rgba(250,252,253,.98)'; ctx.strokeStyle = Tk.glass; ctx.beginPath(); ctx.ellipse(this.x, this.y - 19, 8, 16, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.ellipse(this.x, this.y - 7, 5, 7, 0, 0, 7); ctx.fill();
      if (p != null) { const bx = clamp(this.x + 16, 8, W - 118), by = this.y - 118; ctx.fillStyle = Tk.surface; ctx.strokeStyle = Tk.line; ctx.lineWidth = 1; ctx.fillRect(bx, by, 110, 36); ctx.strokeRect(bx, by, 110, 36); ctx.fillStyle = Tk.muted; ctx.font = '9px "IBM Plex Sans", sans-serif'; ctx.fillText(T('lbl.alcoholReading'), bx + 6, by + 12); ctx.fillStyle = Tk.ink; ctx.font = '600 15px "IBM Plex Mono", monospace'; ctx.fillText(Math.round(p) + ' % v/v', bx + 6, by + 29); }
    } });
  // matches for the flame test
  sc.objs.push({ kind: 'matchbox', x: 880, y: 610, z: 20, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 28, this.y - 12, this.x + 28, this.y + 12); },
    label() { return T('obj.matchesTest'); },
    pick(p) { if (!needGoggles()) return null; const tested = {}; return makeMatch(sc, p, (x, y) => { const r = sc.objs.find(o => o.kind === 'rec' && Math.abs(x - o.x) < 20 && y > o.y - 100 && y < o.y - 70); if (r && !tested[r.i]) { tested[r.i] = 1; burnRec(r.i); d.fx.splint = { x: r.x, y: r.y - 86, t: 2.5, burns: volPct(d.rec[r.i].nE, d.rec[r.i].nW) >= 50 }; } return false; }); },
    draw(ctx) { drawMatchbox(ctx, this.x, this.y); } });
  sc.bg = (ctx, dt, t) => drawDistBase(ctx, sc, d, dt, t, fcx, fcy, R, bench, potLevel);
  sc.fg = (ctx, dt, t) => { const F = d.fx; if (F.splint && F.splint.t > 0) { F.splint.t -= dt; if (F.splint.burns) drawFlame(ctx, F.fire3 || (F.fire3 = { p: [], s: [] }), F.splint.x, F.splint.y, .8, 2, dt, t, 1); } if (d.fire) { drawFlame(ctx, F.fire, 470, 360, 2.4, 3, dt, t, 1); drawFlame(ctx, F.fire2 || (F.fire2 = { p: [], s: [] }), 630, 430, 1.6, 3, dt, t, 1); } };
  sc.update = () => {
    const ly = potLevel(), G = geom();
    d.thermo = d.thY > ly ? 'liquid' : Math.abs(d.thY - G.armY) <= 10 ? 'arm' : d.thY < G.armY - 10 ? 'above' : 'below';
    if (d.alcRec != null) { const r = sc.objs.find(o => o.kind === 'rec' && o.i === d.alcRec), alc = sc.objs.find(o => o.kind === 'alc'); if (r && alc && !alc.held) { alc.x = r.x; alc.y = r.y; alc.hx = r.x; alc.hy = r.y; } }
    if (!d.src && d.heating) stopHeat();
  };
  return sc;
}
function heatRect(k, x, y) { return k === 'bath' ? [x - 102, y - 8, x + 112, y + 108] : k === 'mantle' ? [x - 76, y - 8, x + 76, y + 108] : [x - 68, y + 30, x + 68, y + 132]; }
function drawHeatSrc(ctx, k, x, y, on, d, dt, t, placed) {
  const Tk = tok(); const R = 62;
  if (k === 'bath') {
    ctx.fillStyle = Tk.dark ? 'rgba(90,150,210,.22)' : 'rgba(110,170,220,.35)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.rect(x - 100, y - 6, 200, 98); ctx.stroke(); const wy = y + 10 + Math.sin(t * 2) * .8; ctx.fillRect(x - 99, wy, 198, y + 92 - wy);
    ctx.fillStyle = Tk.muted; ctx.fillRect(x - 110, y + 94, 220, 12); ctx.fillStyle = on ? '#E4572E' : Tk.line; ctx.beginPath(); ctx.arc(x + 80, y + 100, 4, 0, 7); ctx.fill();
    if (on && d.T > 80) for (let k2 = 0; k2 < 3; k2++) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x - 80 + ((t * 40 + k2 * 60) % 160), y + 88 - ((t * 30 + k2 * 20) % 70), 1.6, 0, 7); ctx.stroke(); }
  } else if (k === 'mantle') {
    ctx.fillStyle = Tk.dark ? '#2A3430' : '#B9C3BF'; ctx.beginPath(); ctx.moveTo(x - R - 12, y - 6); ctx.quadraticCurveTo(x - R - 12, y + R + 22, x, y + R + 22); ctx.quadraticCurveTo(x + R + 12, y + R + 22, x + R + 12, y - 6); ctx.lineTo(x + R + 2, y - 6); ctx.quadraticCurveTo(x + R + 2, y + R + 12, x, y + R + 12); ctx.quadraticCurveTo(x - R - 2, y + R + 12, x - R - 2, y - 6); ctx.closePath(); ctx.fill();
    if (on) { const gg = ctx.createRadialGradient(x, y + 30, 10, x, y + 30, R + 14); gg.addColorStop(0, `rgba(255,110,40,${.3 + .05 * Math.sin(t * 3)})`); gg.addColorStop(1, 'rgba(255,110,40,0)'); ctx.fillStyle = gg; ctx.fillRect(x - R - 14, y - 10, 2 * R + 28, R + 40); }
    ctx.fillStyle = Tk.muted; ctx.fillRect(x - 50, y + R + 22, 100, 22); ctx.fillStyle = on ? '#E4572E' : Tk.line; ctx.beginPath(); ctx.arc(x + 36, y + R + 33, 4.5, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = Tk.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 60, y + 72); ctx.lineTo(x - 48, y + 128); ctx.moveTo(x + 60, y + 72); ctx.lineTo(x + 48, y + 128); ctx.stroke();
    ctx.fillStyle = Tk.muted; ctx.fillRect(x - 66, y + 68, 132, 4); ctx.fillRect(x - 7, y + 104, 14, 24); ctx.fillRect(x - 20, y + 126, 40, 6);
    ctx.fillStyle = on ? '#2C7A48' : '#B3261E'; ctx.beginPath(); ctx.arc(x + 22, y + 120, 4, 0, 7); ctx.fill();
    drawFlame(ctx, d.fx.flame, x, y + 104, 1.1, 0, dt, t, on ? 1 : 0);
  }
}
function drawThermo(ctx, x, bulbY, T_) {
  const Tk = tok(); const top = bulbY - 150;
  ctx.fillStyle = Tk.dark ? 'rgba(220,235,240,.18)' : 'rgba(255,255,255,.9)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.rect(x - 3, top, 6, 146); ctx.fill(); ctx.stroke();
  const colH = 136 * clamp((T_ + 10) / 120, 0, 1); ctx.fillStyle = '#C0392B'; ctx.fillRect(x - 1.2, bulbY - 6 - colH, 2.4, colH); ctx.beginPath(); ctx.arc(x, bulbY - 3, 4, 0, 7); ctx.fill();
  ctx.fillStyle = Tk.surface; ctx.strokeStyle = Tk.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(x + 12, top, 78, 26); ctx.fill(); ctx.stroke();
  ctx.fillStyle = Tk.ink; ctx.font = '500 14px "IBM Plex Mono", monospace'; ctx.fillText(fmt(T_, 1) + ' °C', x + 18, top + 18);
}
function drawCyl(ctx, x, bottom, rec, lbl, F, t, cur, meas) {
  const Tk = tok(); const w = 34, h = 82, top = bottom - h; const rv = mixVol(rec.nE, rec.nW); const rf = Math.min(1, rv / 40); const rly = bottom - 3 - rf * (h - 9);
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.06)' : 'rgba(225,240,246,.6)'; ctx.fillRect(x - w / 2, top, w, h);
  if (rf > 0) { ctx.fillStyle = 'rgba(160,200,230,.6)'; ctx.beginPath(); ctx.moveTo(x - w / 2, rly); for (let xx = x - w / 2; xx <= x + w / 2; xx += 3) ctx.lineTo(xx, rly + (cur ? Math.sin(xx * .4 + t * 14) * F.ripple * 2 : 0)); ctx.lineTo(x + w / 2, bottom - 3); ctx.lineTo(x - w / 2, bottom - 3); ctx.fill(); }
  ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - w / 2, top); ctx.lineTo(x - w / 2, bottom - 3); ctx.lineTo(x + w / 2, bottom - 3); ctx.lineTo(x + w / 2, top); ctx.stroke(); ctx.fillStyle = Tk.glass; ctx.fillRect(x - w / 2 - 6, bottom - 3, w + 12, 3);
  ctx.lineWidth = 1; ctx.globalAlpha = .6; for (let k = 1; k < 8; k++) { const yy = bottom - 3 - k * (h - 9) / 8; ctx.beginPath(); ctx.moveTo(x - w / 2 + 2, yy); ctx.lineTo(x - w / 2 + (k % 2 ? 7 : 12), yy); ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.fillStyle = Tk.dark ? '#C8D3CF' : '#E7ECEA'; ctx.font = '600 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lbl, x, bottom + 14); ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillText(fmt(rv, 1) + ' mL' + (meas != null ? ' · ' + Math.round(meas) + '%' : ''), x, bottom + 27); ctx.textAlign = 'left';
}
function drawDistBase(ctx, sc, d, dt, t, fcx, fcy, R, bench, potLevel) {
  const F = d.fx, Tk = tok(); const G = sc.geom(); const { neckTop, armY, C0, C1, L, ca } = G;
  wallAndBench(ctx, sc.W, sc.H, bench);
  // stand + clamp holding the flask, lab jack
  ctx.fillStyle = Tk.dark ? '#7E8A86' : '#59635F'; ctx.fillRect(40, 70, 6, bench - 70); ctx.fillRect(10, bench - 6, 80, 6); ctx.fillRect(43, neckTop + 40, fcx - 55, 5); ctx.fillRect(fcx - 16, neckTop + 34, 6, 16);
  ctx.fillRect(470, 220, 5, bench - 220); ctx.fillRect(445, bench - 6, 60, 6); ctx.fillRect(470, 300, 40, 4);
  ctx.fillRect(fcx - 50, 440, 100, 8); ctx.strokeStyle = Tk.dark ? '#7E8A86' : '#59635F'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fcx - 40, 448); ctx.lineTo(fcx + 40, bench - 8); ctx.moveTo(fcx + 40, 448); ctx.lineTo(fcx - 40, bench - 8); ctx.stroke(); ctx.fillRect(fcx - 50, bench - 8, 100, 8);
  const ly = potLevel(); const boiling = d.heating && d.boiling;
  // flask
  ctx.save(); ctx.beginPath(); ctx.arc(fcx, fcy, R, 0, 7); ctx.clip();
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.06)' : 'rgba(225,240,246,.55)'; ctx.fillRect(fcx - R, fcy - R, 2 * R, 2 * R);
  const lq = ctx.createLinearGradient(fcx - R, 0, fcx + R, 0); lq.addColorStop(0, 'rgba(150,190,215,.7)'); lq.addColorStop(.4, 'rgba(205,225,238,.55)'); lq.addColorStop(1, 'rgba(140,180,210,.75)');
  ctx.fillStyle = lq; const wv = boiling ? 1.6 : .3; ctx.beginPath(); ctx.moveTo(fcx - R, ly); for (let xx = fcx - R; xx <= fcx + R; xx += 4) ctx.lineTo(xx, ly + Math.sin(xx * .15 + t * 9) * wv); ctx.lineTo(fcx + R, fcy + R); ctx.lineTo(fcx - R, fcy + R); ctx.fill();
  if (d.chips) { ctx.fillStyle = Tk.dark ? '#6F7A75' : '#8A948F'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(fcx - 20 + k * 8, fcy + R - 5 - (k % 2) * 2, 2.4, 0, 7); ctx.fill(); } }
  if (boiling && !RM) { const n = d.chips ? 34 : 6; F.bAcc = (F.bAcc || 0) + n * dt * (d.src === 'burner' ? 1.5 : d.src === 'bath' ? .7 : 1); while (F.bAcc > 1) { F.bAcc--; F.bubs.push({ x: d.chips ? fcx - 20 + Math.floor(rnd(0, 6)) * 8 + rnd(-2, 2) : fcx + rnd(-30, 30), y: fcy + R - 6, r: d.chips ? rnd(1, 2.6) : rnd(3, 7) }); } }
  for (let i = F.bubs.length - 1; i >= 0; i--) { const b = F.bubs[i]; b.y -= (25 + b.r * 12) * dt; b.x += Math.sin(t * 6 + i) * .4; if (b.y < ly) { F.bubs.splice(i, 1); if (b.r > 4) for (let k = 0; k < 4; k++) F.spl.push({ x: b.x, y: ly, vx: rnd(-40, 40), vy: -rnd(40, 110), life: 0 }); continue; } ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke(); }
  if (boiling && Math.random() < dt * 8) F.vap.push({ x: fcx + rnd(-20, 20), y: ly - 4, life: 0, r: rnd(4, 8) });
  for (let i = F.vap.length - 1; i >= 0; i--) { const p = F.vap[i]; p.life += dt; if (p.life > 1.4) { F.vap.splice(i, 1); continue; } p.y -= 30 * dt; p.x += (fcx - p.x) * dt; const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); rg.addColorStop(0, `rgba(255,255,255,${.25 * (1 - p.life / 1.4)})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rg; ctx.fillRect(p.x - p.r, p.y - p.r, 2 * p.r, 2 * p.r); }
  ctx.restore();
  ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(fcx, fcy, R, -Math.PI / 2 + .2, -Math.PI / 2 - .2 + Math.PI * 2); ctx.stroke();
  const hl = ctx.createRadialGradient(fcx - 25, fcy - 25, 2, fcx - 25, fcy - 25, 30); hl.addColorStop(0, `rgba(255,255,255,${Tk.dark ? .18 : .6})`); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(fcx - 25, fcy - 25, 30, 0, 7); ctx.fill();
  // neck / column
  const nx0 = fcx - 12, nx1 = fcx + 12, ny1 = fcy - R + 4;
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.06)' : 'rgba(225,240,246,.55)'; ctx.fillRect(nx0, neckTop, 24, ny1 - neckTop);
  if (d.column) { ctx.strokeStyle = Tk.glass; ctx.globalAlpha = .5; ctx.lineWidth = 1; for (let yy = neckTop + 18; yy < ny1 - 6; yy += 9) { ctx.beginPath(); ctx.moveTo(nx0 + 1, yy); ctx.lineTo(nx1 - 1, yy + 5); ctx.stroke(); } ctx.globalAlpha = 1; }
  const ringY = ly - 2 - Math.min(1.25, d.ring || 0) * (ly - 2 - armY);
  if ((d.ring || 0) > 0.02) { ctx.fillStyle = 'rgba(160,200,230,.18)'; ctx.fillRect(nx0 + 1, Math.max(neckTop, ringY), 22, ny1 - Math.max(neckTop, ringY)); if (ringY > neckTop && ringY < ny1) { ctx.fillStyle = 'rgba(150,195,230,.9)'; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(nx0 + 2 + k * 3.3, ringY + Math.sin(k * 2 + t * 3) * 1.5, 1.4, 0, 7); ctx.fill(); } } }
  ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(nx0, ny1 + 2); ctx.lineTo(nx0, neckTop); ctx.moveTo(nx1, ny1 + 2); ctx.lineTo(nx1, armY + 6); ctx.moveTo(nx1, armY - 6); ctx.lineTo(nx1, neckTop); ctx.stroke();
  ctx.lineWidth = 12; ctx.strokeStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(205,225,232,.8)'; ctx.beginPath(); ctx.moveTo(nx1, armY); ctx.lineTo(C0[0], C0[1]); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.strokeStyle = Tk.glass; const ang = Math.atan2(C0[1] - armY, C0[0] - nx1); const ox = Math.sin(ang) * 6, oy = -Math.cos(ang) * 6;
  ctx.beginPath(); ctx.moveTo(nx1 + ox, armY + oy); ctx.lineTo(C0[0] + ox, C0[1] + oy); ctx.moveTo(nx1 - ox, armY - oy); ctx.lineTo(C0[0] - ox, C0[1] - oy); ctx.stroke();
  ctx.fillStyle = Tk.dark ? '#5A4A3E' : '#8B6B52'; ctx.fillRect(nx0 - 3, neckTop - 12, 30, 14);
  // condenser
  ctx.save(); ctx.translate(C0[0], C0[1]); ctx.rotate(ca);
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.08)' : 'rgba(225,240,246,.6)'; ctx.fillRect(18, -17, L - 36, 34);
  const wet = d.tap && d.water; const fillFrac = !wet ? 0 : d.water === 'bottom' ? 1 : .5;
  if (fillFrac > 0) {
    ctx.fillStyle = 'rgba(80,150,230,.30)'; const fx0 = fillFrac === 1 ? 18 : 18 + (L - 36) * .5; ctx.fillRect(fx0, -16, L - 18 - fx0, 32);
    F.flow += dt * (d.water === 'bottom' ? -1 : 1) * 40; ctx.strokeStyle = 'rgba(60,130,220,.55)'; ctx.lineWidth = 1.4;
    for (let k = 0; k < 14; k++) { const px = 24 + ((k * 22 + F.flow) % (L - 48) + (L - 48)) % (L - 48); if (px < fx0 + 4) continue; const sg = d.water === 'bottom' ? -1 : 1; ctx.beginPath(); ctx.moveTo(px - 3 * sg, -10); ctx.lineTo(px + 3 * sg, -6); ctx.lineTo(px - 3 * sg, -2); ctx.moveTo(px - 3 * sg, 4); ctx.lineTo(px + 3 * sg, 8); ctx.lineTo(px - 3 * sg, 12); ctx.stroke(); }
  }
  ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.7; ctx.strokeRect(18, -17, L - 36, 34);
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.1)' : 'rgba(240,248,250,.9)'; ctx.fillRect(0, -5, L + 14, 10); ctx.strokeRect(0, -5, L + 14, 10);
  ctx.fillStyle = Tk.glass; ctx.fillRect(L - 44, 17, 8, 6); ctx.fillRect(36, -23, 8, 6);
  for (let i = F.cd.length - 1; i >= 0; i--) { const p = F.cd[i]; p.x += 70 * dt; if (p.x > L + 10) { F.cd.splice(i, 1); F.drips.push({ y: 0, vy: 0 }); continue; } ctx.fillStyle = 'rgba(140,190,230,.95)'; ctx.beginPath(); ctx.ellipse(p.x, 2.5, 3, 1.8, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  // outlet hose from the other nipple to the sink
  if (d.water) { const p = d.water === 'bottom' ? G.nHigh : G.nLow; ctx.strokeStyle = Tk.dark ? '#8C6A4A' : '#7A5A3A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.bezierCurveTo(p[0], p[1] - 60, 980, 120, 975, 640); ctx.stroke(); }
  // adapter + drips
  const oe = G.outEnd, sx = oe[0] + 18, ryTop = bench - 82;
  ctx.strokeStyle = Tk.glass; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(oe[0], oe[1]); ctx.quadraticCurveTo(oe[0] + 18, oe[1] + 2, sx, ryTop - 8); ctx.stroke();
  F.ripple *= Math.exp(-dt * 3);
  const recObj = d.cur >= 0 ? sc.objs.find(o => o.kind === 'rec' && o.i === d.cur) : null;
  const rec = recObj ? d.rec[d.cur] : null; const rly = rec ? bench - 3 - Math.min(1, mixVol(rec.nE, rec.nW) / 40) * 73 : bench;
  for (let i = F.drips.length - 1; i >= 0; i--) { const p = F.drips[i]; p.vy += 600 * dt; p.y += p.vy * dt; const yy = ryTop - 8 + p.y; if (yy > rly) { F.drips.splice(i, 1); F.ripple = 1; continue; } ctx.fillStyle = 'rgba(130,185,230,.95)'; ctx.beginPath(); ctx.arc(sx, yy, 2.2, 0, 7); ctx.fill(); }
  if ((d.rateMl || 0) > 0 && d.heating) { F.cdAcc = (F.cdAcc || 0) + d.rateMl * dt * 14 * Math.max(1, d.speed / 6); while (F.cdAcc > 1) { F.cdAcc--; F.cd.push({ x: rnd(0, 20) }); } }
  if ((d.escMl || 0) > 0 && d.heating && Math.random() < dt * 12) F.esc.push({ x: sx + rnd(-8, 8), y: ryTop - 6, r: 5, life: 0 });
  for (let i = F.esc.length - 1; i >= 0; i--) { const p = F.esc[i]; p.life += dt; if (p.life > 1.8) { F.esc.splice(i, 1); continue; } p.y -= 30 * dt; p.r += 8 * dt; p.x += Math.sin(t * 3 + i) * 10 * dt; const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); rg.addColorStop(0, `rgba(235,240,245,${.35 * (1 - p.life / 1.8)})`); rg.addColorStop(1, 'rgba(235,240,245,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  if (d.bumpFx > 0) { d.bumpFx -= dt; for (let k = 0; k < 5; k++) F.spl.push({ x: fcx + rnd(-10, 10), y: ly - 2, vx: rnd(-30, 30), vy: -rnd(150, 280), life: 0 }); }
  for (let i = F.spl.length - 1; i >= 0; i--) { const s = F.spl[i]; s.life += dt; s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.x = clamp(s.x, fcx - R + 4, fcx + R - 4); if (s.y > ly && s.vy > 0 || s.life > 1.5) { F.spl.splice(i, 1); continue; } ctx.fillStyle = 'rgba(150,195,225,.85)'; ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, 7); ctx.fill(); }
  // speed / time label
  ctx.fillStyle = Tk.muted; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText('t = ' + mmss(d.t), 14, 22);
}

/* ===================== COMBUSTION ANALYSIS SCENE (org3) ===================== */
function anScene2(run) {
  if (run.scene && run.scene.kind === 'an') return run.scene;
  const a = run.an, s = run.secret; const W = 900, H = 380, bench = 300;
  const sc = run.scene = { kind: 'an', W, H, objs: [], drops: [], ptr: { x: 0, y: 0 } };
  a.supply = null; a.slots = [null, null]; a.w0 = {}; a.w1 = {}; a.gain = { cacl2: 0, naoh: 0 }; a.burned = false; a.m0 = { cacl2: Math.round((25 + Math.random() * 3) * 1e4) / 1e4, naoh: Math.round((31 + Math.random() * 3) * 1e4) / 1e4 }; a.onPan = null; a.fx = { flame: { p: [], s: [] }, gas: [], soot: 0 };
  const FUR = { x0: 220, x1: 420, y: 170 }, SLOT = [500, 650], BAL = { x: 800, y: 246 };
  const O2 = { x: 50, valve: [62, 92] }, PUMP = { x: 140, nozzle: [170, 256] };
  const hose = { kind: 'hose', x: 190, y: 240, hx: 190, hy: 240, z: 30, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 12, this.y - 12, this.x + 12, this.y + 12); },
    label() { return T('obj.supplyHose'); },
    pick() { if (a.supply) { a.supply = null; } this.stay = false; return this; },
    drop() { for (const [nm, p] of [['o2', O2.valve], ['air', PUMP.nozzle]]) if (Math.hypot(this.x - p[0], this.y - p[1]) < 30) { a.supply = nm; this.x = p[0]; this.y = p[1]; this.stay = true; logE('info', [['log.supply', { s: { k: nm === 'o2' ? 'an.o2' : 'an.air' } }]]); logDirty = true; return; } },
    draw(ctx) { const Tk = tok(); ctx.strokeStyle = Tk.dark ? '#8C6A4A' : '#7A5A3A'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(FUR.x0, FUR.y); ctx.bezierCurveTo(FUR.x0 - 40, FUR.y, this.x + 10, this.y - 60, this.x, this.y); ctx.stroke(); ctx.fillStyle = '#5A4030'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, 7); ctx.fill(); } };
  const tubeObj = id => ({ kind: 'abs', id, x: id === 'cacl2' ? 480 : 610, y: bench - 18, hx: id === 'cacl2' ? 480 : 610, hy: bench - 18, z: 32, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 56, this.y - 20, this.x + 56, this.y + 20); },
    label() { return T(id === 'cacl2' ? 'obj.tubeCa' : 'obj.tubeNa'); },
    pick() { if (busy(run)) { toast(T('tip.busy'), 'err'); return null; } const i = a.slots.indexOf(id); if (i >= 0) a.slots[i] = null; if (a.onPan === id) a.onPan = null; this.stay = false; return this; },
    drop() {
      for (let i = 0; i < 2; i++) if (!a.slots[i] && Math.abs(this.x - SLOT[i]) < 50 && Math.abs(this.y - FUR.y) < 40) { a.slots[i] = id; this.x = SLOT[i]; this.y = FUR.y; this.stay = true; logE('info', [['log.slot', { t: id === 'cacl2' ? 'CaCl₂' : 'NaOH', n: i + 1 }]]); logDirty = true; return; }
      if (!a.onPan && Math.abs(this.x - BAL.x) < 55 && Math.abs(this.y - BAL.y) < 40) { a.onPan = id; this.x = BAL.x; this.y = BAL.y - 22; this.stay = true; const m = a.m0[id] + (a.burned ? a.gain[id] : 0); const mm = Math.round(m * 1e4) / 1e4; (a.burned ? a.w1 : a.w0)[id] = mm; logE('obs', [['an.logWeighed', { t: id === 'cacl2' ? 'CaCl₂' : 'NaOH', m: fmt(mm, 4) }]]); logDirty = true; refreshSide(); return; }
    },
    draw(ctx) { const Tk = tok(); ctx.translate(this.x, this.y); ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.75)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(-55, -18, 110, 36); ctx.fill(); ctx.stroke();
      const sat = id === 'cacl2' ? (a.burned && a.gain.cacl2 > .001 ? .6 : 0) : (a.burned ? .6 : 0); const base = id === 'cacl2' ? [240, 240, 236] : [235, 235, 238], used = id === 'cacl2' ? [175, 185, 190] : [205, 190, 215];
      for (let k = 0; k < 64; k++) { const gx = -50 + (k * 37 % 100), gy = -14 + (k * 13 % 28); ctx.fillStyle = rgba(lerpC(base, used, (gx + 55) / 110 < sat ? 1 : 0), .95); ctx.beginPath(); ctx.arc(gx, gy, 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = Tk.ink; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(id === 'cacl2' ? 'CaCl₂' : 'NaOH', 0, 32); ctx.textAlign = 'left'; } });
  const sw = { kind: 'switch', x: 320, y: 212, z: 20,
    hit(px, py) { return inRect(px, py, this.x - 16, this.y - 12, this.x + 16, this.y + 12); },
    label() { return T('obj.switch'); },
    tap() {
      if (!needGoggles()) return; if (busy(run)) return;
      if (a.burned) { toast(T('tip.newSample'), 'err'); return; }
      if (!a.supply || !a.slots[0] || !a.slots[1]) { toast(T('tip.notPlaced'), 'err'); return; }
      if (a.w0.cacl2 == null || a.w0.naoh == null) mistake('noWeigh');
      const n = s.m / s.M; let mCO2 = n * s.x * 44.01, mH2O = n * s.y / 2 * 18.015;
      if (a.supply === 'air') { mCO2 *= .7; mistake('lowO2', null, false); logE('obs', [['obs.smoky']]); } else logE('obs', [['obs.cleanBurn']]);
      const noise = () => (Math.random() - .5) * .0002;
      if (a.slots[0] === 'cacl2') { a.gain.cacl2 = mH2O + noise(); a.gain.naoh = mCO2 + noise(); a.order = 'cacl2'; }
      else { a.gain.naoh = mCO2 + mH2O + noise(); a.gain.cacl2 = .0001; a.order = 'naoh'; mistake('wrongOrder', null, false); }
      addJob(run, { kind: 'burn', dur: 3.5, end: () => { a.burned = true; logE('info', [['an.burnt']]); } }); logDirty = true;
    },
    draw(ctx) { ctx.fillStyle = '#333'; ctx.fillRect(this.x - 14, this.y - 10, 28, 20); ctx.fillStyle = busy(run) ? '#E4572E' : '#888'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, 7); ctx.fill(); } };
  const jar = { kind: 'sample', x: 300, y: bench, hx: 300, hy: bench, z: 25, drag: true,
    hit(px, py) { return inRect(px, py, this.x - 18, this.y - 36, this.x + 18, this.y); },
    label() { return T('obj.sample'); },
    drop() { if (this.x > FUR.x0 && this.x < FUR.x1 && Math.abs(this.y - FUR.y) < 50) { a.burned = false; a.gain = { cacl2: 0, naoh: 0 }; a.w1 = {}; a.fx.soot = 0; logE('info', [['an.logNew']]); logDirty = true; refreshSide(); } },
    draw(ctx) { const Tk = tok(); ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.12)' : 'rgba(225,240,246,.8)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.4; ctx.fillRect(this.x - 16, this.y - 32, 32, 32); ctx.strokeRect(this.x - 16, this.y - 32, 32, 32); ctx.fillStyle = 'rgba(200,200,190,.6)'; ctx.fillRect(this.x - 15, this.y - 14, 30, 13); ctx.fillStyle = '#6C7773'; ctx.fillRect(this.x - 17, this.y - 38, 34, 7); } };
  sc.objs.push(hose, tubeObj('cacl2'), tubeObj('naoh'), sw, jar); addGoggles(sc, 500, 40);
  sc.bg = (ctx, dt, t) => {
    const Tk = tok(); wallAndBench(ctx, W, H, bench);
    // O2 cylinder + pump
    ctx.fillStyle = '#2E7D4A'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(O2.x - 20, 100, 40, bench - 100, 14) : ctx.rect(O2.x - 20, 100, 40, bench - 100); ctx.fill(); ctx.fillStyle = '#555'; ctx.fillRect(O2.x - 6, 84, 12, 18); ctx.fillRect(O2.valve[0] - 4, O2.valve[1] - 4, 10, 8);
    ctx.fillStyle = '#fff'; ctx.font = '700 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('O₂', O2.x, 170); ctx.textAlign = 'left';
    ctx.fillStyle = Tk.dark ? '#46524E' : '#8E9894'; ctx.fillRect(PUMP.x - 28, 256, 56, 44); ctx.fillStyle = '#555'; ctx.fillRect(PUMP.nozzle[0] - 4, PUMP.nozzle[1] - 4, 12, 8); ctx.fillStyle = Tk.ink; ctx.font = '600 9px "IBM Plex Sans", sans-serif'; ctx.fillText(T('an.airShort'), PUMP.x - 12, 284);
    // furnace
    const j = run.jobs && run.jobs.find(x => x.kind === 'burn'); const on = !!j; const glow = on ? .6 + .15 * Math.sin(t * 6) : 0;
    ctx.fillStyle = Tk.dark ? '#2D3633' : '#9AA4A0'; ctx.fillRect(FUR.x0 + 10, FUR.y + 26, FUR.x1 - FUR.x0 - 20, 54);
    ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.1)' : 'rgba(225,240,246,.8)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(FUR.x0, FUR.y - 17, FUR.x1 - FUR.x0, 34); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = glow ? rgba([255, 110 + 60 * glow, 40], .4 + glow * .6) : Tk.line; ctx.lineWidth = 2; for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.ellipse(FUR.x0 + 18 + k * 13, FUR.y, 4, 20, 0, 0, 7); ctx.stroke(); }
    if (a.supply === 'o2') { ctx.fillStyle = '#2F2723'; for (let k = 0; k < 18; k++) ctx.fillRect(FUR.x1 - 70 + (k % 9) * 6, FUR.y - 10 + Math.floor(k / 9) * 14, 3, 3); }
    ctx.fillStyle = Tk.dark ? '#CFCBC2' : '#ECE8DE'; ctx.beginPath(); ctx.moveTo(FUR.x0 + 40, FUR.y + 4); ctx.lineTo(FUR.x0 + 80, FUR.y + 4); ctx.lineTo(FUR.x0 + 74, FUR.y + 12); ctx.lineTo(FUR.x0 + 46, FUR.y + 12); ctx.closePath(); ctx.fill();
    drawFlame(ctx, a.fx.flame, FUR.x0 + 60, FUR.y + 4, .35, a.supply === 'air' ? 1 : 0, dt, t, on ? 1 : 0);
    if (on && a.supply === 'air') a.fx.soot = Math.min(1, a.fx.soot + dt * .3); if (a.fx.soot > 0) { ctx.fillStyle = `rgba(25,22,20,${a.fx.soot * .6})`; ctx.fillRect(FUR.x0 + 82, FUR.y - 16, 90, 6); }
    // train tubing + slot outlines
    ctx.strokeStyle = Tk.glass; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(FUR.x1, FUR.y); ctx.lineTo(SLOT[0] - 56, FUR.y); ctx.moveTo(SLOT[0] + 56, FUR.y); ctx.lineTo(SLOT[1] - 56, FUR.y); ctx.moveTo(SLOT[1] + 56, FUR.y); ctx.lineTo(760, FUR.y); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1; for (let i = 0; i < 2; i++) if (!a.slots[i]) { ctx.strokeRect(SLOT[i] - 55, FUR.y - 18, 110, 36); ctx.fillStyle = Tk.muted; ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), SLOT[i], FUR.y + 4); ctx.textAlign = 'left'; } ctx.setLineDash([]);
    if (on && Math.random() < dt * 30) a.fx.gas.push({ x: FUR.x1 });
    for (let i = a.fx.gas.length - 1; i >= 0; i--) { const g = a.fx.gas[i]; g.x += 90 * dt; if (g.x > 760) { a.fx.gas.splice(i, 1); continue; } ctx.fillStyle = 'rgba(200,200,200,.6)'; ctx.beginPath(); ctx.arc(g.x, FUR.y + Math.sin(g.x * .1) * 4, 1.6, 0, 7); ctx.fill(); }
    // balance
    ctx.fillStyle = Tk.dark ? '#3A4542' : '#C9D1CE'; ctx.fillRect(BAL.x - 60, BAL.y, 120, bench - BAL.y); ctx.fillStyle = Tk.dark ? '#9AA5A1' : '#6F7A76'; ctx.fillRect(BAL.x - 48, BAL.y - 4, 96, 5);
    ctx.fillStyle = '#1B2B23'; ctx.fillRect(BAL.x - 40, BAL.y + 16, 80, 22); ctx.fillStyle = '#9FF0B8'; ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    const m = a.onPan ? a.m0[a.onPan] + (a.burned ? a.gain[a.onPan] : 0) : 0; ctx.fillText(fmt(m, 4) + ' g', BAL.x, BAL.y + 32); ctx.textAlign = 'left';
  };
  return sc;
}
