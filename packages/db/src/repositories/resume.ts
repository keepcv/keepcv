import type { ResumeRepository } from "@keepcv/core";
import type {
  Resume,
  ResumeEntry,
  ResumeEntryPoint,
  ResumeSection,
  Timestamp,
  Uuid,
} from "@keepcv/schema";
import {
  resumeContactChannelSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSchema,
  resumeSectionSchema,
} from "@keepcv/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import {
  contactChannel,
  resume,
  resumeContactChannel,
  resumeEntry,
  resumeEntryPoint,
  resumeSection,
} from "../schema/index.js";
import {
  bySortKey,
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type ResumeRow = typeof resume.$inferSelect;
type SectionRow = typeof resumeSection.$inferSelect;
type EntryRow = typeof resumeEntry.$inferSelect;
type EntryPointRow = typeof resumeEntryPoint.$inferSelect;
type ChannelRow = typeof contactChannel.$inferSelect;

function toResume(row: ResumeRow): Resume {
  return resumeSchema.parse({
    ...standardDto(row),
    name: row.name,
    targetCompany: row.targetCompany,
    targetRole: row.targetRole,
    targetUrl: row.targetUrl,
    targetJdText: row.targetJdText,
    appliedOn: row.appliedOn,
  });
}

function toSection(row: SectionRow): ResumeSection {
  return resumeSectionSchema.parse({
    ...standardDto(row),
    resumeId: row.resumeId,
    kind: row.kind,
    customSectionId: row.customSectionId,
    heading: row.heading,
    layout: row.layout,
    sortKey: row.sortKey,
    isVisible: row.isVisible,
  });
}

function toEntry(row: EntryRow): ResumeEntry {
  return resumeEntrySchema.parse({
    ...standardDto(row),
    resumeId: row.resumeId,
    resumeSectionId: row.resumeSectionId,
    recordId: row.recordId,
    sortKey: row.sortKey,
    isVisible: row.isVisible,
  });
}

function toEntryPoint(row: EntryPointRow): ResumeEntryPoint {
  return resumeEntryPointSchema.parse({
    ...standardDto(row),
    resumeId: row.resumeId,
    resumeEntryId: row.resumeEntryId,
    pointId: row.pointId,
    phrasingId: row.phrasingId,
    sortKey: row.sortKey,
    isVisible: row.isVisible,
  });
}

export function createResumeRepository(db: Database): ResumeRepository {
  const set = async <Row extends { id: string; updatedAt: Date }>(
    table: Parameters<typeof updateOwned>[1],
    entity: string,
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<Row>,
  ): Promise<Row> => await updateOwned<Row>(db, table, entity, id, expectedUpdatedAt, changes);

  return {
    async list(options) {
      const rows = await db
        .select()
        .from(resume)
        .where(and(owned(resume), live(resume, options?.includeArchived)))
        .orderBy(asc(resume.name), asc(resume.id));
      return rows.map(toResume);
    },

    async get(id) {
      return toResume(await requireOwned<ResumeRow>(db, resume, "resume", id));
    },

    async create(input) {
      return toResume(await insertOwned(db, resume, "resume", input));
    },

    async update(id, patch, expectedUpdatedAt) {
      return toResume(await set<ResumeRow>(resume, "resume", id, expectedUpdatedAt, patch));
    },

    async archive(id, expectedUpdatedAt) {
      return toResume(
        await set<ResumeRow>(resume, "resume", id, expectedUpdatedAt, { archivedAt: new Date() }),
      );
    },

    async restore(id, expectedUpdatedAt) {
      return toResume(
        await set<ResumeRow>(resume, "resume", id, expectedUpdatedAt, { archivedAt: null }),
      );
    },

    async listSections(options) {
      const rows = await db
        .select()
        .from(resumeSection)
        .where(
          and(
            owned(resumeSection),
            live(resumeSection, options?.includeArchived),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeSection.resumeId, options.resumeId),
          ),
        )
        .orderBy(asc(resumeSection.resumeId), bySortKey(resumeSection.sortKey));
      return rows.map(toSection);
    },

    async getSection(id) {
      return toSection(await requireOwned<SectionRow>(db, resumeSection, "resume section", id));
    },

    async addSection(input) {
      await requireOwned<ResumeRow>(db, resume, "resume", input.resumeId);
      return toSection(await insertOwned(db, resumeSection, "resume section", input));
    },

    async updateSection(id, patch, expectedUpdatedAt) {
      return toSection(
        await set<SectionRow>(resumeSection, "resume section", id, expectedUpdatedAt, patch),
      );
    },

    async archiveSection(id, expectedUpdatedAt) {
      return toSection(
        await set<SectionRow>(resumeSection, "resume section", id, expectedUpdatedAt, {
          archivedAt: new Date(),
        }),
      );
    },

    async restoreSection(id, expectedUpdatedAt) {
      return toSection(
        await set<SectionRow>(resumeSection, "resume section", id, expectedUpdatedAt, {
          archivedAt: null,
        }),
      );
    },

    async listEntries(options) {
      const rows = await db
        .select()
        .from(resumeEntry)
        .where(
          and(
            owned(resumeEntry),
            live(resumeEntry, options?.includeArchived),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeEntry.resumeId, options.resumeId),
            options?.resumeSectionId === undefined
              ? undefined
              : eq(resumeEntry.resumeSectionId, options.resumeSectionId),
          ),
        )
        .orderBy(asc(resumeEntry.resumeSectionId), bySortKey(resumeEntry.sortKey));
      return rows.map(toEntry);
    },

    async getEntry(id) {
      return toEntry(await requireOwned<EntryRow>(db, resumeEntry, "resume entry", id));
    },

    async addEntry(input) {
      await requireOwned<SectionRow>(db, resumeSection, "resume section", input.resumeSectionId);
      return toEntry(await insertOwned(db, resumeEntry, "resume entry", input));
    },

    async updateEntry(id, patch, expectedUpdatedAt) {
      return toEntry(
        await set<EntryRow>(resumeEntry, "resume entry", id, expectedUpdatedAt, patch),
      );
    },

    async archiveEntry(id, expectedUpdatedAt) {
      return toEntry(
        await set<EntryRow>(resumeEntry, "resume entry", id, expectedUpdatedAt, {
          archivedAt: new Date(),
        }),
      );
    },

    async restoreEntry(id, expectedUpdatedAt) {
      return toEntry(
        await set<EntryRow>(resumeEntry, "resume entry", id, expectedUpdatedAt, {
          archivedAt: null,
        }),
      );
    },

    async listEntryPoints(options) {
      const rows = await db
        .select()
        .from(resumeEntryPoint)
        .where(
          and(
            owned(resumeEntryPoint),
            live(resumeEntryPoint, options?.includeArchived),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeEntryPoint.resumeId, options.resumeId),
            options?.resumeEntryId === undefined
              ? undefined
              : eq(resumeEntryPoint.resumeEntryId, options.resumeEntryId),
          ),
        )
        .orderBy(asc(resumeEntryPoint.resumeEntryId), bySortKey(resumeEntryPoint.sortKey));
      return rows.map(toEntryPoint);
    },

    async getEntryPoint(id) {
      return toEntryPoint(
        await requireOwned<EntryPointRow>(db, resumeEntryPoint, "resume entry point", id),
      );
    },

    async addEntryPoint(input) {
      await requireOwned<EntryRow>(db, resumeEntry, "resume entry", input.resumeEntryId);
      return toEntryPoint(await insertOwned(db, resumeEntryPoint, "resume entry point", input));
    },

    async updateEntryPoint(id, patch, expectedUpdatedAt) {
      return toEntryPoint(
        await set<EntryPointRow>(
          resumeEntryPoint,
          "resume entry point",
          id,
          expectedUpdatedAt,
          patch,
        ),
      );
    },

    async archiveEntryPoint(id, expectedUpdatedAt) {
      return toEntryPoint(
        await set<EntryPointRow>(resumeEntryPoint, "resume entry point", id, expectedUpdatedAt, {
          archivedAt: new Date(),
        }),
      );
    },

    async restoreEntryPoint(id, expectedUpdatedAt) {
      return toEntryPoint(
        await set<EntryPointRow>(resumeEntryPoint, "resume entry point", id, expectedUpdatedAt, {
          archivedAt: null,
        }),
      );
    },

    async listContactChannels(options) {
      const rows = await db
        .select()
        .from(resumeContactChannel)
        .where(
          and(
            eq(resumeContactChannel.ownerId, currentOwnerId()),
            options?.resumeId === undefined
              ? undefined
              : eq(resumeContactChannel.resumeId, options.resumeId),
          ),
        )
        .orderBy(asc(resumeContactChannel.resumeId), asc(resumeContactChannel.contactChannelId));
      return rows.map((row) => resumeContactChannelSchema.parse(row));
    },

    async setContactChannel(resumeId, contactChannelId, isVisible) {
      await requireOwned<ResumeRow>(db, resume, "resume", resumeId);
      await requireOwned<ChannelRow>(db, contactChannel, "contact channel", contactChannelId);
      await db
        .insert(resumeContactChannel)
        .values({ ownerId: currentOwnerId(), resumeId, contactChannelId, isVisible })
        .onConflictDoUpdate({
          target: [
            resumeContactChannel.ownerId,
            resumeContactChannel.resumeId,
            resumeContactChannel.contactChannelId,
          ],
          set: { isVisible },
        });
      return resumeContactChannelSchema.parse({ resumeId, contactChannelId, isVisible });
    },

    // A revert, so clearing one that was never set is the same answer.
    async clearContactChannel(resumeId, contactChannelId) {
      await requireOwned<ResumeRow>(db, resume, "resume", resumeId);
      await db
        .delete(resumeContactChannel)
        .where(
          and(
            eq(resumeContactChannel.ownerId, currentOwnerId()),
            eq(resumeContactChannel.resumeId, resumeId),
            eq(resumeContactChannel.contactChannelId, contactChannelId),
          ),
        );
    },
  };
}
