import {
  ConcurrencyConflictError,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
} from "@keepcv/core";
import { SECTION_KINDS, SECTION_LAYOUTS, sortKeySchema, type Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  channelInput,
  compose,
  customSectionInput,
  eachDriver,
  entryInput,
  entryPointInput,
  phrasingInput,
  pointInput,
  type Run,
  recordInput,
  resumeInput,
  sectionInput,
  violatedConstraint,
} from "./contract.harness.js";

const key = (value: string) => sortKeySchema.parse(value);

async function aPoint(
  run: Run,
  recordId: Uuid,
  sortKey: string,
): Promise<{ pointId: Uuid; phrasingId: Uuid }> {
  const input = pointInput(recordId, sortKey, "Another thing that happened");
  await run(async (r) => await r.points.create(input));
  return { pointId: input.id, phrasingId: input.phrasing.id };
}

eachDriver(({ run, otherOwner }) => {
  describe("resumes", () => {
    it("holds what the resume was aimed at", async () => {
      const created = await run(
        async (r) =>
          await r.resumes.create(
            resumeInput("Backend, Acme", {
              targetCompany: "Acme",
              targetRole: "Staff Engineer",
              targetUrl: "https://acme.example/jobs/1",
              targetJdText: "You will own the ingest pipeline.",
              appliedOn: "2026-03",
            }),
          ),
      );

      expect(created).toMatchObject({
        name: "Backend, Acme",
        targetCompany: "Acme",
        appliedOn: "2026-03",
      });
      expect(await run(async (r) => await r.resumes.get(created.id))).toEqual(created);
    });

    it("lists by name and hides the archived ones", async () => {
      const older = await run(async (r) => {
        await r.resumes.create(resumeInput("Platform, Zeta"));
        return await r.resumes.create(resumeInput("Backend, Acme"));
      });

      expect(await run(async (r) => (await r.resumes.list()).map((entry) => entry.name))).toEqual([
        "Backend, Acme",
        "Platform, Zeta",
      ]);

      const archived = await run(async (r) => await r.resumes.archive(older.id, older.updatedAt));
      expect(await run(async (r) => await r.resumes.list())).toHaveLength(1);
      expect(await run(async (r) => await r.resumes.list({ includeArchived: true }))).toHaveLength(
        2,
      );

      const restored = await run(
        async (r) => await r.resumes.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const resume = await run(async (r) => await r.resumes.create(resumeInput("Backend, Acme")));
      await run(
        async (r) => await r.resumes.update(resume.id, { name: "Renamed" }, resume.updatedAt),
      );

      await expect(
        run(async (r) => await r.resumes.update(newUuid(), {}, resume.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        run(async (r) => await r.resumes.update(resume.id, {}, resume.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    // Down to the entry points, because a resume names the company applied to.
    it("is invisible to another owner", async () => {
      const composed = await compose(run);
      const asIntruder = await otherOwner();

      expect(
        await asIntruder(async (r) => await r.resumes.list({ includeArchived: true })),
      ).toEqual([]);
      expect(await asIntruder(async (r) => await r.resumes.listSections())).toEqual([]);
      expect(await asIntruder(async (r) => await r.resumes.listEntries())).toEqual([]);
      expect(await asIntruder(async (r) => await r.resumes.listEntryPoints())).toEqual([]);
      await expect(
        asIntruder(async (r) => await r.resumes.get(composed.resumeId)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("cannot have a section hung off another owner's resume", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => await r.resumes.create(resumeInput("Theirs")));

      await expect(
        run(async (r) => await r.resumes.addSection(sectionInput(theirs.id, "experience", "a0"))),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("sections", () => {
    it("lists a resume's sections in sort-key order, archived ones aside", async () => {
      const { resumeId, last } = await run(async (r) => {
        const elsewhere = await r.resumes.create(resumeInput("Platform, Zeta"));
        await r.resumes.addSection(sectionInput(elsewhere.id, "experience", "a0"));

        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        await r.resumes.addSection(sectionInput(resume.id, "education", "a1"));
        await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        const last = await r.resumes.addSection(sectionInput(resume.id, "project", "a2"));
        return { resumeId: resume.id, last };
      });

      const listed = await run(async (r) => await r.resumes.listSections({ resumeId }));
      expect(listed.map((section) => section.kind)).toEqual(["experience", "education", "project"]);

      await run(async (r) => await r.resumes.archiveSection(last.id, last.updatedAt));
      expect(await run(async (r) => await r.resumes.listSections({ resumeId }))).toHaveLength(2);
      expect(
        await run(async (r) => await r.resumes.listSections({ resumeId, includeArchived: true })),
      ).toHaveLength(3);
    });

    it("refuses a second section of one kind on one resume", async () => {
      const resumeId = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        return resume.id;
      });

      expect(
        await violatedConstraint(
          run(async (r) => await r.resumes.addSection(sectionInput(resumeId, "experience", "a1"))),
        ),
      ).toBe("resume_section_kind_unique");
    });

    // NULLS NOT DISTINCT, so two headings that differ only by their custom
    // section are two sections while two `experience` blocks are one.
    it("tells two custom sections apart by what they print", async () => {
      const { resumeId, firstCustomId } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const speaking = await r.customSections.create(customSectionInput("Talks", "a0"));
        const press = await r.customSections.create(customSectionInput("Press", "a1"));
        await r.resumes.addSection(
          sectionInput(resume.id, "custom", "a0", { customSectionId: speaking.id }),
        );
        await r.resumes.addSection(
          sectionInput(resume.id, "custom", "a1", { customSectionId: press.id }),
        );
        return { resumeId: resume.id, firstCustomId: speaking.id };
      });

      expect(await run(async (r) => await r.resumes.listSections({ resumeId }))).toHaveLength(2);
      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addSection(
                sectionInput(resumeId, "custom", "a2", { customSectionId: firstCustomId }),
              ),
          ),
        ),
      ).toBe("resume_section_kind_unique");
    });

    it("refuses a custom section with nothing to print, and a kind with one", async () => {
      const { resumeId, customSectionId } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const custom = await r.customSections.create(customSectionInput("Talks", "a0"));
        return { resumeId: resume.id, customSectionId: custom.id };
      });

      expect(
        await violatedConstraint(
          run(async (r) => await r.resumes.addSection(sectionInput(resumeId, "custom", "a0"))),
        ),
      ).toBe("resume_section_custom_check");
      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addSection(
                sectionInput(resumeId, "experience", "a1", { customSectionId }),
              ),
          ),
        ),
      ).toBe("resume_section_custom_check");
    });

    it("refuses two sections the same sort key, and allows one per resume", async () => {
      const resumeId = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        return resume.id;
      });

      expect(
        await violatedConstraint(
          run(async (r) => await r.resumes.addSection(sectionInput(resumeId, "education", "a0"))),
        ),
      ).toBe("resume_section_sort_key_unique");

      const elsewhere = await run(async (r) => {
        const other = await r.resumes.create(resumeInput("Platform, Zeta"));
        return await r.resumes.addSection(sectionInput(other.id, "experience", "a0"));
      });
      expect(elsewhere.sortKey).toBe("a0");
    });

    it("moves and renames a section without touching what is under it", async () => {
      const { sectionId, entryId } = await compose(run);
      const section = await run(async (r) => {
        const [only] = await r.resumes.listSections();
        if (only === undefined) throw new Error("the composed resume has one section");
        return only;
      });

      const moved = await run(
        async (r) =>
          await r.resumes.updateSection(
            sectionId,
            { sortKey: key("a5"), heading: "Where I have worked", layout: "grouped" },
            section.updatedAt,
          ),
      );
      expect(moved).toMatchObject({
        sortKey: "a5",
        heading: "Where I have worked",
        layout: "grouped",
      });
      expect(await run(async (r) => (await r.resumes.listEntries()).map((e) => e.id))).toEqual([
        entryId,
      ]);
    });
  });

  describe("entries", () => {
    it("lists a section's entries in sort-key order, archived ones aside", async () => {
      const { sectionId, resumeId, second } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const section = await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        const first = await r.records.create(recordInput("experience", "a0"));
        const next = await r.records.create(recordInput("experience", "a1"));
        await r.resumes.addEntry(entryInput(section.id, resume.id, next.id, "a1"));
        await r.resumes.addEntry(entryInput(section.id, resume.id, first.id, "a0"));
        return { sectionId: section.id, resumeId: resume.id, second: next.id };
      });

      const listed = await run(
        async (r) => await r.resumes.listEntries({ resumeSectionId: sectionId }),
      );
      expect(listed.map((entry) => entry.sortKey)).toEqual(["a0", "a1"]);
      expect(listed.map((entry) => entry.resumeId)).toEqual([resumeId, resumeId]);
      expect(listed[1]?.recordId).toBe(second);
    });

    // Sort keys order by code unit: a row moved above the first one takes a key
    // in the upper-case magnitude, which a locale-aware collation sorts last.
    it("orders a key moved above the first one first", async () => {
      const { sectionId } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const section = await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        const first = await r.records.create(recordInput("experience", "a0"));
        const next = await r.records.create(recordInput("experience", "a1"));
        await r.resumes.addEntry(entryInput(section.id, resume.id, first.id, "a0"));
        await r.resumes.addEntry(entryInput(section.id, resume.id, next.id, "Zz"));
        return { sectionId: section.id };
      });

      const listed = await run(
        async (r) => await r.resumes.listEntries({ resumeSectionId: sectionId }),
      );
      expect(listed.map((entry) => entry.sortKey)).toEqual(["Zz", "a0"]);
    });

    it("refuses one record twice in one section", async () => {
      const { sectionId, resumeId, recordId } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const section = await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
        const record = await r.records.create(recordInput("experience", "a0"));
        await r.resumes.addEntry(entryInput(section.id, resume.id, record.id, "a0"));
        return { sectionId: section.id, resumeId: resume.id, recordId: record.id };
      });

      expect(
        await violatedConstraint(
          run(
            async (r) => await r.resumes.addEntry(entryInput(sectionId, resumeId, recordId, "a1")),
          ),
        ),
      ).toBe("resume_entry_record_unique");
    });

    // The composite key is what makes this a refusal rather than a resume that
    // lists an entry it cannot reach (data-model.md I15).
    it("refuses an entry whose section is on a different resume", async () => {
      const { sectionId } = await compose(run);
      const { strangerId, recordId } = await run(async (r) => {
        const other = await r.resumes.create(resumeInput("Platform, Zeta"));
        const record = await r.records.create(recordInput("project", "a1"));
        return { strangerId: other.id, recordId: record.id };
      });

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addEntry(entryInput(sectionId, strangerId, recordId, "a1")),
          ),
        ),
      ).toBe("resume_entry_section_fk");
    });

    it("cannot print another owner's record", async () => {
      const { sectionId, resumeId } = await compose(run);
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.records.create(recordInput("project", "a0")),
      );

      expect(
        await violatedConstraint(
          run(
            async (r) => await r.resumes.addEntry(entryInput(sectionId, resumeId, theirs.id, "a1")),
          ),
        ),
      ).toBe("resume_entry_record_fk");
    });

    it("cannot be added under another owner's section", async () => {
      const { recordId, resumeId } = await compose(run);
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => {
        const resume = await r.resumes.create(resumeInput("Theirs"));
        return await r.resumes.addSection(sectionInput(resume.id, "experience", "a0"));
      });

      await expect(
        run(async (r) => await r.resumes.addEntry(entryInput(theirs.id, resumeId, recordId, "a1"))),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("entry points", () => {
    it("lists an entry's points in sort-key order", async () => {
      const { entryId, resumeId, recordId } = await compose(run);
      const later = await aPoint(run, recordId, "a1");
      await run(
        async (r) =>
          await r.resumes.addEntryPoint(
            entryPointInput(entryId, resumeId, later.pointId, later.phrasingId, "a1"),
          ),
      );

      const listed = await run(
        async (r) => await r.resumes.listEntryPoints({ resumeEntryId: entryId }),
      );
      expect(listed.map((entry) => entry.sortKey)).toEqual(["a0", "a1"]);
      expect(listed[1]?.pointId).toBe(later.pointId);
    });

    // I13. A point reachable from two records could otherwise be placed under
    // two entries and print twice.
    it("refuses one point twice on one resume, and allows it on another", async () => {
      const { resumeId, sectionId, pointId, phrasingId, recordId } = await compose(run);
      const second = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a1"));
        return await r.resumes.addEntry(entryInput(sectionId, resumeId, record.id, "a1"));
      });

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addEntryPoint(
                entryPointInput(second.id, resumeId, pointId, phrasingId, "a0"),
              ),
          ),
        ),
      ).toBe("resume_entry_point_unique");

      const elsewhere = await run(async (r) => {
        const other = await r.resumes.create(resumeInput("Platform, Zeta"));
        const section = await r.resumes.addSection(sectionInput(other.id, "experience", "a0"));
        const entry = await r.resumes.addEntry(entryInput(section.id, other.id, recordId, "a0"));
        return await r.resumes.addEntryPoint(
          entryPointInput(entry.id, other.id, pointId, phrasingId, "a0"),
        );
      });
      expect(elsewhere.pointId).toBe(pointId);
    });

    it("refuses an entry point whose entry is on a different resume", async () => {
      const { entryId, pointId, phrasingId } = await compose(run);
      const strangerId = await run(
        async (r) => (await r.resumes.create(resumeInput("Platform, Zeta"))).id,
      );

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addEntryPoint(
                entryPointInput(entryId, strangerId, pointId, phrasingId, "a1"),
              ),
          ),
        ),
      ).toBe("resume_entry_point_entry_fk");
    });

    // The live phrasing rather than a revision, so an edit to the wording shows
    // up on the resume that chose it (data-model.md #9.1).
    it("swaps the phrasing a point prints in", async () => {
      const { resumeId, pointId, phrasingId } = await compose(run);
      const entryPoint = await run(async (r) => {
        const [only] = await r.resumes.listEntryPoints();
        if (only === undefined) throw new Error("the composed resume has one entry point");
        return only;
      });
      const shorter = await run(async (r) => {
        const point = await r.points.get(pointId);
        return await r.phrasings.create(
          phrasingInput(point.phrasingSetId, "a1", "Cut p95 latency 6x", { variant: "short" }),
        );
      });

      const swapped = await run(
        async (r) =>
          await r.resumes.updateEntryPoint(
            entryPoint.id,
            { phrasingId: shorter.id },
            entryPoint.updatedAt,
          ),
      );
      expect(swapped.phrasingId).toBe(shorter.id);
      expect(swapped.resumeId).toBe(resumeId);
      expect(swapped.phrasingId).not.toBe(phrasingId);
    });

    it("cannot print another owner's phrasing", async () => {
      const { entryId, resumeId, recordId } = await compose(run);
      const mine = await aPoint(run, recordId, "a1");
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        const input = pointInput(record.id, "a0", "Theirs");
        await r.points.create(input);
        return input.phrasing.id;
      });

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addEntryPoint(
                entryPointInput(entryId, resumeId, mine.pointId, theirs, "a1"),
              ),
          ),
        ),
      ).toBe("resume_entry_point_phrasing_fk");
    });
  });

  // Toggling something off is the whole reason this is composition rather than a
  // list of ids: the wording chosen and the position it sat in have to survive.
  describe("visibility", () => {
    it("keeps the phrasing and the position across a hide and a show", async () => {
      const composed = await compose(run);
      const before = await run(async (r) => {
        const [only] = await r.resumes.listEntryPoints();
        if (only === undefined) throw new Error("the composed resume has one entry point");
        return only;
      });

      const hidden = await run(
        async (r) =>
          await r.resumes.updateEntryPoint(before.id, { isVisible: false }, before.updatedAt),
      );
      expect(hidden).toMatchObject({
        isVisible: false,
        sortKey: before.sortKey,
        phrasingId: composed.phrasingId,
      });

      const shown = await run(
        async (r) =>
          await r.resumes.updateEntryPoint(hidden.id, { isVisible: true }, hidden.updatedAt),
      );
      expect(shown).toMatchObject({ isVisible: true, sortKey: before.sortKey });
    });

    it("hides a section and an entry without archiving either", async () => {
      const { resumeId } = await compose(run);
      const [section] = await run(async (r) => await r.resumes.listSections({ resumeId }));
      const [entry] = await run(async (r) => await r.resumes.listEntries({ resumeId }));
      if (section === undefined || entry === undefined) {
        throw new Error("the composed resume has one section holding one entry");
      }

      const hiddenSection = await run(
        async (r) =>
          await r.resumes.updateSection(section.id, { isVisible: false }, section.updatedAt),
      );
      const hiddenEntry = await run(
        async (r) => await r.resumes.updateEntry(entry.id, { isVisible: false }, entry.updatedAt),
      );

      expect(hiddenSection.archivedAt).toBeNull();
      expect(hiddenEntry.archivedAt).toBeNull();
      expect(await run(async (r) => await r.resumes.listSections({ resumeId }))).toHaveLength(1);
      expect(await run(async (r) => await r.resumes.listEntries({ resumeId }))).toHaveLength(1);
    });

    it("refuses a stale write to a section, an entry and an entry point alike", async () => {
      const { resumeId } = await compose(run);
      const [section] = await run(async (r) => await r.resumes.listSections({ resumeId }));
      const [entry] = await run(async (r) => await r.resumes.listEntries({ resumeId }));
      const [entryPoint] = await run(async (r) => await r.resumes.listEntryPoints({ resumeId }));
      if (section === undefined || entry === undefined || entryPoint === undefined) {
        throw new Error("the composed resume has one of each");
      }

      await run(async (r) => {
        await r.resumes.updateSection(section.id, { sortKey: key("a1") }, section.updatedAt);
        await r.resumes.updateEntry(entry.id, { sortKey: key("a1") }, entry.updatedAt);
        await r.resumes.updateEntryPoint(
          entryPoint.id,
          { sortKey: key("a1") },
          entryPoint.updatedAt,
        );
      });

      await expect(
        run(async (r) => await r.resumes.updateSection(section.id, {}, section.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
      await expect(
        run(async (r) => await r.resumes.updateEntry(entry.id, {}, entry.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
      await expect(
        run(async (r) => await r.resumes.updateEntryPoint(entryPoint.id, {}, entryPoint.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    it("archives and restores an entry and an entry point", async () => {
      const { resumeId } = await compose(run);
      const [entry] = await run(async (r) => await r.resumes.listEntries({ resumeId }));
      const [entryPoint] = await run(async (r) => await r.resumes.listEntryPoints({ resumeId }));
      if (entry === undefined || entryPoint === undefined) {
        throw new Error("the composed resume has one of each");
      }

      const archivedPoint = await run(
        async (r) => await r.resumes.archiveEntryPoint(entryPoint.id, entryPoint.updatedAt),
      );
      const archivedEntry = await run(
        async (r) => await r.resumes.archiveEntry(entry.id, entry.updatedAt),
      );
      expect(await run(async (r) => await r.resumes.listEntries({ resumeId }))).toEqual([]);
      expect(await run(async (r) => await r.resumes.listEntryPoints({ resumeId }))).toEqual([]);

      await run(
        async (r) => await r.resumes.restoreEntry(archivedEntry.id, archivedEntry.updatedAt),
      );
      const restored = await run(
        async (r) => await r.resumes.restoreEntryPoint(archivedPoint.id, archivedPoint.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
      expect(await run(async (r) => await r.resumes.listEntryPoints({ resumeId }))).toHaveLength(1);
    });
  });

  describe("contact channels", () => {
    it("overrides a channel's own default, and reverts by clearing", async () => {
      const { resumeId, channelId } = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const channel = await r.profile.createContactChannel(
          channelInput("a0", { kind: "phone", value: "+44 7700 900000" }),
        );
        return { resumeId: resume.id, channelId: channel.id };
      });

      const hidden = await run(
        async (r) => await r.resumes.setContactChannel(resumeId, channelId, false),
      );
      expect(hidden).toEqual({ resumeId, contactChannelId: channelId, isVisible: false });
      expect(await run(async (r) => await r.resumes.listContactChannels({ resumeId }))).toEqual([
        hidden,
      ]);

      const shown = await run(
        async (r) => await r.resumes.setContactChannel(resumeId, channelId, true),
      );
      expect(shown.isVisible).toBe(true);
      expect(
        await run(async (r) => await r.resumes.listContactChannels({ resumeId })),
      ).toHaveLength(1);

      await run(async (r) => {
        await r.resumes.clearContactChannel(resumeId, channelId);
        await r.resumes.clearContactChannel(resumeId, channelId);
      });
      expect(await run(async (r) => await r.resumes.listContactChannels({ resumeId }))).toEqual([]);
    });

    it("cannot override another owner's channel, or one on their resume", async () => {
      const { resumeId } = await compose(run);
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(async (r) => {
        const resume = await r.resumes.create(resumeInput("Theirs"));
        const channel = await r.profile.createContactChannel(channelInput("a0"));
        return { resumeId: resume.id, channelId: channel.id };
      });

      await expect(
        run(async (r) => await r.resumes.setContactChannel(resumeId, theirs.channelId, false)),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        run(
          async (r) => await r.resumes.setContactChannel(theirs.resumeId, theirs.channelId, false),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("vocabularies", () => {
    it("accepts exactly the section kinds the schema declares", async () => {
      const keys = generateNKeysBetween(null, null, SECTION_KINDS.length);
      const resumeId = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        const custom = await r.customSections.create(customSectionInput("Talks", "a0"));
        for (const [index, kind] of SECTION_KINDS.entries()) {
          await r.resumes.addSection(
            sectionInput(
              resume.id,
              kind,
              keys[index] ?? "",
              kind === "custom" ? { customSectionId: custom.id } : {},
            ),
          );
        }
        return resume.id;
      });

      expect(
        await violatedConstraint(
          run(async (r) => await r.resumes.addSection(sectionInput(resumeId, "hobbies", "z0"))),
        ),
      ).toBe("resume_section_kind_check");
    });

    it("accepts exactly the layouts the schema declares", async () => {
      const keys = generateNKeysBetween(null, null, SECTION_LAYOUTS.length);
      const resumeId = await run(async (r) => {
        const resume = await r.resumes.create(resumeInput("Backend, Acme"));
        for (const [index, layout] of SECTION_LAYOUTS.entries()) {
          await r.resumes.addSection(
            sectionInput(resume.id, SECTION_KINDS[index] ?? "experience", keys[index] ?? "", {
              layout,
            }),
          );
        }
        return resume.id;
      });

      expect(
        await violatedConstraint(
          run(
            async (r) =>
              await r.resumes.addSection(
                sectionInput(resumeId, "award", "z0", { layout: "columns" }),
              ),
          ),
        ),
      ).toBe("resume_section_layout_check");
    });
  });
});
