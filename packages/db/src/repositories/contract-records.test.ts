import {
  CareerRecordKindMismatchError,
  ConcurrencyConflictError,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
} from "@keepcv/core";
import {
  CAREER_RECORD_KINDS,
  type CareerRecordInput,
  type CareerRecordKind,
  ORGANISATION_KINDS,
  type OrganisationInput,
  RECORD_FIELD_VALUE_KINDS,
  RECORD_LINK_KINDS,
  type RecordFieldInput,
  type RecordLinkInput,
  SKILL_PROFICIENCIES,
  type Uuid,
  WORK_MODES,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { eachDriver } from "./contract.harness.js";

// One distinctive value per kind-specific column, so a round trip that drops or
// misplaces one is visible rather than merely null.
const extrasByKind: Record<CareerRecordKind, Record<string, unknown>> = {
  experience: { employmentType: "Full-time", mode: "remote" },
  education: {
    grade: "First",
    gradeScale: "UK",
    thesisTitle: "On engines",
    honours: "Distinction",
  },
  project: {},
  skill: { category: "Languages", proficiency: "expert" },
  certification: { credentialId: "AWS-1234", expiresOn: "2027-03" },
  publication: { doi: "10.1000/182" },
  award: {},
  language: { proficiency: "C1" },
  volunteering: {},
  speaking: {},
};

function recordInput(
  kind: CareerRecordKind,
  sortKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: newUuid(),
    kind,
    title: `a ${kind}`,
    subtitle: null,
    organisationId: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    sortKey,
    ...extrasByKind[kind],
    ...overrides,
  } as CareerRecordInput;
}

// Drizzle wraps a driver error and keeps the original as the cause, where both
// drivers report which constraint refused the row. Naming it in the assertion is
// what stops a test passing because the write failed for some other reason.
async function violatedConstraint(work: Promise<unknown>): Promise<string | undefined> {
  const thrown = await work.then(
    () => undefined,
    (error: unknown) => error,
  );
  return (thrown as { cause?: { constraint?: string } } | undefined)?.cause?.constraint;
}

function organisationInput(name: string, overrides: Partial<OrganisationInput> = {}) {
  return {
    id: newUuid(),
    name,
    kind: "company",
    website: null,
    industry: null,
    location: null,
    ...overrides,
  } as OrganisationInput;
}

function linkInput(recordId: Uuid, sortKey: string, overrides: Partial<RecordLinkInput> = {}) {
  return {
    id: newUuid(),
    recordId,
    kind: "repo",
    label: null,
    url: "https://example.com/engine",
    sortKey,
    ...overrides,
  } as RecordLinkInput;
}

function fieldInput(recordId: Uuid, key: string, sortKey: string) {
  return {
    id: newUuid(),
    recordId,
    key,
    label: "Credential ID",
    value: "AWS-1234",
    valueKind: "text",
    sortKey,
  } as RecordFieldInput;
}

eachDriver(({ run, otherOwner }) => {
  describe("organisations", () => {
    it("lists live ones by name and keeps archived ones out of the way", async () => {
      const engines = await run(async (r) => {
        await r.organisations.create(organisationInput("Zeta Institute", { kind: "institution" }));
        return await r.organisations.create(organisationInput("Analytical Engines"));
      });

      const listed = await run(async (r) => await r.organisations.list());
      expect(listed.map((o) => o.name)).toEqual(["Analytical Engines", "Zeta Institute"]);

      const archived = await run(
        async (r) => await r.organisations.archive(engines.id, engines.updatedAt),
      );
      expect(archived.name).toBe("Analytical Engines");

      expect(await run(async (r) => await r.organisations.list())).toHaveLength(1);
      expect(
        await run(async (r) => await r.organisations.list({ includeArchived: true })),
      ).toHaveLength(2);

      const restored = await run(
        async (r) => await r.organisations.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const created = await run(
        async (r) => await r.organisations.create(organisationInput("Analytical Engines")),
      );
      await run(
        async (r) =>
          await r.organisations.update(created.id, { industry: "Computing" }, created.updatedAt),
      );

      await expect(
        run(async (r) => await r.organisations.update(newUuid(), {}, created.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        run(
          async (r) =>
            await r.organisations.update(created.id, { location: "London" }, created.updatedAt),
        ),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    it("hides another owner's organisations", async () => {
      const asIntruder = await otherOwner();
      const mine = await run(
        async (r) => await r.organisations.create(organisationInput("Analytical Engines")),
      );

      expect(await asIntruder(async (r) => await r.organisations.list())).toEqual([]);
      await expect(
        asIntruder(async (r) => await r.organisations.get(mine.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("records", () => {
    it.each(CAREER_RECORD_KINDS)("stores a %s with the fields only that kind has", async (kind) => {
      const input = recordInput(kind, "a0");
      const created = await run(async (r) => await r.records.create(input));
      expect(created).toMatchObject(extrasByKind[kind]);

      const read = await run(async (r) => await r.records.get(created.id));
      expect(read).toEqual(created);
    });

    it("lists a kind in sort-key order, and every kind together", async () => {
      const [first, second] = generateNKeysBetween(null, null, 2);
      await run(async (r) => {
        await r.records.create(recordInput("experience", second ?? "", { title: "second" }));
        await r.records.create(recordInput("experience", first ?? "", { title: "first" }));
        await r.records.create(recordInput("skill", first ?? "", { title: "a skill" }));
      });

      const experiences = await run(async (r) => await r.records.list({ kind: "experience" }));
      expect(experiences.map((record) => record.title)).toEqual(["first", "second"]);
      expect(await run(async (r) => await r.records.list())).toHaveLength(3);
    });

    // The scope of a sort key is the list it is dragged within, and that list is
    // one kind. Two kinds sharing a key is normal; two records of one kind
    // sharing one would make a drag ambiguous.
    it("scopes sort-key uniqueness to the kind", async () => {
      await run(async (r) => {
        await r.records.create(recordInput("experience", "a0"));
        await r.records.create(recordInput("education", "a0"));
      });

      expect(
        await violatedConstraint(run((r) => r.records.create(recordInput("experience", "a0")))),
      ).toBe("record_sort_key_unique");
    });

    it("refuses a patch that names the wrong kind", async () => {
      const created = await run(
        async (r) => await r.records.create(recordInput("experience", "a0")),
      );

      await expect(
        run(
          async (r) =>
            await r.records.update(
              created.id,
              { kind: "project", title: "renamed" },
              created.updatedAt,
            ),
        ),
      ).rejects.toBeInstanceOf(CareerRecordKindMismatchError);

      // ...and left the record alone rather than applying the fields it shares.
      expect(await run(async (r) => await r.records.get(created.id))).toEqual(created);
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const created = await run(async (r) => await r.records.create(recordInput("skill", "a0")));
      await run(
        async (r) =>
          await r.records.update(
            created.id,
            { kind: "skill", category: "Databases" },
            created.updatedAt,
          ),
      );

      await expect(
        run(async (r) => await r.records.update(newUuid(), { kind: "skill" }, created.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        run(
          async (r) =>
            await r.records.update(
              created.id,
              { kind: "skill", category: "Queues" },
              created.updatedAt,
            ),
        ),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    it("archives without destroying, and restores", async () => {
      const created = await run(
        async (r) => await r.records.create(recordInput("experience", "a0", { title: "Analyst" })),
      );

      const archived = await run(
        async (r) => await r.records.archive(created.id, created.updatedAt),
      );
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.title).toBe("Analyst");

      expect(await run(async (r) => await r.records.list())).toEqual([]);
      expect(await run(async (r) => await r.records.list({ includeArchived: true }))).toHaveLength(
        1,
      );

      const restored = await run(
        async (r) => await r.records.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it.each(["2019", "2019-03", "2019-03-04"])("stores a date given as %s", async (startedOn) => {
      const created = await run(
        async (r) => await r.records.create(recordInput("award", "a0", { startedOn })),
      );
      expect(created.startedOn).toBe(startedOn);
    });

    it("refuses a date at a precision no calendar has", async () => {
      await expect(
        run(
          async (r) => await r.records.create(recordInput("award", "a0", { startedOn: "2019-13" })),
        ),
      ).rejects.toThrow();
    });

    // P-A: a half-entered record saves. Ticking "still there" before clearing an
    // end date is exactly the sequence a constraint here would punish.
    it("saves an ongoing period that still has an end date", async () => {
      const created = await run(
        async (r) =>
          await r.records.create(
            recordInput("experience", "a0", { isCurrent: true, endedOn: "2024" }),
          ),
      );
      expect(created.isCurrent).toBe(true);
      expect(created.endedOn).toBe("2024");
    });

    it("attaches an organisation, and refuses one belonging to someone else", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.organisations.create(organisationInput("Their Company")),
      );
      const mine = await run(
        async (r) => await r.organisations.create(organisationInput("My Company")),
      );

      const attached = await run(
        async (r) =>
          await r.records.create(recordInput("experience", "a0", { organisationId: mine.id })),
      );
      expect(attached.organisationId).toBe(mine.id);

      expect(
        await violatedConstraint(
          run((r) =>
            r.records.create(recordInput("experience", "a1", { organisationId: theirs.id })),
          ),
        ),
      ).toBe("record_organisation_fk");
    });
  });

  describe("links and fields", () => {
    async function aRecord(): Promise<Uuid> {
      const created = await run(async (r) => await r.records.create(recordInput("project", "a0")));
      return created.id;
    }

    it("hang off a record of any kind, in sort-key order", async () => {
      const recordId = await aRecord();
      const [first, second] = generateNKeysBetween(null, null, 2);
      await run(async (r) => {
        await r.records.createLink(linkInput(recordId, second ?? "", { url: "https://second" }));
        await r.records.createLink(linkInput(recordId, first ?? "", { url: "https://first" }));
        await r.records.createField(fieldInput(recordId, "grade", "a0"));
      });

      const links = await run(async (r) => await r.records.listLinks({ recordId }));
      expect(links.map((link) => link.url)).toEqual(["https://first", "https://second"]);
      expect(await run(async (r) => await r.records.listFields({ recordId }))).toHaveLength(1);
    });

    it("gives one record at most one field per key", async () => {
      const recordId = await aRecord();
      await run(async (r) => await r.records.createField(fieldInput(recordId, "grade", "a0")));

      expect(
        await violatedConstraint(
          run((r) => r.records.createField(fieldInput(recordId, "grade", "a1"))),
        ),
      ).toBe("record_field_key_unique");
    });

    it("archives and restores without destroying", async () => {
      const recordId = await aRecord();
      const link = await run(async (r) => await r.records.createLink(linkInput(recordId, "a0")));

      const archived = await run(async (r) => await r.records.archiveLink(link.id, link.updatedAt));
      expect(await run(async (r) => await r.records.listLinks({ recordId }))).toEqual([]);
      expect(
        await run(async (r) => await r.records.listLinks({ recordId, includeArchived: true })),
      ).toHaveLength(1);

      await run(async (r) => await r.records.restoreLink(archived.id, archived.updatedAt));
      expect(await run(async (r) => await r.records.listLinks({ recordId }))).toHaveLength(1);
    });

    it("distinguish an unknown id from a stale one", async () => {
      const recordId = await aRecord();
      const field = await run(
        async (r) => await r.records.createField(fieldInput(recordId, "grade", "a0")),
      );
      await run(
        async (r) => await r.records.updateField(field.id, { value: "First" }, field.updatedAt),
      );

      await expect(
        run(async (r) => await r.records.updateField(newUuid(), {}, field.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        run(async (r) => await r.records.updateField(field.id, { value: "2:1" }, field.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    // Archiving a record is a soft delete, so the links and fields it carries
    // survive it. They come back with it, which is the whole point.
    it("survive their record being archived", async () => {
      const recordId = await aRecord();
      await run(async (r) => await r.records.createLink(linkInput(recordId, "a0")));

      const record = await run(async (r) => await r.records.get(recordId));
      await run(async (r) => await r.records.archive(record.id, record.updatedAt));

      expect(await run(async (r) => await r.records.listLinks({ recordId }))).toHaveLength(1);
    });

    it("cannot be hung off another owner's record", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.records.create(recordInput("project", "a0")),
      );

      expect(
        await violatedConstraint(run((r) => r.records.createLink(linkInput(theirs.id, "a0")))),
      ).toBe("record_link_record_fk");
    });
  });

  // The CHECK constraints are written out in the Drizzle schema because
  // drizzle-kit cannot resolve @keepcv/schema. These are what stop the two sides
  // drifting: every declared value has to insert, and an undeclared one must not.
  describe("vocabularies", () => {
    const cases = [
      {
        name: "record kinds",
        declared: [...CAREER_RECORD_KINDS],
        create: (value: string, sortKey: string) => recordInput(value as CareerRecordKind, sortKey),
      },
      {
        name: "work modes",
        declared: [...WORK_MODES],
        create: (value: string, sortKey: string) =>
          recordInput("experience", sortKey, { mode: value }),
      },
      {
        name: "skill proficiencies",
        declared: [...SKILL_PROFICIENCIES],
        create: (value: string, sortKey: string) =>
          recordInput("skill", sortKey, { proficiency: value }),
      },
    ];

    it.each(cases)(
      "accepts exactly the $name the schema declares",
      async ({ declared, create }) => {
        const keys = generateNKeysBetween(null, null, declared.length);
        await run(async (r) => {
          for (const [index, value] of declared.entries()) {
            await r.records.create(create(value, keys[index] ?? ""));
          }
        });

        await expect(
          run(async (r) => await r.records.create(create("not-a-declared-value", "z0"))),
        ).rejects.toThrow();
      },
    );

    it("accepts exactly the record link kinds the schema declares", async () => {
      const created = await run(async (r) => await r.records.create(recordInput("project", "a0")));
      const keys = generateNKeysBetween(null, null, RECORD_LINK_KINDS.length);
      await run(async (r) => {
        for (const [index, kind] of RECORD_LINK_KINDS.entries()) {
          await r.records.createLink(linkInput(created.id, keys[index] ?? "", { kind }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.records.createLink({
              ...linkInput(created.id, "z0"),
              kind: "mirror" as RecordLinkInput["kind"],
            }),
        ),
      ).rejects.toThrow();
    });

    it("accepts exactly the record field value kinds the schema declares", async () => {
      const created = await run(async (r) => await r.records.create(recordInput("project", "a0")));
      const keys = generateNKeysBetween(null, null, RECORD_FIELD_VALUE_KINDS.length);
      await run(async (r) => {
        for (const [index, valueKind] of RECORD_FIELD_VALUE_KINDS.entries()) {
          await r.records.createField({
            ...fieldInput(created.id, valueKind, keys[index] ?? ""),
            valueKind,
          });
        }
      });

      await expect(
        run(
          async (r) =>
            await r.records.createField({
              ...fieldInput(created.id, "boolean", "z0"),
              valueKind: "boolean" as RecordFieldInput["valueKind"],
            }),
        ),
      ).rejects.toThrow();
    });

    it("accepts exactly the organisation kinds the schema declares", async () => {
      await run(async (r) => {
        for (const kind of ORGANISATION_KINDS) {
          await r.organisations.create(organisationInput(`a ${kind}`, { kind }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.organisations.create({
              ...organisationInput("a charity"),
              kind: "charity" as OrganisationInput["kind"],
            }),
        ),
      ).rejects.toThrow();
    });
  });

  // A kind-specific column is null on every other kind. One table gives up the
  // type system for this, so the CHECK that replaces it is named in the
  // assertion: a rejection for some other reason would not be a pass.
  describe("kind-scoped columns", () => {
    it.each([
      {
        kind: "education",
        extra: { mode: "remote" },
        constraint: "record_experience_columns_check",
      },
      {
        kind: "publication",
        extra: { credentialId: "AWS-1234" },
        constraint: "record_certification_columns_check",
      },
      {
        kind: "language",
        extra: { category: "Romance" },
        constraint: "record_skill_columns_check",
      },
    ] as const)("refuses $extra on a $kind", async ({ kind, extra, constraint }) => {
      expect(
        await violatedConstraint(run((r) => r.records.create(recordInput(kind, "a0", extra)))),
      ).toBe(constraint);
    });

    it("keeps skill proficiency to its vocabulary and leaves language proficiency free", async () => {
      await run(async (r) => await r.records.create(recordInput("language", "a0")));
      expect(
        await violatedConstraint(
          run((r) => r.records.create(recordInput("skill", "a1", { proficiency: "C1" }))),
        ),
      ).toBe("record_skill_proficiency_check");
    });
  });
});
