import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { startServer } from "./node_modules/@keepcv/cli/dist/serve.js";

const exec = promisify(execFile);
const dataDir = join(process.cwd(), "store");
const restoredDir = join(process.cwd(), "restored");
const cli = join(process.cwd(), "node_modules", "@keepcv", "cli", "dist", "index.js");

async function command(...args) {
  const { stdout } = await exec(process.execPath, [cli, ...args], { timeout: 60_000 });
  return stdout;
}

assert.equal((await command("--version")).trim(), process.argv[2]);
assert.match(await command("--help"), /keepcv serve/);

const running = await startServer({ dataDir, port: 0 });
const origin = `http://127.0.0.1:${running.port}`;
async function call(path, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { "x-keepcv-session": running.token, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  assert(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return await response.json();
}

try {
  for (const path of ["/", "/resumes"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<div id="root">/);
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) {
      const loaded = await fetch(`${origin}${asset}`);
      assert.equal(loaded.status, 200, asset);
      assert(!loaded.headers.get("content-type")?.includes("text/html"), asset);
    }
  }
  assert.equal((await fetch(`${origin}/v1/store`)).status, 401);
  assert.equal((await fetch(`${origin}/v1/openapi.json`)).status, 200);
  const profile = await call("/v1/profile");
  await call("/v1/profile", "PATCH", {
    expectedUpdatedAt: profile.updatedAt,
    patch: { fullName: "Release Check" },
  });
  await call("/v1/resumes", "POST", {
    id: "0197e958-5e00-7000-8000-000000000001",
    name: "Release resume",
    targetCompany: null,
    targetRole: null,
    targetUrl: null,
    targetJdText: null,
    appliedOn: null,
  });
  const store = await call("/v1/store");
  assert.equal(store.profile.fullName, "Release Check");
  assert.equal(store.resumes.length, 1);
} finally {
  await running.stop();
}

for (const [format, extension] of [
  ["html", "html"],
  ["site", "html"],
  ["jsonresume", "json"],
  ["docx", "docx"],
  ["latex", "tex"],
  ["typst", "typ"],
]) {
  const out = join(process.cwd(), `${format}.${extension}`);
  await command(
    "render",
    "Release resume",
    "--data-dir",
    dataDir,
    "--format",
    format,
    "--out",
    out,
  );
  const bytes = await readFile(out);
  if (format === "docx") assert.equal(bytes.subarray(0, 2).toString(), "PK");
  else assert.match(bytes.toString(), /Release Check/);
}

const backup = join(process.cwd(), "backup.json");
await command("backup", "--data-dir", dataDir, "--out", backup);
await command("restore", "--data-dir", restoredDir, "--from", backup);
const restoredBackup = join(process.cwd(), "restored.json");
await command("backup", "--data-dir", restoredDir, "--out", restoredBackup);
const original = JSON.parse(await readFile(backup, "utf8"));
const restored = JSON.parse(await readFile(restoredBackup, "utf8"));
delete original.exportedAt;
delete restored.exportedAt;
assert.deepEqual(restored, original);
assert.match(await command("status", "--data-dir", restoredDir), /1 resume/);
process.stdout.write(
  "Verified web assets, authentication, writes, six exports, backup and restore.\n",
);
