import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EVAPORATION_MODEL, HEAT_CONDUCTION_ORDER, ionicConductivity, conductivityBrightness, conductivityCategory, evaporativeCoolingAt, solutionMass, reagentBottleMass } from './course_lab_models.mjs';

/* =====================================================================
   ACID–ALKALI BENCH 3D — prototype v5 (equipment library)
   Layers: CHEMISTRY (engine.js) · STATE (per vessel) · ASSETS (make*) · FX · INPUT
   Units: metres, seconds, mL, mmol, grams.
   ===================================================================== */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const clamp = THREE.MathUtils.clamp, D2R = THREE.MathUtils.degToRad;

/* ---------------- i18n ---------------- */
let LANG = (() => { try { const s = localStorage.getItem('lab.lang'); if (s && I18N[s]) return s; } catch (e) { } const n = (navigator.language || 'en').slice(0, 2); return n === 'et' ? 'et' : n === 'uk' ? 'uk' : n === 'ru' ? 'ru' : 'en'; })();
function T(k, p) { let s = (I18N[LANG] && I18N[LANG][k]) ?? I18N.en[k] ?? k; if (p) s = s.replace(/\{(\w+)\}/g, (m, q) => { const v = p[q]; return v && typeof v === 'object' && v.k ? T(v.k, v.p) : (v ?? ''); }); return s; }
const fmt = (x, d) => Number(x).toFixed(d).replace('.', LANG === 'en' ? '.' : ',');
const $ = id => document.getElementById(id);

/* ---------------- reagents ---------------- */
const REAG = {
  hcl: { tot: { Cl: .5 }, name: 'x.hcl', f: 'HCl', cap: 0xB5403A, hazard: 'corr' },
  hcl01: { tot: { Cl: .1 }, name: 'x.hcl01', f: 'HCl 0.10 M', cap: 0xB5403A, hazard: 'corr' },
  hcl001: { tot: { Cl: .01 }, name: 'x.hcl001', f: 'HCl 0.010 M', cap: 0xA54B45, hazard: 'corr' },
  acetic01: { tot: { Ac: .1 }, name: 'x.acetic01', f: 'CH₃COOH 0.10 M', cap: 0x9B603C, hazard: 'irr' },
  naoh: { tot: { Na: .5 }, name: 'x.naoh', f: 'NaOH', cap: 0x2F62A8, hazard: 'corr' },
  naoh01: { tot: { Na: .1 }, name: 'x.naoh01', f: 'NaOH 0.10 M', cap: 0x2F62A8, hazard: 'corr' },
  vinegar: { tot: { Ac: .08 }, name: 'x.vinegar', f: 'CH3COOH (dil.)', cap: 0x9B603C, hazard: 'irr' },
  na2co3: { tot: { Na: 2, Ct: 1 }, name: 'x.na2co3', f: 'Na₂CO₃', cap: 0x6C7773, hazard: 'irr' },
  water: { tot: {}, name: 'x.water', f: 'H₂O', cap: 0x59A6C9, hazard: null },
  wash: { tot: {}, name: 'x.wash', f: 'H₂O' },
  univ: { tot: {}, ind: 'univ', name: 'x.univ', f: 'UI', rgb: [80, 160, 75] },
  phph: { tot: {}, ind: 'phph', name: 'x.phph', f: 'Phph', rgb: [238, 238, 236] },
  mo: { tot: {}, ind: 'mo', name: 'x.mo', f: 'MO', rgb: [235, 130, 40] },
  nacl: { tot: { Na: .1, Cl: .1 }, name: 'x.nacl', f: 'NaCl', cap: 0x6C7773, hazard: null },
  na2so4: { tot: { Na: .2, SO4: .1 }, name: 'x.na2so4', f: 'Na₂SO₄', cap: 0x6C7773, hazard: null },
  cuso4: { tot: { Cu: .1, SO4: .1 }, name: 'x.cuso4', f: 'CuSO₄', cap: 0x2F62A8, hazard: 'harm' },
  agno3: { tot: { Ag: .1, NO3: .1 }, name: 'x.agno3', f: 'AgNO₃', rgb: [236, 236, 232] },
  bacl2: { tot: { Ba: .1, Cl: .2 }, name: 'x.bacl2', f: 'BaCl₂', rgb: [236, 236, 232] },
};
/* unlabelled bottles A–F for the identification labs: their contents are dealt out when a lab starts */
const UNK = ['A', 'B', 'C', 'D', 'E', 'F'];
for (const L of UNK) REAG['u' + L] = { tot: {}, name: 'x.unknown', f: L, cap: 0x9AA3A8, hazard: null };
/* solutions used by the labs (mol/L of each species) */
const SOL = {
  HCl: { Cl: .1 }, NaOH: { Na: .1 }, H2O: {}, NaCl: { Na: .1, Cl: .1 }, Na2CO3: { Na: .2, Ct: .1 }, NH4Cl: { NH3: .1, Cl: .1 },
  CH3COOH: { Ac: .1 }, NH3: { NH3: .1 }, CH3COONa: { Na: .1, Ac: .1 }, Na2SO4: { Na: .2, SO4: .1 }, NaNO3: { Na: .1, NO3: .1 },
  CuSO4: { Cu: .1, SO4: .1 }, FeCl3: { Fe3: .1, Cl: .3 }, FeSO4: { Fe2: .1, SO4: .1 }, PbNO32: { Pb: .1, NO3: .2 }, KI: { K: .1, I: .1 }, AgNO3: { Ag: .1, NO3: .1 },
};
const SOLF = { HCl: 'HCl', NaOH: 'NaOH', H2O: 'H₂O', NaCl: 'NaCl', Na2CO3: 'Na₂CO₃', NH4Cl: 'NH₄Cl', CH3COOH: 'CH₃COOH', NH3: 'NH₃', CH3COONa: 'CH₃COONa', Na2SO4: 'Na₂SO₄', NaNO3: 'NaNO₃', CuSO4: 'CuSO₄', FeCl3: 'FeCl₃', FeSO4: 'FeSO₄', PbNO32: 'Pb(NO₃)₂', KI: 'KI', AgNO3: 'AgNO₃' };
/* acid/base equivalents of a composition (per mL): >0 excess acid, <0 excess base; used for the heat of neutralisation */
const Z2 = ['Ba', 'Ca', 'Cu', 'Fe2', 'Pb', 'Mg', 'Zn', 'Mn', 'Ni', 'Co', 'Cd', 'Sn'];
const excessOf = t => { const g = k => t[k] || 0; let e = g('Cl') + g('NO3') + 2 * g('SO4') + g('I') + g('Ac') - g('Na') - g('K') - g('NH3') - g('Ag') - 3 * (g('Fe3') + g('Al')); for (const k of Z2) e -= 2 * g(k); return e; };
const compOf = id => { const r = REAG[id]; return { id, tot: r.tot, ind: r.ind ? { [r.ind]: 20 } : {}, isInd: !!r.ind, f: r.f }; };
const compOfVessel = v => { const tot = {}, ind = {}, solv = {}; for (const k in v.chem.tot) tot[k] = v.chem.tot[k] / v.chem.V; for (const k in v.chem.ind) ind[k] = v.chem.ind[k] / v.chem.V; for (const k in (v.chem.solv || {})) solv[k] = v.chem.solv[k] / v.chem.V; return { id: 'v' + v.letter, tot, ind, solv, isInd: false, f: T('x.beaker') + ' ' + v.letter }; };
const MW = { Na: 23, Cl: 35.45, Ct: 60, Ac: 59, NH3: 17 };
const FILM = 0.4; // mL that stays on the walls after emptying

/* ---------------- anonymous aggregate analytics ----------------
   Only meaningful laboratory actions are counted. Pointer, camera and raw
   gesture data never leave the browser. Failed batches remain queued. */
const aid = () => globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const AN = { sessionId: aid(), attemptId: null, labId: 'free', mode: 'free', startedAt: Date.now(), pending: new Map(), activeMs: 0, lastStep: null, completed: false, completionDirty: false, lastMeaningful: performance.now(), lastTick: performance.now(), lastFlush: performance.now(), outbox: [], sending: false };
function analyticsActivity(key, count = 1, amount = 0, step = key) {
  if (!AN.attemptId || !/^[a-z0-9_.:+-]{1,100}$/i.test(key)) return;
  const x = AN.pending.get(key) || { key, count: 0, amount: 0 }; x.count += count; x.amount += Math.max(0, Number(amount) || 0); AN.pending.set(key, x);
  if (step && /^[a-z0-9_.:+-]{1,100}$/i.test(step)) AN.lastStep = step;
  AN.lastMeaningful = performance.now();
}
function analyticsSnapshot() {
  if (!AN.attemptId || (!AN.pending.size && AN.activeMs < 1 && !AN.completionDirty)) return null;
  const payload = { batchId: aid(), sessionId: AN.sessionId, attemptId: AN.attemptId, labId: AN.labId, mode: AN.mode, startedAt: AN.startedAt, activeMs: Math.round(AN.activeMs), lastStep: AN.lastStep, completed: AN.completed, activities: [...AN.pending.values()] };
  AN.pending.clear(); AN.activeMs = 0; AN.completionDirty = false; return payload;
}
async function analyticsSend() {
  if (AN.sending || !AN.outbox.length) return; AN.sending = true;
  try {
    while (AN.outbox.length) {
      const r = await fetch('/api/analytics/flush', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(AN.outbox[0]), keepalive: true });
      if (!r.ok) break; AN.outbox.shift();
    }
  } catch (_) { /* offline or static hosting: simulation continues normally */ }
  AN.sending = false;
}
function analyticsFlush() { const p = analyticsSnapshot(); if (p) AN.outbox.push(p); AN.lastFlush = performance.now(); analyticsSend(); }
function analyticsStartAttempt(labId, mode) {
  analyticsFlush(); AN.attemptId = aid(); AN.labId = labId; AN.mode = mode; AN.startedAt = Date.now(); AN.pending.clear(); AN.activeMs = 0; AN.lastStep = 'lab:started'; AN.completed = false; AN.completionDirty = false; AN.lastMeaningful = AN.lastTick = performance.now(); analyticsActivity('lab:' + labId, 1, 0, 'lab:started'); analyticsFlush();
}
function analyticsCompleteAttempt() { if (!AN.attemptId || AN.completed) return; AN.completed = true; AN.completionDirty = true; analyticsActivity('lab:completed', 1, 0, 'lab:completed'); analyticsFlush(); }
setInterval(() => {
  const now = performance.now(), dt = now - AN.lastTick; AN.lastTick = now;
  if (AN.attemptId && !document.hidden && now - AN.lastMeaningful < 120000) AN.activeMs += Math.min(dt, 1500);
  if (now - AN.lastFlush > 10000) analyticsFlush(); else analyticsSend();
}, 1000);
addEventListener('pagehide', () => { const p = analyticsSnapshot(); if (p) AN.outbox.push(p); for (const b of AN.outbox) navigator.sendBeacon('/api/analytics/flush', new Blob([JSON.stringify(b)], { type: 'application/json' })); });

/* ---------------- notebook ---------------- */
const NB = { log: [], t0: performance.now(), started: Date.now(), session: null };
function logE(type, parts, head) { NB.log.push({ t: (performance.now() - NB.t0) / 1000, type, parts, head }); if (type === 'mistake' && parts[0] && parts[0][0]) analyticsActivity('safety:' + parts[0][0].replace(/^x\./, '').replace(/[^a-z0-9_.:+-]/gi, '_')); renderLog(); }
function snap(v) { const e = v.chem.eq || { ppt: {} }, p = {}; for (const k in e.ppt) if (e.ppt[k] > 0.0015) p[k] = e.ppt[k]; const lk = vesselLook(v.chem); return { p, ind: lk.indKey, inds: lk.inds.length, base: lk.baseKey, pH: v.chem.eq ? v.chem.eq.pH : 7 }; }
function describe(b, a, gas, addedInd) {
  const out = [];
  for (const k in a.p) if (!b.p[k]) out.push(['obs.ppt', { c: { k: 'col.' + PPT[k][0] } }]);
  let dis = false; for (const k in b.p) if (!a.p[k] && b.p[k] > 0.002) dis = true;
  if (dis) out.push(['obs.dissolve']); else for (const k in a.p) if (b.p[k] && a.p[k] < b.p[k] * .5) { out.push(['obs.partDissolve']); break; }
  if (gas > 0.003) out.push(['obs.gas']);
  if (a.inds) { if (addedInd || a.ind !== b.ind) out.push(['obs.ind', { c: { k: 'col.' + a.ind } }]); }
  else if (a.base !== b.base && a.base !== 'colourless') out.push(['obs.colour', { c: { k: 'col.' + a.base } }]);
  if (!out.length) out.push(['obs.none']); return out; }
function lookWithCloud(chem) { const lk = vesselLook(chem); if (lk.cloud) { const w = Math.min(.85, lk.pptTotal * 8); lk.rgb = lerpC(lk.rgb, hex2rgb(lk.cloud), w); lk.a = Math.max(lk.a, .3 + w * .65); } return lk; }
function endSession() {
  const s = NB.session; if (!s) return; NB.session = null; const v = s.v;
  if (v.eqDirty) doEq(v);
  const nd = Math.max(1, Math.round(s.amt / .05));
  const amt = s.comp.isInd || s.amt < .21 ? (nd === 1 ? T('amt.drop') : T('amt.drops', { n: nd })) : fmt(s.amt, s.amt < 10 ? 2 : 1) + ' mL';
  logE('obs', describe(s.before, snap(v), s.gas, s.comp.isInd), { v: v.letter, amt, f: s.comp.f });
  analyticsActivity((s.comp.isInd ? 'indicator:' : 'reagent:') + s.comp.id, 1, s.amt, s.comp.isInd ? 'indicator:added' : 'reagent:transferred');
  if (s.startV > FILM + .02 && !s.comp.isInd && s.comp.id !== 'wash') analyticsActivity('mix:liquid', 1, s.amt, 'mix:liquid');
}

/* ---------------- renderer / scene ---------------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
/* phones first: coarse pointer or small screen → lighter start; a frame-rate watchdog steps quality down further if needed */
const MOBILE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 700;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const Q = { level: 2, pr: Math.min(MOBILE ? 1.5 : 2, window.devicePixelRatio || 1), fx: 1 };
renderer.setPixelRatio(Q.pr);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe6ebe9);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20); camera.position.set(0.04, 0.56, 0.98);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.04, 0.05, -0.02); controls.enableDamping = false; controls.enablePan = true; controls.screenSpacePanning = false; controls.zoomToCursor = true; controls.panSpeed = 1.2;
controls.listenToKeyEvents(window); controls.keyPanSpeed = 14;
const VIEW_WIDE = { p: V3(0.04, 0.56, 0.98), t: V3(0.04, 0.05, -0.02) }, VIEW_TALL = { p: V3(0.06, 0.68, 1.02), t: V3(0.06, 0.08, -0.03) };
const view0 = () => camera.aspect < .85 ? VIEW_TALL : VIEW_WIDE;
let viewTouched = false;
controls.enableZoom = false; controls.enableRotate = true; controls.enablePan = true; controls.minDistance = 0.1; controls.maxDistance = 3.5;
controls.minPolarAngle = D2R(8); controls.maxPolarAngle = D2R(88);
/* Free orbit is the default exploration mode. The named-view controls below
   remain a camera dashboard for exact, repeatable shelf and bench shots. */
scene.add(new THREE.HemisphereLight(0xf6f9ff, 0xb8c0bc, 0.95));
const sun = new THREE.DirectionalLight(0xfff4e6, 1.65); sun.position.set(0.55, 1.1, 0.6); sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -.75, right: .75, top: .6, bottom: -.6, near: .1, far: 3 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.002; scene.add(sun);
const fillL = new THREE.DirectionalLight(0xdfe9ff, 0.68); fillL.position.set(-0.8, 0.5, 0.3); scene.add(fillL);

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const benchTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#a3ada9'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26000; i++) { const v = 130 + Math.random() * 70; g.fillStyle = `rgba(${v},${v + 4},${v + 3},${Math.random() * .3})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } });
benchTex.wrapS = benchTex.wrapT = THREE.RepeatWrapping;
const tileTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#bfc6c3'; g.fillRect(0, 0, w, h); const n = 8, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 232 + Math.random() * 10; g.fillStyle = `rgb(${v},${v + 3},${v + 1})`; g.fillRect(i * s + 4, j * s + 4, s - 8, s - 8); } });
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(3, 1.2);
const softTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const shadowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.28)'); r.addColorStop(.55, 'rgba(0,0,0,.10)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });

/* ---------------- materials ---------------- */
const MAT = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0xb4c9c9, roughness: 0.03, transparent: true, opacity: 0.3, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false }),
  amber: new THREE.MeshPhysicalMaterial({ color: 0x7a3d10, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false }),
  pe: new THREE.MeshPhysicalMaterial({ color: 0xf4f4ee, roughness: 0.45, transmission: .35, thickness: .004, clearcoat: .2 }),
  rubber: new THREE.MeshPhysicalMaterial({ color: 0x8e2a2a, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.6, clearcoat: 0.15 }),
  black: new THREE.MeshPhysicalMaterial({ color: 0x18191a, roughness: 0.35, clearcoat: 0.4 }),
  grey: new THREE.MeshPhysicalMaterial({ color: 0x3a3f42, roughness: 0.4, clearcoat: 0.3 }),
  white: new THREE.MeshPhysicalMaterial({ color: 0xe9ecea, roughness: 0.35, clearcoat: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xb8c0c4, metalness: 0.95, roughness: 0.28, side: THREE.DoubleSide }),
  salt: new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.9 }),
};
const liquidMat = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.06, ior: 1.333, attenuationColor: new THREE.Color(0xb9d6e2), attenuationDistance: 0.25, envMapIntensity: 1.2, side: THREE.DoubleSide });

/* ---------------- room: bench with a sink cut-out ---------------- */
const SINK = { x0: .47, x1: .66, z0: -.11, z1: .14, depth: .12 };
const TAP = { on: false, lever: null, spout: null, flow: 7 };
SINK.cx = (SINK.x0 + SINK.x1) / 2; SINK.cz = (SINK.z0 + SINK.z1) / 2;
{
  const mat = new THREE.MeshPhysicalMaterial({ map: benchTex, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.35, envMapIntensity: .35 });
  const slab = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, .05, z1 - z0), mat); m.position.set((x0 + x1) / 2, -.025, (z0 + z1) / 2); m.receiveShadow = true; m.userData.help = 'bench'; scene.add(m); };
  slab(-.95, SINK.x0, -.5, .9); slab(SINK.x1, .95, -.5, .9); slab(SINK.x0, SINK.x1, -.5, SINK.z0); slab(SINK.x0, SINK.x1, SINK.z1, .9);
  const w = SINK.x1 - SINK.x0, d = SINK.z1 - SINK.z0, h = SINK.depth;
  // A moderately rough stainless surface avoids the high-frequency reflection
  // pattern that made the basin look like wire mesh on smaller screens.
  const sinkSteel = new THREE.MeshPhysicalMaterial({ color: 0xaeb8bb, metalness: .55, roughness: .62, clearcoat: .08, clearcoatRoughness: .5, side: THREE.DoubleSide });
  const plane = (pw, ph, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), sinkSteel); m.position.copy(pos); m.rotation.set(...rot); m.receiveShadow = false; m.userData.help = 'sink'; scene.add(m); };
  plane(w, d, V3(SINK.cx, -h, SINK.cz), [-Math.PI / 2, 0, 0]);
  plane(w, h, V3(SINK.cx, -h / 2, SINK.z0), [0, 0, 0]); plane(w, h, V3(SINK.cx, -h / 2, SINK.z1), [0, Math.PI, 0]);
  plane(d, h, V3(SINK.x0, -h / 2, SINK.cz), [0, Math.PI / 2, 0]); plane(d, h, V3(SINK.x1, -h / 2, SINK.cz), [0, -Math.PI / 2, 0]);
  const drain = new THREE.Mesh(new THREE.CircleGeometry(.018, 32), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: .8, roughness: .4 })); drain.rotation.x = -Math.PI / 2; drain.position.set(SINK.cx, -h + .001, SINK.cz); scene.add(drain);
  const fc = new THREE.CatmullRomCurve3([V3(SINK.cx, 0, SINK.z0 - .03), V3(SINK.cx, .2, SINK.z0 - .03), V3(SINK.cx, .26, SINK.z0 + .02), V3(SINK.cx, .2, SINK.z0 + .09)]);
  const tap = new THREE.Mesh(new THREE.TubeGeometry(fc, 40, .009, 16), MAT.steel); tap.castShadow = true; tap.userData.help = 'sink'; scene.add(tap);
  const lever = new THREE.Group(); lever.position.set(SINK.cx, .07, SINK.z0 - .03); lever.userData.help = 'tap'; scene.add(lever);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .02, 20), MAT.steel); hub.rotation.x = Math.PI / 2; hub.position.z = .012; lever.add(hub);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.075, .01, .01), new THREE.MeshPhysicalMaterial({ color: 0x2F62A8, roughness: .4, clearcoat: .3 })); arm.position.set(.035, 0, .022); lever.add(arm);
  TAP.lever = lever; TAP.spout = V3(SINK.cx, .2, SINK.z0 + .09);
}
const wall = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35 })); wall.position.set(0, 0.6, -0.5); wall.receiveShadow = true; wall.userData.help = 'wall'; wall.visible = false; scene.add(wall);
function contactShadow(r, x, z, op = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.8, r * 2.8), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: op })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0006, z); m.renderOrder = -1; scene.add(m); return m; }
function shellLathe(outer, t, seg = 96) { const inner = outer.map(p => V2(Math.max(0.0004, p.x - t), Math.max(p.y, t))).reverse(); const g = new THREE.LatheGeometry([...outer, ...inner], seg); g.computeVertexNormals(); return g; }

/* ---------------- container shape model ----------------
   Samples the cavity volume once; for any tilt θ it gives the height of a level surface that encloses V mL
   (world height of a local point = y·cosθ − u·sinθ, u measured towards the spout) and the volume that fits
   below the lowest point of the mouth. Liquid above that capacity flows out. */
function makeShape(rOf, y0, y1, rMouth, N = 6000) {
  const S = 160, dy = (y1 - y0) / S, cum = [0];
  for (let i = 0; i < S; i++) { const r = rOf(y0 + (i + .5) * dy); cum.push(cum[i] + Math.PI * r * r * dy); }
  const Vtot = cum[S] * 1e6, U = new Float32Array(N), Y = new Float32Array(N);
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < N; k++) { const tgt = (k + rnd()) / N * cum[S]; let i = 0; while (cum[i + 1] < tgt) i++; const y = y0 + (i + rnd()) * dy; const r = rOf(y) * Math.sqrt(rnd()); U[k] = r * Math.cos(rnd() * 6.2832); Y[k] = y; }
  const cache = new Map();
  const sorted = d => { d = clamp(d, 0, 180); let a = cache.get(d); if (!a) { const th = D2R(d), c = Math.cos(th), sn = Math.sin(th); a = new Float32Array(N); for (let k = 0; k < N; k++) a[k] = Y[k] * c - U[k] * sn; a.sort(); cache.set(d, a); } return a; };
  const lip = d => y1 * Math.cos(D2R(d)) - rMouth * Math.sin(D2R(d));
  const below = (d, h) => { const a = sorted(d); let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < h) lo = m + 1; else hi = m; } return lo / N * Vtot; };
  const capAt = th => { const d0 = Math.floor(clamp(th, 0, 179.999)), f = th - d0; const a = below(d0, lip(d0)), b = below(d0 + 1, lip(d0 + 1)); return a + (b - a) * f; };
  const lvl = (d, V) => { const a = sorted(d); const idx = clamp(V / Vtot * N, 0, N - 1.001); const i = Math.floor(idx); return a[i] + (a[i + 1] - a[i]) * (idx - i); };
  const levelAt = (th, V) => { const d0 = Math.floor(clamp(th, 0, 179.999)), f = th - d0; return lvl(d0, V) * (1 - f) + lvl(d0 + 1, V) * f; };
  const threshold = V => { for (let d = 0; d <= 180; d++) if (capAt(d) < V - .05) return d; return 180; };
  return { Vtot, capAt, levelAt, threshold };
}
const piecewise = pts => y => { for (let i = 1; i < pts.length; i++) if (y <= pts[i].y || i === pts.length - 1) { const a = pts[i - 1], b = pts[i]; const f = b.y > a.y ? clamp((y - a.y) / (b.y - a.y), 0, 1) : 1; return a.x + (b.x - a.x) * f; } return pts[pts.length - 1].x; };

/* ---------------- shared FX: splashes, drops, streams, salt grains ---------------- */
const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: .004, ior: 1.33, envMapIntensity: 1.5 });
const splashMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), dropMat, 240); splashMesh.count = 0; splashMesh.frustumCulled = false; scene.add(splashMesh);
const SPL = []; const M4 = new THREE.Matrix4(), QI = new THREE.Quaternion(), SC = V3(), P3 = V3();
const grainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.salt, 300); grainMesh.count = 0; grainMesh.frustumCulled = false; scene.add(grainMesh); const GR = [];
const streams = new Map(); const streamMat = liquidMat(); streamMat.thickness = .004; streamMat.attenuationDistance = 2;
function drawStream(key, a, b, rate) {
  let m = streams.get(key); if (m) { scene.remove(m); m.geometry.dispose(); streams.delete(key); }
  if (!a) return;
  const mid = a.clone().lerp(b, .35); mid.y = a.y - .01;
  m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, .0008 + rate * .0005, 10), streamMat); m.renderOrder = 2; scene.add(m); streams.set(key, m);
}
const drops = []; const dropGeo = new THREE.SphereGeometry(1, 16, 12);
function spawnDrop(pos, comp, target) { const m = new THREE.Mesh(dropGeo, dropMat); m.scale.set(.0021, .0028, .0021); m.position.copy(pos); scene.add(m); drops.push({ m, vy: 0, comp, target }); }

/* ===================== ASSET: BEAKER (vessel) =====================
   PLACEHOLDER. Griffin beaker 250 mL, Ø70 × 95 mm, 1.6 mm wall, rolled rim, enamel scale and letter.
   Pivot: centre of base. Code drives: liquid (surface grid / tilted clipped body), plumes, bubbles, foam, solid pile. */
const vessels = []; let beakerShape = null;
function makeBeaker(letter, x, z, glassMass, init) {
  const R = .035, H = .095, t = .0016, b = .0032, Ri = R - t - .0002;
  if (!beakerShape) beakerShape = makeShape(() => Ri, b, H, Ri);
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.userData.help = 'beaker:' + letter;
  const outer = [V2(0, 0), V2(R - .006, 0), V2(R - .0015, .0008), V2(R, .005), V2(R, H - .002), V2(R + .0012, H), V2(R + .0006, H + .0012)];
  const glass = new THREE.Mesh(shellLathe(outer, t), MAT.glass); glass.renderOrder = 3; g.add(glass);
  const levelH = 250e-6 / (Math.PI * Ri * Ri);
  const grad = canvasTex(1024, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = '600 26px "IBM Plex Sans", sans-serif';
    for (let ml = 25; ml <= 250; ml += 25) { const y = h - (ml / 250) * (h - 20) - 6; const major = ml % 50 === 0; c.fillRect(40, y, major ? 90 : 55, 4); if (major) c.fillText(String(ml), 140, y + 9); }
    c.font = '700 22px "IBM Plex Sans", sans-serif'; c.fillText('250 mL', 600, 60); c.font = '500 18px "IBM Plex Sans", sans-serif'; c.fillText('BORO 3.3', 600, 90);
    c.fillStyle = '#17322c'; c.font = '800 72px "IBM Plex Sans", sans-serif'; c.fillText(letter, 620, 194); });
  const gm = new THREE.Mesh(new THREE.CylinderGeometry(R + .00025, R + .00025, levelH, 96, 1, true, -1.2, 2.0), new THREE.MeshStandardMaterial({ map: grad, transparent: true, roughness: .6, depthWrite: false }));
  gm.position.y = b + levelH / 2; gm.renderOrder = 4; g.add(gm);
  const sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 640; sampleCanvas.height = 220;
  const sampleTexture = new THREE.CanvasTexture(sampleCanvas); sampleTexture.colorSpace = THREE.SRGBColorSpace; sampleTexture.anisotropy = 8;
  const sampleTag = new THREE.Mesh(new THREE.PlaneGeometry(.066, .0227), new THREE.MeshBasicMaterial({ map: sampleTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  sampleTag.position.set(0, .052, R + .0018); sampleTag.renderOrder = 6; sampleTag.visible = false; g.add(sampleTag);
  const mat = liquidMat();
  const NR = 22, NS = 72; const surfGeo = new THREE.BufferGeometry();
  { const pos = new Float32Array((1 + NR * NS) * 3); const idx = []; for (let i = 1; i <= NR; i++) for (let j = 0; j < NS; j++) { const a = (i - 1) * NS + j + 1, bb = (i - 1) * NS + (j + 1) % NS + 1; if (i === 1) idx.push(0, bb, a); else { const c = (i - 2) * NS + j + 1, d = (i - 2) * NS + (j + 1) % NS + 1; idx.push(c, d, bb, c, bb, a); } } surfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); surfGeo.setIndex(idx); }
  const surf = new THREE.Mesh(surfGeo, mat); surf.renderOrder = 1; g.add(surf);
  const sideGeo = new THREE.CylinderGeometry(Ri, Ri, 1, NS, 1, true); sideGeo.translate(0, .5, 0);
  const side = new THREE.Mesh(sideGeo, mat); side.renderOrder = 1; side.position.y = b; g.add(side);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(Ri, NS), mat); bottom.rotation.x = Math.PI / 2; bottom.position.y = b; g.add(bottom);
  const meniscus = new THREE.Mesh(new THREE.RingGeometry(Ri * .84, Ri * .985, NS), new THREE.MeshBasicMaterial({ color: 0x7897a0, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false }));
  meniscus.rotation.x = -Math.PI / 2; meniscus.renderOrder = 2; meniscus.visible = false; g.add(meniscus);
  const plane = new THREE.Plane(V3(0, -1, 0), 0); const tmat = liquidMat(); tmat.clippingPlanes = [plane];
  const tilted = new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, H - b, NS, 1, false), tmat); tilted.position.y = b + (H - b) / 2; tilted.visible = false; g.add(tilted);
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: .32, clearcoat: 1, envMapIntensity: 2.4, depthWrite: false }), 420); bubbles.count = 0; bubbles.frustumCulled = false; bubbles.renderOrder = 2; g.add(bubbles);
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .25, transparent: true, opacity: .75, depthWrite: false }), 300); foam.count = 0; foam.frustumCulled = false; g.add(foam);
  const pile = new THREE.Mesh(new THREE.ConeGeometry(1, .6, 24), MAT.salt); pile.visible = false; pile.castShadow = true; g.add(pile);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(R + .006, R + .006, H, 12), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = H / 2; g.add(proxy);
  const sh = contactShadow(.045, x, z, .9);
  const v = { kind: 'vessel', letter, g, R, H, b, Ri, glassMass, shape: beakerShape, Qmax: 30, maxTilt: 150, proxy, sh, mat, tmat, plane, surf, surfGeo, NR, NS, side, bottom, meniscus, sampleCanvas, sampleTexture, sampleTag, tilted, bubbles, foam, pile,
    chem: { V: 0, tot: {}, ind: {}, cap: 250 }, solid: 0, temp: 22, neutPrev: 0, warmLogT: 22, gas: 0, stir: 0, swirl: 0, visualKick: 0, waves: [], plumes: [], B: [], foamAmt: 0, bAcc: 0,
    rgb: [220, 236, 242], a: .28, level: b, eqDirty: true, lastEq: 0, base: V3(x, 0, z), tilt: 0, dir: V3(-1, 0, 0), spout: V3(x, H, z), held: false, onBalance: false, last: V3(x, 0, z), base0: V3(x, 0, z),
    nuc: Array.from({ length: 40 }, () => { const wall = Math.random() < .35; const a = Math.random() * 6.283; const r = wall ? Ri - .0006 : Math.sqrt(Math.random()) * Ri * .9; return { x: Math.sin(a) * r, z: Math.cos(a) * r, wall }; }),
    foamSpots: Array.from({ length: 300 }, () => { const r = Math.sqrt(Math.random()) * Ri * .97, a = Math.random() * 6.283; return { x: Math.sin(a) * r, z: Math.cos(a) * r, s: .0007 + Math.random() * .0016, ph: Math.random() * 6 }; }),
    label: () => T('x.beaker') + ' ' + letter + ' · ' + fmt(v.chem.V, 1) + ' mL' + (v.solid > .005 ? ' + ' + fmt(v.solid, 2) + ' g NaCl' : '') + ' — ' + T('x.beakerHint') };
  if (init) { v.chem.V = init.V; v.chem.tot = { ...init.tot }; }
  equilibrate(v.chem); const lk = vesselLook(v.chem); v.rgb = lk.rgb.slice(); v.a = lk.a; v.level = levelOf(v);
  proxy.userData.obj = v; vessels.push(v); return v;
}
function setSampleTag(v, title = '', detail = '') {
  const c = v.sampleCanvas.getContext('2d'), w = v.sampleCanvas.width, h = v.sampleCanvas.height;
  c.clearRect(0, 0, w, h); v.sampleTag.visible = !!title; if (!title) { v.sampleTexture.needsUpdate = true; return; }
  c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#167269'; c.fillRect(0, 0, 18, h);
  c.strokeStyle = '#8a918d'; c.lineWidth = 5; c.strokeRect(2.5, 2.5, w - 5, h - 5);
  c.fillStyle = '#17231f'; c.textAlign = 'left'; c.font = '700 72px "IBM Plex Sans", sans-serif'; c.fillText(title, 42, 91);
  c.fillStyle = '#354b44'; c.font = '600 44px "IBM Plex Mono", monospace'; c.fillText(detail, 42, 165);
  v.sampleTexture.needsUpdate = true;
}
function levelOf(v) { return v.b + v.chem.V * 1e-6 / (Math.PI * v.Ri * v.Ri); }
function surfaceY(v, x, z, t) {
  const r = Math.hypot(x, z); let y = v.level;
  if (v.chem.V > .05) y += 0.0013 * Math.exp(-(v.Ri - r) / 0.0018);
  y -= v.swirl * 0.004 * (1 - (r / v.Ri) ** 2);
  for (const w of v.waves) { const age = t - w.t0; const d = Math.hypot(x - w.x, z - w.z); y += w.A * Math.exp(-age * 2.2) * Math.sin(420 * d - 28 * age) * Math.exp(-Math.abs(d - age * .065) * 60); }
  return y;
}
function addWave(v, lx, lz, A) { v.waves.push({ x: lx, z: lz, A, t0: clock.elapsedTime }); if (v.waves.length > 24) v.waves.shift(); }
const worldToLocal = (v, p) => V3(p.x - v.g.position.x, p.y - v.g.position.y, p.z - v.g.position.z);
const rimY = v => v.g.position.y + v.H;

/* ---------- vessel chemistry ---------- */
function addLiquid(v, comp, dV, wx, wz) {
  if (dV <= 0) return 0; ppeCheck(comp);
  if (v.chem.V + dV > v.chem.cap - 6) { if (!v.fullLogged) { v.fullLogged = true; logE('info', [['x.full', { v: v.letter }]]); } return 0; }
  if (!NB.session || NB.session.v !== v || NB.session.id !== comp.id) { endSession(); NB.session = { v, id: comp.id, comp, before: snap(v), startV: v.chem.V, amt: 0, gas: 0, last: 0 }; }
  const s = NB.session; s.amt += dV; s.last = performance.now();
  const c = v.chem; const bulk = {}, bulkInd = {}; if (c.V > 0) { for (const k in c.tot) bulk[k] = c.tot[k] / c.V; for (const k in c.ind) bulkInd[k] = c.ind[k] / c.V; }
  { const e = excessOf(comp.tot) * dV; if (e > 0) c.acidEq = (c.acidEq || 0) + e; else c.baseEq = (c.baseEq || 0) - e; }
  c.V += dV; for (const k in comp.tot) c.tot[k] = (c.tot[k] || 0) + comp.tot[k] * dV; for (const k in comp.ind) c.ind[k] = (c.ind[k] || 0) + comp.ind[k] * dV; c.solv ||= {}; for (const k in (comp.solv || {})) c.solv[k] = (c.solv[k] || 0) + comp.solv[k] * dV;
  v.eqDirty = true; v.visualKick = 1;
  if (wx != null && (Object.keys(bulkInd).length || Object.keys(comp.ind).length)) {
    const loc = { V: 1, tot: {}, ind: {} }; for (const k in bulk) loc.tot[k] = bulk[k] / 2; for (const k in comp.tot) loc.tot[k] = (loc.tot[k] || 0) + comp.tot[k] / 2;
    for (const k of new Set([...Object.keys(bulkInd), ...Object.keys(comp.ind)])) loc.ind[k] = 2;
    equilibrate(loc); const lk = vesselLook(loc); spawnPlume(v, wx, wz, lk.rgb, comp.isInd ? 4 : 2 + dV * 6);
  }
  return dV;
}
function removeLiquid(v, dV) { const c = v.chem; const can = Math.max(0, c.V - FILM); dV = Math.min(dV, can); if (dV <= 0) return 0; const k = 1 - dV / c.V; for (const x in c.tot) c.tot[x] *= k; c.acidEq = (c.acidEq || 0) * k; c.baseEq = (c.baseEq || 0) * k; v.neutPrev *= k; for (const x in c.ind) c.ind[x] *= k; for (const x in (c.solv || {})) c.solv[x] *= k; c.V -= dV; v.eqDirty = true; return dV; }
function doEq(v) {
  v.eqDirty = false; const c = v.chem; if (c.V <= 0.01) { c.eq = { pH: 7, ppt: {}, dis: {} }; return; }
  const gas = equilibrate(c);
  if (gas > 0) { v.gas += gas; if (NB.session && NB.session.v === v) NB.session.gas += gas; }
  const neut = Math.min(c.acidEq || 0, c.baseEq || 0);
  if (neut > v.neutPrev) {
    const rx = window.ReactionSimulation && window.ReactionSimulation.neutralization({ acidMmol: c.acidEq || 0, baseMmol: c.baseEq || 0, previousMmol: v.neutPrev, solutionMl: c.V });
    v.temp += rx ? rx.deltaC : (neut - v.neutPrev) * 57.3 / (c.V * 4.18);
  }
  v.neutPrev = neut;
  if (v.temp - v.warmLogT > 1.5) { v.warmLogT = v.temp; logE('obs', [[v.rxHot ? 'x.warmRx' : 'x.warm', { t: fmt(v.temp, 1) }]], { v: v.letter, amt: '', f: '' }); }
}
function liquidMass(v) { return solutionMass(v.chem, MW); }
function vesselMass(v) { return v.glassMass + liquidMass(v) + v.solid + (v.metal ? v.metal.reduce((a, p) => a + p.m, 0) : 0); }

/* ---------- plumes ---------- */
function spawnPlume(v, wx, wz, rgb, n) {
  const lx = wx - v.g.position.x, lz = wz - v.g.position.z;
  for (let i = 0; i < n && v.plumes.length < 120; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace), transparent: true, depthWrite: false, opacity: 0 }));
    sp.position.set(lx + (Math.random() - .5) * .004, v.level - .002 - Math.random() * .004, lz + (Math.random() - .5) * .004); sp.scale.setScalar(.004);
    sp.userData = { life: 0, max: 2.6 + Math.random() * 1.8, vy: -.004 - Math.random() * .01, R: .018 + Math.random() * .022, ang: Math.random() * 6 }; sp.renderOrder = 2;
    v.g.add(sp); v.plumes.push(sp);
  }
}
function clearFx(v) { for (const p of v.plumes) { v.g.remove(p); p.material.dispose(); } v.plumes.length = 0; v.B.length = 0; v.foamAmt = 0; }

/* ---------- per-frame vessel update ---------- */
function updateVessel(v, dt, t) {
  if (v.eqDirty && t - v.lastEq > .06) { v.lastEq = t; doEq(v); }
  if (v.solid > 0 && v.chem.V > .5) { const cap = Math.max(0, .36 * v.chem.V - ((v.chem.tot.Cl || 0) * 58.44 / 1000)); const dm = Math.min(v.solid, cap, .07 * dt * (1 + 6 * v.stir)); if (dm > 0) { v.solid -= dm; const n = dm / 58.44 * 1000; v.chem.tot.Na = (v.chem.tot.Na || 0) + n; v.chem.tot.Cl = (v.chem.tot.Cl || 0) + n; v.eqDirty = true; } }
  const sp = v.g.position.distanceTo(v.last) / Math.max(dt, 1e-3); v.last.copy(v.g.position);
  if (v.held && v.tilt < 5 && sp > .05) { v.stir = Math.min(1, v.stir + sp * dt * 3); if (Math.random() < .3) addWave(v, (Math.random() - .5) * .03, (Math.random() - .5) * .03, .0004); }
  v.level += (levelOf(v) - v.level) * (1 - Math.exp(-dt * 8));
  const lk = lookWithCloud(v.chem); const k = 1 - Math.exp(-dt * (.8 + v.stir * 4 + v.visualKick * 9));
  v.rgb = v.rgb.map((x, i) => x + (lk.rgb[i] - x) * k); v.a += (lk.a - v.a) * k;
  const c = new THREE.Color().setRGB(v.rgb[0] / 255, v.rgb[1] / 255, v.rgb[2] / 255, THREE.SRGBColorSpace);
  const kk = clamp((v.a - .26) * 1.7, 0, .92);
  for (const m of [v.mat, v.tmat]) { m.color.setRGB(1, 1, 1).lerp(c, kk); m.attenuationColor.copy(c); m.attenuationDistance = .9 - kk * .55; m.emissive.copy(c).multiplyScalar(.22 * kk); }
  v.stir *= Math.exp(-dt / 1.6); v.visualKick *= Math.exp(-dt / .35); v.swirl += (v.stir - v.swirl) * (1 - Math.exp(-dt * 3));
  v.temp += (22 - v.temp) * (1 - Math.exp(-dt / 240));
  const has = v.chem.V > .02, tilted = v.tilt > 1;
  v.surf.visible = v.side.visible = v.bottom.visible = has && !tilted; v.tilted.visible = has && tilted;
  v.meniscus.visible = has && !tilted; v.meniscus.position.y = v.level + .00045;
  v.bubbles.visible = v.foam.visible = !tilted;
  if (tilted && has) v.plane.constant = v.g.position.y + v.shape.levelAt(v.tilt, v.chem.V);
  if (has && !tilted) {
    const p = v.surfGeo.attributes.position.array; p[0] = 0; p[1] = surfaceY(v, 0, 0, t); p[2] = 0;
    for (let i = 1; i <= v.NR; i++) { const r = v.Ri * i / v.NR; for (let j = 0; j < v.NS; j++) { const a = j / v.NS * Math.PI * 2; const x = Math.sin(a) * r, z = Math.cos(a) * r; const q = ((i - 1) * v.NS + j + 1) * 3; p[q] = x; p[q + 1] = surfaceY(v, x, z, t); p[q + 2] = z; } }
    v.surfGeo.attributes.position.needsUpdate = true; v.surfGeo.computeVertexNormals();
    v.side.scale.y = Math.max(.0005, v.level + .0011 - v.b);
  }
  v.waves = v.waves.filter(w => t - w.t0 < 2.5);
  if (v.solid > .005) { const s = .004 + .0075 * Math.cbrt(v.solid); v.pile.visible = true; v.pile.scale.set(s, s, s); v.pile.position.set(0, v.b + s * .3, 0); } else v.pile.visible = false;
  for (let i = v.plumes.length - 1; i >= 0; i--) {
    const s = v.plumes[i], u = s.userData; u.life += dt * (1 + v.stir * 2); const f = u.life / u.max;
    if (f >= 1 || tilted) { v.g.remove(s); s.material.dispose(); v.plumes.splice(i, 1); continue; }
    s.position.y = Math.max(v.b + .003, s.position.y + u.vy * dt * (1 - f));
    const r = Math.hypot(s.position.x, s.position.z), a = Math.atan2(s.position.x, s.position.z) + v.swirl * dt * 6 + Math.sin(u.ang + u.life) * dt * .3;
    const rr = Math.min(v.Ri * .85, r + dt * .004); s.position.x = Math.sin(a) * rr; s.position.z = Math.cos(a) * rr; s.position.y = Math.min(s.position.y, v.level - .002);
    s.scale.setScalar(.004 + (u.R - .004) * Math.min(1, f * 1.6)); s.material.opacity = Math.min(.55, f * 6) * (1 - f) * 1.4;
  }
  v.gas *= Math.exp(-dt / 2.4);
  v.bAcc += Math.min(240 * Q.fx, v.gas * 900 * Q.fx) * dt;
  while (v.bAcc > 1) { v.bAcc--; const n = v.nuc[(Math.random() * v.nuc.length) | 0]; const y = n.wall ? v.b + .002 + Math.random() * Math.max(.001, v.level - v.b - .004) : v.b + .0008; if (v.B.length < 420) v.B.push({ x: n.x, y, z: n.z, r: .00035 + Math.random() * .0006, gas: true, ph: Math.random() * 6 }); }
  let n = 0;
  for (let i = v.B.length - 1; i >= 0; i--) {
    const b = v.B[i]; b.y += (.045 + b.r * 110) * dt; b.r = Math.min(.0022, b.r * (1 + dt * .35)); b.x += Math.sin(t * 9 + b.ph) * b.r * 20 * dt; b.z += Math.cos(t * 7 + b.ph) * b.r * 20 * dt;
    const a = Math.atan2(b.x, b.z) + v.swirl * dt * 6; const rr = Math.min(v.Ri - b.r, Math.hypot(b.x, b.z)); b.x = Math.sin(a) * rr; b.z = Math.cos(a) * rr;
    if (b.y >= surfaceY(v, b.x, b.z, t) - b.r * .3 || !has) {
      if (b.gas) v.foamAmt = Math.min(1.2, v.foamAmt + b.r * 1.4);
      if (b.r > .0009 && Math.random() < .5) SPL.push({ x: b.x + v.g.position.x, y: v.g.position.y + v.level + .001, z: b.z + v.g.position.z, vx: (Math.random() - .5) * .08, vy: .12 + Math.random() * .2, vz: (Math.random() - .5) * .08, r: .0004 + Math.random() * .0004 });
      if (b.r > .0007) addWave(v, b.x, b.z, .00012);
      v.B.splice(i, 1); continue;
    }
    M4.compose(P3.set(b.x, b.y, b.z), QI, SC.set(b.r, b.r * .92, b.r)); v.bubbles.setMatrixAt(n++, M4);
  }
  v.bubbles.count = n; v.bubbles.instanceMatrix.needsUpdate = true;
  v.foamAmt *= Math.exp(-dt / 3.5); if (!has) v.foamAmt = 0;
  const fc = Math.min(300, Math.floor(v.foamAmt * 360)); let q = 0;
  for (let i = 0; i < fc; i++) { const f = v.foamSpots[i]; const y = surfaceY(v, f.x, f.z, t) + f.s * .3; const s = f.s * (.6 + .4 * Math.sin(t * 2 + f.ph)); M4.compose(P3.set(f.x, y, f.z), QI, SC.set(s, s * .55, s)); v.foam.setMatrixAt(q++, M4); }
  v.foam.count = q; v.foam.instanceMatrix.needsUpdate = true;
  v.sh.position.set(v.g.position.x, .0006, v.g.position.z); v.sh.visible = !v.onBalance && !v.stowed && !v.inSink; v.sh.material.opacity = .42 * Math.max(0, 1 - v.g.position.y / .1);
}

/* ===================== ASSET: REAGENT BOTTLE ===================== (pivot: base; spout (0,0.142,0)) */
function labelTex(id) {
  const r = REAG[id];
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b2622'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    const fs = r.f.length > 14 ? 38 : r.f.length > 10 ? 47 : r.f.length > 7 ? 58 : 74; g.font = `600 ${fs}px "IBM Plex Mono", monospace`; g.fillText(r.f, 36, 112);
    g.font = '500 30px "IBM Plex Sans", sans-serif'; const nm = T(r.name); g.fillText(nm.length > 26 ? nm.slice(0, 26) + '…' : nm, 36, 168);
    g.font = '400 22px "IBM Plex Sans", sans-serif'; g.fillStyle = '#55645e'; g.fillText('BENCH CHEMISTRY LAB · REAGENT', 36, 214);
    if (r.hazard) { g.save(); g.translate(430, 110); g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.strokeStyle = '#d0121b'; g.lineWidth = 9; g.fillRect(-42, -42, 84, 84); g.strokeRect(-42, -42, 84, 84); g.restore(); g.fillStyle = '#111'; g.font = '700 34px "IBM Plex Sans", sans-serif'; g.textAlign = 'center'; g.fillText(r.hazard === 'corr' ? '⚗' : '!', 430, 124); g.textAlign = 'left'; }
  });
}
const BOT_H = .142, BOT_R = .029; let bottleShape = null;
const bottleOuter = [V2(0, 0), V2(BOT_R - .005, 0), V2(BOT_R - .001, .001), V2(BOT_R, .006), V2(BOT_R, .088), V2(BOT_R - .004, .1), V2(.016, .112), V2(.012, .12), V2(.0115, .136), V2(.0128, .138), V2(.0128, .142)];
const STOCK = 180;
function makeBottle(id, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.userData.help = 'bottle:' + id;
  const glass = new THREE.Mesh(shellLathe(bottleOuter, .0016, 64), MAT.glass); glass.renderOrder = 3; g.add(glass);
  const inner = bottleOuter.map(p => V2(Math.max(0, p.x - .0022), Math.max(p.y, .003))); inner.push(V2(0, .138));
  if (!bottleShape) bottleShape = makeShape(piecewise(inner.slice(1, -1)), .003, BOT_H, .0106);
  const plane = new THREE.Plane(V3(0, -1, 0), .07);
  const lm = liquidMat(); lm.thickness = .05; lm.attenuationColor.setRGB(.78, .88, .92); lm.attenuationDistance = .12; lm.clippingPlanes = [plane];
  const liq = new THREE.Mesh(new THREE.LatheGeometry(inner, 48), lm); g.add(liq);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(BOT_R + .0005, BOT_R + .0005, .05, 48, 1, true, -1.05, 2.1), new THREE.MeshStandardMaterial({ map: labelTex(id), roughness: .85 })); lab.position.y = .05; lab.castShadow = true; g.add(lab);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0145, .0145, .02, 32), new THREE.MeshPhysicalMaterial({ color: REAG[id].cap, roughness: .42, clearcoat: .3 })); cap.position.y = .143; cap.castShadow = true; g.add(cap);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .16, 12), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .08; g.add(proxy);
  const o = { kind: 'bottle', id, g, plane, cap, lid: cap, lab, liq, proxy, shape: bottleShape, Qmax: 25, maxTilt: 175, V: STOCK, sh: contactShadow(.034, x, z, .8), home: V3(x, 0, z), home0: V3(x, 0, z), tilt: 0, dir: V3(-1, 0, 0), spout: V3(x, BOT_H, z), open: false, R: BOT_R, label: () => T(REAG[id].name) + (o.V < .05 ? ' · ' + T('x.bottleEmpty') : '') + ' · ' + T(o.open ? 'x.propOpen' : 'x.propClosed') + ' — ' + T('x.pourHint') };
  // Keep the cap in world space. An opened cap stays on the worktop while
  // the bottle is carried, matching the removable lids used elsewhere.
  g.updateMatrixWorld(true); const capWorld = cap.getWorldPosition(V3()); g.remove(cap); scene.add(cap); cap.position.copy(capWorld); cap.userData.off = V3(0, .143, 0);
  o.tap = () => toggleBottle(o);
  proxy.userData.obj = o; return o;
}
/* ===================== ASSET: DROPPER BOTTLE + DROPPER ===================== */
function makeDropper(id, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.userData.help = 'dropper:' + id;
  const outer = [V2(0, 0), V2(.013, 0), V2(.017, .004), V2(.017, .05), V2(.012, .06), V2(.008, .064), V2(.008, .072)];
  const glass = new THREE.Mesh(shellLathe(outer, .0014, 48), MAT.amber); glass.renderOrder = 3; g.add(glass);
  const inner = outer.map(p => V2(Math.max(0, p.x - .002), Math.max(p.y, .003))).slice(0, 4); inner.push(V2(0, .032));
  const lm = liquidMat(); lm.thickness = .03; const rgb = REAG[id].rgb; lm.attenuationColor.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); lm.attenuationDistance = id === 'phph' ? 1 : .03;
  g.add(new THREE.Mesh(new THREE.LatheGeometry(inner, 32), lm));
  const labm = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2622'; c.font = '600 40px "IBM Plex Sans", sans-serif'; c.fillText(REAG[id].f, 20, 60); }), roughness: .85 });
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(.0175, .0175, .026, 32, 1, true, -1, 2), labm); lab.position.y = .028; g.add(lab);
  const bodyProxy = new THREE.Mesh(new THREE.CylinderGeometry(.021, .021, .064, 12), new THREE.MeshBasicMaterial({ visible: false })); bodyProxy.position.y = .032; g.add(bodyProxy);
  { const sh = contactShadow(.02, 0, 0, .7); scene.remove(sh); g.add(sh); }
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'dropper:' + id;
  const pip = new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), V2(.0009, 0), V2(.0028, .018), V2(.0032, .07), V2(0, .07)], 24), MAT.glass); pip.renderOrder = 3; d.add(pip);
  const pl = liquidMat(); pl.attenuationColor.copy(lm.attenuationColor); pl.attenuationDistance = lm.attenuationDistance; pl.thickness = .005;
  d.add(new THREE.Mesh(new THREE.LatheGeometry([V2(0, .001), V2(.0007, .001), V2(.0022, .018), V2(.0024, .04), V2(0, .04)], 16), pl));
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.0095, .0095, .01, 24), MAT.black); collar.position.y = .072; d.add(collar);
  const teat = new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), V2(.0075, 0), V2(.0085, .006), V2(.008, .018), V2(.006, .026), V2(0, .029)], 32), MAT.rubber); teat.position.y = .077; teat.castShadow = true; d.add(teat);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .05, 10), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .083; d.add(proxy);
  const home = V3(x, .006, z); d.position.copy(home);
  const o = { kind: 'dropper', bx: x, bz: z, bottleG: g, bodyProxy, id, g: d, teat, proxy, home, open: false, dragWhole: false, squeeze: 0, acc: .4, parked: null, count: 0, pulse: 0,
    label: () => o.parked ? T('x.tapBulb') : T(REAG[id].name) + ' · ' + T(o.open ? 'x.indOpen' : 'x.indClosed') };
  const lidControl = { kind: 'button', name: 'dropperLid', noTip: false, owner: o, proxy, label: () => T('x.indLid'), tap: () => toggleDropper(o) }; Object.defineProperty(lidControl, 'stowed', { get: () => o.stowed }); o.lidControl = lidControl;
  o.tap = () => { if (!o.parked) { toggleDropper(o); return; } o.pulse = 1; o.count++; spawnDrop(o.g.position.clone().add(V3(0, -.002, 0)), compOf(id), o.parked); };
  proxy.userData.obj = lidControl; proxy.userData.part = 'dropperLid'; bodyProxy.userData.obj = o; bodyProxy.userData.part = 'dropperBody'; return o;
}
/* ===================== ASSET: WASH BOTTLE ===================== (PE squeeze bottle 250 mL; pivot base; nozzle tip local) */
function makeWashBottle(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.userData.help = 'wash';
  const body = new THREE.Mesh(new THREE.LatheGeometry([V2(0, 0), V2(.028, 0), V2(.031, .006), V2(.031, .11), V2(.024, .125), V2(.012, .13), V2(0, .13)], 48), MAT.pe); body.castShadow = true; g.add(body);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(.029, .029, .07, 32), liquidMat()); water.position.y = .037; g.add(water);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .016, 24), MAT.white); cap.position.y = .137; g.add(cap);
  const nc = new THREE.CatmullRomCurve3([V3(0, .14, 0), V3(0, .185, 0), V3(.02, .2, 0), V3(.05, .19, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(nc, 24, .0025, 10), MAT.white));
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(.0315, .0315, .03, 32, 1, true, -.9, 1.8), new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2F62A8'; c.font = '700 34px "IBM Plex Sans", sans-serif'; c.fillText('H₂O dest.', 20, 76); }), roughness: .8 })); lab.position.y = .07; g.add(lab);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, .2, 10), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .1; g.add(proxy);
  const o = { kind: 'wash', g, body, proxy, sh: contactShadow(.034, x, z, .8), home: V3(x, 0, z), home0: V3(x, 0, z), squeeze: 0, nozzleLocal: V3(.05, .19, 0), label: () => T('x.washHint') };
  proxy.userData.obj = o; return o;
}
/* ===================== ASSET: NaCl JAR + SPATULA ===================== */
const JAR = { x: .4, z: -.24, R: .032, H: .07 };
{
  const g = new THREE.Group(); g.position.set(JAR.x, 0, JAR.z); scene.add(g); g.userData.help = 'jar';
  g.add(new THREE.Mesh(shellLathe([V2(0, 0), V2(JAR.R - .004, 0), V2(JAR.R, .004), V2(JAR.R, JAR.H), V2(JAR.R + .001, JAR.H + .001)], .002, 48), MAT.pe));
  const salt = new THREE.Mesh(new THREE.CylinderGeometry(JAR.R - .003, JAR.R - .003, .04, 32), MAT.salt); salt.position.y = .022; g.add(salt);
  const heap = new THREE.Mesh(new THREE.SphereGeometry(JAR.R - .003, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.salt); heap.scale.y = .25; heap.position.y = .042; g.add(heap);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(JAR.R + .0006, JAR.R + .0006, .035, 32, 1, true, -1, 2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b2622'; c.font = '600 44px "IBM Plex Mono", monospace'; c.fillText('NaCl (s)', 14, 60); c.font = '400 20px "IBM Plex Sans", sans-serif'; c.fillText('M = 58.44 g/mol', 14, 100); }), roughness: .85 }));
  lab.position.y = .035; g.add(lab); { const sh = contactShadow(.036, 0, 0, .8); scene.remove(sh); g.add(sh); } JAR.g = g;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(JAR.R + .003, JAR.R + .003, .012, 32), MAT.white); lid.position.set(.07, .006, .03); lid.castShadow = true; lid.userData.help = 'jar'; g.add(lid); JAR.lid = lid; { const pr = new THREE.Mesh(new THREE.CylinderGeometry(JAR.R + .008, JAR.R + .008, JAR.H + .02, 10), new THREE.MeshBasicMaterial({ visible: false })); pr.position.y = JAR.H / 2; g.add(pr); JAR.proxy = pr; pr.userData.obj = JAR; JAR.kind = 'jar'; JAR.label = () => T('x.h.jar.t'); }
}
const spatula = (() => {
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'spatula';
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.0018, .0018, .16, 12), MAT.steel); handle.rotation.z = Math.PI / 2; handle.position.x = .085; d.add(handle);
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(.007, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.steel); scoop.scale.set(1.5, .5, 1); d.add(scoop);
  const load = new THREE.Mesh(new THREE.SphereGeometry(.007, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.salt); load.visible = false; d.add(load);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, .03), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.x = .08; d.add(proxy);
  const o = { kind: 'spatula', g: d, load, proxy, home: V3(.33, .004, -.14), home0: V3(.33, .004, -.14), grams: 0, label: () => o.grams > .005 ? T('x.spatulaLoaded', { g: fmt(o.grams, 2) }) : T('x.spatulaHint') };
  d.position.copy(o.home); d.rotation.y = .5; proxy.userData.obj = o; return o;
})();
/* ===================== ASSET: TOP-LOADING BALANCE ===================== (0.01 g, 620 g; pivot base) */
const BAL = { x: -.33, z: .1, panY: .074, on: false, tare: 0, shown: 0, boot: 0, stable: false };
const balCanvas = document.createElement('canvas'); balCanvas.width = 512; balCanvas.height = 128; const balTex = new THREE.CanvasTexture(balCanvas); balTex.colorSpace = THREE.SRGBColorSpace;
const balButtons = [];
{
  const g = new THREE.Group(); g.position.set(BAL.x, 0, BAL.z); scene.add(g); g.userData.help = 'balance';
  const body = new THREE.Mesh(new RoundedBoxGeometry(.2, .06, .25, 4, .008), MAT.white); body.position.y = .03; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const front = new THREE.Mesh(new RoundedBoxGeometry(.2, .03, .06, 3, .006), MAT.grey); front.position.set(0, .02, .125); g.add(front);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(.11, .0275), new THREE.MeshBasicMaterial({ map: balTex })); disp.position.set(-.02, .036, .156); disp.rotation.x = -.5; g.add(disp);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.01, .012, .012, 16), MAT.steel); post.position.set(0, .066, -.02); g.add(post);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .004, 64), MAT.steel); pan.position.set(0, .072, -.02); pan.castShadow = true; pan.receiveShadow = true; g.add(pan);
  for (const [i, name] of ['on', 'tare'].entries()) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .006, 24), new THREE.MeshPhysicalMaterial({ color: name === 'on' ? 0x2b2f31 : 0x2F62A8, roughness: .4 })); b.rotation.x = Math.PI / 2 - .5; b.position.set(.055 + i * .025, .033, .158); g.add(b);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(.022, .007), new THREE.MeshBasicMaterial({ map: canvasTex(128, 48, (c) => { c.fillStyle = '#3a3f42'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#fff'; c.font = '700 26px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.fillText(name === 'on' ? 'ON/OFF' : 'TARE', 64, 34); }) })); lt.position.set(.055 + i * .025, .041, .145); lt.rotation.x = -.5; g.add(lt);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(.022, .02, .02), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.copy(b.position); g.add(proxy);
    const o = { kind: 'button', name, proxy, label: () => T(name === 'on' ? 'x.balOn' : 'x.balTare') }; o.tap = () => balanceButton(name); proxy.userData.obj = o; balButtons.push(proxy);
  }
  contactShadow(.14, BAL.x, BAL.z, .6);
  BAL.pan = V3(BAL.x, BAL.panY, BAL.z - .02);
}
function balanceButton(name) {
  if (name === 'on') { BAL.on = !BAL.on; BAL.boot = BAL.on ? 1.6 : 0; BAL.tare = 0; logE('info', [[BAL.on ? 'x.balIsOn' : 'x.balIsOff']]); }
  else if (BAL.on && BAL.boot <= 0) { BAL.tare = panLoad(); BAL.boot = .6; logE('info', [['x.tared']]); }
}
const JAR_MASS = { oil: 61.4, bottle: 0, gas: 42.1, powder: 58.3, granules: 66.8, wire: 63.5, ribbon: 47.9, crystals: 59.2, lump: 64.7 };
const jarMass = S => S.e[0] === 'Hg' ? 172.6 : S.e[0] === 'Br' ? 71.3 : JAR_MASS[formOf(S.e)] + (S.D.Z % 7) * .37;
/* Every object that the student can carry can also be weighed. */
function balanceItems() {
  return [...vessels, ...bottles, ...droppers, wash, spatula, electrode, rod, rodHolder, ...probes, ...pipettes,
    ...(typeof PT !== 'undefined' ? PT.samples : []), ...(typeof PROPS !== 'undefined' ? PROPS : [])];
}
const onBalance = o => !!(o && (o.onBalance || o.onBal));
function setOnBalance(o, yes) { if (!o) return; o.onBalance = !!yes; if (o.kind === 'sample') o.onBal = !!yes; }
function carriedMass(o) {
  if (o.kind === 'vessel') return vesselMass(o);
  if (o.kind === 'sample') return jarMass(o);
  if (o.kind === 'bottle') return reagentBottleMass(o.id, o.V, o.open);
  if (o.kind === 'dropper') return 46.5;
  if (o.kind === 'wash') return 238;
  if (o.kind === 'spatula') return 18.4 + Math.max(0, o.grams || 0);
  if (o.kind === 'electrode') return 48.6;
  if (o.kind === 'rod') return 13.8;
  if (o.kind === 'holder') return 31.2;
  if (o.kind === 'thermo') return 26.4;
  if (o.kind === 'pipette') return (o.big ? 32.5 : 5.8) + Math.max(0, o.chem.V) * .998;
  if (o.kind === 'prop') { const contents = o.chem ? Math.max(0, o.left == null ? o.chem.left || 0 : o.left) : 0; return 12 + Math.max(8, o.R * 360 + (o.H || .06) * 70) + contents; }
  return 0;
}
function panLoad() { return balanceItems().filter(o => onBalance(o) && !o.held).reduce((s, o) => s + carriedMass(o), 0); }
function drawBalance(txt, stable) { const g = balCanvas.getContext('2d'); g.fillStyle = '#16211b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#7CF2A6'; g.font = '500 78px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText(txt, 440, 92); g.font = '500 36px "IBM Plex Mono", monospace'; g.fillText(BAL.on && BAL.boot <= 0 ? 'g' : '', 490, 92); g.textAlign = 'left'; if (stable) { g.beginPath(); g.arc(28, 30, 9, 0, 7); g.fill(); } balTex.needsUpdate = true; }
let balLogged = null;
function updateBalance(dt) {
  if (!BAL.on) { drawBalance('', false); return; }
  if (BAL.boot > 0) { BAL.boot -= dt; drawBalance(BAL.boot > .7 ? '8888.88' : '------', false); BAL.shown = panLoad() - BAL.tare; return; }
  const target = panLoad() - BAL.tare; BAL.shown += (target - BAL.shown) * (1 - Math.exp(-dt * 2.5));
  if (panLoad() > 620) { BAL.stable = false; drawBalance('OL', false); return; }
  BAL.stable = Math.abs(target - BAL.shown) < .006;
  const val = BAL.shown + (BAL.stable ? 0 : (Math.random() - .5) * .02);
  drawBalance(fmt(Math.abs(val) < .005 ? 0 : val, 2), BAL.stable);
  const onPan = balanceItems().filter(o => onBalance(o) && !o.held), names = onPan.map(o => o.letter || o.kind);
  const key = fmt(target, 2) + '|' + names.join();
  if (BAL.stable && key !== balLogged && onPan.length) { balLogged = key; logE('obs', [['x.balRead', { m: fmt(target, 2) }]], { v: names.join('+'), amt: '', f: '' }); analyticsActivity('measure:mass', 1, target, 'measure:mass'); }
}
/* ===================== ASSET: pH METER + ELECTRODE ===================== */
const meterBody = new THREE.Mesh(new RoundedBoxGeometry(.12, .04, .09, 4, .007), MAT.grey); meterBody.position.set(-.45, .02, -.1); meterBody.rotation.y = .35; meterBody.castShadow = true; meterBody.userData.help = 'meter'; scene.add(meterBody);
const lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 256; lcdCanvas.height = 128; const lcdTex = new THREE.CanvasTexture(lcdCanvas); lcdTex.colorSpace = THREE.SRGBColorSpace;
const METER = { on: false, boot: 0 };
{ const key = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .004, 24), new THREE.MeshPhysicalMaterial({ color: 0xC0392B, roughness: .4, clearcoat: .3 })); key.position.set(.044, .021, .033); meterBody.add(key);
  const kl = new THREE.Mesh(new THREE.PlaneGeometry(.024, .008), new THREE.MeshBasicMaterial({ map: canvasTex(128, 40, c => { c.fillStyle = '#3a3f42'; c.fillRect(0, 0, 128, 40); c.fillStyle = '#fff'; c.font = '700 26px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.fillText('ON/OFF', 64, 30); }) })); kl.rotation.x = -Math.PI / 2; kl.position.set(.016, .0207, .036); meterBody.add(kl);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(.022, .016, .022), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.copy(key.position); meterBody.add(proxy);
  const o = { kind: 'button', name: 'meter', proxy, label: () => T('x.meterKey') }; o.tap = () => { METER.on = !METER.on; METER.boot = METER.on ? 1.2 : 0; logE('info', [[METER.on ? 'x.meterIsOn' : 'x.meterIsOff']]); }; proxy.userData.obj = o; balButtons.push(proxy); }
{ const lcd = new THREE.Mesh(new THREE.PlaneGeometry(.096, .048), new THREE.MeshBasicMaterial({ map: lcdTex })); lcd.rotation.x = -Math.PI / 2; lcd.position.set(0, .0207, -.008); meterBody.add(lcd); contactShadow(.07, -.45, -.1, .8); }
function drawLCD(txt, t2) { const g = lcdCanvas.getContext('2d'); if (txt === null) { g.fillStyle = '#56624f'; g.fillRect(0, 0, 256, 128); lcdTex.needsUpdate = true; return; } g.fillStyle = '#a9c4a0'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1d2a1c'; g.font = '600 64px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText(txt, 236, 78); g.font = '500 22px "IBM Plex Mono", monospace'; g.fillText(t2, 236, 118); g.textAlign = 'left'; g.font = '600 22px "IBM Plex Sans", sans-serif'; g.fillText('pH', 14, 34); lcdTex.needsUpdate = true; }
const electrode = (() => {
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'electrode';
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.0055, 24, 16), MAT.glass); bulb.position.y = .0055; bulb.renderOrder = 3; d.add(bulb);
  const gp = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .045, 24, 1, true), MAT.glass); gp.position.y = .03; gp.renderOrder = 3; d.add(gp);
  const kcl = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, .04, 16), new THREE.MeshPhysicalMaterial({ color: 0xe8f0f2, transmission: .8, roughness: .1, thickness: .01 })); kcl.position.y = .028; d.add(kcl);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0065, .0065, .11, 24), MAT.black); body.position.y = .108; body.castShadow = true; d.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0065, .014, 24), MAT.black); cap.position.y = .17; d.add(cap);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .18, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .09; d.add(proxy);
  const o = { kind: 'electrode', g: d, proxy, home: V3(-.3, .012, -.1), home0: V3(-.3, .012, -.1), stand0: V3(-.3, 0, -.1), lying: false, in: null, label: () => T('x.electrode') };
  d.position.copy(o.home); proxy.userData.obj = o; return o;
})();
{ const R = .02, H = .055; const m = new THREE.Mesh(shellLathe([V2(0, 0), V2(R - .003, 0), V2(R, .003), V2(R, H), V2(R + .0008, H + .0008)], .0012, 48), MAT.glass); m.position.set(-.3, 0, -.1); m.renderOrder = 3; m.userData.help = 'storage'; scene.add(m);
  const l = new THREE.Mesh(new THREE.CylinderGeometry(R - .0016, R - .0016, .03, 32), liquidMat()); l.position.set(-.3, .017, -.1); l.userData.help = 'storage'; scene.add(l); contactShadow(.024, -.3, -.1, .8); }
let cableMesh = null, cableKey = '';
function updateCable() {
  const key = electrode.g.position.toArray().map(v => v.toFixed(4)).join() + electrode.g.rotation.x.toFixed(3) + electrode.g.rotation.z.toFixed(3); if (key === cableKey) return; cableKey = key;
  electrode.g.updateMatrixWorld(); meterBody.updateMatrixWorld();
  const top = V3(0, .178, 0).applyMatrix4(electrode.g.matrixWorld), start = V3(-.03, .03, -.045).applyMatrix4(meterBody.matrixWorld);
  const mid = start.clone().lerp(top, .5); mid.y = Math.max(start.y, top.y) + .09;
  const curve = new THREE.CatmullRomCurve3([start, start.clone().add(V3(0, .05, -.02)), mid, top.clone().add(V3(0, .05, 0)), top]);
  if (cableMesh) { scene.remove(cableMesh); cableMesh.geometry.dispose(); }
  cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .0022, 8), MAT.black); cableMesh.castShadow = true; scene.add(cableMesh);
}
/* ===================== ASSET: GLASS ROD ===================== */
const rod = (() => {
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'rod';
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(.0025, .195, 6, 16), new THREE.MeshPhysicalMaterial({ color: 0xf2fafa, roughness: .02, transparent: true, opacity: .35, clearcoat: 1, envMapIntensity: 2, depthWrite: false })); m.position.y = .1; m.renderOrder = 3; d.add(m);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .2, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .1; d.add(proxy);
  const o = { kind: 'rod', g: d, proxy, home: V3(.07, .004, .21), home0: V3(.07, .004, .21), stand0: V3(.07, 0, .21), lying: false, in: null, last: V3(), label: () => T('x.rod') };
  d.position.copy(o.home); d.rotation.z = -.18; proxy.userData.obj = o; return o;
})();
/* rod holder: a small glass cup; it can be moved, and the rod standing in it moves along */
const rodHolder = (() => { const R = .018, H = .05, g = new THREE.Group(); g.position.set(.07, 0, .21); g.userData.help = 'rodholder'; scene.add(g);
  const m = new THREE.Mesh(shellLathe([V2(0, 0), V2(R - .003, 0), V2(R, .003), V2(R, H), V2(R + .0008, H + .0008)], .0012, 48), MAT.glass); m.renderOrder = 3; m.userData.help = 'rodholder'; g.add(m);
  const sh = contactShadow(.022, 0, 0, .8); scene.remove(sh); sh.position.set(0, .0006, 0); g.add(sh);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .055, 10), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .027; g.add(proxy);
  const o = { kind: 'holder', g, proxy, home: V3(.07, 0, .21), held: false, label: () => T('x.h.rodholder.t') }; proxy.userData.obj = o; return o; })();
function updateHolder(dt) {
  const o = rodHolder; if (o.held && ptrOK) o.g.position.lerp(V3(ptr.x, .03, ptr.z), 1 - Math.exp(-dt * 14)); else o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9));
  const p = o.g.position; rod.stand0.set(p.x, 0, p.z); rod.home0.set(p.x, p.y + .004, p.z);
  if (!rod.lying && !rod.in && !rod.held && !rod.stowed) rod.home.copy(rod.home0);
}

/* ===================== ASSET: DIGITAL THERMOMETERS (×3) =====================
   Pocket probe thermometer: 12 cm steel probe, body with LCD (0.1 °C). Dip the probe into a beaker to read it;
   it lies on the bench otherwise and shows room temperature. The reading follows with a short lag, like a real probe. */
const ROOM_T = 22;
const thermos = [1, 2, 3].map(n => {
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'thermo';
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(.0016, .0016, .12, 12), new THREE.MeshStandardMaterial({ color: 0xC9CED1, metalness: .85, roughness: .25 })); probe.position.y = .06; d.add(probe);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.0016, .004, 12), probe.material); tip.rotation.x = Math.PI; tip.position.y = -.002; d.add(tip);
  const body = new THREE.Mesh(new RoundedBoxGeometry(.026, .062, .013, 3, .004), new THREE.MeshStandardMaterial({ color: [0xF2F3F1, 0xE9F1F7, 0xF7EFE6][n - 1], roughness: .5 })); body.position.y = .151; body.castShadow = true; d.add(body);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.004, .006, .012, 12), MAT.black); collar.position.y = .124; d.add(collar);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(.021, .0158), new THREE.MeshBasicMaterial({ map: tex })); lcd.position.set(0, .162, .0067); d.add(lcd);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(.0028, .0028, .002, 12), new THREE.MeshStandardMaterial({ color: [0x2F62A8, 0xB5403A, 0x2E8B57][n - 1] })); btn.rotation.x = Math.PI / 2; btn.position.set(0, .139, .0067); d.add(btn);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .19, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .09; d.add(proxy);
  const o = { kind: 'thermo', n, g: d, proxy, cv, tex, reading: ROOM_T, shown: null, home: V3(.2 + n * .05, .0068, .25), home0: V3(.2 + n * .05, .0068, .25), stand0: null, lying: true, in: null, last: V3(),
    label: () => T('x.thermo', { n }) + ' — ' + fmt(o.reading, 1) + ' °C' };
  d.position.copy(o.home); proxy.userData.obj = o; return o;
});
function thermoTarget(o) {
  const v = o.in || (o.held && o.zoneV);
  if (v && v.chem.V > .3 && !v.held) { const l = worldToLocal(v, o.g.position); if (l.y < v.level) return v.temp; }
  return ROOM_T;
}
/* ===================== ASSET: CONDUCTIVITY TESTER =====================
   Two graphite electrodes and a low-voltage lamp. It handles like a probe
   thermometer, while brightness follows the mobile-ion concentration. */
const tester = (() => {
  const d = new THREE.Group(); scene.add(d); d.userData.help = 'cond';
  const gr = new THREE.MeshStandardMaterial({ color: 0x2B2D2F, roughness: .7 });
  for (const x of [-.009, .009]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.0028, .0028, .1, 12), gr); r.position.set(x, .05, 0); d.add(r); }
  const head = new THREE.Mesh(new RoundedBoxGeometry(.05, .034, .03, 3, .005), new THREE.MeshStandardMaterial({ color: 0x3A6EA5, roughness: .45 })); head.position.y = .117; head.castShadow = true; d.add(head);
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(.007, .008, .01, 16), MAT.black); sock.position.y = .139; d.add(sock);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.011, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xF4F1E6, roughness: .05, transparent: true, opacity: .45, emissive: 0xFFC860, emissiveIntensity: 0 })); bulb.position.y = .153; bulb.renderOrder = 3; d.add(bulb);
  const fil = new THREE.Mesh(new THREE.TorusGeometry(.003, .0006, 6, 16), new THREE.MeshBasicMaterial({ color: 0x5A4A3A })); fil.position.y = .153; d.add(fil);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.024, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFD27A, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.y = .153; d.add(glow);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .18, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .085; d.add(proxy);
  const o = { kind: 'thermo', cond: true, n: 0, g: d, proxy, bulb, fil, glow, b: 0, home: V3(.32, .017, .24), home0: V3(.32, .017, .24), stand0: null, lying: true, in: null, last: V3(), label: () => T('x.cond') };
  d.position.copy(o.home); proxy.userData.obj = o; return o;
})();
const probes = [...thermos, tester];

/* ===================== ASSET: HEAT-CONDUCTION STAR (K1.12) =====================
   Four equal rods carry wax markers at equal distances from a heated brass hub.
   A compact 1-D model uses the correct Cu > Al > Fe >> glass diffusivity order. */
const RIG = (() => {
  const HX = -.06, HY = .13, HZ = .06, g = new THREE.Group(); scene.add(g); g.visible = false;
  const steel = new THREE.MeshStandardMaterial({ color: 0x8C9499, metalness: .7, roughness: .35 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(.12, .012, .09, 2, .004), MAT.black); base.position.set(HX, .006, HZ - .13); g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, HY + .02, 12), steel); post.position.set(HX, (HY + .02) / 2, HZ - .13); g.add(post);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .13, 10), steel); arm.rotation.x = Math.PI / 2; arm.position.set(HX, HY + .012, HZ - .065); g.add(arm);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .014, 20), new THREE.MeshStandardMaterial({ color: 0xC9A447, metalness: .75, roughness: .3 })); hub.position.set(HX, HY, HZ); g.add(hub);
  const wax = new THREE.MeshStandardMaterial({ color: 0xF3E6B5, roughness: .6 });
  const DEF = [['cu', 0, 1.11e-4, new THREE.MeshStandardMaterial({ color: 0xB8733A, metalness: .8, roughness: .3 })],
    ['al', .7, 6.9e-5, new THREE.MeshStandardMaterial({ color: 0xC9CED3, metalness: .75, roughness: .3 })],
    ['fe', Math.PI - .7, 2.3e-5, new THREE.MeshStandardMaterial({ color: 0x5C6064, metalness: .7, roughness: .45 })],
    ['glass', Math.PI, 3.4e-7, new THREE.MeshPhysicalMaterial({ color: 0xD6ECEE, roughness: .05, transparent: true, opacity: .5, clearcoat: 1 })]];
  const N = 12, Lr = .2, rods = DEF.map(([k, a, alpha, mat]) => {
    const inner = new THREE.Group(); inner.position.set(HX, HY, HZ); inner.rotation.y = a; g.add(inner);
    const half = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, Lr / 2, 12), mat); m.rotation.z = Math.PI / 2; m.position.x = Lr / 4; m.castShadow = true; return m; };
    inner.add(half()); const outer = new THREE.Group(); outer.position.x = Lr / 2; inner.add(outer); outer.add(half());
    const pk = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, Lr, 6), new THREE.MeshBasicMaterial({ visible: false })); pk.rotation.z = Math.PI / 2; pk.position.x = Lr / 2 + .01; inner.add(pk);
    const r = { k, a, alpha: alpha * 3, inner, outer, pk, T: new Array(N + 1).fill(ROOM_T), beads: [], bent: false, first: false }; pk.userData.rod = r;
    for (const [d, node] of [[.05, 3], [.1, 6], [.15, 9]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.0055, 12, 8), wax); m.scale.y = 1.25;
      const par = d > Lr / 2 ? outer : inner; m.position.set(d - (par === outer ? Lr / 2 : 0), -.0075, 0); par.add(m); r.beads.push({ m, par, p0: m.position.clone(), node, d, fallen: false, vy: 0 }); }
    return r;
  });
  const o = { g, rods, hub: V3(HX, HY, HZ), base: V3(HX, 0, HZ - .13), hubT: ROOM_T, heatT: 0, heating: false, pick: rods.map(r => r.pk),
    reset() { o.hubT = ROOM_T; o.heatT = 0; o.heating = false; for (const r of rods) { r.T.fill(ROOM_T); r.bent = false; r.first = false; r.outer.rotation.z = 0;
      for (const b of r.beads) { b.fallen = false; b.vy = 0; b.par.add(b.m); b.m.position.copy(b.p0); b.m.scale.set(1, 1.25, 1); } } } };
  return o;
})();
function updateRig(dt) {
  if (!RIG.g.visible) return;
  const lamp = PROPS.find(p => p.lamp && p.lamp.lit && !p.held && Math.hypot(p.g.position.x - RIG.hub.x, p.g.position.z - RIG.hub.z) < .035);
  if (!!lamp !== RIG.heating) { RIG.heating = !!lamp; logE('info', [[lamp ? 'x.rigHeat' : 'x.rigCool']]); }
  if (lamp) RIG.heatT += dt;
  const n = Math.min(40, Math.ceil(dt / .05)), h = dt / n, N = 12, dx2 = (.2 / N) ** 2;
  for (let s = 0; s < n; s++) { RIG.hubT += (((lamp ? 320 : ROOM_T) - RIG.hubT) * h / 15);
    for (const r of RIG.rods) { const T0 = r.T, c = r.alpha * h / dx2, nT = T0.slice(); nT[0] = RIG.hubT;
      for (let i = 1; i < N; i++) nT[i] = T0[i] + c * (T0[i - 1] - 2 * T0[i] + T0[i + 1]) - .006 * (T0[i] - ROOM_T) * h;
      nT[N] = T0[N] + 2 * c * (T0[N - 1] - T0[N]) - .006 * (T0[N] - ROOM_T) * h; r.T = nT; } }
  for (const r of RIG.rods) for (const b of r.beads) {
    if (!b.fallen && r.T[b.node] > 55) { b.fallen = true; RIG.g.attach(b.m);
      if (!r.first) { r.first = true; logE('obs', [['x.waxObs', { r: { k: 'x.rod_' + r.k }, d: Math.round(b.d * 100), t: Math.round(RIG.heatT) }]]); if (TASK && TASK.evidence) TASK.evidence[r.k] = true; } }
    if (b.fallen && b.m.position.y > .003) { b.vy += 9.8 * dt; b.m.position.y = Math.max(.003, b.m.position.y - b.vy * dt); if (b.m.position.y <= .003) b.m.scale.set(1.5, .35, 1.5); }
  }
  if (RIG.heatT > 75 && TASK && TASK.evidence && !TASK.evidence.glass) { TASK.evidence.glass = true; logE('obs', [['x.waxGlass']]); }
}
function rodHitXZ(p) {
  for (const r of RIG.rods) { const dx = Math.cos(r.a), dz = -Math.sin(r.a), vx = p.x - RIG.hub.x, vz = p.z - RIG.hub.z, t = vx * dx + vz * dz;
    if (t > .03 && t < .2 && Math.abs(vx * dz - vz * dx) < .015) return r; }
  return null;
}
function rigTap(e) {
  if (!RIG.g.visible) return false; setNdc(e); const h = ray.intersectObjects(RIG.pick, false)[0]; if (!h) return false;
  const r = h.object.userData.rod, rc = stage.getBoundingClientRect(), nm = T('x.rod_' + r.k);
  showNoteRaw(nm, [T('x.rigNote')], e.clientX - rc.left, e.clientY - rc.top, r.bent ? [] : [[T('x.bend'), () => {
    if (RIG.heating || Math.max(...r.T) > 35) { logE('mistake', [['x.rigTooHot']]); return; }
    if (r.k === 'glass') { logE('obs', [['x.bendGlass']]); if (TASK && TASK.evidence) TASK.evidence.bendGlass = true; return; }
    r.bent = true; r.outer.rotation.z = -.5; if (TASK && TASK.evidence) TASK.evidence['bend_' + r.k] = true; logE('obs', [['x.bendMetal', { r: nm }]]); }]]);
  return true;
}
/* Relative conductivity: dissolved ions carry charge; H⁺ and OH⁻ have high mobility. */
const conductivity = chem => ionicConductivity(chem, Z2);
const condCat = conductivityCategory;
function updateCond(o, dt) {
  updateStick(o, dt); const rh = RIG.g.visible && o.held ? rodHitXZ(o.g.position) : null;
  if (rh) { const tgt = rh.k === 'glass' ? 0 : 1; o.b += (tgt - o.b) * (1 - Math.exp(-dt * 6));
    o.bulb.material.emissiveIntensity = o.b * 2.2; o.glow.material.opacity = o.b * .55; o.glow.scale.setScalar(.6 + o.b * .8); o.fil.material.color.setHex(o.b > .03 ? 0xFFE6A0 : 0x5A4A3A);
    const key = 'rod:' + rh.k; if (key === o.pend) { o.pendT += dt; if (o.pendT > .5 && o.logged !== key) { o.logged = key; logE('obs', [['x.condRod', { r: { k: 'x.rod_' + rh.k }, b: { k: 'x.condB_' + (tgt ? 'bright' : 'off') } }]]); } } else { o.pend = key; o.pendT = 0; }
    return;
  }
  const v = o.in || (o.held && o.zoneV); let target = 0, tag = null;
  if (v && !v.held) { const l = worldToLocal(v, o.g.position);
    if (v.chem.V > .3 && l.y - .004 < v.level) { target = conductivityBrightness(v.chem, Z2); const t = v.chem.tot, sum = Object.values(t).reduce((a, x) => a + Math.abs(x), 0);
      tag = (t.Suc || 0) > .01 ? 'sugar' : (t.Na || 0) > .05 && (t.Cl || 0) > .05 ? 'nacl' : sum < 1e-3 && v.chem.V > 3 ? 'water' : 'other'; }
    else if (v.chem.V <= .3 && v.solid > .02 && l.y < v.b + .03) { target = 0; tag = 'dry'; }
  }
  o.b += (target - o.b) * (1 - Math.exp(-dt * 6)); o.bulb.material.emissiveIntensity = o.b * 2.2; o.glow.material.opacity = o.b * .55; o.glow.scale.setScalar(.6 + o.b * .8); o.fil.material.color.setHex(o.b > .03 ? 0xFFE6A0 : 0x5A4A3A);
  const key = v ? v.letter + ':' + condCat(target) + ':' + tag : null;
  if (key && key === o.pend) { o.pendT += dt; if (o.pendT > .5 && o.logged !== key) { o.logged = key; const result = condCat(target); logE('obs', [['x.condObs', { b: { k: 'x.condB_' + result } }]], { v: v.letter, amt: '', f: '' }); if (TASK && TASK.evidence && tag && tag !== 'other') TASK.evidence[tag] = result; if (TASK && TASK.id === 'k3v01' && TASK.evidence) { if (v.letter === 'A') TASK.evidence.hclCond = result; if (v.letter === 'B') TASK.evidence.acCond = result; } } }
  else { o.pend = key; o.pendT = 0; }
}
/* Evaporative cooling is parameterised by measured classroom-scale behaviour:
   volatility and intermolecular forces both matter. */
const EVAP = Object.fromEntries(Object.entries(EVAPORATION_MODEL).map(([key, value]) => [key, [value.drop, value.duration]]));
function solvOf(c) { let best = 'water', bf = .5; for (const k in (c.solv || {})) { const f = c.solv[k] / Math.max(c.V, 1e-6); if (f > bf) { bf = f; best = k; } } return best; }
function updateThermo(o, dt) {
  if (o.cond) return updateCond(o, dt);
  updateStick(o, dt);
  let tgt = thermoTarget(o), lag = 2.5;
  const v = o.in || (o.held && o.zoneV), wetNow = v && v.chem.V > .3 && !v.held && worldToLocal(v, o.g.position).y < v.level ? solvOf(v.chem) : null;
  if (wetNow) { o.wetS = wetNow; o.wetV = v.letter; o.wet = null; }
  else if (o.wetS) { o.wet = { s: o.wetS, v: o.wetV, t: 0, min: o.reading }; o.wetS = null; }
  if (!wetNow && o.wet) { const W = o.wet; W.t += dt; W.min = Math.min(W.min, o.reading); const cooling = evaporativeCoolingAt(W.s, W.t, ROOM_T);
    if (cooling.active) { tgt = cooling.target; lag = 1.6; }
    else { logE('obs', [['x.evapObs', { s: { k: 'x.solv_' + W.s }, d: fmt(ROOM_T - W.min, 1) }]], { v: W.v, amt: '', f: 'T' + o.n }); if (TASK && TASK.evidence) TASK.evidence[W.s] = fmt(ROOM_T - W.min, 1); o.wet = null; }
  }
  o.reading += (tgt - o.reading) * (1 - Math.exp(-dt / lag));
  const txt = fmt(o.reading, 1);
  if (txt !== o.shown) { o.shown = txt; const c = o.cv.getContext('2d'); c.fillStyle = '#a9c4a0'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#1d2a1c'; c.textAlign = 'right'; c.font = '600 46px "IBM Plex Mono", monospace'; c.fillText(txt, 120, 62); c.font = '600 20px "IBM Plex Sans", sans-serif'; c.fillText('°C', 120, 88); c.textAlign = 'left'; c.fillText('T' + o.n, 8, 24); o.tex.needsUpdate = true; }
}

/* ===================== ASSET: PIPETTES =====================
   P3: plastic graduated transfer pipette 3 mL (Ø6 × 155 mm, bulb on top), reads to 0.1 mL.
   P10: glass graduated measuring pipette 10 mL with a pipette pump (Ø7 × 330 mm), reads to 0.05 mL.
   Pivot: tip. Code drives: liquid column (scaled), pump wheel. */
const pipMarks = (n, every, h, unit) => canvasTex(256, 4096, (c, w, H) => { c.clearRect(0, 0, w, H); c.fillStyle = '#1d2622'; c.font = '700 54px "IBM Plex Sans", sans-serif'; c.textBaseline = 'middle';
  for (let i = 0; i <= n; i++) { const y = H - 24 - i / n * (H - 48); const major = i % every === 0, half = !major && every % 2 === 0 && i % (every / 2) === 0;
    c.fillRect(0, y - (major ? 5 : 3), major ? 100 : half ? 72 : 46, major ? 10 : 6); if (major) c.fillText(String(Math.round(i * unit * 10) / 10), 108, y); } });
function makePipette(kind, x, z) {
  const big = kind === 'p10', d = new THREE.Group(); scene.add(d);
  const prof = big ? [V2(0, 0), V2(.0007, 0), V2(.0035, .03), V2(.0035, .27), V2(.0028, .282), V2(0, .282)]
                   : [V2(0, 0), V2(.0008, 0), V2(.0028, .014), V2(.0028, .108), V2(.0045, .114), V2(.0072, .128), V2(.0068, .148), V2(.003, .155), V2(0, .155)];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), big ? MAT.glass : new THREE.MeshPhysicalMaterial({ color: 0xf2f4f2, roughness: .35, transparent: true, opacity: .45, clearcoat: .3, depthWrite: false, side: THREE.DoubleSide }));
  body.renderOrder = 3; d.add(body);
  const y0 = big ? .03 : .014, y1 = big ? .25 : .108, cap = big ? 10 : 3;
  const scale = new THREE.Mesh(new THREE.CylinderGeometry((big ? .0035 : .0028) + .0002, (big ? .0035 : .0028) + .0002, y1 - y0, 24, 1, true, -.8, 1.6), new THREE.MeshBasicMaterial({ map: pipMarks(big ? 100 : 30, big ? 10 : 5, 0, .1), transparent: true, depthWrite: false }));
  scale.position.y = (y0 + y1) / 2; scale.renderOrder = 4; d.add(scale);
  const lm = liquidMat(); lm.thickness = .004; lm.attenuationDistance = .012; lm.attenuationColor.setRGB(.55, .72, .82);
  const men = new THREE.Mesh(new THREE.CylinderGeometry((big ? .0032 : .0025), (big ? .0032 : .0025), .0009, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x2f4a55, transparent: true, opacity: .75, side: THREE.DoubleSide })); men.visible = false; d.add(men);
  const col = new THREE.Mesh(new THREE.CylinderGeometry((big ? .0031 : .0024), (big ? .0031 : .0024), 1, 16), lm); col.visible = false; d.add(col);
  const actuatorMat = new THREE.MeshPhysicalMaterial({ color: 0x2E8B57, roughness: .5, clearcoat: .2 });
  let actuator;
  if (big) {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(.009, .007, .05, 24), actuatorMat); pump.position.y = .3; pump.castShadow = true; d.add(pump); actuator = pump;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .006, 24), new THREE.MeshPhysicalMaterial({ color: 0x1f5e3b, roughness: .5 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(.01, .31, 0); d.add(wheel); d.userData.wheel = wheel;
  } else { actuator = new THREE.Mesh(new THREE.SphereGeometry(.0074, 24, 16), actuatorMat); actuator.scale.set(.95, 1.55, .95); actuator.position.y = .137; actuator.castShadow = true; d.add(actuator); }
  const L = big ? .33 : .155;
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, L, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = L / 2; d.add(proxy);
  const controlProxy = new THREE.Mesh(new THREE.CylinderGeometry(big ? .016 : .013, big ? .016 : .013, big ? .07 : .04, 10), new THREE.MeshBasicMaterial({ visible: false })); controlProxy.position.y = big ? .3 : .137; d.add(controlProxy);
  const o = { kind: 'pipette', big, g: d, proxy, col, men, lm, cap, y0, y1, L, rate: big ? 3 : 1.5, kMin: big ? .006 : .002, kMax: big ? .06 : .02, step: big ? .05 : .1,
    chem: { V: 0, tot: {}, ind: {} }, src: null, srcF: '', home: V3(x, big ? .0072 : .0072, z), home0: V3(x, .0072, z), lying: true, in: null, rgb: [220, 236, 242],
    label: () => T(big ? 'x.p10' : 'x.p3') + (o.chem.V > .004 ? ' · ' + fmtPip(o) : '') + ' — ' + T('x.pipHint') };
  const control = { kind: 'pipControl', pip: o, proxy: controlProxy, label: () => T('x.pipControl') };
  control.tap = () => showMsg(T('x.pipControlDock')); o.control = control; o.controlProxy = controlProxy; controlProxy.userData.obj = control;
  d.position.copy(o.home); d.rotation.set(0, 0, -Math.PI / 2); d.userData.help = big ? 'p10' : 'p3'; proxy.userData.obj = o; return o;
}
const QLIE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
const fmtPip = o => fmt(Math.round(o.chem.V / o.step) * o.step, o.big ? 2 : 1) + ' mL';
/* pipette inside a beaker or reagent bottle: drag up draws liquid in, drag down lets it out */
function pipTarget(o) {
  const t = findTarget(o); if (t) return t;
  for (const b of bottles) if (b.open && !b.held && !b.stowed && b.tilt < 1 && Math.hypot(ptr.x - b.g.position.x, ptr.z - b.g.position.z) < .045) return { kind: 'bottle', b, c: V3(b.g.position.x, BOT_H, b.g.position.z), R: .009 };
  return null;
}
function pipPose(o, tg) {
  if (tg.kind === 'vessel') { const v = tg.v; return V3(v.g.position.x + v.Ri * .28, v.g.position.y + v.b + .004, v.g.position.z + v.Ri * .16); }
  if (tg.kind === 'bottle') return V3(tg.c.x, Math.max(.012, tg.b.shape.levelAt(0, tg.b.V) - .02), tg.c.z);
  return V3(tg.c.x, .02, tg.c.z);
}
function dockPipette(o, tg) {
  if (!tg || (tg.kind !== 'vessel' && tg.kind !== 'bottle')) return false;
  if (tg.kind === 'bottle' && o.src && o.src !== tg.b.id) logE('mistake', [['x.dirtyPipette', { b: { k: REAG[tg.b.id].name } }]]);
  o.pz = o.pz && sameTg(o.pz.tg, tg) ? o.pz : { tg, x0: scr.x, y0: scr.y, V0: o.chem.V, vT: o.chem.V, ly: scr.y, lt: performance.now() };
  o.pz.x0 = scr.x; o.pz.y0 = scr.y; o.pz.ly = scr.y; o.pz.lt = performance.now(); o.tg = tg; o.docked = true; o.lying = false; o.in = null;
  o.g.position.copy(pipPose(o, tg)); o.g.quaternion.identity(); buzz(10); return true;
}
function pipTake(o, tg, dV) {
  const c = o.chem;
  if (tg.kind === 'vessel') { const v = tg.v; const can = Math.max(0, v.chem.V - FILM - .05); dV = Math.min(dV, can); if (dV <= 0) return 0; const f = dV / v.chem.V; for (const k in v.chem.tot) c.tot[k] = (c.tot[k] || 0) + v.chem.tot[k] * f; for (const k in v.chem.ind) c.ind[k] = (c.ind[k] || 0) + v.chem.ind[k] * f; removeLiquid(v, dV); o.srcId = 'v' + v.letter; o.srcF = T('x.beaker') + ' ' + v.letter; }
  else if (tg.kind === 'bottle') { const b = tg.b; dV = Math.min(dV, b.V - 1); if (dV <= 0) return 0; const r = compOf(b.id); for (const k in r.tot) c.tot[k] = (c.tot[k] || 0) + r.tot[k] * dV; b.V -= dV; o.srcId = b.id; o.srcF = REAG[b.id].f; }
  else return 0;
  c.V += dV; o.src = o.srcId; return dV;
}
function pipGive(o, tg, dV) {
  const c = o.chem; dV = Math.min(dV, c.V); if (dV <= 0) return 0;
  const comp = { id: 'pip' + (o.big ? 10 : 3) + o.srcId, tot: {}, ind: {}, isInd: false, f: o.srcF };
  for (const k in c.tot) comp.tot[k] = c.tot[k] / c.V; for (const k in c.ind) comp.ind[k] = c.ind[k] / c.V;
  const tip = o.g.position;
  if (tg.kind === 'vessel') { const got = addLiquid(tg.v, comp, dV, tip.x, tip.z); if (got <= 0) return 0; const l = worldToLocal(tg.v, tip); if (Math.random() < .3) addWave(tg.v, l.x, l.z, .0003); }
  else if (tg.kind === 'bottle') { tg.b.V += dV; if (!o.backLogged) { o.backLogged = true; logE('mistake', [['x.backToBottle']]); } }
  else if (Math.random() < .5) SPL.push({ x: tip.x, y: tip.y, z: tip.z, vx: (Math.random() - .5) * .1, vy: .05, vz: (Math.random() - .5) * .1, r: .0005 });
  const k = 1 - dV / c.V; for (const x in c.tot) c.tot[x] *= k; for (const x in c.ind) c.ind[x] *= k; c.V -= dV;
  if (c.V < 1e-4) { c.V = 0; c.tot = {}; c.ind = {}; if (tg.kind === 'sink' && o.waterOnly) o.src = null; }
  return dV;
}
function updatePipette(o, dt, t) {
  if (o.demoPose) {
    o.g.position.copy(o.demoPose.p); o.g.quaternion.setFromAxisAngle(V3(0, 0, 1), o.demoPose.tilt || 0);
    return;
  }
  if ((o.held && (ptrOK || o.pz)) || (o.docked && o.pz)) {
    o.lying = false; o.in = null;
    let tg = null;
    if (o.pz) { tg = o.pz.tg; if (!o.docked && Math.abs(scr.x - o.pz.x0) > 90) { o.block = tg; o.pz = null; tg = null; } }
    if (!o.pz) { tg = o.held ? pipTarget(o) : null; o.backLogged = false; }
    o.tg = tg; let p;
    if (tg) p = pipPose(o, tg);
    else p = V3(ptr.x, .06, ptr.z);
    o.g.position.lerp(p, 1 - Math.exp(-dt * (tg ? 8 : 9))); o.g.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(camera.position.x - o.g.position.x, camera.position.z - o.g.position.z), 0)), 1 - Math.exp(-dt * 8));
    if (tg && o.pz) {
      const vT = o.pz.vT;
      const diff = vT - o.chem.V, step = Math.min(Math.abs(diff), o.rate * dt);
      let moved = 0;
      if (diff > .002 && tg.kind !== 'sink') { moved = pipTake(o, tg, step); o.waterOnly = !Object.values(o.chem.tot).some(x => x > 1e-6) && !Object.values(o.chem.ind).some(x => x > 1e-6); }
      else if (diff < -.002) moved = pipGive(o, tg, step);
      if (Math.abs(diff) > .002 && moved <= 0) { if (!o.pz.stuck) buzz(8); o.pz.stuck = true; o.pz.vT = o.chem.V; } else if (moved > 0) o.pz.stuck = false;
      if (o.g.userData.wheel) o.g.userData.wheel.rotation.x = -o.chem.V * 1.2;
    }
  } else {
    o.pz = null; o.tg = null;
    if (o.in && !o.in.held) { const v = o.in; o.g.position.lerp(V3(v.g.position.x + v.Ri * .45, v.g.position.y + v.b + .004, v.g.position.z + v.Ri * .2), 1 - Math.exp(-dt * 6)); o.g.rotation.set(.12, 0, -.12); }
    else { if (o.in) { o.in = null; o.home.copy(findSpot(o, o.g.position.x + o.L / 2, o.g.position.z, .03)).add(V3(-o.L / 2, .0072, 0)); o.lying = true; }
      o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9)); if (o.lying) o.g.quaternion.slerp(QLIE, 1 - Math.exp(-dt * 10)); }
  }
  const c = o.chem; o.col.visible = o.men.visible = c.V > .004;
  if (o.col.visible) {
    const h = (o.y1 - o.y0) * c.V / o.cap; o.col.scale.y = h; o.col.position.y = o.y0 + h / 2; o.men.position.y = o.y0 + h - .0004;
    if (o.lookT === undefined || t - o.lookT > .25) { o.lookT = t; const ch = { V: c.V, tot: { ...c.tot }, ind: { ...c.ind } }; equilibrate(ch); o.look = vesselLook(ch); }
    const rgb = o.look.rgb; o.rgb = o.rgb.map((x, i) => x + (rgb[i] - x) * .2); const col = new THREE.Color().setRGB(o.rgb[0] / 255, o.rgb[1] / 255, o.rgb[2] / 255, THREE.SRGBColorSpace);
    const kk = clamp((o.look.a - .26) * 1.7, 0, .92); o.lm.color.setRGB(1, 1, 1).lerp(col, kk); o.lm.attenuationColor.copy(col);
  }
}

/* ===================== ASSET: 50 mL BURETTE =====================
   A fixed burette with a readable 0.05 mL display. Tapping the stopcock
   cycles off -> dropwise -> fast flow; liquid is delivered through the tip
   only when a vessel is physically underneath it. */
function makeBurette(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); g.visible = false; g.userData.help = 'burette';
  const steel = MAT.steel, glass = MAT.glass;
  const base = new THREE.Mesh(new RoundedBoxGeometry(.16, .012, .13, 3, .006), MAT.grey); base.position.set(0, .006, 0); g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.006, .007, .43, 20), steel); post.position.set(-.055, .22, .035); g.add(post);
  const clampArm = new THREE.Mesh(new THREE.BoxGeometry(.06, .008, .008), steel); clampArm.position.set(-.027, .33, .035); g.add(clampArm);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .34, 32, 1, true), glass); tube.position.set(0, .31, .035); tube.renderOrder = 3; g.add(tube);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, 1, 24), liquidMat()); liquid.renderOrder = 2; g.add(liquid);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.0011, .0022, .065, 16), glass); tip.position.set(0, .1075, .035); g.add(tip);
  const cock = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .034, 20), new THREE.MeshPhysicalMaterial({ color: 0x2F62A8, roughness: .4 })); cock.rotation.z = Math.PI / 2; cock.position.set(0, .145, .035); g.add(cock);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(.045, .04, .04), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.copy(cock.position); g.add(proxy);
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 112; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(.095, .033), new THREE.MeshBasicMaterial({ map: tex })); display.position.set(.025, .035, .069); display.rotation.x = -1.05; g.add(display);
  const reading = () => Math.round(o.used / .05) * .05;
  const o = { kind: 'burette', g, x, z, V: 50, used: 0, mode: 0, liquid, cv, tex, shown: '', outlet: V3(x, .075, z + .035), active: false,
    reading, label: () => T('x.buretteLabel', { v: fmt(reading(), 2), mode: T(['x.buretteOff', 'x.buretteDrop', 'x.buretteFlow'][o.mode]) }) };
  const control = { kind: 'button', name: 'burette', proxy, label: o.label, tap: () => { if (!o.active) return; o.mode = (o.mode + 1) % 3; logE('info', [['x.buretteMode', { mode: T(['x.buretteOff', 'x.buretteDrop', 'x.buretteFlow'][o.mode]) }]]); } };
  proxy.userData.obj = control; balButtons.push(proxy); o.reset = active => { o.active = active; o.g.visible = active; o.V = 50; o.used = 0; o.mode = 0; o.shown = ''; };
  return o;
}
function updateBurette(dt) {
  if (!BURETTE.active) return;
  const h = .32 * BURETTE.V / 50; BURETTE.liquid.visible = BURETTE.V > .001; BURETTE.liquid.scale.y = h; BURETTE.liquid.position.set(0, .14 + h / 2, .035);
  const shown = fmt(BURETTE.reading(), 2); if (shown !== BURETTE.shown) { BURETTE.shown = shown; const c = BURETTE.cv.getContext('2d'); c.fillStyle = '#e9efe9'; c.fillRect(0, 0, 320, 112); c.fillStyle = '#183027'; c.font = '700 54px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillText(shown + ' mL', 160, 68); c.font = '600 20px "IBM Plex Sans", sans-serif'; c.fillText('BURETTE READING', 160, 100); BURETTE.tex.needsUpdate = true; }
  if (!BURETTE.mode || BURETTE.V <= 0) return;
  const v = vessels.find(q => !q.stowed && !q.held && Math.hypot(q.g.position.x - BURETTE.outlet.x, q.g.position.z - BURETTE.outlet.z) < .07);
  if (!v) return;
  const rate = BURETTE.mode === 1 ? .12 : 2.2, dV = Math.min(BURETTE.V, rate * dt);
  const got = addLiquid(v, compOf('naoh01'), dV, BURETTE.outlet.x, BURETTE.outlet.z); if (!got) return;
  BURETTE.V -= got; BURETTE.used += got; doEq(v);
  if (TASK && TASK.id === 'k3v02' && v.chem.eq && v.chem.eq.pH >= 8.2 && v.chem.eq.pH <= 9.4) TASK.endpoint = BURETTE.used;
}

/* ---------------- build the bench ---------------- */
makeBeaker('A', 0, .02, 105.37); makeBeaker('B', .14, -.07, 98.62); makeBeaker('C', -.13, .14, 101.14); makeBeaker('D', .06, .16, 99.83);
const bottles = [makeBottle('hcl', -.3, -.24), makeBottle('naoh', -.18, -.25), makeBottle('na2co3', .16, -.25), makeBottle('water', .28, -.24),
  makeBottle('hcl01', -.28, -.16), makeBottle('hcl001', -.2, -.16), makeBottle('acetic01', -.12, -.16), makeBottle('naoh01', -.04, -.16), makeBottle('vinegar', .04, -.16),
  makeBottle('nacl', -.06, -.25), makeBottle('na2so4', .05, -.25), makeBottle('cuso4', .4, -.25), ...UNK.map((L, i) => makeBottle('u' + L, -.1 + i * .1, -.16))];
function tintBottle(b) { const t = {}; for (const k in REAG[b.id].tot) t[k] = REAG[b.id].tot[k] * 100; const ch = { V: 100, tot: t, ind: {} }; equilibrate(ch); const lk = vesselLook(ch);
  const m = b.liq.material, col = lk.baseKey !== 'colourless'; if (col) m.attenuationColor.setRGB(lk.rgb[0] / 255, lk.rgb[1] / 255, lk.rgb[2] / 255, THREE.SRGBColorSpace); else m.attenuationColor.setRGB(.78, .88, .92); m.attenuationDistance = col ? .025 : .12; }
for (const b of bottles) tintBottle(b);
const droppers = [makeDropper('univ', .2, .18), makeDropper('phph', .27, .15), makeDropper('mo', .34, .12), makeDropper('agno3', .41, .07), makeDropper('bacl2', .13, .23)];
const wash = makeWashBottle(.42, .2);
const pipettes = [makePipette('p3', -.11, .25), makePipette('p10', -.24, .3)];
const BURETTE = makeBurette(.22, .04);
const tapProxy = new THREE.Mesh(new THREE.BoxGeometry(.09, .04, .04), new THREE.MeshBasicMaterial({ visible: false })); tapProxy.position.set(.035, 0, .02); TAP.lever.add(tapProxy);
{ const o = { kind: 'button', name: 'tap', proxy: tapProxy, label: () => T(TAP.on ? 'x.tapOff' : 'x.tapOn') }; o.tap = () => { TAP.on = !TAP.on; buzz(10); }; tapProxy.userData.obj = o; balButtons.push(tapProxy); }
REAG.tap = { tot: {}, name: 'x.tapw', f: 'H₂O' };
/* a beaker held under the running tap is placed upright beneath the spout and fills */
function underTap(o) {
  if (!TAP.on || Math.hypot(ptr.x - TAP.spout.x, ptr.z - TAP.spout.z) > .07) return false;
  o.underTap = true; o.tilt = 0; o.g.quaternion.identity();
  o.g.position.lerp(V3(TAP.spout.x, .04, TAP.spout.z), 1 - Math.exp(-.016 * 12)); o.spout.copy(o.g.position).add(V3(0, o.H, 0)); o.g.updateMatrixWorld(); o.tg = null; drawStream(o, null);
  return true;
}
function updateTap(dt) {
  TAP.lever.rotation.z += ((TAP.on ? .9 : 0) - TAP.lever.rotation.z) * (1 - Math.exp(-dt * 10));
  if (!TAP.on) { drawStream('tap', null); return; }
  const a = TAP.spout.clone().add(V3(0, -.004, 0)); let b, v = vessels.find(q => !q.stowed && ((q.underTap && q.held) || (q.inSink && !q.held && Math.hypot(q.g.position.x - a.x, q.g.position.z - a.z) < q.Ri)));
  if (v) { const l = worldToLocal(v, V3(a.x, 0, a.z)); b = V3(a.x, v.g.position.y + (v.chem.V > .02 ? surfaceY(v, l.x, l.z, clock.elapsedTime) : v.b), a.z); deliver({ kind: 'vessel', v }, compOf('tap'), TAP.flow * dt, b, 4); }
  else { b = V3(a.x, -SINK.depth + .002, a.z); if (Math.random() < .5) SPL.push({ x: b.x, y: b.y + .002, z: b.z, vx: (Math.random() - .5) * .25, vy: .15 + Math.random() * .2, vz: (Math.random() - .5) * .25, r: .0006 }); }
  drawStream('tap', a, b, 3);
}
const OBJ = [...vessels, ...bottles, ...droppers, wash, spatula, electrode, rod, rodHolder, ...probes, ...pipettes];
let pickables = [];
function refreshPickables() { pickables = [...OBJ.map(o => o.proxy), ...droppers.map(o => o.bodyProxy), ...pipettes.map(o => o.controlProxy), ...balButtons]; if (JAR.proxy) pickables.push(JAR.proxy); if (typeof PT !== 'undefined') for (const S of PT.samples) pickables.push(S.proxy); if (typeof PROPS !== 'undefined') for (const S of PROPS) pickables.push(S.proxy); }

/* ===================== EQUIPMENT LIBRARY: closet (glassware, tools) and chemical shelf =====================
   Every item exists once in the library. "Taking" it places it on a free spot of the bench; "putting it back" hides it.
   Fixed bench equipment (sink + tap, balance, pH meter + electrode, wash bottle) is always present. */
const FAR = V3(0, -5, 0);
/* ===================== THE ROOM =====================
   Bench in front (back wall z = −0.5). Floor at y = −0.9 (bench top 90 cm). Turning 90° left: floor-standing glassware
   closet on the left wall. Turning 90° right: four chemical cabinets on the right wall, gas cylinders further right.
   Shelf heights (top surfaces): B −0.86 (big, heavy) · M1 0.02 · M2 0.40 (eye level, used most) · T 0.78 (large, light). */
const FLOOR = -.9, LV = { B: -.86, M1: .02, M2: .40, T: .78 };
const ROOM = {
  glass: { frontX: -1.75, backX: -2.2, out: 1, ry: Math.PI / 2, z0: -.48, z1: 2.22, secs: [[-.48, .42], [.42, 1.32], [1.32, 2.22]] },
  chem: { frontX: 1.9, backX: 2.35, out: -1, ry: -Math.PI / 2, cabs: { acid: [-.48, .02], gen: [.02, .72], ox: [.72, 1.12], base: [1.12, 1.62] } },
  flam: { x: 2.12, z: 1.72, ry: -Math.PI / 2 },
  gas: { x: 2.16, z0: 2.08, step: .21 },
};
const floorTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#d9dcd6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 180 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v - 6},${Math.random() * .35})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 5);
{ const fl = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 3.8), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .8 })); fl.rotation.x = -Math.PI / 2; fl.position.set(.075, FLOOR, 1.4); fl.receiveShadow = true; fl.userData.help = 'room'; scene.add(fl);
  const wt = tileTex.clone(); wt.repeat.set(5, 4); wt.needsUpdate = true;
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: .4 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 2.6), wm); back.position.set(.075, FLOOR + 1.3, -.5); back.userData.help = 'wall'; scene.add(back);
  for (const [x, ry] of [[-2.2, Math.PI / 2], [2.35, -Math.PI / 2]]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6), wm); sw.position.set(x, FLOOR + 1.3, 1.4); sw.rotation.y = ry; sw.userData.help = 'wall'; scene.add(sw); }
  const lam = new THREE.MeshStandardMaterial({ color: 0xD3D8D5, roughness: .6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, FLOOR * -1 - .13, 1.32), lam); base.position.set(0, (FLOOR - .13) / 2, .18); base.receiveShadow = true; base.userData.help = 'bench'; scene.add(base);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.9, .08, .02), lam); apron.position.set(0, -.09, .885); scene.add(apron);
  // Dedicated flammables storage belongs to the Chemicals side of the room,
  // outside the starting bench view but still separate from oxidisers.
  const fc = new THREE.Group(); fc.position.set(ROOM.flam.x, FLOOR, ROOM.flam.z); fc.rotation.y = ROOM.flam.ry; fc.userData.help = 'flamcab'; scene.add(fc);
  const flamMat = new THREE.MeshPhysicalMaterial({ color: 0xE9B91A, roughness: .45, clearcoat: .3 });
  const fback = new THREE.Mesh(new THREE.BoxGeometry(.56, .7, .02), flamMat); fback.position.set(0, .4, -.2); fc.add(fback);
  for (const x of [-.275, .275]) { const side = new THREE.Mesh(new THREE.BoxGeometry(.03, .7, .22), flamMat); side.position.set(x, .4, -.1); fc.add(side); }
  for (const y of [.05, .35, .75]) { const shelf = new THREE.Mesh(new THREE.BoxGeometry(.56, .035, .22), flamMat); shelf.position.set(0, y, -.1); fc.add(shelf); }
  const fsign = new THREE.Mesh(new THREE.PlaneGeometry(.2, .1), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, c => { c.fillStyle = '#E9B91A'; c.fillRect(0, 0, 256, 128); c.save(); c.translate(48, 52); c.rotate(Math.PI / 4); c.fillStyle = '#fff'; c.strokeStyle = '#d0121b'; c.lineWidth = 8; c.fillRect(-28, -28, 56, 56); c.strokeRect(-28, -28, 56, 56); c.restore(); c.fillStyle = '#111'; c.font = '700 23px "IBM Plex Sans", sans-serif'; c.textAlign = 'left'; c.fillText('FLAMMABLE', 88, 61); }) })); fsign.position.set(0, .68, .016); fc.add(fsign);
  ROOM.flamcab = fc; }
/* Furniture: muted, laboratory-grade oak.  It is dark enough to outline
   transparent glass, but deliberately low in saturation and contrast so the
   stored objects—not the cabinetry—remain the visual focus. */
const oakTex = canvasTex(1024, 256, (c, w, h) => {
  const grad = c.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#aaa397'); grad.addColorStop(.5, '#9f978c'); grad.addColorStop(1, '#958e84'); c.fillStyle = grad; c.fillRect(0, 0, w, h);
  for (let y = 10; y < h; y += 10) { c.beginPath(); for (let x = 0; x <= w; x += 10) { const yy = y + Math.sin(x * .018 + y) * 1.1 + Math.sin(x * .006 + y * .2) * .7; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.strokeStyle = 'rgba(67,58,48,.075)'; c.lineWidth = .8; c.stroke(); }
});
oakTex.wrapS = oakTex.wrapT = THREE.RepeatWrapping; oakTex.repeat.set(1.8, 1);
const WOOD = new THREE.MeshPhysicalMaterial({ map: oakTex, color: 0xd2cec7, roughness: .84, clearcoat: .015 });
const EDGE = new THREE.MeshPhysicalMaterial({ map: oakTex, color: 0x77716a, roughness: .88 });
const STEEL2 = new THREE.MeshStandardMaterial({ color: 0x9AA3A8, metalness: .6, roughness: .35 });
function cabinet(frontX, backX, z0, z1, help, sideTint) {
  const g = new THREE.Group(); g.userData.help = help; scene.add(g);
  const cx = (frontX + backX) / 2, dx = Math.abs(backX - frontX), w = z1 - z0, cz = (z0 + z1) / 2, H = 2.05, y0 = FLOOR;
  const add = (geo, x, y, z, m = WOOD) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  add(new THREE.BoxGeometry(.012, H, w), backX - Math.sign(backX - frontX) * .006, y0 + H / 2, cz);
  for (const z of [z0 + .009, z1 - .009]) add(new THREE.BoxGeometry(dx, H, .018), cx, y0 + H / 2, z, sideTint || WOOD);
  for (const y of [LV.B, LV.M1, LV.M2, LV.T, y0 + H - .01]) { add(new THREE.BoxGeometry(dx, .02, w - .036), cx, y - .01, cz); add(new THREE.BoxGeometry(.008, .026, w - .036), frontX, y - .01, cz, EDGE); }
  add(new THREE.BoxGeometry(dx, .06, w), cx, y0 + .03, cz, EDGE);
  return g;
}
const SIGN = [];
function sign(x, y, z, ry, key, color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.4, .075), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  const draw = () => { const c = cv.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 512, 96); c.fillStyle = '#fff'; c.font = '700 44px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(T(key), 256, 50); tex.needsUpdate = true; };
  SIGN.push(draw); draw(); return m;
}
{ const G = ROOM.glass; for (const [z0, z1] of G.secs) { cabinet(G.frontX, G.backX, z0, z1, 'closet'); sign(G.frontX + .01, FLOOR + 2.0, (z0 + z1) / 2, G.ry, 'x.sGlass', '#0B6B63'); }
  const C = ROOM.chem, cols = { acid: '#B5403A', gen: '#5C6663', ox: '#C9781E', base: '#2F62A8' };
  for (const k in C.cabs) { const [z0, z1] = C.cabs[k]; cabinet(C.frontX, C.backX, z0, z1, 'cab:' + k); sign(C.frontX - .01, FLOOR + 2.0, (z0 + z1) / 2, C.ry, 'x.s_' + k, cols[k]); } }
/* ---- back wall (behind the student): fume cupboard with extraction duct ----
   Base cabinet, epoxy worktop at bench height, side walls, slotted back baffle, sliding glass sash, lit canopy,
   control panel (fan switch + airflow indicator) and a duct to the ceiling. Tap the sash to raise or lower it,
   tap the switch to start the extraction fan. Used for burning and distillation in a later round. */
const HOOD = { x0: -.78, x1: .78, zB: 3.3, zF: 2.52, top: 1.0, sash: 0, sashT: 0, fan: false, flutter: 0 };
{ const wt = tileTex.clone(); wt.repeat.set(5, 4); wt.needsUpdate = true;
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 2.6), new THREE.MeshStandardMaterial({ map: wt, roughness: .4 })); bw.position.set(.075, FLOOR + 1.3, 3.3); bw.rotation.y = Math.PI; bw.userData.help = 'wall'; scene.add(bw);
  const H = HOOD, g = new THREE.Group(); g.userData.help = 'hood'; scene.add(g);
  const W = H.x1 - H.x0, D = H.zB - H.zF, cx = (H.x0 + H.x1) / 2, cz = (H.zB + H.zF) / 2;
  const mBody = new THREE.MeshPhysicalMaterial({ color: 0xE4E8E6, roughness: .45, clearcoat: .25 }), mDark = new THREE.MeshStandardMaterial({ color: 0x2C3133, roughness: .6 });
  const add = (geo, x, y, z, m = mBody) => { const b = new THREE.Mesh(geo, m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  add(new THREE.BoxGeometry(W, -FLOOR - .03, D), cx, (FLOOR - .03) / 2, cz);                                   // base cabinet
  for (const dx of [-W / 4, W / 4]) { add(new THREE.BoxGeometry(W / 2 - .02, .78, .006), cx + dx, FLOOR + .47, H.zF - .004, new THREE.MeshPhysicalMaterial({ color: 0xD5DBD8, roughness: .5 })); add(new THREE.BoxGeometry(.012, .1, .012), cx + dx + (dx < 0 ? .3 : -.3), FLOOR + .74, H.zF - .012, STEEL2); }
  add(new THREE.BoxGeometry(W, .03, D + .02), cx, -.015, cz - .01, mDark);                                    // epoxy worktop
  for (const x of [H.x0 + .03, H.x1 - .03]) add(new THREE.BoxGeometry(.06, H.top, D), x, H.top / 2, cz);        // side walls
  add(new THREE.BoxGeometry(W - .12, H.top, .02), cx, H.top / 2, H.zB - .04, mBody);                           // back panel
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(W - .2, .018, .006), cx, .1 + i * .3, H.zB - .055, mDark);   // baffle slots
  add(new THREE.BoxGeometry(W, .22, D), cx, H.top + .11, cz);                                                    // canopy
  const lamp = add(new THREE.BoxGeometry(W - .2, .01, .12), cx, H.top - .006, cz - .1, new THREE.MeshBasicMaterial({ color: 0xFFF8E6 }));
  const duct = add(new THREE.CylinderGeometry(.13, .13, 1.7 - H.top - .22, 24), cx, (H.top + .22 + 1.7) / 2, cz + .1, new THREE.MeshStandardMaterial({ color: 0xBFC6C9, metalness: .5, roughness: .4 }));
  for (const y of [H.top + .32, 1.55]) add(new THREE.TorusGeometry(.132, .008, 8, 32).rotateX(Math.PI / 2), cx, y, cz + .1, STEEL2);
  // sash: glass in an aluminium frame, slides up inside the front
  const sash = new THREE.Group(); sash.position.set(cx, 0, H.zF + .02); g.add(sash); H.sashG = sash;
  const SW = W - .14, SH = .62;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshPhysicalMaterial({ color: 0xd6e6e6, roughness: .02, transparent: true, opacity: .18, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); pane.position.y = SH / 2 + .05; pane.renderOrder = 3; sash.add(pane);
  for (const [w, h, x, y] of [[SW, .03, 0, .05], [SW, .02, 0, SH + .05], [.02, SH, -SW / 2, SH / 2 + .05], [.02, SH, SW / 2, SH / 2 + .05]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .02), STEEL2); f.position.set(x, y, 0); sash.add(f); }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, SW * .7, 12).rotateZ(Math.PI / 2), STEEL2); handle.position.set(0, .05, -.03); sash.add(handle);
  const sProxy = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, .04), new THREE.MeshBasicMaterial({ visible: false })); sProxy.position.y = SH / 2 + .05; sash.add(sProxy);
  { const o = { kind: 'button', name: 'sash', proxy: sProxy, label: () => T(H.sashT ? 'x.hoodSashDown' : 'x.hoodSashUp') }; o.tap = () => { H.sashT = H.sashT ? 0 : 1; buzz(10); showManual('hood'); }; sProxy.userData.obj = o; balButtons.push(sProxy); }
  // control panel on the right post: fan switch with LED, airflow streamer at the sash
  const panel = add(new THREE.BoxGeometry(.05, .16, .012), H.x1 - .03, .9, H.zF - .01, mDark);
  const sw = add(new THREE.BoxGeometry(.026, .03, .012), H.x1 - .03, .93, H.zF - .02, new THREE.MeshStandardMaterial({ color: 0xE9ECEA }));
  const led = add(new THREE.SphereGeometry(.006, 12, 8), H.x1 - .03, .88, H.zF - .018, new THREE.MeshBasicMaterial({ color: 0x3a3f42 })); H.led = led;
  const swProxy = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .05), new THREE.MeshBasicMaterial({ visible: false })); swProxy.position.set(H.x1 - .03, .9, H.zF - .02); g.add(swProxy);
  { const o = { kind: 'button', name: 'fan', proxy: swProxy, label: () => T(H.fan ? 'x.hoodFanOff' : 'x.hoodFanOn') }; o.tap = () => { H.fan = !H.fan; buzz(10); logE('info', [[H.fan ? 'x.hoodFanIsOn' : 'x.hoodFanIsOff']]); if (TASK && TASK.id === 'combustion') checkTask(); showManual('hood'); }; swProxy.userData.obj = o; balButtons.push(swProxy); }
  const str = new THREE.Mesh(new THREE.PlaneGeometry(.012, .07), new THREE.MeshStandardMaterial({ color: 0xE24B3B, side: THREE.DoubleSide })); str.geometry.translate(0, -.035, 0); str.position.set(H.x0 + .09, .05, -.005); sash.add(str); H.streamer = str;
  sign(cx, H.top + .11, H.zF - .003, Math.PI, 'x.hoodSign', '#0B6B63');
}
function updateHood(dt) {
  const H = HOOD; H.sash += (H.sashT - H.sash) * (1 - Math.exp(-dt * 5)); H.sashG.position.y = H.sash * .3;
  H.led.material.color.setHex(H.fan ? 0x39D06B : 0x3a3f42);
  H.flutter += dt * (H.fan ? 14 : 0); H.streamer.rotation.x = H.fan ? -.9 - .25 * Math.sin(H.flutter) : 0; H.streamer.rotation.z = H.fan ? .1 * Math.sin(H.flutter * 1.7) : 0;
}
/* ---- layout: bays (one per shelf level and cabinet), two rows deep; items placed left to right as the viewer sees them ---- */
function makeBay(unit, y, z0, z1) {
  const U = ROOM[unit], A = unit === 'glass' ? -1 : 1, start = unit === 'glass' ? z1 - .03 : z0 + .03;
  return { unit, y, A, start, len: (z1 - z0) - .06, ry: U.ry, out: U.out, frontX: U.frontX, rows: [U.frontX - U.out * .1, U.frontX - U.out * .27], cur: [0, 0] };
}
const BAYS = {};
for (const lv in LV) { ROOM.glass.secs.forEach(([z0, z1], i) => { BAYS['g' + i + ':' + lv] = makeBay('glass', LV[lv], z0, z1); }); for (const k in ROOM.chem.cabs) BAYS[k + ':' + lv] = makeBay('chem', LV[lv], ...ROOM.chem.cabs[k]); }
function placeIn(bayKey, w, d) {
  if (bayKey.startsWith('glass:')) { const lv = bayKey.slice(6); bayKey = [0, 1, 2].map(i => 'g' + i + ':' + lv).find(k => { const b = BAYS[k]; return b.cur[0] + w <= b.len || b.cur[1] + w <= b.len; }) || 'g2:' + lv; }
  const B = BAYS[bayKey]; let r = B.cur[0] + w <= B.len ? 0 : B.cur[1] + w <= B.len ? 1 : -1;
  if (r < 0) { console.warn('shelf full', bayKey); r = 1; }
  const s = B.cur[r] + w / 2; B.cur[r] += w + .015; if (d > .17 && r === 0) B.cur[1] = Math.max(B.cur[1], B.cur[0]);
  return { p: V3(B.rows[r], B.y, B.start + B.A * s), ry: B.ry, B, along: B.start + B.A * (s - w / 2), row: r };
}
const SLOTS = {};
function slotFor(key, bayKey, w, d) { const P = placeIn(bayKey, w, d); SLOTS[key] = { p: P.p, ry: P.ry, along: P.along, A: P.B.A, tag: V3(P.B.frontX + P.B.out * .003, P.B.y - .013, P.p.z), B: P.B }; }
// usable items first, at eye level (and the salt jar on top, as large-and-light)
slotFor('beaker:A', 'glass:M2', .078, .08); slotFor('beaker:B', 'glass:M2', .078, .08); slotFor('beaker:C', 'glass:M2', .078, .08); slotFor('beaker:D', 'glass:M2', .078, .08);
slotFor('p10', 'glass:M2', .34, .03); slotFor('p3', 'glass:M2', .17, .03); slotFor('rod', 'glass:M2', .21, .02); slotFor('spatula', 'glass:M2', .2, .03);
for (const n of [1, 2, 3]) slotFor('thermo:' + n, 'glass:T', .19, .03);
slotFor('cond', 'glass:T', .19, .03);
slotFor('bottle:hcl', 'acid:M2', .066, .066); slotFor('bottle:naoh', 'base:M2', .066, .066); slotFor('bottle:na2co3', 'gen:M2', .066, .066); slotFor('bottle:water', 'gen:M2', .066, .066);
slotFor('bottle:hcl01', 'acid:M1', .066, .066); slotFor('bottle:hcl001', 'acid:M1', .066, .066); slotFor('bottle:acetic01', 'acid:M1', .066, .066); slotFor('bottle:vinegar', 'acid:M1', .066, .066);
slotFor('bottle:naoh01', 'base:M1', .066, .066);
slotFor('dropper:univ', 'gen:M2', .04, .04); slotFor('dropper:phph', 'gen:M2', .04, .04); slotFor('dropper:mo', 'gen:M2', .04, .04); slotFor('jar', 'gen:T', .075, .075);
slotFor('bottle:nacl', 'gen:B', .066, .066); slotFor('bottle:na2so4', 'gen:B', .066, .066); slotFor('bottle:cuso4', 'gen:B', .066, .066); slotFor('dropper:agno3', 'ox:M2', .04, .04); slotFor('dropper:bacl2', 'ox:M2', .04, .04);
for (const L of UNK) slotFor('bottle:u' + L, 'base:M1', .066, .066);
// lying items are placed with their tip at the start of their slot, pointing along the shelf
for (const k of ['p10', 'p3', 'rod', 'spatula', 'thermo:1', 'thermo:2', 'thermo:3', 'cond']) { const S = SLOTS[k]; S.p.z = S.along; }
const slotPos = key => SLOTS[key].p.clone();
const qY = a => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a);

/* ---- display-only inventory (DECOR): built from simple shapes, merged by material into a few meshes ---- */
const DECOR_PICK = [], DECOR_MESH = {}, PROPS = [];
{
  const D = window.DECOR || { glass: [], chem: [], gases: [] };
  const buckets = { glass: [], amber: [], opaque: [], label: [], liquid: [] };
  const LIQCOL = { 'CuSO₄': 0x3C8CE0, 'FeCl₃': 0xC9862A, 'KMnO₄': 0x7A1E7A, 'Br₂(aq)': 0xC0601E, 'I₂/KI': 0x8A4A1A, "Benedict's": 0x2F6FD0, Litmus: 0x7A3A9A, EBT: 0x3A2A6A };
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); cc.convertSRGBToLinear(); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const prep = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
  const P = [];   // parts of the item being built: {g, b, c, role}
  const part = (g, b, x = 0, y = 0, z = 0, c, role) => { g.translate(x, y, z); P.push({ g, b, c, role }); };
  const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);
  const cyl = (r1, r2, h, seg = 16) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(0, h / 2, 0); return g; };
  const box = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; };
  const lie = (g) => { g.rotateZ(-Math.PI / 2); return g; };   // a y-axis part laid along +x
  const cup = (r, h) => lathe([[0, 0], [r * .9, 0], [r, r * .1], [r, h], [r * 1.04, h]]);
  const bottleProfile = s => [[0, 0], [.024 * s, 0], [.025 * s, .005 * s], [.025 * s, .075 * s], [.014 * s, .095 * s], [.01 * s, .1 * s], [.01 * s, .118 * s]];
  // ---- glassware shapes: each returns [w (along shelf), d (depth)]; parts are built around x = 0..w ----
  const SH = {
    beakerS: () => { part(cup(.024, .036), 'glass', .025); part(cup(.03, .045), 'glass', .085); return [.12, .07]; },
    beakerL: () => { part(cup(.055, .14), 'glass', .055); part(cup(.07, .18), 'glass', .19); return [.27, .15]; },
    tubeRack: () => { part(box(.18, .06, .05), 'opaque', .09, 0, 0, 0xF0F0EE); for (let i = 0; i < 6; i++) part(cyl(.008, .008, .15, 10), 'glass', .02 + i * .028, .01); return [.19, .06]; },
    erlen: () => { const pr = s => lathe([[0, 0], [.036 * s, 0], [.037 * s, .006 * s], [.012 * s, .075 * s], [.012 * s, .1 * s]]); part(pr(1), 'glass', .04); part(pr(.8), 'glass', .115); return [.15, .08]; },
    erlenL: () => { const pr = s => lathe([[0, 0], [.062 * s, 0], [.064 * s, .008 * s], [.02 * s, .15 * s], [.02 * s, .19 * s]]); part(pr(1), 'glass', .065); part(pr(.8), 'glass', .18); return [.24, .13]; },
    rbf: () => { [.03, .036, .042].forEach((r, i) => { const x = .04 + i * .085; part(new THREE.TorusGeometry(r * .7, .008, 8, 20).rotateX(Math.PI / 2), 'opaque', x, .008, 0, 0xB08A5A); const sp = new THREE.SphereGeometry(r, 18, 12); sp.translate(0, r + .006, 0); part(sp, 'glass', x); part(cyl(.009, .009, .05, 10), 'glass', x, 2 * r); }); return [.27, .09]; },
    rbfL: () => { [.065, .08].forEach((r, i) => { const x = .07 + i * .17; part(new THREE.TorusGeometry(r * .6, .012, 8, 20).rotateX(Math.PI / 2), 'opaque', x, .012, 0, 0xB08A5A); const sp = new THREE.SphereGeometry(r, 20, 14); sp.translate(0, r + .01, 0); part(sp, 'glass', x); part(cyl(.014, .014, .07, 10), 'glass', x, 2 * r); }); return [.33, .17]; },
    watch: () => { for (let i = 0; i < 4; i++) part(cyl(.045, .04, .007, 24), 'glass', .05, i * .008); return [.1, .1]; },
    evap: () => { const b = () => lathe([[0, 0], [.03, 0], [.045, .02], [.047, .026]]); part(b(), 'opaque', .05, 0, 0, 0xF6F4EF); part(b(), 'opaque', .15, 0, 0, 0xF6F4EF); return [.2, .1]; },
    crucible: () => { for (let i = 0; i < 3; i++) { part(lathe([[0, 0], [.012, 0], [.018, .03], [.019, .032]]), 'opaque', .02 + i * .045, 0, 0, 0xF6F4EF); part(cyl(.02, .02, .004, 16), 'opaque', .02 + i * .045, .032, 0, 0xF6F4EF); } return [.13, .05]; },
    petri: () => { part(cyl(.045, .045, .04, 24), 'glass', .05); part(cyl(.045, .045, .04, 24), 'glass', .15); return [.2, .1]; },
    bottleE: () => { [.8, 1, 1.25].forEach((s, i) => { part(lathe(bottleProfile(s)), 'glass', .03 + i * .065); part(cyl(.012 * s, .012 * s, .015 * s, 12), 'opaque', .03 + i * .065, .118 * s, 0, 0x2b2f31); }); return [.2, .07]; },
    cyl: () => { [[.009, .16], [.012, .2], [.017, .27]].forEach(([r, h], i) => { const x = .02 + i * .045; part(cyl(r * 2, r * 2, .006, 6), 'glass', x); part(cyl(r, r, h, 14), 'glass', x, .006); }); return [.14, .06]; },
    cylL: () => { [[.026, .34], [.034, .42]].forEach(([r, h], i) => { const x = .045 + i * .1; part(cyl(r * 2, r * 2, .01, 6), 'glass', x); part(cyl(r, r, h, 16), 'glass', x, .01); }); return [.2, .1]; },
    lieThin: () => { for (let i = 0; i < 3; i++) part(lie(cyl(.003, .003, .3, 8)), 'glass', 0, .004, -.02 + i * .015); return [.31, .06]; },
    volPip: () => { for (let i = 0; i < 2; i++) { const z = -.012 + i * .025; part(lie(cyl(.003, .003, .42, 8)), 'glass', 0, .012, z); const b = new THREE.SphereGeometry(.011, 12, 8); b.scale(2.2, 1, 1); part(b, 'glass', .21, .012, z); } return [.43, .06]; },
    filler: () => { part(new THREE.SphereGeometry(.02, 14, 10), 'opaque', .03, .02, 0, 0xB0242A); part(cyl(.012, .016, .05, 12), 'opaque', .08, 0, 0, 0x2E8B57); return [.11, .05]; },
    burette: () => { for (let i = 0; i < 2; i++) { const z = -.015 + i * .03; part(lie(cyl(.006, .006, .6, 10)), 'glass', 0, .008, z); part(box(.02, .012, .02), 'opaque', .55, .002, z, 0x2F62A8); } return [.62, .06]; },
    volflask: () => { [.7, .85, 1].forEach((s, i) => part(lathe([[0, 0], [.034 * s, 0], [.04 * s, .02 * s], [.03 * s, .06 * s], [.008 * s, .08 * s], [.008 * s, .17 * s]]), 'glass', .035 + i * .075)); return [.22, .08]; },
    volflaskL: () => { [1.5, 1.85].forEach((s, i) => part(lathe([[0, 0], [.034 * s, 0], [.04 * s, .02 * s], [.03 * s, .06 * s], [.009 * s, .08 * s], [.009 * s, .17 * s]]), 'glass', .065 + i * .15)); return [.3, .15]; },
    micropip: () => { for (let i = 0; i < 2; i++) part(box(.03, .18, .035), 'opaque', .02 + i * .04, 0, 0, 0xD9DDE0); part(box(.07, .05, .05), 'opaque', .13, 0, 0, 0x2F62A8); return [.17, .06]; },
    funnel: () => { const f = s => { part(lathe([[.004 * s, 0], [.004 * s, .05 * s], [.035 * s, .09 * s], [.036 * s, .092 * s]]), 'glass', .04 + (s - 1) * .25); }; f(1); f(1.3); return [.17, .1]; },
    funnelL: () => { part(lathe([[.006, 0], [.006, .05], [.06, .12], [.062, .124]]), 'opaque', .065, 0, 0, 0xF3F3F0); return [.13, .13]; },
    buchner: () => { part(lathe([[0, 0], [.038, 0], [.04, .1], [.042, .102]], 16), 'glass', .045); part(cyl(.035, .03, .05, 18), 'opaque', .045, .1, 0, 0xF6F4EF); return [.1, .09]; },
    sep: () => { for (let i = 0; i < 2; i++) { const x = .04 + i * .08; part(lathe([[.004, 0], [.004, .05], [.03, .1], [.035, .15], [.01, .19], [.01, .21]]), 'glass', x); part(box(.02, .01, .01), 'opaque', x, .045, 0, 0x2F62A8); } return [.16, .08]; },
    brush: () => { for (let i = 0; i < 2; i++) { const z = -.01 + i * .02; part(lie(cyl(.002, .002, .2, 6)), 'opaque', 0, .006, z, 0x777777); part(lie(cyl(.008, .008, .07, 10)), 'opaque', .15, .006, z, 0xDDCCAA); } return [.21, .04]; },
    lamp: () => { for (let i = 0; i < 2; i++) { const x = .035 + i * .08; part(lathe([[0, 0], [.035, 0], [.036, .04], [.012, .06], [.01, .07]]), 'glass', x); part(cyl(.011, .011, .02, 12), 'opaque', x, .07, 0, 0xEFEFEF); } return [.16, .08]; },
    bunsen: () => { for (let i = 0; i < 2; i++) { const x = .045 + i * .09; part(cyl(.04, .04, .012, 18), 'opaque', x, 0, 0, 0x3A3F42); part(cyl(.008, .008, .13, 12), 'opaque', x, .012, 0, 0xA8B0B4); } return [.18, .09]; },
    tripod: () => { part(new THREE.TorusGeometry(.06, .004, 6, 24).rotateX(Math.PI / 2), 'opaque', .07, .15, 0, 0x6D7478); for (let i = 0; i < 3; i++) { const a = i * 2.094; part(cyl(.003, .003, .15, 6), 'opaque', .07 + Math.cos(a) * .06, 0, Math.sin(a) * .06, 0x6D7478); } part(box(.13, .002, .13), 'opaque', .07, .152, 0, 0x8A8F8C); return [.14, .14]; },
    triangle: () => { for (let i = 0; i < 3; i++) { const g = lie(cyl(.004, .004, .07, 6)); g.rotateY(i * 2.094); part(g, 'opaque', .045, .005, 0, 0xEFEAE0); } return [.09, .08]; },
    holder: () => { for (let i = 0; i < 2; i++) part(box(.16, .012, .022), 'opaque', .08, 0, -.015 + i * .03, 0xB98A55); return [.17, .06]; },
    tongs: () => { for (let i = 0; i < 2; i++) part(box(.22, .006, .008), 'opaque', .11, i * .007, -.006 + i * .012, 0xA8B0B4); return [.23, .04]; },
    hotplate: () => { part(box(.2, .09, .24), 'opaque', .1, 0, 0, 0xEDEFEF); part(box(.17, .006, .17), 'opaque', .1, .09, -.02, 0x3A3F42); return [.21, .25]; },
    mantle: () => { part(cyl(.075, .065, .1, 20), 'opaque', .075, 0, 0, 0x5A5F62); return [.16, .16]; },
    jarS: () => { part(cyl(.024, .024, .05, 16), 'opaque', .025, 0, 0, 0xF2F2EE); part(cyl(.026, .026, .012, 16), 'opaque', .025, .05, 0, 0x6C7773); return [.055, .055]; },
    condenser: () => { part(lie(cyl(.016, .016, .34, 14)), 'glass', 0, .018); part(lie(cyl(.006, .006, .4, 8)), 'glass', -.03, .018); return [.37, .05]; },
    adapter: () => { for (let i = 0; i < 3; i++) { const g = cyl(.009, .009, .06, 10); g.rotateZ(i % 2 ? .6 : -.4); part(g, 'glass', .02 + i * .035, .01); } return [.12, .05]; },
    tubing: () => { part(new THREE.TorusGeometry(.05, .006, 8, 30).rotateX(Math.PI / 2), 'opaque', .06, .006, 0, 0x9C6B3C); part(new THREE.TorusGeometry(.04, .006, 8, 30).rotateX(Math.PI / 2), 'opaque', .06, .018, 0, 0x9C6B3C); return [.13, .12]; },
    stand: () => { part(box(.14, .012, .22), 'opaque', .07, 0, 0, 0x3A3F42); part(cyl(.006, .006, .6, 10), 'opaque', .07, .012, -.07, 0xA8B0B4); return [.15, .23]; },
    ringclamp: () => { part(new THREE.TorusGeometry(.04, .004, 6, 24).rotateX(Math.PI / 2), 'opaque', .045, .005, 0, 0x6D7478); part(lie(cyl(.004, .004, .1, 6)), 'opaque', .085, .005, 0, 0x6D7478); return [.19, .09]; },
    rackEmpty: () => { part(box(.18, .07, .06), 'opaque', .09, 0, 0, 0xF0F0EE); return [.19, .07]; },
    corkring: () => { for (let i = 0; i < 2; i++) part(new THREE.TorusGeometry(.04, .012, 8, 20).rotateX(Math.PI / 2), 'opaque', .055 + i * .1, .012, 0, 0xB08A5A); return [.21, .11]; },
    delivery: () => { for (let i = 0; i < 2; i++) { const x = .03 + i * .06; part(cyl(.004, .004, .12, 8), 'glass', x, .02); part(cyl(.012, .01, .02, 12), 'opaque', x, 0, 0, 0xB0242A); } return [.12, .05]; },
    gasjar: () => { for (let i = 0; i < 3; i++) { const x = .035 + i * .08; part(cyl(.035, .035, .2, 18), 'glass', x); part(cyl(.04, .04, .005, 18), 'glass', x, .2); } return [.24, .08]; },
    syringe: () => { part(lie(cyl(.016, .016, .2, 14)), 'glass', 0, .018); part(lie(cyl(.012, .012, .1, 10)), 'opaque', .18, .018, 0, 0xE9ECEA); return [.29, .05]; },
    kipp: () => { const s1 = new THREE.SphereGeometry(.06, 16, 12); s1.translate(0, .06, 0); part(s1, 'glass', .07); const s2 = new THREE.SphereGeometry(.05, 16, 12); s2.translate(0, .17, 0); part(s2, 'glass', .07); part(cyl(.02, .02, .2, 12), 'glass', .07, .22); return [.15, .13]; },
    meter: () => { part(box(.14, .06, .1), 'opaque', .07, 0, 0, 0x3A3F42); part(box(.07, .003, .04), 'opaque', .06, .06, -.01, 0xA9C4A0); return [.15, .11]; },
    matches: () => { part(box(.05, .016, .035), 'opaque', .025, 0, 0, 0xC8463A); part(box(.051, .004, .036), 'opaque', .025, .008, 0, 0xF2E3B0); return [.055, .04]; },
    tlc: () => { part(box(.1, .12, .06), 'glass', .05); for (let i = 0; i < 3; i++) part(box(.08, .002, .05), 'opaque', .05, .125 + i * .004, 0, 0xF4F4EE); return [.11, .07]; },
    box: (it) => { const [w, h, d] = it.box; part(box(w, h, d), 'opaque', w / 2, 0, 0, it.col); return [w + .005, d]; },
  };
  // ---- chemical containers ----
  const GRPCAP = { acid: 0xB5403A, base: 0x2F62A8, gen: 0x6C7773, ox: 0xD9822B, ind: 0x8E2A2A, org: 0x4D8A57, tox: 0x6B3FA0, wr: 0x555555, flam: 0xE2B714 };
  // label atlas: 8 × 16 cells of 256 × 128 px
  const atlas = document.createElement('canvas'); atlas.width = 2048; atlas.height = 2048; const ac = atlas.getContext('2d'); ac.fillStyle = '#fff'; ac.fillRect(0, 0, 2048, 2048);
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8; let cell = 0;
  const HZCOL = { corr: '#d0121b', tox: '#d0121b', ox: '#d0121b', flam: '#d0121b', harm: '#d0121b', irr: '#d0121b', env: '#d0121b', water: '#d0121b' };
  function labelCell(it) {
    const i = cell++, cx = (i % 8) * 256, cy = Math.floor(i / 8) * 128;
    ac.fillStyle = '#fbfaf6'; ac.fillRect(cx, cy, 256, 128); ac.fillStyle = GRPCAP[it.grp] ? '#' + GRPCAP[it.grp].toString(16).padStart(6, '0') : '#555'; ac.fillRect(cx, cy, 256, 12);
    const tx = it.accent ? 32 : 10;
    if (it.accent) { ac.fillStyle = '#' + it.accent.toString(16).padStart(6, '0'); ac.fillRect(cx, cy + 12, 20, 116); }
    ac.fillStyle = '#1b2622'; ac.textAlign = 'left'; ac.textBaseline = 'alphabetic';
    let fs = 50; ac.font = `600 ${fs}px "IBM Plex Mono", monospace`; while (ac.measureText(it.f).width > (it.hz.length ? 204 - tx : 246 - tx) && fs > 20) { fs -= 2; ac.font = `600 ${fs}px "IBM Plex Mono", monospace`; }
    ac.fillText(it.f, cx + tx, cy + 70); ac.font = '600 25px "IBM Plex Sans", sans-serif'; ac.fillStyle = it.accent ? '#' + it.accent.toString(16).padStart(6, '0') : '#55645e'; ac.fillText(it.c === 's' ? '' : [it.mark, it.c].filter(Boolean).join(' · '), cx + tx, cy + 112);
    if (it.hz.length) { ac.save(); ac.translate(cx + 215, cy + 62); ac.rotate(Math.PI / 4); ac.fillStyle = '#fff'; ac.strokeStyle = HZCOL[it.hz[0]]; ac.lineWidth = 6; ac.fillRect(-22, -22, 44, 44); ac.strokeRect(-22, -22, 44, 44); ac.restore(); ac.fillStyle = '#111'; ac.font = '700 24px "IBM Plex Sans", sans-serif'; ac.textAlign = 'center'; ac.fillText('!', cx + 215, cy + 71); }
    return [i % 8 / 8, 1 - (Math.floor(i / 8) + 1) / 16];
  }
  // Labels follow the cylindrical wall instead of floating as flat cards.
  // `w` is arc length, which keeps the wrap natural across container sizes.
  const labelWrap = (w, h, uv, x, y, r) => {
    const g = new THREE.PlaneGeometry(w, h, 10, 1), p = g.attributes.position, a = g.attributes.uv;
    for (let k = 0; k < p.count; k++) {
      const lx = p.getX(k), ly = p.getY(k), ang = lx / r;
      p.setXYZ(k, x + Math.sin(ang) * (r + .00045), y + ly, Math.cos(ang) * (r + .00045));
      a.setXY(k, uv[0] + a.getX(k) / 8, uv[1] + a.getY(k) / 16);
    }
    p.needsUpdate = true; a.needsUpdate = true; g.computeVertexNormals(); P.push({ g, b: 'label', role: 'label' });
  };
  function chemShape(it) {
    const cap = it.cap || GRPCAP[it.grp] || 0x6C7773, uv = labelCell(it);
    if (it.form === 'bottle' || it.form === 'brown') { part(lathe(bottleProfile(1)), it.form === 'brown' ? 'amber' : 'glass', .033); part(cyl(.0225, .0225, .066, 16), 'liquid', .033, .003, 0, it.tint || LIQCOL[it.f] || 0xD2E8F0); if (it.accent) part(cyl(.0255, .0255, .008, 16), 'opaque', .033, .084, 0, it.accent, 'accent'); part(cyl(.013, .013, .016, 14), 'opaque', .033, .116, 0, it.form === 'brown' ? 0x2b2f31 : cap, 'cap'); labelWrap(.042, .021, uv, .033, .045, .025); return [.066, .066]; }
    if (it.form === 'big' || it.form === 'bigBrown') { part(lathe(bottleProfile(2.3)), it.form === 'bigBrown' ? 'amber' : 'glass', .06); part(cyl(.052, .052, .16, 18), 'liquid', .06, .006, 0, it.tint || LIQCOL[it.f] || 0xD2E8F0); part(cyl(.026, .026, .03, 14), 'opaque', .06, .27, 0, cap, 'cap'); labelWrap(.08, .04, uv, .06, .1, .0575); return [.125, .125]; }
    if (it.form === 'dropper') { part(lathe([[0, 0], [.014, 0], [.016, .004], [.016, .045], [.008, .055], [.006, .062]]), 'amber', .02); part(cyl(.0135, .0135, .034, 12), 'liquid', .02, .003, 0, LIQCOL[it.f] || 0xD2E8F0); part(lathe([[0, 0], [.006, 0], [.007, .006], [.006, .02], [0, .024]]), 'opaque', .02, .062, 0, 0x8E2A2A, 'cap'); labelWrap(.026, .013, uv, .02, .025, .016); return [.042, .04]; }
    const big = it.form === 'jarL', sm = it.form === 'jarS', r = big ? .045 : sm ? .024 : .03, h = big ? .1 : sm ? .05 : .07;
    part(cyl(r, r, h, 18), 'opaque', r + .002, 0, 0, it.tint && !big ? 0xF2F2EE : 0xF2F2EE); part(cyl(r + .002, r + .002, .014, 18), 'opaque', r + .002, h, 0, cap, 'cap');
    labelWrap(r * 1.5, r * .75, uv, r + .002, h * .45, r); return [2 * r + .006, 2 * r + .006];
  }
  // build one item: parts in local frame (x along shelf, z toward the viewer) → world via the bay transform
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const QUEUE = [];
  function emit(bayKey, w, d, info) { QUEUE.push({ bayKey, w, d, info, parts: P.splice(0) }); }
  function flushQueue() {
    // deep items first in each bay, so the back row is not wasted behind them
    QUEUE.sort((a, b) => (a.bayKey < b.bayKey ? -1 : a.bayKey > b.bayKey ? 1 : (b.d > .17) - (a.d > .17)));
    for (const q of QUEUE) { P.push(...q.parts); place(q.bayKey, q.w, q.d, q.info); }
  }
  function place(bayKey, w, d, info, pose) {
    const S = pose ? { p: V3(pose.x, pose.y, pose.z), along: pose.z } : placeIn(bayKey, w, d), B = pose ? { ry: pose.ry || 0 } : S.B;
    // local origin at the slot start; rotate so local +x runs along the shelf and local +z faces out
    Q.copy(qY(B.ry)); M.compose(V3(S.p.x, B.y, S.along), Q, V3(1, 1, 1));
    // one shelf item can be a set (two spirit lamps, three flasks…): parts whose footprints overlap form one piece
    const n = P.length, par = [...Array(n).keys()], f = i => par[i] === i ? i : (par[i] = f(par[i]));
    if (info.type === 'glass') { const bb = P.map(q => { q.g.computeBoundingBox(); return q.g.boundingBox.clone(); });
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = bb[i], c = bb[j]; if (a.max.x > c.min.x + .0005 && c.max.x > a.min.x + .0005 && a.max.z > c.min.z + .0005 && c.max.z > a.min.z + .0005) par[f(i)] = f(j); } }
    else for (let i = 1; i < n; i++) par[i] = 0;
    const units = new Map(); P.forEach((q, i) => { const k = f(i); if (!units.has(k)) units.set(k, []); units.get(k).push(q); });
    for (const parts of units.values()) {
      const bx = new THREE.Box3(), inf = units.size > 1 ? Object.assign({}, info) : info;
      for (const { g, b, c } of parts) { g.applyMatrix4(M); if (b === 'opaque' || b === 'liquid') col(g, c ?? 0xffffff); g.computeBoundingBox(); bx.union(g.boundingBox); buckets[b].push(g); }
      inf.ry = B.ry; inf.geos = parts.map(q => ({ b: q.b, g: q.g, role: q.role })); bx.expandByScalar(.004); DECOR_PICK.push({ box: bx, info: inf });
    }
    P.length = 0;
  }
  for (const it of D.glass) { const [w, d] = SH[it.shape](it); emit('glass:' + it.sh, w, d, { type: 'glass', it }); }
  const CAB = { acid: 'acid', base: 'base', gen: 'gen', ind: 'gen', met: 'gen', org: 'gen', ox: 'ox' };
  // Usable stock containers already occupy these cabinet slots. Rendering a
  // second display-only model underneath them made one bottle appear to remain
  // after its working counterpart was taken.
  const functionalChem = new Set([...bottles.map(b => b.id), ...droppers.map(d => d.id)]);
  for (const it of D.chem) { if (!CAB[it.grp] || functionalChem.has(it.k)) continue; const [w, d] = chemShape(it); emit(CAB[it.grp] + ':' + (it.sh || 'M2'), w, d, { type: 'chem', it }); }
  // Flammable liquids live in their own fire-resistant cabinet beside the
  // chemical cabinets, outside the default bench view.
  // Render the individual bottles here so they are findable and can be taken by labs such as K1.13.
  const flammables = D.chem.filter(it => it.grp === 'flam');
  flammables.forEach((it, i) => {
    const [w, d] = chemShape(it), col = i % 5, row = Math.floor(i / 5);
    const p = V3(-.2 + col * .10, 0, -.075).applyAxisAngle(V3(0, 1, 0), ROOM.flam.ry);
    place(null, w, d, { type: 'chem', it }, { x: ROOM.flam.x + p.x, y: FLOOR + .08 + row * .30, z: ROOM.flam.z + p.z, ry: ROOM.flam.ry });
  });
  // locked box (toxic), sealed box (water-reactive) in the oxidiser/locked cabinet
  part(box(.28, .16, .22), 'opaque', .14, 0, 0, 0x7A8288); part(box(.06, .03, .004), 'opaque', .14, .1, .112, 0xE2B714); emit('ox:M1', .29, .23, { type: 'group', key: 'tox', items: D.chem.filter(i => i.grp === 'tox') });
  part(box(.16, .1, .14), 'opaque', .08, 0, 0, 0x4A5257); part(box(.05, .025, .004), 'opaque', .08, .06, .072, 0x3E7CC4); emit('ox:B', .17, .15, { type: 'group', key: 'wr', items: D.chem.filter(i => i.grp === 'wr') });
  flushQueue();
  // gas cylinders, chained to the wall to the right of the cabinets
  D.gases.forEach((gs, i) => { const z = ROOM.gas.z0 + i * ROOM.gas.step, x = ROOM.gas.x, y = FLOOR;
    const body = cyl(.09, .09, 1.25, 20); body.translate(x, y, z); P.push({ g: body, b: 'opaque', c: 0xA9B2B7 });
    const sh = new THREE.SphereGeometry(.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); sh.translate(x, y + 1.25, z); P.push({ g: sh, b: 'opaque', c: gs.col });
    if (gs.band) { const bd = cyl(.0905, .0905, .05, 20); bd.translate(x, y + 1.18, z); P.push({ g: bd, b: 'opaque', c: gs.band }); }
    const v = cyl(.02, .02, .08, 12); v.translate(x, y + 1.33, z); P.push({ g: v, b: 'opaque', c: 0x9AA3A8 });
    const rg = box(.06, .05, .05); rg.translate(x - .03, y + 1.38, z); P.push({ g: rg, b: 'opaque', c: 0x3A3F42 });
    const ch = new THREE.TorusGeometry(.095, .006, 6, 24); ch.rotateX(Math.PI / 2); ch.translate(x, y + .95, z); P.push({ g: ch, b: 'opaque', c: 0xC9CFD1 });
    { const uv = labelCell({ f: gs.f, c: '', hz: [], grp: null }), lg = new THREE.PlaneGeometry(.09, .045), a = lg.attributes.uv; for (let k = 0; k < a.count; k++) a.setXY(k, uv[0] + a.getX(k) / 8, uv[1] + a.getY(k) / 16); lg.rotateY(-Math.PI / 2); lg.translate(x - .092, y + 1.0, z); P.push({ g: lg, b: 'label' }); }
    const bx = new THREE.Box3(); for (const q of P) { if (q.b === 'opaque') col(q.g, q.c); q.g.computeBoundingBox(); bx.union(q.g.boundingBox); buckets[q.b].push(q.g); } P.length = 0;
    DECOR_PICK.push({ box: bx, info: { type: 'gas', it: gs } }); });
  // The sign opens the cabinet note; the open front remains free so individual bottles can be selected.
  { const bx = new THREE.Box3(V3(ROOM.flam.x - .25, -.29, ROOM.flam.z - .3), V3(ROOM.flam.x - .18, -.15, ROOM.flam.z + .3)); DECOR_PICK.push({ box: bx, info: { type: 'group', key: 'flam', items: D.chem.filter(i => i.grp === 'flam') } }); }
  const mats = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe0df, roughness: .05, transparent: true, opacity: .32, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    amber: new THREE.MeshPhysicalMaterial({ color: 0x7a3d10, roughness: .1, transparent: true, opacity: .7, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    opaque: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .05 }),
    label: new THREE.MeshStandardMaterial({ map: atlasTex, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide }),
    liquid: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .1, transparent: true, opacity: .55, depthWrite: false }),
  };
  const where = new Map();   // source geometry → its vertex range in the merged bucket (so one item can be lifted out later)
  for (const k in buckets) if (buckets[k].length) { let at = 0; const pre = buckets[k].map(g => { const p = prep(g); where.set(g, { b: k, start: at, count: p.attributes.position.count }); at += p.attributes.position.count; return p; });
    const g = mergeGeometries(pre, false); if (!g) continue; g.computeBoundingSphere(); const m = new THREE.Mesh(g, mats[k]); m.renderOrder = k === 'label' ? 4 : k === 'glass' || k === 'amber' ? 3 : k === 'liquid' ? 2 : 0; m.castShadow = k === 'opaque'; scene.add(m); DECOR_MESH[k] = m; }
  for (const d of DECOR_PICK) if (d.info.geos) { d.info.ranges = d.info.geos.map(q => { const r = where.get(q.g); return r && Object.assign({}, r, { role: q.role }); }).filter(Boolean); delete d.info.geos; }
}
/* ===================== ELEMENT CLOSET (front wall) =====================
   A periodic table built as a wall cabinet: one small compartment per element, door labelled with atomic number,
   symbol, name, atomic mass and electron configuration. Tap a door to open it; tap the sample to take it to the bench;
   close the door and the compartment is refilled. Radioactive and synthetic elements stay sealed. */
const PT = { cell: .086, door: .08, x0: -.774, yTop: 1.104, z: -.43, doors: [], samples: [], open: null };
const CATCOL = { am: '#F4C2B5', ae: '#F6DCB0', tm: '#EDE4BF', pt: '#CFE2D6', md: '#D6E6BF', nm: '#CBE5F2', ha: '#BFE6E0', ng: '#DFD2EF', la: '#F2D2E2', ac: '#EEC9C9', un: '#E2E2E2' };
const RADIO = Z => Z === 43 || Z === 61 || Z >= 84;
function ptPos(Z) {
  let c, r;
  if (Z === 1) [c, r] = [1, 1]; else if (Z === 2) [c, r] = [18, 1];
  else if (Z <= 4) [c, r] = [Z - 2, 2]; else if (Z <= 10) [c, r] = [Z + 8, 2];
  else if (Z <= 12) [c, r] = [Z - 10, 3]; else if (Z <= 18) [c, r] = [Z, 3];
  else if (Z <= 36) [c, r] = [Z - 18, 4]; else if (Z <= 54) [c, r] = [Z - 36, 5];
  else if (Z <= 56) [c, r] = [Z - 54, 6]; else if (Z <= 71) [c, r] = [Z - 54, 9]; else if (Z <= 86) [c, r] = [Z - 68, 6];
  else if (Z <= 88) [c, r] = [Z - 86, 7]; else if (Z <= 103) [c, r] = [Z - 86, 10]; else [c, r] = [Z - 100, 7];
  const y = PT.yTop - (r - .5) * PT.cell - (r >= 9 ? .03 - PT.cell : 0);
  return V3(PT.x0 + (c - .5) * PT.cell, y, PT.z);
}
{
  const E = window.ELEMENTS || [];
  // two label atlases of 8 × 8 cells, 256 px each
  const atl = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = c.height = 2048; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { c, t, m: new THREE.MeshBasicMaterial({ map: t }) }; });
  const drawDoors = () => {
    const L = { en: 5, ru: 6, et: 7 }[LANG] ?? 5;
    E.forEach((e, i) => { const A = atl[i >> 6], k = i & 63, cx = (k % 8) * 256, cy = (k >> 3) * 256, g = A.c.getContext('2d'), Z = i + 1;
      g.fillStyle = CATCOL[e[3]]; g.fillRect(cx, cy, 256, 256); g.strokeStyle = '#8f8a7e'; g.lineWidth = 6; g.strokeRect(cx + 3, cy + 3, 250, 250);
      g.fillStyle = '#1b2622'; g.textBaseline = 'alphabetic';
      g.font = '600 30px "IBM Plex Sans", sans-serif'; g.textAlign = 'left'; g.fillText(String(Z), cx + 14, cy + 38);
      g.textAlign = 'right'; g.font = '500 24px "IBM Plex Sans", sans-serif'; g.fillText(e[1], cx + 242, cy + 36);
      g.textAlign = 'center'; g.font = '700 92px "IBM Plex Sans", sans-serif'; g.fillText(e[0], cx + 128, cy + 132);
      let fs = 30; g.font = `500 ${fs}px "IBM Plex Sans", sans-serif`; while (g.measureText(e[L]).width > 232 && fs > 16) { fs -= 2; g.font = `500 ${fs}px "IBM Plex Sans", sans-serif`; } g.fillText(e[L], cx + 128, cy + 178);
      fs = 26; g.font = `500 ${fs}px "IBM Plex Mono", monospace`; while (g.measureText(e[2]).width > 236 && fs > 12) { fs -= 1; g.font = `500 ${fs}px "IBM Plex Mono", monospace`; } g.fillStyle = '#3b4a44'; g.fillText(e[2], cx + 128, cy + 226);
      if (RADIO(Z)) { g.fillStyle = '#E2B714'; g.beginPath(); g.arc(cx + 222, cy + 70, 16, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = '700 22px "IBM Plex Sans", sans-serif'; g.fillText('☢', cx + 222, cy + 78); } });
    for (const A of atl) A.t.needsUpdate = true;
  };
  SIGN.push(drawDoors); drawDoors();
  // carcass: back board and a cubby per element (merged), legend panel
  const parts = [], dark = [];
  const board = new THREE.BoxGeometry(18 * PT.cell + .02, 9 * PT.cell + .05, .012); board.translate(0, PT.yTop - (9 * PT.cell + .05) / 2 + .01, -.494); parts.push(board);
  const cub = (p) => { const s = PT.cell, d = .07; const add = (w, h, dd, x, y, z) => { const b = new THREE.BoxGeometry(w, h, dd); b.translate(p.x + x, p.y + y, -.5 + z); parts.push(b); };
    add(s, .006, d, 0, s / 2 - .003, d / 2); add(s, .006, d, 0, -s / 2 + .003, d / 2); add(.006, s, d, -s / 2 + .003, 0, d / 2); add(.006, s, d, s / 2 - .003, 0, d / 2);
    const bk = new THREE.PlaneGeometry(s - .012, s - .012); bk.translate(p.x, p.y, -.487); dark.push(bk); };
  for (let Z = 1; Z <= E.length; Z++) cub(ptPos(Z));
  const carc = new THREE.Mesh(mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)), new THREE.MeshStandardMaterial({ color: 0xE6E1D6, roughness: .6 })); carc.userData.help = 'ptable'; scene.add(carc);
  const backs = new THREE.Mesh(mergeGeometries(dark), new THREE.MeshStandardMaterial({ color: 0x4A4F52, roughness: .8 })); scene.add(backs);
  // markers for the f-block in rows 6 and 7, column 3; legend in the gap of rows 1–3
  const tag = (txt, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(.07, .03), new THREE.MeshBasicMaterial({ map: canvasTex(256, 110, c => { c.fillStyle = '#ECE7DC'; c.fillRect(0, 0, 256, 110); c.fillStyle = '#55645e'; c.font = '600 54px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.fillText(txt, 128, 74); }) })); m.position.set(x, y, -.47); scene.add(m); };
  tag('57–71', PT.x0 + 2.5 * PT.cell, PT.yTop - 5.5 * PT.cell); tag('89–103', PT.x0 + 2.5 * PT.cell, PT.yTop - 6.5 * PT.cell);
  { const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 360; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10 * PT.cell - .02, 2.2 * PT.cell), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(PT.x0 + 7.5 * PT.cell, PT.yTop - 1.35 * PT.cell, -.488); m.userData.help = 'ptable'; scene.add(m);
    const draw = () => { const g = cv.getContext('2d'); g.fillStyle = '#F7F5EF'; g.fillRect(0, 0, 1600, 360); g.fillStyle = '#1b2622'; g.font = '700 64px "IBM Plex Sans", sans-serif'; g.textAlign = 'left'; g.fillText(T('x.ptTitle'), 30, 80);
      g.font = '500 30px "IBM Plex Sans", sans-serif'; g.fillStyle = '#55645e'; g.fillText(T('x.ptSub'), 30, 128);
      const keys = ['am', 'ae', 'tm', 'pt', 'md', 'nm', 'ha', 'ng', 'la', 'ac'];
      keys.forEach((k, i) => { const x = 30 + (i % 5) * 314, y = 180 + Math.floor(i / 5) * 80; g.fillStyle = CATCOL[k]; g.fillRect(x, y, 50, 50); g.strokeStyle = '#8f8a7e'; g.lineWidth = 3; g.strokeRect(x, y, 50, 50); g.fillStyle = '#1b2622'; g.font = '500 28px "IBM Plex Sans", sans-serif'; g.fillText(T('x.cat_' + k), x + 62, y + 36); });
      tex.needsUpdate = true; };
    SIGN.push(draw); draw(); }
  // doors: hinge on the left edge
  E.forEach((e, i) => { const Z = i + 1, P = ptPos(Z), A = atl[i >> 6], k = i & 63;
    const hinge = new THREE.Group(); hinge.position.set(P.x - PT.door / 2, P.y, PT.z + .002); scene.add(hinge);
    const geo = new THREE.PlaneGeometry(PT.door, PT.door); const uv = geo.attributes.uv; const u0 = (k % 8) / 8, v0 = 1 - ((k >> 3) + 1) / 8; for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / 8, v0 + uv.getY(j) / 8);
    const door = new THREE.Mesh(geo, A.m); door.position.x = PT.door / 2; hinge.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.004, 8, 6), STEEL2); knob.position.set(PT.door - .008, 0, .004); hinge.add(knob);
    const D = { Z, e, hinge, door, ang: 0, target: 0, stocked: true, sample: null };
    const o = { kind: 'button', name: 'door', noTip: true, proxy: door, label: () => e[{ en: 5, ru: 6, et: 7 }[LANG] ?? 5] + ' (' + e[0] + ') — ' + T(D.target ? 'x.ptClose' : 'x.ptOpen') };
    o.tap = () => toggleDoor(D); door.userData.obj = o; door.userData.help = 'ptable'; balButtons.push(door); PT.doors.push(D); });
}
/* sample inside a compartment / on the bench */
const SAMPLE_LOOK = { Cu: 0xB87333, Au: 0xD4AF37, Ag: 0xDCDCDC, Pt: 0xE5E4E2, Pb: 0x7D8086, S: 0xE8D44D, P: 0x9E2B25, C: 0x1E1E1E, I: 0x3A2346, Se: 0x5A5C5E, B: 0x3B3127, Si: 0x6E7681, Bi: 0xC9B8C6, Cs: 0xE6D49A, Ca: 0xD9D9CF, Mg: 0xC8CCD0, Al: 0xC0C4C8, Zn: 0xA9B4BA, Sn: 0xC9CDD1, Fe: 0x8A8F94, Ni: 0xB5B3A8, Co: 0x7F8B9A, Cr: 0xA7B0B8, Ti: 0x9097A0, W: 0x8E9196, Mn: 0x9A9590, As: 0x6C6E70, Sb: 0x9EA3A8, Te: 0x80858A, Ge: 0x7F858B };
const GASCOL = { Cl: 0xC9D86A, F: 0xEDE99A };
/* every element sits in a sealed, labelled glass jar; what is inside depends on the element */
const FORM_OF = (() => { const F = {};
  for (const x of 'Li Na K Rb Cs Sr Ba Eu'.split(' ')) F[x] = 'oil';
  for (const x of 'Hg Br'.split(' ')) F[x] = 'bottle';
  for (const x of 'Fe Cu Ni W Pt Ta Nb'.split(' ')) F[x] = 'wire';
  F.Mg = 'ribbon'; F.I = 'crystals';
  for (const x of 'Zn Al Sn Pb Ca Cd In Tl Mn Co Cr Ti V Zr Hf'.split(' ')) F[x] = 'granules';
  for (const x of 'S P Si B Se As Te Mo Re'.split(' ')) F[x] = 'powder';
  return F; })();
const formOf = e => e[4] === 'g' ? 'gas' : e[4] === 'u' || ELIDX(e) >= 99 ? 'atoms' : FORM_OF[e[0]] || 'lump';
const ELIDX = e => window.ELEMENTS.indexOf(e) + 1;
const GLOW = { Ra: 0x9FE8C8, Ac: 0x9FC8FF, Pm: 0xB8F0A0, Po: 0xA8D0FF, Pu: 0xFFB070, Cm: 0xFFC890, Es: 0xC0E0FF };
const sampleMats = {};
const sMat = (c, metal, rough) => { const k = c + ':' + metal + ':' + rough; return sampleMats[k] || (sampleMats[k] = new THREE.MeshStandardMaterial({ color: c, metalness: metal ? .85 : .05, roughness: rough ?? (metal ? .32 : .85) })); };
const JAR_GLASS = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f2, roughness: .04, transparent: true, opacity: .3, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
const JAR_LABELS = new Set();
function jarLabel(e, Z, r, y, h) {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 160; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => { const c = cv.getContext('2d'); c.fillStyle = '#FBFAF6'; c.fillRect(0, 0, 320, 160); c.fillStyle = CATCOL[e[3]] || '#ddd'; c.fillRect(0, 0, 320, 26);
    c.fillStyle = '#1b2622'; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.font = '600 22px "IBM Plex Mono", monospace'; c.fillText(String(Z), 12, 20); c.textAlign = 'right'; c.fillText(String(e[1]), 308, 20);
    c.textAlign = 'center'; c.font = '700 78px "IBM Plex Sans", sans-serif'; c.fillText(e[0], 160, 104);
    let fs = 30; c.font = `600 ${fs}px "IBM Plex Sans", sans-serif`; while (c.measureText(elName(e)).width > 300 && fs > 16) { fs -= 2; c.font = `600 ${fs}px "IBM Plex Sans", sans-serif`; } c.fillText(elName(e), 160, 145);
    if (RADIO(Z)) { c.fillStyle = '#E2B714'; c.beginPath(); c.arc(286, 74, 22, 0, 7); c.fill(); c.fillStyle = '#111'; c.font = '700 30px "IBM Plex Sans", sans-serif'; c.fillText('☢', 286, 85); }
    c.strokeStyle = '#9C9384'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 317, 157); tex.needsUpdate = true; };
  draw(); JAR_LABELS.add(draw);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r + .0006, r + .0006, h, 32, 1, true, -1.15, 2.3), new THREE.MeshBasicMaterial({ map: tex })); m.position.y = y; m.userData.draw = draw; return m;
}
SIGN.push(() => { for (const f of JAR_LABELS) f(); });
function sampleMesh(e, Z) {
  const g = new THREE.Group(), sym = e[0], form = formOf(e), R = .02, Hj = .05, ri = R - .002;
  const metal = ['am', 'ae', 'tm', 'pt', 'la', 'ac'].includes(e[3]) || sym === 'Ge' || sym === 'Sb';
  const col = SAMPLE_LOOK[sym] ?? (metal ? 0xA8ADB2 : 0x8A8F8C), mat = sMat(col, metal);
  const rnd = (() => { let a = Z * 9301 + 49297; return () => ((a = (a * 233280 + 49297) % 1e9) / 1e9); })();
  const chunk = (s, x, y, z) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat); m.scale.set(1 + rnd() * .5, .7 + rnd() * .4, 1 + rnd() * .4); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (form === 'bottle') {   // narrow-necked bottle with a glass stopper
    const b = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.017, 0], [.018, .003], [.018, .036], [.008, .046], [.007, .056]].map(([x, y]) => V2(x, y)), 28), JAR_GLASS); b.renderOrder = 3; g.add(b);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(.0165, .0165, .016, 24), sym === 'Hg' ? sMat(0xD3D7DA, true, .08) : new THREE.MeshStandardMaterial({ color: 0x6E1A0C, roughness: .2, transparent: true, opacity: .9 })); liq.position.y = .0095; g.add(liq);
    if (sym === 'Br') { const vap = new THREE.Mesh(new THREE.CylinderGeometry(.0165, .0165, .02, 24), new THREE.MeshBasicMaterial({ color: 0xC2541E, transparent: true, opacity: .28, depthWrite: false })); vap.position.y = .028; g.add(vap); }
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.009, .006, .012, 16), JAR_GLASS); st.position.y = .06; g.add(st); g.userData.lid = st;
    g.add(jarLabel(e, Z, .0181, .026, .02));
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hj, 28, 1, true), JAR_GLASS); body.position.y = Hj / 2; body.renderOrder = 3; g.add(body);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(R, 28), JAR_GLASS); bot.rotation.x = -Math.PI / 2; bot.position.y = .001; g.add(bot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(R + .0012, R + .0012, .011, 28), form === 'gas' ? STEEL2 : MAT.black); lid.position.y = Hj + .005; lid.castShadow = true; g.add(lid); g.userData.lid = lid;
    if (form === 'gas') { if (GASCOL[sym]) { const gas = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, Hj - .004, 24), new THREE.MeshBasicMaterial({ color: GASCOL[sym], transparent: true, opacity: .32, depthWrite: false })); gas.position.y = Hj / 2; g.add(gas); } }
    else if (form === 'oil') { const oil = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, .032, 24), new THREE.MeshPhysicalMaterial({ color: 0xF3E3A0, roughness: .1, transparent: true, opacity: .35, depthWrite: false })); oil.position.y = .017; oil.renderOrder = 2; g.add(oil);
      for (let i = 0; i < 3; i++) chunk(.0055, (rnd() - .5) * .018, .006, (rnd() - .5) * .018); }
    else if (form === 'powder') { const p = new THREE.Mesh(new THREE.CylinderGeometry(ri * .97, ri, .012, 24), sMat(col, false, .95)); p.position.y = .007; g.add(p); const c = new THREE.Mesh(new THREE.ConeGeometry(ri * .97, .006, 24), sMat(col, false, .95)); c.position.y = .016; g.add(c); }
    else if (form === 'granules') { const n = 36; const geo = new THREE.DodecahedronGeometry(.0028, 0); const im = new THREE.InstancedMesh(geo, mat, n); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * (ri - .003); M.compose(V3(Math.sin(a) * rr, .003 + Math.floor(i / 14) * .004 + rnd() * .002, Math.cos(a) * rr), Q.setFromEuler(E.set(rnd() * 3, rnd() * 3, rnd() * 3)), V3(1 + rnd() * .5, .8, 1)); im.setMatrixAt(i, M); } g.add(im); }
    else if (form === 'wire' || form === 'ribbon') { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * 6.283 * 5; pts.push(V3(Math.sin(a) * ri * .62, .006 + t * .024, Math.cos(a) * ri * .62)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, form === 'wire' ? .0011 : .0008, 6), mat); if (form === 'ribbon') tube.scale.set(1, 1.6, 1); g.add(tube); }
    else if (form === 'crystals') { for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.006 + rnd() * .004, .0012, .004 + rnd() * .003), sMat(0x3A2346, true, .25)); m.position.set((rnd() - .5) * .026, .003 + rnd() * .006, (rnd() - .5) * .026); m.rotation.set(rnd() - .5, rnd() * 3, rnd() - .5); g.add(m); } }
    else if (form === 'atoms') { const sp = new THREE.Mesh(new THREE.SphereGeometry(.0012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xBFF3FF })); sp.position.y = .02; g.add(sp);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(.005, 14, 10), new THREE.MeshBasicMaterial({ color: 0x7FDFFF, transparent: true, opacity: .25, depthWrite: false })); halo.position.y = .02; g.add(halo); }
    else { const n = sym === 'C' ? 3 : 1 + Math.floor(rnd() * 2); for (let i = 0; i < n; i++) chunk(n === 1 ? .0095 : .0065, n === 1 ? 0 : (rnd() - .5) * .016, n === 1 ? .009 : .006, n === 1 ? 0 : (rnd() - .5) * .016);
      if (GLOW[sym]) { const halo = new THREE.Mesh(new THREE.SphereGeometry(.014, 16, 10), new THREE.MeshBasicMaterial({ color: GLOW[sym], transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = .01; g.add(halo); } }
    { const content = new THREE.Group(); const keep = new Set([body, bot, lid]); for (const ch of [...g.children]) if (!keep.has(ch)) content.add(ch); g.add(content); g.userData.content = content; }
    g.add(jarLabel(e, Z, R, .033, .024));
  }
  const L = g.userData.lid; L.userData.y0 = L.position.y; return g;
}
/* jars on the bench: tap to take the lid off (it is laid upside down beside the jar), tap again to close.
   Gases, mercury and bromine stay sealed: their vapours are handled only in the fume cupboard. */
const jarSealed = e => e[4] === 'g' || e[0] === 'Hg' || e[0] === 'Br';
function placeLid(S) { // lay the lid where there is room: right, left, front or back
  const circ = obstacles(S), h = S.home, A = areaRect(S), d = (S.R || .02) + .028, off = [[d, 0], [-d, 0], [0, d], [0, -d]].find(([dx, dz]) => { const x = h.x + dx, z = h.z + dz; return x > A[0] && x < A[1] && z > A[2] && z < A[3] && circ.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + .023); }) || [d, 0];
  S.lidHome = V3(h.x + off[0], .008, h.z + off[1]); }
function toggleBottle(S) {
  if (S.held || S.docked) return;
  S.open = !S.open; buzz(8); if (S.open) placeLid(S);
  analyticsActivity((S.open ? 'open:' : 'close:') + 'bottle:' + S.id);
  logE('info', [[S.open ? 'x.jarOpened' : 'x.jarClosed', { n: T(REAG[S.id].name) }]]);
}
function toggleJar(S) {
  if (jarSealed(S.e)) { S.open = false; return 'x.jarSealed'; }
  S.open = !S.open; buzz(8);
  if (S.open) placeLid(S);
  logE('info', [[S.open ? 'x.jarOpened' : 'x.jarClosed', { n: elName(S.e) + ' (' + S.e[0] + ')' }]]);
  return S.open ? 'x.jarIsOpen' : 'x.jarIsClosed';
}
/* ---- element pieces in a vessel, and the simple reactions they show ----
   Alkali and alkaline-earth metals react with water (hydrogen bubbles, the solution turns alkaline, it warms up);
   reactive metals dissolve in acid (hydrogen bubbles, the acid is used up). Others just lie at the bottom. */
Object.assign(METALS, { Mg: { z: 2, koh: 5.6e-12, oh: 'MgOH2' }, Zn: { z: 2, koh: 3e-17, oh: 'ZnOH2' }, Al: { z: 3, koh: 1.3e-33, oh: 'AlOH3' }, Mn: { z: 2, koh: 2e-13, oh: 'MnOH2' },
  Ni: { z: 2, koh: 5.5e-16, oh: 'NiOH2' }, Co: { z: 2, koh: 1e-15, oh: 'CoOH2' }, Cd: { z: 2, koh: 7.2e-15, oh: 'CdOH2' }, Sn: { z: 2, koh: 5e-26, oh: 'SnOH2' } });
Object.assign(PPT, { MgOH2: ['white', '#F4F4F0'], ZnOH2: ['white', '#F2F2EE'], AlOH3: ['white', '#F1F2F0'], MnOH2: ['white', '#EADBD2'], NiOH2: ['green', '#9CC48A'], CoOH2: ['pink', '#C98FA8'], CdOH2: ['white', '#F2F2EE'], SnOH2: ['white', '#F0F0EC'] });
const WATERRX = { Li: .02, Na: .06, K: .12, Rb: .15, Cs: .2, Ca: .006, Sr: .008, Ba: .01 };
const ACIDRX = { Mg: .03, Zn: .012, Fe: .005, Al: .006, Mn: .02, Ni: .002, Co: .002, Cd: .004, Sn: .002, Ca: .03, Sr: .03, Ba: .03, Li: .05, Na: .08, K: .12, Rb: .15, Cs: .2 };
const ION = { Li: 'Na', Na: 'Na', K: 'K', Rb: 'K', Cs: 'K', Sr: 'Ca', Fe: 'Fe2' };
const FLOATS = { Li: 1, Na: 1, K: 1 };
function clearPieces(v) { if (v.metal) for (const p of v.metal) { v.g.remove(p.mesh); p.mesh.geometry.dispose(); } v.metal = []; }
function landPiece(p) {
  const v = p.v; if (!v.metal) v.metal = []; if (!v.rxLog) v.rxLog = new Set();
  if (v.metal.length >= 50) { const q = v.metal[Math.floor(Math.random() * v.metal.length)]; q.m += p.m; q.m0 += p.m; scene.remove(p.mesh); return; }
  v.g.updateMatrixWorld(); v.g.attach(p.mesh); const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * v.Ri * .75;
  p.mesh.position.set(Math.sin(a) * r, v.b + p.sz * .7, Math.cos(a) * r);
  v.metal.push({ sym: p.sym, e: p.e, cmp: p.cmp, m: p.m, m0: p.m, mesh: p.mesh, sz: p.sz, ang: a, r }); v.eqDirty = true;
}
function updateMetals(dt) {
  for (let i = ELP.length - 1; i >= 0; i--) { const p = ELP[i], v = p.v; p.vy -= 9.8 * dt; p.mesh.position.y += p.vy * dt; p.mesh.rotation.x += dt * 4;
    const vc = v.g.position; if (p.mesh.position.y <= vc.y + v.b + p.sz) { ELP.splice(i, 1); if (!v.held && !v.stowed) landPiece(p); else scene.remove(p.mesh); } }
  for (const v of vessels) { if (!v.metal || !v.metal.length) continue;
    const wet = v.chem.V > .5, H = wet ? Math.pow(10, -((v.chem.eq && v.chem.eq.pH) ?? 7)) : 0, lv = levelOf(v);
    for (let k = v.metal.length - 1; k >= 0; k--) { const p = v.metal[k];
      if (!wet) { p.mesh.position.y += (v.b + p.sz * .7 - p.mesh.position.y) * .2; continue; }
      const C = p.cmp, rate = C ? (C.water || 0) + (C.acid || 0) * Math.min(1, H / .1) : (WATERRX[p.sym] || 0) + (ACIDRX[p.sym] || 0) * Math.min(1, H / .1);
      const key = (C ? C.f : p.sym) + (rate > 1e-5 ? ':rx' : ':none');
      if (!v.rxLog.has(key)) { v.rxLog.add(key); const n = C ? C.f : elName(p.e);
        const msg = rate <= 1e-5 ? 'x.rxNone' : C ? (C.msg && H > 1e-4 ? C.msg : C.water ? 'x.dissolves' : 'x.rxAcid') : (WATERRX[p.sym] && H < 1e-3 ? 'x.rxWater' : 'x.rxAcid');
        logE(rate > 1e-5 ? 'success' : 'info', [[msg, { n, v: v.letter }]]); }
      if (C) { if (rate <= 1e-5) continue; const dm = Math.min(p.m, rate * dt); p.m -= dm; const mmol = dm / (C.M || 100) * 1000; for (const k in C.tot) v.chem.tot[k] = (v.chem.tot[k] || 0) + C.tot[k] * mmol;
        { const e = excessOf(C.tot) * mmol; if (e > 0) v.chem.acidEq = (v.chem.acidEq || 0) + e; else v.chem.baseEq = (v.chem.baseEq || 0) - e; }
        v.eqDirty = true; p.mesh.scale.setScalar(Math.max(.05, Math.cbrt(Math.max(p.m, 0) / p.m0))); if (p.m <= 1e-4) { v.g.remove(p.mesh); p.mesh.geometry.dispose(); v.metal.splice(k, 1); } continue; }
      if (FLOATS[p.sym]) { p.ang += dt * 2.5; const rr = v.Ri * .55; p.mesh.position.set(Math.sin(p.ang) * rr, lv - p.sz * .2, Math.cos(p.ang) * rr); }
      if (rate <= 1e-5) continue;
      const dm = Math.min(p.m, rate * dt); p.m -= dm; const Ar = +p.e[1] || 50, mmol = dm / Ar * 1000, ion = ION[p.sym] || p.sym, z = (METALS[ion] && METALS[ion].z) || 1;
      v.chem.tot[ion] = (v.chem.tot[ion] || 0) + mmol; v.gas += mmol * z * .5 * .1; v.temp += mmol * (WATERRX[p.sym] ? 184 : 150) / (v.chem.V * 4.18); v.rxHot = true; v.eqDirty = true;
      const f = Math.cbrt(Math.max(p.m, 0) / p.m0); p.mesh.scale.setScalar(Math.max(.05, f));
      if (p.m <= 1e-4) { v.g.remove(p.mesh); p.mesh.geometry.dispose(); v.metal.splice(k, 1); }
    } }
}
/* the lid is a separate object in the room: on the jar it moves with the jar; taken off, it stays where it was put */
function animLid(S, dt) {
  const L = S.lid; if (!L) return;
  S.lidT = (S.lidT || 0) + ((S.open ? 1 : 0) - (S.lidT || 0)) * (1 - Math.exp(-dt * 9)); const t = S.lidT;
  S.g.updateMatrixWorld(); const top = (L.userData.off ? L.userData.off.clone() : V3(0, L.userData.y0, 0)).applyMatrix4(S.g.matrixWorld);
  if (t < .002) { L.position.copy(top); L.quaternion.copy(S.g.quaternion); return; }
  const off = S.lidHome || top; L.position.lerpVectors(top, off, t); L.position.y += Math.sin(t * Math.PI) * .03; L.quaternion.setFromEuler(new THREE.Euler(t * Math.PI, 0, 0));
}
/* pouring: carry an open jar over a beaker or tube and drag down to tilt it; past ~70° the contents slide out */
const ELP = [];   // falling element pieces
const PIECE = { granules: [.0028, .25], powder: [.0016, .15], lump: [.0075, 2.5], wire: [.0055, 2], ribbon: [.005, 1.2], crystals: [.003, .3], oil: [.004, .3], atoms: [.0012, 0] };
function pourJar(S, tg, dt) {
  const v = tg.v, vc = v.g.position, dir = S.pz && S.pz.v === v ? S.pz.dir : V3(ptr.x - vc.x, 0, ptr.z - vc.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
  if (!S.pz || S.pz.v !== v) S.pz = { v, y0: scr.y, x0: scr.x, acc: 0, dir: dir.clone() };
  const th = clamp((scr.y - S.pz.y0) / 120, 0, 1) * 2.1;
  const q = new THREE.Quaternion().setFromAxisAngle(V3(-dir.z, 0, dir.x), th);
  const mouth = V3(vc.x + dir.x * v.Ri * .3, rimY(v) + .02, vc.z + dir.z * v.Ri * .3);
  const pos = mouth.clone().sub(V3(0, .05, 0).applyQuaternion(q));
  S.g.position.lerp(pos, 1 - Math.exp(-dt * 12)); S.g.quaternion.slerp(q, 1 - Math.exp(-dt * 12));
  const form = formOf(S.e), [sz, pm] = PIECE[form] || PIECE.lump;
  if (th > 1.2 && S.left > 0) {
    S.pz.acc += dt * (th - 1.1) * 6;
    while (S.pz.acc >= 1 && S.left > 0) { S.pz.acc -= 1;
      const m = Math.min(S.left, pm || .001); S.left -= m;
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), form === 'atoms' ? new THREE.MeshBasicMaterial({ color: 0xBFF3FF }) : S.mat); mesh.castShadow = true;
      mesh.position.copy(mouth).add(V3((Math.random() - .5) * .006, -.004, (Math.random() - .5) * .006)); mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(mesh);
      ELP.push({ mesh, v, vy: -.1, sym: S.e[0], e: S.e, m, sz });
      if (!S.pz.logged) { S.pz.logged = true; analyticsActivity('solid:' + S.e[0], 1, 0, 'solid:transferred'); logE('info', [['x.jarPoured', { n: elName(S.e), v: v.letter }]]); }
    }
    const c = S.g.userData.content; if (c) { const f = S.left / S.full; c.scale.y = Math.max(.05, f); c.visible = f > .01; }
    if (S.left <= 0 && !S.emptyLogged) { S.emptyLogged = true; logE('info', [['x.jarEmpty', { n: elName(S.e) }]]); }
  }
}
function cornerNote(title, lines, wp, actions) {
  const r = stage.getBoundingClientRect(), p = wp.clone().project(camera), left = p.x > 0;
  showNoteRaw(title, lines, left ? 12 : r.width - 12, r.height - 12, actions);
}
function toggleDoor(D) {
  if (D.target) { D.target = 0; if (!D.sample) { D.stocked = true; } PT.open = null; if (D.back) { removeButton(D.back); D.back = null; } return; }
  if (!D.back) { const b = new THREE.Mesh(new THREE.PlaneGeometry(PT.cell - .01, PT.cell - .01), new THREE.MeshBasicMaterial({ visible: false })); const P0 = ptPos(D.Z); b.position.set(P0.x, P0.y, -.486); scene.add(b); const o = { kind: 'button', name: 'cell', noTip: true, proxy: b, label: () => elName(D.e) + ' — ' + T('x.ptClose') }; o.tap = () => toggleDoor(D); b.userData.obj = o; balButtons.push(b); D.back = b; refreshPickables(); }
  for (const o of PT.doors) if (o !== D && o.target) toggleDoor(o);
  D.target = 1; PT.open = D;
  if (D.stocked && !D.sample) {
    const m = sampleMesh(D.e, D.Z), P = ptPos(D.Z); m.position.set(P.x, P.y - PT.cell / 2 + .006, -.465); scene.add(m);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .06), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = .03; m.add(proxy);
    const o = { kind: 'button', name: 'cubby', noTip: true, proxy, label: () => elName(D.e) + ' — ' + T('x.ptTake') }; o.tap = () => takeSample(D); proxy.userData.obj = o; balButtons.push(proxy); refreshPickables();
    D.sample = { m, proxy };
  }
  const r = stage.getBoundingClientRect(), p = ptPos(D.Z).clone().project(camera), left = p.x > 0;
  showNoteRaw(elName(D.e) + ' (' + D.e[0] + ')', [T('x.ptZ', { z: D.Z, m: D.e[1] }), T('x.ptCfg', { c: D.e[2] }), T('x.cat_' + D.e[3]) + ' · ' + T('x.st_' + D.e[4]), ...(RADIO(D.Z) ? [T('x.ptRadioSafe')] : []), T(D.sample ? 'x.ptTake' : 'x.ptEmpty')], left ? 12 : r.width - 12, r.height - 12);
}
const elName = e => e[{ en: 5, ru: 6, et: 7 }[LANG] ?? 5];
function removeButton(proxy) { const i = balButtons.indexOf(proxy); if (i >= 0) balButtons.splice(i, 1); refreshPickables(); }
function takeSample(D) {
  if (!D.sample) return;
  if (PT.samples.length >= 16) { showMsg(T('x.ptTooMany')); return; }
  const { m, proxy } = D.sample; removeButton(proxy); m.remove(proxy); D.sample = null; D.stocked = false;
  const home = findSpot(null, .12 + (Math.random() - .5) * .2, .06, .03);
  const big = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .07, 10), new THREE.MeshBasicMaterial({ visible: false })); big.position.y = .03; m.add(big);
  m.updateMatrixWorld(); const S = { kind: 'sample', D, e: D.e, g: m, proxy: big, home: V3(home.x, 0, home.z), held: false, open: false, onBal: false, noTip: true, label: () => elName(D.e) + ' (' + D.e[0] + ')' };
  { const form = formOf(D.e), metal = ['am', 'ae', 'tm', 'pt', 'la', 'ac'].includes(D.e[3]); S.full = S.left = form === 'atoms' ? 1e-6 : form === 'oil' ? 1.2 : form === 'lump' ? 6 : 10;
    S.mat = sMat(SAMPLE_LOOK[D.e[0]] ?? (metal ? 0xA8ADB2 : 0x8A8F8C), metal || D.e[0] === 'Ge' || D.e[0] === 'Sb'); }
  { const L = m.userData.lid; if (L) { m.updateMatrixWorld(); const wp = L.getWorldPosition(V3()); m.remove(L); L.position.copy(wp); scene.add(L); S.lid = L;
      const lp = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .02, 10), new THREE.MeshBasicMaterial({ visible: false })); L.add(lp);
      const lo = { kind: 'button', name: 'lid', noTip: true, proxy: lp, label: () => '' }; lo.tap = () => { if (S.open) sampleInfo(S); }; lp.userData.obj = lo; balButtons.push(lp); S.lidProxy = lp; } }
  S.tap = () => sampleInfo(S); big.userData.obj = S; PT.samples.push(S); refreshPickables(); flyArc(S, S.home); showManual('element');
  logE('info', [['x.took', { n: elName(D.e) + ' (' + D.e[0] + ')' }]]);
}
function sampleInfo(S) {
  const D = S.D, st = toggleJar(S);
  cornerNote(elName(D.e) + ' (' + D.e[0] + ')', [T('x.ptZ', { z: D.Z, m: D.e[1] }), T('x.ptCfg', { c: D.e[2] }), T('x.cat_' + D.e[3]) + ' · ' + T('x.st_' + D.e[4]), T('x.form_' + formOf(D.e)), T(st)], S.g.position, [[T(S.area === 'hood' ? 'x.toBench' : 'x.toHood'), () => moveArea(S, S.area === 'hood' ? 'bench' : 'hood')]]);
}
function returnSample(S) {
  scene.remove(S.g); PT.samples.splice(PT.samples.indexOf(S), 1); refreshPickables();
  logE('info', [['x.putBack', { n: elName(S.e) + ' (' + S.e[0] + ')' }]]);
}
function updateElements(dt) {
  for (const D of PT.doors) { if (Math.abs(D.ang - D.target) > .001) { D.ang += (D.target - D.ang) * (1 - Math.exp(-dt * 10)); D.hinge.rotation.y = -1.75 * D.ang; }
    if (!D.target && D.ang < .05 && D.sample) { const { m, proxy } = D.sample; removeButton(proxy); scene.remove(m); m.traverse(q => { if (q.userData.draw) JAR_LABELS.delete(q.userData.draw); }); D.sample = null; D.stocked = true; } }
  for (const S of PT.samples) {
    let tg = S.held && ptrOK && S.open && S.left > 0 ? findTarget(S) : null;
    // once lined up over a vessel, dragging down tilts the jar there; dragging up or sideways moves it away again
    if (S.held && S.pz && S.open && Math.abs(scr.x - S.pz.x0) < 90 && scr.y > S.pz.y0 - 40) tg = { kind: 'vessel', v: S.pz.v };
    if (S.fly) { flyStep(S, dt); animLid(S, dt); continue; }
    if (S.held && S.open && S.left > 0 && !tg) { const lamp = PROPS.find(p => p.lamp && p.lamp.lit && Math.hypot(p.g.position.x - S.g.position.x, p.g.position.z - S.g.position.z) < .08); if (lamp) { S.burnT = (S.burnT || 0) + dt; if (S.burnT > .8) { S.burnT = 0; burnInFlame(S, lamp); } } }
    if (tg && tg.kind === 'vessel') pourJar(S, tg, dt);
    else { S.pz = null; S.g.quaternion.slerp(QI, 1 - Math.exp(-dt * 12));
      if (S.held && ptrOK) S.g.position.lerp(V3(ptr.x, .07, ptr.z), 1 - Math.exp(-dt * 14)); else S.g.position.lerp(S.home, 1 - Math.exp(-dt * 8)); }
    animLid(S, dt);
  }
}

/* ---- any closet item can be taken: its vertices are copied out of the merged shelf mesh into a mesh of its own,
   and collapsed on the shelf until it is put back. On the bench it can be carried, set down and tapped to return. ---- */
const PROP_MAX = 12;
function takeProp(d) {
  const I = d.info; if (I.taken || !I.ranges || !I.ranges.length) return false;
  if (PROPS.length >= PROP_MAX) { showMsg(T('x.propTooMany')); return false; }
  const grp = new THREE.Group(), bb = new THREE.Box3(), geos = [];
  for (const r of I.ranges) {
    const src = DECOR_MESH[r.b].geometry, g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'color']) { const a = src.attributes[k]; if (a) g.setAttribute(k, new THREE.BufferAttribute(a.array.slice(r.start * a.itemSize, (r.start + r.count) * a.itemSize), a.itemSize)); }
    g.computeBoundingBox(); bb.union(g.boundingBox); geos.push([g, r]);
    const pa = src.attributes.position; r.saved = pa.array.slice(r.start * 3, (r.start + r.count) * 3);
    for (let i = 0; i < r.count; i++) pa.setXYZ(r.start + i, 0, -50, 0); pa.needsUpdate = true;
  }
  const c = bb.getCenter(V3());
  const capH = I.type !== 'chem' && I.it.k === 'lamp' ? .021 : 0, H0 = bb.max.y - bb.min.y, capParts = [];
  for (const [g0, r] of geos) { let g = g0; g.translate(-c.x, -bb.min.y, -c.z); g.rotateY(-(I.ry || 0));
    if (r.role === 'cap') { capParts.push([g, r.b]); continue; }
    if (capH && (r.b === 'opaque' || r.b === 'amber')) {   // legacy display items: triangles above the shoulder belong to the cap
      const pa = g.attributes.position, keep = [], cap = [];
      for (let i = 0; i < pa.count; i += 3) ((pa.getY(i) + pa.getY(i + 1) + pa.getY(i + 2)) / 3 > H0 - capH ? cap : keep).push(i);
      if (cap.length && keep.length) { const sub = idx => { const ng = new THREE.BufferGeometry(); for (const k in g.attributes) { const a = g.attributes[k], n = a.itemSize, arr = new a.array.constructor(idx.length * 3 * n); idx.forEach((i, j) => { for (let q = 0; q < 3 * n; q++) arr[j * 3 * n + q] = a.array[i * n + q]; }); ng.setAttribute(k, new THREE.BufferAttribute(arr, n)); } return ng; };
        capParts.push([sub(cap), r.b]); g = sub(keep); }
      else if (cap.length && !keep.length) { capParts.push([g, r.b]); continue; } }
    g.computeBoundingSphere(); const m = new THREE.Mesh(g, DECOR_MESH[r.b].material); m.userData.b = r.b; m.renderOrder = DECOR_MESH[r.b].renderOrder; m.castShadow = r.b === 'opaque'; grp.add(m); }
  const lb = new THREE.Box3().setFromObject(grp), sz = lb.getSize(V3());
  const R = clamp(.5 * Math.max(sz.x, sz.z), .03, .16);
  const px = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sz.x, .06), Math.max(sz.y, .06), Math.max(sz.z, .06)), new THREE.MeshBasicMaterial({ visible: false })); px.position.y = Math.max(sz.y, .06) / 2; grp.add(px);
  const home = findSpot(null, -.05 + (Math.random() - .5) * .3, .12, R);
  grp.position.set(c.x, bb.min.y, c.z); grp.quaternion.setFromAxisAngle(V3(0, 1, 0), I.ry || 0); grp.rotation.y = I.ry || 0; grp.userData.spin = I.ry || 0; scene.add(grp);
  const L = { en: 0, ru: 1, et: 2 }[LANG] ?? 0, nm = () => I.it.n[{ en: 0, ru: 1, et: 2 }[LANG] ?? 0] || I.it.n[0];
  const S = { kind: 'prop', d, g: grp, proxy: px, R, home: V3(home.x, 0, home.z), held: false, noTip: true, label: () => nm(), H: sz.y, shelf: grp.position.clone() };
  if (capParts.length) { const lid = new THREE.Group(); const cb = new THREE.Box3(); for (const [g] of capParts) { g.computeBoundingBox(); cb.union(g.boundingBox); }
    const cc = cb.getCenter(V3()); for (const [g, b] of capParts) { g.translate(-cc.x, -cc.y, -cc.z); g.computeBoundingSphere(); const m = new THREE.Mesh(g, DECOR_MESH[b].material); m.castShadow = true; lid.add(m); }
    lid.userData.off = cc.clone(); scene.add(lid); S.lid = lid;
    const lp = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .05), new THREE.MeshBasicMaterial({ visible: false })); lid.add(lp);
    const lo = { kind: 'button', name: 'lid', noTip: true, proxy: lp, label: () => '' }; lo.tap = () => { if (S.open) toggleProp(S); }; lp.userData.obj = lo; balButtons.push(lp); S.lidProxy = lp; }
  if (I.type === 'chem') { S.chem = chemOfProp(I.it); S.left = S.full = S.chem.left; }
  propSetup(S);
  S.tap = () => S.lid && S.chem ? toggleProp(S) : propInfo(S); px.userData.obj = S; I.taken = S; PROPS.push(S); refreshPickables(); flyArc(S, S.home);
  analyticsActivity('take:' + I.it.k); logE('info', [['x.took', { n: nm() }]]); buzz(10);
  return true;
}
function toggleProp(S) { if (!S.lid) return; S.open = !S.open; buzz(8); if (S.open) placeLid(S); else if (S.onClose) S.onClose(); propInfo(S, true); }
function propInfo(S, quiet) {
  const I = S.d.info, L = { en: 0, ru: 1, et: 2 }[LANG] ?? 0, it = I.it, nm = it.n[L] || it.n[0];
  const lines = I.type === 'chem' ? [it.f + (it.c && it.c !== 's' ? ' · ' + it.c : '') + ' · ' + T(LVL[it.lv]), (it.hz.length ? it.hz.map(h => T('x.hz_' + h)).join(', ') : T('x.hz_none'))] : [(it.sz ? it.sz + ' · ' : '') + T(LVL[it.lv])];
  if (S.chem) { lines.push(T(S.open ? 'x.propOpen' : 'x.propClosed')); if (!S.chem.known && S.chem.kind !== 'el') lines.push(T('x.propInert')); if (S.left <= 0) lines.push(T('x.propEmptyNow')); }
  else lines.push(T(S.area === 'hood' ? 'x.propInHood' : 'x.propOnBench'));
  const acts = []; if (S.lid) acts.push([T(S.open ? 'x.close' : 'x.open'), () => toggleProp(S)]);
  if (S.actions) acts.push(...S.actions());
  acts.push([T(S.area === 'hood' ? 'x.toBench' : 'x.toHood'), () => moveArea(S, S.area === 'hood' ? 'bench' : 'hood')]);
  acts.push([T('x.propPutBack'), () => returnProp(S)]);
  cornerNote(nm, lines, S.g.position, acts); if (!quiet) showManual(manualOfProp(S));
}
function returnProp(S, now) {
  if (!now) { if (S.lamp && S.lamp.lit) { showMsg(T('x.lampLitBack')); return; } if (S.held || S.fly) return; S.open = false; flyArc(S, S.shelf, () => returnProp(S, true)); S.home = S.shelf.clone(); return; }
  const I = S.d.info; if (S.lid) { scene.remove(S.lid); removeButton(S.lidProxy); } if (S.extra) S.extra(); scene.remove(S.g); S.g.traverse(m => { if (m.geometry) m.geometry.dispose(); });
  for (const r of I.ranges) { const pa = DECOR_MESH[r.b].geometry.attributes.position; pa.array.set(r.saved, r.start * 3); pa.needsUpdate = true; r.saved = null; }
  I.taken = null; PROPS.splice(PROPS.indexOf(S), 1); refreshPickables();
  analyticsActivity('return:' + I.it.k); logE('info', [['x.putBack', { n: I.it.n[{ en: 0, ru: 1, et: 2 }[LANG] ?? 0] || I.it.n[0] }]]);
}
function flyArc(S, to, done) {
  const a = S.g.position.clone(), b = to.clone(), c = a.clone().lerp(b, .5).lerp(camera.position, .22); c.y = Math.max(a.y, b.y) + .28;
  S.fly = { a, b, c, t: 0, dur: clamp(a.distanceTo(b) * .5, .55, 1.6), done };
}
function flyStep(S, dt) {
  const F = S.fly; F.t = Math.min(1, F.t + dt / F.dur); const t = F.t * F.t * (3 - 2 * F.t), u = 1 - t;
  S.g.position.set(u * u * F.a.x + 2 * u * t * F.c.x + t * t * F.b.x, u * u * F.a.y + 2 * u * t * F.c.y + t * t * F.b.y, u * u * F.a.z + 2 * u * t * F.c.z + t * t * F.b.z);
  S.g.quaternion.slerp(QI, Math.min(1, dt * 6)); if (F.t >= 1) { S.fly = null; if (F.done) F.done(); }
}
const nameOf = S => S.kind === 'sample' ? elName(S.e) : S.label();
function moveArea(S, area) {
  if (S.lamp && S.lamp.lit) { showMsg(T('x.lampLitMove')); return; }
  S.area = area; const A = AREAS[area]; const q = findSpot(S, (A[0] + A[1]) / 2 + (Math.random() - .5) * .4, area === 'hood' ? 2.85 : .12, S.R || .03);
  S.home.set(q.x, 0, q.z); if (S.open && S.lid) { S.open = false; S.lidT = 0; } flyArc(S, S.home);
  if (area === 'hood') { if (HOOD.sashT < 1) HOOD.sashT = 1; flyTo(V3(clamp(q.x, -.4, .4), .08, 2.86), V3(clamp(q.x, -.4, .4), .42, 2.2)); } else goPlace(PLACES[1][1]);
  logE('info', [[area === 'hood' ? 'x.movedHood' : 'x.movedBench', { n: nameOf(S) }]]);
}
/* closet items on the bench; open containers pour when tilted over a beaker */
function poseOver(S, tg, dt, mouthH) {
  const v = tg.v, vc = v.g.position, dir = S.pz && S.pz.v === v ? S.pz.dir : V3(ptr.x - vc.x, 0, ptr.z - vc.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
  if (!S.pz || S.pz.v !== v) S.pz = { v, y0: scr.y, x0: scr.x, acc: 0, dir: dir.clone() };
  const th = clamp((scr.y - S.pz.y0) / 120, 0, 1) * 2.1, q = new THREE.Quaternion().setFromAxisAngle(V3(-dir.z, 0, dir.x), th);
  const mouth = V3(vc.x + dir.x * v.Ri * .3, rimY(v) + .02, vc.z + dir.z * v.Ri * .3);
  S.g.position.lerp(mouth.clone().sub(V3(0, mouthH, 0).applyQuaternion(q)), 1 - Math.exp(-dt * 12)); S.g.quaternion.slerp(q, 1 - Math.exp(-dt * 12));
  return { th, mouth, v };
}
const SOLIDCOL = { 'CuSO₄·5H₂O': 0x3C8CE0, 'FeSO₄·7H₂O': 0xA8D8A0, 'MnO₂': 0x2A2A2A, 'CaCO₃': 0xF4F2EC };
function pourProp(S, tg, dt) {
  const { th, mouth, v } = poseOver(S, tg, dt, S.H), C = S.chem, it = S.d.info.it;
  if (th <= 1.2 || S.left <= 0) return;
  if (C.kind === 'liquid') { S.pz.acc += dt * (th - 1.1) * 30;
    while (S.pz.acc >= 1 && S.left > 0) { S.pz.acc -= 1; S.left -= .05; spawnDrop(mouth.clone().add(V3((Math.random() - .5) * .003, -.003, (Math.random() - .5) * .003)), C.comp, v); } }
  else { S.pz.acc += dt * (th - 1.1) * 5;
    while (S.pz.acc >= 1 && S.left > 0) { S.pz.acc -= 1;
      if (C.kind === 'el') { const form = formOf(C.e), [sz, pm] = PIECE[form] || PIECE.lump, m = Math.min(S.left, pm); S.left -= m; const metal = ['am', 'ae', 'tm', 'pt'].includes(C.e[3]);
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), sMat(SAMPLE_LOOK[C.e[0]] ?? 0xA8ADB2, metal)); mesh.position.copy(mouth); scene.add(mesh); ELP.push({ mesh, v, vy: -.1, sym: C.e[0], e: C.e, m, sz }); }
      else { const big = it.f === 'CaCO₃', sz = big ? .005 : .0022, m = Math.min(S.left, big ? 1 : .3); S.left -= m;
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), sMat(SOLIDCOL[it.f] ?? 0xF4F4F0, false)); mesh.position.copy(mouth); scene.add(mesh); ELP.push({ mesh, v, vy: -.1, cmp: { ...C.d, f: it.f }, m, sz }); } } }
  if (!S.pz.logged) { S.pz.logged = true; analyticsActivity('solid:' + it.f.replace(/[^a-z0-9_.+-]/gi, '_'), 1, 0, 'solid:transferred'); logE('info', [['x.jarPoured', { n: it.f, v: v.letter }]]); }
  const f = Math.max(0, S.left / S.full); S.g.traverse(m => { if (m.userData.b === 'liquid') { m.scale.y = Math.max(.02, f); m.visible = f > .01; } });
  if (S.left <= 0 && !S.emptyLogged) { S.emptyLogged = true; logE('info', [['x.jarEmpty', { n: it.f }]]); }
}
const FX = [];   // short-lived effects: match flights, smoke puffs, sparks
const FLAMEC = { Li: 0xE8243C, Na: 0xFFB020, K: 0xC07CFF, Rb: 0xD040A0, Cs: 0x7A6CFF, Ca: 0xFF6A2A, Sr: 0xFF1A3A, Ba: 0x9CFF5A, Cu: 0x30E0A0, B: 0x70FF60, Mg: 0xFFFFFF, S: 0x4A70FF, P: 0xFFF2B0, Zn: 0xA0FFE0, Fe: 0xFFB060, In: 0x6A5CFF, Tl: 0x8CFF6A, Pb: 0xB0C8FF };
const FLAMELOG = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Ca', 'Sr', 'Ba', 'Cu', 'B', 'Mg', 'S', 'P', 'C', 'Fe', 'Zn']);
const NEEDHOOD = new Set(['S', 'P', 'As', 'Se', 'Te', 'Cd', 'Tl', 'Pb']);
function propSetup(S) {
  const k = S.d.info.it.k;
  if (k === 'lamp') {
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.0022, .0022, .012, 10), new THREE.MeshStandardMaterial({ color: 0xF0EBDD, roughness: .9 })); wick.position.y = .072; S.g.add(wick);
    const fl = new THREE.Group(); fl.position.y = .079; S.g.add(fl);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.0068, .034, 18, 1, true).translate(0, .017, 0), new THREE.MeshBasicMaterial({ color: 0xFF9A2E, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.0035, .014, 14, 1, true).translate(0, .007, 0), new THREE.MeshBasicMaterial({ color: 0x3E6CF0, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide }));
    fl.add(outer, inner); fl.visible = false;
    S.lamp = { lit: false, fl, outer, col: null, colT: 0, ph: Math.random() * 6 };
    S.actions = () => S.lamp.lit ? [] : S.open ? [[T('x.lightIt'), () => lightLamp(S)]] : [];
    S.tick = dt => { const L = S.lamp; L.fl.visible = L.lit; if (!L.lit) return; L.ph += dt * 13; const f = 1 + .08 * Math.sin(L.ph) + .05 * Math.sin(L.ph * 2.3);
      L.fl.scale.set(1, f * (L.colT > 0 ? 1.3 : 1), 1); L.colT = Math.max(0, L.colT - dt);
      L.outer.material.color.setHex(L.colT > 0 && L.col != null ? L.col : 0xFF9A2E); L.outer.material.opacity = L.colT > 0 ? .8 : .55; };
    S.onClose = () => { if (S.lamp.lit) { S.lamp.lit = false; logE('obs', [['obs.capped']], { v: '', amt: '', f: '' }); } };
  }
  if (k === 'bunsen') {
    const fl = new THREE.Group(); fl.position.y = .145; S.g.add(fl);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(.011, .065, 18, 1, true).translate(0, .0325, 0), new THREE.MeshBasicMaterial({ color: 0xFFB22E, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.005, .027, 14, 1, true).translate(0, .0135, 0), new THREE.MeshBasicMaterial({ color: 0x437DFF, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide }));
    fl.add(outer, inner); fl.visible = false; S.open = true;
    S.lamp = { lit: false, fl, outer, inner, col: null, colT: 0, ph: Math.random() * 6 };
    S.burner = { airOpen: false, soot: 0 };
    S.actions = () => S.lamp.lit
      ? [[T(S.burner.airOpen ? 'x.closeAir' : 'x.openAir'), () => setBurnerAir(S, !S.burner.airOpen)], [T('x.gasOff'), () => stopBurner(S)]]
      : [[T('x.lightBurner'), () => lightLamp(S)]];
    S.tick = dt => { const L = S.lamp, B = S.burner; L.fl.visible = L.lit; if (!L.lit) return; L.ph += dt * 15; const f = 1 + .06 * Math.sin(L.ph) + .035 * Math.sin(L.ph * 2.1);
      L.fl.scale.set(B.airOpen ? .72 : 1, f * (B.airOpen ? .68 : 1), B.airOpen ? .72 : 1);
      L.outer.material.color.setHex(B.airOpen ? 0x3887FF : 0xFFB22E); L.outer.material.opacity = B.airOpen ? .48 : .72; L.inner.visible = B.airOpen;
      if (!B.airOpen) { B.soot += dt; if (B.soot > 1.5) { B.soot = 0; puff(lampFlamePos(S).add(V3(0, .045, 0)), 0x4A4A45); } } };
  }
}
function setBurnerAir(S, open) {
  if (!S || !S.burner) return; S.burner.airOpen = !!open;
  if (TASK.id === 'combustion' && !DEMO.active && S.lamp.lit) { TASK.seen.add(open ? 'blue' : 'yellow'); checkTask(); }
  analyticsActivity(open ? 'flame:blue' : 'flame:yellow'); logE('obs', [[open ? 'x.blueFlameObs' : 'x.yellowFlameObs']]); if (!DEMO.active) propInfo(S, true);
}
function stopBurner(S) {
  if (!S || !S.burner) return; S.lamp.lit = false;
  if (TASK.id === 'combustion' && !DEMO.active) { TASK.seen.add('off'); checkTask(); }
  analyticsActivity('flame:off'); logE('info', [['x.burnerOff']]); if (!DEMO.active) propInfo(S, true);
}
function lampFlamePos(S) { return S.g.position.clone().add(V3(0, S.burner ? .15 : .09, 0)); }
function lightLamp(S) {
  const mt = PROPS.find(p => p.d.info.it.k === 'matches' && (p.area || 'bench') === (S.area || 'bench'));
  if (!mt) { showMsg(T('x.needMatches')); return; }
  if (!PPE.goggles && !PPE.fl) { PPE.fl = true; logE('mistake', [['x.noGogglesFlame']]); }
  const g = new THREE.Group(); const stick = new THREE.Mesh(new THREE.BoxGeometry(.0022, .045, .0022), new THREE.MeshStandardMaterial({ color: 0xE8D2A0 })); stick.position.y = -.0225; g.add(stick);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.0028, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8A1E14 })); g.add(head);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(.004, .016, 12, 1, true).translate(0, .009, 0), new THREE.MeshBasicMaterial({ color: 0xFFB347, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); fl.visible = false; g.add(fl);
  g.position.copy(mt.g.position).add(V3(0, .03, 0)); g.rotation.z = -.6; scene.add(g);
  FX.push({ type: 'match', g, fl, a: g.position.clone(), b: lampFlamePos(S).add(V3(.012, -.004, 0)), t: 0, lamp: S });
}
function burnInFlame(S, lamp) {   // an open element jar held at a lit flame: a little of it goes onto the deflagrating spoon
  const sym = S.e[0], L = lamp.lamp, p = lampFlamePos(lamp);
  S.left = Math.max(0, S.left - .15); L.col = FLAMEC[sym] ?? null; L.colT = 2.6;
  if (sym === 'Fe') for (let i = 0; i < 14; i++) spark(p, 0xFFC060);
  if (sym === 'Mg' || sym === 'P' || sym === 'Zn') for (let i = 0; i < 5; i++) puff(p, 0xF2F2EE);
  if (sym === 'C') for (let i = 0; i < 6; i++) spark(p, 0xFF5020);
  const key = 'fl:' + sym; if (!L.logged) L.logged = new Set();
  if (!L.logged.has(key)) { L.logged.add(key); logE('obs', [[FLAMELOG.has(sym) ? 'x.fl.' + sym : FLAMEC[sym] ? 'x.fl.col' : 'x.fl.none', { n: elName(S.e) }]], { v: '', amt: '', f: S.e[0] }); }
  if (NEEDHOOD.has(sym) && !(inHood(p) && HOOD.fan) && !L.logged.has('hood:' + sym)) { L.logged.add('hood:' + sym); logE('mistake', [['x.needHood', { n: elName(S.e) }]]); for (let i = 0; i < 6; i++) puff(p, 0xD8D8D2); }
}
function puff(p, col) { const m = new THREE.Mesh(new THREE.SphereGeometry(.008, 10, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, depthWrite: false })); m.position.copy(p).add(V3((Math.random() - .5) * .01, .01, (Math.random() - .5) * .01)); scene.add(m); FX.push({ type: 'puff', m, v: V3((Math.random() - .5) * .02, .05 + Math.random() * .03, (Math.random() - .5) * .02), t: 0, life: 3 }); }
function spark(p, col) { const m = new THREE.Mesh(new THREE.SphereGeometry(.0012, 6, 4), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(p); scene.add(m); FX.push({ type: 'spark', m, v: V3((Math.random() - .5) * .5, .2 + Math.random() * .4, (Math.random() - .5) * .5), t: 0, life: .5 + Math.random() * .4 }); }
function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) { const f = FX[i]; f.t += dt;
    if (f.type === 'match') { const u = Math.min(1, f.t / 1.4), e = u * u * (3 - 2 * u); f.g.position.lerpVectors(f.a, f.b, e); f.g.position.y += Math.sin(u * Math.PI) * .04; f.fl.visible = f.t > .25;
      if (f.t > 1.4 && !f.done) { f.done = true; if (f.lamp.open && !f.lamp.lamp.lit) { f.lamp.lamp.lit = true; if (f.lamp.burner) analyticsActivity('flame:yellow'); logE('info', [[f.lamp.burner ? 'x.burnerLit' : 'x.lampLit']]); if (f.lamp.burner && TASK.id === 'combustion' && !DEMO.active) { TASK.seen.add('yellow'); checkTask(); } } }
      if (f.t > 2.2) { scene.remove(f.g); FX.splice(i, 1); } continue; }
    const k = f.t / f.life; if (k >= 1) { scene.remove(f.m); f.m.geometry.dispose(); FX.splice(i, 1); continue; }
    if (f.type === 'puff') { if (inHood(f.m.position) && HOOD.fan) { f.v.z += dt * .25; f.v.y += dt * .08; } f.m.position.addScaledVector(f.v, dt); f.m.scale.setScalar(1 + k * 3); f.m.material.opacity = .35 * (1 - k); }
    else { f.v.y -= 9.8 * dt * .5; f.m.position.addScaledVector(f.v, dt); }
  }
}
function updateProps(dt) {
  for (const S of PROPS) {
    if (S.demoPose) { S.g.position.copy(S.demoPose.p); S.g.quaternion.setFromAxisAngle(V3(0, 0, 1), S.demoPose.tilt || 0); S.g.updateMatrixWorld(); animLid(S, dt); if (S.tick) S.tick(dt); continue; }
    if (S.fly) { flyStep(S, dt); animLid(S, dt); if (S.tick) S.tick(dt); continue; }
    let tg = S.held && ptrOK && S.open && S.chem && S.left > 0 ? findTarget(S) : null;
    if (S.held && S.pz && S.open && S.chem && Math.abs(scr.x - S.pz.x0) < 90 && scr.y > S.pz.y0 - 40) tg = { kind: 'vessel', v: S.pz.v };
    if (tg && tg.kind === 'vessel') pourProp(S, tg, dt);
    else { S.pz = null; const k = 1 - Math.exp(-dt * (S.held ? 14 : 8)); if (S.held && ptrOK) S.g.position.lerp(V3(ptr.x, .05, ptr.z), k); else S.g.position.lerp(S.home, k); S.g.quaternion.slerp(QI, k); }
    animLid(S, dt); if (S.tick) S.tick(dt);
  }
}
/* chemistry of the cabinet chemicals: liquids give their species per mol/L; solids dissolve or react in pieces */
const CHEMDATA = {
  'HCl': { tot: { Cl: 1 } }, 'H₂SO₄': { tot: { SO4: 1 } }, 'CH₃COOH': { tot: { Ac: 1 } }, 'NaOH': { tot: { Na: 1 } }, 'Ca(OH)₂': { tot: { Ca: 1 }, conc: .02 }, 'NH₃(aq)': { tot: { NH3: 1 } },
  'CuSO₄': { tot: { Cu: 1, SO4: 1 } }, 'HNO₃': { tot: { NO3: 1 } }, 'AgNO₃': { tot: { Ag: 1, NO3: 1 } }, 'BaCl₂': { tot: { Ba: 1, Cl: 2 } }, 'Pb(NO₃)₂': { tot: { Pb: 1, NO3: 2 } },
  'KI': { tot: { K: 1, I: 1 } }, 'FeCl₃': { tot: { Fe3: 1, Cl: 3 } }, 'Na₂SO₄': { tot: { Na: 2, SO4: 1 }, M: 142, water: .03 }, 'Litmus': { ind: 'litmus' },
  'NaHCO₃': { tot: { Na: 1, Ct: 1 }, M: 84, water: .03, acid: .05 }, 'CaCO₃': { tot: { Ca: 1, Ct: 1 }, M: 100, acid: .02, msg: 'x.rxCO2' }, 'CuSO₄·5H₂O': { tot: { Cu: 1, SO4: 1 }, M: 250, water: .02 },
  'NH₄Cl': { tot: { NH3: 1, Cl: 1 }, M: 53.5, water: .03 }, 'CaCl₂': { tot: { Ca: 1, Cl: 2 }, M: 111, water: .03 }, 'FeSO₄·7H₂O': { tot: { Fe2: 1, SO4: 1 }, M: 278, water: .02 },
  'KNO₃': { tot: { K: 1, NO3: 1 }, M: 101, water: .03 }, 'C₆H₈O₇': { tot: { Ac: 3 }, M: 192, water: .02 }, 'C₁₂H₂₂O₁₁': { tot: {}, M: 342, water: .02 }, 'C₆H₁₂O₆': { tot: {}, M: 180, water: .02 },
};
CHEMDATA['C₁₂H₂₂O₁₁'].tot = { Suc: 1 };
CHEMDATA['C₆H₁₂O₆'].tot = { Suc: 1 };
CHEMDATA['C₂H₅OH'] = { tot: {}, solv: { ethanol: .96 } };
CHEMDATA['CH₃COCH₃'] = { tot: {}, solv: { acetone: 1 } };
const concOf = (it, d) => { if (d && d.conc) return d.conc; const c = String(it.c || ''); const m = c.match(/([\d.]+)\s*M/); if (m) return +m[1]; if (/37 %/.test(c)) return 12; if (/98 %/.test(c)) return 18; if (/65 %/.test(c)) return 14; if (/99 %/.test(c)) return 17; return 1; };
function chemOfProp(it) {
  const d = CHEMDATA[it.f], solid = /jar/.test(it.form), el = window.ELEMENTS.find(e => e[0] === it.f);
  if (solid) { if (el) return { kind: 'el', e: el, left: 6 }; return { kind: 'solid', d: d || { tot: {}, M: 100 }, known: !!d, left: 20 }; }
  const c = concOf(it, d), tot = {}; if (d && d.tot) for (const k in d.tot) tot[k] = d.tot[k] * c;
  return { kind: 'liquid', comp: { id: 'cab:' + it.f, tot, ind: d && d.ind ? { [d.ind]: 20 } : {}, solv: d && d.solv ? { ...d.solv } : {}, isInd: !!(d && d.ind), f: it.f }, known: !!d, left: it.form === 'dropper' ? 20 : /big/.test(it.form) ? 500 : 100 };
}
/* tap on a closet item → take it (glassware, chemicals); boxes and gas cylinders → note */
const LVL = { MS: 'x.lvMS', HS: 'x.lvHS', Uni: 'x.lvUni' };
function decorAt(e) {
  setNdc(e); let best = null, bd = Infinity; const hit = V3();
  for (const d of DECOR_PICK) if (!d.info.taken && ray.ray.intersectBox(d.box, hit)) { const dist = hit.distanceTo(ray.ray.origin); if (dist < bd) { bd = dist; best = d; } }
  if (best) best.dist = bd; return best;
}
function showPropNote(d, x, y) { decorNote(d, x, y, true); }
function decorNote(d, x, y, taken) {
  const I = d.info, L = { en: 0, ru: 1, et: 2 }[LANG] ?? 0, nm = it => it.n[L] || it.n[0];
  let title, body;
  if (I.type === 'glass') { title = nm(I.it); body = [(I.it.sz ? I.it.sz + ' · ' : '') + T(LVL[I.it.lv]), T(taken ? 'x.propTaken' : 'x.propTap')]; }
  else if (I.type === 'chem') { const it = I.it; title = nm(it); body = [it.f + (it.c && it.c !== 's' ? ' · ' + it.c : '') + ' · ' + T(LVL[it.lv]), (it.hz.length ? it.hz.map(h => T('x.hz_' + h)).join(', ') : T('x.hz_none')) + ' · ' + T('x.grp_' + it.grp), T(taken ? 'x.propTaken' : 'x.propTap')]; }
  else if (I.type === 'gas') { const it = I.it; title = nm(it) + ' (' + it.f + ')'; body = [T(LVL[it.lv]) + ' · ' + it.hz.map(h => T('x.hz_' + h)).join(', '), T('x.gasNote'), T('x.notYet')]; }
  else { title = T('x.box_' + I.key); body = [T('x.boxNote_' + I.key), I.items.map(it => nm(it) + ' (' + it.f + ')').join(', '), T('x.notYet')]; }
  showNoteRaw(title, body, x, y);
}
for (const d of droppers) { d.bx0 = d.bx; d.bz0 = d.bz; } JAR.x0 = JAR.x; JAR.z0 = JAR.z;
const ITEMS = [
  ...vessels.map(v => ({ key: 'beaker:' + v.letter, shelf: 'glass', icon: 'beaker', obj: v, name: () => T('x.beaker') + ' ' + v.letter + ' · 250 mL', near: [0, .04] })),
  { key: 'p3', shelf: 'glass', icon: 'pipette', obj: pipettes[0], name: () => T('x.p3'), near: [-.12, .26] },
  { key: 'p10', shelf: 'glass', icon: 'pipette', obj: pipettes[1], name: () => T('x.p10'), near: [-.22, .3] },
  { key: 'rod', shelf: 'glass', icon: 'rod', obj: rod, name: () => T('x.h.rod.t') },
  { key: 'spatula', shelf: 'glass', icon: 'spatula', obj: spatula, name: () => T('x.h.spatula.t'), near: [.3, -.13] },
  ...thermos.map(o => ({ key: 'thermo:' + o.n, shelf: 'glass', icon: 'thermo', obj: o, name: () => T('x.thermo', { n: o.n }), near: [.12 + o.n * .05, .24] })),
  { key: 'cond', shelf: 'glass', icon: 'thermo', obj: tester, name: () => T('x.cond'), near: [.26, .24] },
  ...bottles.map(b => ({ key: 'bottle:' + b.id, shelf: 'chem', icon: 'bottle', obj: b, name: () => T(REAG[b.id].name), near: [-.1, -.25] })),
  ...droppers.map(d => ({ key: 'dropper:' + d.id, shelf: 'chem', icon: 'dropper', obj: d, name: () => T(REAG[d.id].name), near: [.25, .15] })),
  { key: 'jar', shelf: 'chem', icon: 'jar', obj: JAR, name: () => T('x.h.jar.t'), near: [.38, -.22] },
];
const itemOf = o => ITEMS.find(i => i.obj === (o.owner || o));
/* Inventory is extensible: an item without an explicitly designed cabinet
   position receives a safe generic slot instead of aborting application
   startup. Explicit slots above still control normal shelf organisation. */
function ensureInventorySlots() {
  for (const it of ITEMS) {
    if (SLOTS[it.key]) continue;
    const o = it.obj, chemical = it.shelf === 'chem';
    let bay = chemical ? 'gen:B' : 'glass:B', w = .08, d = .07;
    if (o.kind === 'bottle') { const id = o.id || ''; bay = /^(hcl|acetic|vinegar)/.test(id) ? 'acid:B' : /^naoh/.test(id) ? 'base:B' : 'gen:B'; w = d = .066; }
    else if (o.kind === 'dropper') { bay = 'gen:B'; w = d = .04; }
    else if (o.kind === 'pipette' || o.kind === 'rod' || o.kind === 'thermo' || o.kind === 'spatula') { w = .2; d = .03; }
    slotFor(it.key, bay, w, d);
    console.warn('Assigned fallback inventory slot:', it.key, bay);
  }
}
ensureInventorySlots();
for (const it of ITEMS) it.tag = () => it.key.startsWith('beaker:') ? T('x.beaker') + ' ' + it.key.slice(-1) : it.key.startsWith('bottle:') || it.key.startsWith('dropper:') ? REAG[it.key.split(':')[1]].f : it.key === 'jar' ? 'NaCl' : it.key === 'p3' ? '3 mL' : it.key === 'p10' ? '10 mL' : it.key === 'cond' ? 'Ω' : it.key.startsWith('thermo:') ? '°C ' + it.key.slice(-1) : T(it.key === 'rod' ? 'x.tagRod' : 'x.tagSpat');
function detachFrom(v) {
  for (const s of [electrode, rod, ...probes]) if (s.in === v) s.in = null;
  for (const d of droppers) if (d.parked === v) unpark(d);
  for (const q of pipettes) if (q.in === v) q.in = null;
  for (const q of pipettes) if (q.pz && (q.pz.tg.v === v || q.pz.tg.b === v)) { q.docked = false; q.pz = null; q.lying = true; q.home.copy(q.home0); }
}
function stowItem(it) {
  const o = it.obj, P = slotPos(it.key), ry = SLOTS[it.key].ry; o.stowed = true; setOnBalance(o, false);
  if (it.key === 'jar') { JAR.present = false; JAR.g.visible = true; JAR.g.position.copy(P); JAR.g.rotation.y = ry; JAR.lid.position.set(0, JAR.H + .006, 0); }
  else if (o.kind === 'dropper') { unpark(o); o.open = false; o.dragWhole = false; o.proxy.userData.obj = o.lidControl; o.bottleG.visible = true; o.bottleG.position.copy(P); o.bottleG.rotation.y = ry; o.g.visible = true; o.g.position.copy(P).add(V3(0, .006, 0)); o.home.copy(o.g.position); o.squeeze = 0; o.teat.scale.set(1, 1, 1); }
  else {
    if (o.kind === 'vessel' || o.kind === 'bottle') { detachFrom(o); o.docked = false; o.pour = null; o.onBalance = false; o.inSink = false; if (o.kind === 'vessel') o.sinkDrain = null; o.tilt = 0; o.g.quaternion.copy(qY(ry)); drawStream(o, null); }
    if (o.kind === 'pipette') { o.docked = false; o.pz = null; o.in = null; o.lying = true; o.g.quaternion.copy(qY(ry)).multiply(QLIE); }
    if (o.kind === 'rod' || o.kind === 'thermo') { o.in = null; o.lying = true; o.g.quaternion.copy(qY(ry)).multiply(QLIE); }
    if (o.kind === 'spatula') o.g.rotation.set(0, ry, 0);
    o.g.visible = true; o.g.position.copy(P); if (o.sh) o.sh.visible = false;
    if (o.base) o.base.copy(P); if (o.home) o.home.copy(P);
    if (o.kind === 'bottle') { o.open = false; o.lidT = 0; o.lidHome = null; o.spout.copy(P).add(V3(0, BOT_H, 0)); o.cap.visible = true; o.g.updateMatrixWorld(); o.cap.position.copy(V3(0, .143, 0).applyMatrix4(o.g.matrixWorld)); o.cap.quaternion.copy(o.g.quaternion); o.liq.visible = o.V > .05; o.plane.constant = P.y + o.shape.levelAt(0, Math.max(o.V, .05)); }
    if (o.kind === 'vessel') { o.tilted.visible = false; o.last.copy(P); o.g.updateMatrixWorld(); updateVessel(o, .016, 0); }
    if (o.kind === 'pipette') o.home.y += .0072;
  }
  refreshTags(); refreshPickables();
}
function placeItem(it, x, z) {
  const o = it.obj;
  if (it.key === 'jar') { const p = x == null ? findSpot(null, it.near[0], it.near[1], .05) : V3(x, 0, z); JAR.x = p.x; JAR.z = p.z; JAR.g.position.set(p.x, 0, p.z); JAR.g.rotation.y = 0; JAR.lid.position.set(.07, .006, .03); JAR.g.visible = true; JAR.present = true; o.stowed = false; refreshTags(); refreshPickables(); return; }
  o.stowed = false; setOnBalance(o, false);
  if (o.kind === 'dropper') {
    const p = x == null ? findSpot(o, it.near[0], it.near[1], .02) : V3(x, 0, z);
    o.open = false; o.dragWhole = false; o.proxy.userData.obj = o.lidControl; o.bx = p.x; o.bz = p.z; o.bottleG.position.set(p.x, 0, p.z); o.bottleG.rotation.y = 0; o.bottleG.visible = true; o.home.set(p.x, .006, p.z); o.g.position.copy(o.home); o.g.visible = true;
  } else if (o.kind === 'vessel') {
    const p = x == null ? findSpot(o, it.near[0], it.near[1], o.R + .002) : V3(x, 0, z);
    o.base.copy(p); o.g.visible = true; o.sh.visible = true; o.inSink = false;
  } else if (o.kind === 'bottle') {
    const p = x == null ? findSpot(o, it.near[0], it.near[1], BOT_R) : V3(x, 0, z);
    o.home.copy(p); o.g.visible = true; o.sh.visible = true;
  } else if (o.kind === 'pipette') {
    const p = x == null ? findSpot(o, it.near[0] + o.L / 2, it.near[1], .03).add(V3(-o.L / 2, 0, 0)) : V3(x, 0, z);
    o.home.set(p.x, .0072, p.z); o.lying = true; o.g.visible = true;
  } else if (o.kind === 'rod') { o.home.copy(o.home0); o.lying = false; o.g.visible = true; }
  else if (o.kind === 'thermo') { const p = x == null ? findSpot(o, it.near[0] + .09, it.near[1], .04) : V3(x + .09, 0, z); o.home.set(p.x - .09, o.cond ? .017 : .0068, p.z); o.lying = true; o.in = null; o.g.visible = true; o.g.position.copy(o.home); o.g.quaternion.identity(); o.g.rotation.set(0, 0, -Math.PI / 2); }
  else if (o.kind === 'spatula') {
    const p = x == null ? findSpot(o, it.near[0] + .06, it.near[1] - .035, .03).add(V3(-.06, 0, .035)) : V3(x, 0, z);
    o.home.set(p.x, .004, p.z); o.g.visible = true;
  }
  refreshTags(); refreshPickables();
}
const residue = c => Object.values(c.tot).reduce((a, x) => a + Math.abs(x), 0) + Object.values(c.ind).reduce((a, x) => a + x, 0);
/* returns null when the item went back, otherwise the key of a note explaining what to do first */
function putBack(it) {
  const o = it.obj;
  if (o.held) return 'x.pbHeld';
  if (o.kind === 'vessel') {
    if (o.chem.V > 1 || o.solid > .01 || (o.metal && o.metal.length)) return 'x.pbEmpty';
    if (residue(o.chem) > .05) logE('mistake', [['x.pbDirty', { v: o.letter }]]);
  }
  if (o.kind === 'pipette' && o.chem.V > .004) return 'x.pbPip';
  if (o.kind === 'spatula' && o.grams > .005) return 'x.pbSpat';
  analyticsActivity('return:' + it.key); stowItem(it); logE('info', [['x.putBack', { n: it.name() }]]); return null;
}
const tagProxies = [];
function drawTag(it) {
  const on = !it.obj.stowed, c = it.tagCanvas.getContext('2d'); c.fillStyle = on ? '#FCE7C8' : '#FFFFFF'; c.fillRect(0, 0, 256, 72); c.strokeStyle = '#9C9384'; c.lineWidth = 4; c.strokeRect(2, 2, 252, 68);
  c.fillStyle = '#1b2622'; c.font = '600 30px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((on ? '↩ ' : '') + it.tag(), 128, 38); it.tagTex.needsUpdate = true;
}
function refreshTags() { for (const it of ITEMS) if (it.tagTex) drawTag(it); }
function buildTags() {
  for (const it of ITEMS) {
    const S = SLOTS[it.key];
    it.tagCanvas = document.createElement('canvas'); it.tagCanvas.width = 256; it.tagCanvas.height = 72; it.tagTex = new THREE.CanvasTexture(it.tagCanvas); it.tagTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.06, .017), new THREE.MeshBasicMaterial({ map: it.tagTex })); const lyingK = ['p10', 'p3', 'rod', 'spatula', 'thermo:1', 'thermo:2', 'thermo:3', 'cond'].includes(it.key); m.position.copy(S.tag); if (lyingK) m.position.z = S.along + S.A * .05; m.rotation.y = S.ry; m.userData.help = S.B.unit === 'glass' ? 'closet' : 'shelf'; scene.add(m);
    const o = { kind: 'button', name: 'slot', proxy: m, label: () => it.name() + ' — ' + T(it.obj.stowed ? 'x.tapTake' : 'x.tapReturn') };
    o.tap = () => { if (it.obj.stowed) takeItem(it); else { const why = putBack(it); if (why) showMsg(T(why, { n: it.name() })); } };
    m.userData.obj = o; balButtons.push(m); tagProxies.push(m);
  }
  refreshTags();
}
function takeItem(it) { placeItem(it); analyticsActivity('take:' + it.key); logE('info', [['x.took', { n: it.name() }]]); showManual(it.key === 'cond' ? 'cond' : MAN_KIND[it.obj.kind] || 'other'); }
/* ---------- equipment manual: a short card at the side whenever something is taken ---------- */
const MAN_KIND = { vessel: 'beaker', bottle: 'chemical', dropper: 'dropper', pipette: 'pipette', rod: 'rod', spatula: 'spatula', thermo: 'digthermo', jar: 'chemical' };
const MAN_OF = { 'beaker-s': 'beaker', 'beaker-l': 'beaker', tubes: 'tubes', 'boiling-tubes': 'tubes', erlen: 'flask', 'erlen-l': 'flask', rbf: 'flask', 'rbf-l': 'flask', volflask: 'flask', 'volflask-l': 'flask',
  watch: 'dish', evap: 'dish', crucible: 'dish', petri: 'dish', boats: 'dish', cyl: 'cylinder', 'cyl-l': 'cylinder', gpip: 'pipette', vpip: 'pipette', pasteur: 'pipette', micropip: 'pipette', filler: 'pipette', syringe: 'pipette',
  burette: 'burette', funnel: 'funnel', 'funnel-l': 'funnel', buchner: 'funnel', sep: 'funnel', filterpaper: 'funnel', lamp: 'lamp', bunsen: 'bunsen', tripod: 'heatstand', triangle: 'heatstand', mat: 'heatstand', hotplate: 'heatstand',
  bath: 'heatstand', mantle: 'heatstand', stand: 'heatstand', bosses: 'heatstand', ringclamp: 'heatstand', burclamp: 'heatstand', holder: 'tongs', tongs: 'tongs', thermo: 'thermo', liebig: 'distill', allihn: 'distill', vigreux: 'distill',
  stillhead: 'distill', claisen: 'distill', tubing: 'distill', clips: 'distill', delivery: 'distill', gasjar: 'gas', trough: 'gas', kipp: 'gas', splints: 'splints', matches: 'matches', phpaper: 'phpaper', spectro: 'spectro', colorimeter: 'spectro', conduct: 'instrument' };
const manualOfProp = S => S.chem ? 'chemical' : MAN_OF[S.d.info.it.k] || 'other';
const manEl = document.createElement('div'); manEl.className = 'manual'; manEl.hidden = true; let manKey = null;
function placeManual() { const wide = matchMedia('(min-width: 901px)').matches, card = $('card'); if (wide) { if (manEl.parentNode !== card.parentNode || manEl.nextSibling !== card) card.before(manEl); manEl.classList.remove('over'); } else { if (manEl.parentNode !== stage) stage.append(manEl); manEl.classList.add('over'); } }
function showManual(key) {
  if (!key) return; manKey = key; placeManual(); manEl.replaceChildren();
  const hd = document.createElement('div'); hd.className = 'mh'; const b = document.createElement('b'); b.textContent = T('x.man.' + key + '.t'); const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', T('x.close')); x.addEventListener('click', () => { manEl.hidden = true; manKey = null; }); hd.append(b, x); manEl.append(hd);
  for (const [lbl, k] of [['x.manApp', 'app'], ['x.manReal', 'real']]) { const sec = document.createElement('div'); sec.className = 'ms'; const l = document.createElement('span'); l.textContent = T(lbl); sec.append(l); for (const line of T('x.man.' + key + '.' + k).split('|')) { const p = document.createElement('p'); p.textContent = line; sec.append(p); } manEl.append(sec); }
  manEl.hidden = false;
}
addEventListener('resize', () => { if (manKey) placeManual(); });

/* ===================== TASK CARDS =====================
   A card = starting bench + goal check. Free bench = no card: empty bench, everything available. */
const TASKS = [
  { id: 'free', free: true, title: 'x.freeTitle', goal: 'x.freeGoal', steps: 'x.freeSafety', start: 'x.freeStart', setup: [] },
  { id: 'acidalkali', title: 'x.title', goal: 'x.goal', steps: 'x.steps', start: 'x.start', sensory: 'lab.acid.sensory',
    setup: [['beaker:A', { V: 40, tot: { Cl: 20 } }], ['beaker:B'], ['beaker:C'], ['bottle:hcl'], ['bottle:naoh'], ['bottle:na2co3'], ['bottle:water'], ['dropper:univ'], ['dropper:phph'], ['dropper:mo'], ['p3'], ['p10'], ['rod'], ['spatula'], ['jar']],
    check: () => vessels.find(v => !v.stowed && v.chem.V > 5 && (v.chem.tot.Cl || 0) > .5 && (v.chem.tot.Na || 0) > .5 && (v.chem.ind.univ || 0) > 0 && v.chem.eq && v.chem.eq.pH > 6.5 && v.chem.eq.pH < 7.5),
    done: 'x.goalDone' },
  { id: 'phmeasure', title: 'lab.ph.title', goal: 'lab.ph.goal', steps: 'lab.ph.steps', start: 'lab.ph.start', sensory: 'lab.ph.sensory',
    setup: [['beaker:A', { V: 75, tot: { Cl: 7.5 } }], ['beaker:B', { V: 75, tot: { Cl: .75 } }], ['beaker:C', { V: 75, tot: { Ac: 7.5 } }], ['bottle:hcl01'], ['bottle:hcl001'], ['bottle:acetic01']],
    check: () => TASK.seen && ['A', 'B', 'C'].every(k => TASK.seen.has(k)) ? vessels.find(v => v.letter === 'C') : null, done: 'lab.ph.done' },
  { id: 'combustion', title: 'lab.comb.title', goal: 'lab.comb.goal', steps: 'lab.comb.steps', start: 'lab.comb.start', sensory: 'lab.comb.sensory', setup: [],
    props: [{ key: 'bunsen', x: -.16, z: 2.83 }, { key: 'matches', x: .08, z: 2.83 }],
    check: () => TASK.seen && ['yellow', 'blue', 'off'].every(k => TASK.seen.has(k)) && HOOD.fan ? PROPS.find(p => p.burner) : null,
    done: 'lab.comb.done' },
];
/* identification labs from the 2D version: unlabelled bottles A–F get their contents dealt out at random */
const COMMON = [['beaker:A'], ['beaker:B'], ['beaker:C'], ['beaker:D'], ['p3'], ['rod']];
const CAT = { HCl: 'acid', NaOH: 'alkali', H2O: 'neutral' };
function labTask(id, deal, extra, answer, check) {
  return { id, lab: true, title: 'sc.' + id + '.title', goal: 'sc.' + id + '.goal', steps: 'x.lab.' + id, start: 'x.labStart', deal,
    setup: [...COMMON, ...(deal ? deal.map((_, i) => ['bottle:u' + UNK[i]]) : []), ...extra.map(k => [k])], answer, check, done: 'x.lab.' + id + '.done' };
}
const pptIn = n => vessels.find(v => !v.stowed && v.chem.eq && (v.chem.eq.ppt[n] || 0) > .002);
TASKS.push(
  labTask('ind1', ['HCl', 'NaOH', 'H2O'], ['dropper:univ', 'dropper:phph', 'dropper:mo'], { opts: ['acid', 'alkali', 'neutral'], cat: true }),
  labTask('ind2', ['HCl', 'NaOH', 'NaCl', 'Na2CO3', 'NH4Cl'], ['dropper:univ', 'dropper:phph', 'bottle:hcl'], { opts: ['HCl', 'NaOH', 'NaCl', 'Na2CO3', 'NH4Cl'] }),
  labTask('ind3', ['HCl', 'CH3COOH', 'NaOH', 'NH3', 'CH3COONa', 'NH4Cl'], ['dropper:univ'], { opts: ['HCl', 'CH3COOH', 'NaOH', 'NH3', 'CH3COONa', 'NH4Cl'], num: { key: 'x.ansPka', lo: 4.5, hi: 5.0 } }),
  labTask('pre1', null, ['bottle:naoh', 'bottle:cuso4', 'bottle:nacl', 'bottle:na2so4', 'dropper:agno3', 'dropper:bacl2'], null,
    () => { const a = pptIn('CuOH2'), b = pptIn('AgCl'), c = pptIn('BaSO4'); return a && b && c && new Set([a, b, c]).size === 3 ? a : null; }),
  labTask('pre2', ['NaCl', 'Na2SO4', 'Na2CO3', 'NaNO3'], ['bottle:hcl', 'dropper:agno3', 'dropper:bacl2'], { opts: ['NaCl', 'Na2SO4', 'Na2CO3', 'NaNO3'] }),
  labTask('pre3', ['CuSO4', 'FeCl3', 'FeSO4', 'PbNO32', 'KI', 'AgNO3'], ['bottle:naoh', 'bottle:hcl', 'bottle:na2so4', 'dropper:bacl2'], { opts: ['CuSO4', 'FeCl3', 'FeSO4', 'PbNO32', 'KI', 'AgNO3'] }),
);
/* K1 course labs from the supplied source. Their equipment models remain
   reusable so later labs can use the same conductivity, heat and evaporation
   behaviour instead of scripted outcomes. */
TASKS.push(
  { id: 'k111', lab: true, code: 'K1.11', title: 'x.k111.title', goal: 'x.k111.goal', steps: 'x.lab.k111', start: 'x.labStart', done: 'x.lab.k111.done', sensory: 'x.lab.k111.sensory',
    setup: [['beaker:A'], ['beaker:B'], ['beaker:C'], ['beaker:D'], ['bottle:water'], ['bottle:nacl'], ['jar'], ['spatula'], ['rod'], ['cond'], ['decor:sucrose']],
    answer: { rows: ['dry', 'water', 'nacl', 'sugar'], rowKey: 'x.k111.row.', optKey: 'x.ans_', opts: ['bright', 'faint', 'off'], fixed: { dry: 'off', water: 'off', nacl: 'bright', sugar: 'off' }, needSeen: true } },
  { id: 'k112', lab: true, code: 'K1.12', title: 'x.k112.title', goal: 'x.k112.goal', steps: 'x.lab.k112', start: 'x.labStart', done: 'x.lab.k112.done', sensory: 'x.lab.k112.sensory',
    setup: [['cond'], ['glass:lamp'], ['glass:matches']],
    answer: { rows: ['cu', 'al', 'fe', 'glass'], rowKey: 'x.rod_', optKey: 'x.ans_', opts: ['r1', 'r2', 'r3', 'r4'], fixed: { cu: 'r1', al: 'r2', fe: 'r3', glass: 'r4' }, needSeen: true } },
  { id: 'k113', lab: true, code: 'K1.13', title: 'x.k113.title', goal: 'x.k113.goal', steps: 'x.lab.k113', start: 'x.labStart', done: 'x.lab.k113.done', sensory: 'x.lab.k113.sensory',
    setup: [['beaker:A'], ['beaker:B'], ['beaker:C'], ['bottle:water'], ['decor:ethanol'], ['decor:acetone'], ['thermo:1'], ['thermo:2'], ['thermo:3']],
    answer: { rows: ['water', 'ethanol', 'acetone'], rowKey: 'x.solv_', optKey: 'x.ans_', opts: ['most', 'middle', 'least'], fixed: { water: 'least', ethanol: 'middle', acetone: 'most' }, needSeen: true } },
);
/* K3 carboxylic-acid labs. K3-V02 uses a diluted vinegar sample so a
   10 mL aliquot can be titrated within the range of a 50 mL burette. */
TASKS.push(
  { id: 'k3v01', lab: true, code: 'K3-V01', title: 'x.k3v01.title', goal: 'x.k3v01.goal', steps: 'x.lab.k3v01', start: 'x.labStart', done: 'x.lab.k3v01.done', sensory: 'x.lab.k3v01.sensory',
    setup: [['beaker:A'], ['beaker:B'], ['beaker:C'], ['bottle:hcl01'], ['bottle:acetic01'], ['bottle:water'], ['p10'], ['cond']],
    answer: { rows: ['hclPH', 'hclCond', 'acPH', 'acCond', 'dilutedPH'], rowKey: 'x.k3v01.row.', optKey: 'x.ans_',
      opts: ['ph1', 'ph29', 'ph34', 'bright', 'dim', 'faint', 'off'],
      optsByRow: { hclPH: ['ph1', 'ph29', 'ph34'], hclCond: ['bright', 'dim', 'faint', 'off'], acPH: ['ph1', 'ph29', 'ph34'], acCond: ['bright', 'dim', 'faint', 'off'], dilutedPH: ['ph1', 'ph29', 'ph34'] },
      fixed: { hclPH: 'ph1', hclCond: 'bright', acPH: 'ph29', acCond: 'dim', dilutedPH: 'ph34' }, needSeen: true } },
  { id: 'k3v02', lab: true, code: 'K3-V02', title: 'x.k3v02.title', goal: 'x.k3v02.goal', steps: 'x.lab.k3v02', start: 'x.labStart', done: 'x.lab.k3v02.done', sensory: 'x.lab.k3v02.sensory',
    setup: [['beaker:A'], ['beaker:B'], ['bottle:vinegar'], ['bottle:naoh01'], ['dropper:phph'], ['p10']],
    answer: { rows: ['equation'], rowKey: 'x.k3v02.row.', optKey: 'x.ans_', opts: ['neutralisation', 'wrongStoich'], fixed: { equation: 'neutralisation' }, num: { key: 'x.k3v02.answer', check: (x, task) => Number.isFinite(x) && Math.abs(x - task.targetC) <= task.targetC * .03 } } },
);
function dealUnknowns(task) {
  task.key = {}; task.picks = {}; task.num = '';
  task.evidence = task.answer && task.answer.needSeen ? {} : null;
  for (const L of UNK) { REAG['u' + L].tot = {}; }
  if (!task.deal) return;
  const d = task.deal.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  d.forEach((k, i) => { const L = UNK[i]; task.key[L] = k; REAG['u' + L].tot = { ...SOL[k] }; });
  for (const b of bottles) if (b.id[0] === 'u') tintBottle(b);
}
function checkAnswers() {
  const A = TASK.answer; let wrong = 0;
  const rows = A.rows || Object.keys(TASK.key);
  if (A.needSeen) {
    const missing = rows.filter(L => !TASK.evidence || TASK.evidence[L] == null);
    if (missing.length) { logE('mistake', [['x.observeFirst', { n: missing.length }]]); renderCard(); return; }
  }
  if (TASK.id === 'k112' && PROPS.some(p => p.lamp && p.lamp.lit)) { logE('mistake', [['x.extinguishFirst']]); renderCard(); return; }
  for (const L of rows) { const want = A.fixed ? A.fixed[L] : A.cat ? CAT[TASK.key[L]] : TASK.key[L]; if (TASK.picks[L] !== want) wrong++; }
  let numOk = true; if (A.num) { const x = parseFloat(String(TASK.num).replace(',', '.')); numOk = A.num.check ? A.num.check(x, TASK) : x >= A.num.lo && x <= A.num.hi; }
  if (!wrong && numOk) { TASK.reached = true; logE('success', [[TASK.done]]); analyticsCompleteAttempt(); buzz(30); }
  else logE('mistake', [[wrong ? 'x.ansWrong' : 'x.ansPkaOff', { n: wrong }]]);
  renderCard();
}
let TASK = TASKS[1];
/* A demo is a playlist of short, stateful clips.  The student advances only
   with Next, so each procedure step can be watched and discussed separately. */
const DEMO = { active: false, running: false, token: 0, step: -1, total: 0, clips: [], objects: [], message: null };
/* Look through the open space below the sash frame, centred on the burner.
   This keeps the air collar, barrel and complete flame visible together. */
function combustionShot() {
  const t = V3(-.16, .115, 2.83);
  return { t, p: V3(-.16, camera.aspect < .85 ? .205 : .19, camera.aspect < .85 ? 2.03 : 2.12) };
}
function clearDemoObjects() { for (const o of DEMO.objects) o.demoPose = null; DEMO.objects.length = 0; }
function cancelDemo(message = null) {
  DEMO.token++; for (const o of DEMO.objects) { if (o.kind === 'bottle') o.open = false; if (o.kind === 'dropper') { o.parked = null; o.open = false; o.proxy.userData.obj = o.lidControl; } }
  clearDemoObjects(); DEMO.active = DEMO.running = false; DEMO.step = -1; DEMO.message = message; stage.classList.remove('demo');
}
function stopDemo() { const task = TASK; cancelDemo(); setupTask(task); instructorTab = 'procedure'; setInspector(true); }
const demoWait = (ms, token) => new Promise(resolve => setTimeout(() => resolve(token === DEMO.token), ms));
function demoPose(o) { if (!DEMO.objects.includes(o)) DEMO.objects.push(o); return o.demoPose = { p: o.g.position.clone(), tilt: 0 }; }
function demoTween(pose, to, tilt, ms, token) {
  const from = pose.p.clone(), a0 = pose.tilt || 0, t0 = performance.now();
  return new Promise(resolve => { const tick = now => { if (token !== DEMO.token) return resolve(false); const q = clamp((now - t0) / ms, 0, 1), s = q * q * (3 - 2 * q); pose.p.lerpVectors(from, to, s); pose.tilt = a0 + (tilt - a0) * s; if (q < 1) requestAnimationFrame(tick); else resolve(true); }; requestAnimationFrame(tick); });
}
const demoTarget = v => ({ kind: 'vessel', v, c: V3(v.base.x, rimY(v), v.base.z), R: v.Ri });
async function demoIndicator(token) {
  const A = vessels.find(v => v.letter === 'A'), d = droppers.find(o => o.id === 'univ'); if (!d.open) toggleDropper(d);
  const p = demoPose(d); if (!await demoTween(p, V3(A.base.x, rimY(A) + .055, A.base.z), 0, 900, token)) return false;
  d.parked = A; for (let i = 0; i < 3; i++) { d.tap(); if (!await demoWait(520, token)) return false; }
  d.parked = null; if (!await demoTween(p, d.home.clone(), 0, 700, token)) return false; d.demoPose = null; toggleDropper(d); return true;
}
async function demoNeutralise(token) {
  const A = vessels.find(v => v.letter === 'A'), b = bottles.find(o => o.id === 'naoh'), rodPose = demoPose(rod), bp = demoPose(b); b.open = true; placeLid(b);
  if (!await demoTween(bp, V3(A.base.x - .08, .16, A.base.z), 0, 800, token) || !await demoTween(bp, V3(A.base.x - .07, .145, A.base.z), -1.15, 450, token)) return false;
  const tg = demoTarget(A), comp = compOf('naoh'); let added = 0, lastInd = snap(A).ind;
  while (added < 40 - 1e-6) {
    if (token !== DEMO.token) return false;
    const dV = Math.min(added < 37 ? 1 : added < 39.5 ? .25 : .05, 40 - added);
    deliver(tg, comp, dV, V3(A.base.x - .008, Math.max(A.level, A.b) + .002, A.base.z), Math.max(.4, dV)); b.V -= dV; added += dV; doEq(A);
    const nowInd = snap(A).ind;
    if (nowInd && nowInd !== lastInd) { lastInd = nowInd; logE('obs', [['lab.acid.colourPoint', { ml: fmt(added, added < 37 ? 1 : 2), ph: fmt(A.chem.eq.pH, 2), c: { k: 'col.' + nowInd } }]]); }
    if (!await demoWait(added < 37 ? 42 : 75, token)) return false;
  }
  endSession(); if (!await demoTween(bp, b.home.clone(), 0, 650, token)) return false; b.demoPose = null; b.open = false;
  if (!await demoTween(rodPose, V3(A.base.x + .008, A.base.y + A.b + .004, A.base.z), 0, 650, token)) return false;
  for (let i = 0; i < 16; i++) { rodPose.p.x = A.base.x + Math.sin(i * .9) * .018; rodPose.p.z = A.base.z + Math.cos(i * .9) * .018; A.stir = 1; if (!await demoWait(70, token)) return false; }
  if (!await demoTween(rodPose, rod.home.clone(), 0, 650, token)) return false; return true;
}
async function demoWeighSplit(token) {
  const A = vessels.find(v => v.letter === 'A'), B = vessels.find(v => v.letter === 'B'), pb = demoPose(B);
  if (!await demoTween(pb, BAL.pan.clone(), 0, 750, token)) return false; B.base.copy(BAL.pan); setOnBalance(B, true); BAL.on = true; BAL.boot = 0; BAL.tare = vesselMass(B); BAL.shown = 0; logE('info', [['x.tared']]); B.demoPose = null;
  const pa = demoPose(A), above = V3(BAL.pan.x - .09, BAL.pan.y + .17, BAL.pan.z);
  if (!await demoTween(pa, above, 0, 750, token) || !await demoTween(pa, above.clone().add(V3(.015, -.02, 0)), -1.1, 400, token)) return false;
  const amount = A.chem.V / 2, comp = compOfVessel(A), tg = demoTarget(B); let moved = 0;
  while (moved < amount - 1e-6) { const dV = Math.min(1, amount - moved), got = removeLiquid(A, dV); addLiquid(B, comp, got, B.base.x, B.base.z); moved += got; if (!await demoWait(45, token)) return false; }
  endSession(); if (!await demoTween(pa, A.base.clone(), 0, 700, token)) return false; return true;
}
async function demoSalt(token) {
  const B = vessels.find(v => v.letter === 'B'), C = vessels.find(v => v.letter === 'C'), water = bottles.find(o => o.id === 'water'); setOnBalance(B, false); B.base.copy(B.base0);
  const wp = demoPose(water); water.open = true; placeLid(water); if (!await demoTween(wp, V3(C.base.x - .08, .15, C.base.z), -1.05, 700, token)) return false;
  for (let i = 0; i < 30; i++) { deliver(demoTarget(C), compOf('water'), 1, V3(C.base.x, C.b + .01, C.base.z), 2); water.V--; if (!await demoWait(35, token)) return false; } endSession();
  if (!await demoTween(wp, water.home.clone(), 0, 600, token)) return false; water.demoPose = null; water.open = false;
  const sp = demoPose(spatula); if (!await demoTween(sp, V3(JAR.x, .07, JAR.z), 0, 550, token)) return false; spatula.grams = 1; if (!await demoWait(450, token)) return false;
  if (!await demoTween(sp, V3(C.base.x, rimY(C) + .02, C.base.z), .8, 650, token)) return false; const n = spatula.grams / 58.44 * 1000; C.chem.tot.Na = (C.chem.tot.Na || 0) + n; C.chem.tot.Cl = (C.chem.tot.Cl || 0) + n; C.eqDirty = true; C.visualKick = 1; logE('obs', [['x.saltIn', { g: fmt(spatula.grams, 2) }]], { v: C.letter, amt: '', f: 'NaCl' }); spatula.grams = 0;
  if (!await demoTween(sp, spatula.home.clone(), 0, 600, token)) return false; setOnBalance(C, true); C.base.copy(BAL.pan); BAL.tare = 0; return true;
}
async function demoRinseMeasure(token) {
  const A = vessels.find(v => v.letter === 'A'), C = vessels.find(v => v.letter === 'C'); setOnBalance(C, false); C.base.copy(C.base0); const pa = demoPose(A), sink = V3((SINK.x0 + SINK.x1) / 2, .08, (SINK.z0 + SINK.z1) / 2);
  if (!await demoTween(pa, sink, -1.25, 750, token)) return false; removeLiquid(A, A.chem.V); A.eqDirty = true;
  const ww = demoPose(wash); for (let rinse = 0; rinse < 2; rinse++) { if (!await demoTween(ww, sink.clone().add(V3(-.07, .08, 0)), -.4, 500, token)) return false; addLiquid(A, compOf('wash'), 15, A.g.position.x, A.g.position.z); if (!await demoWait(550, token)) return false; if (rinse === 0) removeLiquid(A, A.chem.V); }
  endSession(); if (!await demoTween(ww, wash.home.clone(), 0, 500, token) || !await demoTween(pa, A.base0.clone(), 0, 650, token)) return false; A.base.copy(A.base0); A.demoPose = null; wash.demoPose = null;
  const pe = demoPose(electrode); if (!await demoTween(pe, V3(A.base.x + A.Ri * .2, A.base.y + A.b + .003, A.base.z), 0, 650, token)) return false; electrode.demoPose = null; electrode.in = A; electrode.inAngle = Math.PI / 2; electrode.lying = false; METER.on = true; METER.boot = 0; return true;
}
async function demoMeterOn(token) {
  const wide = view0(); flyTo(wide.t, wide.p);
  METER.on = true; METER.boot = .7; logE('info', [['lab.ph.meterOn']]); return demoWait(1400, token);
}
async function demoPHVessel(letter, rinse, token) {
  const wide = view0(); flyTo(wide.t, wide.p);
  const v = vessels.find(q => q.letter === letter), p = demoPose(electrode); electrode.in = null;
  if (rinse) {
    const sink = V3((SINK.x0 + SINK.x1) / 2, .055, (SINK.z0 + SINK.z1) / 2), wp = demoPose(wash);
    if (!await demoTween(p, sink, 0, 700, token) || !await demoTween(wp, sink.clone().add(V3(-.08, .08, .015)), -.55, 600, token)) return false;
    drawStream(wash, wp.p.clone().add(V3(.025, .005, 0)), sink.clone().add(V3(0, .018, 0)), .7);
    for (let i = 0; i < 8; i++) { spawnDrop(sink.clone().add(V3((Math.random() - .5) * .008, .04 + Math.random() * .015, (Math.random() - .5) * .008)), compOf('wash'), 'sink'); if (!await demoWait(85, token)) return false; }
    drawStream(wash, null); if (!await demoTween(wp, wash.home.clone(), 0, 550, token)) return false; wash.demoPose = null; logE('info', [['lab.ph.rinsed']]);
  }
  if (!await demoTween(p, V3(v.base.x + v.Ri * .2, v.base.y + v.b + .003, v.base.z), 0, 700, token)) return false;
  electrode.demoPose = null; electrode.in = v; electrode.inAngle = Math.PI / 2; electrode.lying = false; doEq(v); analyticsActivity('measure:ph', 1, v.chem.eq.pH, 'measure:ph'); logE('obs', [['lab.ph.readValue', { v: letter, ph: fmt(v.chem.eq.pH, 2) }]]);
  if (TASK.id === 'k3v01' && TASK.evidence) { const band = v.chem.eq.pH < 1.6 ? 'ph1' : v.chem.eq.pH < 3.2 ? 'ph29' : 'ph34'; if (letter === 'A') TASK.evidence.hclPH = band; if (letter === 'B') TASK.evidence.acPH = band; if (letter === 'C') TASK.evidence.dilutedPH = band; }
  return demoWait(1600, token);
}
async function demoCombSafety(token) {
  const shot = combustionShot(); flyTo(shot.t, shot.p); HOOD.sashT = .72; HOOD.fan = true; logE('info', [['x.hoodFanIsOn']]); return demoWait(1200, token);
}
async function demoCombYellow(token) {
  const b = PROPS.find(p => p.burner); if (!b) return false; b.burner.airOpen = false; lightLamp(b); const ok = await demoWait(2300, token); if (ok) logE('obs', [['x.yellowFlameObs']]); return ok;
}
async function demoCombBlue(token) {
  const b = PROPS.find(p => p.burner); if (!b) return false; setBurnerAir(b, true); return demoWait(1800, token);
}
async function demoCombOff(token) { const b = PROPS.find(p => p.burner); if (!b) return false; stopBurner(b); return demoWait(900, token); }

async function demoPourContainer(container, vessel, comp, amount, token) {
  const pose = demoPose(container), height = container.kind === 'bottle' ? BOT_H : container.H, angle = -1.43;
  const mouth = V3(vessel.g.position.x, rimY(vessel) + .028, vessel.g.position.z);
  const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), angle);
  const finalPosition = mouth.clone().sub(V3(0, height, 0).applyQuaternion(q));
  const approach = finalPosition.clone().add(V3(-.035, .055, 0));
  container.open = true; placeLid(container);
  if (!await demoTween(pose, approach, 0, 600, token) || !await demoTween(pose, finalPosition, angle, 500, token)) return false;
  const target = demoTarget(vessel), landing = V3(vessel.g.position.x, vessel.g.position.y + Math.max(vessel.level, vessel.b), vessel.g.position.z);
  drawStream(container, mouth, landing, 2.5);
  let poured = 0;
  while (poured < amount - 1e-6) {
    if (token !== DEMO.token) { drawStream(container, null); return false; }
    const dV = Math.min(.5, amount - poured); deliver(target, comp, dV, landing, 2.5); poured += dV;
    if (container.kind === 'bottle') container.V = Math.max(0, container.V - dV); else container.left = Math.max(0, container.left - dV);
    if (!await demoWait(22, token)) { drawStream(container, null); return false; }
  }
  drawStream(container, null); endSession();
  if (!await demoTween(pose, container.home.clone(), 0, 650, token)) return false;
  container.open = false; container.demoPose = null; return vessel.chem.V >= amount - .1;
}
async function demoBottleInto(id, letter, amount, token) {
  const bottle = bottles.find(o => o.id === id), vessel = vessels.find(v => v.letter === letter);
  return !!(bottle && vessel) && demoPourContainer(bottle, vessel, compOf(id), amount, token);
}
async function demoPropInto(key, letter, amount, token) {
  const prop = PROPS.find(p => p.d.info.it.k === key), vessel = vessels.find(v => v.letter === letter);
  return !!(prop && vessel && prop.chem) && demoPourContainer(prop, vessel, prop.chem.comp, amount, token);
}
async function demoConductVessel(letter, evidence, expected, token) {
  const vessel = vessels.find(v => v.letter === letter), pose = demoPose(tester);
  if (!vessel) return false;
  const tipY = vessel.chem.V > .3 ? Math.max(vessel.g.position.y + vessel.b + .002, vessel.g.position.y + vessel.level - .004) : vessel.g.position.y + vessel.b + .002;
  if (!await demoTween(pose, V3(vessel.g.position.x + vessel.Ri * .18, tipY, vessel.g.position.z), 0, 650, token)) return false;
  const brightness = vessel.chem.V > .3 ? conductivityBrightness(vessel.chem, Z2) : 0, result = condCat(brightness);
  if (result !== expected) return false;
  tester.in = vessel; tester.lying = false; tester.b = brightness;
  TASK.evidence[evidence] = result; logE('obs', [['x.condObs', { b: { k: 'x.condB_' + result } }]], { v: letter, amt: '', f: '' });
  return demoWait(900, token);
}
const demoK111Safety = token => demoWait(700, token);
async function demoK111Dry(token) {
  const vessel = vessels.find(v => v.letter === 'A'); vessel.solid = 2; vessel.visualKick = 1;
  logE('info', [['x.saltIn', { g: fmt(2, 1) }]], { v: 'A', amt: '', f: 'NaCl' });
  return demoConductVessel('A', 'dry', 'off', token);
}
async function demoK111Water(token) { if (!await demoBottleInto('water', 'B', 30, token)) return false; return demoConductVessel('B', 'water', 'off', token); }
async function demoK111Salt(token) { if (!await demoBottleInto('nacl', 'C', 30, token)) return false; return demoConductVessel('C', 'nacl', 'bright', token); }
async function demoK111Sugar(token) {
  if (!await demoBottleInto('water', 'D', 30, token)) return false;
  const vessel = vessels.find(v => v.letter === 'D'); vessel.chem.tot.Suc = 3; vessel.eqDirty = true; vessel.visualKick = 1;
  return demoConductVessel('D', 'sugar', 'off', token);
}
const demoConclusion = token => demoWait(700, token);

async function demoK112Bend(token) {
  for (const rod of RIG.rods) {
    if (rod.k === 'glass') { TASK.evidence.bendGlass = true; logE('obs', [['x.bendGlass']]); }
    else { rod.bent = true; rod.outer.rotation.z = -.5; TASK.evidence['bend_' + rod.k] = true; logE('obs', [['x.bendMetal', { r: { k: 'x.rod_' + rod.k } }]]); }
    if (!await demoWait(320, token)) return false;
  }
  return true;
}
async function demoK112Electrical(token) {
  for (const rod of RIG.rods) {
    const result = rod.k === 'glass' ? 'off' : 'bright'; tester.b = result === 'bright' ? 1 : 0;
    logE('obs', [['x.condRod', { r: { k: 'x.rod_' + rod.k }, b: { k: 'x.condB_' + result } }]]);
    if (!await demoWait(420, token)) return false;
  }
  return true;
}
async function demoK112Light(token) {
  const lamp = PROPS.find(p => p.lamp); if (!lamp) return false;
  lamp.open = true; lamp.lamp.lit = true; logE('info', [['x.lampLit']]); logE('info', [['x.rigHeat']]);
  return demoWait(900, token);
}
async function demoK112Heat(token) {
  const times = { cu: 18, al: 29, fe: 58, glass: 75 };
  for (const key of HEAT_CONDUCTION_ORDER) {
    const rod = RIG.rods.find(r => r.k === key); TASK.evidence[key] = true; rod.first = true;
    if (key === 'glass') logE('obs', [['x.waxGlass']]);
    else { const bead = rod.beads[0]; bead.fallen = true; bead.m.scale.set(1.5, .35, 1.5); logE('obs', [['x.waxObs', { r: { k: 'x.rod_' + key }, d: 5, t: times[key] }]]); }
    if (!await demoWait(550, token)) return false;
  }
  return true;
}
async function demoK112Off(token) {
  const lamp = PROPS.find(p => p.lamp); if (!lamp) return false;
  lamp.open = false; if (lamp.onClose) lamp.onClose(); RIG.heating = false; logE('info', [['x.rigCool']]);
  return demoWait(700, token);
}

const demoK113Safety = token => demoWait(700, token);
async function demoK113Pour(token) {
  if (!await demoBottleInto('water', 'A', 30, token)) return false;
  if (!await demoPropInto('ethanol', 'B', 30, token)) return false;
  return demoPropInto('acetone', 'C', 30, token);
}
async function demoK113Immerse(token) {
  for (const [i, letter] of ['A', 'B', 'C'].entries()) {
    const probe = thermos[i], vessel = vessels.find(v => v.letter === letter), pose = demoPose(probe);
    if (!await demoTween(pose, V3(vessel.base.x + vessel.Ri * .15, vessel.base.y + vessel.b + .004, vessel.base.z), 0, 500, token)) return false;
    probe.in = vessel; probe.lying = false; probe.reading = ROOM_T;
  }
  return demoWait(800, token);
}
async function demoK113Evaporate(token) {
  const solvents = ['water', 'ethanol', 'acetone'];
  for (let i = 0; i < thermos.length; i++) {
    const probe = thermos[i], solvent = solvents[i], cooling = evaporativeCoolingAt(solvent, 1, ROOM_T);
    probe.in = null; probe.reading = cooling.target; TASK.evidence[solvent] = fmt(cooling.drop, 1);
    logE('obs', [['x.evapObs', { s: { k: 'x.solv_' + solvent }, d: fmt(cooling.drop, 1) }]], { v: String.fromCharCode(65 + i), amt: '', f: 'T' + probe.n });
  }
  return demoWait(1800, token);
}
const demoK3Safety = token => demoWait(700, token);
async function demoK3V01Prepare(token) {
  if (!await demoBottleInto('hcl01', 'A', 30, token)) return false;
  return demoBottleInto('acetic01', 'B', 30, token);
}
async function demoK3V01PH(token) {
  if (!await demoPHVessel('A', false, token)) return false;
  return demoPHVessel('B', true, token);
}
async function demoK3V01Conduct(token) {
  if (!await demoConductVessel('A', 'hclCond', 'bright', token)) return false;
  return demoConductVessel('B', 'acCond', 'dim', token);
}
async function demoK3V01Dilute(token) {
  const from = vessels.find(v => v.letter === 'B'), to = vessels.find(v => v.letter === 'C'), pip = pipettes.find(p => p.big), pose = demoPose(pip), aliquot = compOfVessel(from);
  if (!await demoTween(pose, V3(from.g.position.x, from.g.position.y + from.b + .004, from.g.position.z), 0, 600, token)) return false;
  removeLiquid(from, 3); if (!await demoTween(pose, V3(to.g.position.x, to.g.position.y + to.b + .004, to.g.position.z), 0, 700, token)) return false;
  addLiquid(to, aliquot, 3, to.g.position.x, to.g.position.z); pip.demoPose = null;
  if (!await demoBottleInto('water', 'C', 27, token)) return false;
  return demoPHVessel('C', true, token);
}
async function demoPipetteAliquot(id, letter, amount, token) {
  const b = bottles.find(q => q.id === id), v = vessels.find(q => q.letter === letter), pip = pipettes.find(q => q.big), pose = demoPose(pip);
  b.open = true; placeLid(b);
  if (!await demoTween(pose, V3(b.g.position.x, .025, b.g.position.z), 0, 550, token)) return false;
  if (!await demoTween(pose, V3(v.g.position.x, v.g.position.y + v.b + .004, v.g.position.z), 0, 650, token)) return false;
  addLiquid(v, compOf(id), amount, v.g.position.x, v.g.position.z); b.V -= amount; b.open = false; pip.demoPose = null; return demoWait(500, token);
}
async function demoK3V02Prepare(token) {
  if (!await demoPipetteAliquot('vinegar', 'A', 10, token)) return false;
  const v = vessels.find(q => q.letter === 'A'); addLiquid(v, compOf('phph'), .1, v.g.position.x, v.g.position.z); logE('info', [['x.k3v02.indicator']]); return demoWait(600, token);
}
async function demoK3V02Read(token) { BURETTE.mode = 0; logE('obs', [['x.buretteRead', { v: fmt(BURETTE.used, 2) }]]); return demoWait(900, token); }
async function demoK3Titrate(letter, token) {
  const v = vessels.find(q => q.letter === letter), endpoint = TASK.targetC * 100; BURETTE.mode = 1;
  while (BURETTE.used < endpoint - .001) { const dV = Math.min(.1, endpoint - BURETTE.used); addLiquid(v, compOf('naoh01'), dV, v.g.position.x, v.g.position.z); BURETTE.V -= dV; BURETTE.used += dV; doEq(v); if (!await demoWait(24, token)) return false; }
  BURETTE.mode = 0; TASK.endpoint = BURETTE.used; logE('obs', [['x.buretteRead', { v: fmt(BURETTE.used, 2) }]]); return demoWait(1000, token);
}
const demoK3V02Titrate = token => demoK3Titrate('A', token);
async function demoK3V02Repeat(token) {
  BURETTE.reset(true); if (!await demoPipetteAliquot('vinegar', 'B', 10, token)) return false;
  const v = vessels.find(q => q.letter === 'B'); addLiquid(v, compOf('phph'), .1, v.g.position.x, v.g.position.z); v.base.set(BURETTE.outlet.x, 0, BURETTE.outlet.z); return demoK3Titrate('B', token);
}
const DEMO_LIBRARY = {
  acidalkali: [demoIndicator, demoNeutralise],
  phmeasure: [demoMeterOn, t => demoPHVessel('A', false, t), t => demoPHVessel('B', true, t), t => demoPHVessel('C', true, t)],
  combustion: [demoCombSafety, demoCombYellow, demoCombBlue, demoCombOff],
  k111: [demoK111Safety, demoK111Dry, demoK111Water, demoK111Salt, demoK111Sugar, demoConclusion],
  k112: [demoK112Bend, demoK112Electrical, demoK112Light, demoK112Heat, demoK112Off, demoConclusion],
  k113: [demoK113Safety, demoK113Pour, demoK113Immerse, demoK113Evaporate, demoConclusion],
  k3v01: [demoK3Safety, demoK3V01Prepare, demoK3V01PH, demoK3V01Conduct, demoK3V01Dilute, demoConclusion],
  k3v02: [demoK3Safety, demoK3V02Prepare, demoK3V02Read, demoK3V02Titrate, demoK3V02Repeat, demoConclusion],
};
async function runDemoStep(index) {
  if (!DEMO.active || DEMO.running || index < 0 || index >= DEMO.clips.length) return; clearDemoObjects(); note.hidden = true; manEl.hidden = true; manKey = null; analyticsActivity('demo:step', 1, 0, 'demo:step_' + (index + 1)); DEMO.running = true; DEMO.step = index; DEMO.message = null; const token = ++DEMO.token; renderCard();
  const ok = await DEMO.clips[index](token); if (!ok || token !== DEMO.token) return; clearDemoObjects(); DEMO.running = false; DEMO.message = index === DEMO.clips.length - 1 ? 'x.demoDone' : 'x.demoStepDone'; if (index === DEMO.clips.length - 1) { logE('success', [['x.demoDone']]); analyticsCompleteAttempt(); } renderCard();
}
function nextDemo() { if (DEMO.active && !DEMO.running) runDemoStep(DEMO.step + 1); }
function startDemo(task = TASK) {
  const clips = DEMO_LIBRARY[task.id]; if (!clips) return; setupTask(task, 'demo'); DEMO.active = true; DEMO.clips = clips; DEMO.total = clips.length; DEMO.step = -1; DEMO.message = null; stage.classList.add('demo'); instructorTab = 'procedure'; setInspector(true);
  if (!PPE.goggles) setPPE('goggles'); if (!PPE.gloves) setPPE('gloves'); if (task.id === 'combustion') { const shot = combustionShot(); flyTo(shot.t, shot.p); } else { const v = view0(); flyTo(v.t, v.p); } logE('info', [['x.demoBegan']]); runDemoStep(0);
}
function restartDemo() { startDemo(TASK); }
function startMyself() { const task = TASK; cancelDemo(); setupTask(task); instructorTab = 'procedure'; setInspector(true); }
function resetState() {
  RIG.reset(); RIG.g.visible = !!(TASK && TASK.id === 'k112');
  held = null; pending = null; remote = null; endSession();
  for (const o of balanceItems()) setOnBalance(o, false);
  for (const v of vessels) { v.chem = { V: 0, tot: {}, ind: {}, solv: {}, cap: 250 }; setSampleTag(v); v.solid = 0; v.temp = 22; v.warmLogT = 22; v.neutPrev = 0; v.gas = 0; v.visualKick = 0; v.sinkDrain = null; clearFx(v); v.rxHot = false; v.eqDirty = true; v.fullLogged = false; v.held = false; equilibrate(v.chem); const lk = vesselLook(v.chem); v.rgb = lk.rgb.slice(); v.a = lk.a; v.level = levelOf(v); }
  for (const b of bottles) { b.V = STOCK; b.emptyLog = false; b.held = false; b.open = false; b.lidT = 0; b.lidHome = null; }
  for (const q of pipettes) { q.chem = { V: 0, tot: {}, ind: {} }; q.src = null; q.held = false; }
  for (const d of droppers) { unpark(d); d.held = false; }
  spatula.grams = 0; spatula.held = false; rod.held = false; for (const q of probes) { q.held = false; q.in = null; q.reading = ROOM_T; q.b = 0; q.logged = null; q.pend = null; q.pendT = 0; q.wet = q.wetS = null; } electrode.in = null; electrode.home.copy(electrode.home0); electrode.lying = false;
  wash.home.copy(wash.home0); METER.on = false; METER.boot = 0; BAL.on = false; BAL.tare = 0; TAP.on = false; HOOD.fan = false; HOOD.sashT = 0;
  BURETTE.reset(false);
  for (const it of ITEMS) stowItem(it);
  for (const S of [...PROPS]) returnProp(S, true); for (const f of FX) scene.remove(f.g || f.m); FX.length = 0;
  for (const p of ELP) scene.remove(p.mesh); ELP.length = 0; for (const v of vessels) clearPieces(v);
  if (typeof PT !== 'undefined') { for (const S of PT.samples) if (S.lid) { scene.remove(S.lid); removeButton(S.lidProxy); } JAR_LABELS.clear(); for (const D of PT.doors) if (D.sample) { removeButton(D.sample.proxy); scene.remove(D.sample.m); D.sample = null; } for (const S of [...PT.samples]) { scene.remove(S.g); } PT.samples.length = 0; for (const D of PT.doors) { D.target = 0; D.stocked = true; } refreshPickables(); }
}
function setupTask(task, mode = task.free ? 'free' : 'independent') {
  cancelDemo();
  TASK = task; TASK.reached = false; TASK.seen = new Set(); TASK.progress = 0; dealUnknowns(task); PPE.warned = PPE.gl = PPE.fl = false; resetState();
  analyticsStartAttempt(task.id, mode);
  if (task.id === 'k3v02') {
    task.targetC = .06 + Math.random() * .04;
    task.endpoint = null;
    REAG.vinegar.tot = { Ac: task.targetC };
    const vinegarBottle = bottles.find(b => b.id === 'vinegar'); if (vinegarBottle) tintBottle(vinegarBottle);
  }
  for (const [key, fill] of task.setup) {
    if (key.startsWith('decor:') || key.startsWith('glass:')) {
      const propKey = key.slice(key.indexOf(':') + 1), d = DECOR_PICK.find(q => q.info && q.info.it && q.info.it.k === propKey && q.info.ranges);
      if (!d || !takeProp(d)) continue;
      const o = d.info.taken, pos = { sucrose: [.34, .18], ethanol: [-.18, .18], acetone: [.16, .18], lamp: [-.06, .06], matches: [.16, .06] }[propKey] || [0, .15];
      o.fly = null; o.area = 'bench'; o.home.set(pos[0], 0, pos[1]); o.g.position.copy(o.home); continue;
    }
    const it = ITEMS.find(i => i.key === key); if (!it) continue; const o = it.obj;
    const home = o.kind === 'vessel' ? o.base0 : o.home0 || (o.kind === 'dropper' ? V3(o.bx0, 0, o.bz0) : null);
    if (it.key === 'jar') placeItem(it, JAR.x0, JAR.z0); else if (o.kind === 'dropper') placeItem(it, o.bx0, o.bz0); else if (o.kind === 'pipette' || o.kind === 'spatula' || o.kind === 'rod') placeItem(it, o.home0.x, o.home0.z); else placeItem(it, home.x, home.z);
    if (fill) { o.chem.V = fill.V || 0; o.chem.tot = { ...(fill.tot || {}) }; o.chem.solv = { ...(fill.solv || {}) }; o.solid = fill.solid || 0; equilibrate(o.chem); const lk = vesselLook(o.chem); o.rgb = lk.rgb.slice(); o.a = lk.a; o.level = levelOf(o); o.eqDirty = true; }
  }
  if (task.id === 'phmeasure') {
    const tags = { A: ['A · HCl', '0.10 M · 75 mL'], B: ['B · HCl', '0.010 M · 75 mL'], C: ['C · CH₃COOH', '0.10 M · 75 mL'] };
    for (const v of vessels) if (tags[v.letter]) setSampleTag(v, ...tags[v.letter]);
  }
  if (task.id === 'k3v01') {
    const tags = { A: ['A · 0.10 M HCl', 'strong acid'], B: ['B · 0.10 M CH₃COOH', 'weak acid'], C: ['C · diluted CH₃COOH', '1:10 dilution'] };
    for (const v of vessels) if (tags[v.letter]) setSampleTag(v, ...tags[v.letter]);
  }
  if (task.id === 'k3v02') {
    BURETTE.reset(true);
    const a = vessels.find(v => v.letter === 'A'), b = vessels.find(v => v.letter === 'B');
    a.base.set(BURETTE.outlet.x, 0, BURETTE.outlet.z); b.base.set(.36, 0, .14);
    setSampleTag(vessels.find(v => v.letter === 'A'), 'A · titration flask', '10.00 mL diluted vinegar');
    setSampleTag(vessels.find(v => v.letter === 'B'), 'B · repeat flask', '10.00 mL diluted vinegar');
  }
  for (const spec of task.props || []) {
    const d = DECOR_PICK.find(q => q.info && q.info.it && q.info.it.k === spec.key && q.info.ranges);
    if (!d || !takeProp(d)) continue;
    const o = d.info.taken; o.fly = null; o.area = 'hood'; o.home.set(spec.x, 0, spec.z); o.g.position.copy(o.home);
  }
  NB.log = []; NB.t0 = performance.now(); NB.started = Date.now(); logE('info', [[task.start]]);
  renderCard(); renderInv(); if (task.id === 'combustion') { const shot = combustionShot(); flyTo(shot.t, shot.p); } else { const v = view0(); flyTo(v.t, v.p); }
}
function checkTask() {
  if (!TASK || !TASK.check || TASK.reached) return;
  const hit = TASK.check(); if (!hit) return;
  TASK.reached = true; logE('success', [[TASK.done, { v: hit.letter }]]); analyticsCompleteAttempt(); buzz(30); renderCard();
}

/* ---------- Student lab catalogue: visible filters and clear experiment cards. ---------- */
const LABS = [
  { id: 'acidalkali', run: 'acidalkali', level: 'high', course: 'inorganic', tp: 'acidbase', icon: '🌈', title: 'x.title', goal: 'x.goal', desc: 'lab.acid.desc', time: '12–15 min' },
  { id: 'phmeasure', run: 'phmeasure', level: 'high', course: 'inorganic', tp: 'acidbase', icon: '📟', title: 'lab.ph.title', goal: 'lab.ph.goal', desc: 'lab.ph.desc', time: '10–12 min' },
  { id: 'combustion', run: 'combustion', level: 'high', course: 'organic', tp: 'hydrocarbons', icon: '🔥', title: 'lab.comb.title', goal: 'lab.comb.goal', desc: 'lab.comb.desc', time: '8–10 min' },
  { id: 'k111', run: 'k111', level: 'high', course: 'inorganic', tp: 'bond', icon: '💡', title: 'x.k111.title', goal: 'x.k111.goal', desc: 'x.k111.desc', time: '12–15 min' },
  { id: 'k112', run: 'k112', level: 'high', course: 'inorganic', tp: 'bond', icon: '🔩', title: 'x.k112.title', goal: 'x.k112.goal', desc: 'x.k112.desc', time: '15–20 min' },
  { id: 'k113', run: 'k113', level: 'high', course: 'inorganic', tp: 'bond', icon: '💧', title: 'x.k113.title', goal: 'x.k113.goal', desc: 'x.k113.desc', time: '12–15 min' },
  { id: 'k3v01', run: 'k3v01', level: 'high', course: 'organic', tp: 'carboxylic', icon: '⚡', title: 'x.k3v01.title', goal: 'x.k3v01.goal', desc: 'x.k3v01.desc', time: '15–18 min' },
  { id: 'k3v02', run: 'k3v02', level: 'high', course: 'organic', tp: 'carboxylic', icon: '🧪', title: 'x.k3v02.title', goal: 'x.k3v02.goal', desc: 'x.k3v02.desc', time: '18–22 min' },
];
const labSel = { level: 'high', course: 'all', tp: 'all' };
function openLabs() {
  const pk = $('picker'); pk.replaceChildren(); pk.hidden = false;
  const box = document.createElement('div'); box.className = 'pbox';
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const head = el('div', 'phead'); head.append(el('h2', null, '🧪 ' + T('x.labsTitle')));
  const x = el('button', 'invx', '×'); x.type = 'button'; x.setAttribute('aria-label', T('x.close')); x.addEventListener('click', () => { pk.hidden = true; }); head.append(x); box.append(head);
  box.append(el('p', 'labintro', T('x.labIntro')));
  const filters = el('div', 'labfilters');
  const filter = (label, values, selected, set) => { const row = el('div', 'filterrow'); row.append(el('span', null, label)); for (const [value, labelText, disabled] of values) { const b = el('button', null, labelText); b.type = 'button'; b.disabled = !!disabled; b.setAttribute('aria-pressed', String(selected === value)); if (!disabled) b.addEventListener('click', () => { set(value); openLabs(); }); row.append(b); } filters.append(row); };
  filter(T('x.level'), [['high', T('x.levelHigh')], ['university', T('x.levelUniversity'), true]], labSel.level, v => { labSel.level = v; });
  filter(T('x.branch'), [['all', T('x.all')], ['inorganic', T('x.course.inorganic')], ['organic', T('x.course.organic')]], labSel.course, v => { labSel.course = v; labSel.tp = 'all'; });
  filter(T('x.topic'), [['all', T('x.all')], ['acidbase', T('topic.acidbase')], ['hydrocarbons', T('topic.hydrocarbons')], ['bond', T('topic.bond')], ['carboxylic', T('topic.carboxylic')]], labSel.tp, v => { labSel.tp = v; });
  box.append(filters);
  const grid = el('div', 'labgrid'), shown = LABS.filter(l => l.level === labSel.level && (labSel.course === 'all' || l.course === labSel.course) && (labSel.tp === 'all' || l.tp === labSel.tp));
  const launch = (l, demoMode) => { pk.hidden = true; const task = TASKS.find(t => t.id === l.run); instructorTab = 'procedure'; if (demoMode) startDemo(task); else { setupTask(task); setInspector(true); } };
  for (const l of shown) {
    const card = el('article', 'pcard labcard ready'); card.append(el('div', 'labicon', l.icon));
    card.append(el('div', 'labmeta', T('x.levelHigh') + ' · ' + T('x.course.' + l.course) + ' · ' + T('topic.' + l.tp)));
    const hasDemo = !!DEMO_LIBRARY[l.run];
    card.append(el('b', null, T(l.title)), el('span', 'labdesc', T(l.desc)), el('span', 'labmeta', l.time + (hasDemo ? ' · ' + T('x.guidedDemo') : '')));
    const acts = el('div', 'labactions'), start = el('button', 'start', T('x.startLab')); start.type = 'button'; start.addEventListener('click', () => launch(l, false)); acts.append(start);
    if (hasDemo) { const demo = el('button', null, T('x.watchDemo')); demo.type = 'button'; demo.addEventListener('click', () => launch(l, true)); acts.append(demo); }
    card.append(acts); grid.append(card);
  }
  if (!shown.length) grid.append(el('p', 'labempty', T('x.noLabs'))); box.append(grid);
  const free = el('button', 'freebench', T('x.openFreeBench')); free.type = 'button'; free.addEventListener('click', () => { pk.hidden = true; setupTask(TASKS[0]); setInspector(true); }); box.append(free);
  pk.append(box);
}
const openPicker = openLabs;

/* ---------- inventory panel: closet and chemical shelf ---------- */
let invOpen = null;
const ICON = {
  thermo: '<path d="M12 3h5v9h-5zM14.5 12v13"/><path d="M13 6h3"/>',
  beaker: '<path d="M7 4h14M8 4v17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4"/><path d="M8 14h12"/>',
  bottle: '<path d="M11 3h6v4l3 4v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V11l3-4z"/><path d="M8 15h12"/>',
  dropper: '<path d="M12 3h4v4h-4zM11 7h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V11z"/>',
  pipette: '<path d="M14 2v4M12 6h4v14l-2 4-2-4z"/><path d="M12 12h2M12 16h2"/>',
  rod: '<path d="M8 24L20 4"/>',
  spatula: '<path d="M5 22l12-12M17 10c2-2 5-3 6-2s0 4-2 6-4 2-4 2"/>',
  jar: '<path d="M7 7h14v15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM6 4h16v3H6z"/><path d="M9 15h10"/>',
};
function renderInv() {
  const box = $('inv'); if (!box) return; invOpen = null; box.replaceChildren(); box.hidden = !invOpen;
  const tb = $('invbtns'); if (tb) for (const b of tb.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.shelf === invOpen);
  if (!invOpen) return;
  const hd = document.createElement('div'); hd.className = 'invh';
  const tt = document.createElement('b'); tt.textContent = T(invOpen === 'glass' ? 'x.closet' : 'x.shelf');
  const sub = document.createElement('span'); sub.textContent = T('x.invHint');
  const x = document.createElement('button'); x.type = 'button'; x.className = 'invx'; x.textContent = '×'; x.setAttribute('aria-label', T('x.close')); x.addEventListener('click', () => { invOpen = null; renderInv(); });
  hd.append(tt, sub, x); box.append(hd);
  const grid = document.createElement('div'); grid.className = 'invg';
  for (const it of ITEMS.filter(i => i.shelf === invOpen)) {
    const on = !it.obj.stowed;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'invi' + (on ? ' on' : '');
    b.innerHTML = `<svg viewBox="0 0 28 28" aria-hidden="true">${ICON[it.icon]}</svg>`;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = it.name();
    const st = document.createElement('span'); st.className = 's'; st.textContent = T(on ? 'x.invOn' : 'x.invTake');
    b.append(n, st);
    b.addEventListener('click', () => {
      if (!on) { takeItem(it); if (MOBILE) { invOpen = null; } }
      else { const why = putBack(it); if (why) { const r = b.getBoundingClientRect(), sr = stage.getBoundingClientRect(); showMsg(T(why, { n: it.name() })); } }
      renderInv();
    });
    grid.append(b);
  }
  box.append(grid);
}
let shelfView = null;
const SHELF_Y = { T: .9, M2: .5, M1: .13, B: -.7 };
const CAB_Z = { acid: -.23, gen: .37, ox: .92, base: 1.37 };
function viewShelf(sh, cab, lvl) {
  const portrait = camera.aspect < .85;
  let t, p;
  if (sh === 'glass') { const y = SHELF_Y[lvl || 'M2'], sc = ROOM.glass.secs[cab || 0], zc = (sc[0] + sc[1]) / 2; t = V3(-1.93, y, zc); p = V3(-1.93 + (portrait ? 2.1 : 1.35), y, zc); }
  else if (cab === 'gas') { t = V3(2.1, .55, 2.37); p = V3(portrait ? -.6 : .05, .55, 2.37); }
  else if (!cab) { const y = SHELF_Y[lvl || 'M2'], zc = .57; t = V3(2.08, y, zc); p = V3(2.08 - (portrait ? 3.0 : 2.15), y, zc); }
  else { const y = SHELF_Y[lvl || 'M2'], zc = CAB_Z[cab]; t = V3(2.08, y, zc); p = V3(2.08 - (portrait ? 1.45 : 1.0), y, zc); }
  flyTo(t, p); shelfView = { sh, cab: cab ?? null, lvl: lvl || 'M2' }; markShelfBtns(); renderPlaces();
}
function viewFlammables() {
  const t = V3(ROOM.flam.x, -.52, ROOM.flam.z), portrait = camera.aspect < .85;
  flyTo(t, V3(ROOM.flam.x - (portrait ? 1.55 : 1.1), -.43, ROOM.flam.z)); shelfView = { sh: 'flam', cab: 'flam' }; markShelfBtns(); renderPlaces();
}
/* element cabinet wall view: framed close-ups of row groups; one-finger drag slides along the wall */
const PT_PARTS = { all: () => true, p13: Z => Z <= 18, p45: Z => Z >= 19 && Z <= 54, p67: Z => Z === 55 || Z === 56 || (Z >= 72 && Z <= 88) || Z >= 104, f: Z => (Z >= 57 && Z <= 71) || (Z >= 89 && Z <= 103) };
let ptHalf = 'L';
function ptFrame(part, half) {
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (let Z = 1; Z <= 118; Z++) { if (!PT_PARTS[part](Z)) continue; const q = ptPos(Z); if ((half === 'L' && q.x > 0) || (half === 'R' && q.x < 0)) continue;
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  if (half) { const e = PT.x0 + .5 * PT.cell, m = PT.x0 + 8.5 * PT.cell; [x0, x1] = half === 'L' ? [e, m] : [-m, -e]; }
  const w = x1 - x0 + PT.cell + .05, h = y1 - y0 + PT.cell + .07, tv = Math.tan(D2R(camera.fov / 2));
  const d = Math.max(h / 2 / tv, w / 2 / (tv * camera.aspect)) * 1.04;
  const t = V3((x0 + x1) / 2, (y0 + y1) / 2 + .012, PT.z);
  return { t, p: V3(t.x, t.y, PT.z + .04 + d) };
}
function viewPT(part, half) {
  part = part || 'all'; const narrow = camera.aspect < 1.1;
  if (half) ptHalf = half;
  const hf = narrow && part !== 'all' ? ptHalf : null;
  const f = ptFrame(part, hf);
  flyTo(f.t, f.p); shelfView = { sh: 'pt', part, half: hf }; markShelfBtns(); renderPlaces();
}
function goShelf(sh) {
  if (shelfView && shelfView.sh === sh) { shelfView = null; goPlace(PLACES[1][1]); markShelfBtns(); renderPlaces(); return; }
  viewShelf(sh, sh === 'glass' ? 0 : null, 'M2');
}
function markShelfBtns() { const tb = $('invbtns'); if (tb) for (const b of tb.querySelectorAll('button')) b.setAttribute('aria-pressed', !!shelfView && b.dataset.shelf === (shelfView.sh === 'flam' ? 'chem' : shelfView.sh)); }
function showMsg(txt) { const n = $('invmsg'); if (!n) return; n.textContent = txt; n.hidden = false; clearTimeout(showMsg.t); showMsg.t = setTimeout(() => { n.hidden = true; }, 4500); }

/* ===================== INPUT ===================== */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let held = null, pending = null, hover = null; const ptr = V3(); let ptrOK = false; const scr = { x: 0, y: 0 };
const carryPlane = new THREE.Plane(V3(0, 1, 0), 0);
function setNdc(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
const carryH = o => o.kind === 'bottle' ? .19 : o.kind === 'vessel' ? .16 : o.kind === 'dropper' ? .17 : o.kind === 'wash' ? .18 : .16;
/* SHAKE — a quick side-to-side wiggle of the finger or mouse (≥3 direction changes of 12 px+ within 0.7 s) while holding an object,
   or a real phone shake where the motion sensor is available. TILT — where the orientation sensor answers, tipping the phone sideways
   while pouring adds to the bottle's tilt; dragging still works everywhere (desktop, whiteboard). */
const WG = { hist: [], last: 0 };
function trackWiggle(x, now) {
  const h = WG.hist; h.push({ x, t: now }); while (h.length && now - h[0].t > 800) h.shift();
  let rev = 0, dir = 0, ext = h.length ? h[0].x : x;
  for (const p of h) { const d = p.x - ext; if (Math.abs(d) >= 9) { const nd = Math.sign(d); if (dir && nd !== dir) rev++; dir = nd; ext = p.x; } else if ((dir > 0 && p.x > ext) || (dir < 0 && p.x < ext)) ext = p.x; }
  if (rev >= 2 && now - WG.last > 600) { WG.last = now; h.length = 0; onShake('wiggle'); }
}
const MOTION = { shakeOK: false, tiltOK: false, gamma: null, peaks: [], asked: false };
function onShake(src) {
  const o = held; if (!o || o.pour || o.pz) return;
  if (o.kind === 'vessel') {
    o.stir = 1; o.swirl = Math.max(o.swirl, .8);
    for (let i = 0; i < 4; i++) addWave(o, (Math.random() - .5) * .04, (Math.random() - .5) * .04, .0009);
    if (o.chem.V > 150) for (let k = 0; k < 4; k++) SPL.push({ x: o.g.position.x + (Math.random() - .5) * .05, y: o.g.position.y + o.H, z: o.g.position.z + (Math.random() - .5) * .05, vx: (Math.random() - .5) * .3, vy: .3, vz: (Math.random() - .5) * .3, r: .0007 });
    if (!o.shakeT || performance.now() - o.shakeT > 4000) { o.shakeT = performance.now(); logE('info', [['x.shaken', { v: o.letter }]]); }
  }
  o.jiggle = 1; buzz(20);
}
window.addEventListener('devicemotion', e => {
  const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null; if (!a) return; MOTION.shakeOK = true;
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = performance.now();
  if (m > 14) { MOTION.peaks.push(now); MOTION.peaks = MOTION.peaks.filter(t => now - t < 700); if (MOTION.peaks.length >= 3 && now - WG.last > 600) { WG.last = now; MOTION.peaks = []; onShake('phone'); } }
});
window.addEventListener('deviceorientation', e => { if (e.gamma == null) return; MOTION.tiltOK = true; MOTION.gamma = e.gamma; });
function askMotion() {
  if (MOTION.asked) return; MOTION.asked = true;
  setTimeout(() => { if (!MOTION.shakeOK && !MOTION.tiltOK) { MOTION.blocked = true; logE('info', [['x.noSensors']]); } }, 4000);
  for (const C of [window.DeviceMotionEvent, window.DeviceOrientationEvent]) if (C && typeof C.requestPermission === 'function') C.requestPermission().catch(() => { });
}
const TOUCH_LIFT = 72; // px: on touch screens the held object floats above the fingertip so it stays visible
function pipDrag(o, y) {
  const z = o.pz, now = performance.now(), dy = y - z.ly, dtm = Math.max(1, now - z.lt); z.ly = y; z.lt = now;
  const sp = Math.abs(dy) / dtm, k = o.kMin + (o.kMax - o.kMin) * clamp((sp - .15) / 1.2, 0, 1);
  z.vT = clamp(z.vT - dy * k, 0, o.cap);
}
let lastEv = null;
const HELD_R = o => o.kind === 'holder' ? .022 : o.kind === 'pipette' ? .012 : o.kind === 'dropper' ? .02 : o.kind === 'vessel' ? o.R + .002 : o.kind === 'bottle' ? BOT_R : o.kind === 'wash' ? .032 : o.kind === 'sample' ? .026 : o.kind === 'prop' ? o.R : 0;
function keepApart(o) {
  if (!o) return; const r = HELD_R(o); if (!r || !ptrOK) return;
  const canEnter = o.kind === 'pipette' ? pipTarget(o) : (o.kind === 'vessel' || o.kind === 'bottle' || o.kind === 'wash' || (o.kind === 'sample' && o.open && o.left > 0) || (o.kind === 'prop' && o.open && o.chem && o.left > 0)) && findTarget(o);
  if (canEnter) return;
  const circ = obstacles(o);
  for (let it = 0; it < 6; it++) { let moved = false;
    for (const [cx, cz, cr] of circ) { const dx = ptr.x - cx, dz = ptr.z - cz, d = Math.hypot(dx, dz), m = cr + r + .003; if (d < m) { const k = d > 1e-5 ? m / d : 0; ptr.x = cx + (d > 1e-5 ? dx * k : m); ptr.z = cz + dz * k; moved = true; } }
    if (!moved) break; }
  // Fixed equipment is solid too. Push the carried footprint to the nearest
  // side instead of allowing bottles and glassware to pass through it.
  const landingOnPan = balanceItems().includes(o) && Math.hypot(ptr.x - BAL.pan.x, ptr.z - BAL.pan.z) < .115;
  const fixedRects = landingOnPan ? [[SINK.x0, SINK.x1, SINK.z0, SINK.z1]] : [[BAL.x - .1, BAL.x + .1, BAL.z - .125, BAL.z + .155], [SINK.x0, SINK.x1, SINK.z0, SINK.z1]];
  for (const [x0, x1, z0, z1] of fixedRects) {
    if (ptr.x <= x0 - r || ptr.x >= x1 + r || ptr.z <= z0 - r || ptr.z >= z1 + r) continue;
    const opts = [[x0 - r - .004 - ptr.x, 0], [x1 + r + .004 - ptr.x, 0], [0, z0 - r - .004 - ptr.z], [0, z1 + r + .004 - ptr.z]].sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
    ptr.x += opts[0][0]; ptr.z += opts[0][1];
  }
}
function moveHeld(e) { renderer.domElement.style.cursor = 'grabbing';
  moveHeld0(e); }
function moveHeld0(e) { lastEv = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType }; if (held && held.kind === 'pipette' && held.pz) pipDrag(held, e.clientY); scr.x = e.clientX; scr.y = e.clientY; trackWiggle(e.clientX, performance.now()); setNdc(e.pointerType === 'touch' ? { clientX: e.clientX, clientY: e.clientY - TOUCH_LIFT } : e); carryPlane.constant = -.075; ptrOK = !!ray.ray.intersectPlane(carryPlane, ptr); if (ptrOK && held && held.area === 'hood') { const A = AREAS.hood; ptr.x = clamp(ptr.x, A[0], A[1]); ptr.z = clamp(ptr.z, A[2], A[3]); } else if (ptrOK) { ptr.x = clamp(ptr.x, -.6, .7); ptr.z = clamp(ptr.z, -.32, .32); const tx = SINK.cx, tz = SINK.z0 - .03, d = Math.hypot(ptr.x - tx, ptr.z - tz); if (d < .055) { const k = .055 / Math.max(d, 1e-4); ptr.x = tx + (ptr.x - tx) * k; ptr.z = tz + (ptr.z - tz) * (d < 1e-4 ? 0 : k) + (d < 1e-4 ? .055 : 0); } } keepApart(held); }
function unpark(d) { if (d.parked) { if (NB.session && NB.session.id === d.id) endSession(); d.parked = null; d.count = 0; } }
function toggleDropper(d) {
  if (d.held || d.parked) return;
  d.open = !d.open; buzz(8);
  analyticsActivity((d.open ? 'open:' : 'close:') + 'dropper:' + d.id);
  if (d.open) {
    const q = findSpot(d, d.bx + .05, d.bz, .018); d.home.set(q.x, .006, q.z); d.proxy.userData.obj = d;
  } else {
    d.home.set(d.bx, .006, d.bz); d.proxy.userData.obj = d.lidControl;
  }
  logE('info', [[d.open ? 'x.jarOpened' : 'x.jarClosed', { n: T(REAG[d.id].name) }]]);
}
function undockAll() { for (const o of [...bottles, ...vessels]) if (o.docked) { o.docked = false; o.pour = null; } }
function startHold(o, e, part) {
  // Dragging a closed working bottle is an intent to use it: remove its cap
  // first so the familiar drag-to-pour gesture cannot silently do nothing.
  if (o.kind === 'bottle' && !o.open) toggleBottle(o);
  if (o.docked) {
    o.docked = false;
    if (o.kind === 'pipette') { o.pz = null; o.tg = null; o.cand = null; o.block = null; }
    else if (o.pour) { o.pour.y0 = e.clientY; o.pour.x0 = e.clientX; o.pour.base = o.tilt; }
  }
  if (o.kind === 'vessel' || o.kind === 'bottle') for (const q of pipettes) if (q.docked && q.pz && (q.pz.tg.v === o || q.pz.tg.b === o)) { q.docked = false; q.pz = null; q.home.copy(findSpot(q, q.g.position.x + q.L / 2, q.g.position.z, .03)).add(V3(-q.L / 2, .0072, 0)); q.lying = true; if (q.chem.V > .004) { logE('mistake', [['x.pipSpill', { a: fmtPip(q) }]]); q.chem = { V: 0, tot: {}, ind: {} }; } }
  if (o.kind === 'dropper') o.dragWhole = part === 'dropperBody';
  setOnBalance(o, false);
  held = o; o.held = true; hover = null; $('tip').hidden = true;
  if (o.kind === 'vessel') { o.onBalance = false; o.inSink = false; o.sinkDrain = null; for (const s of [electrode, rod, ...probes]) if (s.in === o) s.in = null; for (const d of droppers) if (d.parked === o) unpark(d); for (const q of pipettes) if (q.in === o) q.in = null; }
  if (o.kind === 'dropper' && o.parked && !o.dragWhole) unpark(o);
  if (o.kind === 'electrode' || o.kind === 'rod' || o.kind === 'thermo') o.in = null;
  moveHeld(e);
}
let remote = null;
const BX = new THREE.Box3(), CRN = Array.from({ length: 8 }, () => V3());
/* ray first; if it misses, take the object whose on-screen outline is within a finger's width of the pointer (thin pipettes, rods) */
function pickAt(e) {
  setNdc(e); const h = ray.intersectObjects(pickables, false)[0]; if (h) return h;
  const r = renderer.domElement.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, pad = e.pointerType === 'touch' ? 26 : 12;
  let best = null, bestD = Infinity;
  for (const m of pickables) {
    if (!m.parent || (m.userData.obj && m.userData.obj.kind === 'button')) continue;
    BX.setFromObject(m); if (BX.isEmpty()) continue;
    let i = 0; for (const x of [BX.min.x, BX.max.x]) for (const y of [BX.min.y, BX.max.y]) for (const z of [BX.min.z, BX.max.z]) CRN[i++].set(x, y, z).project(camera);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
    for (const c of CRN) { if (c.z > 1) behind = true; const sx = (c.x + 1) / 2 * r.width, sy = (1 - c.y) / 2 * r.height; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    if (behind) continue;
    const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1), d = Math.hypot(dx, dy);
    if (d < pad && d < bestD) { bestD = d; best = m; }
  }
  return best ? { object: best } : null;
}
const dockedObj = () => [...bottles, ...vessels].find(o => o.docked && o.pour) || pipettes.find(o => o.docked && o.pz);
/* Two fingers: pinch zooms toward their midpoint and sliding both pans the
   current view. Named buttons, rather than gestures, select fixed viewpoints. */
const TT = new Map(); let two = null;
/* move the camera along the line toward a screen point, without turning it (wheel and pinch) */
function zoomAbout(cx, cy, f) {
  const dist = camera.position.distanceTo(controls.target), nd = clamp(dist * f, controls.minDistance, controls.maxDistance); f = nd / dist; if (Math.abs(f - 1) < 1e-5) return;
  const fwd = V3(); camera.getWorldDirection(fwd); setNdc({ clientX: cx, clientY: cy }); const M = V3();
  if (ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(fwd, controls.target), M)) { camera.position.sub(M).multiplyScalar(f).add(M); controls.target.sub(M).multiplyScalar(f).add(M); }
  camAnim = null; viewTouched = true;
}
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  // A forward/up roll has a negative delta and moves closer; a backward/down
  // roll moves away. Zoom around the pointer so the object under it stays put.
  const scale = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 240 : 1;
  const delta = clamp(e.deltaY * scale, -180, 180);
  if (Math.abs(delta) > .01) zoomAbout(e.clientX, e.clientY, Math.exp(delta * .0018));
}, { passive: false });
const twoState = () => { const [a, b] = [...TT.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) }; };
function panTwoPixels(dx, dy) {
  const r = renderer.domElement.getBoundingClientRect(), dist = camera.position.distanceTo(controls.target), k = 2 * dist * Math.tan(D2R(camera.fov / 2)) / r.height;
  const fwd = V3(); camera.getWorldDirection(fwd); const right = V3(-fwd.z, 0, fwd.x); if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize();
  const d = right.multiplyScalar(-dx * k).add(V3(0, dy * k, 0)); controls.target.add(d); camera.position.add(d);
}
const touchIds = { get size() { return TT.size; } };
stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; TT.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (TT.size === 2 && !held) { pending = null; remote = null; controls.enabled = false; viewTouched = true; const s = twoState(); two = { ...s, sx: s.x, sy: s.y, sd: s.d, mode: 'pending' }; } }, true);
window.addEventListener('pointermove', e => {
  if (!TT.has(e.pointerId)) return; TT.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!two || TT.size < 2) return;
  const s = twoState(), tx = s.x - two.sx, ty = s.y - two.sy, spread = s.d - two.sd;
  if (two.mode === 'pending') {
    if (Math.abs(spread) > 10) two.mode = 'pinch';
    else if (Math.hypot(tx, ty) > 14) two.mode = 'pan';
  }
  // Diverging fingers reduce camera distance (zoom in); converging fingers
  // increase it (zoom out). Use the previous separation for smooth scaling.
  if (two.mode === 'pinch') {
    zoomAbout(s.x, s.y, clamp(two.d / s.d, .75, 1.33));
    e.preventDefault();
  } else if (two.mode === 'pan') {
    panTwoPixels(s.x - two.x, s.y - two.y);
    camAnim = null; viewTouched = true; e.preventDefault();
  }
  two.x = s.x; two.y = s.y; two.d = s.d;
}, true);
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => {
  if (!TT.delete(e.pointerId)) return;
  if (TT.size < 2 && two) {
    two = null;
  }
  if (TT.size === 0 && !held) controls.enabled = true;
}, true);
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && touchIds.size >= 2) return;
  if (e.pointerType === 'touch') askMotion();
  const hit = pickAt(e);
  const hitObj = hit && hit.object.userData.obj;
  const dk = dockedObj();
  if (hitObj && hitObj.kind === 'pipControl' && hitObj.pip.docked && hitObj.pip.pz) {
    const p = hitObj.pip; controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { }
    remote = { o: p, x: e.clientX, y: e.clientY, moved: false }; p.pz.ly = e.clientY; p.pz.lt = performance.now(); e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (dk && dk.kind !== 'pipette' && (!hit || hitObj !== dk) && !(hitObj && hitObj.kind === 'button')) {
    controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { }
    remote = { o: dk, x: e.clientX, y: e.clientY, moved: false };
    if (dk.pour) { dk.pour.y0 = e.clientY; dk.pour.x0 = e.clientX; dk.pour.base = dk.tilt; scr.y = e.clientY; scr.x = e.clientX; }
    if (dk.pz) { dk.pz.ly = e.clientY; dk.pz.lt = performance.now(); }
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (!hit) return;
  controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { }
  pending = { o: hit.object.userData.obj, part: hit.object.userData.part, x: e.clientX, y: e.clientY }; e.preventDefault();
});
renderer.domElement.addEventListener('pointermove', e => {
  if (remote) { const o = remote.o; if (Math.hypot(e.clientX - remote.x, e.clientY - remote.y) > 6) remote.moved = true;
    if (o.pour) { scr.y = e.clientY; scr.x = e.clientX; o.pour.x0 = e.clientX; } if (o.pz) pipDrag(o, e.clientY); return; }
  /* a drag that starts on a button, door or stowed item is a view drag, not a tap: hand it back to the camera */
  if (pending && !held && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 9 && (pending.o.kind === 'button' || pending.o.kind === 'pipControl' || pending.o.kind === 'jar' || pending.o.stowed)) { pending = null; controls.enabled = true; return; }
  if (pending && !held && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 6 && pending.o.kind !== 'button' && pending.o.kind !== 'pipControl' && pending.o.kind !== 'jar' && !pending.o.stowed) { startHold(pending.o, e, pending.part); pending = null; }
  if (held) { moveHeld(e); return; }
  if (pending) return;
  setNdc(e); const hit = ray.intersectObjects(pickables, false)[0]; hover = hit ? hit.object.userData.obj : null;
  renderer.domElement.style.cursor = hover ? (hover.kind === 'button' || hover.kind === 'pipControl' || hover.parked ? 'pointer' : 'grab') : (decorAt(e) ? 'grab' : 'default');
  const tip = $('tip'); if (hover && !hover.noTip) { const r = stage.getBoundingClientRect(); tip.hidden = false; tip.textContent = hover.stowed ? ((itemOf(hover) || { name: () => '' }).name() + ' — ' + T('x.tapTake')) : hover.label(); placeTip(tip, e.clientX - r.left, e.clientY - r.top, 14); } else tip.hidden = true;
});
function release() {
  if (remote) { const o = remote.o, tap = !remote.moved; remote = null; controls.enabled = true;
    if (tap && !o.pz) { o.docked = false; o.pour = null; endSession(); } return; }
  if (pending && !held) { const p = pending, o = p.o; pending = null; controls.enabled = true; if (o.stowed) { const it = itemOf(o) || ITEMS.find(i => i.key === 'jar'); if (it) takeItem(it); return; } if (p.part === 'dropperBody') { showManual('dropper'); return; } if (o.tap) o.tap(); return; }
  pending = null; controls.enabled = true; if (!held) return;
  const o = held; held = null; o.held = false; endSession();
  if ((o.kind === 'vessel' || o.kind === 'bottle') && o.pour) { o.docked = true; o.pour.y0 = scr.y; o.pour.base = o.tilt; buzz(10); return; }
  if (placeOnBalance(o)) return;
  if (o.kind === 'pipette') {
    // Release is the docking decision. A valid mouth does not require the
    // student to wait for the hover timer before letting go.
    const tg = (o.pz && o.pz.tg) || o.tg || pipTarget(o);
    if (dockPipette(o, tg)) return;
  }
  if (o.kind === 'vessel') placeVessel(o);
  if (o.kind === 'sample') setOnBalance(o, false);
  if (o.kind === 'bottle') { o.home.copy(findSpot(o, o.g.position.x, o.g.position.z, BOT_R)); o.emptyLog = o.V <= .005; }
  if (o.kind === 'wash') o.home.copy(findSpot(o, o.g.position.x, o.g.position.z, .032));
  if (o.kind === 'holder') { const q = findSpot(o, o.g.position.x, o.g.position.z, .022); o.home.set(q.x, 0, q.z); }
  if (o.kind === 'sample' || o.kind === 'prop') { setOnBalance(o, false); const q = findSpot(o, o.g.position.x, o.g.position.z, o.R || .03); o.home.set(q.x, 0, q.z); }
  if (o.kind === 'spatula') { const p = findSpot(o, o.g.position.x + .06, o.g.position.z - .035, .03); o.home.set(p.x - .06, .004, p.z + .035); }
  if ((o.kind === 'electrode' || o.kind === 'rod' || o.kind === 'thermo') && !o.zoneV) {
    const st = o.stand0, p = o.g.position;
    if (st && Math.hypot(p.x - st.x, p.z - st.z) < .06) { o.home.copy(o.home0); o.lying = false; }
    else { const q = findSpot(o, p.x + .09, p.z, .05); o.home.set(q.x - .09, o.kind === 'rod' ? .0028 : .0068, q.z); o.lying = true; }
  }
  if (o.kind === 'dropper' && o.dragWhole) {
    const p = findSpot(o, o.bottleG.position.x, o.bottleG.position.z, .02); o.bx = p.x; o.bz = p.z; o.bottleG.position.set(p.x, 0, p.z); if (!o.open) o.home.set(p.x, .006, p.z); o.zoneV = null; o.dragWhole = false;
  } else if (o.kind === 'dropper' && o.zoneV) { o.parked = o.zoneV; o.count = 0; }
  if (o.kind === 'electrode' || o.kind === 'rod' || o.kind === 'thermo') { const v = stickVessel(o); if (v) { o.lying = false; o.in = v; o.inAngle = Math.atan2(o.g.position.x - v.g.position.x, o.g.position.z - v.g.position.z) || 0; logE('info', [[o.kind === 'electrode' ? 'x.elIn' : o.cond ? 'x.condIn' : o.kind === 'thermo' ? 'x.thIn' : 'x.rodIn', { v: v.letter, n: o.n }]]); if (o.kind === 'thermo' && !o.cond) analyticsActivity('measure:temperature', 1, v.temp, 'measure:temperature'); if (o.kind === 'electrode' && METER.on) { doEq(v); analyticsActivity('measure:ph', 1, v.chem.eq.pH, 'measure:ph'); if (TASK.id === 'phmeasure' && ['A', 'B', 'C'].includes(v.letter)) { TASK.seen.add(v.letter); logE('obs', [['lab.ph.readValue', { v: v.letter, ph: fmt(v.chem.eq.pH, 2) }]]); checkTask(); } if (TASK.id === 'k3v01' && TASK.evidence) { const band = v.chem.eq.pH < 1.6 ? 'ph1' : v.chem.eq.pH < 3.2 ? 'ph29' : 'ph34'; if (v.letter === 'A') TASK.evidence.hclPH = band; if (v.letter === 'B') TASK.evidence.acPH = band; if (v.letter === 'C') TASK.evidence.dilutedPH = band; logE('obs', [['lab.ph.readValue', { v: v.letter, ph: fmt(v.chem.eq.pH, 2) }]]); } } } }
  if (o.kind === 'pipette') { o.home.copy(findSpot(o, o.g.position.x + o.L / 2, o.g.position.z, .03)).add(V3(-o.L / 2, .0072, 0)); o.lying = true;
    if (o.chem.V > .004) { logE('mistake', [['x.pipSpill', { a: fmtPip(o) }]]); o.chem = { V: 0, tot: {}, ind: {} }; } }
  if (o.kind === 'spatula' && o.grams > .005 && o.overJar) { logE('info', [['x.spatulaSpill', { g: fmt(o.grams, 2) }]]); o.grams = 0; }
}
renderer.domElement.addEventListener('pointerup', release); renderer.domElement.addEventListener('pointercancel', release);
renderer.domElement.addEventListener('pointerleave', () => { $('tip').hidden = true; });
function placeVessel(v) {
  v.tilt = 0; v.g.quaternion.identity();
  const p = v.g.position;
  if (p.x > SINK.x0 - .01 && p.x < SINK.x1 + .01 && p.z > SINK.z0 - .01 && p.z < SINK.z1 + .01) { // stands in the sink basin, under the tap if close to it
    let x = clamp(p.x, SINK.x0 + v.R + .004, SINK.x1 - v.R - .004), z = clamp(p.z, SINK.z0 + v.R + .004, SINK.z1 - v.R - .004);
    if (Math.hypot(x - TAP.spout.x, z - TAP.spout.z) < .07) { x = TAP.spout.x; z = TAP.spout.z; }
    v.base.set(x, -SINK.depth + .001, z); v.inSink = true;
    // With water running, an upright beaker fills under the spout. With the
    // tap off, releasing a filled beaker into the basin tips it out visibly.
    if (!TAP.on && v.chem.V > FILM + .3) v.sinkDrain = { tg: { kind: 'sink', c: V3(SINK.cx, 0, SINK.cz), R: .04 }, dir: V3(x <= SINK.cx ? 1 : -1, 0, 0) };
    return; }
  v.base.copy(findSpot(v, p.x, p.z, v.R + .002));
}
function stickVessel(o) {
  if (o.zoneV && !o.zoneV.held && !o.zoneV.stowed) return o.zoneV;
  let best = null, bd = Infinity;
  for (const v of vessels) if (!v.held && !v.stowed && v.tilt < 1) { const d = Math.hypot(o.g.position.x - v.g.position.x, o.g.position.z - v.g.position.z); if (d < v.R + .055 && d < bd) { best = v; bd = d; } }
  return best;
}
function placeOnBalance(o) {
  if (!o || o.stowed || o.area === 'hood') return false;
  const p = o.kind === 'dropper' && o.dragWhole ? o.bottleG.position : o.g.position;
  if (Math.hypot(p.x - BAL.pan.x, p.z - BAL.pan.z) > .105) return false;
  if (balanceItems().some(q => q !== o && onBalance(q) && !q.held)) { buzz(8); return false; }
  setOnBalance(o, true); o.in = null; o.zoneV = null; o.docked = false; o.pour = null;
  if (o.kind === 'vessel') { o.tilt = 0; o.g.quaternion.identity(); o.base.copy(BAL.pan); }
  else if (o.kind === 'bottle' || o.kind === 'wash') o.home.copy(BAL.pan);
  else if (o.kind === 'sample' || o.kind === 'prop' || o.kind === 'holder') o.home.copy(BAL.pan);
  else if (o.kind === 'dropper') { o.bx = BAL.pan.x; o.bz = BAL.pan.z; o.bottleG.position.copy(BAL.pan); if (!o.open) o.home.set(BAL.pan.x, BAL.pan.y + .006, BAL.pan.z); o.dragWhole = false; o.parked = null; }
  else if (o.kind === 'spatula') { o.home.set(BAL.pan.x - .08, BAL.pan.y + .004, BAL.pan.z); o.overJar = false; }
  else if (o.kind === 'pipette') { o.pz = null; o.tg = null; o.lying = true; o.home.set(BAL.pan.x - o.L / 2, BAL.pan.y + .0072, BAL.pan.z); }
  else if (o.kind === 'electrode' || o.kind === 'rod' || o.kind === 'thermo') { o.lying = true; const L = o.kind === 'rod' ? .1 : .09; o.home.set(BAL.pan.x - L, BAL.pan.y + (o.kind === 'rod' ? .0028 : o.cond ? .017 : .0068), BAL.pan.z); }
  buzz(10); return true;
}
/* Free spot on the bench near (x, z) for an object of footprint radius r: pushes it off other objects, the balance and the sink. */
/* two work surfaces: the bench and the fume-cupboard worktop (same height) */
const AREAS = { bench: [-.6, .7, -.3, .34], hood: [-.66, .66, 2.62, 3.2] };
const areaRect = S => AREAS[(S && S.area) || 'bench'];
const inHood = p => p.x > -.76 && p.x < .76 && p.z > 2.5 && p.z < 3.28;
/* footprints of everything standing on the bench (centre x, z, radius), except `self` */
function obstacles(self) {
  const circ = [];
  for (const v of vessels) if (v !== self && !v.onBalance && !v.stowed && !v.held && !v.inSink) circ.push([v.base.x, v.base.z, v.R + .002]);
  for (const b of bottles) if (!b.stowed) { if (b !== self && !b.held && !onBalance(b)) circ.push([b.home.x, b.home.z, BOT_R]); if (b.open && b.lidHome) circ.push([b.lidHome.x, b.lidHome.z, .018]); }
  if (wash !== self && !wash.held && !onBalance(wash)) circ.push([wash.home.x, wash.home.z, .032]);
  if (typeof PT !== 'undefined') for (const S of PT.samples) if (S !== self && !S.held && !S.onBal) { circ.push([S.home.x, S.home.z, .03]); if (S.open && S.lidHome) circ.push([S.lidHome.x, S.lidHome.z, .022]); }
  for (const S of PROPS) { if (S !== self && !S.held && !onBalance(S)) circ.push([S.home.x, S.home.z, S.R]); if (S.open && S.lidHome) circ.push([S.lidHome.x, S.lidHome.z, .022]); }
  for (const d of droppers) if (!d.stowed && d !== self && !d.held && !d.parked && !onBalance(d)) circ.push([d.bx, d.bz, .02]);
  for (const q of probes) if (q !== self && !q.stowed && !q.held && !q.in && q.lying && !onBalance(q)) for (const k of [.03, .09, .15]) circ.push([q.home.x + k, q.home.z, .016]);
  if (RIG.g.visible) circ.push([RIG.base.x, RIG.base.z, .09]);
  if (JAR.present) circ.push([JAR.x, JAR.z, JAR.R + .002], [JAR.x + .07, JAR.z + .03, .036]);
  circ.push([-.45, -.1, .075], [-.3, -.1, .022]); if (rodHolder !== self && !rodHolder.held && !onBalance(rodHolder)) circ.push([rodHolder.home.x, rodHolder.home.z, .022]);
  return circ;
}
function findSpot(self, x, z, r) {
  const circ = obstacles(self);
  const rects = [[BAL.x - .1, BAL.x + .1, BAL.z - .125, BAL.z + .155], [SINK.x0, SINK.x1, SINK.z0, SINK.z1]];
  const A = areaRect(self); if (self && self.area === 'hood') rects.length = 0;
  for (let it = 0; it < 12; it++) {
    let moved = false;
    x = clamp(x, A[0] + r, A[1] - r); z = clamp(z, A[2] + r, A[3] - r);
    for (const [cx, cz, cr] of circ) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), m = cr + r + .004; if (d < m) { const a = d > 1e-5 ? Math.atan2(dx, dz) : Math.random() * 6.28; x = cx + Math.sin(a) * m; z = cz + Math.cos(a) * m; moved = true; } }
    for (const [x0, x1, z0, z1] of rects) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) {
      const opts = [[x0 - r - .004 - x, 0], [x1 + r + .004 - x, 0], [0, z0 - r - .004 - z], [0, z1 + r + .004 - z]].sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]));
      x += opts[0][0]; z += opts[0][1]; moved = true; }
    if (!moved) break;
  }
  return V3(x, 0, z);
}
function findTarget(o) {
  for (const v of vessels) if (v !== o && !v.held && !v.stowed) { const d = Math.hypot(ptr.x - v.g.position.x, ptr.z - v.g.position.z); if (d < v.R + .045) return { kind: 'vessel', v, c: V3(v.g.position.x, rimY(v), v.g.position.z), R: v.Ri }; }
  if ((o.kind === 'bottle' || o.kind === 'pipette' || (o.kind === 'vessel' && (o.chem.V > FILM + .3 || (o.metal && o.metal.length)))) && ptr.x > SINK.x0 - .03 && ptr.x < SINK.x1 + .03 && ptr.z > SINK.z0 - .03 && ptr.z < SINK.z1 + .03) return { kind: 'sink', c: V3(clamp(ptr.x, SINK.x0 + .05, SINK.x1 - .05), 0, clamp(ptr.z, SINK.z0 + .05, SINK.z1 - .05)), R: .04 };
  return null;
}
function poseTilted(o, spoutLocal, dir, th) { const axis = V3(dir.z, 0, -dir.x).normalize(); const q = new THREE.Quaternion().setFromAxisAngle(axis, D2R(th)); o.g.quaternion.copy(q); o.g.position.copy(o.spout).sub(spoutLocal.clone().applyQuaternion(q)); }
/* Keep the full tilted bottle outside solid vessels and other bottles. Testing
   only its base is insufficient: the shoulder can otherwise pass through a
   beaker while the mouth is correctly positioned above the rim. */
function separateBottlePose(o) {
  if (o.kind !== 'bottle') return;
  const samples = [.025, .055, .085];
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const y of samples) {
      const p = V3(0, y, 0).applyQuaternion(o.g.quaternion).add(o.g.position);
      for (const v of vessels) {
        if (v.stowed || p.y < v.g.position.y - BOT_R || p.y > v.g.position.y + v.H + BOT_R) continue;
        const dx = p.x - v.g.position.x, dz = p.z - v.g.position.z, d = Math.hypot(dx, dz), min = v.R + BOT_R * .82 + .004;
        if (d < min) { const ux = d > 1e-5 ? dx / d : -o.dir.x, uz = d > 1e-5 ? dz / d : -o.dir.z, q = min - d; o.g.position.x += ux * q; o.g.position.z += uz * q; o.spout.x += ux * q; o.spout.z += uz * q; moved = true; }
      }
      for (const b of bottles) if (b !== o && !b.stowed) {
        const dx = p.x - b.g.position.x, dz = p.z - b.g.position.z, d = Math.hypot(dx, dz), min = BOT_R * 1.85 + .004;
        if (d < min) { const ux = d > 1e-5 ? dx / d : 1, uz = d > 1e-5 ? dz / d : 0, q = min - d; o.g.position.x += ux * q; o.g.position.z += uz * q; o.spout.x += ux * q; o.spout.z += uz * q; moved = true; }
      }
    }
    if (!moved) break;
  }
}
function landPoint(tg, from, dir) { const p = from.clone().addScaledVector(dir, .006); if (tg.kind === 'vessel') { const v = tg.v, dx = p.x - v.g.position.x, dz = p.z - v.g.position.z, r = Math.hypot(dx, dz), mr = v.Ri * .72; if (r > mr) { p.x = v.g.position.x + dx * mr / r; p.z = v.g.position.z + dz * mr / r; } const l = worldToLocal(v, p); p.y = v.g.position.y + (v.chem.V > .02 ? surfaceY(v, l.x, l.z, clock.elapsedTime) : v.b); } else p.y = -SINK.depth + .002; return p; }
function deliver(tg, comp, dV, at, rate) {
  if (tg.kind !== 'vessel') { if (Math.random() < .5) SPL.push({ x: at.x, y: at.y + .002, z: at.z, vx: (Math.random() - .5) * .2, vy: .1 + Math.random() * .2, vz: (Math.random() - .5) * .2, r: .0005 }); return; }
  const v = tg.v; addLiquid(v, comp, dV, at.x, at.z); const l = worldToLocal(v, at);
  if (Math.random() < .5) addWave(v, l.x, l.z, .0004 + rate * .0003);
  if (Math.random() < rate * .8) for (let k = 0; k < 2; k++) if (v.B.length < 420) v.B.push({ x: l.x + (Math.random() - .5) * .006, y: Math.max(v.b + .001, v.level - .003 - Math.random() * .012), z: l.z + (Math.random() - .5) * .006, r: .0003 + Math.random() * .0005, gas: false, ph: Math.random() * 6 });
  if (Math.random() < .4) SPL.push({ x: at.x, y: at.y + .001, z: at.z, vx: (Math.random() - .5) * .12, vy: .1 + Math.random() * .2, vz: (Math.random() - .5) * .12, r: .0004 });
  v.stir = Math.max(v.stir, rate * .1);
}
/* bottles and beakers: carry, magnet, user-controlled tilt, flow from the shape model.
   Bring the container over a target: it tilts to just below the pouring angle. Drag down to tilt further,
   drag up to tilt back. Liquid above the capacity at the current tilt flows out; turned mouth-down it empties. */
const buzz = ms => { try { if (navigator.vibrate) { navigator.vibrate(ms); return; } } catch (_) { } const p = document.querySelector('.pill'); if (p) { p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); } };
const contents = o => o.kind === 'vessel' ? o.chem.V : o.V;
const sameTg = (a, b) => a && b && a.kind === b.kind && a.v === b.v && a.b === b.b;
/* a target engages only after the pointer has rested over it for a moment, so passing over a beaker does not grab the object */
function dwell(o, f, dt) { if (!f) { o.cand = null; return null; } if (sameTg(f, o.cand)) o.candT += dt; else { o.cand = f; o.candT = 0; } return o.candT > .22 ? f : null; }
function updatePourer(o, dt, t) {
  const isV = o.kind === 'vessel';
  if (o.demoPose) {
    o.g.position.copy(o.demoPose.p); o.g.quaternion.setFromAxisAngle(V3(0, 0, 1), o.demoPose.tilt || 0); o.g.updateMatrixWorld();
    if (!isV) { o.cap.visible = true; animLid(o, dt); o.liq.visible = o.V > .05; o.plane.constant = o.g.position.y + o.shape.levelAt(Math.abs((o.demoPose.tilt || 0) * 180 / Math.PI), Math.max(o.V, .05)); o.sh.position.set(o.g.position.x, .0006, o.g.position.z); }
    return;
  }
  if (isV && o.sinkDrain) {
    if (TAP.on) { o.sinkDrain = null; o.tilt = 0; o.g.quaternion.identity(); }
    else {
      const sd = o.sinkDrain;
      o.tilt = Math.min(132, o.tilt + dt * 105);
      const spoutLocal = V3(sd.dir.x * o.R, o.H, sd.dir.z * o.R);
      const sp = sd.tg.c.clone().addScaledVector(sd.dir, -.02); sp.y = .03 + o.H * Math.max(0, Math.cos(D2R(o.tilt)));
      o.spout.lerp(sp, 1 - Math.exp(-dt * 12)); poseTilted(o, spoutLocal, sd.dir, o.tilt); flowFrom(o, sd.tg, dt); o.g.updateMatrixWorld();
      if (o.chem.V <= FILM + .02) { o.sinkDrain = null; o.base.set(clamp(sd.tg.c.x, SINK.x0 + o.R + .004, SINK.x1 - o.R - .004), -SINK.depth + .001, clamp(sd.tg.c.z, SINK.z0 + o.R + .004, SINK.z1 - o.R - .004)); o.inSink = true; }
      return;
    }
  }
  let tiltT = 0;
  if (isV && o.held && !o.pour && ptrOK && underTap(o)) return;
  o.underTap = false;
  if ((isV || o.open) && ((o.held && (ptrOK || o.pour)) || (o.docked && o.pour))) {
    let tg = null;
    if (o.pour) {
      tg = o.pour.tg; const dx = scr.x - o.pour.x0, raw = o.pour.base + (scr.y - o.pour.y0) * .45;
      if (!o.docked && (Math.abs(dx) > 90 || raw < -14)) { o.block = tg; o.pour = null; tg = null; }
      else { const ph = MOTION.tiltOK && o.pour.g0 != null ? Math.abs(MOTION.gamma - o.pour.g0) * 1.6 : 0; tiltT = clamp(raw + ph, 0, o.maxTilt); if (raw < 0) { o.pour.y0 = scr.y; o.pour.base = 0; } else if (raw > o.maxTilt) { o.pour.y0 = scr.y; o.pour.base = o.maxTilt; } }
    }
    if (!o.pour) {
      const f = dwell(o, findTarget(o), dt);
      if (!f) { if (!o.cand) o.block = null; }
      else if (!sameTg(f, o.block)) {
        tg = f; const V = contents(o); const base = V > .1 ? clamp(o.shape.threshold(V) - 4, 0, 110) : 70;
        const dir = V3(tg.c.x - ptr.x, 0, tg.c.z - ptr.z); if (dir.lengthSq() < 1e-6) dir.set(-1, 0, 0); o.dir = dir.normalize();
        o.pour = { tg, x0: scr.x, y0: scr.y, base, t0: t, amt: 0, flowing: false, g0: MOTION.gamma }; tiltT = base;
      }
    }
    o.tg = tg;
    if (!tg) { const dir = V3(-1, 0, 0); o.dir.lerp(dir, o.tilt > 0 ? 0 : 1); }
    o.tilt += clamp(tiltT - o.tilt, -dt * 200, dt * 140);
    const spoutLocal = isV ? V3(o.dir.x * o.R, o.H, o.dir.z * o.R) : V3(0, BOT_H, 0);
    const lift = isV ? o.H + .01 : .11;
    let sp; if (tg) { const edge = isV ? .7 : .92; sp = tg.c.clone().addScaledVector(o.dir, -tg.R * edge); sp.y = (tg.kind === 'vessel' ? tg.c.y : .02) + .03 + lift * Math.max(0, Math.cos(D2R(o.tilt))); }
    else { sp = V3(ptr.x, isV ? .07 : .06, ptr.z).add(spoutLocal); }
    o.spout.lerp(sp, 1 - Math.exp(-dt * 14));
    poseTilted(o, spoutLocal, o.dir, o.tilt); separateBottlePose(o);
    if (o.jiggle > 0) { o.jiggle = Math.max(0, o.jiggle - dt * 2.5); o.g.rotateZ(Math.sin(t * 40) * .12 * o.jiggle); o.g.rotateX(Math.cos(t * 33) * .08 * o.jiggle); }
    flowFrom(o, tg, dt);
  } else {
    o.pour = null; o.tg = null; drawStream(o, null);
    o.tilt = Math.max(0, o.tilt - dt * 200);
    const home = isV ? o.base : o.home;
    const spoutLocal = isV ? V3(o.dir.x * o.R, o.H, o.dir.z * o.R) : V3(0, BOT_H, 0);
    if (o.tilt > 0) { o.spout.lerp(home.clone().add(V3(0, spoutLocal.y, 0)), 1 - Math.exp(-dt * 9)); poseTilted(o, spoutLocal, o.dir, o.tilt); }
    else { o.g.quaternion.identity(); o.g.position.lerp(home, 1 - Math.exp(-dt * 9)); o.spout.copy(o.g.position).add(spoutLocal); }
  }
  o.g.updateMatrixWorld();
  if (!isV) {
    o.cap.visible = true; animLid(o, dt);
    o.liq.visible = o.V > .05;
    o.plane.constant = o.g.position.y + o.shape.levelAt(o.tilt, Math.max(o.V, .05));
    o.sh.position.set(o.g.position.x, .0006, o.g.position.z); o.sh.material.opacity = .38 * Math.max(0, 1 - o.g.position.y / .12);
  }
}
function flowFrom(o, tg, dt) {
  const isV = o.kind === 'vessel', V = contents(o);
  const ex = V - o.shape.capAt(o.tilt) - (isV ? 0 : 0);
  let streamed = false;
  if (tg && ex > .02 && V > (isV ? FILM + .005 : .005)) {
    const Q = Math.min(o.Qmax, 4 * ex + .25), comp = isV ? compOfVessel(o) : compOf(o.id);
    if (Q < .8) {
      o.acc = (o.acc || 0) + Q * dt;
      if (o.acc >= .05) { o.acc = 0; const dV = isV ? removeLiquid(o, .05) : Math.min(.05, o.V); if (!isV) o.V -= dV; if (dV > 0 && o.pour) { o.pour.amt += dV; buzz(4); } if (dV > 0) spawnDrop(o.spout.clone().add(V3(0, -.003, 0)), comp, tg.kind === 'vessel' ? tg.v : 'sink'); }
    } else {
      let dV = Math.min(ex, Q * dt); if (isV) dV = removeLiquid(o, dV); else { dV = Math.min(dV, o.V); o.V -= dV; }
      if (dV > 0) { streamed = true; o.flow = Q; if (o.pour) { o.pour.amt += dV; if (!o.pour.flowing) { o.pour.flowing = true; buzz(12); } } const at = landPoint(tg, o.spout, o.dir); drawStream(o, o.spout.clone(), at, Math.min(Q, 8) * .5); deliver(tg, comp, dV, at, Math.min(Q, 8)); }
    }
    if (isV && o.chem.V <= FILM + .02 && tg.kind === 'sink' && !o.emptiedLog) { o.emptiedLog = true; logE('info', [['x.emptied', { v: o.letter, f: fmt(FILM, 1) }]]); }
    if (!isV && o.V <= .005 && !o.emptyLog) { o.emptyLog = true; logE('info', [['x.bottleEmptied', { b: { k: REAG[o.id].name } }]]); }
  }
  if (isV && tg && tg.kind === 'sink' && o.tilt > 1.1 && o.metal && o.metal.length) { clearPieces(o); logE('mistake', [['x.piecesSink', { v: o.letter }]]); }
  if (!streamed) drawStream(o, null);
  if (isV && o.chem.V > FILM + .05) o.emptiedLog = false;
}
function updateDropper(o, dt) {
  if (o.demoPose) { o.g.position.copy(o.demoPose.p); o.g.quaternion.identity(); o.pulse = Math.max(0, o.pulse - dt * 4); const sq = Math.sin(o.pulse * Math.PI), s = 1 - sq * .35; o.teat.scale.set(1 + (1 - s) * .6, s, 1 + (1 - s) * .6); o.g.updateMatrixWorld(); return; }
  if (o.held && o.dragWhole && ptrOK) {
    const p = V3(ptr.x, 0, ptr.z); o.bottleG.position.lerp(p, 1 - Math.exp(-dt * 14)); o.bx = o.bottleG.position.x; o.bz = o.bottleG.position.z; o.zoneV = null;
    if (!o.open) { o.home.set(o.bx, .006, o.bz); o.g.position.lerp(o.home, 1 - Math.exp(-dt * 14)); }
    o.squeeze = Math.max(0, o.squeeze - dt * 5);
  } else if (o.held && ptrOK) {
    const tg = findTarget(o); o.zoneV = tg && tg.kind === 'vessel' ? tg.v : null;
    const tgt = o.zoneV ? V3(o.zoneV.g.position.x + (ptr.x - o.zoneV.g.position.x) * .3, rimY(o.zoneV) + .022, o.zoneV.g.position.z + (ptr.z - o.zoneV.g.position.z) * .3) : V3(ptr.x, .19, ptr.z);
    o.g.position.lerp(tgt, 1 - Math.exp(-dt * 14));
    if (o.zoneV) { o.acc += dt; o.squeeze = Math.min(1, o.squeeze + dt * 4); if (o.acc > .6) { o.acc = 0; o.count++; spawnDrop(o.g.position.clone().add(V3(0, -.002, 0)), compOf(o.id), o.zoneV); } }
    else { o.squeeze = Math.max(0, o.squeeze - dt * 5); o.acc = .35; o.count = 0; }
  } else if (o.parked) {
    const v = o.parked; o.g.position.lerp(V3(v.g.position.x + v.Ri * .45, rimY(v) + .006, v.g.position.z + v.Ri * .2), 1 - Math.exp(-dt * 10));
    o.squeeze = Math.max(0, o.squeeze - dt * 5);
  } else { o.squeeze = Math.max(0, o.squeeze - dt * 5); o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9)); }
  o.pulse = Math.max(0, o.pulse - dt * 4);
  const sq = Math.max(o.squeeze * (.6 + .4 * Math.sin(o.acc * 10)), Math.sin(o.pulse * Math.PI)); const s = 1 - sq * .35; o.teat.scale.set(1 + (1 - s) * .6, s, 1 + (1 - s) * .6);
}
function updateWash(o, dt) {
  if (o.demoPose) { o.g.position.copy(o.demoPose.p); o.g.quaternion.setFromAxisAngle(V3(0, 0, 1), o.demoPose.tilt || 0); o.sh.position.set(o.g.position.x, .0006, o.g.position.z); return; }
  if (o.held && ptrOK) {
    const tg = findTarget(o); o.tg = tg && tg.kind === 'vessel' ? tg : null;
    let pos, yaw = 0, tilt = 0;
    if (o.tg) { const c = o.tg.c; const d = V3(c.x - ptr.x, 0, c.z - ptr.z); if (d.lengthSq() < 1e-6) d.set(-1, 0, 0); d.normalize(); yaw = Math.atan2(-d.z, d.x); tilt = .45; pos = c.clone().addScaledVector(d, -.085); pos.y = c.y - .07; }
    else pos = V3(ptr.x, .03, ptr.z);
    o.g.position.lerp(pos, 1 - Math.exp(-dt * 12)); o.g.rotation.set(0, yaw, -tilt);
    o.squeeze = o.tg ? Math.min(1, o.squeeze + dt * 3) : Math.max(0, o.squeeze - dt * 4);
    o.g.updateMatrixWorld();
    if (o.tg && o.squeeze > .5) { const tipW = o.nozzleLocal.clone().applyMatrix4(o.g.matrixWorld); const rate = 2.5; const at = landPoint(o.tg, tipW, V3()); drawStream(o, tipW, at, .4); deliver(o.tg, compOf('wash'), rate * dt, at, rate); }
    else drawStream(o, null);
  } else { drawStream(o, null); o.squeeze = Math.max(0, o.squeeze - dt * 4); o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9)); o.g.rotation.y *= Math.exp(-dt * 6); o.g.rotation.x = 0; o.g.rotation.z *= Math.exp(-dt * 9); }
  o.body.scale.set(1 - o.squeeze * .12, 1, 1 - o.squeeze * .06);
  o.sh.position.set(o.g.position.x, .0006, o.g.position.z); o.sh.material.opacity = .38 * Math.max(0, 1 - o.g.position.y / .1);
}
function saltLog(o) { if (o.sessionV) { logE('obs', [['x.saltIn', { g: fmt(o.sessionG, 2) }]], { v: o.sessionV.letter, amt: '', f: 'NaCl' }); analyticsActivity('solid:nacl', 1, o.sessionG, 'solid:transferred'); o.sessionV = null; } }
function updateSpatula(o, dt) {
  if (o.demoPose) { o.g.position.copy(o.demoPose.p); o.g.quaternion.setFromAxisAngle(V3(0, 0, 1), o.demoPose.tilt || 0); o.load.visible = o.grams > .005; return; }
  if (o.held && ptrOK) {
    const overJar = JAR.present && Math.hypot(ptr.x - JAR.x, ptr.z - JAR.z) < JAR.R + .02; if (overJar && !o.overJar) o.jarDump = false; o.overJar = overJar;
    const tg = overJar ? null : findTarget(o); o.zoneV = tg && tg.kind === 'vessel' ? tg.v : null;
    let pos, roll = 0;
    if (overJar) { pos = V3(JAR.x, .045, JAR.z); if (!o.jarDump) o.grams = Math.min(1.6, o.grams + dt * .55); }
    else if (o.zoneV) { const v = o.zoneV; pos = V3(v.g.position.x, rimY(v) + .006, v.g.position.z); roll = .9; if (o.grams > 0) { const dm = Math.min(o.grams, dt * .45); o.grams -= dm; for (let k = 0; k < 2; k++) GR.push({ x: pos.x + (Math.random() - .5) * .006, y: pos.y - .004, z: pos.z + (Math.random() - .5) * .006, vy: 0, s: .0007 + Math.random() * .0008, v, m: dm / 2 }); if (o.sessionV !== v) { saltLog(o); o.sessionV = v; o.sessionG = 0; } o.sessionG += dm; } }
    else pos = V3(ptr.x, .14, ptr.z);
    o.g.position.lerp(pos, 1 - Math.exp(-dt * 12)); o.g.rotation.set(roll, .5, 0);
    if (o.sessionV && (!o.zoneV || o.grams <= 0)) saltLog(o);
  } else { o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9)); o.g.rotation.set(0, .5, 0); saltLog(o); }
  o.load.visible = o.grams > .005; if (o.load.visible) { const s = .5 + Math.cbrt(o.grams) * .7; o.load.scale.set(s * 1.3, s * .7, s); }
}
function updateStick(o, dt) {
  if (o.demoPose) { o.g.position.copy(o.demoPose.p); o.g.quaternion.setFromAxisAngle(V3(0, 0, 1), o.demoPose.tilt || 0); return; }
  if (o.held && ptrOK) {
    const tg = findTarget(o); o.zoneV = tg && tg.kind === 'vessel' ? tg.v : null; let p;
    if (o.zoneV) { const v = o.zoneV; const dx = ptr.x - v.g.position.x, dz = ptr.z - v.g.position.z; const r = Math.min(v.Ri - .009, Math.hypot(dx, dz)); const a = Math.atan2(dx, dz); p = V3(v.g.position.x + Math.sin(a) * r, v.g.position.y + v.b + (o.kind === 'rod' ? .003 : .012), v.g.position.z + Math.cos(a) * r); }
    else p = V3(ptr.x, .16, ptr.z);
    o.g.position.lerp(p, 1 - Math.exp(-dt * (o.zoneV ? 8 : 14))); o.g.rotation.set(0, 0, 0);
  } else if (o.in) {
    const v = o.in; if (v.held) o.in = null; else { const a = o.inAngle == null ? 0 : o.inAngle, r = Math.max(.004, v.Ri * .28);
      /* Keep the sensing tip submerged near the centre and lean the shaft
         against the rim.  The fixed angle prevents it wandering. */
      o.g.position.lerp(V3(v.g.position.x + Math.sin(a) * r, v.g.position.y + v.b + .003, v.g.position.z + Math.cos(a) * r), 1 - Math.exp(-dt * 9)); o.g.rotation.set(Math.cos(a) * .16, 0, -Math.sin(a) * .16); }
  } else { o.g.position.lerp(o.home, 1 - Math.exp(-dt * 9)); if (o.lying) o.g.rotation.set(0, 0, -Math.PI / 2); else o.g.rotation.set(0, 0, o.kind === 'rod' ? -.18 : 0); }
  if (o.kind === 'rod') { const sp = o.g.position.distanceTo(o.last) / Math.max(dt, 1e-3); o.last.copy(o.g.position); const v = o.zoneV;
    if (v && o.held && o.g.position.y < v.g.position.y + v.level) { v.stir = Math.min(1, v.stir + sp * dt * 6); if (sp > .05 && Math.random() < .3) { const l = worldToLocal(v, o.g.position); addWave(v, l.x, l.z, .0003); } } }
}
function vesselAtPoint(p) { for (const v of vessels) { const l = worldToLocal(v, p); if (Math.hypot(l.x, l.z) < v.Ri && l.y < v.level - .001 && l.y > 0 && v.chem.V > .3 && v.tilt < 1) return v; } return null; }
function updateGrains(dt) {
  let n = 0;
  for (let i = GR.length - 1; i >= 0; i--) { const g = GR[i]; g.vy -= 9.8 * dt; g.y += g.vy * dt; const v = g.v; const floor = v.g.position.y + v.b + .002; if (g.y <= floor) { v.solid += g.m; GR.splice(i, 1); continue; } M4.compose(P3.set(g.x, g.y, g.z), QI, SC.setScalar(g.s)); grainMesh.setMatrixAt(n++, M4); }
  grainMesh.count = n; grainMesh.instanceMatrix.needsUpdate = true;
}
function updateDrops(dt, t) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.vy -= 9.8 * dt; d.m.position.y += d.vy * dt; const p = d.m.position;
    if (d.target === 'sink') { if (p.y < -SINK.depth) { scene.remove(d.m); drops.splice(i, 1); } continue; }
    const v = d.target, l = worldToLocal(v, p);
    const sy = v.chem.V > .02 ? surfaceY(v, l.x, l.z, t) : v.b;
    if (Math.hypot(l.x, l.z) < v.Ri && l.y <= sy) {
      addLiquid(v, d.comp, .05, p.x, p.z); addWave(v, l.x, l.z, .0005);
      for (let k = 0; k < 3; k++) SPL.push({ x: p.x, y: p.y + .001, z: p.z, vx: (Math.random() - .5) * .1, vy: .15 + Math.random() * .2, vz: (Math.random() - .5) * .1, r: .0005 });
      scene.remove(d.m); drops.splice(i, 1); continue;
    }
    if (p.y < -.2) { scene.remove(d.m); drops.splice(i, 1); }
  }
}
function updateSplashes(dt) {
  let m = 0;
  for (let i = SPL.length - 1; i >= 0; i--) { const s = SPL[i]; s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    const inSink = s.x > SINK.x0 && s.x < SINK.x1 && s.z > SINK.z0 && s.z < SINK.z1;
    if (s.y < -SINK.depth || (s.y < .001 && !inSink) || (s.vy < 0 && vessels.some(v => { const l = worldToLocal(v, s); return Math.hypot(l.x, l.z) < v.Ri && l.y < v.level; }))) { SPL.splice(i, 1); continue; }
    M4.compose(P3.set(s.x, s.y, s.z), QI, SC.setScalar(s.r)); splashMesh.setMatrixAt(m++, M4); }
  splashMesh.count = m; splashMesh.instanceMatrix.needsUpdate = true;
}

/* ===================== UI ===================== */
let inspectorOpen = (() => { try { return localStorage.getItem('lab.inspector') === 'open'; } catch (_) { return false; } })();
let instructorTab = 'procedure';
function setInspector(open) {
  inspectorOpen = !!open; const panel = $('inspector'), button = $('inspectorToggle');
  panel.classList.toggle('open', inspectorOpen); panel.setAttribute('aria-hidden', String(!inspectorOpen));
  button.setAttribute('aria-expanded', String(inspectorOpen));
  try { localStorage.setItem('lab.inspector', inspectorOpen ? 'open' : 'closed'); } catch (_) { }
  updateInspectorButton();
}
function updateInspectorButton() { const b = $('inspectorToggle'); if (b) b.textContent = '📋 ' + T('x.labGuide'); }
$('inspectorToggle').addEventListener('click', () => setInspector(!inspectorOpen));
$('inspectorClose').addEventListener('click', () => setInspector(false));
function renderCard() {
  const c = $('card'); c.replaceChildren();
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  if (typeof refreshTags === 'function' && ITEMS[0].tagTex) refreshTags();
  const tabs = h('div', 'itabs');
  for (const [id, key] of [['procedure', 'x.procedure'], ['notebook', 'x.actionLog']]) { const b = h('button', null, T(key)); b.type = 'button'; b.setAttribute('aria-selected', String(instructorTab === id)); b.addEventListener('click', () => { instructorTab = id; renderCard(); }); tabs.append(b); }
  c.append(tabs);
  if (instructorTab === 'procedure') {
    const lab = LABS.find(l => l.run === TASK.id), course = lab ? lab.course : 'inorganic';
    if (!TASK.free) c.append(h('div', 'curriculum', T('x.levelHigh') + ' › ' + T('x.course.' + course) + ' › ' + T('topic.' + (lab ? lab.tp : 'acidbase'))));
    c.append(h('h1', null, T(TASK.title)), h('p', null, T(TASK.goal)));
    const acts = h('div', 'procedure-actions'); const choose = h('button', 'btn', T('x.chooseLab')); choose.type = 'button'; choose.addEventListener('click', openLabs); acts.append(choose);
    if (DEMO_LIBRARY[TASK.id]) {
      const demo = h('button', 'btn demo', T(DEMO.active ? 'x.demoStop' : 'x.demoStart')); demo.type = 'button'; demo.addEventListener('click', DEMO.active ? stopDemo : () => startDemo(TASK)); acts.append(demo);
      if (DEMO.active) { const next = h('button', 'btn', T('x.demoNext')); next.type = 'button'; next.disabled = DEMO.running || DEMO.step >= DEMO.total - 1; next.addEventListener('click', nextDemo); acts.append(next);
        const restart = h('button', 'btn', T('x.demoRestart')); restart.type = 'button'; restart.disabled = DEMO.running; restart.addEventListener('click', restartDemo); acts.append(restart);
        const mine = h('button', 'btn', T('x.startMyself')); mine.type = 'button'; mine.addEventListener('click', startMyself); acts.append(mine); }
    }
    c.append(acts); if (DEMO.active || DEMO.message) c.append(h('div', 'demo-status', T(DEMO.running ? 'x.demoRunning' : DEMO.message || 'x.demoReady', { n: DEMO.step + 1, total: DEMO.total })));
    if (TASK.free) c.append(h('div', 'cap', T('x.safetyCap'))); else c.append(h('div', 'instruction-banner', '✅ ' + T('x.studentInstructions')));
    const ol = h(TASK.free ? 'ul' : 'ol', TASK.free ? 'steps' : 'steps student-steps'); T(TASK.steps).split('|').forEach((s, i) => { const li = h('li', DEMO.active && i === DEMO.step ? 'demo-current' : null, s); ol.append(li); }); c.append(ol);
    if (TASK.check) c.append(h('p', 'goal' + (TASK.reached ? ' ok' : ''), T(TASK.reached ? 'x.goalOk' : 'x.goalOpen')));
    if (TASK.answer) { const A = TASK.answer, box = h('div', 'ans'); box.append(h('div', 'cap', T('x.ansTitle')));
      const optLabel = o => A.optKey ? T(A.optKey + o) : A.cat ? T('x.ans_' + o) : SOLF[o];
      for (const L of A.rows || Object.keys(TASK.key)) { const row = h('label', 'arow'); row.append(h('span', null, A.rowKey ? T(A.rowKey + L) : T('x.bottleL', { l: L })));
        const sel = document.createElement('select'); sel.append(new Option('—', '')); for (const o of (A.optsByRow && A.optsByRow[L] || A.opts)) sel.append(new Option(optLabel(o), o)); sel.value = TASK.picks[L] || ''; sel.disabled = TASK.reached;
        sel.addEventListener('change', () => { TASK.picks[L] = sel.value; }); row.append(sel); box.append(row); }
      if (A.num) { const row = h('label', 'arow'); row.append(h('span', null, T(A.num.key))); const inp = document.createElement('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = TASK.num || ''; inp.disabled = TASK.reached; inp.addEventListener('input', () => { TASK.num = inp.value; }); row.append(inp); box.append(row); }
      if (TASK.reached) box.append(h('p', 'goal ok', T('x.goalOk'))); else { const b = h('button', 'btn', T('x.ansCheck')); b.type = 'button'; b.addEventListener('click', checkAnswers); box.append(b); }
      c.append(box); }
  }
  $('rpl').textContent = T('x.ph'); $('rtl').textContent = T('x.temp'); $('rbl').textContent = T('x.bal');
  if (instructorTab === 'procedure') { const how = h('details', 'how'); how.append(h('summary', null, T('x.howTitle'))); const ul = h('ul', 'steps'); for (const s of T('x.how').split('|')) ul.append(h('li', null, s)); how.append(ul); c.append(how); }
  else {
    c.append(h('h1', null, T('x.actionLog')), h('p', null, T('x.actionLogHelp')));
    const tools = h('div', 'logtools'), copy = h('button', 'btn', T('x.copyLog')); copy.type = 'button'; copy.addEventListener('click', () => copyLog(copy)); tools.append(copy); c.append(tools);
    const log = h('pre', 'logtext'); log.id = 'logtext'; log.tabIndex = 0; c.append(log); renderLog();
  }
  renderViewbar(); setHelp(helpMode); $('sub').textContent = T('x.sub'); $('reset').textContent = T('x.reset'); $('inspectorClose').setAttribute('aria-label', T('x.close')); updateInspectorButton(); renderInv(); for (const f of SIGN) f(); { const tb = $('invbtns'); if (tb) { tb.children[0].textContent = T('x.labsBtn'); tb.children[1].textContent = T('x.closetBtn'); tb.children[2].textContent = T('x.shelfBtn'); } } $('hint').textContent = T('x.hint'); $('lang').value = LANG;
}
function logEntryText(e) {
  const tm = Math.floor(e.t / 60) + ':' + String(Math.floor(e.t % 60)).padStart(2, '0');
  const type = T('x.logType.' + e.type).toUpperCase();
  const head = e.head ? '[' + e.head.v + ']' + (e.head.amt ? ' + ' + e.head.amt + ' ' + e.head.f : (e.head.f ? ' ' + e.head.f : '')) + ' → ' : '';
  return '[' + tm + '] ' + type + ' — ' + head + e.parts.map(([k, p]) => T(k, p)).join(' ');
}
function plainLog() {
  const lines = [
    T('x.logHeader'),
    T('x.logExperiment') + ': ' + T(TASK.title),
    T('x.logObjective') + ': ' + T(TASK.goal),
    T('x.logStarted') + ': ' + new Date(NB.started).toLocaleString(LANG),
    '',
    T('x.logSafety'),
    TASK.sensory ? T(TASK.sensory) : T('x.logSensory'),
    '',
    T('x.logObservations')
  ];
  if (!NB.log.length) lines.push(T('x.logEmpty')); else for (const e of NB.log) lines.push(logEntryText(e));
  return lines.join('\n');
}
async function copyLog(button) {
  const value = plainLog();
  try { await navigator.clipboard.writeText(value); }
  catch (_) {
    const ta = document.createElement('textarea'); ta.value = value; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  button.textContent = T('x.copied'); setTimeout(() => { if (button.isConnected) button.textContent = T('x.copyLog'); }, 1400);
}
function renderLog() { const log = $('logtext'); updateInspectorButton(); if (!log) return; log.textContent = plainLog(); log.scrollTop = log.scrollHeight; }
$('lang').addEventListener('change', e => { LANG = e.target.value; try { localStorage.setItem('lab.lang', LANG); } catch (_) { } renderCard(); for (const b of bottles) { b.lab.material.map = labelTex(b.id); b.lab.material.needsUpdate = true; } });
$('reset').addEventListener('click', () => setupTask(TASK));
/* keep floating notes inside the stage: prefer below-right of the point, flip to the other side when there is no room */
function placeTip(el, x, y, off, centred) {
  const W = stage.clientWidth, H = stage.clientHeight; el.style.transform = 'none'; el.style.maxWidth = Math.max(160, W - 16) + 'px';
  const w = el.offsetWidth, h = el.offsetHeight;
  let l = centred ? x - w / 2 : x + off, tp = centred === 'below' ? y + 8 : centred ? y - h - 8 : y + off;
  if (!centred && l + w > W - 8) l = x - off - w;
  if (!centred && tp + h > H - 8) tp = y - off - h;
  if (centred && tp < 8) tp = y + 12;
  el.style.left = clamp(l, 8, Math.max(8, W - w - 8)) + 'px'; el.style.top = clamp(tp, 8, Math.max(8, H - h - 8)) + 'px';
}
/* ---------- camera: rotate / move (pan) mode, zoom buttons, focus on double-tap, quick view of the pH meter ---------- */
let camAnim = null, viewMode = 'rotate';
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.touches.ONE = THREE.TOUCH.ROTATE;
function flyTo(t, p) {
  viewTouched = true;
  if (typeof shelfView !== 'undefined' && shelfView) { shelfView = null; markShelfBtns(); if (typeof renderPlaces === 'function') renderPlaces(); }
  // Camera-dashboard behavior: a command always lands exactly on a valid shot.
  // There is no interruptible in-between position that can become the next origin.
  camAnim = null; controls.target.copy(t); camera.position.copy(p); camera.lookAt(t); controls.update();
}
function zoomBy(f) { const d = camera.position.clone().sub(controls.target); const L = clamp(d.length() * f, controls.minDistance, controls.maxDistance); camAnim = { t: controls.target.clone(), p: controls.target.clone().add(d.setLength(L)), last: performance.now() }; viewTouched = true; }
function focusAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(scene.children, true).find(h => h.object.visible && h.object.material && h.object.material.visible !== false && !h.object.isInstancedMesh && !h.object.isSprite);
  if (!hit) return; const t = hit.point.clone(); t.y = Math.max(0, t.y);
  if (shelfView && shelfView.sh === 'pt') { const sv = shelfView; t.z = PT.z; flyTo(t, V3(t.x, t.y, PT.z + .42)); shelfView = sv; renderPlaces(); return; }
  const d = camera.position.clone().sub(controls.target); flyTo(t, t.clone().add(d.setLength(Math.min(d.length(), .3))));
}
function setViewMode(m) {
  viewMode = m; controls.mouseButtons.LEFT = m === 'move' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; controls.touches.ONE = m === 'move' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  renderViewbar();
}
function renderViewbar() {
  const bar = $('viewbar'); bar.replaceChildren();
  const grp = (...items) => { const g = document.createElement('div'); g.className = 'grp'; for (const [txt, title, fn, pressed] of items) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title; if (pressed != null) b.setAttribute('aria-pressed', pressed); b.addEventListener('click', fn); g.append(b); } bar.append(g); };
  grp([T('x.vRotate'), T('x.vRotateT'), () => setViewMode('rotate'), viewMode === 'rotate'], [T('x.vMove'), T('x.vMoveT'), () => setViewMode('move'), viewMode === 'move']);
  grp(['🥽', T('x.goggles') + ' — ' + T('x.gogglesT'), () => setPPE('goggles'), PPE.goggles], ['🧤', T('x.gloves') + ' — ' + T('x.glovesT'), () => setPPE('gloves'), PPE.gloves]);
  grp([T('x.vAuto'), T('x.vAutoT'), () => { autoZoom = !autoZoom; if (!autoZoom && camSaved) { flyTo(camSaved.t, camSaved.p); camSaved = null; } renderViewbar(); }, autoZoom]);
  renderPlaces();
}
/* quick places: one tap flies the camera to a fixed spot (portrait screens step back a little) */
const PLACES = [
  ['x.pBench', null],
  ['x.pWork', { t: V3(.03, .04, 0), p: V3(.03, .36, .44) }],
  ['x.pReag', { t: V3(0, .07, -.24), p: V3(0, .3, .17) }],
  ['x.pBal', { t: V3(-.33, .07, .08), p: V3(-.3, .34, .44) }],
  ['x.pPH', { t: V3(-.453, .04, -.109), p: V3(-.425, .25, -.035), near: true }],
  ['x.pSink', { t: V3(.54, -.02, .02), p: V3(.46, .46, .5) }],
  ['x.pPT', { pt: true }],
  ['x.pHood', { t: V3(0, .5, 2.95), p: V3(0, .85, .2), near: true }],
];
let placeView = 0;
function fitBench() {
  const portrait = camera.aspect < .85, el = D2R(portrait ? 38 : 34), T0 = V3(.07, .03, .0), dir = V3(0, Math.sin(el), Math.cos(el));
  const cam = camera.clone(), pts = [];
  for (const x of [-.56, SINK.x1 + .03]) for (const y of [0, .2]) for (const z of [-.33, .33]) pts.push(V3(x, y, z));
  let d = .4;
  for (; d < 4; d += .03) { cam.position.copy(T0).addScaledVector(dir, d); cam.lookAt(T0); cam.updateMatrixWorld(); if (pts.every(p => { const q = p.clone().project(cam); return Math.abs(q.x) < .97 && Math.abs(q.y) < .95; })) break; }
  return { t: T0, p: T0.clone().addScaledVector(dir, d) };
}
function goPlace(v) {
  const pi = PLACES.findIndex(q => q[1] === v); placeView = pi < 0 ? 0 : pi;
  if (!v) { const w = fitBench(); flyTo(w.t, w.p); return; }
  if (v.pt) { viewPT('all'); return; }
  const k = camera.aspect < .85 && !v.near ? 1.35 : 1; flyTo(v.t, v.t.clone().add(v.p.clone().sub(v.t).multiplyScalar(k)));
}
function semanticView(dir, move) {
  const sv = shelfView;
  if (sv && sv.sh === 'pt') {
    if (dir > 0) { if (move) viewShelf('chem', 'acid', 'T'); return T('x.s_acid'); }
    if (move) viewShelf('glass', 0, 'T'); return T('x.secR');
  }
  if (sv && sv.sh === 'glass') {
    const a = [2, 1, 0], i = Math.max(0, a.indexOf(sv.cab)), ni = i + dir;
    if (ni < 0) { const q = PLACES[PLACES.length - 1]; if (move) goPlace(q[1]); return T(q[0]); }
    if (ni >= a.length) { const q = PLACES[0]; if (move) goPlace(q[1]); return T(q[0]); }
    const cab = a[ni]; if (move) viewShelf('glass', cab, sv.lvl); return T(['x.secL', 'x.secM', 'x.secR'][ni]);
  }
  if (sv && sv.sh === 'chem') {
    const a = ['acid', 'gen', 'ox', 'base', 'gas'], i = Math.max(0, a.indexOf(sv.cab)), ni = i + dir;
    if (ni < 0) { const q = PLACES[0]; if (move) goPlace(q[1]); return T(q[0]); }
    if (ni >= a.length) { const q = PLACES[PLACES.length - 1]; if (move) goPlace(q[1]); return T(q[0]); }
    const cab = a[ni]; if (move) viewShelf('chem', cab, cab === 'gas' ? undefined : sv.lvl); return T(cab === 'gas' ? 'x.sGas' : 'x.s_' + cab);
  }
  if (sv && sv.sh === 'flam') { if (dir > 0) { if (move) viewShelf('chem', 'acid', 'M2'); return T('x.s_acid'); } const q = PLACES[1]; if (move) goPlace(q[1]); return T(q[0]); }
  // Fixed bench close-ups are shortcuts, not separate compass directions.
  // The hood is the sector between gas cylinders and the glassware closet.
  if (placeView === PLACES.length - 1) {
    if (dir > 0) { if (move) viewShelf('glass', 2, 'M2'); return T('x.secL'); }
    if (move) viewShelf('chem', 'gas'); return T('x.sGas');
  }
  if (dir > 0) { if (move) viewShelf('chem', 'acid', 'M2'); return T('x.s_acid'); }
  if (move) viewShelf('glass', 0, 'M2'); return T('x.secR');
}
function stepSemanticView(dir) { semanticView(dir, true); }
function stepShelfLevel(dir) {
  const sv = shelfView;
  // Positive means the content was swiped upward: reveal the lower view.
  if (sv && sv.sh === 'pt') { if (dir > 0) { goPlace(PLACES[0][1]); return true; } return false; }
  if (!sv) { if (dir < 0) { viewPT('all'); return true; } return false; }
  if (sv.sh === 'flam') return false;
  if (sv.cab === 'gas') return false;
  const levels = ['T', 'M2', 'M1', 'B'], i = Math.max(0, levels.indexOf(sv.lvl)), ni = clamp(i + dir, 0, levels.length - 1);
  if (ni === i) return false; viewShelf(sv.sh, sv.cab, levels[ni]); return true;
}
function renderPlaces() {
  const bar = $('places'); if (!bar) return; bar.replaceChildren();
  const l = document.createElement('span'); l.className = 'lbl'; l.textContent = T('x.pGo'); bar.append(l);
  const mk = (items) => { const g = document.createElement('div'); g.className = 'grp'; for (const [txt, fn, on, title] of items) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if (on) b.setAttribute('aria-pressed', 'true'); if (title) { b.title = title; b.setAttribute('aria-label', title); } b.addEventListener('click', fn); g.append(b); } bar.append(g); };
  mk([['‹', () => stepSemanticView(-1), false, semanticView(-1, false)], ['›', () => stepSemanticView(1), false, semanticView(1, false)]]);
  if (!shelfView) { mk(PLACES.map(([k, v]) => [T(k), () => goPlace(v)])); return; }
  const sv = shelfView;
  mk([[T('x.backBench'), () => { shelfView = null; goPlace(PLACES[1][1]); markShelfBtns(); renderPlaces(); }]]);
  if (sv.sh === 'pt') {
    mk(['all', 'p13', 'p45', 'p67', 'f'].map(k => [T('x.pt_' + k), () => viewPT(k), sv.part === k]));
    if (sv.half) mk([[T('x.ptL'), () => viewPT(sv.part, 'L'), sv.half === 'L'], [T('x.ptR'), () => viewPT(sv.part, 'R'), sv.half === 'R']]);
    return;
  }
  if (sv.sh === 'glass') mk([[T('x.secL'), () => viewShelf('glass', 2, sv.lvl), sv.cab === 2], [T('x.secM'), () => viewShelf('glass', 1, sv.lvl), sv.cab === 1], [T('x.secR'), () => viewShelf('glass', 0, sv.lvl), sv.cab === 0]]);
  if (sv.sh === 'chem' || sv.sh === 'flam') mk([...['acid', 'gen', 'ox', 'base'].map(c => [T('x.s_' + c), () => viewShelf('chem', c, sv.lvl || 'M2'), sv.cab === c]), [T('x.box_flam'), () => viewFlammables(), sv.sh === 'flam'], [T('x.sGas'), () => viewShelf('chem', 'gas'), sv.cab === 'gas']]);
  if ((sv.sh === 'glass' || sv.sh === 'chem') && sv.cab !== 'gas') mk(['T', 'M2', 'M1', 'B'].map(k => [T('x.lv_' + k), () => viewShelf(sv.sh, sv.cab, k), sv.lvl === k]));
}
{ let down = null, lastTap = null;
  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && touchIds.size >= 2) return;
    setNdc(e); const h = pickAt(e), dec = !h && decorAt(e); down = { x: e.clientX, y: e.clientY, t: performance.now(), tapObj: !!(h && h.object.userData.obj.tap), empty: !h && !dec };
  }, true);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || down.tapObj || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 350) { down = null; return; }
    const now = performance.now();
    if (lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; } else { lastTap = { x: e.clientX, y: e.clientY, t: now };
      if (!dockedObj() && !rigTap(e)) { const dec = decorAt(e); if (dec) { const r = stage.getBoundingClientRect(); if ((dec.info.type === 'glass' || dec.info.type === 'chem') && takeProp(dec)) showPropNote(dec, e.clientX - r.left, e.clientY - r.top); else if (!(dec.info.type === 'glass' || dec.info.type === 'chem')) decorNote(dec, e.clientX - r.left, e.clientY - r.top); } } }
    down = null; });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('pointercancel', () => { down = null; }, true);
  controls.addEventListener('start', () => { viewTouched = true; });
}
function edgePan(dt) {
  if (!held || !lastEv || held.pour || held.pz) return;
  const r = renderer.domElement.getBoundingClientRect(), m = Math.max(48, Math.min(r.width, r.height) * .2);
  const lift = lastEv.pointerType === 'touch' ? TOUCH_LIFT : 0, X = lastEv.clientX, Y = lastEv.clientY - lift;
  const ex = X < r.left + m ? -(r.left + m - X) / m : X > r.right - m ? (X - r.right + m) / m : 0;
  const ey = Y < r.top + m ? (r.top + m - Y) / m : lastEv.clientY > r.bottom - m ? -(lastEv.clientY - r.bottom + m) / m : 0;
  if (!ex && !ey) return;
  const fwd = V3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const right = V3(-fwd.z, 0, fwd.x);
  const sp = .55 * camera.position.distanceTo(controls.target) * dt;
  const d = right.multiplyScalar(ex * sp).addScaledVector(fwd, ey * sp);
  const nt = controls.target.clone().add(d); if (held.area === 'hood') { nt.x = clamp(nt.x, -.75, .75); nt.z = clamp(nt.z, 2.5, 3.0); } else { nt.x = clamp(nt.x, -.75, .85); nt.z = clamp(nt.z, -.45, .45); } d.subVectors(nt, controls.target);
  controls.target.add(d); camera.position.add(d); camAnim = null; viewTouched = true;
  moveHeld(lastEv);
}
/* personal protective equipment: goggles and gloves */
const PPE = { goggles: false, gloves: false, warned: false, gl: false, fl: false };
function setPPE(k) { PPE[k] = !PPE[k]; stage.classList.toggle('ppe-' + k, PPE[k]); logE('info', [['x.' + k + (PPE[k] ? 'On' : 'Off')]]); showManual(k); renderViewbar(); }
function ppeCheck(comp) {
  const hasChem = Object.keys(comp.tot || {}).length || Object.keys(comp.ind || {}).length; if (!hasChem) return;
  if (!PPE.goggles && !PPE.warned) { PPE.warned = true; logE('mistake', [['x.noGoggles']]); }
  const corr = (REAG[comp.id] && REAG[comp.id].hazard === 'corr') || /^cab:(HCl|H₂SO₄|HNO₃|NaOH|NH₃)/.test(comp.id || '');
  if (corr && !PPE.gloves && !PPE.gl) { PPE.gl = true; logE('mistake', [['x.noGloves']]); }
}
/* raise / lower the view without tipping it (▲ ▼ buttons, arrow keys), and turn the view level ("Eye level") */
let liftDir = 0; const keyMove = { x: 0, y: 0 };
function eyeLevel() {
  const t = controls.target, d = camera.position.clone().sub(t), h = Math.hypot(d.x, d.z), L = d.length();
  const dir = h > 1e-4 ? V3(d.x / h, 0, d.z / h) : V3(0, 0, 1);
  camAnim = { t: t.clone(), p: t.clone().addScaledVector(dir, L), last: performance.now() }; viewTouched = true;
}
addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,select,textarea')) return;
  if (e.key === 'ArrowLeft') stepSemanticView(-1); else if (e.key === 'ArrowRight') stepSemanticView(1);
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') stepShelfLevel(-1); else if (e.key === 'ArrowDown' || e.key === 'PageDown') stepShelfLevel(1); else return;
  e.preventDefault(); });
function liftView(dt) {
  const vy = liftDir || keyMove.y, vx = keyMove.x; if (!vy && !vx) return;
  const sp = .35 * clamp(camera.position.distanceTo(controls.target), .2, 2.5) * dt, fwd = V3(); camera.getWorldDirection(fwd);
  const d = V3(0, vy * sp, 0); if (vx) { const right = V3(-fwd.z, 0, fwd.x); if (right.lengthSq() > 1e-6) d.addScaledVector(right.normalize(), vx * sp); }
  controls.target.add(d); camera.position.add(d);
}
function updateCamera(dt) {
  if (camAnim) { const now = performance.now(), k = 1 - Math.exp(-Math.min(.2, (now - camAnim.last) / 1000) * 6); camAnim.last = now; controls.target.lerp(camAnim.t, k); camera.position.lerp(camAnim.p, k); if (camera.position.distanceTo(camAnim.p) < .002 && controls.target.distanceTo(camAnim.t) < .002) camAnim = null; }
  const wall = !!(shelfView && shelfView.sh === 'pt');
  if (wall) { controls.screenSpacePanning = true;
    const nt = controls.target.clone(); nt.x = clamp(nt.x, -.8, .8); nt.y = clamp(nt.y, .26, 1.13); const d = nt.sub(controls.target); controls.target.add(d); camera.position.add(d); }
  else if (wallMode) controls.screenSpacePanning = false;
  wallMode = wall;
  { const t = controls.target, nt = V3(clamp(t.x, -2.05, 2.25), clamp(t.y, -.85, 1.13), clamp(t.z, -.45, 3.0)), dd = nt.sub(t); if (dd.lengthSq() > 0) { t.add(dd); camera.position.add(dd); } }
  { const c = camera.position, overBench = c.x > -1.0 && c.x < 1.0 && c.z < 1.9, minY = overBench ? .012 : FLOOR + .25; if (c.y < minY) { const dy = minY - c.y; c.y += dy; controls.target.y += dy; } }
}
let wallMode = false;
/* ---------- "?" help: tap the button, then tap anything on the bench for a short note about it ---------- */
let helpMode = false;
const helpBtn = document.createElement('button'); helpBtn.type = 'button'; helpBtn.className = 'helpbtn'; helpBtn.textContent = '?'; $('tools').append(helpBtn);
const note = document.createElement('div'); note.className = 'note'; note.hidden = true; stage.append(note);
const helpBanner = document.createElement('div'); helpBanner.className = 'tip helpbanner'; helpBanner.hidden = true; stage.append(helpBanner);
function setHelp(on) { helpMode = on; helpBtn.setAttribute('aria-pressed', on); helpBtn.title = T('x.helpBtn'); helpBtn.setAttribute('aria-label', T('x.helpBtn')); helpBanner.hidden = !on; helpBanner.textContent = T('x.helpPick'); renderer.domElement.style.cursor = on ? 'help' : 'default'; if (on) { note.hidden = true; $('tip').hidden = true; } }
helpBtn.addEventListener('click', () => setHelp(!helpMode));
function helpFor(key) {
  const [k, arg] = key.split(':');
  const P = {};
  if (k === 'beaker') { const v = vessels.find(q => q.letter === arg); P.v = arg; P.ml = fmt(v.chem.V, 1); }
  if (k === 'bottle') { const b = bottles.find(q => q.id === arg); P.n = { k: REAG[arg].name }; P.f = REAG[arg].f; P.ml = fmt(b.V, 0); }
  if (k === 'dropper') { P.n = { k: REAG[arg].name }; }
  if (k === 'meter') P.st = { k: METER.on ? 'x.stOn' : 'x.stOff' };
  if (k === 'balance') P.st = { k: BAL.on ? 'x.stOn' : 'x.stOff' };
  if (k === 'cab') { P.n = { k: 'x.s_' + arg }; P.g = { k: 'x.cabNote_' + arg }; }
  if (k === 'p3' || k === 'p10') { const q = pipettes[k === 'p3' ? 0 : 1]; P.ml = fmtPip(q); }
  const kk = k === 'bottle' && arg === 'water' ? 'bottleW' : k;
  return { title: T('x.h.' + kk + '.t', P), body: T('x.h.' + kk + '.b', P) };
}
function showNote(key, x, y) { const h = helpFor(key); showNoteRaw(h.title, h.body.split('|'), x, y); }
function showNoteRaw(title, body, x, y, actions) {
  const h = { title, body: body.join('|') }; note.replaceChildren();
  const hd = document.createElement('div'); hd.className = 'nh'; const b = document.createElement('b'); b.textContent = h.title; const x0 = document.createElement('button'); x0.type = 'button'; x0.textContent = '×'; x0.setAttribute('aria-label', T('x.close')); x0.addEventListener('click', () => { note.hidden = true; }); hd.append(b, x0);
  note.append(hd); for (const para of h.body.split('|')) { const pp = document.createElement('p'); pp.textContent = para; note.append(pp); }
  if (actions && actions.length) { const row = document.createElement('div'); row.className = 'nact'; for (const [lab, fn] of actions) { const a = document.createElement('button'); a.type = 'button'; a.textContent = lab; a.addEventListener('click', () => { note.hidden = true; fn(); }); row.append(a); } note.append(row); }
  note.hidden = false; placeTip(note, x, y, 12);
}
stage.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('.viewbar, .helpbtn, .note')) return;
  if (!note.hidden) note.hidden = true;
  if (!helpMode) return;
  e.stopPropagation(); e.preventDefault();
  setNdc(e);
  let key = null, kd = Infinity;
  for (const h of ray.intersectObjects(scene.children, true)) { let o = h.object; if (!o.visible || o.isInstancedMesh || o.isSprite) continue; while (o && !o.userData.help) o = o.parent; if (o) { key = o.userData.help; kd = h.distance; break; } }
  const dec = decorAt(e); setHelp(false);
  const r = stage.getBoundingClientRect();
  if (dec && dec.dist <= kd + .02) decorNote(dec, e.clientX - r.left, e.clientY - r.top);
  else if (key) showNote(key, e.clientX - r.left, e.clientY - r.top);
}, true);
const counterEl = document.createElement('div'); counterEl.className = 'tip'; counterEl.hidden = true; stage.append(counterEl);
function updateCounter() {
  const pd = droppers.find(q => q.parked && !q.held), hd = droppers.find(q => q.held && q.zoneV);
  const pr = [...bottles, ...vessels].find(q => q.pour); const pp = pipettes.find(q => (q.held && (q.pz || q.chem.V > .004)) || (q.docked && q.pz));
  let txt = null;
  if (pr) txt = T('x.pourStat', { a: Math.round(pr.tilt), ml: fmt(pr.pour.amt, pr.pour.amt < 10 ? 1 : 0) }) + '  ·  ' + T(pr.docked ? 'x.dockHint' : 'x.tiltHint');
  else if (pp) txt = (pp.big ? '10 mL' : '3 mL') + ' — ' + fmtPip(pp) + (pp.pz ? '  ·  ' + T(pp.docked ? 'x.pipDock' : 'x.pipDrag') : '');
  else if (hd) txt = hd.count === 1 ? T('amt.drop') : T('amt.drops', { n: hd.count });
  if (!txt && shelfView && !held) txt = T(shelfView.sh === 'pt' ? 'x.ptPan' : 'x.shelfPill');
  pill.hidden = !txt; if (txt) pill.textContent = txt;
  stage.classList.toggle('busy', !!held || !!dockedObj());
  if (!pd) { counterEl.hidden = true; return; }
  const p = pd.g.position.clone().add(V3(0, .12, 0)).project(camera); const r = stage.getBoundingClientRect();
  counterEl.hidden = false; counterEl.textContent = (pd.count === 1 ? T('amt.drop') : T('amt.drops', { n: pd.count })) + ' · ' + T('x.tapMore');
  placeTip(counterEl, (p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height, 0, 'above');
}
const loupeCam = new THREE.PerspectiveCamera(16, 1, .004, 2);
const loupeEl = document.createElement('div'); loupeEl.className = 'loupe'; loupeEl.hidden = true; stage.append(loupeEl);
function renderLoupe() {
  const pp = pipettes.find(q => (q.held || q.docked) && q.pz);
  if (!pp) { loupeEl.hidden = true; return; }
  const W = stage.clientWidth, H = stage.clientHeight, size = Math.round(Math.min(W, H) * (W < 600 ? .38 : .3));
  loupeEl.hidden = false; loupeEl.style.width = loupeEl.style.height = size + 'px';
  const h = (pp.y1 - pp.y0) * pp.chem.V / pp.cap, M = V3(0, pp.y0 + h, 0).applyMatrix4(pp.g.matrixWorld);
  const d = camera.position.clone().sub(M); d.y = 0; d.setLength(.075);
  loupeCam.position.copy(M).add(d); loupeCam.lookAt(M); loupeCam.aspect = 1; loupeCam.updateProjectionMatrix();
  const x = W - size - 10, y = H - size - 52;
  renderer.setScissorTest(true); renderer.setScissor(x, y, size, size); renderer.setViewport(x, y, size, size);
  renderer.render(scene, loupeCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  loupeEl.style.left = x + 'px'; loupeEl.style.top = (H - y - size) + 'px';
}
const guide = new THREE.Group(); scene.add(guide);
const guideLine = new THREE.Mesh(new THREE.CylinderGeometry(.0008, .0008, 1, 6), new THREE.MeshBasicMaterial({ color: 0x0B6B63, transparent: true, opacity: .55, depthWrite: false })); guide.add(guideLine);
const guideRing = new THREE.Mesh(new THREE.RingGeometry(.018, .022, 40), new THREE.MeshBasicMaterial({ color: 0x0B6B63, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide })); guideRing.rotation.x = -Math.PI / 2; guide.add(guideRing);
const hiRing = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1FA493, transparent: true, opacity: .85, depthWrite: false })); hiRing.rotation.x = -Math.PI / 2; scene.add(hiRing);
function updateGuides(t) {
  const o = held || dockedObj();
  let tg = null; if (o) tg = (o.pour && o.pour.tg) || (o.pz && o.pz.tg) || o.cand || (o.zoneV ? { kind: 'vessel', v: o.zoneV } : null) || (o.tg && o.tg.kind ? o.tg : null);
  if (tg) { let c, R; if (tg.kind === 'vessel') { c = V3(tg.v.g.position.x, rimY(tg.v) + .002, tg.v.g.position.z); R = tg.v.R + .006; } else if (tg.kind === 'bottle') { c = V3(tg.b.g.position.x, BOT_H + .003, tg.b.g.position.z); R = .016; } else { c = V3(tg.c.x, .002, tg.c.z); R = .05; }
    hiRing.visible = true; hiRing.position.copy(c); const engaged = (o.pour || o.pz); const s = R * (engaged ? 1 : 1 + .08 * Math.sin(t * 8)); hiRing.scale.set(s, s, engaged ? s : s); hiRing.material.opacity = engaged ? .9 : .6; }
  else hiRing.visible = false;
  if (held && !held.pour && !held.pz && !tg) {
    const p = held.kind === 'pipette' ? held.g.position.clone() : held.kind === 'bottle' || held.kind === 'vessel' ? held.g.position.clone() : held.g.position.clone();
    const ground = (p.x > SINK.x0 && p.x < SINK.x1 && p.z > SINK.z0 && p.z < SINK.z1) ? -SINK.depth : 0;
    const h = Math.max(.001, p.y - ground); guide.visible = true; guideLine.position.set(p.x, ground + h / 2, p.z); guideLine.scale.y = h; guideRing.position.set(p.x, ground + .0015, p.z);
  } else guide.visible = false;
}
const pill = document.createElement('div'); pill.className = 'tip pill'; pill.hidden = true; stage.append(pill);
/* auto-zoom: while pouring or pipetting the camera moves close to the target and frames it in the upper part of the view, clear of the finger */
let autoZoom = true, camSaved = null, zoomKey = null;
function updateAutoZoom() {
  const pr = [...bottles, ...vessels].find(q => q.pour), pp = pipettes.find(q => q.pz);
  const tg = pr ? pr.pour.tg : pp ? pp.pz.tg : null;
  const key = tg ? (tg.kind + (tg.v ? tg.v.letter : tg.b ? tg.b.id : '')) : null;
  if (key === zoomKey) return; zoomKey = key;
  if (!autoZoom) return;
  if (tg) {
    if (!camSaved) camSaved = { p: (camAnim ? camAnim.p : camera.position).clone(), t: (camAnim ? camAnim.t : controls.target).clone() };
    const d = camera.position.clone().sub(controls.target); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
    const portrait = camera.aspect < 1, dist = portrait ? .58 : .46;
    let T0 = V3(tg.c.x, .045, tg.c.z), el = D2R(34), dd = dist;
    if (pr) T0.addScaledVector(V3(pr.dir.x, 0, pr.dir.z), -.06);
    if (pp) { // whole pipette in view, seen almost level so the scale can be read
      const tipY = tg.kind === 'vessel' ? tg.v.g.position.y + tg.v.b + .004 : Math.max(.012, tg.b.shape.levelAt(0, tg.b.V) - .02);
      T0 = V3(tg.c.x, tipY + pp.L * .5, tg.c.z); el = D2R(12);
      dd = (pp.L * .62) / Math.tan(D2R(camera.fov / 2)); }
    flyTo(T0, T0.clone().addScaledVector(d, Math.cos(el) * dd).add(V3(0, Math.sin(el) * dd, 0)));
  } else if (camSaved) { flyTo(camSaved.t, camSaved.p); camSaved = null; }
}

/* ===================== loop ===================== */
const clock = new THREE.Clock();
function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 56 : 38; camera.updateProjectionMatrix(); if (!viewTouched) { const v = view0(); camera.position.copy(v.p); controls.target.copy(v.t); } }
new ResizeObserver(resize).observe(stage);
let uiAcc = 0, shownPH = null;
const perf = { n: 0, acc: 0, slow: 0, fast: 0 };
function watchdog(raw) {
  perf.n++; perf.acc += raw; if (perf.acc < 2) return;
  const fps = perf.n / perf.acc; perf.n = 0; perf.acc = 0;
  if (document.hidden) return;
  if (fps < 34) { perf.slow++; perf.fast = 0; } else if (fps > 55) { perf.fast++; perf.slow = 0; } else { perf.slow = perf.fast = 0; }
  if (perf.slow >= 2 && Q.level > 0) { perf.slow = 0; Q.level--; applyQuality(); }
  else if (perf.fast >= 5 && Q.level < 2 && Q.pr < Q.maxPr) { perf.fast = 0; Q.level++; applyQuality(); }
}
Q.maxPr = Q.pr;
function applyQuality() {
  // level 2: full · level 1: lower resolution, fewer bubbles · level 0: also no cast shadows
  renderer.setPixelRatio(Q.level === 2 ? Q.maxPr : Q.level === 1 ? Math.max(1, Q.maxPr * .75) : 1);
  sun.castShadow = Q.level > 0; Q.fx = Q.level === 2 ? 1 : Q.level === 1 ? .6 : .35; renderer.setSize(stage.clientWidth, stage.clientHeight, false);
}
function frame() {
  const raw = clock.getDelta(), dt = Math.min(.05, raw), t = clock.elapsedTime; watchdog(raw);
  for (const v of vessels) if (!v.stowed) updatePourer(v, dt, t);
  for (const b of bottles) if (!b.stowed) updatePourer(b, dt, t);
  for (const d of droppers) if (!d.stowed) updateDropper(d, dt);
  updateWash(wash, dt); if (!spatula.stowed) updateSpatula(spatula, dt); updateStick(electrode, dt); if (!rod.stowed) updateStick(rod, dt); for (const q of probes) if (!q.stowed) updateThermo(q, dt); updateRig(dt); updateBurette(dt); for (const q of pipettes) if (!q.stowed) updatePipette(q, dt, t);
  for (const v of vessels) if (!v.stowed) updateVessel(v, dt, t);
  checkTask();
  updateDrops(dt, t); updateSplashes(dt); updateGrains(dt); updateBalance(dt); updateCable(); updateCounter(); updateAutoZoom(); updateTap(dt); updateGuides(t); updateHolder(dt); updateElements(dt); updateProps(dt); updateHood(dt); updateMetals(dt); updateFX(dt);
  if (NB.session && performance.now() - NB.session.last > 800 && !droppers.some(d => d.parked === NB.session.v && NB.session.id === d.id)) endSession();
  const ev = electrode.in && !electrode.in.held && electrode.in.chem.V > .3 ? electrode.in : vesselAtPoint(electrode.g.position);
  if (METER.boot > 0) METER.boot -= dt;
  const meterReady = METER.on && METER.boot <= 0;
  if (ev && ev.chem.eq && meterReady) shownPH = shownPH == null ? 7 : shownPH + (ev.chem.eq.pH - shownPH) * (1 - Math.exp(-dt * 1.6)); else shownPH = null;
  uiAcc += dt; if (uiAcc > .2) { uiAcc = 0; if (!METER.on) drawLCD(null); else if (METER.boot > 0) drawLCD('88.88', '88.8 °C'); else drawLCD(shownPH == null ? '--.--' : fmt(shownPH + (Math.random() - .5) * .01, 2), shownPH == null ? '' : fmt(ev.temp, 1) + ' °C');
    const rp = $('rp'); if (rp) { rp.textContent = shownPH == null ? '–' : fmt(shownPH, 2); $('rt').textContent = shownPH == null ? '–' : fmt(ev.temp, 1) + ' °C'; $('rb').textContent = BAL.on && BAL.boot <= 0 ? fmt(BAL.shown, 2) + ' g' : '–'; } }
  updateCamera(dt); controls.update(); renderer.render(scene, camera); renderLoupe(); requestAnimationFrame(frame);
}
{ const tb = document.createElement('div'); tb.className = 'grp'; tb.id = 'invbtns';
  { const b = document.createElement('button'); b.type = 'button'; b.className = 'labsbtn'; b.addEventListener('click', openLabs); tb.append(b); }
  for (const sh of ['glass', 'chem']) { const b = document.createElement('button'); b.type = 'button'; b.dataset.shelf = sh; b.addEventListener('click', () => goShelf(sh)); tb.append(b); }
  $('viewbar').before(tb); }
buildTags(); resetState(); setupTask(TASKS[0]); setInspector(inspectorOpen); resize(); drawLCD(null); drawBalance('', false);
$('loading').remove();
requestAnimationFrame(frame);
window.__lab3d = { reactions: window.ReactionSimulation, BAYS, setupTask, TASKS, get TASK() { return TASK; }, DEMO, startDemo, nextDemo, stopDemo, lightLamp, moveArea, toggleProp, setPPE, checkAnswers, addLiquid, compOf, REAG, FX, rodHolder, propInfo, takeProp, BAL, BURETTE, eyeLevel, sampleInfo, HOOD, toggleDoorZ: z => toggleDoor(PT.doors.find(d => d.Z === z)), takeSampleZ: z => takeSample(PT.doors.find(d => d.Z === z)), updateThermo, thermos, tester, probes, conductivity, EVAP, RIG, updateRig, ITEMS, takeItem, PT, SLOTS, DECOR_PICK, PROPS, goShelf, viewShelf, touchView: () => { viewTouched = true; }, TAP, spatula, onShake, MOTION, Q, MOBILE, scene, pipettes, METER, controls, vessels, bottles, droppers, wash, spatula, electrode, rod, camera, renderer, BAL, NB, balanceButton, panLoad, vesselMass, endSession, placeVessel };
