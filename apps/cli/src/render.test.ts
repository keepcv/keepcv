import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costs, listing, renderResume, verdict } from "./render.js";
import { aStore, BOOTS_REAL_STORES } from "./store.harness.js";

describe("keepcv render", () => {
  it(
    "writes a resume the store holds as a file that stands on its own",
    async () => {
      const dataDir = await aStore("Ada Lovelace", { resumes: ["Staff engineer, 2026"] });
      const out = join(dataDir, "out.html");

      try {
        const result = await renderResume({ dataDir, resume: "staff", out });
        expect(result).toMatchObject({ wrote: out });

        // This store holds a name and nothing to reach the person by, so the
        // file it wrote is one no system could file an application from.
        if (!("report" in result)) throw new Error("render answered a file");
        expect(result.report.tier).toBe("at-risk");
        expect(verdict(result.report)).toContain("No email address anywhere");

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
    BOOTS_REAL_STORES,
  );

  it(
    "names what it holds rather than guessing which resume was meant",
    async () => {
      const dataDir = await aStore("Ada Lovelace", {
        resumes: ["Staff engineer", "Staff engineer, Acme"],
      });

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
        ).toMatchObject({ wrote: join(dataDir, "one.html") });
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  it(
    "writes the same resume in somebody else's format, and says what that costs",
    async () => {
      const dataDir = await aStore("Ada Lovelace", { resumes: ["Staff engineer, 2026"] });
      const out = join(dataDir, "out.json");

      try {
        const result = await renderResume({
          dataDir,
          resume: "staff",
          out,
          format: "jsonresume",
        });
        expect(result).toMatchObject({ wrote: out });

        // A JSON Resume file, not a lint report: nothing was rendered to read
        // back, so there is nothing for the linter to have an opinion about.
        if (!("loss" in result)) throw new Error("render answered a document");
        expect(costs(result.loss)).toContain("that format");

        const written = JSON.parse(await readFile(out, "utf8")) as {
          basics: { name: string };
        };
        expect(written.basics.name).toBe("Ada Lovelace");
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  it("says which resumes there are to choose from", () => {
    const choose = [{ name: "Staff engineer" }, { name: "Platform lead" }];
    const printed = listing({ choose, because: "ambiguous" });
    expect(printed).toContain("That names more than one:");
    expect(printed).toContain("    Staff engineer");
    expect(listing({ choose: [], because: "none named" })).toContain("holds no resume yet");
  });

  it("counts the loss against this resume rather than standing on a disclaimer", () => {
    expect(costs([])).toContain("has somewhere to go");
    expect(costs([{ what: "Metrics", count: 3, detail: "A highlight is one string." }])).toContain(
      "1 thing does not fit that format:\n    - Metrics (3): A highlight is one string.",
    );
  });
});
