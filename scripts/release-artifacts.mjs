import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { releaseVersion } from "./release-branch.mjs";
import { preflight, waitForPublished } from "./release-registry.mjs";

const exec = promisify(execFile);
const mode = process.argv[2] ?? "verify";
assert(["verify", "preflight", "publish", "github"].includes(mode));
const release = JSON.parse(await readFile("release.json", "utf8"));
assert.match(release.commit, /^[a-f0-9]{40}$/);
assert.equal(release.packages.length, new Set(release.packages.map((pkg) => pkg.name)).size);
const launcher = release.packages.find((pkg) => pkg.name === "keepcv");
assert(launcher, "The release has no launcher");
if (process.env.RELEASE_VERSION) assert.equal(launcher.version, process.env.RELEASE_VERSION);
if (process.env.GITHUB_SHA) assert.equal(release.commit, process.env.GITHUB_SHA);
if (process.env.GITHUB_REF) releaseVersion(process.env.GITHUB_REF, launcher.version);
for (const pkg of release.packages) {
  assert.match(pkg.name, /^(keepcv|@keepcv\/[a-z-]+)$/);
  assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.equal(pkg.file, basename(pkg.file));
  assert.match(pkg.file, /\.tgz$/);
  const integrity = `sha512-${createHash("sha512")
    .update(await readFile(pkg.file))
    .digest("base64")}`;
  assert.equal(integrity, pkg.integrity, `${pkg.file} changed after validation`);
}
process.stdout.write(`Verified ${release.packages.length} tarballs from ${release.commit}\n`);
if (mode === "verify") process.exit(0);

if (mode !== "preflight") {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Publish through the GitHub Release workflow");
  assert.equal(process.env.GITHUB_REPOSITORY, "keepcv/keepcv");
  releaseVersion(process.env.GITHUB_REF, launcher.version);
}
const existing = await preflight(release.packages);
process.stdout.write(
  `Registry preflight passed; ${existing.size} matching versions already published\n`,
);
if (mode === "preflight") process.exit(0);

if (mode === "publish") {
  const { stdout: npmVersion } = await exec("npm", ["--version"]);
  const [major, minor, patch] = npmVersion.trim().split(".").map(Number);
  assert(
    major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1))),
    "npm 11.5.1+ is required",
  );
  for (const pkg of release.packages) {
    if (existing.has(pkg.name)) {
      process.stdout.write(`Already published: ${pkg.name}@${pkg.version}\n`);
      continue;
    }
    const { stdout } = await exec(
      "npm",
      [
        "publish",
        join(process.cwd(), pkg.file),
        "--access",
        "public",
        "--tag",
        "latest",
        "--provenance",
        "--ignore-scripts",
        "--registry",
        "https://registry.npmjs.org/",
      ],
      { timeout: 120_000 },
    );
    process.stdout.write(stdout);
    await waitForPublished(pkg);
  }
} else {
  for (const pkg of release.packages) {
    assert(existing.has(pkg.name), `${pkg.name}@${pkg.version} has not been published`);
  }
  const repo = "keepcv/keepcv";
  const { stdout } = await exec("gh", ["api", `repos/${repo}/git/matching-refs/tags/`]);
  const tags = new Set(JSON.parse(stdout).map((ref) => ref.ref));
  for (const pkg of release.packages) {
    const tag = `refs/tags/${pkg.name}@${pkg.version}`;
    if (!tags.has(tag)) {
      await exec("gh", [
        "api",
        "--method",
        "POST",
        `repos/${repo}/git/refs`,
        "-f",
        `ref=${tag}`,
        "-f",
        `sha=${release.commit}`,
      ]);
    }
  }
  const tag = `keepcv@${launcher.version}`;
  let exists = false;
  try {
    await exec("gh", ["api", `repos/${repo}/releases/tags/${tag}`]);
    exists = true;
  } catch (error) {
    assert(error.stderr.includes("HTTP 404"), error.stderr);
  }
  if (!exists) {
    await exec("gh", [
      "release",
      "create",
      tag,
      "--repo",
      repo,
      "--verify-tag",
      "--title",
      `KeepCV ${launcher.version}`,
      "--notes-file",
      "release-notes.md",
      ...release.packages.map((pkg) => pkg.file),
      "release.json",
    ]);
  }
  process.stdout.write(`GitHub release ready: ${tag}\n`);
}
