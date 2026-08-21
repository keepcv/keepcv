import type {
  CareerRecord,
  CareerRecordInput,
  CareerRecordPatch,
  OrganisationInput,
  Store,
  Uuid,
} from "@keepcv/schema";
import { careerRecordSchema, organisationSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, record: CareerRecord): Store {
  const known = store.records.some((row) => row.id === record.id);
  return {
    ...store,
    records: known
      ? store.records.map((row) => (row.id === record.id ? record : row))
      : [...store.records, record],
  };
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
