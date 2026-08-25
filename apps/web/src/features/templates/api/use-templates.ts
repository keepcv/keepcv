import type {
  Store,
  StoredTemplate,
  StoredTemplateInput,
  StoredTemplatePatch,
} from "@keepcv/schema";
import { templateSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, template: StoredTemplate): Store {
  return { ...store, templates: replaceRow(store.templates, template) };
}

export function useCreateTemplate(client: ApiClient) {
  return useStoreMutation<StoredTemplateInput, StoredTemplate>({
    send: async (input) =>
      templateSchema.parse(await unwrap(await client.v1.templates.$post({ json: input }))),
    optimistic: (store, input) => {
      const at = now();
      return upsert(
        store,
        templateSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface UpdateTemplate {
  template: StoredTemplate;
  patch: StoredTemplatePatch;
}

export function useUpdateTemplate(client: ApiClient) {
  return useStoreMutation<UpdateTemplate, StoredTemplate>({
    send: async ({ template, patch }) =>
      templateSchema.parse(
        await unwrap(
          await client.v1.templates[":id"].$patch({
            param: { id: template.id },
            json: { expectedUpdatedAt: template.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { template, patch }) =>
      upsert(store, templateSchema.parse({ ...template, ...patch, updatedAt: now() })),
  });
}

export interface SetTemplateArchived {
  template: StoredTemplate;
  archived: boolean;
}

export function useSetTemplateArchived(client: ApiClient) {
  return useStoreMutation<SetTemplateArchived, StoredTemplate>({
    send: async ({ template, archived }) => {
      const param = { id: template.id };
      const json = { expectedUpdatedAt: template.updatedAt };
      const response = archived
        ? await client.v1.templates[":id"].$delete({ param, json })
        : await client.v1.templates[":id"].restore.$post({ param, json });
      return templateSchema.parse(await unwrap(response));
    },
    optimistic: (store, { template, archived }) =>
      upsert(store, { ...template, archivedAt: archived ? now() : null, updatedAt: now() }),
  });
}
