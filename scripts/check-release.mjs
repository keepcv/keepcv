import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = join(root, ".keepcv-release-check", "packages");
const pnpm = process.env.npm_execpath;
assert(pnpm, "Run this check with pnpm release:check");

async function run(args, cwd) {
  const { stdout } = await exec(process.execPath, [pnpm, ...args], {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000,
  });
  return stdout;
}

await mkdir(destination, { recursive: true });
const packages = [];
for (const parent of ["packages", "apps"]) {
  for (const entry of await readdir(join(root, parent), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, parent, entry.name);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    if (!manifest.private) packages.push({ directory, manifest });
  }
}

const versions = new Map(packages.map(({ manifest }) => [manifest.name, manifest.version]));
const dependencies = {};
const artifacts = [];
for (const { directory, manifest } of packages) {
  const packed = JSON.parse(
    await run(["pack", "--json", "--pack-destination", destination], directory),
  );
  const files = new Set(packed.files.map((file) => file.path));
  const tarball = resolve(directory, packed.filename);
  const { stdout } = await exec("tar", ["-xOf", tarball, "package/package.json"]);
  const published = JSON.parse(stdout);
  assert.equal(published.name, manifest.name);
  assert.equal(published.version, manifest.version);
  assert.notEqual(published.version, "0.0.0");
  for (const required of ["README.md", "LICENSE", "CHANGELOG.md"]) {
    assert(files.has(required), `${manifest.name} is missing ${required}`);
  }
  const paths = [published.exports, published.bin, published.main, published.types];
  while (paths.length > 0) {
    const path = paths.pop();
    if (typeof path === "string") {
      assert(
        files.has(path.replace(/^\.\//, "")),
        `${manifest.name} is missing entry point ${path}`,
      );
    } else if (path) {
      paths.push(...Object.values(path));
    }
  }
  for (const path of files) {
    assert(!/\.(test|harness)\./.test(path), `${manifest.name} ships a test: ${path}`);
    assert(!path.startsWith("src/"), `${manifest.name} ships source: ${path}`);
  }
  for (const kind of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(published[kind] ?? {})) {
      assert(!/^(workspace|catalog|file|link):/.test(range), `${manifest.name}: ${name} ${range}`);
      if (name.startsWith("@keepcv/")) {
        assert.equal(range, versions.get(name), `${manifest.name} requires an unpublished package`);
      }
    }
  }
  if (manifest.name === "keepcv") {
    assert.equal(published.engines.node, ">=24.0.0");
    assert(files.has("dist/web/index.html"), "The launcher is missing its web app");
    assert([...files].some((path) => path.startsWith("dist/web/assets/") && path.endsWith(".js")));
  }
  if (manifest.name === "@keepcv/db") {
    assert(files.has("migrations/meta/_journal.json"), "The store is missing its migrations");
    assert([...files].some((path) => path.startsWith("migrations/") && path.endsWith(".sql")));
  }
  if (manifest.name === "@keepcv/schema") {
    assert([...files].some((path) => path.startsWith("schema/") && path.endsWith(".json")));
  }
  dependencies[manifest.name] = `file:${tarball.replaceAll("\\", "/")}`;
  artifacts.push({
    name: manifest.name,
    version: manifest.version,
    file: basename(tarball),
    integrity: `sha512-${createHash("sha512")
      .update(await readFile(tarball))
      .digest("base64")}`,
  });
  process.stdout.write(`Packed ${manifest.name}@${manifest.version}\n`);
}

const temporaryRoot = await realpath(tmpdir());
const installed = await mkdtemp(join(temporaryRoot, "keepcv-release-"));
process.stdout.write(`Installing tarballs outside the checkout: ${installed}\n`);
try {
  await writeFile(
    join(installed, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { keepcv: dependencies.keepcv },
    }),
  );
  await writeFile(
    join(installed, "pnpm-workspace.yaml"),
    `overrides: ${JSON.stringify(dependencies)}\n`,
  );
  process.stdout.write(
    await run(["install", "--ignore-scripts", "--no-frozen-lockfile"], installed),
  );
  assert.equal(
    (await run(["exec", "keepcv", "--version"], installed)).trim(),
    versions.get("keepcv"),
  );
  await copyFile(new URL("./release-smoke.mjs", import.meta.url), join(installed, "smoke.mjs"));
  const { stdout } = await exec(process.execPath, ["smoke.mjs", versions.get("keepcv")], {
    cwd: installed,
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  process.stdout.write(stdout);
  const { stdout: commit } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  await writeFile(
    join(destination, "release.json"),
    `${JSON.stringify({ commit: commit.trim(), packages: artifacts }, null, 2)}\n`,
  );
  await copyFile(
    new URL("./release-artifacts.mjs", import.meta.url),
    join(destination, "release-artifacts.mjs"),
  );
  await copyFile(
    join(root, "docs", "releases", `${versions.get("keepcv")}.md`),
    join(destination, "release-notes.md"),
  );
  process.stdout.write(`Release check passed. Tarballs: ${destination}\n`);
} finally {
  assert.equal(dirname(await realpath(installed)), temporaryRoot);
  await rm(installed, { recursive: true, force: true });
}
