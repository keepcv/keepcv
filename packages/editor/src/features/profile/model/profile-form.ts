import { bySortKey, keyForPosition, live, newUuid } from "@keepcv/core";
import type {
  ContactChannel,
  ContactChannelInput,
  ContactChannelKind,
  Profile,
  ProfilePatch,
  Store,
} from "@keepcv/schema";
import {
  CONTACT_CHANNEL_KINDS,
  contactChannelInputSchema,
  profilePatchSchema,
} from "@keepcv/schema";
import { z } from "zod";
import {
  type Difference,
  differing,
  type FieldErrors,
  fieldErrors,
  trimmed,
} from "../../../lib/form.js";

export const profileValuesSchema = z.object({
  fullName: z.string(),
  pronouns: z.string(),
  headline: z.string(),
  location: z.string(),
});

export type ProfileValues = z.infer<typeof profileValuesSchema>;

const LABELS: Record<keyof ProfileValues, string> = {
  fullName: "Name",
  pronouns: "Pronouns",
  headline: "Headline",
  location: "Location",
};

export const PROFILE_HINTS: Record<keyof ProfileValues, string> = {
  fullName: "Shown at the top of your resumes.",
  pronouns: "Shown by templates that support them.",
  headline: "e.g. Senior software engineer",
  location: "e.g. Bengaluru, India",
};

export function profileValuesOf(profile: Profile): ProfileValues {
  return {
    fullName: profile.fullName ?? "",
    pronouns: profile.pronouns ?? "",
    headline: profile.headline ?? "",
    location: profile.location ?? "",
  };
}

export function isChanged(values: ProfileValues, profile: Profile): boolean {
  const stored = profileValuesOf(profile);
  return Object.keys(LABELS).some(
    (field) => stored[field as keyof ProfileValues] !== values[field as keyof ProfileValues],
  );
}

// No `summarySetId`: the summary writes itself through the phrasing editor, and
// absent leaves it alone.
export function buildProfilePatch(
  values: ProfileValues,
): { patch: ProfilePatch } | { errors: FieldErrors } {
  const parsed = profilePatchSchema.safeParse({
    fullName: trimmed(values.fullName),
    pronouns: trimmed(values.pronouns),
    headline: trimmed(values.headline),
    location: trimmed(values.location),
  });
  return parsed.success ? { patch: parsed.data } : { errors: fieldErrors(parsed.error) };
}

export function profileDifferences(mine: ProfileValues, current: Profile): Difference[] {
  const theirs = profileValuesOf(current);
  return differing(
    Object.entries(LABELS).map(([field, label]) => ({
      label,
      mine: mine[field as keyof ProfileValues],
      theirs: theirs[field as keyof ProfileValues],
    })),
  );
}

export const CHANNEL_LABELS: Record<ContactChannelKind, string> = {
  email: "Email",
  phone: "Phone",
  website: "Website",
  linkedin: "LinkedIn",
  github: "GitHub",
  scholar: "Scholar",
  orcid: "ORCID",
  location: "Location",
  other: "Other",
};

// The two the linter looks for, so a header with neither is worth saying so
// about rather than leaving to the resume screen to discover.
export const EXTRACTABLE_KINDS: readonly ContactChannelKind[] = ["email", "phone"];

export const channelValuesSchema = z.object({
  kind: z.enum(CONTACT_CHANNEL_KINDS),
  label: z.string(),
  value: z.string(),
  isDefaultVisible: z.boolean(),
});

export type ChannelValues = z.infer<typeof channelValuesSchema>;

export function newChannelValues(): ChannelValues {
  return { kind: "email", label: "", value: "", isDefaultVisible: true };
}

export function channelValuesOf(channel: ContactChannel): ChannelValues {
  return {
    kind: channel.kind,
    label: channel.label ?? "",
    value: channel.value,
    isDefaultVisible: channel.isDefaultVisible,
  };
}

export function buildChannel(
  store: Store,
  values: ChannelValues,
): { input: ContactChannelInput } | { errors: FieldErrors } {
  const parsed = contactChannelInputSchema.safeParse({
    id: newUuid(),
    kind: values.kind,
    label: trimmed(values.label),
    value: values.value.trim(),
    isDefaultVisible: values.isDefaultVisible,
    sortKey: keyForPosition(store.contactChannels, null, store.contactChannels.length),
  });
  return parsed.success ? { input: parsed.data } : { errors: fieldErrors(parsed.error) };
}

export interface ChannelRow {
  channel: ContactChannel;
  isArchived: boolean;
  label: string;
}

export function channelRows(store: Store, includeArchived: boolean): ChannelRow[] {
  const rows = includeArchived ? store.contactChannels : live(store.contactChannels);
  return [...rows].sort(bySortKey).map((channel) => ({
    channel,
    isArchived: channel.archivedAt !== null,
    label: channel.label ?? CHANNEL_LABELS[channel.kind],
  }));
}

export function missingExtractable(store: Store): ContactChannelKind[] {
  const held = new Set(live(store.contactChannels).map((row) => row.kind));
  return EXTRACTABLE_KINDS.filter((kind) => !held.has(kind));
}
