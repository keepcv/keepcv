import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { startServer } from "./serve.js";

// A PGlite store on disk is a WebAssembly boot plus a full migration run, which
// is comfortably slower than the default per-test budget. A test that reads one
// back through a command opens a second.
export const BOOTS_REAL_STORES = 180_000;

// Written through the launcher rather than through the repositories, so what a
// command reads is what the app would have put there.
export async function aStore(
  named: string,
  options: { resumes?: readonly string[] } = {},
): Promise<string> {
  const dataDir = await mkdtemp(join(tmpdir(), "keepcv-store-"));
  const running = await startServer({ port: 0, dataDir });

  const call = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${running.port}${path}`, {
      method,
      headers: { [SESSION_TOKEN_HEADER]: running.token, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`${method} ${path} answered ${String(response.status)}`);
    return (await response.json()) as { updatedAt: string };
  };

  try {
    const profile = await call("/v1/profile", "GET");
    await call("/v1/profile", "PATCH", {
      patch: { fullName: named },
      expectedUpdatedAt: profile.updatedAt,
    });
    for (const name of options.resumes ?? ["Staff engineer, 2026"]) {
      await call("/v1/resumes", "POST", {
        id: newUuid(),
        name,
        targetCompany: null,
        targetRole: null,
        targetUrl: null,
        targetJdText: null,
        appliedOn: null,
      });
    }
  } finally {
    await running.stop();
  }
  return dataDir;
}
