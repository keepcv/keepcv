import { newUuid } from "@keepcv/core";
import type {
  RoleProfile,
  RoleProfileApplication,
  RoleProfileInput,
  RoleProfilePatch,
  SortKey,
  Store,
  Tag,
  Uuid,
} from "@keepcv/schema";
import { roleProfileApplicationSchema, roleProfileSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function upsert(store: Store, profile: RoleProfile): Store {
  return { ...store, roleProfiles: replaceRow(store.roleProfiles, profile) };
}

export function roleProfileInput(name: string, sortKey: SortKey): RoleProfileInput {
  return { id: newUuid(), name: name.trim(), sortKey };
}

export function useCreateRoleProfile(client: ApiClient) {
  return useStoreMutation<RoleProfileInput, RoleProfile>({
    send: async (input) =>
      roleProfileSchema.parse(
        await unwrap(await client.v1["role-profiles"].$post({ json: input })),
      ),
    optimistic: (store, input) => {
      const at = now();
      return upsert(
        store,
        roleProfileSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface UpdateRoleProfile {
  profile: RoleProfile;
  patch: RoleProfilePatch;
}

export function useUpdateRoleProfile(client: ApiClient) {
  return useStoreMutation<UpdateRoleProfile, RoleProfile>({
    send: async ({ profile, patch }) =>
      roleProfileSchema.parse(
        await unwrap(
          await client.v1["role-profiles"][":id"].$patch({
            param: { id: profile.id },
            json: { expectedUpdatedAt: profile.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { profile, patch }) =>
      upsert(store, roleProfileSchema.parse({ ...profile, ...patch, updatedAt: now() })),
  });
}

export interface SetRoleProfileArchived {
  profile: RoleProfile;
  archived: boolean;
}

export function useSetRoleProfileArchived(client: ApiClient) {
  return useStoreMutation<SetRoleProfileArchived, RoleProfile>({
    send: async ({ profile, archived }) => {
      const param = { id: profile.id };
      const json = { expectedUpdatedAt: profile.updatedAt };
      const response = archived
        ? await client.v1["role-profiles"][":id"].$delete({ param, json })
        : await client.v1["role-profiles"][":id"].restore.$post({ param, json });
      return roleProfileSchema.parse(await unwrap(response));
    },
    optimistic: (store, { profile, archived }) =>
      upsert(store, { ...profile, archivedAt: archived ? now() : null, updatedAt: now() }),
  });
}

export interface RoleProfileRule {
  profile: RoleProfile;
  tag: Tag;
  // A label nobody has used yet is created in the same motion, exactly as the
  // picker on a record does it.
  isNew: boolean;
}

export function useAddRoleProfileTag(client: ApiClient) {
  return useStoreMutation<RoleProfileRule, void>({
    send: async ({ profile, tag, isNew }) => {
      if (isNew) {
        const { id, label, category } = tag;
        await unwrap(await client.v1.tags.$post({ json: { id, label, category } }));
      }
      await unwrap(
        await client.v1["role-profiles"][":id"].tags[":tagId"].$put({
          param: { id: profile.id, tagId: tag.id },
        }),
      );
    },
    optimistic: (store, { profile, tag, isNew }) => ({
      ...(isNew ? { ...store, tags: replaceRow(store.tags, tag) } : store),
      roleProfileTags: [...store.roleProfileTags, { roleProfileId: profile.id, tagId: tag.id }],
    }),
  });
}

export function useRemoveRoleProfileTag(client: ApiClient) {
  return useStoreMutation<RoleProfileRule, void>({
    send: async ({ profile, tag }) => {
      await unwrap(
        await client.v1["role-profiles"][":id"].tags[":tagId"].$delete({
          param: { id: profile.id, tagId: tag.id },
        }),
      );
    },
    optimistic: (store, { profile, tag }) => ({
      ...store,
      roleProfileTags: store.roleProfileTags.filter(
        (row) => row.roleProfileId !== profile.id || row.tagId !== tag.id,
      ),
    }),
  });
}

export interface ApplyRoleProfile {
  roleProfileId: Uuid;
  resumeId: Uuid;
}

// Not optimistic: the rows the server writes are planned there from the store it
// reads, so guessing them here would be a second planner to keep in step.
export function useApplyRoleProfile(client: ApiClient) {
  return useStoreMutation<ApplyRoleProfile, RoleProfileApplication>({
    send: async ({ roleProfileId, resumeId }) =>
      roleProfileApplicationSchema.parse(
        await unwrap(
          await client.v1["role-profiles"][":id"].apply.$post({
            param: { id: roleProfileId },
            json: { resumeId },
          }),
        ),
      ),
    optimistic: (store) => store,
  });
}
