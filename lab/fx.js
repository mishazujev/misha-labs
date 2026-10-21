/* ===================== 2.5D CANVAS RENDERING ===================== */
const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const FXR = { list: [], last: 0, tok: null, tokAt: 0 };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function tok() {
  const now = performance.now();
  if (!FXR.tok || now - FXR.tokAt > 1000) {
    const cs = getComputedStyle(document.documentElement); const g = n => cs.getPropertyValue(n).trim();
    const surf = g('--surface') || '#ffffff'; let dark = false;
    if (surf[0] === '#') { const n = parseInt(surf.slice(1), 16); dark = (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 3 < 100; }
    FXR.tok = { ink: g('--ink'), muted: g('--muted'), line: g('--line'), glass: g('--glass-line') || '#7D958F', surface: surf, sunk: g('--sunk'), accent: g('--accent'), dark };
    FXR.tokAt = now;
  }
  return FXR.tok;
}
function fxCanvas(w, h, draw, cls) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const el = document.createElement('canvas');
  el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
  el.className = 'fxc ' + (cls || ''); el.style.aspectRatio = w + ' / ' + h; el.setAttribute('aria-hidden', 'true');
  FXR.list.push({ el, w, h, draw, dpr });
  return el;
}
function fxLoop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - (FXR.last || now)) / 1000)); FXR.last = now;
  if (!document.hidden) {
    try { simTick(dt); } catch (e) { console.error(e); }
    for (const c of FXR.list) {
      if (!c.el.isConnected) continue;
      const r = c.el.getBoundingClientRect(); if (r.bottom < -40 || r.top > innerHeight + 40 || !r.width) continue;
      const ctx = c.el.getContext('2d'); ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0); ctx.clearRect(0, 0, c.w, c.h);
      try { c.draw(ctx, c.w, c.h, dt, now / 1000); } catch (e) { console.error(e); }
    }
  }
  requestAnimationFrame(fxLoop);
}

/* ---------- vessel geometry (y grows downward) ---------- */
const GEO = {};
function geo(kind, ox, oy) {
  const key = kind + ':' + ox + ':' + oy; if (GEO[key]) return GEO[key];
  let g;
  if (kind === 'tube') { const cx = ox + 22, top = oy, bot = oy + 168, r = 14; g = { kind, cx, top, bot, r, hw: y => y < bot - r ? r : Math.sqrt(Math.max(0, r * r - (y - (bot - r)) ** 2)), ell: .34, settleK: 140 }; }
  else if (kind === 'beaker') { const cx = ox + 70, top = oy, bot = oy + 132, r = 56, c = 9; g = { kind, cx, top, bot, r, hw: y => y < bot - c ? r : r - c + Math.sqrt(Math.max(0, c * c - (y - (bot - c)) ** 2)), ell: .2, settleK: 28 }; }
  else { const cx = ox + 70, top = oy, nb = oy + 50, bot = oy + 160, rn = 12, rb = 62, c = 10; g = { kind, cx, top, bot, r: rb, nb, hw: y => { if (y < nb) return rn; if (y > bot - c) return rb - c + Math.sqrt(Math.max(0, c * c - (y - (bot - c)) ** 2)); return rn + (rb - rn) * Math.pow(Math.min(1, (y - nb) / (bot - c - nb)), 1.08); }, ell: .24, settleK: 20 }; }
  const N = 140, ys = [], cum = [0]; let acc = 0;
  for (let i = 0; i <= N; i++) ys.push(g.bot - (g.bot - g.top) * i / N);
  for (let i = 1; i <= N; i++) { const y = (ys[i] + ys[i - 1]) / 2; acc += g.hw(y) ** 2; cum.push(acc); }
  g.levelY = f => { if (f <= 0) return g.bot; const tgt = Math.min(1, f) * acc; for (let i = 1; i <= N; i++) if (cum[i] >= tgt) { const fr = (tgt - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * fr; } return g.top; };
  g.path = (ctx, inset) => {
    inset = inset || 0; const S = 70; ctx.beginPath();
    for (let i = 0; i <= S; i++) { const y = g.top + (g.bot - g.top) * i / S; const x = g.cx - Math.max(0, g.hw(y) - inset); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    for (let i = S; i >= 0; i--) { const y = g.top + (g.bot - g.top) * i / S; ctx.lineTo(g.cx + Math.max(0, g.hw(y) - inset), y); }
    ctx.closePath();
  };
  return (GEO[key] = g);
}

/* ---------- per-vessel visual state ---------- */
function vfx(v) {
  if (!v.fx) v.fx = { lvl: v.V / v.cap, rgb: null, a: .25, wave: 0, phase: rnd(0, 6), bubs: [], parts: [], spl: [], dye: [], steam: [], pour: null, hold: 0, gas: 0, foam: 0,
    cloud: {}, layer: {}, T: 22, ox: 0, cuo: 0, spill: 0, ix: null, iy: null, flame: { p: [], s: [] }, seed: Math.random() * 100, spurt: 0 };
  return v.fx;
}
function resetFx(v) { const T = v.fx ? v.fx.T : 22; v.fx = null; vfx(v).T = T; }
const SETTLE = { AgCl: 24, AgI: 20, PbI2: 15, BaSO4: 8, PbSO4: 10, PbCl2: 16, Ag2O: 11, CaOH2: 8, CuOH2: 5.5, FeOH2: 5, FeOH3: 4.5, PbOH2: 6, BaCO3: 8, CaCO3: 6.5, CuCO3: 6, FeCO3: 6, PbCO3: 8 };
const BULK = { CuOH2: 3, FeOH2: 3, FeOH3: 3.2, PbOH2: 2.2, Ag2O: 1.4, CaOH2: 1.6 };
function pptRGB(k, fx) {
  let c = hex2rgb(PPT[k][1]);
  if (k === 'FeOH2' && fx.ox > 0) c = lerpC(c, [150, 75, 25], fx.ox);
  if (k === 'CuOH2' && fx.cuo > 0) c = lerpC(c, [28, 26, 24], fx.cuo);
  return c;
}
function streamRGB(b) {
  if (b.ind) return ({ litmus: [120, 55, 150], phph: [235, 235, 232], mo: [235, 130, 40], univ: [80, 160, 75] })[b.ind];
  const t = { V: 1, tot: Object.assign({}, b.tot || {}), ind: {} }; equilibrate(t); const lk = vesselLook(t);
  return lk.baseKey === 'colourless' ? [195, 222, 238] : lk.rgb;
}
function startPour(v, b, amt) {
  const fx = vfx(v); const c = streamRGB(b);
  const drop = amt <= 0.1;
  fx.pour = { t: 0, dur: drop ? (b.ind ? .7 : .45) : clamp(.45 + amt / v.cap * 2.2, .5, 1.6), rgb: c, drop, n: b.ind ? 2 : 1 };
  fx.hold = drop ? .38 : .2;
  fx.ix = null;
}

/* ---------- flame particle system ---------- */
// mode: 0 = clean blue (burner), 1 = luminous yellow, lamp = 2 (ethanol), 3 = big fire; mix: 0..1 blue->yellow
function drawFlame(ctx, F, x, y, s, mode, dt, t, power) {
  power = power == null ? 1 : power; if (power <= 0.01) { F.p.length = 0; }
  const yellow = mode === 1 ? 1 : mode === 3 ? 1 : mode === 2 ? .18 : (F.mix || 0);
  const n = Math.round((mode === 3 ? 7 : 4) * power * (RM ? .5 : 1));
  for (let i = 0; i < n; i++) F.p.push({ x: x + rnd(-3, 3) * s, y: y, vx: rnd(-8, 8) * s, vy: -rnd(55, 85) * s * (mode === 3 ? 1.4 : 1) * (.6 + .4 * power), life: 0, max: rnd(.28, .48) * (mode === 3 ? 1.6 : 1), r: rnd(4, 7) * s * (mode === 3 ? 1.8 : 1) });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // base glow
  if (power > .05) {
    const g = ctx.createRadialGradient(x, y - 10 * s, 1, x, y - 10 * s, 26 * s * (mode === 3 ? 2 : 1));
    g.addColorStop(0, rgba(yellow > .5 ? [255, 190, 90] : [110, 160, 255], .28 * power)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10 * s, 26 * s * (mode === 3 ? 2 : 1), 0, 7); ctx.fill();
  }
  for (let i = F.p.length - 1; i >= 0; i--) {
    const p = F.p[i]; p.life += dt; if (p.life > p.max) { F.p.splice(i, 1); continue; }
    const f = p.life / p.max; p.vy -= 40 * s * dt; p.vx += Math.sin(t * 17 + p.x) * 12 * dt; p.x += p.vx * dt + (x - p.x) * dt * 3; p.y += p.vy * dt; const r = p.r * (1 - f * .75);
    let c, a;
    if (yellow > .5) { c = f < .25 ? [255, 245, 200] : f < .55 ? [255, 195, 70] : f < .8 ? [250, 120, 30] : [190, 60, 20]; a = (1 - f) * .42; }
    else { c = f < .2 ? [180, 210, 255] : f < .6 ? [70, 120, 255] : [40, 60, 200]; a = (1 - f) * .3; if (yellow > 0 && f > .5) { c = lerpC(c, [255, 180, 60], yellow * 1.5); } }
    ctx.fillStyle = rgba(c, a); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
  }
  // inner cone for a clean burner flame
  if (power > .3 && yellow < .5 && mode !== 2) {
    const fl = 1 + Math.sin(t * 23) * .04;
    ctx.fillStyle = 'rgba(150,200,255,.55)'; ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.quadraticCurveTo(x, y - 30 * s * fl, x + 5 * s, y); ctx.fill();
  }
  ctx.restore();
  // smoke for luminous flames
  if (yellow > .5 && power > .2) {
    if (Math.random() < dt * 10 * yellow) F.s.push({ x: x + rnd(-3, 3), y: y - 55 * s * (mode === 3 ? 1.8 : 1), r: rnd(3, 5) * s, life: 0, max: rnd(1.6, 2.6), vx: rnd(-4, 4) });
  }
  for (let i = F.s.length - 1; i >= 0; i--) {
    const p = F.s[i]; p.life += dt; if (p.life > p.max) { F.s.splice(i, 1); continue; }
    const f = p.life / p.max; p.y -= 22 * dt; p.x += p.vx * dt + Math.sin(t * 2 + i) * 4 * dt; p.r += 6 * dt;
    ctx.fillStyle = `rgba(60,58,55,${.22 * (1 - f)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
  }
}
function drawLamp(ctx, x, y, s) { // spirit lamp body, wick top at (x, y)
  const T = tok();
  ctx.save();
  ctx.fillStyle = T.dark ? 'rgba(160,200,215,.14)' : 'rgba(205,228,236,.55)'; ctx.strokeStyle = T.glass; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 24 * s, y + 38 * s); ctx.quadraticCurveTo(x - 26 * s, y + 10 * s, x - 7 * s, y + 8 * s); ctx.lineTo(x + 7 * s, y + 8 * s); ctx.quadraticCurveTo(x + 26 * s, y + 10 * s, x + 24 * s, y + 38 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(150,195,225,.45)'; ctx.fillRect(x - 22 * s, y + 24 * s, 44 * s, 13 * s);
  ctx.fillStyle = T.muted; ctx.fillRect(x - 5 * s, y + 1 * s, 10 * s, 8 * s);
  ctx.fillStyle = '#3B2E25'; ctx.fillRect(x - 1.5 * s, y - 3 * s, 3 * s, 5 * s);
  ctx.restore();
}

/* ---------- the vessel painter ---------- */
function drawVessel(ctx, v, g, dt, t, opts) {
  opts = opts || {};
  const fx = vfx(v), T = tok();
  if (fx.lastT === t) dt = 0; fx.lastT = t;
  const lk = vesselLook(v);
  if (!fx.rgb) { fx.rgb = lk.rgb.slice(); fx.a = lk.a; }
  if (opts.tilt > 0.02) { drawTilted(ctx, v, g, fx, opts.tilt, T); return; }
  // pour animation
  let pourX = g.cx + 3, streamOn = false;
  if (fx.pour) {
    fx.pour.t += dt; if (fx.pour.t > fx.pour.dur) fx.pour = null; else streamOn = true;
  }
  if (fx.hold > 0) fx.hold -= dt;
  const live = fx.hold <= 0;
  // level & waves
  const tgtL = v.V / v.cap;
  fx.lvl += (tgtL - fx.lvl) * (1 - Math.exp(-dt * (fx.pour ? 2.4 : 5)));
  if (!live && !fx.pour) fx.lvl = fx.lvl;
  fx.wave *= Math.exp(-dt * 1.3); fx.phase += dt * 8.5;
  const hasLiq = fx.lvl > 0.0015;
  const sy = g.levelY(fx.lvl);
  const hwS = g.hw(sy);
  const amp = Math.min(5, fx.wave * 7) * (RM ? .3 : 1);
  const surfY = x => sy + amp * Math.sin((x - g.cx) / Math.max(6, hwS) * 2.6 + fx.phase) * Math.cos(fx.phase * .37);
  if (fx.ix == null || fx.pour) { fx.ix = pourX; }
  fx.iy = sy + 8;
  const inf = fx.inflow && t - fx.inflow.t < .15 ? fx.inflow : null;
  if (inf && dt > 0) {
    fx.ix = inf.x; const k = Math.min(1, inf.rate / 1.5);
    fx.wave = Math.min(1.1, fx.wave + dt * 2 * k);
    if (Math.random() < .8 * k) fx.spl.push({ x: inf.x + rnd(-2, 2), y: surfY(inf.x) - 1, vx: rnd(-30, 30), vy: -rnd(20, 60), life: 0, c: inf.rgb });
    if (hasLiq && Math.random() < .6 * k && fx.bubs.length < 170) fx.bubs.push({ x: inf.x + rnd(-5, 5), y: Math.min(g.bot - 3, surfY(inf.x) + rnd(6, 25)), r: rnd(.6, 1.6), ph: rnd(0, 6), gas: false });
    if (Math.random() < dt * 3 * k) fx.stir = Math.max(fx.stir || 0, .25 * k);
  }
  // colour diffusion
  if (live) {
    const diff = Math.abs(lk.rgb[0] - fx.rgb[0]) + Math.abs(lk.rgb[1] - fx.rgb[1]) + Math.abs(lk.rgb[2] - fx.rgb[2]);
    if (diff > 40 && (!fx.lastDye || t - fx.lastDye > .5) && hasLiq) { fx.lastDye = t; fx.dye.push({ x: fx.ix, y: Math.min(g.bot - 6, fx.iy + 4), r: 3, R: Math.max(hwS, 20) * 1.6, rgb: lk.rgb.slice(), a: Math.max(.5, lk.a), life: 0 }); }
    const k = 1 - Math.exp(-dt * 1.4);
    fx.rgb = lerpC(fx.rgb, lk.rgb, k); fx.a += (lk.a - fx.a) * k;
  }
  // precipitate reconciliation
  const tgtP = {}; if (v.eq && v.eq.ppt) for (const k in v.eq.ppt) if (v.eq.ppt[k] > 0.0015) tgtP[k] = v.eq.ppt[k];
  if (live) {
    const keys = new Set([...Object.keys(tgtP), ...Object.keys(fx.cloud), ...Object.keys(fx.layer)]);
    for (const k of keys) {
      const shown = (fx.cloud[k] || 0) + (fx.layer[k] || 0), tg = tgtP[k] || 0;
      if (tg > shown + 1e-4) {
        const d = tg - shown; fx.cloud[k] = (fx.cloud[k] || 0) + d;
        const n = clamp(Math.round(d * 1600), 8, 90);
        for (let i = 0; i < n && fx.parts.length < 260; i++) { const a = rnd(0, 6.28), sp = rnd(4, 30); fx.parts.push({ k, m: d / n, x: fx.ix + rnd(-4, 4), y: fx.iy + rnd(0, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6 + 6, s: rnd(.9, 2.2), seed: rnd(0, 9) }); }
      } else if (tg < shown - 1e-4) {
        const d = Math.min(shown - tg, shown * dt * 0.9 + 0.0004);
        let take = Math.min(fx.cloud[k] || 0, d); fx.cloud[k] = (fx.cloud[k] || 0) - take; const rest = d - take;
        if (rest > 0) { fx.layer[k] = Math.max(0, (fx.layer[k] || 0) - rest); if (fx.layer[k] > 1e-5) { /* re-suspend dissolving layer */ } }
        for (let i = fx.parts.length - 1; i >= 0; i--) if (fx.parts[i].k === k && Math.random() < dt * 2.5) fx.parts.splice(i, 1);
        if ((fx.cloud[k] || 0) + (fx.layer[k] || 0) < 2e-4) { delete fx.cloud[k]; delete fx.layer[k]; fx.parts = fx.parts.filter(p => p.k !== k); }
      }
    }
  }
  // stirring re-suspends the layer
  if (fx.stir > 0) { for (const k in fx.layer) { const m = fx.layer[k] * fx.stir; fx.layer[k] -= m; fx.cloud[k] = (fx.cloud[k] || 0) + m; const n = clamp(Math.round(m * 1200), 0, 50); for (let i = 0; i < n && fx.parts.length < 260; i++) fx.parts.push({ k, m: m / Math.max(1, n), x: g.cx + rnd(-1, 1) * g.hw(g.bot - 6) * .8, y: g.bot - rnd(2, 10), vx: rnd(-25, 25), vy: -rnd(10, 45), s: rnd(.9, 2.2), seed: rnd(0, 9) }); } fx.stir = 0; }
  // layer geometry
  let layerAmt = 0, layerRGB = [0, 0, 0], layerW = 0;
  for (const k in fx.layer) { const m = fx.layer[k] * (BULK[k] || 1); layerAmt += m; const c = pptRGB(k, fx); layerRGB = layerRGB.map((x, i) => x + c[i] * m); layerW += m; }
  if (layerW > 0) layerRGB = layerRGB.map(x => x / layerW);
  const layerH = Math.min((g.bot - g.top) * .38, layerAmt * g.settleK);
  const layerTop = g.bot - layerH;

  /* ---- draw: shadow & back glass ---- */
  const base = g.hw(g.bot - 2);
  ctx.fillStyle = T.dark ? 'rgba(0,0,0,.35)' : 'rgba(30,45,40,.13)';
  ctx.beginPath(); ctx.ellipse(g.cx, g.bot + 3, Math.max(base, 10) + 6, 4, 0, 0, 7); ctx.fill();
  g.path(ctx); ctx.fillStyle = T.dark ? 'rgba(170,205,220,.06)' : 'rgba(225,240,246,.55)'; ctx.fill();
  const rx = g.hw(g.top + 1) + 1.5, ry = rx * g.ell;
  ctx.strokeStyle = T.glass; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(g.cx, g.top, rx, ry, 0, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;

  ctx.save(); g.path(ctx, 1.3); ctx.clip();
  if (hasLiq) {
    // liquid body
    const L = g.cx - g.r - 4, Rr = g.cx + g.r + 4;
    ctx.beginPath(); ctx.moveTo(L, surfY(L)); for (let x = L; x <= Rr; x += 3) ctx.lineTo(x, surfY(x)); ctx.lineTo(Rr, g.bot + 4); ctx.lineTo(L, g.bot + 4); ctx.closePath();
    const c = fx.rgb, a = clamp(fx.a, .22, .95);
    const gr = ctx.createLinearGradient(g.cx - g.r, 0, g.cx + g.r, 0);
    gr.addColorStop(0, rgba(c.map(x => x * .72), Math.min(1, a + .12))); gr.addColorStop(.32, rgba(c.map(x => Math.min(255, x * 1.06)), a * .92)); gr.addColorStop(.62, rgba(c, a)); gr.addColorStop(1, rgba(c.map(x => x * .7), Math.min(1, a + .15)));
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    const gv = ctx.createLinearGradient(0, sy, 0, g.bot); gv.addColorStop(0, 'rgba(255,255,255,0)'); gv.addColorStop(1, T.dark ? 'rgba(0,0,0,.18)' : 'rgba(0,30,40,.08)'); ctx.fillStyle = gv; ctx.fillRect(L, sy, Rr - L, g.bot - sy + 4);
    // dye spreading
    for (let i = fx.dye.length - 1; i >= 0; i--) {
      const d = fx.dye[i]; d.life += dt; const f = d.life / 2.2; if (f >= 1) { fx.dye.splice(i, 1); continue; }
      d.r += (d.R - d.r) * dt * 1.6; d.y += 10 * dt;
      for (let j = 0; j < 3; j++) {
        const ox = Math.sin(t * 1.3 + j * 2.1) * d.r * .25, oy = Math.cos(t * 1.1 + j) * d.r * .2;
        const rg = ctx.createRadialGradient(d.x + ox, d.y + oy, 0, d.x + ox, d.y + oy, d.r * (0.7 + j * .2));
        rg.addColorStop(0, rgba(d.rgb, d.a * (1 - f) * .55)); rg.addColorStop(1, rgba(d.rgb, 0)); ctx.fillStyle = rg; ctx.fillRect(L, sy - 4, Rr - L, g.bot - sy + 8);
      }
    }
    // turbidity (suspended precipitate)
    for (const k in fx.cloud) {
      const cc = fx.cloud[k]; if (cc <= 0) continue;
      const pc = pptRGB(k, fx); const al = Math.min(.82, cc / Math.max(.3, v.V) * 28 * (BULK[k] ? 1.2 : 1));
      ctx.fillStyle = rgba(pc, al * .55); ctx.fillRect(L, sy - 4, Rr - L, layerTop - sy + 6);
      for (let j = 0; j < 7; j++) {
        const bx = g.cx + Math.sin(t * .45 + j * 1.9 + fx.seed) * g.r * .55, by = sy + (layerTop - sy) * (.2 + .65 * ((Math.sin(t * .33 + j * 2.7) + 1) / 2));
        const br = Math.max(8, g.r * .7);
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br); rg.addColorStop(0, rgba(pc, al * .45)); rg.addColorStop(1, rgba(pc, 0)); ctx.fillStyle = rg; ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    }
    // precipitate particles
    const conv = fx.T > 45 ? (fx.T - 45) / 55 : 0;
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i]; const set = SETTLE[p.k] || 8;
      p.vy += (set - p.vy) * dt * 1.4 - conv * 18 * dt * Math.sin(p.x * .2 + t);
      p.vx += (Math.sin(p.y * .07 + t * 1.6 + p.seed) * (fx.wave * 60 + 6 + conv * 25) - p.vx * 1.6) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const hw = g.hw(Math.min(g.bot - 1, Math.max(g.top, p.y))) - 2; if (p.x < g.cx - hw) { p.x = g.cx - hw; p.vx *= -.5; } if (p.x > g.cx + hw) { p.x = g.cx + hw; p.vx *= -.5; }
      if (p.y < sy + 2) { p.y = sy + 2; p.vy = Math.abs(p.vy); }
      if (p.y >= layerTop - 1) { fx.cloud[p.k] = Math.max(0, (fx.cloud[p.k] || 0) - p.m); fx.layer[p.k] = (fx.layer[p.k] || 0) + p.m; fx.parts.splice(i, 1); continue; }
      const pc = pptRGB(p.k, fx);
      ctx.fillStyle = rgba(pc, .92); ctx.beginPath();
      if (BULK[p.k]) ctx.ellipse(p.x, p.y, p.s * 1.6, p.s, Math.sin(p.seed + t) * .8, 0, 7); else ctx.rect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      ctx.fill();
      if (pc[0] + pc[1] + pc[2] > 600) { ctx.strokeStyle = 'rgba(70,75,70,.28)'; ctx.lineWidth = .5; ctx.stroke(); }
    }
    // when nothing is left moving, settle any leftover cloud mass
    if (!fx.parts.length) for (const k in fx.cloud) if (fx.cloud[k] > 0) { const m = fx.cloud[k] * Math.min(1, dt * .5); fx.cloud[k] -= m; fx.layer[k] = (fx.layer[k] || 0) + m; }
    // settled layer
    if (layerH > .4) {
      ctx.beginPath(); ctx.moveTo(L, g.bot + 4); for (let x = L; x <= Rr; x += 3) ctx.lineTo(x, layerTop + Math.sin(x * .45 + fx.seed) * .9); ctx.lineTo(Rr, g.bot + 4); ctx.closePath();
      const lg = ctx.createLinearGradient(0, layerTop, 0, g.bot); lg.addColorStop(0, rgba(layerRGB, .93)); lg.addColorStop(1, rgba(layerRGB.map(x => x * .8), 1)); ctx.fillStyle = lg; ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let j = 0; j < 30; j++) { const x = g.cx + Math.sin(j * 12.9898 + fx.seed) * g.r * .9, y = layerTop + 1 + Math.abs(Math.sin(j * 78.233)) * Math.max(1, layerH - 2); ctx.fillRect(x, y, 1, 1); }
      ctx.strokeStyle = 'rgba(60,65,60,.35)'; ctx.lineWidth = .7; ctx.beginPath(); for (let x = L; x <= Rr; x += 3) ctx.lineTo(x, layerTop + Math.sin(x * .45 + fx.seed) * .9); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  // dry residue
  if (!hasLiq && v.residue) {
    const col = v.residue === 'blue' ? [74, 134, 214] : v.residue === 'brown' ? [163, 90, 34] : [243, 243, 238];
    for (let j = 0; j < 40; j++) { const x = g.cx + Math.sin(j * 9.1 + 1) * g.hw(g.bot - 4) * .85, y = g.bot - 3 - Math.abs(Math.sin(j * 3.7)) * 5; const s = 2 + (j % 3); ctx.save(); ctx.translate(x, y); ctx.rotate(j); ctx.fillStyle = rgba(col, .95); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .5; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore(); }
  }
  // bubbles
  const boiling = fx.T >= 99.3 && v.heating && hasLiq;
  fx.gas *= Math.exp(-dt / (fx.T > 60 ? 1.6 : 2.6));
  let rate = Math.min(140, fx.gas * 900) * (1 + Math.max(0, fx.T - 22) / 40);
  if (boiling) rate += v.kind === 'tube' ? 26 : 40; else if (v.heating && fx.T > 70) rate += (fx.T - 70) * .5;
  if (hasLiq && !RM) {
    fx.bAcc = (fx.bAcc || 0) + rate * dt;
    while (fx.bAcc >= 1 && fx.bubs.length < 170) {
      fx.bAcc -= 1; const fromGas = Math.random() < (fx.gas * 900) / Math.max(1, rate);
      const y = fromGas ? clamp((fx.iy || sy) + rnd(-4, 40), sy + 4, g.bot - 4) : g.bot - rnd(2, 6);
      const r = fromGas ? rnd(.7, 2) : boiling ? rnd(1.6, v.kind === 'tube' ? 3.4 : 5) : rnd(.6, 1.4);
      fx.bubs.push({ x: g.cx + rnd(-1, 1) * Math.max(0, g.hw(y) - r - 2), y, r, ph: rnd(0, 6), gas: fromGas });
    }
  }
  ctx.save(); g.path(ctx, 1.3); ctx.clip();
  for (let i = fx.bubs.length - 1; i >= 0; i--) {
    const b = fx.bubs[i]; b.y -= (18 + b.r * 15) * dt; b.x += Math.sin(t * 7 + b.ph) * b.r * 3.5 * dt; if (boiling && !b.gas) b.r = Math.min(b.r * (1 + dt * .5), 6);
    if (!hasLiq || b.y <= surfY(b.x) + b.r * .3) {
      if (hasLiq) { if (b.r > 2.4 || (b.gas && Math.random() < .25)) for (let j = 0; j < (b.r > 3 ? 3 : 1); j++) fx.spl.push({ x: b.x, y: b.y - 1, vx: rnd(-25, 25), vy: -rnd(30, 70) * (b.r > 3 ? 1.3 : 1), life: 0 }); if (b.gas) fx.foam = Math.min(1.4, fx.foam + b.r * .004); if (b.r > 2) fx.wave = Math.min(1.2, fx.wave + b.r * .004); }
      fx.bubs.splice(i, 1); continue;
    }
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    if (b.r > 1.4) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .25, 0, 7); ctx.fill(); }
  }
  // surface ellipse + foam
  if (hasLiq) {
    const srx = Math.max(1, hwS - 1), sry = srx * g.ell * .8;
    ctx.fillStyle = rgba(fx.rgb.map(x => Math.min(255, x * 1.15 + 20)), clamp(fx.a * .8, .2, .8));
    ctx.beginPath(); ctx.ellipse(g.cx, surfY(g.cx), srx, sry, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(g.cx, surfY(g.cx), srx, sry, 0, Math.PI * .1, Math.PI * .9); ctx.stroke();
    fx.foam *= Math.exp(-dt / 2.4);
    if (fx.foam > .03) {
      const fh = Math.min(16, fx.foam * 14);
      for (let j = 0; j < 40; j++) { const x = g.cx + (j / 39 * 2 - 1) * (srx - 1), y = surfY(x) - Math.abs(Math.sin(j * 7.7 + t * .8)) * fh * .7 + Math.sin(j) * 1.5; ctx.fillStyle = `rgba(255,255,255,${.55 + .3 * Math.sin(j * 3.3)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (j * 7 % 4) * .7 * Math.min(1, fx.foam + .3), 0, 7); ctx.fill(); }
    }
  }
  ctx.restore();

  /* ---- front glass ---- */
  ctx.save(); g.path(ctx); ctx.clip();
  const hl = ctx.createLinearGradient(g.cx - g.r, 0, g.cx + g.r, 0);
  hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(.16, `rgba(255,255,255,${T.dark ? .16 : .55})`); hl.addColorStop(.27, 'rgba(255,255,255,0)'); hl.addColorStop(.86, 'rgba(255,255,255,0)'); hl.addColorStop(.92, `rgba(255,255,255,${T.dark ? .1 : .32})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(g.cx - g.r - 4, g.top, g.r * 2 + 8, g.bot - g.top);
  ctx.restore();
  g.path(ctx); ctx.strokeStyle = T.glass; ctx.lineWidth = 1.7; ctx.stroke();
  ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(g.cx, g.bot - 1, Math.max(4, base - 2), 1.4, 0, 0, Math.PI); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(g.cx, g.top, rx, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = .7; ctx.beginPath(); ctx.ellipse(g.cx, g.top, rx + 1.5, ry + .8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  if (g.kind !== 'tube') {
    ctx.strokeStyle = T.glass; ctx.globalAlpha = .6; ctx.lineWidth = 1; ctx.font = '8px "IBM Plex Mono", monospace'; ctx.fillStyle = T.glass;
    for (const fr of [.25, .5, .75]) { const y = g.levelY(fr); const x0 = g.cx - g.hw(y) + 6; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 9, y); ctx.stroke(); ctx.fillText(String(Math.round(v.cap * fr)), x0 + 11, y + 3); }
    ctx.globalAlpha = 1;
  }

  /* ---- pour stream / drops ---- */
  if (fx.pour) {
    const P = fx.pour, x0 = pourX, y0 = g.top - (opts.head || 26);
    if (P.drop) {
      for (let j = 0; j < P.n; j++) {
        const tt = P.t - j * .28; if (tt < 0) continue;
        const y = y0 + 0.5 * 900 * tt * tt; const ys = surfY(x0);
        if (y < ys) { ctx.fillStyle = rgba(P.rgb, .85); ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.quadraticCurveTo(x0 + 2.6, y + 1, x0, y + 2.4); ctx.quadraticCurveTo(x0 - 2.6, y + 1, x0, y - 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = .6; ctx.stroke(); }
        else if (!P['hit' + j]) { P['hit' + j] = 1; fx.wave = Math.min(1.2, fx.wave + .18); for (let k = 0; k < 3; k++) fx.spl.push({ x: x0, y: ys - 1, vx: rnd(-22, 22), vy: -rnd(25, 55), life: 0, c: P.rgb }); }
      }
      // dropper tip
      ctx.fillStyle = T.dark ? 'rgba(200,220,230,.35)' : 'rgba(120,140,150,.55)'; ctx.fillRect(x0 - 2, y0 - 22, 4, 16); ctx.fillStyle = '#9C3A3A'; ctx.fillRect(x0 - 4, y0 - 30, 8, 9);
    } else {
      const fade = Math.min(1, P.t / .12, (P.dur - P.t) / .15);
      const ys = hasLiq ? surfY(x0) : g.bot - 2; const wob = Math.sin(t * 30) * .8;
      const w = 3.2 * fade;
      ctx.fillStyle = rgba(P.rgb, .62); ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.quadraticCurveTo(x0 - w * .6 + wob, (y0 + ys) / 2, x0 - w * .45, ys); ctx.lineTo(x0 + w * .45, ys); ctx.quadraticCurveTo(x0 + w * .6 + wob, (y0 + ys) / 2, x0 + w, y0); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x0 - w * .3, y0); ctx.lineTo(x0 - w * .2 + wob, ys); ctx.stroke();
      fx.wave = Math.min(1, fx.wave + dt * 1.6 * fade);
      if (Math.random() < .7 * fade) fx.spl.push({ x: x0 + rnd(-2, 2), y: ys - 1, vx: rnd(-30, 30), vy: -rnd(20, 60), life: 0, c: P.rgb });
      if (hasLiq && Math.random() < .5 * fade && fx.bubs.length < 170) fx.bubs.push({ x: x0 + rnd(-6, 6), y: Math.min(g.bot - 3, ys + rnd(6, 25)), r: rnd(.6, 1.6), ph: rnd(0, 6), gas: false });
      // bottle lip
      ctx.fillStyle = T.dark ? 'rgba(200,220,230,.25)' : 'rgba(150,170,175,.5)'; ctx.beginPath(); ctx.moveTo(x0 - 3, y0 - 2); ctx.lineTo(x0 + 26, y0 - 18); ctx.lineTo(x0 + 30, y0 - 10); ctx.lineTo(x0 + 2, y0 + 3); ctx.closePath(); ctx.fill();
    }
  }
  // splashes
  for (let i = fx.spl.length - 1; i >= 0; i--) {
    const s = fx.spl[i]; s.life += dt; s.vy += 420 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const inside = s.y > g.top && Math.abs(s.x - g.cx) < g.hw(Math.min(g.bot, Math.max(g.top, s.y)));
    if ((s.vy > 0 && hasLiq && inside && s.y >= surfY(s.x)) || s.life > 1.6 || s.y > g.bot + 30) { fx.spl.splice(i, 1); continue; }
    ctx.fillStyle = rgba(s.c || fx.rgb, .75); ctx.beginPath(); ctx.arc(s.x, s.y, 1.1, 0, 7); ctx.fill();
  }
  // spurting jet from a boiling tube
  if (fx.spurt > 0) {
    fx.spurt -= dt; for (let j = 0; j < 3; j++) fx.spl.push({ x: g.cx + rnd(-3, 3), y: g.top + 2, vx: rnd(-40, 70), vy: -rnd(80, 160), life: 0 });
  }
  // overflow runs down the outside
  if (fx.spill > 0) {
    fx.spill -= dt; const a = Math.min(1, fx.spill);
    ctx.strokeStyle = rgba(fx.rgb, .6 * a); ctx.lineWidth = 2.2;
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(g.cx + sgn * (rx + 1), g.top); ctx.bezierCurveTo(g.cx + sgn * (rx + 4), g.top + 30, g.cx + sgn * (g.hw(g.bot - 20) + 3), g.bot - 30, g.cx + sgn * (g.hw(g.bot - 6) + 2), g.bot + 2); ctx.stroke(); }
    ctx.fillStyle = rgba(fx.rgb, .35 * a); ctx.beginPath(); ctx.ellipse(g.cx, g.bot + 4, g.r + 14, 4, 0, 0, 7); ctx.fill();
  }
  // steam above the mouth
  if (fx.T > 55 && hasLiq && !RM && Math.random() < dt * (fx.T - 55) / 45 * 14) fx.steam.push({ x: g.cx + rnd(-rx * .5, rx * .5), y: g.top - 2, r: rnd(2, 4), life: 0, max: rnd(1.2, 2), vx: rnd(-5, 5) });
  for (let i = fx.steam.length - 1; i >= 0; i--) {
    const s = fx.steam[i]; s.life += dt; if (s.life > s.max) { fx.steam.splice(i, 1); continue; }
    const f = s.life / s.max; s.y -= 26 * dt; s.x += (s.vx + Math.sin(t * 2 + i) * 6) * dt; s.r += 7 * dt;
    const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); rg.addColorStop(0, `rgba(${T.dark ? '220,230,235' : '255,255,255'},${.4 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
  }
  // burner under the vessel
  if (!opts.noLamp && (v.heating || (fx.flame.p.length > 0))) {
    const fyy = g.bot + (opts.flameGap || 30);
    if (v.heating) drawLamp(ctx, g.cx, fyy, .62);
    drawFlame(ctx, fx.flame, g.cx, fyy - 2, .55, 2, dt, t, v.heating ? 1 : 0);
  }
}

/* tilted vessel being poured from: liquid stays level in world space */
function drawTilted(ctx, v, g, fx, ang, T) {
  const lvl = fx.lvl = v.V / v.cap;
  g.path(ctx); ctx.fillStyle = T.dark ? 'rgba(170,205,220,.06)' : 'rgba(225,240,246,.55)'; ctx.fill();
  if (lvl > 0.002) {
    const sy = g.levelY(lvl), cy = (sy + g.bot) / 2, depth = g.bot - sy;
    // centre of the liquid in world-aligned frame (rotate about the mouth)
    const dx = 0, dy = cy - g.top, c = Math.cos(-ang), s = Math.sin(-ang);
    const wy = dx * s + dy * c;
    const surf = wy - depth * .5 * Math.max(.25, Math.abs(Math.cos(ang)));
    ctx.save(); g.path(ctx, 1.3); ctx.clip();
    ctx.translate(g.cx, g.top); ctx.rotate(ang);
    let col = fx.rgb || [195, 222, 238], a = clamp(fx.a || .3, .25, .9);
    for (const k in fx.cloud) if (fx.cloud[k] + (fx.layer[k] || 0) > 0.002) { col = lerpC(col, pptRGB(k, fx), .5); a = Math.max(a, .75); }
    ctx.fillStyle = rgba(col, a); ctx.fillRect(-300, surf, 600, 600);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-300, surf); ctx.lineTo(300, surf); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); g.path(ctx); ctx.clip();
  const hl = ctx.createLinearGradient(g.cx - g.r, 0, g.cx + g.r, 0);
  hl.addColorStop(.1, 'rgba(255,255,255,0)'); hl.addColorStop(.18, `rgba(255,255,255,${T.dark ? .16 : .5})`); hl.addColorStop(.28, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(g.cx - g.r - 4, g.top, g.r * 2 + 8, g.bot - g.top); ctx.restore();
  g.path(ctx); ctx.strokeStyle = T.glass; ctx.lineWidth = 1.7; ctx.stroke();
  const rx = g.hw(g.top + 1) + 1.5; ctx.beginPath(); ctx.ellipse(g.cx, g.top, rx, rx * g.ell, 0, 0, 7); ctx.stroke();
}
function vesselDropHit(v, xLocal, rgb) {
  const fx = vfx(v); const g = geoFor(v); fx.ix = xLocal; fx.wave = Math.min(1.2, fx.wave + .16);
  const sy = g.levelY(fx.lvl);
  for (let k = 0; k < 3; k++) fx.spl.push({ x: xLocal, y: sy - 1, vx: rnd(-22, 22), vy: -rnd(25, 55), life: 0, c: rgb });
}
