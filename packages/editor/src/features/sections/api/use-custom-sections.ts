import { keyForPosition, newUuid } from "@keepcv/core";
import type { CustomSection, CustomSectionInput, CustomSectionPatch, Store } from "@keepcv/schema";
import { customSectionSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, section: CustomSection): Store {
  return { ...store, customSections: replaceRow(store.customSections, section) };
}

// `custom_section_sort_key_unique` covers archived rows, so the key comes from
// the whole collection rather than the live part of it.
export function sectionInput(store: Store, heading: string): CustomSectionInput {
  return {
    id: newUuid(),
    heading: heading.trim(),
    sortKey: keyForPosition(store.customSections, null, store.customSections.length),
  };
}

export function useCreateCustomSection(client: ApiClient) {
  return useStoreMutation<CustomSectionInput, CustomSection>({
    send: async (input) =>
      customSectionSchema.parse(
        await unwrap(await client.v1["custom-sections"].$post({ json: input })),
      ),
    optimistic: (store, input) => {
      const at = now();
      return upsert(
        store,
        customSectionSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface UpdateCustomSection {
  section: CustomSection;
  patch: CustomSectionPatch;
}

export function useUpdateCustomSection(client: ApiClient) {
  return useStoreMutation<UpdateCustomSection, CustomSection>({
    send: async ({ section, patch }) =>
      customSectionSchema.parse(
        await unwrap(
          await client.v1["custom-sections"][":id"].$patch({
            param: { id: section.id },
            json: { expectedUpdatedAt: section.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { section, patch }) =>
      upsert(store, customSectionSchema.parse({ ...section, ...patch, updatedAt: now() })),
  });
}

export interface SetSectionArchived {
  section: CustomSection;
  archived: boolean;
}

export function useSetCustomSectionArchived(client: ApiClient) {
  return useStoreMutation<SetSectionArchived, CustomSection>({
    send: async ({ section, archived }) => {
      const param = { id: section.id };
      const json = { expectedUpdatedAt: section.updatedAt };
      const response = archived
        ? await client.v1["custom-sections"][":id"].$delete({ param, json })
        : await client.v1["custom-sections"][":id"].restore.$post({ param, json });
      return customSectionSchema.parse(await unwrap(response));
    },
    optimistic: (store, { section, archived }) =>
      upsert(store, { ...section, archivedAt: archived ? now() : null, updatedAt: now() }),
  });
}
