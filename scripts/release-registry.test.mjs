import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { preflight, waitForPublished } from "./release-registry.mjs";

const pkg = { name: "@keepcv/core", version: "0.1.1", integrity: "sha512-reviewed" };

function registry(t, responses) {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    const response = responses[Math.min(calls++, responses.length - 1)];
    return new Response(JSON.stringify(response.body), { status: response.status });
  });
  return () => calls;
}

test("preflight accepts only identical existing versions and leaves absent versions to publish", async (t) => {
  registry(t, [{ status: 404 }, { status: 200, body: { dist: { integrity: pkg.integrity } } }]);
  assert.deepEqual(await preflight([{ ...pkg, name: "keepcv" }, pkg]), new Set([pkg.name]));
});

test("preflight refuses a later package with different bytes or missing integrity", async (t) => {
  for (const body of [{ dist: { integrity: "sha512-placeholder" } }, {}]) {
    registry(t, [{ status: 404 }, { status: 200, body }]);
    await assert.rejects(preflight([{ ...pkg, name: "keepcv" }, pkg]), /Registry bytes differ/);
  }
});

test("registry errors are never treated as unpublished versions", async (t) => {
  registry(t, [{ status: 503 }]);
  await assert.rejects(preflight([pkg]), /Registry lookup.*503/);
});

test("publication waits for registry propagation and complete integrity metadata", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = registry(t, [
    { status: 404 },
    { status: 200, body: {} },
    { status: 200, body: { dist: { integrity: pkg.integrity } } },
  ]);
  const pending = waitForPublished(pkg);
  for (let attempt = 0; attempt < 2; attempt++) {
    await setImmediate();
    t.mock.timers.tick(5_000);
  }
  await pending;
  assert.equal(calls(), 3);
});

test("publication stops immediately when visible bytes differ", async (t) => {
  const calls = registry(t, [{ status: 200, body: { dist: { integrity: "sha512-other" } } }]);
  await assert.rejects(waitForPublished(pkg), /Registry bytes differ/);
  assert.equal(calls(), 1);
});

test("publication fails clearly after bounded propagation retries", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = registry(t, [{ status: 404 }]);
  const pending = assert.rejects(
    waitForPublished(pkg),
    /did not become visible.*retry the workflow/,
  );
  for (let attempt = 0; attempt < 11; attempt++) {
    await setImmediate();
    t.mock.timers.tick(5_000);
  }
  await pending;
  assert.equal(calls(), 12);
});
