import { mkdirSync } from "node:fs";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MAX_BODY = 64 * 1024;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const LABS = new Set(["free", "acidalkali", "phmeasure", "combustion", "nonmetals-spc", "nonmetals-halogens", "ind1", "ind2", "ind3", "pre1", "pre2", "pre3", "k111", "k112", "k113", "k3v01", "k3v02"]);
const ID_RE = /^[a-f0-9-]{20,64}$/i;
const KEY_RE = /^[a-z0-9_.:+-]{1,100}$/i;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function htmlPage(title, body, script = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#15201d;background:#eef2f1}*{box-sizing:border-box}body{margin:0}.wrap{width:min(1120px,calc(100% - 28px));margin:28px auto}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}h1{font-size:26px;margin:0}h2{font-size:17px;margin:0 0 12px}.card{background:#fff;border:1px solid #c3cec9;border-radius:14px;padding:18px;box-shadow:0 5px 18px #1e322d12}.login{width:min(430px,calc(100% - 28px));margin:10vh auto}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric b{display:block;font-size:25px;margin-top:5px}.muted{color:#60706a;font-size:13px}.sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.wide{grid-column:1/-1}form{display:grid;gap:10px}label{font-size:13px;font-weight:600}input,button,select{font:inherit;padding:9px 11px;border:1px solid #aebdb7;border-radius:9px;background:#fff;color:#15201d}button{cursor:pointer;background:#08766d;color:#fff;border-color:#08766d;font-weight:650}.filters{display:flex;align-items:end;gap:9px;flex-wrap:wrap}.filters label{display:grid;gap:4px}.filters button{padding:9px 16px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e1e7e4}th{color:#60706a;font-size:12px;text-transform:uppercase}td.num,th.num{text-align:right}.empty{padding:18px;color:#60706a;text-align:center}.error{color:#9c251d;background:#fde8e5;border-radius:8px;padding:9px}.logout{background:#fff;color:#08766d}.privacy{margin-top:14px;font-size:12px;color:#60706a}@media(max-width:760px){.grid{grid-template-columns:1fr 1fr}.sections{grid-template-columns:1fr}.wide{grid-column:auto}.top{align-items:flex-start;flex-direction:column}}
  </style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0, body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { size += chunk.length; if (size > MAX_BODY) { reject(new Error("too_large")); request.destroy(); } else body += chunk; });
    request.on("end", () => resolve(body)); request.on("error", reject);
  });
}

function cookieMap(request) {
  const out = {};
  for (const part of String(request.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}

function localRequest(request) {
  const ip = request.socket.remoteAddress || "";
  const forwarded = request.headers["x-forwarded-for"] || request.headers["forwarded"] || request.headers["x-forwarded-proto"];
  return !forwarded && (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1");
}

function securityHeaders(response, noStore = false) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (noStore) response.setHeader("Cache-Control", "no-store");
}

function send(response, status, type, body, headers = {}) {
  securityHeaders(response, type.includes("html") || type.includes("json"));
  response.writeHead(status, { "Content-Type": type, ...headers }); response.end(body);
}

function json(response, status, value) { send(response, status, "application/json; charset=utf-8", JSON.stringify(value)); }
function redirect(response, location, cookie) { securityHeaders(response, true); response.writeHead(303, { Location: location, ...(cookie ? { "Set-Cookie": cookie } : {}) }); response.end(); }

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y), i = Math.max(0, Math.ceil(p * a.length) - 1); return a[i];
}

export function createAnalytics({ dataDir }) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "lab-analytics.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, active_ms INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, lab_id TEXT NOT NULL, mode TEXT NOT NULL, started_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, active_ms INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, last_step TEXT);
    CREATE TABLE IF NOT EXISTS activities (attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE, action_key TEXT NOT NULL, action_count INTEGER NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0, PRIMARY KEY(attempt_id, action_key));
    CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_started ON attempts(started_at);
    CREATE INDEX IF NOT EXISTS idx_activities_key ON activities(action_key);`);

  const getSetting = db.prepare("SELECT value FROM settings WHERE key=?");
  const setSetting = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const teacherSessions = new Map();
  const loginFailures = new Map();

  function credentials() {
    const salt = getSetting.get("teacher_salt")?.value, hash = getSetting.get("teacher_hash")?.value;
    return salt && hash ? { salt, hash } : null;
  }
  function authenticated(request) {
    const token = cookieMap(request).teacher_session, record = token && teacherSessions.get(token);
    if (!record || record.expires < Date.now()) { if (token) teacherSessions.delete(token); return false; }
    record.expires = Date.now() + SESSION_TTL; return true;
  }
  function sessionCookie(request, token, maxAge = Math.floor(SESSION_TTL / 1000)) {
    const secure = request.headers["x-forwarded-proto"] === "https";
    return `teacher_session=${encodeURIComponent(token)}; Path=/teacher; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  }
  function loginPage(message = "") {
    return htmlPage("Teacher sign in", `<main class="login card"><h1>Teacher statistics</h1><p class="muted">Private aggregate laboratory analytics. Students cannot access this area.</p>${message ? `<p class="error">${esc(message)}</p>` : ""}<form method="post" action="/teacher/login"><label>Password<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Sign in</button></form></main>`);
  }
  function setupPage(message = "") {
    return htmlPage("Create teacher account", `<main class="login card"><h1>Create teacher account</h1><p>This first-time setup is available only from this computer. Choose a password of at least 12 characters.</p>${message ? `<p class="error">${esc(message)}</p>` : ""}<form method="post" action="/teacher/setup"><label>New password<input name="password" type="password" minlength="12" autocomplete="new-password" required autofocus></label><label>Repeat password<input name="confirm" type="password" minlength="12" autocomplete="new-password" required></label><button type="submit">Create private account</button></form></main>`);
  }

  const labels = {
    free: "Free bench", acidalkali: "Acid neutralisation", phmeasure: "Acid strength, concentration and pH", combustion: "Complete and incomplete combustion",
    ind1: "Indicators I", ind2: "Indicators II", ind3: "Indicators III", pre1: "Precipitates I", pre2: "Precipitates II", pre3: "Precipitates III"
  };
  function dashboardPage() {
    const script = `
const $=s=>document.querySelector(s),fmt=n=>new Intl.NumberFormat().format(n||0),dur=ms=>{const m=Math.floor((ms||0)/60000),s=Math.round(((ms||0)%60000)/1000);return m+'m '+String(s).padStart(2,'0')+'s'};
const pretty=k=>{const map={${Object.entries(labels).map(([k,v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",")},'measure:ph':'Measured pH','measure:mass':'Measured mass','measure:temperature':'Measured temperature','mix:liquid':'Mixed liquids','flame:yellow':'Observed yellow flame','flame:blue':'Observed blue flame','flame:off':'Closed gas supply','demo:step':'Watched a demo step'};if(map[k])return map[k];const [a,...r]=k.split(':');const n=r.join(':').replace(/^bottle:/,'').replace(/^dropper:/,'').replace(/[_.-]+/g,' ');return ({reagent:'Used',indicator:'Used indicator',take:'Took',return:'Returned',open:'Opened',solid:'Used solid',safety:'Safety issue',lab:'Lab'}[a]||a.replace(/[_.-]+/g,' '))+(n?' — '+n:'')};
function rows(items,amount=false){return items.length?items.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+pretty(x.key)+'</td><td class="num">'+fmt(x.count)+'</td>'+(amount?'<td class="num">'+(x.amount?Number(x.amount).toFixed(1):'—')+'</td>':'')+'</tr>').join(''):'<tr><td colspan="4" class="empty">No data for this period</td></tr>'}
function table(title,items,amount=false){return '<section class="card"><h2>'+title+'</h2><table><thead><tr><th>#</th><th>Activity</th><th class="num">Uses</th>'+(amount?'<th class="num">Amount</th>':'')+'</tr></thead><tbody>'+rows(items,amount)+'</tbody></table></section>'}
async function load(){const p=new URLSearchParams(new FormData($('#filters'))),r=await fetch('/teacher/data?'+p);if(r.status===401){location='/teacher/login';return}const d=await r.json();$('#metrics').innerHTML=[['Sessions',fmt(d.sessions)],['Average active session',dur(d.averageMs)],['Median active session',dur(d.medianMs)],['90th percentile',dur(d.p90Ms)],['Completed labs',fmt(d.completed)],['Abandoned labs',fmt(d.abandoned)]].map(x=>'<div class="card metric"><span class="muted">'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');$('#sections').innerHTML=table('Reagents and indicators used',d.reagents,true)+table('Equipment taken',d.equipment)+table('20 most frequent actions',d.topActions)+table('Frequent safety mistakes',d.safety)+table('Three most frequent abandonment points',d.abandonment)+'<section class="card"><h2>Laboratories</h2><table><thead><tr><th>Lab</th><th class="num">Started</th><th class="num">Completed</th><th class="num">Abandoned</th></tr></thead><tbody>'+d.labs.map(x=>'<tr><td>'+pretty(x.key)+'</td><td class="num">'+fmt(x.started)+'</td><td class="num">'+fmt(x.completed)+'</td><td class="num">'+fmt(x.abandoned)+'</td></tr>').join('')+'</tbody></table></section>'}
$('#filters').addEventListener('submit',e=>{e.preventDefault();load()});const now=new Date(),ago=new Date(now-29*864e5);$('#to').value=now.toISOString().slice(0,10);$('#from').value=ago.toISOString().slice(0,10);load();`;
    return htmlPage("Teacher statistics", `<main class="wrap"><header class="top"><div><h1>Chemistry laboratory statistics</h1><div class="muted">Anonymous aggregate activity only</div></div><form method="post" action="/teacher/logout"><button class="logout">Sign out</button></form></header><section class="card"><form id="filters" class="filters"><label>From<input id="from" name="from" type="date" required></label><label>To<input id="to" name="to" type="date" required></label><button>Update report</button></form></section><section id="metrics" class="grid" style="margin-top:14px"></section><div id="sections" class="sections"></div><p class="privacy">Active time excludes hidden tabs and periods without meaningful laboratory activity. A laboratory is considered abandoned after five minutes without activity unless it was completed.</p></main>`, script);
  }

  function report(from, to) {
    const start = Date.parse(`${from}T00:00:00`), end = Date.parse(`${to}T23:59:59.999`), now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 366 * 86400000) throw new Error("date");
    const sessions = db.prepare("SELECT active_ms FROM sessions WHERE started_at BETWEEN ? AND ?").all(start, end).map(x => x.active_ms);
    const attempts = db.prepare("SELECT id,lab_id,completed,last_seen,last_step FROM attempts WHERE started_at BETWEEN ? AND ?").all(start, end);
    const labAttempts = attempts.filter(x => x.lab_id !== "free");
    const abandoned = labAttempts.filter(x => !x.completed && now - x.last_seen > 5 * 60000);
    const completed = labAttempts.filter(x => x.completed).length;
    const aggregate = (where = "1=1", limit = 20) => db.prepare(`SELECT a.action_key key,SUM(a.action_count) count,SUM(a.amount) amount FROM activities a JOIN attempts t ON t.id=a.attempt_id WHERE t.started_at BETWEEN ? AND ? AND ${where} GROUP BY a.action_key ORDER BY count DESC LIMIT ?`).all(start, end, limit);
    const labMap = new Map(); for (const a of labAttempts) { const x = labMap.get(a.lab_id) || { key: a.lab_id, started: 0, completed: 0, abandoned: 0 }; x.started++; if (a.completed) x.completed++; else if (now - a.last_seen > 5 * 60000) x.abandoned++; labMap.set(a.lab_id, x); }
    const abandonMap = new Map(); for (const a of abandoned) if (a.last_step) abandonMap.set(a.last_step, (abandonMap.get(a.last_step) || 0) + 1);
    return {
      sessions: sessions.length, averageMs: sessions.length ? Math.round(sessions.reduce((a,b)=>a+b,0)/sessions.length) : 0, medianMs: percentile(sessions,.5), p90Ms: percentile(sessions,.9), completed, abandoned: abandoned.length,
      reagents: aggregate("(a.action_key LIKE 'reagent:%' OR a.action_key LIKE 'indicator:%' OR a.action_key LIKE 'solid:%')", 50),
      equipment: aggregate("a.action_key LIKE 'take:%'", 50),
      topActions: aggregate("a.action_key NOT LIKE 'safety:%'", 20), safety: aggregate("a.action_key LIKE 'safety:%'", 30),
      abandonment: [...abandonMap].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key,count])=>({key,count,amount:0})), labs: [...labMap.values()].sort((a,b)=>b.started-a.started)
    };
  }

  const hasBatch = db.prepare("SELECT 1 FROM batches WHERE id=?");
  const insertBatch = db.prepare("INSERT INTO batches(id,received_at) VALUES(?,?)");
  const insertSession = db.prepare("INSERT OR IGNORE INTO sessions(id,started_at,last_seen,active_ms) VALUES(?,?,?,0)");
  const updateSession = db.prepare("UPDATE sessions SET last_seen=?,active_ms=active_ms+? WHERE id=?");
  const insertAttempt = db.prepare("INSERT OR IGNORE INTO attempts(id,session_id,lab_id,mode,started_at,last_seen,active_ms,completed,last_step) VALUES(?,?,?,?,?,?,0,0,NULL)");
  const updateAttempt = db.prepare("UPDATE attempts SET last_seen=?,active_ms=active_ms+?,completed=MAX(completed,?),last_step=COALESCE(?,last_step) WHERE id=? AND session_id=?");
  const upsertActivity = db.prepare("INSERT INTO activities(attempt_id,action_key,action_count,amount) VALUES(?,?,?,?) ON CONFLICT(attempt_id,action_key) DO UPDATE SET action_count=action_count+excluded.action_count,amount=amount+excluded.amount");

  function ingest(payload) {
    const now = Date.now();
    if (!payload || !ID_RE.test(payload.batchId || "") || !ID_RE.test(payload.sessionId || "") || !ID_RE.test(payload.attemptId || "") || !LABS.has(payload.labId) || !["independent","demo","free"].includes(payload.mode)) throw new Error("invalid");
    if (hasBatch.get(payload.batchId)) return;
    const active = Math.max(0, Math.min(300000, Number(payload.activeMs) || 0));
    const started = Math.max(now - 86400000, Math.min(now, Number(payload.startedAt) || now));
    const step = payload.lastStep && KEY_RE.test(payload.lastStep) ? payload.lastStep : null;
    const items = Array.isArray(payload.activities) ? payload.activities.slice(0,100) : [];
    db.exec("BEGIN IMMEDIATE");
    try {
      if (hasBatch.get(payload.batchId)) { db.exec("ROLLBACK"); return; }
      insertSession.run(payload.sessionId, started, now); updateSession.run(now, active, payload.sessionId);
      insertAttempt.run(payload.attemptId, payload.sessionId, payload.labId, payload.mode, started, now); updateAttempt.run(now, active, payload.completed ? 1 : 0, step, payload.attemptId, payload.sessionId);
      for (const x of items) if (x && KEY_RE.test(x.key || "")) upsertActivity.run(payload.attemptId, x.key, Math.max(0, Math.min(1000, Math.floor(Number(x.count) || 0))), Math.max(0, Math.min(1e7, Number(x.amount) || 0)));
      insertBatch.run(payload.batchId, now); db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }

  async function handle(request, response, url) {
    if (url.pathname === "/api/analytics/flush" && request.method === "POST") {
      if (request.headers["sec-fetch-site"] === "cross-site") { json(response, 403, { error: "forbidden" }); return true; }
      try { ingest(JSON.parse(await readBody(request))); response.writeHead(204, { "Cache-Control": "no-store" }); response.end(); }
      catch { json(response, 400, { error: "invalid analytics batch" }); }
      return true;
    }
    if (!url.pathname.startsWith("/teacher")) return false;
    if (url.pathname === "/teacher/setup") {
      if (credentials()) { redirect(response, "/teacher"); return true; }
      if (!localRequest(request)) { send(response, 403, "text/html; charset=utf-8", htmlPage("Local setup required", `<main class="login card"><h1>Local setup required</h1><p>Open <strong>http://127.0.0.1:4173/teacher</strong> on the laboratory computer to create the teacher account.</p></main>`)); return true; }
      if (request.method === "GET") { send(response, 200, "text/html; charset=utf-8", setupPage()); return true; }
      if (request.method === "POST") { const form = new URLSearchParams(await readBody(request)), password = form.get("password") || ""; if (password.length < 12 || password !== form.get("confirm")) { send(response, 400, "text/html; charset=utf-8", setupPage("Passwords must match and contain at least 12 characters.")); return true; } const p = hashPassword(password); setSetting.run("teacher_salt", p.salt); setSetting.run("teacher_hash", p.hash); redirect(response, "/teacher/login"); return true; }
    }
    if (url.pathname === "/teacher/login") {
      if (!credentials()) { redirect(response, "/teacher/setup"); return true; }
      if (request.method === "GET") { send(response, 200, "text/html; charset=utf-8", loginPage()); return true; }
      if (request.method === "POST") {
        const ip = request.socket.remoteAddress || "unknown", fail = loginFailures.get(ip) || { count: 0, until: 0 };
        if (fail.until > Date.now()) { send(response, 429, "text/html; charset=utf-8", loginPage("Too many attempts. Try again later.")); return true; }
        const password = new URLSearchParams(await readBody(request)).get("password") || "", c = credentials(), got = scryptSync(password, c.salt, 64), want = Buffer.from(c.hash, "hex");
        if (got.length !== want.length || !timingSafeEqual(got, want)) { fail.count++; if (fail.count >= 5) { fail.count = 0; fail.until = Date.now() + 5*60000; } loginFailures.set(ip, fail); send(response, 401, "text/html; charset=utf-8", loginPage("Incorrect password.")); return true; }
        loginFailures.delete(ip); const token = randomBytes(32).toString("base64url"); teacherSessions.set(token, { expires: Date.now() + SESSION_TTL }); redirect(response, "/teacher", sessionCookie(request, token)); return true;
      }
    }
    if (url.pathname === "/teacher/logout" && request.method === "POST") { const token = cookieMap(request).teacher_session; if (token) teacherSessions.delete(token); redirect(response, "/teacher/login", sessionCookie(request, "", 0)); return true; }
    if (!authenticated(request)) { if (url.pathname === "/teacher/data") json(response, 401, { error: "authentication required" }); else redirect(response, "/teacher/login"); return true; }
    if (url.pathname === "/teacher/data" && request.method === "GET") { try { json(response, 200, report(url.searchParams.get("from"), url.searchParams.get("to"))); } catch { json(response, 400, { error: "invalid date range" }); } return true; }
    if (url.pathname === "/teacher" || url.pathname === "/teacher/") { send(response, 200, "text/html; charset=utf-8", dashboardPage()); return true; }
    send(response, 404, "text/plain; charset=utf-8", "Not found"); return true;
  }

  return { handle, close: () => db.close(), db };
}
