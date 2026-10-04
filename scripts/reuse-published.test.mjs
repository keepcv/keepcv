import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { comparePackages, reusePublishedTarball } from "./reuse-published.mjs";

const exec = promisify(execFile);
const pkg = { name: "@keepcv/core", version: "0.1.3" };

async function fixture(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, "keepcv-reuse-"));
  t.after(async () => {
    assert.equal(dirname(await realpath(root)), parent);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, "package", "dist"), { recursive: true });
  const pack = async (name, body = "export const answer = 42;", manifest = pkg) => {
    await writeFile(join(root, "package", "package.json"), JSON.stringify(manifest));
    await writeFile(join(root, "package", "dist", "index.js"), body);
    const path = join(root, name);
    await exec("tar", ["-czf", path, "-C", root, "package/package.json", "package/dist/index.js"]);
    return path;
  };
  return { root, pack };
}

test("compares unchanged contents despite compression and manifest key order", async (t) => {
  const { root, pack } = await fixture(t);
  const local = await pack("local.tgz");
  const reordered = await pack("reordered.tgz", undefined, {
    version: pkg.version,
    name: pkg.name,
  });
  const recompressed = join(root, "registry.tgz");
  await writeFile(recompressed, gzipSync(gunzipSync(await readFile(reordered)), { level: 1 }));
  assert(!(await readFile(local)).equals(await readFile(recompressed)));
  await comparePackages(local, recompressed);
});

test("refuses runtime, manifest or file-list changes at an existing version", async (t) => {
  const { root, pack } = await fixture(t);
  const local = await pack("local.tgz");
  const code = await pack("code.tgz", "export const answer = 43;");
  await assert.rejects(comparePackages(local, code), /Published package\/dist\/index.js changed/);
  const manifest = await pack("manifest.tgz", undefined, {
    ...pkg,
    dependencies: { zod: "4.0.0" },
  });
  await assert.rejects(comparePackages(local, manifest), /manifest changed/);
  await writeFile(join(root, "package", "extra.js"), "export const extra = 1;");
  const extra = join(root, "extra.tgz");
  await exec("tar", [
    "-czf",
    extra,
    "-C",
    root,
    "package/package.json",
    "package/dist/index.js",
    "package/extra.js",
  ]);
  await assert.rejects(comparePackages(local, extra), /file list changed/);
});

test("reuses integrity-checked original bytes without changing registry publications", async (t) => {
  const { pack } = await fixture(t);
  const local = await pack("local.tgz");
  const bytes = gzipSync(gunzipSync(await readFile(local)), { level: 1 });
  const metadata = {
    ...pkg,
    dist: {
      tarball: "https://registry.npmjs.org/@keepcv/core/-/core-0.1.3.tgz",
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    },
  };
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++requests === 1 ? Response.json(metadata) : new Response(bytes),
  );
  assert.equal(await reusePublishedTarball(pkg, local), true);
  assert((await readFile(local)).equals(bytes));
  assert.equal(requests, 2);
});

test("does not reuse unpublished versions and rejects bad registry integrity", async (t) => {
  const { pack } = await fixture(t);
  const local = await pack("local.tgz");
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  assert.equal(await reusePublishedTarball(pkg, local), false);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++requests === 1
      ? Response.json({
          ...pkg,
          dist: { tarball: "https://registry.npmjs.org/core.tgz", integrity: "sha512-wrong" },
        })
      : new Response("wrong bytes"),
  );
  await assert.rejects(reusePublishedTarball(pkg, local), /integrity failed/);
});
