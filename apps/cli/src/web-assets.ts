import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";

// Resolved through the package rather than a path relative to this file, so it
// works the same from `dist` in the repo and from a published install where the
// two packages sit side by side in node_modules.
export function webAssetsDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@keepcv/web/package.json")), "dist");
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
      // Hashed filenames for the assets; the entry document is never cached,
      // because a stale one would load an asset the new build has deleted.
      "cache-control": path.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
    },
  });
}

// A single-page app: anything that is not a file on disk is a route the client
// resolves, so it gets the entry document rather than a 404.
export function serveWebApp(root: string): (request: Request) => Promise<Response> {
  const index = join(root, "index.html");

  return async (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    // Normalised and confirmed to be under the root before anything is opened:
    // a path with `..` in it is otherwise a read of any file the process can see.
    const candidate = resolve(root, `.${normalize(pathname)}`);
    const inside = candidate === root || candidate.startsWith(root + sep);

    const found = inside ? await fileAt(candidate) : undefined;
    return (
      found ?? (await fileAt(index)) ?? new Response("no web app is installed", { status: 404 })
    );
  };
}
