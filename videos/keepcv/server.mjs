import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startServer } from "../../apps/cli/dist/serve.js";
import { seed } from "./seed.mjs";

await mkdir(".keepcv-promo", { recursive: true });
const dataDir = await mkdtemp(resolve(".keepcv-promo/store-"));
const running = await startServer({ port: 4320, dataDir });
const origin = `http://127.0.0.1:${running.port}`;
async function call(path, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { "x-keepcv-session": running.token, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
try {
  const ids = await seed(call);
  await writeFile(
    ".keepcv-promo/session.json",
    JSON.stringify({ origin, token: running.token, ids }),
  );
  process.stdout.write("Demo store ready on port 4320.\n");
  process.on("SIGINT", async () => {
    await running.stop();
    process.exit(0);
  });
} catch (error) {
  await running.stop();
  throw error;
}
