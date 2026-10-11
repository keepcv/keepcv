import { deriveRevision, newUuid } from "@keepcv/core";
import type {
  ContactChannel,
  ContactChannelInput,
  ContactChannelPatch,
  PhrasingSetInput,
  Profile,
  ProfilePatch,
  Store,
} from "@keepcv/schema";
import {
  contactChannelSchema,
  phrasingSchema,
  phrasingSetSchema,
  profileSchema,
} from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function withProfile(store: Store, profile: Profile): Store {
  return { ...store, profile };
}

function withChannel(store: Store, channel: ContactChannel): Store {
  return { ...store, contactChannels: replaceRow(store.contactChannels, channel) };
}

export interface UpdateProfile {
  profile: Profile;
  patch: ProfilePatch;
}

export function useUpdateProfile(client: ApiClient) {
  return useStoreMutation<UpdateProfile, Profile>({
    send: async ({ profile, patch }) =>
      profileSchema.parse(
        await unwrap(
          await client.v1.profile.$patch({
            json: { expectedUpdatedAt: profile.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { profile, patch }) =>
      withProfile(store, profileSchema.parse({ ...profile, ...patch, updatedAt: now() })),
  });
}

export function useCreateChannel(client: ApiClient) {
  return useStoreMutation<ContactChannelInput, ContactChannel>({
    send: async (input) =>
      contactChannelSchema.parse(
        await unwrap(await client.v1["contact-channels"].$post({ json: input })),
      ),
    optimistic: (store, input) => {
      const at = now();
      return withChannel(
        store,
        contactChannelSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface UpdateChannel {
  channel: ContactChannel;
  patch: ContactChannelPatch;
}

export function useUpdateChannel(client: ApiClient) {
  return useStoreMutation<UpdateChannel, ContactChannel>({
    send: async ({ channel, patch }) =>
      contactChannelSchema.parse(
        await unwrap(
          await client.v1["contact-channels"][":id"].$patch({
            param: { id: channel.id },
            json: { expectedUpdatedAt: channel.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { channel, patch }) =>
      withChannel(store, contactChannelSchema.parse({ ...channel, ...patch, updatedAt: now() })),
  });
}

export interface SetChannelArchived {
  channel: ContactChannel;
  archived: boolean;
}

export function useSetChannelArchived(client: ApiClient) {
  return useStoreMutation<SetChannelArchived, ContactChannel>({
    send: async ({ channel, archived }) => {
      const param = { id: channel.id };
      const json = { expectedUpdatedAt: channel.updatedAt };
      const response = archived
        ? await client.v1["contact-channels"][":id"].$delete({ param, json })
        : await client.v1["contact-channels"][":id"].restore.$post({ param, json });
      return contactChannelSchema.parse(await unwrap(response));
    },
    optimistic: (store, { channel, archived }) =>
      withChannel(store, {
        ...channel,
        archivedAt: archived ? now() : null,
        updatedAt: now(),
      }),
  });
}

// Two requests, because a profile names its summary set rather than holding the
// words: there is nowhere to write them until the set exists.
export interface StartSummary {
  profile: Profile;
  input: PhrasingSetInput;
}

export function useStartSummary(client: ApiClient) {
  return useStoreMutation<StartSummary, Profile>({
    send: async ({ profile, input }) => {
      await unwrap(await client.v1["phrasing-sets"].$post({ json: input }));
      return profileSchema.parse(
        await unwrap(
          await client.v1.profile.$patch({
            json: { expectedUpdatedAt: profile.updatedAt, patch: { summarySetId: input.id } },
          }),
        ),
      );
    },
    optimistic: (store, { profile, input }) => {
      const at = now();
      // The store mints the real revision id, since a content hash is what
      // makes an append idempotent. This one lives until the re-read.
      const revisionId = newUuid();
      return {
        ...withProfile(store, { ...profile, summarySetId: input.id, updatedAt: at }),
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
