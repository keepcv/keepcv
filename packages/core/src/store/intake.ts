import type {
  CareerRecord,
  CareerRecordInput,
  ContactChannel,
  ContactChannelInput,
  CustomSectionInput,
  Intake,
  IntakeChoice,
  IntakeContactChannel,
  IntakeDecisions,
  IntakeIdentityField,
  IntakeOrganisation,
  IntakePoint,
  IntakeRecord,
  Organisation,
  OrganisationInput,
  PhrasingSetInput,
  Point,
  PointInput,
  ProfilePatch,
  RecordLinkInput,
  RecordTag,
  SortKey,
  Store,
  TagInput,
  Uuid,
} from "@keepcv/schema";
import { newUuid } from "../identity/uuid.js";
import { generateKeyBetween } from "../ordering/sort-key.js";
import { tagSlug } from "../tags/slug.js";
import { fold } from "../text/fold.js";
import { live, tagForLabel, textOfPhrasingSet, textOfPoint } from "./selectors.js";

export interface OrganisationMatch {
  incoming: IntakeOrganisation;
  existing: Organisation | undefined;
  suggested: IntakeChoice;
}

export interface PointMatch {
  incoming: IntakePoint;
  // A point already on the matched record saying the same thing. Importing the
  // same file twice must not double every bullet.
  duplicateOf: Point | undefined;
}

export interface RecordMatch {
  incoming: IntakeRecord;
  existing: CareerRecord | undefined;
  points: PointMatch[];
  suggested: IntakeChoice;
}

export interface ContactMatch {
  incoming: IntakeContactChannel;
  existing: ContactChannel | undefined;
  suggested: IntakeChoice;
}

export interface IdentityMatch {
  field: IntakeIdentityField;
  incoming: string;
  existing: string | null;
}

export interface IntakeReview {
  organisations: OrganisationMatch[];
  contactChannels: ContactMatch[];
  records: RecordMatch[];
  identity: IdentityMatch[];
  summary: { incoming: string; existing: string | null } | undefined;
}

const CREATE: IntakeChoice = { action: "create" };
const SKIP: IntakeChoice = { action: "skip" };

const same = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && fold(a) === fold(b);

function organisationFor(
  store: Store,
  name: string | null,
  matched: Map<string, Uuid>,
): Uuid | null {
  if (name === null) return null;
  const decided = matched.get(fold(name));
  if (decided !== undefined) return decided;
  return live(store.organisations).find((row) => same(row.name, name))?.id ?? null;
}

// Same kind, same title and filed under the same organisation. Anything looser
// merges two jobs with one title at two employers.
function recordLike(
  store: Store,
  incoming: IntakeRecord,
  organisationId: Uuid | null,
): CareerRecord | undefined {
  if (incoming.title === null) return undefined;
  return live(store.records).find(
    (row) =>
      row.kind === incoming.kind &&
      same(row.title, incoming.title) &&
      (row.organisationId ?? null) === organisationId,
  );
}

function pointMatches(store: Store, incoming: IntakeRecord, existing: CareerRecord | undefined) {
  const held =
    existing === undefined
      ? []
      : live(store.points).filter((point) => point.recordId === existing.id);
  return incoming.points.map((point) => ({
    incoming: point,
    duplicateOf: held.find((held) => fold(textOfPoint(store, held)) === fold(point.text)),
  }));
}

// What each incoming thing looks like it already is, and what to do about it
// unless the reviewer says otherwise. Nothing here writes.
export function matchIntake(store: Store, intake: Intake): IntakeReview {
  const organisations = intake.organisations.map((incoming) => {
    const existing = live(store.organisations).find((row) => same(row.name, incoming.name));
    return { incoming, existing, suggested: existing === undefined ? CREATE : merge(existing.id) };
  });

  // A record's match depends on which organisation its name resolved to, so the
  // organisation answers come first.
  const decided = new Map<string, Uuid>();
  for (const match of organisations) {
    if (match.existing !== undefined) decided.set(fold(match.incoming.name), match.existing.id);
  }

  const contactChannels = intake.contactChannels.map((incoming) => {
    const existing = live(store.contactChannels).find(
      (row) => row.kind === incoming.kind && same(row.value, incoming.value),
    );
    // Skipped rather than merged: two rows with one kind and one value is a
    // duplicate, and there is nothing on it to bring across.
    return { incoming, existing, suggested: existing === undefined ? CREATE : SKIP };
  });

  const records = intake.records.map((incoming) => {
    const organisationId = organisationFor(store, incoming.organisationName, decided);
    const existing = recordLike(store, incoming, organisationId);
    return {
      incoming,
      existing,
      points: pointMatches(store, incoming, existing),
      suggested: existing === undefined ? CREATE : merge(existing.id),
    };
  });

  return {
    organisations,
    contactChannels,
    records,
    identity: identityMatches(store, intake),
    summary: summaryMatch(store, intake),
  };
}

const merge = (into: Uuid): IntakeChoice => ({ action: "merge", into });

const IDENTITY_FIELDS: IntakeIdentityField[] = ["fullName", "headline", "location", "pronouns"];

function identityMatches(store: Store, intake: Intake): IdentityMatch[] {
  return IDENTITY_FIELDS.flatMap((field) => {
    const incoming = intake.identity[field];
    if (incoming === null) return [];
    return [{ field, incoming, existing: store.profile[field] }];
  });
}

function summaryMatch(store: Store, intake: Intake) {
  const incoming = intake.identity.summary;
  if (incoming === null) return undefined;
  const held = textOfPhrasingSet(store, store.profile.summarySetId);
  return { incoming, existing: held === "" ? null : held };
}

// Everything the reviewer left alone, which is what the screen starts on.
export function suggestedDecisions(review: IntakeReview): IntakeDecisions {
  return {
    organisations: review.organisations.map((match) => match.suggested),
    contactChannels: review.contactChannels.map((match) => match.suggested),
    records: review.records.map((match) => match.suggested),
    // Only what the profile has nowhere to show: an import never overwrites a
    // name the user typed.
    identity: review.identity.filter((match) => match.existing === null).map((each) => each.field),
    summary: review.summary !== undefined && review.summary.existing === null,
  };
}

export interface ImportPlan {
  organisations: OrganisationInput[];
  customSections: CustomSectionInput[];
  contactChannels: ContactChannelInput[];
  // The profile's summary and every record's, written before the rows that
  // name them.
  phrasingSets: PhrasingSetInput[];
  records: CareerRecordInput[];
  recordLinks: RecordLinkInput[];
  points: PointInput[];
  tags: TagInput[];
  recordTags: RecordTag[];
  profile: ProfilePatch | null;
}

// Fresh keys above everything the scope already holds, archived rows included:
// every sort-key index here covers them, so reusing a key an archived row still
// carries is refused by the index.
function above(taken: readonly string[]): () => SortKey {
  let last: string | null = [...taken].sort().at(-1) ?? null;
  return () => {
    const next = generateKeyBetween(last, null);
    last = next;
    return next;
  };
}

function keysForRecords(store: Store): (record: IntakeRecord, sectionId: Uuid | null) => SortKey {
  const byScope = new Map<string, () => SortKey>();
  return (record, sectionId) => {
    const scope = `${record.kind}:${sectionId ?? ""}`;
    let next = byScope.get(scope);
    if (next === undefined) {
      next = above(
        store.records
          .filter(
            (row) =>
              row.kind === record.kind &&
              (row.kind === "custom_entry" ? row.customSectionId : null) === sectionId,
          )
          .map((row) => row.sortKey),
      );
      byScope.set(scope, next);
    }
    return next();
  };
}

// Labels rather than ids, resolved the way the pickers do it. Two labels that
// slug alike are one tag, which `tag_slug_unique` would otherwise refuse.
class Tags {
  private readonly created = new Map<string, Uuid>();
  private readonly store: Store;
  readonly inputs: TagInput[] = [];

  constructor(store: Store) {
    this.store = store;
  }

  idFor(label: string): Uuid {
    const existing = tagForLabel(this.store, label);
    if (existing !== undefined) return existing.id;
    const slug = tagSlug(label);
    const already = this.created.get(slug);
    if (already !== undefined) return already;
    const id = newUuid();
    this.created.set(slug, id);
    this.inputs.push({ id, label, category: null });
    return id;
  }
}

function sectionsFor(store: Store, intake: Intake, decisions: IntakeDecisions) {
  const headings = new Map<string, Uuid>();
  const inputs: CustomSectionInput[] = [];
  const nextKey = above(store.customSections.map((row) => row.sortKey));

  intake.records.forEach((record, index) => {
    if (record.kind !== "custom_entry") return;
    if (decisions.records[index]?.action === "skip") return;
    const key = fold(record.sectionHeading);
    if (headings.has(key)) return;
    const existing = live(store.customSections).find((row) =>
      same(row.heading, record.sectionHeading),
    );
    if (existing !== undefined) {
      headings.set(key, existing.id);
      return;
    }
    const id = newUuid();
    headings.set(key, id);
    inputs.push({ id, heading: record.sectionHeading, sortKey: nextKey() });
  });

  return { headings, inputs };
}

function pointsFor(
  store: Store,
  match: { incoming: IntakeRecord; points: PointMatch[] },
  recordId: Uuid,
): PointInput[] {
  const taken = store.points.filter((row) => row.recordId === recordId).map((row) => row.sortKey);
  const nextKey = above(taken);
  return match.points
    .filter((point) => point.duplicateOf === undefined)
    .map((point) => ({
      id: newUuid(),
      recordId,
      phrasingSetId: newUuid(),
      // Nothing that arrived in a file was checked by the person importing it.
      confidence: "unverified" as const,
      occurredOn: point.incoming.occurredOn,
      sortKey: nextKey(),
      phrasing: {
        id: newUuid(),
        variant: "standard" as const,
        label: null,
        sortKey: "a0" as SortKey,
        body: [{ t: "text" as const, v: point.incoming.text }],
      },
    }));
}

function linksFor(store: Store, incoming: IntakeRecord, recordId: Uuid): RecordLinkInput[] {
  const held = store.recordLinks.filter((row) => row.recordId === recordId);
  const nextKey = above(held.map((row) => row.sortKey));
  return incoming.links
    .filter((link) => !held.some((row) => same(row.url, link.url)))
    .map((link) => ({
      id: newUuid(),
      recordId,
      kind: link.kind,
      label: link.label,
      url: link.url,
      sortKey: nextKey(),
    }));
}

interface RecordPlan {
  records: CareerRecordInput[];
  recordLinks: RecordLinkInput[];
  points: PointInput[];
  recordTags: RecordTag[];
  phrasingSets: PhrasingSetInput[];
}

// Everything the store holds in a column. What is left is the reader's own
// vocabulary, which resolves to ids above rather than travelling as columns.
const INTAKE_ONLY = ["organisationName", "points", "links", "tags", "summary", "sectionHeading"];

function columnsOf(incoming: IntakeRecord): Record<string, unknown> {
  const columns: Record<string, unknown> = { ...incoming };
  for (const key of INTAKE_ONLY) delete columns[key];
  return columns;
}

function summarySetOf(text: string | null): PhrasingSetInput | null {
  if (text === null) return null;
  return {
    id: newUuid(),
    purpose: "record_summary",
    phrasing: {
      id: newUuid(),
      variant: "standard",
      label: null,
      sortKey: "a0" as SortKey,
      body: [{ t: "text", v: text }],
    },
  };
}

const organisationIdOf = (incoming: IntakeRecord, decided: Map<string, Uuid>): Uuid | null =>
  incoming.organisationName === null
    ? null
    : (decided.get(fold(incoming.organisationName)) ?? null);

const sectionIdOf = (incoming: IntakeRecord, sections: Map<string, Uuid>): Uuid | null =>
  incoming.kind === "custom_entry" ? (sections.get(fold(incoming.sectionHeading)) ?? null) : null;

// Undefined when the row cannot be written: a custom entry has a section
// planned for every heading that was not skipped, so a missing one is a heading
// the reviewer took off.
function created(
  plan: RecordPlan,
  incoming: IntakeRecord,
  at: {
    organisationId: Uuid | null;
    sectionId: Uuid | null;
    nextKey: (record: IntakeRecord, sectionId: Uuid | null) => SortKey;
  },
): Uuid | undefined {
  if (incoming.kind === "custom_entry" && at.sectionId === null) return undefined;

  const id = newUuid();
  const summarySet = summarySetOf(incoming.summary);
  if (summarySet !== null) plan.phrasingSets.push(summarySet);

  plan.records.push({
    ...columnsOf(incoming),
    ...(at.sectionId === null ? {} : { customSectionId: at.sectionId }),
    id,
    organisationId: at.organisationId,
    summarySetId: summarySet?.id ?? null,
    sortKey: at.nextKey(incoming, at.sectionId),
  } as CareerRecordInput);

  return id;
}

function planRecords(
  store: Store,
  review: IntakeReview,
  decisions: IntakeDecisions,
  organisationIds: Map<string, Uuid>,
  sections: Map<string, Uuid>,
  tags: Tags,
): RecordPlan {
  const plan: RecordPlan = {
    records: [],
    recordLinks: [],
    points: [],
    recordTags: [],
    phrasingSets: [],
  };
  const nextKey = keysForRecords(store);

  review.records.forEach((match, index) => {
    const choice = decisions.records[index];
    if (choice === undefined || choice.action === "skip") return;

    const { incoming } = match;
    const recordId =
      choice.action === "merge"
        ? choice.into
        : created(plan, incoming, {
            organisationId: organisationIdOf(incoming, organisationIds),
            sectionId: sectionIdOf(incoming, sections),
            nextKey,
          });
    if (recordId === undefined) return;

    plan.points.push(...pointsFor(store, match, recordId));
    plan.recordLinks.push(...linksFor(store, incoming, recordId));
    for (const label of incoming.tags) {
      const tagId = tags.idFor(label);
      if (!plan.recordTags.some((row) => row.recordId === recordId && row.tagId === tagId)) {
        plan.recordTags.push({ recordId, tagId });
      }
    }
  });

  return plan;
}

// The rows a reviewed intake becomes. Every one of them is a create: a merge
// adds what the file had and leaves the record the user already curated alone.
export function importPlan(store: Store, intake: Intake, decisions: IntakeDecisions): ImportPlan {
  const review = matchIntake(store, intake);
  const tags = new Tags(store);

  const organisationIds = new Map<string, Uuid>();
  const organisations: OrganisationInput[] = [];
  review.organisations.forEach((match, index) => {
    const choice = decisions.organisations[index];
    if (choice === undefined || choice.action === "skip") return;
    if (choice.action === "merge") {
      organisationIds.set(fold(match.incoming.name), choice.into);
      return;
    }
    const id = newUuid();
    organisationIds.set(fold(match.incoming.name), id);
    // No reader knows an industry, and guessing one from a name is exactly the
    // kind of invention the review step exists to prevent.
    organisations.push({ id, ...match.incoming, industry: null });
  });

  const sections = sectionsFor(store, intake, decisions);
  const records = planRecords(store, review, decisions, organisationIds, sections.headings, tags);

  const nextContactKey = above(store.contactChannels.map((row) => row.sortKey));
  const contactChannels = review.contactChannels.flatMap((match, index) => {
    const choice = decisions.contactChannels[index];
    if (choice === undefined || choice.action !== "create") return [];
    return [
      {
        id: newUuid(),
        kind: match.incoming.kind,
        label: match.incoming.label,
        value: match.incoming.value,
        isDefaultVisible: true,
        sortKey: nextContactKey(),
      },
    ];
  });

  const summary = profileSummaryFor(store, intake, decisions);
  const profile: ProfilePatch = {
    ...Object.fromEntries(
      decisions.identity.flatMap((field) => {
        const value = intake.identity[field];
        return value === null ? [] : [[field, value]];
      }),
    ),
    ...(summary === null ? {} : { summarySetId: summary.id }),
  };

  return {
    organisations,
    customSections: sections.inputs,
    contactChannels,
    phrasingSets: [...(summary === null ? [] : [summary]), ...records.phrasingSets],
    records: records.records,
    recordLinks: records.recordLinks,
    points: records.points,
    tags: tags.inputs,
    recordTags: records.recordTags,
    profile: Object.keys(profile).length === 0 ? null : profile,
  };
}

// A profile that never had a summary names no set, so starting one creates the
// set and points the profile at it. One that already has a set keeps it: the
// wording there is history the import must not walk over.
function profileSummaryFor(
  store: Store,
  intake: Intake,
  decisions: IntakeDecisions,
): PhrasingSetInput | null {
  const text = intake.identity.summary;
  if (!decisions.summary || text === null || store.profile.summarySetId !== null) return null;
  return {
    id: newUuid(),
    purpose: "profile_summary",
    phrasing: {
      id: newUuid(),
      variant: "standard",
      label: null,
      sortKey: "a0" as SortKey,
      body: [{ t: "text", v: text }],
    },
  };
}
