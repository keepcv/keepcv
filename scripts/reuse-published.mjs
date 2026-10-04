import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function comparePackages(left, right) {
  const list = async (path) => {
    const { stdout } = await exec("tar", ["-tf", path]);
    const files = stdout.trim().split(/\r?\n/).sort();
    assert(files.every((file) => file.startsWith("package/") && !file.split("/").includes("..")));
    assert.equal(files.length, new Set(files).size, "Duplicate archive member");
    return files;
  };
  const files = await list(left);
  assert.deepEqual(
    await list(right),
    files,
    "Published package file list changed; prepare a new version",
  );
  for (const file of files) {
    const read = async (path) =>
      (await exec("tar", ["-xOf", path, file], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }))
        .stdout;
    const [a, b] = await Promise.all([read(left), read(right)]);
    if (file === "package/package.json") {
      assert.deepEqual(
        JSON.parse(a),
        JSON.parse(b),
        "Published package manifest changed; prepare a new version",
      );
    } else {
      assert(a.equals(b), `Published ${file} changed; prepare a new version`);
    }
  }
}

export async function reusePublishedTarball(pkg, path) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`,
    { signal: AbortSignal.timeout(30_000), cache: "no-store" },
  );
  if (response.status === 404) return false;
  assert(response.ok, `Registry lookup for ${pkg.name}: ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.name, pkg.name);
  assert.equal(metadata.version, pkg.version);
  const url = new URL(metadata.dist?.tarball);
  assert.equal(url.origin, "https://registry.npmjs.org");
  const archive = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "error" });
  assert(archive.ok, `Registry tarball for ${pkg.name}: ${archive.status}`);
  const bytes = Buffer.from(await archive.arrayBuffer());
  assert.equal(
    `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    metadata.dist?.integrity,
    "Registry tarball integrity failed",
  );
  const downloaded = `${path}.registry`;
  try {
    await writeFile(downloaded, bytes);
    await comparePackages(path, downloaded);
    await writeFile(path, await readFile(downloaded));
  } finally {
    await rm(downloaded, { force: true });
  }
  return true;
}
