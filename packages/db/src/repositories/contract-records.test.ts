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
import {
  customSectionInput,
  eachDriver,
  extrasByKind,
  fieldInput,
  linkInput,
  organisationInput,
  parentSection,
  recordInput,
  violatedConstraint,
} from "./contract.harness.js";

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
      const section = await run(
        async (r) => await r.customSections.create(customSectionInput("Patents", "a0")),
      );
      const input = recordInput(kind, "a0", parentSection(kind, section.id));
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

    // Two kinds sharing a key is normal; two records of one kind is an
    // ambiguous drag.
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

    // P-A: a half-entered record saves. Ticking "still there" before clearing
    // an end date is exactly the sequence a constraint here would punish.
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

  describe("custom sections", () => {
    async function aSection(heading: string, sortKey: string): Promise<Uuid> {
      const created = await run(
        async (r) => await r.customSections.create(customSectionInput(heading, sortKey)),
      );
      return created.id;
    }

    function entry(sectionId: Uuid, sortKey: string, title: string) {
      return recordInput("custom_entry", sortKey, { customSectionId: sectionId, title });
    }

    it("lists headings in the order they print, and archives without destroying", async () => {
      const [first, second] = generateNKeysBetween(null, null, 2);
      await aSection("Press", second ?? "");
      const patents = await aSection("Patents", first ?? "");

      const listed = await run(async (r) => await r.customSections.list());
      expect(listed.map((section) => section.heading)).toEqual(["Patents", "Press"]);

      const read = await run(async (r) => await r.customSections.get(patents));
      const archived = await run(
        async (r) => await r.customSections.archive(read.id, read.updatedAt),
      );
      expect(archived.heading).toBe("Patents");
      expect(await run(async (r) => await r.customSections.list())).toHaveLength(1);
      expect(
        await run(async (r) => await r.customSections.list({ includeArchived: true })),
      ).toHaveLength(2);

      const restored = await run(
        async (r) => await r.customSections.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    // The headings are one list per owner, so that is the scope their own key
    // is unique in (I11).
    it("gives one owner at most one heading per sort key", async () => {
      await aSection("Patents", "a0");

      expect(
        await violatedConstraint(
          run((r) => r.customSections.create(customSectionInput("Press", "a0"))),
        ),
      ).toBe("custom_section_sort_key_unique");
    });

    // A custom entry is an ordinary record, so it carries links, fields and
    // points like any other and nothing downstream learns a second shape.
    it("holds records that behave like every other kind", async () => {
      const sectionId = await aSection("Patents", "a0");
      const created = await run(
        async (r) => await r.records.create(entry(sectionId, "a0", "A folding wing")),
      );
      await run(async (r) => await r.records.createLink(linkInput(created.id, "a0")));

      expect(created.kind).toBe("custom_entry");
      expect(await run(async (r) => await r.records.get(created.id))).toEqual(created);
      expect(
        await run(async (r) => await r.records.listLinks({ recordId: created.id })),
      ).toHaveLength(1);
    });

    // Scoping to the kind would reject a legitimate move under the second
    // heading because the first used the same key.
    it("scopes an entry's sort key to its section", async () => {
      const patents = await aSection("Patents", "a0");
      const press = await aSection("Press", "a1");
      await run(async (r) => {
        await r.records.create(entry(patents, "a0", "A folding wing"));
        await r.records.create(entry(press, "a0", "Interviewed on engines"));
      });

      expect(
        await violatedConstraint(run((r) => r.records.create(entry(patents, "a0", "A clash")))),
      ).toBe("record_sort_key_unique");
    });

    it("requires a section on a custom entry and refuses one on any other kind", async () => {
      const sectionId = await aSection("Patents", "a0");

      expect(
        await violatedConstraint(run((r) => r.records.create(recordInput("custom_entry", "a0")))),
      ).toBe("record_custom_section_check");
      expect(
        await violatedConstraint(
          run((r) =>
            r.records.create(recordInput("project", "a0", { customSectionId: sectionId })),
          ),
        ),
      ).toBe("record_custom_section_check");
    });

    it("moves an entry to another heading", async () => {
      const patents = await aSection("Patents", "a0");
      const press = await aSection("Press", "a1");
      const created = await run(
        async (r) => await r.records.create(entry(patents, "a0", "A folding wing")),
      );

      const moved = await run(
        async (r) =>
          await r.records.update(
            created.id,
            { kind: "custom_entry", customSectionId: press },
            created.updatedAt,
          ),
      );
      expect(moved).toMatchObject({ customSectionId: press, title: "A folding wing" });
    });

    // Archiving a heading hides it and leaves its entries alone, so restoring
    // it does not have to guess which of them the user had archived beforehand.
    it("leaves its entries alone when it is archived", async () => {
      const sectionId = await aSection("Patents", "a0");
      await run(async (r) => await r.records.create(entry(sectionId, "a0", "A folding wing")));

      const section = await run(async (r) => await r.customSections.get(sectionId));
      await run(async (r) => await r.customSections.archive(section.id, section.updatedAt));

      expect(await run(async (r) => await r.records.list({ kind: "custom_entry" }))).toHaveLength(
        1,
      );
    });

    it("cannot be borrowed from another owner", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.customSections.create(customSectionInput("Their Patents", "a0")),
      );

      expect(await run(async (r) => await r.customSections.list())).toEqual([]);
      expect(
        await violatedConstraint(run((r) => r.records.create(entry(theirs.id, "a0", "Borrowed")))),
      ).toBe("record_custom_section_fk");
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const sectionId = await aSection("Patents", "a0");
      const section = await run(async (r) => await r.customSections.get(sectionId));
      await run(
        async (r) =>
          await r.customSections.update(section.id, { heading: "Patents held" }, section.updatedAt),
      );

      await expect(
        run(async (r) => await r.customSections.update(newUuid(), {}, section.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        run(
          async (r) =>
            await r.customSections.update(section.id, { heading: "Patents" }, section.updatedAt),
        ),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
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

    it("read one back by id, archived or not", async () => {
      const recordId = await aRecord();
      const link = await run(async (r) => await r.records.createLink(linkInput(recordId, "a0")));
      const field = await run(
        async (r) => await r.records.createField(fieldInput(recordId, "grade", "a0")),
      );

      expect(await run(async (r) => await r.records.getLink(link.id))).toEqual(link);
      expect(await run(async (r) => await r.records.getField(field.id))).toEqual(field);

      // Reading one by id ignores `archived_at`, unlike listing: a link to an
      // archived row must resolve, or "where did it go" has no answer.
      const archived = await run(async (r) => await r.records.archiveLink(link.id, link.updatedAt));
      expect(await run(async (r) => await r.records.getLink(link.id))).toEqual(archived);

      await expect(run(async (r) => await r.records.getLink(newUuid()))).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(run(async (r) => await r.records.getField(newUuid()))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("are invisible to another owner who knows the id", async () => {
      const recordId = await aRecord();
      const link = await run(async (r) => await r.records.createLink(linkInput(recordId, "a0")));
      const asIntruder = await otherOwner();

      await expect(
        asIntruder(async (r) => await r.records.getLink(link.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
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

  // Every declared value has to insert, and an undeclared one must not.
  describe("vocabularies", () => {
    const cases: {
      name: string;
      declared: string[];
      create: (value: string, sortKey: string, sectionId: Uuid) => CareerRecordInput;
    }[] = [
      {
        name: "record kinds",
        declared: [...CAREER_RECORD_KINDS],
        create: (value: string, sortKey: string, sectionId: Uuid) =>
          recordInput(
            value as CareerRecordKind,
            sortKey,
            parentSection(value as CareerRecordKind, sectionId),
          ),
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
        const section = await run(
          async (r) => await r.customSections.create(customSectionInput("Patents", "a0")),
        );
        const keys = generateNKeysBetween(null, null, declared.length);
        await run(async (r) => {
          for (const [index, value] of declared.entries()) {
            await r.records.create(create(value, keys[index] ?? "", section.id));
          }
        });

        await expect(
          run(
            async (r) => await r.records.create(create("not-a-declared-value", "z0", section.id)),
          ),
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

  // The CHECK is named in the assertion: another rejection is not a pass.
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
