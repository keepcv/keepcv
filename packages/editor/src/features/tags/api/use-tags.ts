import { newUuid, tagSlug } from "@keepcv/core";
import type { Store, Tag, TagInput, TagPatch, Uuid } from "@keepcv/schema";
import { tagSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, tag: Tag): Store {
  return { ...store, tags: replaceRow(store.tags, tag) };
}

// The slug is the server's to derive, so it is never sent; the optimistic row
// still needs one, and `tagSlug` is the same function the store applies.
export function newTag(input: TagInput): Tag {
  const at = now();
  return tagSchema.parse({
    ...input,
    slug: tagSlug(input.label),
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
  });
}

export function tagInput(label: string, category: string | null): TagInput {
  return { id: newUuid(), label: label.trim(), category };
}

export function useCreateTag(client: ApiClient) {
  return useStoreMutation<TagInput, Tag>({
    send: async (input) =>
      tagSchema.parse(await unwrap(await client.v1.tags.$post({ json: input }))),
    optimistic: (store, input) => upsert(store, newTag(input)),
  });
}

export interface UpdateTag {
  tag: Tag;
  patch: TagPatch;
}

export function useUpdateTag(client: ApiClient) {
  return useStoreMutation<UpdateTag, Tag>({
    send: async ({ tag, patch }) =>
      tagSchema.parse(
        await unwrap(
          await client.v1.tags[":id"].$patch({
            param: { id: tag.id },
            json: { expectedUpdatedAt: tag.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { tag, patch }) =>
      upsert(
        store,
        tagSchema.parse({
          ...tag,
          ...patch,
          ...(patch.label === undefined ? {} : { slug: tagSlug(patch.label) }),
          updatedAt: now(),
        }),
      ),
  });
}

export interface SetTagArchived {
  tag: Tag;
  archived: boolean;
}

export function useSetTagArchived(client: ApiClient) {
  return useStoreMutation<SetTagArchived, Tag>({
    send: async ({ tag, archived }) => {
      const param = { id: tag.id };
      const json = { expectedUpdatedAt: tag.updatedAt };
      const response = archived
        ? await client.v1.tags[":id"].$delete({ param, json })
        : await client.v1.tags[":id"].restore.$post({ param, json });
      return tagSchema.parse(await unwrap(response));
    },
    optimistic: (store, { tag, archived }) =>
      upsert(store, { ...tag, archivedAt: archived ? now() : null, updatedAt: now() }),
  });
}

// A row that carried both tags ends up here twice for as long as it takes the
// answer to land. Nothing shows it: every reader of an assignment resolves it
// through a set of ids, and the store drops the duplicate for good.
function moved<T extends { tagId: Uuid }>(rows: readonly T[], from: Uuid, into: Uuid): T[] {
  return rows.map((row) => (row.tagId === from ? { ...row, tagId: into } : row));
}

export interface MergeTag {
  tag: Tag;
  intoTagId: Uuid;
}

export function useMergeTag(client: ApiClient) {
  return useStoreMutation<MergeTag, Tag>({
    send: async ({ tag, intoTagId }) =>
      tagSchema.parse(
        await unwrap(
          await client.v1.tags[":id"].merge.$post({
            param: { id: tag.id },
            json: { expectedUpdatedAt: tag.updatedAt, intoTagId },
          }),
        ),
      ),
    optimistic: (store, { tag, intoTagId }) => ({
      ...upsert(store, { ...tag, archivedAt: now(), updatedAt: now() }),
      recordTags: moved(store.recordTags, tag.id, intoTagId),
      pointTags: moved(store.pointTags, tag.id, intoTagId),
    }),
  });
}

export type TagSubject = { kind: "record"; id: Uuid } | { kind: "point"; id: Uuid };

export interface AssignTag {
  subject: TagSubject;
  tag: Tag;
  // A label nobody has used yet is created in the same motion, so the picker
  // stays one control rather than a form and a control.
  isNew: boolean;
}

function assigned(store: Store, { subject, tag }: AssignTag): Store {
  return subject.kind === "record"
    ? { ...store, recordTags: [...store.recordTags, { tagId: tag.id, recordId: subject.id }] }
    : { ...store, pointTags: [...store.pointTags, { tagId: tag.id, pointId: subject.id }] };
}

function unassigned(store: Store, { subject, tag }: AssignTag): Store {
  return subject.kind === "record"
    ? {
        ...store,
        recordTags: store.recordTags.filter(
          (row) => row.tagId !== tag.id || row.recordId !== subject.id,
        ),
      }
    : {
        ...store,
        pointTags: store.pointTags.filter(
          (row) => row.tagId !== tag.id || row.pointId !== subject.id,
        ),
      };
}

function assignment(client: ApiClient, { subject, tag }: AssignTag) {
  const param = { id: subject.id, tagId: tag.id };
  return subject.kind === "record"
    ? { param, of: client.v1.records[":id"].tags[":tagId"] }
    : { param, of: client.v1.points[":id"].tags[":tagId"] };
}

export function useAssignTag(client: ApiClient) {
  return useStoreMutation<AssignTag, void>({
    send: async (variables) => {
      if (variables.isNew) {
        const { id, label, category } = variables.tag;
        await unwrap(await client.v1.tags.$post({ json: { id, label, category } }));
      }
      const { param, of } = assignment(client, variables);
      await unwrap(await of.$put({ param }));
    },
    optimistic: (store, variables) =>
      assigned(variables.isNew ? upsert(store, variables.tag) : store, variables),
  });
}

export function useUnassignTag(client: ApiClient) {
  return useStoreMutation<AssignTag, void>({
    send: async (variables) => {
      const { param, of } = assignment(client, variables);
      await unwrap(await of.$delete({ param }));
    },
    optimistic: unassigned,
  });
}
