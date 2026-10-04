import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

export function webAssetsDir(): string {
  return fileURLToPath(new URL("../dist/web", import.meta.url));
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function contentType(path: string): string {
  const dot = path.lastIndexOf(".");
  return CONTENT_TYPES[path.slice(dot)] ?? "application/octet-stream";
}

async function fileAt(path: string): Promise<Response | undefined> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isFile()) return undefined;

  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
    headers: {
      "content-type": contentType(path),
      "content-length": String(info.size),
      // Unversioned entry files must not keep references or behavior from an old build.
      "cache-control":
        path.endsWith(".html") || basename(path) === "theme.js"
          ? "no-store"
          : "public, max-age=31536000, immutable",
    },
  });
}

export function serveWebApp(root: string): (request: Request) => Promise<Response> {
  const index = join(root, "index.html");

  return async (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    // A traversal must not read files outside the web assets root.
    const candidate = resolve(root, `.${normalize(pathname)}`);
    const inside = candidate === root || candidate.startsWith(root + sep);

    const found = inside ? await fileAt(candidate) : undefined;
    return (
      found ?? (await fileAt(index)) ?? new Response("no web app is installed", { status: 404 })
    );
  };
}
