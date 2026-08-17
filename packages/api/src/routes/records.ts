import type { CareerRecordRepository, UnitOfWork } from "@keepcv/core";
import {
  careerRecordInputSchema,
  careerRecordKindSchema,
  careerRecordPatchSchema,
  careerRecordSchema,
  recordFieldInputSchema,
  recordFieldPatchSchema,
  recordFieldSchema,
  recordLinkInputSchema,
  recordLinkPatchSchema,
  recordLinkSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { mutate } from "../problems.js";
import { router } from "../router.js";
import { archivedQuery, collectionRoutes } from "./collection.js";

const records = collectionRoutes({
  path: "/v1/records",
  tag: "records",
  noun: "record",
  dto: careerRecordSchema,
  input: careerRecordInputSchema,
  patch: careerRecordPatchSchema,
  query: archivedQuery.extend({
    kind: careerRecordKindSchema.optional(),
    tag: uuidSchema.optional(),
  }),
});

// Flat and narrowed by `?recordId`: a parent in the path would be an identifier
// the store never reads and the row could contradict (api-contract.md #3).
const byRecord = archivedQuery.extend({ recordId: uuidSchema.optional() });

const links = collectionRoutes({
  path: "/v1/record-links",
  tag: "record links",
  noun: "record link",
  dto: recordLinkSchema,
  input: recordLinkInputSchema,
  patch: recordLinkPatchSchema,
  query: byRecord,
});

const fields = collectionRoutes({
  path: "/v1/record-fields",
  tag: "record fields",
  noun: "record field",
  dto: recordFieldSchema,
  input: recordFieldInputSchema,
  patch: recordFieldPatchSchema,
  query: byRecord,
});

export function recordRoutes(unitOfWork: UnitOfWork) {
  const on = async <T>(work: (of: CareerRecordRepository) => Promise<T>): Promise<T> =>
    await unitOfWork.run(async (r) => await work(r.records));

  const readRecord = async (id: Uuid) => await on(async (of) => await of.get(id));
  const readLink = async (id: Uuid) => await on(async (of) => await of.getLink(id));
  const readField = async (id: Uuid) => await on(async (of) => await of.getField(id));

  return router()
    .openapi(records.list, async (c) => {
      const { archived, kind, tag } = c.req.valid("query");
      const items = await on(
        async (of) => await of.list({ kind, tagId: tag, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(records.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.create(input)), 201);
    })
    .openapi(records.read, async (c) => {
      return c.json(await readRecord(c.req.valid("param").id), 200);
    })
    .openapi(records.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.update(id, patch, expectedUpdatedAt)),
        async () => await readRecord(id),
      );
      return c.json(updated, 200);
    })
    .openapi(records.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archive(id, expectedUpdatedAt)),
        async () => await readRecord(id),
      );
      return c.json(archived, 200);
    })
    .openapi(records.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restore(id, expectedUpdatedAt)),
        async () => await readRecord(id),
      );
      return c.json(restored, 200);
    })

    .openapi(links.list, async (c) => {
      const { archived, recordId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listLinks({ recordId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(links.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createLink(input)), 201);
    })
    .openapi(links.read, async (c) => {
      return c.json(await readLink(c.req.valid("param").id), 200);
    })
    .openapi(links.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateLink(id, patch, expectedUpdatedAt)),
        async () => await readLink(id),
      );
      return c.json(updated, 200);
    })
    .openapi(links.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveLink(id, expectedUpdatedAt)),
        async () => await readLink(id),
      );
      return c.json(archived, 200);
    })
    .openapi(links.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreLink(id, expectedUpdatedAt)),
        async () => await readLink(id),
      );
      return c.json(restored, 200);
    })

    .openapi(fields.list, async (c) => {
      const { archived, recordId } = c.req.valid("query");
      const items = await on(
        async (of) => await of.listFields({ recordId, includeArchived: archived === "include" }),
      );
      return c.json({ items }, 200);
    })
    .openapi(fields.create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await on(async (of) => await of.createField(input)), 201);
    })
    .openapi(fields.read, async (c) => {
      return c.json(await readField(c.req.valid("param").id), 200);
    })
    .openapi(fields.update, async (c) => {
      const { id } = c.req.valid("param");
      const { patch, expectedUpdatedAt } = c.req.valid("json");
      const updated = await mutate(
        async () => await on(async (of) => await of.updateField(id, patch, expectedUpdatedAt)),
        async () => await readField(id),
      );
      return c.json(updated, 200);
    })
    .openapi(fields.archive, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const archived = await mutate(
        async () => await on(async (of) => await of.archiveField(id, expectedUpdatedAt)),
        async () => await readField(id),
      );
      return c.json(archived, 200);
    })
    .openapi(fields.restore, async (c) => {
      const { id } = c.req.valid("param");
      const { expectedUpdatedAt } = c.req.valid("json");
      const restored = await mutate(
        async () => await on(async (of) => await of.restoreField(id, expectedUpdatedAt)),
        async () => await readField(id),
      );
      return c.json(restored, 200);
    });
}
