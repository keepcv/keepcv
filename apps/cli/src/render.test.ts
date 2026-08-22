import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { describe, expect, it } from "vitest";
import { listing, renderResume } from "./render.js";
import { startServer } from "./serve.js";

// A PGlite store on disk is a WebAssembly boot plus a full migration run, which
// is comfortably slower than the default per-test budget. This test opens two:
// one through the launcher to write with, one through `render` to read with.
const BOOTS_TWO_REAL_STORES = 120_000;

async function aStoreHolding(names: readonly string[]): Promise<string> {
  const dataDir = await mkdtemp(join(tmpdir(), "keepcv-render-"));
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
  const send = async (path: string, method: string, body: unknown) => {
    await call(path, method, body);
  };

  try {
    const profile = await call("/v1/profile", "GET");
    await send("/v1/profile", "PATCH", {
      patch: { fullName: "Ada Lovelace" },
      expectedUpdatedAt: profile.updatedAt,
    });
    for (const name of names) {
      await send("/v1/resumes", "POST", {
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

describe("keepcv render", () => {
  it(
    "writes a resume the store holds as a file that stands on its own",
    async () => {
      const dataDir = await aStoreHolding(["Staff engineer, 2026"]);
      const out = join(dataDir, "out.html");

      try {
        expect(await renderResume({ dataDir, resume: "staff", out })).toEqual({ wrote: out });

        const html = await readFile(out, "utf8");
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain("Ada Lovelace");
        expect(html).toContain("<title>Ada Lovelace - Staff engineer, 2026</title>");
        // Nothing to fetch, which is the whole point of a file someone sends on.
        expect(html).not.toMatch(/<link\b|<script\b|@import/i);
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_TWO_REAL_STORES,
  );

  it(
    "names what it holds rather than guessing which resume was meant",
    async () => {
      const dataDir = await aStoreHolding(["Staff engineer", "Staff engineer, Acme"]);

      try {
        expect(await renderResume({ dataDir, resume: undefined, out: undefined })).toMatchObject({
          because: "none named",
        });
        expect(await renderResume({ dataDir, resume: "nothing", out: undefined })).toMatchObject({
          because: "no match",
        });
        // Two names contain it, and the whole of one of them is exactly it.
        expect(await renderResume({ dataDir, resume: "Staff", out: undefined })).toMatchObject({
          because: "ambiguous",
        });
        expect(
          await renderResume({
            dataDir,
            resume: "Staff engineer",
            out: join(dataDir, "one.html"),
          }),
        ).toEqual({ wrote: join(dataDir, "one.html") });
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_TWO_REAL_STORES,
  );

  it("says which resumes there are to choose from", () => {
    const choose = [{ name: "Staff engineer" }, { name: "Platform lead" }];
    const printed = listing({ choose, because: "ambiguous" });
    expect(printed).toContain("That names more than one:");
    expect(printed).toContain("    Staff engineer");
    expect(listing({ choose: [], because: "none named" })).toContain("holds no resume yet");
  });
});
