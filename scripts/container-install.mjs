import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const directory = "/packages";
const manifest = join(directory, "release.json");
const files = existsSync(manifest)
  ? JSON.parse(readFileSync(manifest, "utf8")).packages.map((pkg) => pkg.file)
  : readdirSync(directory).filter((file) => file.endsWith(".tgz"));
assert(files.length > 0, "No package tarballs supplied");
const tarballs = files.filter((file) => !file.startsWith("keepcv-editor-"));
for (const file of tarballs) {
  assert.equal(file, basename(file));
  assert.match(file, /^keepcv-[a-z-]+-\d+\.\d+\.\d+\.tgz$/);
}
execFileSync(
  "npm",
  [
    "install",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...tarballs.map((file) => join(directory, file)),
  ],
  { stdio: "inherit" },
);
