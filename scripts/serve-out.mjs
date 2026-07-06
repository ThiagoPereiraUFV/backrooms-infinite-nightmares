// Minimal static file server for the exported `out/` directory.
// Serves under NEXT_PUBLIC_BASE_PATH to mirror how GitHub Pages hosts the app.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

async function tryRead(filePath) {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (basePath && !pathname.startsWith(basePath)) {
    res.writeHead(404).end("Not found (outside base path)");
    return;
  }
  pathname = pathname.slice(basePath.length) || "/";

  const resolved = path.normalize(path.join(root, pathname));
  if (!resolved.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  const candidates = pathname.endsWith("/")
    ? [path.join(resolved, "index.html")]
    : [resolved, `${resolved}.html`, path.join(resolved, "index.html")];

  for (const candidate of candidates) {
    const body = await tryRead(candidate);
    if (body) {
      const type = MIME[path.extname(candidate)] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type }).end(body);
      return;
    }
  }

  const notFoundPage = await tryRead(path.join(root, "404.html"));
  res
    .writeHead(404, { "content-type": "text/html; charset=utf-8" })
    .end(notFoundPage ?? "Not found");
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}${basePath}/`);
});
