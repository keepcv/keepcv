import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { describe, expect, it } from "vitest";
import { backupStore, MIRROR_NAME, mirrorStatus, restoreStore } from "./mirror.js";
import { startServer } from "./serve.js";
import { aStore, BOOTS_REAL_STORES } from "./store.harness.js";

describe("the mirror the launcher keeps", () => {
  it(
    "writes a readable copy beside the store as the launcher starts and stops",
    async () => {
      const dataDir = await aStore("Ada Lovelace");
      try {
        const status = await mirrorStatus(dataDir);
        expect(status?.path).toBe(join(dataDir, MIRROR_NAME));

        const document = JSON.parse(await readFile(join(dataDir, MIRROR_NAME), "utf8")) as {
          schemaVersion: number;
          store: { profile: { fullName: string } };
        };
        expect(document.schemaVersion).toBeGreaterThan(0);
        expect(document.store.profile.fullName).toBe("Ada Lovelace");
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  it(
    "answers nothing for a directory that has never been served",
    async () => {
      const empty = await mkdtemp(join(tmpdir(), "keepcv-none-"));
      try {
        expect(await mirrorStatus(empty)).toBeUndefined();
      } finally {
        await rm(empty, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );
});

describe("keepcv backup and restore", () => {
  it(
    "round-trips a store through one file",
    async () => {
      const source = await aStore("Ada Lovelace");
      const into = await mkdtemp(join(tmpdir(), "keepcv-into-"));
      const file = join(source, "backup.json");

      try {
        const written = await backupStore(source, file);
        expect(written).toMatchObject({ path: file, written: true });

        expect(await restoreStore(into, file)).toEqual({ loaded: file });

        // The restored store answers with the same profile, which is what makes
        // the file worth keeping.
        const running = await startServer({ port: 0, dataDir: into });
        try {
          const response = await fetch(`http://127.0.0.1:${running.port}/v1/profile`, {
            headers: { [SESSION_TOKEN_HEADER]: running.token },
          });
          expect(((await response.json()) as { fullName: string }).fullName).toBe("Ada Lovelace");
        } finally {
          await running.stop();
        }
      } finally {
        await rm(source, { recursive: true, force: true });
        await rm(into, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  // A restore never merges two career histories: that needs a review step,
  // which is what the lossy-format import flow is for.
  it(
    "refuses a store that already holds something",
    async () => {
      const source = await aStore("Ada Lovelace");
      const other = await aStore("Charles Babbage");
      const file = join(source, "backup.json");

      try {
        await backupStore(source, file);
        expect(await restoreStore(other, file)).toEqual({ refused: "not empty" });
      } finally {
        await rm(source, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  it(
    "says so rather than throwing when the file is not there",
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "keepcv-missing-"));
      try {
        expect(await restoreStore(dataDir, join(dataDir, "nothing.json"))).toEqual({
          refused: "missing",
        });
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );

  // Written whole and moved into place, so a mirror is never half a file: a
  // reader that finds one is reading a document that parses.
  it(
    "leaves no partial file behind and skips a write that would change nothing",
    async () => {
      const dataDir = await aStore("Ada Lovelace");
      const file = join(dataDir, "backup.json");

      try {
        await backupStore(dataDir, file);
        expect(await backupStore(dataDir, file)).toMatchObject({ written: false });
        await expect(readFile(`${file}.writing`, "utf8")).rejects.toThrow();

        // A file that is not a KeepCV document is refused before a store is
        // opened, rather than half-loaded or thrown out of as a schema error.
        await writeFile(file, '{"schemaVersion":1,"store":"not a store"}', "utf8");
        const into = await mkdtemp(join(tmpdir(), "keepcv-bad-"));
        expect(await restoreStore(into, file)).toEqual({ refused: "not a backup" });
        await rm(into, { recursive: true, force: true });
      } finally {
        await rm(dataDir, { recursive: true, force: true });
      }
    },
    BOOTS_REAL_STORES,
  );
});
