import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const waitForServer = (child, text) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("server timeout")), 8000);
  child.stdout.on("data", chunk => { if (String(chunk).includes(text)) { clearTimeout(timer); resolve(); } });
  child.once("exit", code => { clearTimeout(timer); reject(new Error(`server exited ${code}`)); });
});

const dataDir = await mkdtemp(join(tmpdir(), "chem-lab-analytics-"));
const port = await freePort(), base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server.mjs"], { cwd: new URL(".", import.meta.url), env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", LAB_DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"] });
try {
  await waitForServer(child, "Bench Chemistry Lab is running");
  let r = await fetch(`${base}/hub-assets/lab-chemistry.jpg`);
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/jpeg");
  r = await fetch(`${base}/server.mjs`);
  assert.equal(r.status, 404);
  r = await fetch(`${base}/teacher`, { redirect: "manual" });
  assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/teacher/login");
  r = await fetch(`${base}/teacher/login`, { redirect: "manual" });
  assert.equal(r.status, 303); assert.equal(r.headers.get("location"), "/teacher/setup");
  r = await fetch(`${base}/teacher/setup`, { headers: { "x-forwarded-for": "203.0.113.10", "x-forwarded-proto": "https" } });
  assert.equal(r.status, 403);
  r = await fetch(`${base}/teacher/setup`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: "correct horse battery staple", confirm: "correct horse battery staple" }) });
  assert.equal(r.status, 303);
  r = await fetch(`${base}/teacher/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: "correct horse battery staple" }) });
  assert.equal(r.status, 303); const cookie = r.headers.get("set-cookie").split(";")[0];

  const payloads = ["k111", "k112", "k113", "k3v01", "k3v02"].map(labId => ({ batchId: randomUUID(), sessionId: randomUUID(), attemptId: randomUUID(), labId, mode: "independent", startedAt: Date.now(), activeMs: 240000, lastStep: "lab:completed", completed: true, activities: [{ key: "reagent:hcl", count: 3, amount: 12.5 }, { key: "take:beaker:A", count: 1, amount: 0 }, { key: "safety:noGoggles", count: 1, amount: 0 }] }));
  const payload = payloads[0];
  for (const item of payloads) {
    r = await fetch(`${base}/api/analytics/flush`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item) }); assert.equal(r.status, 204);
  }
  // Replaying the same batch must be idempotent.
  r = await fetch(`${base}/api/analytics/flush`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); assert.equal(r.status, 204);
  const day = new Date().toISOString().slice(0, 10);
  r = await fetch(`${base}/teacher/data?from=${day}&to=${day}`, { headers: { cookie } }); assert.equal(r.status, 200);
  const report = await r.json(); assert.equal(report.sessions, 5); assert.equal(report.completed, 5); assert.equal(report.averageMs, 240000); assert.equal(report.reagents[0].key, "reagent:hcl"); assert.equal(report.reagents[0].count, 15); assert.equal(report.safety[0].count, 5);
  console.log("analytics: authentication, K1/K3 lab acceptance, aggregation and idempotency passed");
} finally {
  child.kill("SIGTERM"); await new Promise(resolve => child.once("exit", resolve)); await rm(dataDir, { recursive: true, force: true });
}
