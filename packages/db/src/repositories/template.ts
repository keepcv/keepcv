import type { TemplateRepository } from "@keepcv/core";
import { type StoredTemplate, type Timestamp, templateSchema, type Uuid } from "@keepcv/schema";
import { and, asc } from "drizzle-orm";
import type { Database } from "../database.js";
import { template } from "../schema/index.js";
import {
  type Changes,
  insertOwned,
  live,
  owned,
  requireOwned,
  standardDto,
  updateOwned,
} from "./owned-row.js";

type TemplateRow = typeof template.$inferSelect;

function toTemplate(row: TemplateRow): StoredTemplate {
  return templateSchema.parse({ ...standardDto(row), name: row.name, spec: row.spec });
}

export function createTemplateRepository(db: Database): TemplateRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<TemplateRow>,
  ): Promise<StoredTemplate> {
    return toTemplate(
      await updateOwned<TemplateRow>(db, template, "template", id, expectedUpdatedAt, changes),
    );
  }

  return {
    // By name, like organisations: a design is reached for by what it is called,
    // never dragged into an order.
    async list(options) {
      const rows = await db
        .select()
        .from(template)
        .where(and(owned(template), live(template, options?.includeArchived)))
        .orderBy(asc(template.name));
      return rows.map(toTemplate);
    },

    async get(id) {
      return toTemplate(await requireOwned<TemplateRow>(db, template, "template", id));
    },

    async create(input) {
      return toTemplate(await insertOwned(db, template, "template", input));
    },

    async update(id, patch, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, patch);
    },

    // The resumes using it are left naming it: they carry their own overrides,
    // and a version that printed with it pinned the whole design anyway.
    async archive(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
