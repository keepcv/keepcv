import type { OrganisationRepository } from "@keepcv/core";
import { type Organisation, organisationSchema, type Timestamp, type Uuid } from "@keepcv/schema";
import { and, asc } from "drizzle-orm";
import type { Database } from "../database.js";
import { currentOwnerId } from "../owner-scope.js";
import { organisation } from "../schema/index.js";
import { type Changes, live, owned, requireOwned, toTimestamp, updateOwned } from "./owned-row.js";

type OrganisationRow = typeof organisation.$inferSelect;

function toOrganisation(row: OrganisationRow): Organisation {
  return organisationSchema.parse({
    id: row.id,
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : toTimestamp(row.archivedAt),
    name: row.name,
    kind: row.kind,
    website: row.website,
    industry: row.industry,
    location: row.location,
  });
}

export function createOrganisationRepository(db: Database): OrganisationRepository {
  async function set(
    id: Uuid,
    expectedUpdatedAt: Timestamp,
    changes: Changes<OrganisationRow>,
  ): Promise<Organisation> {
    return toOrganisation(
      await updateOwned<OrganisationRow>(
        db,
        organisation,
        "organisation",
        id,
        expectedUpdatedAt,
        changes,
      ),
    );
  }

  return {
    // By name, not by a sort key: an organisation is something you look up, not
    // something you arrange. Ordering belongs to the records that reference it.
    // Two can share a name, so the id breaks the tie and the order is total.
    async list(options) {
      const rows = await db
        .select()
        .from(organisation)
        .where(and(owned(organisation), live(organisation, options?.includeArchived)))
        .orderBy(asc(organisation.name), asc(organisation.id));
      return rows.map(toOrganisation);
    },

    async get(id) {
      return toOrganisation(
        await requireOwned<OrganisationRow>(db, organisation, "organisation", id),
      );
    },

    async create(input) {
      const [row] = await db
        .insert(organisation)
        .values({ ...input, ownerId: currentOwnerId() })
        .returning();
      if (row === undefined) {
        throw new Error("insert into organisation returned no row");
      }
      return toOrganisation(row);
    },

    async update(id, patch, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, patch);
    },

    async archive(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: new Date() });
    },

    async restore(id, expectedUpdatedAt) {
      return await set(id, expectedUpdatedAt, { archivedAt: null });
    },
  };
}
