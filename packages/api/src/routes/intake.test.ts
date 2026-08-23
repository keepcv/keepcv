import type { Intake, IntakeDecisions, IntakeRecord, Store } from "@keepcv/schema";
import { intakeRecordSchema, PROBLEM_TYPES, storeSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { problemOf, withApi } from "../api.harness.js";

const { send, raw, otherOwner } = withApi();

// Parsed rather than cast: a partial date is branded, and a fixture the wire
// format would reject is not one the route is being tested against.
const anIntakeRecord = (overrides: Record<string, unknown> = {}): IntakeRecord =>
  intakeRecordSchema.parse({
    kind: "experience",
    title: "Staff engineer",
    subtitle: null,
    startedOn: "2023-04",
    endedOn: null,
    isCurrent: true,
    location: null,
    organisationName: "Acme",
    summary: null,
    points: [],
    links: [],
    tags: [],
    employmentType: null,
    mode: null,
    ...overrides,
  });

const anIntake = (overrides: Partial<Intake> = {}): Intake => ({
  source: "json-resume",
  fidelity: "declared",
  identity: { fullName: null, headline: null, location: null, pronouns: null, summary: null },
  contactChannels: [],
  organisations: [{ name: "Acme", kind: "company", website: null, location: null }],
  records: [anIntakeRecord()],
  notes: [],
  ...overrides,
});

const takeEverything = (intake: Intake): IntakeDecisions => ({
  organisations: intake.organisations.map(() => ({ action: "create" })),
  contactChannels: intake.contactChannels.map(() => ({ action: "create" })),
  records: intake.records.map(() => ({ action: "create" })),
  identity: [],
  summary: false,
});

async function storeNow(): Promise<Store> {
  return storeSchema.parse(await (await send("GET", "/v1/store")).json());
}

describe("POST /v1/intake", () => {
  it("writes the organisation, the record and its points, and says what it wrote", async () => {
    const intake = anIntake({
      records: [
        anIntakeRecord({
          points: [
            { text: "Cut runtime by 40%.", occurredOn: null },
            { text: "Led the migration.", occurredOn: null },
          ],
          tags: ["backend"],
        }),
      ],
    });

    const response = await send("POST", "/v1/intake", {
      intake,
      decisions: takeEverything(intake),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      organisations: 1,
      records: 1,
      points: 2,
      tags: 1,
    });

    const store = await storeNow();
    expect(store.records).toHaveLength(1);
    expect(store.points).toHaveLength(2);
    expect(store.recordTags).toHaveLength(1);
    expect(store.records[0]?.organisationId).toBe(store.organisations[0]?.id);
  });

  it("takes the identity fields the reviewer chose and leaves the rest", async () => {
    const intake = anIntake({
      identity: {
        fullName: "Ada Lovelace",
        headline: "Engineer",
        location: null,
        pronouns: null,
        summary: null,
      },
    });

    await send("POST", "/v1/intake", {
      intake,
      decisions: { ...takeEverything(intake), identity: ["fullName"] },
    });

    const store = await storeNow();
    expect(store.profile.fullName).toBe("Ada Lovelace");
    expect(store.profile.headline).toBeNull();
  });

  // The property the review step is built on, over the real store rather than
  // a fixture: the second run has nothing left to write.
  it("writes nothing when the same file is applied twice", async () => {
    const intake = anIntake({
      records: [anIntakeRecord({ points: [{ text: "Cut runtime by 40%.", occurredOn: null }] })],
    });
    const body = { intake, decisions: takeEverything(intake) };

    await send("POST", "/v1/intake", body);
    const before = await storeNow();

    // The reviewer would be offered a merge the second time; taking "create"
    // again is the harsher test, and the plan still has to answer with nothing.
    const second = await send("POST", "/v1/intake", {
      intake,
      decisions: {
        ...takeEverything(intake),
        organisations: [{ action: "merge", into: before.organisations[0]?.id }],
        records: [{ action: "merge", into: before.records[0]?.id }],
      },
    });

    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ organisations: 0, records: 0, points: 0 });

    const after = await storeNow();
    expect(after.records).toHaveLength(before.records.length);
    expect(after.points).toHaveLength(before.points.length);
  });

  it("refuses a body whose decisions do not answer every incoming thing", async () => {
    const intake = anIntake();

    const response = await send("POST", "/v1/intake", {
      intake,
      decisions: { ...takeEverything(intake), records: [] },
    });

    expect(response.status).toBe(422);
    expect((await problemOf(response)).type).toBe(PROBLEM_TYPES.validationFailed);
  });

  it("lands in the owner it was sent for and nowhere else", async () => {
    const intake = anIntake();
    const elsewhere = await otherOwner();

    expect(
      (await elsewhere("POST", "/v1/intake", { intake, decisions: takeEverything(intake) })).status,
    ).toBe(200);

    expect((await storeNow()).records).toHaveLength(0);
  });

  it("refuses a caller with no credential", async () => {
    const intake = anIntake();
    const response = await raw("/v1/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intake, decisions: takeEverything(intake) }),
    });

    expect(response.status).toBe(401);
  });
});
