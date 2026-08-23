import type { Intake, IntakeRecord, Store } from "@keepcv/schema";
import {
  careerRecordSchema,
  contactChannelSchema,
  customSectionSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  recordLinkSchema,
  tagSchema,
} from "@keepcv/schema";
import { tagSlug } from "../tags/slug.js";
import type { ImportPlan } from "./intake.js";
import { EPOCH } from "./store.harness.js";

export function anIntake(overrides: Partial<Intake> = {}): Intake {
  return {
    source: "json-resume",
    fidelity: "declared",
    identity: { fullName: null, headline: null, location: null, pronouns: null, summary: null },
    contactChannels: [],
    organisations: [],
    records: [],
    notes: [],
    ...overrides,
  };
}

export function anIntakeRecord(overrides: Record<string, unknown> = {}): IntakeRecord {
  return {
    kind: "experience",
    title: "Staff engineer",
    subtitle: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    organisationName: null,
    summary: null,
    points: [],
    links: [],
    tags: [],
    employmentType: null,
    mode: null,
    ...overrides,
  } as IntakeRecord;
}

const stamped = { createdAt: EPOCH, updatedAt: EPOCH, archivedAt: null };

// What the route does, against a Store instead of repositories. Only here so
// the same file can be imported twice and the second one shown to write
// nothing; the route is what actually writes.
export function applyPlan(store: Store, plan: ImportPlan): void {
  for (const row of plan.organisations) {
    store.organisations.push(organisationSchema.parse({ ...stamped, ...row }));
  }
  for (const row of plan.customSections) {
    store.customSections.push(customSectionSchema.parse({ ...stamped, ...row }));
  }
  for (const row of plan.contactChannels) {
    store.contactChannels.push(contactChannelSchema.parse({ ...stamped, ...row }));
  }
  for (const row of plan.tags) {
    store.tags.push(tagSchema.parse({ ...stamped, ...row, slug: tagSlug(row.label) }));
  }
  for (const set of plan.phrasingSets) {
    store.phrasingSets.push(
      phrasingSetSchema.parse({
        ...stamped,
        id: set.id,
        purpose: set.purpose,
        canonicalPhrasingId: set.phrasing.id,
      }),
    );
    writePhrasing(store, set.id, set.phrasing);
  }
  for (const row of plan.records) {
    store.records.push(careerRecordSchema.parse({ ...stamped, ...row }));
  }
  for (const row of plan.recordLinks) {
    store.recordLinks.push(recordLinkSchema.parse({ ...stamped, ...row }));
  }
  for (const point of plan.points) {
    const { phrasing, ...row } = point;
    store.phrasingSets.push(
      phrasingSetSchema.parse({
        ...stamped,
        id: row.phrasingSetId,
        purpose: "point",
        canonicalPhrasingId: phrasing.id,
      }),
    );
    writePhrasing(store, row.phrasingSetId, phrasing);
    store.points.push(pointSchema.parse({ ...stamped, ...row }));
  }
  store.recordTags.push(...plan.recordTags);
  if (plan.profile !== null) Object.assign(store.profile, plan.profile);
}

function writePhrasing(
  store: Store,
  phrasingSetId: string,
  phrasing: ImportPlan["phrasingSets"][number]["phrasing"],
): void {
  const revisionId = `${phrasing.id.slice(0, 24)}${"f".repeat(12)}`;
  const said = phrasing.body.map((node) => (node.t === "text" ? node.v : "")).join("");
  store.phrasings.push(
    phrasingSchema.parse({
      ...stamped,
      id: phrasing.id,
      phrasingSetId,
      variant: phrasing.variant,
      label: phrasing.label,
      sortKey: phrasing.sortKey,
      currentRevisionId: revisionId,
    }),
  );
  store.phrasingRevisions.push(
    phrasingRevisionSchema.parse({
      id: revisionId,
      createdAt: EPOCH,
      phrasingId: phrasing.id,
      body: phrasing.body,
      plainText: said,
      charCount: said.length,
      contentHash: "0".repeat(64),
    }),
  );
}
