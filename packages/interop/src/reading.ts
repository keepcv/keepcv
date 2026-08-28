import { fold } from "@keepcv/core";
import type {
  ContactChannelKind,
  IntakeContactChannel,
  IntakeLink,
  IntakeOrganisation,
  IntakePoint,
  OrganisationKind,
  PartialDate,
  RecordLinkKind,
  SkillProficiency,
} from "@keepcv/schema";
import { CONTACT_CHANNEL_KINDS, partialDateSchema, SKILL_PROFICIENCIES } from "@keepcv/schema";
import { readDate, readPeriod } from "./dates.js";

// Collects what each entry named its organisation, so one name mentioned in
// three lists arrives as one organisation the reviewer decides about once.
export class Organisations {
  private readonly byName = new Map<string, IntakeOrganisation>();

  seen(name: string | undefined | null, kind: OrganisationKind): string | null {
    const trimmed = name?.trim();
    if (trimmed === undefined || trimmed === "") return null;
    const key = fold(trimmed);
    if (!this.byName.has(key)) {
      this.byName.set(key, { name: trimmed, kind, website: null, location: null });
    }
    return trimmed;
  }

  all(): IntakeOrganisation[] {
    return [...this.byName.values()];
  }
}

// Every note names the entry it is about, because a report saying a date was
// dropped is no use without saying which one.
export class Notes {
  private readonly said: string[] = [];

  add(note: string): void {
    if (!this.said.includes(note)) this.said.push(note);
  }

  date(value: string | undefined | null, about: string): PartialDate | null {
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed === "") return null;
    const parsed = partialDateSchema.safeParse(trimmed);
    if (parsed.success) return parsed.data;
    this.add(`"${trimmed}" on ${about} is not a year, month or day, so that date is empty.`);
    return null;
  }

  all(): string[] {
    return this.said;
  }
}

const CONTACT_KINDS = new Set<string>(CONTACT_CHANNEL_KINDS);

// What the tools print against a profile, against the kinds this store has.
// Anything unlisted keeps the word as its label rather than being forced into a
// kind that means something else.
const NETWORKS: Record<string, ContactChannelKind> = {
  "google scholar": "scholar",
  googlescholar: "scholar",
  "personal website": "website",
  homepage: "website",
  mail: "email",
  "e-mail": "email",
};

export function channelOfNetwork(network: string | null, value: string): IntakeContactChannel {
  const folded = network === null ? "" : fold(network).trim();
  const known = NETWORKS[folded] ?? (CONTACT_KINDS.has(folded) ? folded : undefined);
  return known === undefined
    ? { kind: "other", label: network, value }
    : { kind: known as ContactChannelKind, label: null, value };
}

export const text = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

export const pointsOf = (highlights: readonly string[] | undefined | null): IntakePoint[] =>
  (highlights ?? [])
    .map((highlight) => highlight.trim())
    .filter((highlight) => highlight !== "")
    .map((highlight) => ({ text: highlight, occurredOn: null }));

export const linksOf = (
  url: string | undefined | null,
  kind: RecordLinkKind = "other",
): IntakeLink[] => {
  const found = text(url);
  return found === null ? [] : [{ kind, label: null, url: found }];
};

export const tagsOf = (keywords: readonly string[] | undefined | null): string[] =>
  (keywords ?? []).map((keyword) => keyword.trim()).filter((keyword) => keyword !== "");

// The four rungs the other tools offer, against the four this store has. This
// is a translation between two named scales, not a rounding: a word outside both
// is still reported rather than moved to the nearest one, which would claim
// expertise nobody wrote down.
const LEVELS: Record<string, SkillProficiency> = {
  novice: "familiar",
  beginner: "familiar",
  elementary: "familiar",
  intermediate: "working",
  advanced: "proficient",
};

export function proficiencyOf(
  level: string | undefined | null,
  notes: Notes,
): SkillProficiency | null {
  const found = text(level);
  if (found === null) return null;
  const folded = fold(found).trim();
  const matched = LEVELS[folded] ?? SKILL_PROFICIENCIES.find((each) => each === folded);
  if (matched !== undefined) return matched;
  notes.add(`"${found}" is not one of the four levels a skill can hold here, so it is not set.`);
  return null;
}

export interface Period {
  startedOn: PartialDate | null;
  endedOn: PartialDate | null;
  isCurrent: boolean;
}

export const at = (value: PartialDate | null): Period => ({
  startedOn: value,
  endedOn: null,
  isCurrent: false,
});

export const undated: Period = { startedOn: null, endedOn: null, isCurrent: false };

// The formats that store a period as the line a template printed - "March 2023
// to Present" - rather than as two dates. Unreadable is reported, never guessed.
export function periodFromText(
  value: string | undefined | null,
  about: string,
  notes: Notes,
): Period {
  const found = text(value);
  if (found === null) return undated;
  const read = readPeriod(found);
  if (read !== undefined) return read;
  notes.add(`"${found}" on ${about} is not a period this reads, so those dates are empty.`);
  return undated;
}

export function dateFromText(
  value: string | undefined | null,
  about: string,
  notes: Notes,
): PartialDate | null {
  const found = text(value);
  if (found === null) return null;
  const read = readDate(found);
  if (read !== null) return read;
  notes.add(`"${found}" on ${about} is not a date this reads, so it is empty.`);
  return null;
}

// What every kind carries, so a reader spreads this and then names only the
// fields the format it speaks actually has.
export interface Common {
  subtitle: string | null;
  location: string | null;
  summary: string | null;
  points: IntakePoint[];
  links: IntakeLink[];
  tags: string[];
}

export const nothing: Common = {
  subtitle: null,
  location: null,
  summary: null,
  points: [],
  links: [],
  tags: [],
};
