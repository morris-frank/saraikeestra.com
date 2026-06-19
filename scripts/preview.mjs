import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "4173", 10);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".webp", "image/webp"]
]);

function resolveRequestPath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, `http://${host}:${port}`).pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const absolutePath = path.normalize(path.join(publicDir, relativePath));
  if (!absolutePath.startsWith(publicDir)) {
    return null;
  }
  return absolutePath;
}

const server = http.createServer(async (request, response) => {
  const resolvedPath = resolveRequestPath(request.url || "/");
  if (!resolvedPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let filePath = resolvedPath;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    await access(filePath);
  } catch {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    process.stderr.write(`Port ${port} is already in use on ${host}. Stop the other preview server or run with PORT=<port> pnpm preview\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  process.stdout.write(`Preview server running at http://${host}:${port}\n`);
});
