import { bySortKey, keyForPosition, live, newUuid } from "@keepcv/core";
import type {
  ContactChannel,
  ContactChannelInput,
  ContactChannelKind,
  PhrasingSetInput,
  Profile,
  ProfilePatch,
  Store,
} from "@keepcv/schema";
import {
  contactChannelInputSchema,
  phrasingSetInputSchema,
  profilePatchSchema,
} from "@keepcv/schema";
import {
  type Difference,
  differing,
  type FieldErrors,
  fieldErrors,
  trimmed,
} from "../../../lib/form.js";
import { bodyOf } from "../../phrasings/model/editor.js";

export interface ProfileValues {
  fullName: string;
  pronouns: string;
  headline: string;
  location: string;
}

const LABELS: Record<keyof ProfileValues, string> = {
  fullName: "Name",
  pronouns: "Pronouns",
  headline: "Headline",
  location: "Location",
};

export const PROFILE_HINTS: Record<keyof ProfileValues, string> = {
  fullName: "What prints at the top of every resume.",
  pronouns: "Printed beside the name only where a template asks for them.",
  headline: "One line under the name. Not a summary.",
  location: "The line the header prints, not a contact channel.",
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

export interface ChannelValues {
  kind: ContactChannelKind;
  label: string;
  value: string;
  isDefaultVisible: boolean;
}

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

// The first wording of a summary that has none. Everything after it goes
// through the phrasing editor, which is where variants and history live.
export function buildSummarySet(text: string): PhrasingSetInput {
  return phrasingSetInputSchema.parse({
    id: newUuid(),
    purpose: "profile_summary",
    phrasing: {
      id: newUuid(),
      variant: "standard",
      label: null,
      sortKey: keyForPosition([], null, 0),
      body: bodyOf(text),
    },
  });
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
