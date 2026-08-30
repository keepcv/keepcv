import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveWebApp, webAssetsDir } from "./web-assets.js";

let root: string;
let outside: string;
let serve: (request: Request) => Promise<Response>;

beforeAll(async () => {
  outside = await mkdtemp(join(tmpdir(), "keepcv-web-"));
  root = join(outside, "dist");
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "index.html"), "<!doctype html><title>KeepCV</title>");
  await writeFile(join(root, "assets", "index-abc123.js"), "console.log(1)");
  await writeFile(join(outside, "secrets.txt"), "the launch token");
  serve = serveWebApp(root);
});

afterAll(async () => {
  await rm(outside, { recursive: true, force: true });
});

async function get(path: string): Promise<Response> {
  return await serve(new Request(`http://127.0.0.1:4319${path}`));
}

describe("the web app handler", () => {
  it("serves a file that exists, typed", async () => {
    const response = await get("/assets/index-abc123.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await response.text()).toBe("console.log(1)");
  });

  // Asset names carry a content hash, so they can be cached forever. The entry
  // document cannot: a stale one loads assets the new build has deleted.
  it("caches hashed assets forever and the entry document never", async () => {
    expect((await get("/assets/index-abc123.js")).headers.get("cache-control")).toContain(
      "immutable",
    );
    expect((await get("/")).headers.get("cache-control")).toBe("no-store");
  });

  // A single-page app resolves its own routes, so an unknown path is a route
  // and not a miss.
  it("answers an unknown path with the entry document", async () => {
    const response = await get("/records");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("KeepCV");
  });

  // Normalising the path and confirming it is under the root each cover the
  // other, so removing either alone leaves this passing. Removing both does
  // not.
  it("refuses to escape the root, however the path is written", async () => {
    for (const path of [
      "/../secrets.txt",
      "/assets/../../secrets.txt",
      "/%2e%2e/secrets.txt",
      "/..%2fsecrets.txt",
    ]) {
      const body = await (await get(path)).text();
      expect(body, path).not.toContain("the launch token");
    }
  });

  it("finds the built app that ships beside the launcher", () => {
    expect(webAssetsDir()).toMatch(/web[/\\]dist$/);
  });
});
