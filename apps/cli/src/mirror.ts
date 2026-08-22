import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StoreNotEmptyError } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import type { Archive, ExportDocument } from "@keepcv/schema";
import { CURRENT_SCHEMA_VERSION, migrateDocument, timestampSchema } from "@keepcv/schema";

// Beside the data directory rather than inside it: a plain-text copy of the
// career store is the thing to reach for when PGlite's own directory is what
// went wrong.
export const MIRROR_NAME = "store.json";

export function mirrorPath(dataDir: string): string {
  return join(dataDir, MIRROR_NAME);
}

function documentOf(archive: Archive): ExportDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: timestampSchema.parse(new Date().toISOString()),
    store: archive,
  };
}

function bodyOf(document: ExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

// `exportedAt` moves on every read, so what "changed" is measured on is the
// store the file carries, never the file's own bytes.
async function alreadySays(path: string, archive: Archive): Promise<boolean> {
  const existing = await readFile(path, "utf8").catch(() => undefined);
  if (existing === undefined) return false;
  try {
    const held = (JSON.parse(existing) as { store?: unknown }).store;
    return JSON.stringify(held) === JSON.stringify(archive);
  } catch {
    return false;
  }
}

export interface Mirrored {
  path: string;
  bytes: number;
  written: boolean;
}

// Written whole and moved into place: a crash mid-write must leave the previous
// mirror rather than half a file.
export async function writeMirror(path: string, archive: Archive): Promise<Mirrored> {
  const body = bodyOf(documentOf(archive));
  if (await alreadySays(path, archive)) return { path, bytes: body.length, written: false };

  const temporary = `${path}.writing`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, body, "utf8");
  await rename(temporary, path);
  return { path, bytes: body.length, written: true };
}

export interface MirrorStatus {
  path: string;
  bytes: number;
  writtenAt: string;
}

export async function mirrorStatus(dataDir: string): Promise<MirrorStatus | undefined> {
  const path = mirrorPath(dataDir);
  const found = await stat(path).catch(() => undefined);
  if (found === undefined) return undefined;
  return { path, bytes: found.size, writtenAt: found.mtime.toISOString() };
}

async function withStore<T>(dataDir: string, work: (archive: Archive) => Promise<T>): Promise<T> {
  const store = openLocalStore({ dataDir });
  try {
    await store.migrate();
    const ownerId = await store.ensureLocalOwner();
    return await runAsOwner(ownerId, async () => {
      const archive = await store.unitOfWork.run(async (r) => await r.store.read());
      return await work(archive);
    });
  } finally {
    await store.close();
  }
}

export async function backupStore(dataDir: string, out: string | undefined): Promise<Mirrored> {
  return await withStore(
    dataDir,
    async (archive) => await writeMirror(out ?? mirrorPath(dataDir), archive),
  );
}

export type RestoreResult = { loaded: string } | { refused: "not empty" | "unreadable" };

// Into an empty store only. Merging two career histories needs a review step in
// front of it, which is what the lossy-format import flow is for.
export async function restoreStore(dataDir: string, from: string): Promise<RestoreResult> {
  const body = await readFile(from, "utf8").catch(() => undefined);
  if (body === undefined) return { refused: "unreadable" };

  const parsed: unknown = JSON.parse(body);
  const document = migrateDocument(parsed);

  const store = openLocalStore({ dataDir });
  try {
    await store.migrate();
    const ownerId = await store.ensureLocalOwner();
    await runAsOwner(ownerId, async () => {
      await store.unitOfWork.run(async (r) => {
        await r.store.load(document.store);
      });
    });
    return { loaded: from };
  } catch (error) {
    if (error instanceof StoreNotEmptyError) return { refused: "not empty" };
    throw error;
  } finally {
    await store.close();
  }
}
