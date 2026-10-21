import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createAnalytics } from "./analytics.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const analytics = createAnalytics({ dataDir: process.env.LAB_DATA_DIR || join(root, ".data") });
const publicFiles = new Set([
  join(root, "index.html"),
  join(root, "chemistry", "index.html"),
  join(root, "lab", "lab.html"),
  join(root, "lab3d", "lab3d.html"),
  ...[
    "lab-biology.jpg",
    "lab-chemistry.jpg",
    "lab-geography.jpg",
    "lab-math.jpg",
    "lab-navigation.jpg",
    "lab-strength.jpg",
    "lab-thermodynamics.jpg"
  ].map((name) => join(root, "hub-assets", name))
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidate = resolve(root, `.${sep}${normalize(decoded).replace(/^([/\\])+/, "")}`);
  const rel = relative(root, candidate);
  return rel && (rel.startsWith("..") || rel.includes(`..${sep}`)) ? null : candidate;
}

function publicFilePath(pathname) {
  if (pathname.startsWith("/chemistry/lab3d/")) return pathname.slice("/chemistry".length);
  if (pathname.startsWith("/chemistry/lab/")) return pathname.slice("/chemistry".length);
  return pathname;
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try { if (await analytics.handle(request, response, requestUrl)) return; }
  catch (error) { console.error("Analytics request failed:", error); response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Internal server error"); return; }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }
  let filePath = safePath(publicFilePath(requestUrl.pathname));

  if (!filePath) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  try {
    if (statSync(filePath).isDirectory()) {
      if (!requestUrl.pathname.endsWith("/")) {
        response.writeHead(308, { Location: `${requestUrl.pathname}/${requestUrl.search}` });
        response.end();
        return;
      }
      filePath = join(filePath, "index.html");
    }

    if (!publicFiles.has(filePath)) throw new Error("Not public");

    const info = statSync(filePath);
    if (!info.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Bench Chemistry Lab is running at http://${host}:${port}`);
  console.log("Keep this terminal open while using the lab.");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set another port with: $env:PORT=4174; npm.cmd start`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

function close() { analytics.close(); server.close(); }
process.once("SIGINT", close);
process.once("SIGTERM", close);
