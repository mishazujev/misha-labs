/* ===================== BENCH SCENE (bottles, tubes, lamp, papers, meter, burette) ===================== */
function benchLayout(run, wide) {
  const hasBur = run.shelf.some(b => b.burette);
  if (wide) {
    const bench = 560, wick = bench - 45;
    return { W: 1000, H: 610, bench, wick, tubeTop: wick - 17 - 168, slots: i => 300 + i * 48, beaker: [420, wick - 62 - 132], flaskTop: bench - 160, flaskSlots: [360, 500],
      bur: { x: 360, top: 70, tip: bench - 166 }, shelf: { x0: 640, dx: 58, rows: [190, 340], per: 6 }, lamp: [650, wick], paper: [728, 548], litmus: [792, 548], meter: [858, 498], electrode: [906, 520], waste: [962, bench - 82], strips: [700, bench + 8], hook: [262, 46], inset: [14, 14, 200, 292] };
  }
  const bench = 640, wick = bench - 45;
  return { W: 560, H: 860, bench, wick, tubeTop: wick - 17 - 168, slots: i => 80 + i * 70, beaker: [280, wick - 62 - 132], flaskTop: bench - 160, flaskSlots: [200, 350],
    bur: { x: 200, top: hasBur ? 300 : 300, tip: bench - 166 }, shelf: { x0: 205, dx: 58, rows: [140, 290], per: 6 }, lamp: [70, 724], paper: [170, 780], litmus: [236, 780], meter: [320, 730], electrode: [372, 752], waste: [482, 722], strips: [150, 812], hook: [300, 26], inset: [10, 10, 160, 230] };
}
function benchScene(run) {
  if (run.scene && run.scene.kind === 'bench') return run.scene;
  const wide = isWide(); const L = benchLayout(run, wide);
  const sc = run.scene = { kind: 'bench', W: L.W, H: L.H, L, objs: [], drops: [], strips: [], ptr: { x: 0, y: 0 } };
  const hasHeat = run.tools.includes('heat');
  // ---- vessels
  run.vessels.forEach((v, i) => {
    const g = geoFor(v);
    let x, y;
    if (v.kind === 'tube') { x = L.slots(i); y = L.tubeTop; }
    else if (v.kind === 'beaker') { x = L.beaker[0]; y = L.beaker[1]; }
    else { x = L.flaskSlots[i]; y = L.flaskTop; }
    const o = { kind: 'vessel', v, x, y, hx: x, hy: y, vx: x, vy: y, ang: 0, z: 20, drag: true,
      hit(px, py) { return inRect(px, py, this.x - g.r - 6, this.y - 8, this.x + g.r + 6, this.y + (g.bot - g.top) + 6); },
      label() { return (this.held ? (this.target && this.target.kind === 'waste' ? T('obj.toWaste') : T('obj.tubeHeld')) : T('obj.vessel', { v: T('v.' + v.kind) + ' ' + v.label })) + (v.V > 0.01 ? ' · ' + fmt(v.V, 2) + ' mL' : ''); },
      pick() { if (!needGoggles()) return null; this.vx = this.x; this.vy = this.y; detachFrom(sc, v); S.run.focus = v; return this; },
      hold(dt, t) {
        if (v.kind === 'flask') { this.vx = this.x; this.vy = this.y; return; }
        const before = v.V;
        pourHold(sc, this, dt, t, { comp: () => compOfVessel(v), take: d => removeLiquid(v, d), maxRate: 3 });
        if (before > 0 && v.V === 0 && this.target && this.target.kind === 'waste') { endPour(); logE('info', [['log.dump', { v: v.label }]]); logDirty = true; }
      },
      drop() {
        endPour();
        if (v.kind === 'flask') { // snap to nearest flask slot, swap if taken
          const slots = L.flaskSlots; let best = 0; slots.forEach((sx, k) => { if (Math.abs(this.x - sx) < Math.abs(this.x - slots[best])) best = k; });
          const other = sc.objs.find(q => q !== this && q.kind === 'vessel' && q.v.kind === 'flask' && q.hx === slots[best]);
          if (other) { other.hx = this.hx; other.returning = true; detachFrom(sc, other.v); }
          this.hx = slots[best];
        }
      },
      draw(ctx, dt, t) {
        if (this.held && this.ang > 0.5) { ctx.translate(this.vx, this.vy); ctx.rotate(-this.ang * Math.PI / 180); ctx.translate(-g.cx, -g.top); drawVessel(ctx, v, g, dt, t, { tilt: this.ang * Math.PI / 180, noLamp: true }); }
        else { const px = this.held ? this.vx : this.x, py = this.held ? this.vy : this.y; ctx.translate(px - g.cx, py - g.top); drawVessel(ctx, v, g, dt, t, { noLamp: true }); }
        if (this.held && this.flowing && this.target) { ctx.setTransform(ctx.getTransform()); }
      } };
    sc.objs.push(o);
  });
  // stream from a tilted tube is drawn in fg
  // ---- rack (front bars drawn above tubes)
  if (run.vessels.some(v => v.kind === 'tube')) sc.objs.push({ kind: 'deco', z: 22, draw(ctx) { rackFront(ctx, sc); } });
  // ---- shelf bottles
  const per = L.shelf.per;
  run.shelf.forEach((b, i) => {
    const row = Math.floor(i / per), col = i % per;
    const bx = L.shelf.x0 + col * L.shelf.dx; const rowY = L.shelf.rows[row] || L.shelf.rows[1];
    if (b.ind || b.pipette) {
      const small = !!b.ind; const bh = small ? 58 : 90, bw = small ? 30 : 40;
      const sy = rowY - bh;
      sc.objs.push({ kind: 'deco', z: 30, draw(ctx) { drawBottle(ctx, b, bx, sy, 0, false, { w: bw, h: bh, rgb: streamRGB(b), noCap: true }); } });
      const tipHome = [bx, sy + (small ? 46 : 86)];
      const o = { kind: b.ind ? 'dropper' : 'pipette', b, x: tipHome[0], y: tipHome[1], hx: tipHome[0], hy: tipHome[1], z: 31, drag: true, sq: 0, left: 10, acc: 0,
        hit(px, py) { return b.ind ? inRect(px, py, this.x - 10, this.y - 74, this.x + 10, this.y - 30) || inRect(px, py, bx - bw / 2, sy, bx + bw / 2, rowY) : inRect(px, py, this.x - 10, this.y - 156, this.x + 10, this.y - 30) || inRect(px, py, bx - bw / 2, sy, bx + bw / 2, rowY); },
        label() { return T(b.ind ? 'obj.dropper' : 'obj.pipette', { n: T(b.nameKey) }); },
        pick() { if (!needGoggles()) return null; return this; },
        hold(dt) {
          const tg = vesselAt(sc, this.x, this.y + (b.ind ? 0 : 0), 6);
          this.tg = tg && tg.kind === 'vessel' ? tg : null;
          if (this.tg) {
            const k = 1 - Math.exp(-dt * 14); const tx = this.tg.x, ty = this.tg.y - (b.ind ? 8 : -20);
            this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
            if (b.ind) { this.acc += dt; this.sq = Math.min(1, this.sq + dt * 3); if (this.acc > .5) { this.acc = 0; sc.drops.push({ x: this.x, y: this.y + 2, vy: 0, dV: 0.05, comp: compOfBottle(b), tg: { kind: 'vessel', o: this.tg } }); } }
            else if (this.left > 0) { const dV = Math.min(this.left, 4 * dt); this.left -= dV; addLiquid(this.tg.v, compOfBottle(b), dV); const g = geoFor(this.tg.v); vfx(this.tg.v).inflow = { x: g.cx, rate: 1, rgb: streamRGB(b), t: FXR.last / 1000 }; }
          } else { this.sq = Math.max(0, this.sq - dt * 4); this.acc = .35; }
        },
        drop() { endPour(); this.left = 10; this.sq = 0; },
        draw(ctx) { const atHome = !this.held && Math.abs(this.x - this.hx) < 1 && Math.abs(this.y - this.hy) < 1; if (atHome) { ctx.beginPath(); ctx.rect(0, 0, sc.W, sy + (b.ind ? 16 : 14)); ctx.clip(); } if (b.ind) drawDropper(ctx, this.x, this.y, streamRGB(b), this.sq * (.6 + .4 * Math.sin(this.acc * 12.5)), this.held ? .6 : .2); else drawPipette(ctx, this.x, this.y, streamRGB(b), this.held ? this.left / 10 : 0); } };
      sc.objs.push(o);
    } else {
      const sy = rowY - 90;
      const o = { kind: 'bottle', b, x: bx, y: sy, hx: bx, hy: sy, vx: bx, vy: sy, ang: 0, z: 30, drag: true, rgb: streamRGB(b),
        hit(px, py) { return inRect(px, py, this.x - 22, this.y - 8, this.x + 22, this.y + 92); },
        label() { return this.held ? (this.target ? (this.target.kind === 'burette' ? T('obj.toBurette') : T('obj.pouring')) : T('obj.bringClose')) : T(b.burette ? 'obj.buretteBottle' : 'obj.bottle', { n: b.k === 'unk' ? T('ans.bottle', { x: b.f }) : T(b.nameKey) }); },
        pick() { if (!needGoggles()) return null; this.vx = this.x; this.vy = this.y; return this; },
        hold(dt, t) { pourHold(sc, this, dt, t, { comp: () => compOfBottle(b), take: d => d, maxRate: 2.6 }); },
        drop() { endPour(); if (S.run.flags.refilled) { S.run.flags.refilled = false; logE('info', [['log.refillTo', { x: fmt(S.run.burette.used, 2) }]]); logDirty = true; } },
        draw(ctx) {
          const px = this.held ? this.vx : this.x, py = this.held ? this.vy : this.y;
          if (this.held && this.flowing && this.target) { const tg = this.target; const y1 = tg.kind === 'vessel' ? vesselSurfaceWorld(tg.o) : tg.kind === 'waste' ? sc.waste.top + 34 : sc.burette.top + 4; drawStream(ctx, px, py + 1, px, y1, this.rgb, 1.4 + this.flowing * .9); }
          drawBottle(ctx, b, px, py, this.ang || 0, this.held, { rgb: this.rgb });
        } };
      sc.objs.push(o);
    }
  });
  // ---- spirit lamp
  if (hasHeat) {
    const lamp = { kind: 'lamp', x: L.lamp[0], y: L.lamp[1], hx: L.lamp[0], hy: L.lamp[1], z: 24, drag: true, att: null, F: { p: [], s: [] },
      hit(px, py) { return inRect(px, py, this.x - 28, this.y - 10, this.x + 28, this.y + 42); },
      label() { return this.att ? T('obj.lampOn', { v: this.att.label }) : T('obj.lamp'); },
      pick() { if (!needGoggles()) return null; if (this.att) { const v = this.att; v.heating = false; this.att = null; logE('info', [['log.lampOff', { v: v.label }]]); logDirty = true; } this.stay = false; return this; },
      drop() {
        for (const o of sc.objs) if (o.kind === 'vessel' && !o.held) {
          const bot = vesselBottomWorld(o);
          if (Math.abs(this.x - o.x) < 42 && this.y > bot - 10 && this.y < bot + 90 && o.v.kind !== 'flask') {
            this.x = o.x; this.y = L.wick; this.att = o.v; this.stay = true; o.v.heating = true; S.run.focus = o.v;
            logE('info', [['log.lampOn', { v: o.v.label }]]); if (o.v.kind === 'tube' && o.v.V > o.v.cap / 3) mistake('heatFull', null, false); logDirty = true; return;
          }
        }
      },
      draw(ctx, dt, t) { drawLamp(ctx, this.x, this.y, 1); if (!this.att && !this.held) { ctx.fillStyle = '#6C7773'; ctx.fillRect(this.x - 7, this.y - 6, 14, 12); } drawFlame(ctx, this.F, this.x, this.y - 3, .9, 2, dt, t, this.att ? 1 : 0); } };
    sc.objs.push(lamp); sc.lamp = lamp;
  }
  // ---- waste beaker (when tubes are used)
  if (run.vessels.some(v => v.kind === 'tube')) {
    sc.waste = { x: L.waste[0], top: L.waste[1] };
    sc.objs.push({ kind: 'deco', z: 18, hit(px, py) { return inRect(px, py, sc.waste.x - 30, sc.waste.top, sc.waste.x + 30, sc.waste.top + 82); }, label() { return T('obj.waste'); }, draw(ctx) { drawWaste(ctx, sc.waste.x, sc.waste.top); } });
  }
  // ---- pH paper / litmus
  for (const kind of ['phPaper', 'litmusPaper']) if (run.tools.includes(kind)) {
    const pos = kind === 'phPaper' ? L.paper : L.litmus;
    sc.objs.push({ kind: 'paperbox', z: 26, x: pos[0], y: pos[1], drag: true,
      hit(px, py) { return inRect(px, py, this.x - 26, this.y - 22, this.x + 26, this.y + 14); },
      label() { return T(kind === 'phPaper' ? 'obj.phPaper' : 'obj.litmus'); },
      pick(p) { if (!needGoggles()) return null; return makeStrip(sc, kind, p); },
      draw(ctx) { drawPaperBox(ctx, this.x, this.y, kind); } });
  }
  // ---- pH meter
  if (run.tools.includes('phMeter') || run.tools.includes('phMeterLive')) addMeter(sc, L);
  // ---- burette
  if (run.shelf.some(b => b.burette)) addBurette(sc, L, run);
  addGoggles(sc, L.hook[0], L.hook[1]);
  sc.bg = (ctx, dt, t) => benchBg(ctx, sc, dt, t);
  sc.fg = (ctx, dt, t) => benchFg(ctx, sc, dt, t);
  sc.update = (dt, t) => { eqStep(sc, t); if (sc.burette) buretteFlow(sc, dt); meterUpdate(sc, dt); };
  return sc;
}
function detachFrom(sc, v) {
  if (sc.lamp && sc.lamp.att === v) { v.heating = false; sc.lamp.att = null; sc.lamp.stay = false; sc.lamp.returning = true; logE('info', [['log.lampOff', { v: v.label }]]); logDirty = true; }
  const el = sc.objs.find(o => o.kind === 'electrode'); if (el && el.att === v) { el.att = null; el.stay = false; el.returning = true; v.meter = false; }
}
function rackFront(ctx, sc) {
  const L = sc.L, Tk = tok(); const x0 = L.slots(0) - 34, x1 = L.slots(5) + 34; const y1 = L.tubeTop + 40, y2 = L.tubeTop + 118;
  ctx.fillStyle = Tk.dark ? '#5B4A3C' : '#B08A64'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.fillRect(x0, y1, x1 - x0, 12); ctx.strokeRect(x0, y1, x1 - x0, 12);
  ctx.fillRect(x0, y2, x1 - x0, 8); ctx.strokeRect(x0, y2, x1 - x0, 8);
  ctx.fillStyle = Tk.dark ? '#4A3B30' : '#9C7854'; ctx.fillRect(x0, y1, 8, L.bench - y1); ctx.fillRect(x1 - 8, y1, 8, L.bench - y1);
  ctx.fillStyle = Tk.dark ? '#E8E2D8' : '#FFFFFF'; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  for (let i = 0; i < 6; i++) { const v = S.run.vessels[i]; if (!v) continue; ctx.fillText(String(i + 1), L.slots(i), y1 + 10); }
  ctx.textAlign = 'left';
}
function drawWaste(ctx, x, top) {
  const Tk = tok(); const w = 56, h = 80;
  ctx.fillStyle = Tk.dark ? 'rgba(170,205,220,.08)' : 'rgba(225,240,246,.6)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.rect(x - w / 2, top, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(150,140,120,.35)'; ctx.fillRect(x - w / 2 + 1, top + h - 18, w - 2, 17);
  ctx.fillStyle = Tk.dark ? '#E9EEEC' : '#fff'; ctx.fillRect(x - 22, top + 22, 44, 16); ctx.fillStyle = '#B3261E'; ctx.font = '700 9px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(T('lbl.waste').toUpperCase(), x, top + 33); ctx.textAlign = 'left';
}
function drawPaperBox(ctx, x, y, kind) {
  const Tk = tok();
  ctx.fillStyle = kind === 'phPaper' ? '#F2E6B8' : '#E9E4F2'; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  ctx.fillRect(x - 24, y - 18, 48, 28); ctx.strokeRect(x - 24, y - 18, 48, 28);
  if (kind === 'phPaper') for (let i = 0; i < 14; i++) { ctx.fillStyle = css(indColor('univ', i + 1).rgb, 1); ctx.fillRect(x - 22 + i * 3.15, y + 2, 3, 6); }
  else { ctx.fillStyle = '#C0392B'; ctx.fillRect(x - 18, y - 14, 5, 22); ctx.fillStyle = '#2E5FA8'; ctx.fillRect(x - 11, y - 14, 5, 22); }
  ctx.fillStyle = '#E8D9A0'; ctx.fillRect(x + 8, y - 26, 5, 12);
  ctx.fillStyle = '#333'; ctx.font = '600 7px "IBM Plex Sans", sans-serif'; ctx.fillText(kind === 'phPaper' ? 'pH 1–14' : 'LITMUS', x - 4, y - 6);
}
function makeStrip(sc, kind, p) {
  const s = { kind: 'strip', type: kind, x: p.x, y: p.y + 56, z: 45, drag: true, dispose: false, col: null, col2: null,
    label() { return T(kind === 'phPaper' ? 'obj.stripPh' : 'obj.stripLit'); },
    hold() { const o = liquidAt(sc, this.x, this.y - 3); if (o && !this.dippedIn) { this.dippedIn = o.v; const pH = o.v.eq.pH; S.run.focus = o.v;
      if (kind === 'phPaper') { const ic = indColor('univ', pH); this.col = ic.rgb; logE('obs', [['obs.paper', { c: { k: 'col.' + ic.key } }]], { v: o.v.label, amt: '', f: T('tool.phPaper') }); }
      else { this.col = pH > 8.3 ? [46, 95, 168] : [192, 57, 43]; this.col2 = pH < 5 ? [192, 57, 43] : [46, 95, 168]; logE('obs', [[pH < 5 ? 'obs.litAcid' : pH > 8.3 ? 'obs.litBase' : 'obs.litNeutral']], { v: o.v.label, amt: '', f: T('tool.litmusPaper') }); }
      logDirty = true; } },
    drop() { // lay it in the strip holder
      sc.strips.push(this); if (sc.strips.length > 6) { const old = sc.strips.shift(); sc.objs = sc.objs.filter(q => q !== old); }
      sc.strips.forEach((q, i) => { q.hx = sc.L.strips[0] + i * 16; q.hy = sc.L.strips[1] + 40; q.returning = true; q.drag = false; q.hit = null; q.z = 19; });
      this.stay = false; if (!this.dippedIn) { sc.strips.pop(); sc.objs = sc.objs.filter(q => q !== this); }
    },
    draw(ctx) { const w = 7, h = 52;
      const draw1 = (x, base, c) => { ctx.fillStyle = base; ctx.fillRect(x - w / 2, this.y - h, w, h); if (c) { ctx.fillStyle = css(c, 1); ctx.fillRect(x - w / 2, this.y - 16, w, 16); } ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .6; ctx.strokeRect(x - w / 2, this.y - h, w, h); };
      if (kind === 'phPaper') draw1(this.x, '#EEDC9A', this.col);
      else { draw1(this.x - 4, '#C0392B', this.col); draw1(this.x + 4, '#2E5FA8', this.col2); } } };
  return s;
}
function addMeter(sc, L) {
  const box = { x: L.meter[0], y: L.meter[1] };
  sc.meter = { box, val: null, shown: null, logged: null, dwell: 0 };
  sc.objs.push({ kind: 'deco', z: 25, hit(px, py) { return inRect(px, py, box.x - 32, box.y - 4, box.x + 32, box.y + 52); }, label() { return T('obj.meterBox'); }, draw(ctx) {
    const Tk = tok(); ctx.fillStyle = Tk.dark ? '#2A3532' : '#D7DEDB'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.fillRect(box.x - 32, box.y, 64, 52); ctx.strokeRect(box.x - 32, box.y, 64, 52);
    ctx.fillStyle = '#1B2B23'; ctx.fillRect(box.x - 26, box.y + 6, 52, 22); ctx.fillStyle = '#9FF0B8'; ctx.font = '500 15px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(sc.meter.shown == null ? '--.--' : fmt(sc.meter.shown, 2), box.x, box.y + 23); ctx.fillStyle = Tk.ink; ctx.font = '600 8px "IBM Plex Sans", sans-serif'; ctx.fillText('pH', box.x, box.y + 42); ctx.textAlign = 'left'; } });
  const el = { kind: 'electrode', x: L.electrode[0], y: L.electrode[1], hx: L.electrode[0], hy: L.electrode[1], z: 44, drag: true, att: null,
    hit(px, py) { return inRect(px, py, this.x - 9, this.y - 92, this.x + 9, this.y + 2); },
    label() { return T('obj.electrode'); },
    pick() { if (!needGoggles()) return null; if (this.att) { this.att.meter = false; logE('info', [['log.meterOff', { v: this.att.label }]]); logDirty = true; this.att = null; } this.stay = false; return this; },
    drop() { const o = liquidAt(sc, this.x, this.y - 2); if (o) { this.att = o.v; o.v.meter = true; this.stay = true; this.x = o.x; this.y = Math.min(vesselBottomWorld(o) - 5, vesselSurfaceWorld(o) + 22); if (S.run.curve) o.v.curve.push([S.run.burette.used, o.v.eq.pH]); logE('info', [['log.meterOn', { v: o.v.label }]]); logDirty = true; } },
    draw(ctx) { const Tk = tok();
      ctx.strokeStyle = Tk.dark ? '#7C8A85' : '#2F3A37'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(box.x + 20, box.y); ctx.bezierCurveTo(box.x + 40, box.y - 80, this.x, this.y - 160, this.x, this.y - 92); ctx.stroke();
      ctx.fillStyle = Tk.dark ? '#3A4642' : '#2F3A37'; ctx.fillRect(this.x - 6, this.y - 92, 12, 34);
      ctx.fillStyle = Tk.dark ? 'rgba(200,225,235,.3)' : 'rgba(220,235,240,.95)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1; ctx.fillRect(this.x - 4, this.y - 58, 8, 52); ctx.strokeRect(this.x - 4, this.y - 58, 8, 52);
      ctx.beginPath(); ctx.arc(this.x, this.y - 5, 5, 0, 7); ctx.fill(); ctx.stroke(); } };
  sc.objs.push(el); sc.electrode = el;
}
function meterUpdate(sc, dt) {
  if (!sc.meter) return; const el = sc.electrode;
  const o = el.att ? sc.objs.find(q => q.kind === 'vessel' && q.v === el.att) : liquidAt(sc, el.x, el.y - 2);
  const v = o && (o.v || null);
  if (!v || v.V <= 0.02) { sc.meter.shown = null; sc.meter.dwell = 0; return; }
  const target = v.eq.pH; sc.meter.shown = sc.meter.shown == null ? 7 : sc.meter.shown + (target - sc.meter.shown) * (1 - Math.exp(-dt * 3));
  sc.meter.dwell += dt;
  if (sc.meter.dwell > 1.2 && Math.abs(sc.meter.shown - target) < .03 && (sc.meter.logged !== v || Math.abs((sc.meter.loggedVal || 0) - target) > .05) && !S.run.curve) {
    sc.meter.logged = v; sc.meter.loggedVal = target; logE('obs', [['obs.meter', { x: fmt(sc.meter.shown, 2) }]], { v: v.label, amt: '', f: T('tool.phMeter') }); logDirty = true;
  }
}
function addBurette(sc, L, run) {
  const B = sc.burette = { x: L.bur.x, top: L.bur.top, tip: L.bur.tip, stop: L.bur.tip - 26, open: 0, acc: 0, spillWarn: false, comp: compOfBottle(run.shelf.find(b => b.burette)), flowing: 0 };
  const sk = { kind: 'stopcock', x: B.x - 2, y: B.stop, hx: B.x - 2, hy: B.stop, z: 46, drag: true, stay: true,
    hit(px, py) { return inRect(px, py, B.x - 16, B.stop - 12, B.x + 52, B.stop + 12); },
    constrain(x) { return [clamp(x, B.x - 2, B.x + 40), B.stop]; },
    label() { return T('obj.stopcock') + ' · ' + fmt(S.run.burette.used, 2) + ' mL'; },
    pick() { if (!needGoggles()) return null; return this; },
    tap() { this.x = B.x - 2; B.open = 0; },
    hold() { B.open = clamp((this.x - B.x + 2) / 42, 0, 1); },
    drop() { B.open = clamp((this.x - B.x + 2) / 42, 0, 1); },
    draw(ctx) { const a = (1 - B.open) * Math.PI / 2; ctx.translate(B.x, B.stop); ctx.fillStyle = '#5C6662'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.rotate(a); ctx.fillStyle = '#2B6CB0'; ctx.fillRect(-3, -22, 6, 44); ctx.fillStyle = '#1E4E80'; ctx.fillRect(-6, -24, 12, 8); } };
  sc.objs.push(sk);
}
function buretteFlow(sc, dt) {
  const B = sc.burette, run = S.run; B.flowing = 0;
  if (B.open < 0.03 || run.burette.used >= 50) return;
  const tgo = sc.objs.find(o => o.kind === 'vessel' && !o.held && Math.abs(o.x - B.x) < 12);
  const tg = tgo ? { kind: 'vessel', o: tgo } : { kind: 'bench' };
  if (B.open < .3) {
    B.acc += dt / (1.1 - B.open / .3 * .95);
    if (B.acc >= 1) { B.acc = 0; run.burette.used = Math.min(50, run.burette.used + .05); if (tgo) sc.drops.push({ x: B.x, y: B.tip, vy: 0, dV: .05, comp: B.comp, tg }); else benchSpill(); }
  } else {
    const rate = .4 + (B.open - .3) / .7 * 1.6; const dV = Math.min(rate * dt, 50 - run.burette.used); run.burette.used += dV; B.flowing = rate;
    if (tgo) deliver(sc, tg, B.comp, dV, B.x, rate); else benchSpill();
  }
  run.burette.used = Math.round(run.burette.used * 1000) / 1000;
}
function benchSpill() { mistake('spillBench'); logDirty = true; }
function benchBg(ctx, sc, dt, t) {
  const L = sc.L, Tk = tok(); wallAndBench(ctx, sc.W, sc.H, L.bench);
  // shelves
  const nRows = Math.ceil(S.run.shelf.length / L.shelf.per);
  for (let r = 0; r < nRows; r++) { const y = L.shelf.rows[r]; ctx.fillStyle = Tk.dark ? '#4A3B30' : '#A9825C'; ctx.fillRect(L.shelf.x0 - 34, y, L.shelf.per * L.shelf.dx + 10, 9); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(L.shelf.x0 - 34, y + 9, L.shelf.per * L.shelf.dx + 10, 5); }
  // tripod for a beaker
  if (S.run.vessels.some(v => v.kind === 'beaker')) { const cx = L.beaker[0], gy = L.wick - 62 + 1; ctx.strokeStyle = Tk.dark ? '#8C9893' : '#4B5652'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 60, gy); ctx.lineTo(cx - 70, L.bench); ctx.moveTo(cx + 60, gy); ctx.lineTo(cx + 70, L.bench); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy + 6); ctx.stroke(); ctx.fillStyle = Tk.dark ? '#8C9893' : '#59635F'; ctx.fillRect(cx - 66, gy, 132, 3); }
  // burette stand + burette
  if (sc.burette) {
    const B = sc.burette; ctx.fillStyle = Tk.dark ? '#7E8A86' : '#59635F'; ctx.fillRect(B.x - 70, B.top - 30, 5, L.bench - B.top + 30); ctx.fillRect(B.x - 100, L.bench - 6, 90, 6); ctx.fillRect(B.x - 67, B.top + 30, 62, 5);
    ctx.fillStyle = Tk.dark ? 'rgba(200,225,235,.12)' : 'rgba(235,245,248,.85)'; ctx.strokeStyle = Tk.glass; ctx.lineWidth = 1.4;
    ctx.fillRect(B.x - 6, B.top, 12, B.stop - B.top - 6); ctx.strokeRect(B.x - 6, B.top, 12, B.stop - B.top - 6);
    const len = B.stop - B.top - 12; const ly = B.top + 6 + Math.min(1, S.run.burette.used / 50) * len;
    if (S.run.burette.used < 50) { ctx.fillStyle = 'rgba(190,215,235,.75)'; ctx.fillRect(B.x - 5, ly, 10, B.stop - 6 - ly); ctx.strokeStyle = 'rgba(40,70,100,.55)'; ctx.beginPath(); ctx.moveTo(B.x - 5, ly); ctx.quadraticCurveTo(B.x, ly + 3, B.x + 5, ly); ctx.stroke(); }
    ctx.strokeStyle = Tk.glass; ctx.lineWidth = .8; for (let k = 0; k <= 50; k += 5) { const yy = B.top + 6 + k / 50 * len; ctx.beginPath(); ctx.moveTo(B.x - 6, yy); ctx.lineTo(B.x - (k % 10 ? 1 : -2), yy); ctx.stroke(); if (k % 10 === 0) { ctx.fillStyle = Tk.muted; ctx.font = '8px "IBM Plex Mono", monospace'; ctx.fillText(String(k), B.x - 22, yy + 3); } }
    ctx.fillStyle = Tk.dark ? 'rgba(200,225,235,.18)' : 'rgba(235,245,248,.9)'; ctx.beginPath(); ctx.moveTo(B.x - 4, B.stop + 6); ctx.lineTo(B.x - 1.2, B.tip); ctx.lineTo(B.x + 1.2, B.tip); ctx.lineTo(B.x + 4, B.stop + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // reading box
    ctx.fillStyle = Tk.surface; ctx.strokeStyle = Tk.line; ctx.fillRect(B.x + 16, B.top + 40, 92, 40); ctx.strokeRect(B.x + 16, B.top + 40, 92, 40);
    ctx.fillStyle = Tk.muted; ctx.font = '10px "IBM Plex Sans", sans-serif'; ctx.fillText(T('lbl.burette'), B.x + 22, B.top + 54); ctx.fillStyle = Tk.ink; ctx.font = '500 15px "IBM Plex Mono", monospace'; ctx.fillText(fmt(S.run.burette.used, 2) + ' mL', B.x + 22, B.top + 73);
  }
  // close-up inset
  const v = S.run.focus || S.run.vessels[0]; const [ix, iy, iw, ih] = L.inset;
  ctx.save(); ctx.fillStyle = Tk.dark ? 'rgba(10,16,14,.75)' : 'rgba(255,255,255,.75)'; ctx.strokeStyle = Tk.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.fill(); ctx.stroke(); ctx.clip();
  const g = geoFor(v); const fx = vfx(v); const sy = g.levelY(Math.max(fx.lvl, .02));
  let y0 = Math.min(sy - 40, g.bot - 92), y1 = g.bot + (v.heating ? 62 : 14);
  const s = clamp(Math.min((ih - 24) / (y1 - y0), (iw - 10) / (2 * g.r + 46)), .6, 4);
  const z = v.zoom || (v.zoom = { s, y0 }); const k = 1 - Math.exp(-dt * 3); z.s += (s - z.s) * k; z.y0 += (y0 - z.y0) * k;
  ctx.translate(ix + iw / 2, iy + 4); ctx.scale(z.s, z.s); ctx.translate(-g.cx, -z.y0); drawVessel(ctx, v, g, dt, t, {});
  ctx.restore();
  ctx.fillStyle = Tk.muted; ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.fillText(T('lbl.closeup', { v: v.label }) + (v.V > 0.01 ? ' · ' + fmt(v.V, 2) + ' mL' : '') + (vfx(v).T > 30 ? ' · ' + Math.round(vfx(v).T) + ' °C' : ''), ix + 6, iy + ih - 7);
}
function benchFg(ctx, sc, dt, t) {
  const L = sc.L, Tk = tok();
  // labels under vessels
  ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.fillStyle = Tk.dark ? '#C8D3CF' : '#E7ECEA'; ctx.textAlign = 'center';
  for (const o of sc.objs) if (o.kind === 'vessel' && !o.held && o.v.kind !== 'tube') ctx.fillText(T('v.' + o.v.kind) + ' ' + o.v.label + (o.v.V > .01 ? ' · ' + fmt(o.v.V, 1) + ' mL' : ''), o.x, L.bench + 18);
  for (const o of sc.objs) if (o.kind === 'vessel' && !o.held && o.v.kind === 'tube' && o.v.V > 0.01) ctx.fillText(fmt(o.v.V, 1), o.x, L.bench + 18);
  ctx.textAlign = 'left';
  // tube being poured: stream
  for (const o of sc.objs) if (o.kind === 'vessel' && o.held && o.flowing && o.target) { const g = geoFor(o.v); const lip = rot(-g.hw(g.top) - 2, 0, -o.ang * Math.PI / 180); const x0 = o.vx + lip[0], y0 = o.vy + lip[1]; const tg = o.target; const y1 = tg.kind === 'vessel' ? vesselSurfaceWorld(tg.o) : sc.waste.top + 34; drawStream(ctx, x0, y0, x0 - 2, y1, (o.v.fx && o.v.fx.rgb) || [195, 222, 238], 1.2 + o.flowing * .6); }
  // burette stream
  if (sc.burette && sc.burette.flowing) { const B = sc.burette; const tgo = sc.objs.find(o => o.kind === 'vessel' && !o.held && Math.abs(o.x - B.x) < 12); drawStream(ctx, B.x, B.tip, B.x, tgo ? vesselSurfaceWorld(tgo) : L.bench, [205, 225, 240], .9 + B.flowing * .4); }
  updateDrops(sc, dt, ctx);
}

function addGoggles(sc, x, y) {
  sc.objs.push({ kind: 'goggles', z: 40, x, y, tap() { S.run.goggles = !S.run.goggles; logE('info', [[S.run.goggles ? 'log.gogOn' : 'log.gogOff']]); logDirty = true; },
    hit(px, py) { return inRect(px, py, this.x - 46, this.y - 22, this.x + 46, this.y + 30); },
    label() { return S.run.goggles ? T('obj.gogglesOn') : T('obj.goggles'); },
    draw(ctx, dt, t) { const Tk = tok(); ctx.strokeStyle = Tk.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x, this.y - 18); ctx.lineTo(this.x, this.y - 10); ctx.stroke();
      if (S.run.goggles) { ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillStyle = Tk.accent; ctx.textAlign = 'center'; ctx.fillText('✓ ' + T('gog.on'), this.x, this.y + 4); ctx.textAlign = 'left'; }
      else { const pulse = .7 + .3 * Math.sin(t * 4); ctx.globalAlpha = pulse; drawGoggles(ctx, this.x, this.y, .9, false); ctx.globalAlpha = 1; ctx.font = '600 11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = Tk.amber; ctx.textAlign = 'center'; ctx.fillText(T('gog.tap'), this.x, this.y + 26); ctx.textAlign = 'left'; } } });
}
