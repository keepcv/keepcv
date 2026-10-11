import type {
  ContactChannel,
  ContactChannelInput,
  ContactChannelPatch,
  Profile,
  ProfilePatch,
  Store,
} from "@keepcv/schema";
import { contactChannelSchema, profileSchema } from "@keepcv/schema";
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
