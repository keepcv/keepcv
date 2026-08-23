import type { Store } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { anIntake, anIntakeRecord, applyPlan } from "./intake.harness.js";
import { importPlan, matchIntake, suggestedDecisions } from "./intake.js";
import {
  aContactChannel,
  anOrganisation,
  aPoint,
  aRecord,
  aTag,
  emptyStore,
} from "./store.harness.js";

const planFor = (store: Store, intake: ReturnType<typeof anIntake>) =>
  importPlan(store, intake, suggestedDecisions(matchIntake(store, intake)));

describe("matching an intake against the store", () => {
  it("finds an organisation whose name differs only in case and accents", () => {
    const store = emptyStore();
    store.organisations.push(anOrganisation("Acme"));
    const intake = anIntake({
      organisations: [{ name: "ACME", kind: "company", website: null, location: null }],
    });

    const [match] = matchIntake(store, intake).organisations;

    expect(match?.existing?.name).toBe("Acme");
    expect(match?.suggested).toEqual({ action: "merge", into: store.organisations[0]?.id });
  });

  it("offers to create an organisation nothing in the store matches", () => {
    const intake = anIntake({
      organisations: [{ name: "Acme", kind: "company", website: null, location: null }],
    });

    expect(matchIntake(emptyStore(), intake).organisations[0]?.suggested).toEqual({
      action: "create",
    });
  });

  // Anything looser merges one job title at two employers into one record.
  it("matches a record only when the organisation matches too", () => {
    const store = emptyStore();
    const acme = anOrganisation("Acme");
    store.organisations.push(acme);
    store.records.push(aRecord({ kind: "experience", title: "Analyst", organisationId: acme.id }));

    const elsewhere = anIntake({
      organisations: [{ name: "Globex", kind: "company", website: null, location: null }],
      records: [anIntakeRecord({ title: "Analyst", organisationName: "Globex" })],
    });
    const together = anIntake({
      organisations: [{ name: "Acme", kind: "company", website: null, location: null }],
      records: [anIntakeRecord({ title: "Analyst", organisationName: "Acme" })],
    });

    expect(matchIntake(store, elsewhere).records[0]?.existing).toBeUndefined();
    expect(matchIntake(store, together).records[0]?.existing?.title).toBe("Analyst");
  });

  it("never matches a record with no title, because every one of them would match", () => {
    const store = emptyStore();
    store.records.push(aRecord({ kind: "experience", title: null }));
    const intake = anIntake({ records: [anIntakeRecord({ title: null })] });

    expect(matchIntake(store, intake).records[0]?.existing).toBeUndefined();
  });

  it("marks a point the matched record already says", () => {
    const store = emptyStore();
    const record = aRecord({ kind: "experience", title: "Analyst" });
    store.records.push(record);
    aPoint(store, "Cut runtime by 40%.", { recordId: record.id });

    const intake = anIntake({
      records: [
        anIntakeRecord({
          title: "Analyst",
          points: [
            { text: "Cut runtime by 40%.", occurredOn: null },
            { text: "Led the migration.", occurredOn: null },
          ],
        }),
      ],
    });

    const [match] = matchIntake(store, intake).records;

    expect(match?.points[0]?.duplicateOf).toBeDefined();
    expect(match?.points[1]?.duplicateOf).toBeUndefined();
  });

  // An import fills gaps; it does not overwrite what the user typed.
  it("offers an identity field only where the profile has none", () => {
    const store = emptyStore();
    store.profile.fullName = "Ada Lovelace";
    const intake = anIntake({
      identity: {
        fullName: "A. Lovelace",
        headline: "Engineer",
        location: null,
        pronouns: null,
        summary: null,
      },
    });

    const decisions = suggestedDecisions(matchIntake(store, intake));

    expect(decisions.identity).toEqual(["headline"]);
  });

  it("suggests skipping a contact channel already there with the same value", () => {
    const store = emptyStore();
    aContactChannel(store, "email", "ada@example.org");
    const intake = anIntake({
      contactChannels: [{ kind: "email", label: null, value: "ADA@example.org" }],
    });

    expect(matchIntake(store, intake).contactChannels[0]?.suggested).toEqual({ action: "skip" });
  });
});

describe("planning the writes", () => {
  it("creates a record, its words and its link", () => {
    const intake = anIntake({
      records: [
        anIntakeRecord({
          title: "Analyst",
          summary: "Ran the reporting pipeline.",
          points: [{ text: "Cut runtime by 40%.", occurredOn: null }],
          links: [{ kind: "other", label: null, url: "https://acme.example" }],
        }),
      ],
    });

    const plan = planFor(emptyStore(), intake);

    expect(plan.records).toHaveLength(1);
    expect(plan.points).toHaveLength(1);
    expect(plan.recordLinks).toHaveLength(1);
    expect(plan.phrasingSets).toHaveLength(1);
    expect(plan.records[0]?.summarySetId).toBe(plan.phrasingSets[0]?.id);
  });

  it("adds the points to the record it merged into and creates no record", () => {
    const store = emptyStore();
    store.records.push(aRecord({ kind: "experience", title: "Analyst" }));
    const intake = anIntake({
      records: [
        anIntakeRecord({ title: "Analyst", points: [{ text: "Led it.", occurredOn: null }] }),
      ],
    });

    const plan = planFor(store, intake);

    expect(plan.records).toEqual([]);
    expect(plan.points).toHaveLength(1);
    expect(plan.points[0]?.recordId).toBe(store.records[0]?.id);
  });

  it("brings nothing across for a record the reviewer skipped", () => {
    const intake = anIntake({
      records: [
        anIntakeRecord({ points: [{ text: "Led it.", occurredOn: null }], tags: ["backend"] }),
      ],
    });
    const decisions = suggestedDecisions(matchIntake(emptyStore(), intake));

    const plan = importPlan(emptyStore(), intake, {
      ...decisions,
      records: [{ action: "skip" }],
    });

    expect(plan.records).toEqual([]);
    expect(plan.points).toEqual([]);
    expect(plan.recordTags).toEqual([]);
  });

  it("reaches for a tag already in the vocabulary and creates the word that is new", () => {
    const store = emptyStore();
    const backend = aTag(store, "Backend");
    const intake = anIntake({
      records: [anIntakeRecord({ tags: ["backend", "Postgres"] })],
    });

    const plan = planFor(store, intake);

    expect(plan.tags.map((tag) => tag.label)).toEqual(["Postgres"]);
    expect(plan.recordTags.map((row) => row.tagId)).toContain(backend.id);
  });

  // `tag_slug_unique` refuses the second, so two spellings have to become one
  // tag before the write rather than after it.
  it("makes one tag out of two labels that slug alike", () => {
    const intake = anIntake({
      records: [anIntakeRecord({ tags: ["Machine Learning", "machine-learning"] })],
    });

    const plan = planFor(emptyStore(), intake);

    expect(plan.tags).toHaveLength(1);
    expect(new Set(plan.recordTags.map((row) => row.tagId)).size).toBe(1);
  });

  it("creates a section for a heading nothing files, and reuses one that exists", () => {
    const store = emptyStore();
    const intake = anIntake({
      records: [
        anIntakeRecord({ kind: "custom_entry", sectionHeading: "Interests", title: "Cycling" }),
        anIntakeRecord({ kind: "custom_entry", sectionHeading: "interests", title: "Chess" }),
      ],
    });

    const plan = planFor(store, intake);

    expect(plan.customSections).toHaveLength(1);
    const [section] = plan.customSections;
    for (const record of plan.records) {
      expect(record).toMatchObject({ customSectionId: section?.id });
    }
  });

  // Every sort-key index here covers archived rows, so a key an archived row
  // still holds is refused by the index rather than merely looking odd.
  it("takes keys above the archived rows in the same scope", () => {
    const store = emptyStore();
    store.records.push(
      aRecord({
        kind: "experience",
        title: "Old",
        sortKey: "a9",
        archivedAt: "2026-02-02T00:00:00.000Z",
      }),
    );
    const intake = anIntake({ records: [anIntakeRecord({ title: "New" })] });

    const [record] = planFor(store, intake).records;

    expect(record?.sortKey > "a9").toBe(true);
  });

  it("starts a profile summary when there is none, and leaves an existing one alone", () => {
    const intake = anIntake({
      identity: {
        fullName: null,
        headline: null,
        location: null,
        pronouns: null,
        summary: "Ships measurable work.",
      },
    });

    const fresh = planFor(emptyStore(), intake);
    expect(fresh.phrasingSets).toHaveLength(1);
    expect(fresh.profile?.summarySetId).toBe(fresh.phrasingSets[0]?.id);

    const held = emptyStore();
    held.profile.summarySetId = anOrganisation("x").id;
    expect(planFor(held, intake).phrasingSets).toEqual([]);
  });

  it("writes no confidence it was not given", () => {
    const intake = anIntake({
      records: [anIntakeRecord({ points: [{ text: "Led it.", occurredOn: null }] })],
    });

    expect(planFor(emptyStore(), intake).points[0]?.confidence).toBe("unverified");
  });
});

// The property the whole design is for: a file applied twice leaves the store
// as it was after the first time.
describe("importing the same file twice", () => {
  const intake = anIntake({
    identity: {
      fullName: "Ada Lovelace",
      headline: "Engineer",
      location: "London",
      pronouns: null,
      summary: "Ships measurable work.",
    },
    contactChannels: [{ kind: "email", label: null, value: "ada@example.org" }],
    organisations: [{ name: "Acme", kind: "company", website: null, location: null }],
    records: [
      anIntakeRecord({
        title: "Analyst",
        organisationName: "Acme",
        summary: "Ran reporting.",
        tags: ["backend"],
        links: [{ kind: "other", label: null, url: "https://acme.example" }],
        points: [
          { text: "Cut runtime by 40%.", occurredOn: null },
          { text: "Led the migration.", occurredOn: null },
        ],
      }),
      anIntakeRecord({ kind: "custom_entry", sectionHeading: "Interests", title: "Cycling" }),
    ],
  });

  it("writes nothing the second time", () => {
    const store = emptyStore();
    applyPlan(store, planFor(store, intake));

    const second = planFor(store, intake);

    expect(second.organisations).toEqual([]);
    expect(second.customSections).toEqual([]);
    expect(second.contactChannels).toEqual([]);
    expect(second.records).toEqual([]);
    expect(second.recordLinks).toEqual([]);
    expect(second.points).toEqual([]);
    expect(second.tags).toEqual([]);
    expect(second.phrasingSets).toEqual([]);
    expect(second.profile).toBeNull();
  });

  it("leaves one of everything behind after the first", () => {
    const store = emptyStore();
    applyPlan(store, planFor(store, intake));

    expect(store.organisations).toHaveLength(1);
    expect(store.records).toHaveLength(2);
    expect(store.points).toHaveLength(2);
    expect(store.customSections).toHaveLength(1);
    expect(store.profile.fullName).toBe("Ada Lovelace");
  });
});
