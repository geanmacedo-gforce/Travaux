import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".eot":  "application/vnd.ms-fontobject",
  ".map":  "application/json",
};

function serveStatic(req, res, clientDir) {
  // Only serve GET/HEAD for paths that look like static assets
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  // Strip query string before resolving
  const urlPath = (req.url || "/").split("?")[0];
  const filePath = path.resolve(clientDir, urlPath.replace(/^\//, ""));

  // Prevent path traversal
  if (!filePath.startsWith(clientDir)) return false;

  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Long cache for hashed assets, no-cache for everything else
  const isHashed = /[.-][a-zA-Z0-9_-]{8,}\.[a-z]+$/.test(path.basename(filePath));
  const cacheControl = isHashed
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": cacheControl,
    "content-length": stat.size,
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const distEntryPath = path.resolve(new URL("../dist/server/index.js", import.meta.url).pathname);
const distClientPath = path.resolve(new URL("../dist/client", import.meta.url).pathname);

console.log("[Travaux] server bootstrap", {
  host,
  port,
  distEntryPath,
  distClientPath,
  cwd: process.cwd(),
});

if (!fs.existsSync(distEntryPath)) {
  throw new Error("Travaux build not found. Run npm run build before starting the server.");
}

const workerModule = await import(pathToFileUrl(distEntryPath));
const worker = workerModule.default;

if (!worker || typeof worker.fetch !== "function") {
  throw new Error("Invalid Travaux worker entry. Expected a default export with a fetch method.");
}

const server = http.createServer(async (req, res) => {
  try {
    // Serve static assets from dist/client before hitting the SSR worker
    if (serveStatic(req, res, distClientPath)) return;

    const requestUrl = `http://${req.headers.host || `${host}:${port}`}${req.url || "/"}`;
    console.log("[Travaux] request", {
      method: req.method,
      url: req.url,
      host: req.headers.host,
      remoteAddress: req.socket?.remoteAddress ?? null,
    });
    const headers = new Headers();

    for (const [headerName, headerValue] of Object.entries(req.headers)) {
      if (headerValue === undefined) continue;
      if (Array.isArray(headerValue)) {
        headers.set(headerName, headerValue.join(", "));
      } else {
        headers.set(headerName, headerValue);
      }
    }

    const remoteAddress = req.socket?.remoteAddress ?? null;
    if (remoteAddress) {
      headers.set("x-remote-address", remoteAddress);
      if (!headers.get("x-forwarded-for") && !headers.get("x-real-ip") && !headers.get("cf-connecting-ip")) {
        headers.set("x-socket-address", remoteAddress);
      }
    }

    const init = { method: req.method, headers };
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }

    const response = await worker.fetch(new Request(requestUrl, init), undefined, undefined);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const chunks = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }

    res.end(Buffer.concat(chunks));
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Travaux server listening on http://${host}:${port}`);
});

function pathToFileUrl(filePath) {
  const normalizedPath = path.resolve(filePath).replace(/\\/g, "/");
  return `file://${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
}