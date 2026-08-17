import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  careerRecordSchema,
  type Point,
  PROBLEM_TYPES,
  pointSchema,
  type Resume,
  type ResumeEntry,
  type ResumeEntryPoint,
  type ResumeSection,
  resumeContactChannelSchema,
  resumeDocumentSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSchema,
  resumeSectionSchema,
  type Uuid,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

async function created<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  expect(response.status).toBe(201);
  return schema.parse(await response.json());
}

async function items<T>(response: Response, schema: z.ZodType<T>): Promise<T[]> {
  expect(response.status).toBe(200);
  return z.object({ items: z.array(schema) }).parse(await response.json()).items;
}

async function addRecord(sortKey: string, as: Send = send): Promise<CareerRecord> {
  return await created(
    await as("POST", "/v1/records", {
      id: newUuid(),
      kind: "project",
      title: "Ingest rewrite",
      subtitle: null,
      organisationId: null,
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      location: null,
      sortKey,
      summarySetId: null,
    }),
    careerRecordSchema,
  );
}

async function addPoint(
  recordId: Uuid,
  sortKey: string,
  text: string,
): Promise<{ point: Point; phrasingId: Uuid }> {
  const phrasingId = newUuid();
  const point = await created(
    await send("POST", "/v1/points", {
      id: newUuid(),
      recordId,
      phrasingSetId: newUuid(),
      confidence: "unverified",
      occurredOn: null,
      sortKey,
      phrasing: {
        id: phrasingId,
        variant: "standard",
        label: null,
        sortKey: "a0",
        body: [{ t: "text", v: text }],
      },
    }),
    pointSchema,
  );
  return { point, phrasingId };
}

async function addResume(name: string, as: Send = send): Promise<Resume> {
  return await created(
    await as("POST", "/v1/resumes", {
      id: newUuid(),
      name,
      targetCompany: null,
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
    }),
    resumeSchema,
  );
}

async function addSection(
  resumeId: Uuid,
  kind: string,
  sortKey: string,
  as: Send = send,
): Promise<ResumeSection> {
  return await created(
    await as("POST", "/v1/resume-sections", {
      id: newUuid(),
      resumeId,
      kind,
      customSectionId: null,
      heading: null,
      layout: null,
      sortKey,
      isVisible: true,
    }),
    resumeSectionSchema,
  );
}

async function addEntry(
  section: ResumeSection,
  recordId: Uuid,
  sortKey: string,
): Promise<ResumeEntry> {
  return await created(
    await send("POST", "/v1/resume-entries", {
      id: newUuid(),
      resumeId: section.resumeId,
      resumeSectionId: section.id,
      recordId,
      sortKey,
      isVisible: true,
    }),
    resumeEntrySchema,
  );
}

async function addEntryPoint(
  entry: ResumeEntry,
  pointId: Uuid,
  phrasingId: Uuid,
  sortKey: string,
): Promise<ResumeEntryPoint> {
  return await created(
    await send("POST", "/v1/resume-entry-points", {
      id: newUuid(),
      resumeId: entry.resumeId,
      resumeEntryId: entry.id,
      pointId,
      phrasingId,
      sortKey,
      isVisible: true,
    }),
    resumeEntryPointSchema,
  );
}

async function compose() {
  const record = await addRecord("a0");
  const { point, phrasingId } = await addPoint(record.id, "a0", "Cut p95 latency 6x");
  const resume = await addResume("Backend, Acme");
  const section = await addSection(resume.id, "experience", "a0");
  const entry = await addEntry(section, record.id, "a0");
  const entryPoint = await addEntryPoint(entry, point.id, phrasingId, "a0");
  return { record, point, phrasingId, resume, section, entry, entryPoint };
}

describe("resumes", () => {
  it("is created, read back and listed", async () => {
    const resume = await addResume("Backend, Acme");

    expect(await items(await send("GET", "/v1/resumes"), resumeSchema)).toEqual([resume]);
    const read = await send("GET", `/v1/resumes/${resume.id}`);
    expect(resumeSchema.parse(await read.json())).toEqual(resume);
  });

  it("archives and restores without losing what is on it", async () => {
    const { resume, section } = await compose();

    const archived = resumeSchema.parse(
      await (
        await send("DELETE", `/v1/resumes/${resume.id}`, { expectedUpdatedAt: resume.updatedAt })
      ).json(),
    );
    expect(archived.archivedAt).not.toBeNull();
    expect(await items(await send("GET", "/v1/resumes"), resumeSchema)).toEqual([]);

    const restored = await send("POST", `/v1/resumes/${resume.id}/restore`, {
      expectedUpdatedAt: archived.updatedAt,
    });
    expect(restored.status).toBe(200);
    expect(
      await items(
        await send("GET", `/v1/resume-sections?resumeId=${resume.id}`),
        resumeSectionSchema,
      ),
    ).toEqual([section]);
  });

  it("answers a stale write with a conflict carrying the row as it stands", async () => {
    const resume = await addResume("Backend, Acme");
    await send("PATCH", `/v1/resumes/${resume.id}`, {
      expectedUpdatedAt: resume.updatedAt,
      patch: { targetCompany: "Acme" },
    });

    const problem = await problemOf(
      await send("PATCH", `/v1/resumes/${resume.id}`, {
        expectedUpdatedAt: resume.updatedAt,
        patch: { targetCompany: "Zeta" },
      }),
    );
    expect(problem.status).toBe(409);
    expect(problem.type).toBe(PROBLEM_TYPES.staleWrite);
    expect(resumeSchema.parse(problem["current"]).targetCompany).toBe("Acme");
  });

  it("is not another owner's to read", async () => {
    const { resume } = await compose();
    const asIntruder = await otherOwner();

    expect(await items(await asIntruder("GET", "/v1/resumes"), resumeSchema)).toEqual([]);
    expect((await asIntruder("GET", `/v1/resumes/${resume.id}`)).status).toBe(404);
    expect(
      await items(await asIntruder("GET", "/v1/resume-entry-points"), resumeEntryPointSchema),
    ).toEqual([]);
  });
});

describe("composition", () => {
  it("narrows each collection to the resume, section or entry asked for", async () => {
    const { resume, section, entry } = await compose();
    const other = await addResume("Platform, Zeta");
    await addSection(other.id, "education", "a0");

    expect(
      await items(
        await send("GET", `/v1/resume-sections?resumeId=${resume.id}`),
        resumeSectionSchema,
      ),
    ).toEqual([section]);
    expect(
      await items(
        await send("GET", `/v1/resume-entries?resumeSectionId=${section.id}`),
        resumeEntrySchema,
      ),
    ).toEqual([entry]);
    expect(
      await items(
        await send("GET", `/v1/resume-entry-points?resumeEntryId=${entry.id}`),
        resumeEntryPointSchema,
      ),
    ).toHaveLength(1);
  });

  // The point of composing rather than copying: hiding something keeps the
  // wording chosen and the place it sat in.
  it("hides an entry point without losing its phrasing or its position", async () => {
    const { entryPoint, phrasingId } = await compose();

    const response = await send("PATCH", `/v1/resume-entry-points/${entryPoint.id}`, {
      expectedUpdatedAt: entryPoint.updatedAt,
      patch: { isVisible: false },
    });
    expect(response.status).toBe(200);
    expect(resumeEntryPointSchema.parse(await response.json())).toMatchObject({
      isVisible: false,
      phrasingId,
      sortKey: entryPoint.sortKey,
    });
  });

  // Which resume a row is on is what it was created as, and the patch schema has
  // no key for it, so a body naming one is dropped at the boundary.
  it("does not move a row to another resume", async () => {
    const { entry, resume } = await compose();

    const response = await send("PATCH", `/v1/resume-entries/${entry.id}`, {
      expectedUpdatedAt: entry.updatedAt,
      patch: { resumeId: newUuid(), resumeSectionId: newUuid(), sortKey: "a1" },
    });
    expect(response.status).toBe(200);
    expect(resumeEntrySchema.parse(await response.json())).toMatchObject({
      resumeId: resume.id,
      resumeSectionId: entry.resumeSectionId,
      sortKey: "a1",
    });
  });

  it("refuses a section on a resume that is not there", async () => {
    const problem = await problemOf(
      await send("POST", "/v1/resume-sections", {
        id: newUuid(),
        resumeId: newUuid(),
        kind: "experience",
        customSectionId: null,
        heading: null,
        layout: null,
        sortKey: "a0",
        isVisible: true,
      }),
    );
    expect(problem.status).toBe(404);
  });

  it("refuses a second section of one kind on one resume", async () => {
    const { resume } = await compose();

    const problem = await problemOf(
      await send("POST", "/v1/resume-sections", {
        id: newUuid(),
        resumeId: resume.id,
        kind: "experience",
        customSectionId: null,
        heading: null,
        layout: null,
        sortKey: "a1",
        isVisible: true,
      }),
    );
    expect(problem.status).toBe(409);
  });

  // I13: a point reachable from two records would otherwise print twice.
  it("refuses the same point twice on one resume", async () => {
    const { resume, section, point, phrasingId } = await compose();
    const second = await addRecord("a1");
    const entry = await addEntry(section, second.id, "a1");

    const problem = await problemOf(
      await send("POST", "/v1/resume-entry-points", {
        id: newUuid(),
        resumeId: resume.id,
        resumeEntryId: entry.id,
        pointId: point.id,
        phrasingId,
        sortKey: "a0",
        isVisible: true,
      }),
    );
    expect(problem.status).toBe(409);
  });

  it("archives an entry and restores it with its points intact", async () => {
    const { entry, entryPoint } = await compose();

    const archived = resumeEntrySchema.parse(
      await (
        await send("DELETE", `/v1/resume-entries/${entry.id}`, {
          expectedUpdatedAt: entry.updatedAt,
        })
      ).json(),
    );
    expect(await items(await send("GET", "/v1/resume-entries"), resumeEntrySchema)).toEqual([]);

    const restored = await send("POST", `/v1/resume-entries/${entry.id}/restore`, {
      expectedUpdatedAt: archived.updatedAt,
    });
    expect(restored.status).toBe(200);
    expect(
      await items(await send("GET", "/v1/resume-entry-points"), resumeEntryPointSchema),
    ).toEqual([entryPoint]);
  });
});

describe("the compiled document", () => {
  it("compiles what the resume selects, with no store identifier in it", async () => {
    const { resume, record, point } = await compose();

    const response = await send("GET", `/v1/resumes/${resume.id}/document`);
    expect(response.status).toBe(200);
    const document = resumeDocumentSchema.parse(await response.json());

    expect(document.meta.resumeName).toBe("Backend, Acme");
    expect(document.sections[0]?.entries[0]?.title).toBe("Ingest rewrite");
    expect(document.sections[0]?.entries[0]?.points[0]?.plainText).toBe("Cut p95 latency 6x");

    const serialised = JSON.stringify(document);
    for (const id of [resume.id, record.id, point.id]) expect(serialised).not.toContain(id);
  });

  it("formats for the locale asked for, and is a 404 for a resume that is not there", async () => {
    const { resume } = await compose();

    const german = await send("GET", `/v1/resumes/${resume.id}/document?locale=de-DE`);
    expect(resumeDocumentSchema.parse(await german.json()).meta.locale).toBe("de-DE");
    expect((await send("GET", `/v1/resumes/${newUuid()}/document`)).status).toBe(404);
  });
});

describe("contact channel overrides", () => {
  async function addChannel(as: Send = send): Promise<Uuid> {
    const response = await as("POST", "/v1/contact-channels", {
      id: newUuid(),
      kind: "phone",
      label: null,
      value: "+44 7700 900000",
      isDefaultVisible: true,
      sortKey: "a0",
    });
    expect(response.status).toBe(201);
    return z.object({ id: z.string() }).parse(await response.json()).id as Uuid;
  }

  it("overrides a channel, lists the override and reverts by clearing", async () => {
    const resume = await addResume("Backend, Acme");
    const channelId = await addChannel();
    const path = `/v1/resumes/${resume.id}/contact-channels/${channelId}`;

    const set = await send("PUT", path, { isVisible: false });
    expect(set.status).toBe(200);
    expect(resumeContactChannelSchema.parse(await set.json())).toEqual({
      resumeId: resume.id,
      contactChannelId: channelId,
      isVisible: false,
    });

    expect(
      await items(
        await send("GET", `/v1/resumes/${resume.id}/contact-channels`),
        resumeContactChannelSchema,
      ),
    ).toHaveLength(1);

    expect((await send("DELETE", path)).status).toBe(204);
    expect((await send("DELETE", path)).status).toBe(204);
    expect(
      await items(
        await send("GET", `/v1/resumes/${resume.id}/contact-channels`),
        resumeContactChannelSchema,
      ),
    ).toEqual([]);
  });

  it("cannot reach another owner's channel or resume", async () => {
    const resume = await addResume("Backend, Acme");
    const asIntruder = await otherOwner();
    const theirResume = await addResume("Theirs", asIntruder);
    const theirChannel = await addChannel(asIntruder);

    expect(
      (
        await send("PUT", `/v1/resumes/${resume.id}/contact-channels/${theirChannel}`, {
          isVisible: false,
        })
      ).status,
    ).toBe(404);
    expect((await send("GET", `/v1/resumes/${theirResume.id}/contact-channels`)).status).toBe(404);
  });
});
