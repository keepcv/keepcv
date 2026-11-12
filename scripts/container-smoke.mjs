import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const exec = promisify(execFile);
const image = process.argv[2] ?? "keepcv:local";
const name = `keepcv-smoke-${randomUUID()}`;
const volume = `${name}-data`;
const docker = async (...args) => (await exec("docker", args, { timeout: 120_000 })).stdout.trim();
await docker("volume", "create", volume);
try {
  const user = await docker("image", "inspect", image, "--format", "{{.Config.User}}");
  assert.equal(user, "node");
  await docker("run", "--rm", "-v", `${volume}:/data`, image, "--version");
  const password = "container-smoke-password";
  await docker(
    "run",
    "--rm",
    "-v",
    `${volume}:/data`,
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    `import {writePassword} from '/app/node_modules/@keepcv/cli/dist/auth.js'; await writePassword('/data/custom', '${password}');`,
  );
  const runtime = [
    "-e",
    "KEEPCV_DATA_DIR=/data/custom",
    "-e",
    "KEEPCV_PORT=5321",
    "-e",
    "KEEPCV_ORIGIN=http://localhost:5321",
  ];
  await docker("run", "-d", "--name", name, "-v", `${volume}:/data`, ...runtime, image);
  const probe = `
    import assert from 'node:assert/strict';
    const base = 'http://localhost:5321';
    const headers = {host: 'localhost:5321'};
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      try { ready = (await fetch(base + '/auth/mode', {headers})).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert(ready, 'Container never became ready');
    assert((await fetch(base, {headers})).ok, 'Web assets unavailable');
    assert.equal((await fetch(base + '/v1/store', {headers})).status, 401);
    const login = await fetch(base + '/auth/sign-in', {method: 'POST', headers: {...headers, origin: 'http://localhost:5321', 'content-type': 'application/json'}, body: JSON.stringify({password: '${password}'})});
    assert(login.ok, 'Password sign-in failed: ' + login.status);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert((await fetch(base + '/v1/store', {headers: {...headers, cookie}})).ok);
  `;
  await docker("exec", name, "node", "--input-type=module", "-e", probe);
  await docker("stop", "--time", "30", name);
  assert.equal(await docker("inspect", name, "--format", "{{.State.ExitCode}}"), "0");
  await docker("start", name);
  await docker("exec", name, "node", "--input-type=module", "-e", probe);
  await docker("stop", "--time", "30", name);
  await docker("rm", name);
  await docker(
    "run",
    "-d",
    "--name",
    name,
    "-v",
    `${volume}:/data`,
    ...runtime,
    "-e",
    "KEEPCV_PORT=invalid",
    image,
    "serve",
    "--port",
    "5321",
  );
  await docker("exec", name, "node", "--input-type=module", "-e", probe);
  await docker("stop", "--time", "30", name);
  const status = await docker("run", "--rm", "-v", `${volume}:/data`, ...runtime, image, "status");
  assert.match(status, /backup/i);
  process.stdout.write(
    "Container passed environment configuration, flag overrides, sign-in, persistence and graceful-stop checks.\n",
  );
} finally {
  await docker("rm", "-f", name).catch(() => undefined);
  await docker("volume", "rm", volume);
}
