// @vitest-environment node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

if (process.env["DATABASE_URL"] === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for installed server recovery tests");

it.skipIf(process.env["DATABASE_URL"] === undefined)(
  "survives installed idle and active disconnects without sensitive diagnostics or transaction replay",
  async () => {
    const child = fileURLToPath(new URL("./server-recovery-child.mjs", import.meta.url));
    const result = await promisify(execFile)(process.execPath, [child], { timeout: 20_000 });
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  },
);
