import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const script = fileURLToPath(new URL("./release-artifacts.mjs", import.meta.url));

async function fixture(t) {
  const temporaryRoot = await realpath(tmpdir());
  const cwd = await mkdtemp(join(temporaryRoot, "keepcv-artifact-test-"));
  t.after(async () => {
    assert.equal(dirname(await realpath(cwd)), temporaryRoot);
    await rm(cwd, { recursive: true, force: true });
  });
  const bytes = "the reviewed package";
  const release = {
    commit: "a".repeat(40),
    packages: [
      {
        name: "keepcv",
        version: "0.1.0",
        file: "keepcv-0.1.0.tgz",
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      },
    ],
  };
  await writeFile(join(cwd, "keepcv-0.1.0.tgz"), bytes);
  await writeFile(join(cwd, "release.json"), JSON.stringify(release));
  return { cwd, release };
}

function run(cwd, mode = "verify", extraEnv = {}, nodeArgs = []) {
  return exec(process.execPath, [...nodeArgs, script, mode], {
    cwd,
    env: {
      ...process.env,
      GITHUB_SHA: "",
      GITHUB_REF: "",
      GITHUB_ACTIONS: "",
      RELEASE_VERSION: "",
      ...extraEnv,
    },
  });
}

test("verifies the exact reviewed bytes without registry access", async (t) => {
  const { cwd } = await fixture(t);
  const { stdout } = await run(cwd);
  assert.match(stdout, /Verified 1 tarballs/);
});

test("refuses a tarball changed after the build job", async (t) => {
  const { cwd } = await fixture(t);
  await writeFile(join(cwd, "keepcv-0.1.0.tgz"), "changed package");
  await assert.rejects(run(cwd), (error) => /changed after validation/.test(error.stderr));
});

test("refuses a different release commit or requested version", async (t) => {
  const { cwd } = await fixture(t);
  for (const extraEnv of [{ GITHUB_SHA: "b".repeat(40) }, { RELEASE_VERSION: "0.2.0" }]) {
    await assert.rejects(run(cwd, "verify", extraEnv), (error) =>
      /ERR_ASSERTION/.test(error.stderr),
    );
  }
});

test("refuses artifact paths outside the downloaded directory", async (t) => {
  const { cwd, release } = await fixture(t);
  release.packages[0].file = "../keepcv-0.1.0.tgz";
  await writeFile(join(cwd, "release.json"), JSON.stringify(release));
  await assert.rejects(run(cwd), (error) => /ERR_ASSERTION/.test(error.stderr));
});

test("refuses publication outside the GitHub workflow before reaching npm", async (t) => {
  const { cwd } = await fixture(t);
  await assert.rejects(run(cwd, "publish"), (error) =>
    /Publish through the GitHub Release workflow/.test(error.stderr),
  );
});

test("rejects a conflicting later package before invoking npm or GitHub", async (t) => {
  const { cwd, release } = await fixture(t);
  release.packages.push({ ...release.packages[0], name: "@keepcv/core" });
  await writeFile(join(cwd, "release.json"), JSON.stringify(release));
  const preload = join(cwd, "registry-mock.mjs");
  await writeFile(
    preload,
    `import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
childProcess.execFile = () => { throw new Error("External command reached before registry preflight"); };
syncBuiltinESMExports();
globalThis.fetch = async (url) => url.includes("%40keepcv%2Fcore")
  ? new Response(JSON.stringify({ dist: { integrity: "sha512-placeholder" } }), { status: 200 })
  : new Response("{}", { status: 404 });
`,
  );
  for (const mode of ["preflight", "publish", "github"]) {
    await assert.rejects(
      run(
        cwd,
        mode,
        {
          GITHUB_ACTIONS: "true",
          GITHUB_REPOSITORY: "keepcv/keepcv",
          GITHUB_REF: "refs/heads/release/0.1.0",
        },
        ["--import", pathToFileURL(preload).href],
      ),
      (error) => /Registry bytes differ for @keepcv\/core@0.1.0/.test(error.stderr),
    );
  }
});

test("verifies a matching release branch", async (t) => {
  const { cwd } = await fixture(t);
  await run(cwd, "verify", { GITHUB_REF: "refs/heads/release/0.1.0" });
});

test("refuses non-release branches, malformed versions and version mismatches", async (t) => {
  const { cwd } = await fixture(t);
  for (const ref of [
    "refs/heads/main",
    "refs/tags/release/0.1.0",
    "refs/heads/release/01.1.0",
    "refs/heads/release/0.1.0-beta.1",
    "refs/heads/release/0.1.0/extra",
  ]) {
    await assert.rejects(run(cwd, "verify", { GITHUB_REF: ref }), (error) =>
      /Select a release/.test(error.stderr),
    );
  }
  await assert.rejects(run(cwd, "verify", { GITHUB_REF: "refs/heads/release/0.2.0" }), (error) =>
    /Release branch and launcher versions differ/.test(error.stderr),
  );
});
