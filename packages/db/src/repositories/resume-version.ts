import {
  type AppendedVersion,
  contentHash,
  type JsonValue,
  manifestRefs,
  NotFoundError,
  type ResumeVersionRepository,
} from "@keepcv/core";
import type {
  ContentHash,
  ContentRefKind,
  ResumeManifest,
  ResumeSnapshot,
  ResumeVersion,
  Uuid,
  VersionRef,
} from "@keepcv/schema";
import { resumeSnapshotSchema, resumeVersionSchema, versionRefSchema } from "@keepcv/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { resume, resumeContentRef, resumeSnapshot, resumeVersion } from "../schema/index.js";
import {
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  toTimestamp,
  updateOwned,
} from "./owned-row.js";

type VersionRow = typeof resumeVersion.$inferSelect;
type SnapshotRow = typeof resumeSnapshot.$inferSelect;
type ResumeRow = typeof resume.$inferSelect;

// `owned` takes a table with `archived_at`, and an immutable one has none.
function ownedVersion() {
  return eq(resumeVersion.ownerId, currentOwnerId());
}

export function manifestHashOf(manifest: ResumeManifest): ContentHash {
  return contentHash(manifest as unknown as JsonValue);
}

function toVersion(row: VersionRow): ResumeVersion {
  return resumeVersionSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    resumeId: row.resumeId,
    seq: row.seq,
    trigger: row.trigger,
    restoredFromVersionId: row.restoredFromVersionId,
    manifest: row.manifest,
    manifestHash: row.manifestHash,
  });
}

function toSnapshot(row: SnapshotRow): ResumeSnapshot {
  return resumeSnapshotSchema.parse({
    ...standardDto(row),
    resumeVersionId: row.resumeVersionId,
    label: row.label,
    note: row.note,
    starredAt: toTimestamp(row.starredAt),
  });
}

export function createResumeVersionRepository(db: Database): ResumeVersionRepository {
  async function requireVersion(id: Uuid): Promise<VersionRow> {
    const [row] = await db
      .select()
      .from(resumeVersion)
      .where(and(ownedVersion(), eq(resumeVersion.id, id)))
      .limit(1);
    if (row === undefined) throw new NotFoundError("resume version", id);
    return row;
  }

  async function latest(resumeId: Uuid): Promise<VersionRow | undefined> {
    const [row] = await db
      .select()
      .from(resumeVersion)
      .where(and(ownedVersion(), eq(resumeVersion.resumeId, resumeId)))
      .orderBy(desc(resumeVersion.seq))
      .limit(1);
    return row;
  }

  return {
    async list(options) {
      const rows = await db
        .select()
        .from(resumeVersion)
        .where(
          and(
            ownedVersion(),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeVersion.resumeId, options.resumeId),
          ),
        )
        .orderBy(asc(resumeVersion.resumeId), asc(resumeVersion.seq));
      return rows.map(toVersion);
    },

    async get(id) {
      return toVersion(await requireVersion(id));
    },

    async append(input): Promise<AppendedVersion> {
      await requireOwned<ResumeRow>(db, resume, "resume", input.resumeId);
      const manifestHash = manifestHashOf(input.manifest);
      const current = await latest(input.resumeId);
      // A restore is an event rather than a state, so it appends even when it
      // lands on the manifest already current.
      if (current?.manifestHash === manifestHash && input.restoredFromVersionId === null) {
        return { version: toVersion(current), created: false };
      }

      const [row] = await db
        .insert(resumeVersion)
        .values({
          id: input.id,
          ownerId: currentOwnerId(),
          resumeId: input.resumeId,
          seq: (current?.seq ?? 0) + 1,
          trigger: input.trigger,
          restoredFromVersionId: input.restoredFromVersionId,
          manifest: input.manifest,
          manifestHash,
        })
        .returning();
      if (row === undefined) throw new Error("insert into resume_version returned no row");

      const refs = manifestRefs(input.manifest);
      if (refs.length > 0) {
        await db
          .insert(resumeContentRef)
          .values(
            refs.map((ref) => ({ ownerId: currentOwnerId(), resumeVersionId: row.id, ...ref })),
          );
      }
      return { version: toVersion(row), created: true };
    },

    async listSnapshots(options) {
      const rows = await db
        .select({ snapshot: resumeSnapshot })
        .from(resumeSnapshot)
        .innerJoin(
          resumeVersion,
          and(
            eq(resumeVersion.ownerId, resumeSnapshot.ownerId),
            eq(resumeVersion.id, resumeSnapshot.resumeVersionId),
          ),
        )
        .where(
          and(
            owned(resumeSnapshot),
            live(resumeSnapshot, options?.includeArchived),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeVersion.resumeId, options.resumeId),
          ),
        )
        .orderBy(asc(resumeSnapshot.starredAt), asc(resumeSnapshot.id));
      return rows.map((row) => toSnapshot(row.snapshot));
    },

    async getSnapshot(id) {
      return toSnapshot(await requireOwned<SnapshotRow>(db, resumeSnapshot, "resume snapshot", id));
    },

    async star(input) {
      await requireVersion(input.resumeVersionId);
      return toSnapshot(await insertOwned(db, resumeSnapshot, "resume snapshot", input));
    },

    async updateSnapshot(id, patch, expectedUpdatedAt) {
      return toSnapshot(
        await updateOwned<SnapshotRow>(
          db,
          resumeSnapshot,
          "resume snapshot",
          id,
          expectedUpdatedAt,
          patch as Changes<SnapshotRow>,
        ),
      );
    },

    async archiveSnapshot(id, expectedUpdatedAt) {
      return toSnapshot(
        await updateOwned<SnapshotRow>(
          db,
          resumeSnapshot,
          "resume snapshot",
          id,
          expectedUpdatedAt,
          {
            archivedAt: new Date(),
          },
        ),
      );
    },

    async restoreSnapshot(id, expectedUpdatedAt) {
      return toSnapshot(
        await updateOwned<SnapshotRow>(
          db,
          resumeSnapshot,
          "resume snapshot",
          id,
          expectedUpdatedAt,
          {
            archivedAt: null,
          },
        ),
      );
    },

    async usage(refKind: ContentRefKind, refId: Uuid): Promise<VersionRef[]> {
      const rows = await db
        .select({
          resumeVersionId: resumeVersion.id,
          resumeId: resumeVersion.resumeId,
          seq: resumeVersion.seq,
          createdAt: resumeVersion.createdAt,
        })
        .from(resumeContentRef)
        .innerJoin(
          resumeVersion,
          and(
            eq(resumeVersion.ownerId, resumeContentRef.ownerId),
            eq(resumeVersion.id, resumeContentRef.resumeVersionId),
          ),
        )
        .where(
          and(
            eq(resumeContentRef.ownerId, currentOwnerId()),
            eq(resumeContentRef.refKind, refKind),
            eq(resumeContentRef.refId, refId),
          ),
        )
        .orderBy(asc(resumeVersion.resumeId), asc(resumeVersion.seq));
      return rows.map((row) =>
        versionRefSchema.parse({ ...row, createdAt: toTimestamp(row.createdAt) }),
      );
    },
  };
}
