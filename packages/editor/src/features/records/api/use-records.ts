import type {
  CareerRecord,
  CareerRecordInput,
  CareerRecordPatch,
  OrganisationInput,
  RecordField,
  RecordFieldInput,
  RecordFieldPatch,
  RecordLink,
  RecordLinkInput,
  Store,
  Uuid,
} from "@keepcv/schema";
import {
  careerRecordSchema,
  organisationSchema,
  recordFieldSchema,
  recordLinkSchema,
} from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, record: CareerRecord): Store {
  return { ...store, records: replaceRow(store.records, record) };
}

function withOrganisation(store: Store, input: OrganisationInput | null): Store {
  if (input === null) return store;
  const at = now();
  return {
    ...store,
    organisations: [
      ...store.organisations,
      organisationSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
    ],
  };
}

async function createOrganisation(client: ApiClient, input: OrganisationInput | null) {
  if (input === null) return;
  await unwrap(await client.v1.organisations.$post({ json: input }));
}

export interface CreateRecord {
  record: CareerRecordInput;
  organisation: OrganisationInput | null;
}

export function useCreateRecord(client: ApiClient) {
  return useStoreMutation<CreateRecord, CareerRecord>({
    send: async ({ record, organisation }) => {
      await createOrganisation(client, organisation);
      return careerRecordSchema.parse(
        await unwrap(await client.v1.records.$post({ json: record })),
      );
    },
    optimistic: (store, { record, organisation }) => {
      const at = now();
      return upsert(
        withOrganisation(store, organisation),
        careerRecordSchema.parse({ ...record, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface UpdateRecord {
  id: Uuid;
  expectedUpdatedAt: string;
  patch: CareerRecordPatch;
  organisation: OrganisationInput | null;
}

export function useUpdateRecord(client: ApiClient) {
  return useStoreMutation<UpdateRecord, CareerRecord>({
    send: async ({ id, expectedUpdatedAt, patch, organisation }) => {
      await createOrganisation(client, organisation);
      return careerRecordSchema.parse(
        await unwrap(
          await client.v1.records[":id"].$patch({
            param: { id },
            json: { expectedUpdatedAt, patch },
          }),
        ),
      );
    },
    optimistic: (store, { id, patch, organisation }) => {
      const existing = store.records.find((row) => row.id === id);
      if (existing === undefined) return store;
      return upsert(
        withOrganisation(store, organisation),
        careerRecordSchema.parse({ ...existing, ...patch, updatedAt: now() }),
      );
    },
  });
}

export interface SetArchived {
  record: CareerRecord;
  archived: boolean;
}

// One hook for both directions: archiving and restoring differ by a route and a
// timestamp, and splitting them would duplicate the optimistic patch.
export function useSetArchived(client: ApiClient) {
  return useStoreMutation<SetArchived, CareerRecord>({
    send: async ({ record, archived }) => {
      const param = { id: record.id };
      const json = { expectedUpdatedAt: record.updatedAt };
      const response = archived
        ? await client.v1.records[":id"].$delete({ param, json })
        : await client.v1.records[":id"].restore.$post({ param, json });
      return careerRecordSchema.parse(await unwrap(response));
    },
    optimistic: (store, { record, archived }) =>
      upsert(store, { ...record, archivedAt: archived ? now() : null, updatedAt: now() }),
  });
}

export function useAddRecordLink(client: ApiClient) {
  return useStoreMutation<RecordLinkInput, RecordLink>({
    send: async (link) =>
      recordLinkSchema.parse(await unwrap(await client.v1["record-links"].$post({ json: link }))),
    optimistic: (store, link) => {
      const at = now();
      return {
        ...store,
        recordLinks: [
          ...store.recordLinks,
          recordLinkSchema.parse({ ...link, createdAt: at, updatedAt: at, archivedAt: null }),
        ],
      };
    },
  });
}

export function useArchiveRecordLink(client: ApiClient) {
  return useStoreMutation<RecordLink, RecordLink>({
    send: async (link) =>
      recordLinkSchema.parse(
        await unwrap(
          await client.v1["record-links"][":id"].$delete({
            param: { id: link.id },
            json: { expectedUpdatedAt: link.updatedAt },
          }),
        ),
      ),
    optimistic: (store, link) => ({
      ...store,
      recordLinks: replaceRow(store.recordLinks, { ...link, archivedAt: now(), updatedAt: now() }),
    }),
  });
}

// A field named again after being removed is the row put back, because
// `record_field_key_unique` covers archived rows.
export type AddField =
  | { create: RecordFieldInput }
  | { restore: RecordField; patch: RecordFieldPatch };

export function useAddRecordField(client: ApiClient) {
  return useStoreMutation<AddField, RecordField>({
    send: async (plan) => {
      if ("create" in plan) {
        return recordFieldSchema.parse(
          await unwrap(await client.v1["record-fields"].$post({ json: plan.create })),
        );
      }
      const param = { id: plan.restore.id };
      const back = recordFieldSchema.parse(
        await unwrap(
          await client.v1["record-fields"][":id"].restore.$post({
            param,
            json: { expectedUpdatedAt: plan.restore.updatedAt },
          }),
        ),
      );
      return recordFieldSchema.parse(
        await unwrap(
          await client.v1["record-fields"][":id"].$patch({
            param,
            json: { expectedUpdatedAt: back.updatedAt, patch: plan.patch },
          }),
        ),
      );
    },
    optimistic: (store, plan) => {
      const at = now();
      const row = recordFieldSchema.parse(
        "create" in plan
          ? { ...plan.create, createdAt: at, updatedAt: at, archivedAt: null }
          : { ...plan.restore, ...plan.patch, archivedAt: null, updatedAt: at },
      );
      return { ...store, recordFields: replaceRow(store.recordFields, row) };
    },
  });
}

export function useArchiveRecordField(client: ApiClient) {
  return useStoreMutation<RecordField, RecordField>({
    send: async (field) =>
      recordFieldSchema.parse(
        await unwrap(
          await client.v1["record-fields"][":id"].$delete({
            param: { id: field.id },
            json: { expectedUpdatedAt: field.updatedAt },
          }),
        ),
      ),
    optimistic: (store, field) => ({
      ...store,
      recordFields: replaceRow(store.recordFields, {
        ...field,
        archivedAt: now(),
        updatedAt: now(),
      }),
    }),
  });
}
