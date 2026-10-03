import assert from "node:assert/strict";
import timers from "node:timers/promises";

async function registryVersion(pkg) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${pkg.version}`,
    { signal: AbortSignal.timeout(30_000), cache: "no-store" },
  );
  if (response.status === 404) return undefined;
  assert(response.ok, `Registry lookup for ${pkg.name}: ${response.status}`);
  return await response.json();
}

function assertIntegrity(pkg, published) {
  assert.equal(
    published?.dist?.integrity,
    pkg.integrity,
    `Registry bytes differ for ${pkg.name}@${pkg.version}; prepare a new version`,
  );
}

export async function preflight(packages) {
  const existing = new Set();
  for (const pkg of packages) {
    const published = await registryVersion(pkg);
    if (!published) continue;
    assertIntegrity(pkg, published);
    existing.add(pkg.name);
  }
  return existing;
}

export async function waitForPublished(pkg) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const published = await registryVersion(pkg);
    if (published?.dist?.integrity) {
      assertIntegrity(pkg, published);
      return;
    }
    if (attempt < 11) await timers.setTimeout(5_000);
  }
  assert.fail(
    `${pkg.name}@${pkg.version} did not become visible in the registry; retry the workflow`,
  );
}
