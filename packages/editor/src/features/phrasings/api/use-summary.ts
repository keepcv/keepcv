import { deriveRevision, newUuid } from "@keepcv/core";
import type { CareerRecord, PhrasingSetInput, Profile } from "@keepcv/schema";
import {
  careerRecordSchema,
  phrasingSchema,
  phrasingSetSchema,
  profileSchema,
} from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

export type SummaryOwner =
  | { kind: "profile"; row: Profile }
  | { kind: "record"; row: CareerRecord };

interface StartSummary {
  owner: SummaryOwner;
  input: PhrasingSetInput;
  setExists: boolean;
}

export function useStartSummary(client: ApiClient) {
  return useStoreMutation<StartSummary, Profile | CareerRecord>({
    send: async ({ owner, input, setExists }) => {
      if (!setExists) await unwrap(await client.v1["phrasing-sets"].$post({ json: input }));
      if (owner.kind === "profile") {
        return profileSchema.parse(
          await unwrap(
            await client.v1.profile.$patch({
              json: { expectedUpdatedAt: owner.row.updatedAt, patch: { summarySetId: input.id } },
            }),
          ),
        );
      }
      return careerRecordSchema.parse(
        await unwrap(
          await client.v1.records[":id"].$patch({
            param: { id: owner.row.id },
            json: {
              expectedUpdatedAt: owner.row.updatedAt,
              patch: { kind: owner.row.kind, summarySetId: input.id },
            },
          }),
        ),
      );
    },
    optimistic: (store, { owner, input, setExists }) => {
      const at = now();
      const attached =
        owner.kind === "profile"
          ? {
              ...store,
              profile: profileSchema.parse({ ...owner.row, summarySetId: input.id, updatedAt: at }),
            }
          : {
              ...store,
              records: replaceRow(
                store.records,
                careerRecordSchema.parse({ ...owner.row, summarySetId: input.id, updatedAt: at }),
              ),
            };
      if (setExists) return attached;
      const revisionId = newUuid();
      return {
        ...attached,
        phrasingSets: [
          ...store.phrasingSets,
          phrasingSetSchema.parse({
            id: input.id,
            createdAt: at,
            updatedAt: at,
            archivedAt: null,
            purpose: input.purpose,
            canonicalPhrasingId: input.phrasing.id,
          }),
        ],
        phrasings: [
          ...store.phrasings,
          phrasingSchema.parse({
            ...input.phrasing,
            phrasingSetId: input.id,
            createdAt: at,
            updatedAt: at,
            archivedAt: null,
            currentRevisionId: revisionId,
          }),
        ],
        phrasingRevisions: [
          ...store.phrasingRevisions,
          {
            id: revisionId,
            createdAt: at,
            phrasingId: input.phrasing.id,
            ...deriveRevision(input.phrasing.body),
          },
        ],
      };
    },
  });
}
