import { newUuid } from "@keepcv/core";
import {
  manifestDiffSchema,
  PROBLEM_TYPES,
  type ResumeSnapshot,
  type ResumeVersion,
  restoredResumeSchema,
  resumeSchema,
  resumeSnapshotSchema,
  resumeVersionSchema,
  type Uuid,
  versionRefSchema,
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

interface Composed {
  resumeId: Uuid;
  recordId: Uuid;
  pointId: Uuid;
  phrasingId: Uuid;
  entryId: Uuid;
}

// One resume with one point on it, built through the routes a client uses.
async function compose(name: string, sortKey = "a0"): Promise<Composed> {
  const body = async (response: Response) => {
    expect(response.status).toBe(201);
    return (await response.json()) as { id: Uuid };
  };

  const resume = await body(
    await send("POST", "/v1/resumes", {
      id: newUuid(),
      name,
      targetCompany: "Acme",
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
    }),
  );
  const record = await body(
    await send("POST", "/v1/records", {
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
  );
  const phrasingId = newUuid();
  const point = await body(
    await send("POST", "/v1/points", {
      id: newUuid(),
      recordId: record.id,
      phrasingSetId: newUuid(),
      confidence: "unverified",
      occurredOn: null,
      sortKey,
      phrasing: {
        id: phrasingId,
        variant: "standard",
        label: null,
        sortKey: "a0",
        body: [{ t: "text", v: "Cut p95 latency from 800ms to 120ms" }],
      },
    }),
  );
  const section = await body(
    await send("POST", "/v1/resume-sections", {
      id: newUuid(),
      resumeId: resume.id,
      kind: "project",
      customSectionId: null,
      heading: null,
      layout: null,
      sortKey: "a0",
      isVisible: true,
    }),
  );
  const entry = await body(
    await send("POST", "/v1/resume-entries", {
      id: newUuid(),
      resumeId: resume.id,
      resumeSectionId: section.id,
      recordId: record.id,
      sortKey: "a0",
      isVisible: true,
    }),
  );
  await body(
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
  return {
    resumeId: resume.id,
    recordId: record.id,
    pointId: point.id,
    phrasingId,
    entryId: entry.id,
  };
}

async function read(path: string): Promise<Record<string, unknown>> {
  const response = await send("GET", path);
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function amend(path: string, patch: Record<string, unknown>): Promise<void> {
  const row = await read(path);
  const response = await send("PATCH", path, { expectedUpdatedAt: row["updatedAt"], patch });
  expect(response.status).toBe(200);
}

async function capture(
  resumeId: Uuid,
  trigger = "export",
  as: Send = send,
): Promise<{ status: number; version: ResumeVersion }> {
  const response = await as("POST", "/v1/resume-versions", {
    id: newUuid(),
    resumeId,
    trigger,
  });
  return { status: response.status, version: resumeVersionSchema.parse(await response.json()) };
}

async function star(resumeVersionId: Uuid, label: string): Promise<ResumeSnapshot> {
  return await created(
    await send("POST", "/v1/resume-snapshots", {
      id: newUuid(),
      resumeVersionId,
      label,
      note: null,
    }),
    resumeSnapshotSchema,
  );
}

describe("resume versions", () => {
  it("captures the manifest rather than taking one from the client", async () => {
    const { resumeId } = await compose("For Acme");

    const { status, version } = await capture(resumeId);

    expect(status).toBe(201);
    expect(version.seq).toBe(1);
    expect(version.trigger).toBe("export");
    expect(version.manifest.resume).toMatchObject({ name: "For Acme", targetCompany: "Acme" });
    expect(version.manifest.sections[0]?.entries[0]?.points).toHaveLength(1);
  });

  it("answers 200 with the current version when nothing has moved", async () => {
    const { resumeId } = await compose("For Acme");
    const first = await capture(resumeId);

    const again = await capture(resumeId, "manual_save");

    expect(again.status).toBe(200);
    expect(again.version.id).toBe(first.version.id);
    expect(
      await items(
        await send("GET", `/v1/resume-versions?resumeId=${resumeId}`),
        resumeVersionSchema,
      ),
    ).toHaveLength(1);
  });

  // The template is part of what was sent, so swapping it is a move like any
  // other rather than a change no version records.
  it("captures again when the resume changes template", async () => {
    const { resumeId } = await compose("For Acme");
    const first = await capture(resumeId);

    const current = resumeSchema.parse(await (await send("GET", `/v1/resumes/${resumeId}`)).json());
    await send("PATCH", `/v1/resumes/${resumeId}`, {
      expectedUpdatedAt: current.updatedAt,
      patch: { templateId: "ats-single-column", templateConfig: { pageSize: "letter" } },
    });

    const again = await capture(resumeId, "manual_save");

    expect(again.status).toBe(201);
    expect(again.version.id).not.toBe(first.version.id);
    expect(again.version.manifest.template).toEqual({
      id: "ats-single-column",
      config: { pageSize: "letter" },
    });
  });

  it("refuses a capture of a resume that is not there", async () => {
    const response = await send("POST", "/v1/resume-versions", {
      id: newUuid(),
      resumeId: newUuid(),
      trigger: "export",
    });

    expect(response.status).toBe(404);
    expect((await problemOf(response)).type).toBe(PROBLEM_TYPES.notFound);
  });

  it("keeps one owner's versions out of another's", async () => {
    const { resumeId } = await compose("For Acme");
    const { version } = await capture(resumeId);
    const intruder = await otherOwner();

    expect((await intruder("GET", `/v1/resume-versions/${version.id}`)).status).toBe(404);
    expect(await items(await intruder("GET", "/v1/resume-versions"), resumeVersionSchema)).toEqual(
      [],
    );
  });
});

describe("comparing and restoring versions", () => {
  // Declared before `/v1/resume-versions/{id}`, or the id route claims it and
  // the whole thing answers 422 on a word that is not a uuid.
  it("compares two versions, with the pinned wordings resolved", async () => {
    const { resumeId, phrasingId } = await compose("For Acme");
    const before = await capture(resumeId);
    await send("POST", `/v1/phrasings/${phrasingId}/revisions`, {
      body: [{ t: "text", v: "Cut p95 latency to 120ms" }],
    });
    const after = await capture(resumeId, "manual_save");

    const response = await send(
      "GET",
      `/v1/resume-versions/diff?a=${before.version.id}&b=${after.version.id}`,
    );
    expect(response.status).toBe(200);
    const diff = manifestDiffSchema.parse(await response.json());

    expect(diff.sections[0]?.entries[0]?.points[0]?.fields).toEqual([
      {
        field: "wording",
        a: "Cut p95 latency from 800ms to 120ms",
        b: "Cut p95 latency to 120ms",
      },
    ]);
  });

  it("refuses a diff naming a version that is not there", async () => {
    const { resumeId } = await compose("For Acme");
    const { version } = await capture(resumeId);

    const response = await send("GET", `/v1/resume-versions/diff?a=${version.id}&b=${newUuid()}`);
    expect(response.status).toBe(404);
    expect((await problemOf(response)).type).toBe(PROBLEM_TYPES.notFound);
  });

  // Never rewinds: the timeline keeps what happened in between, and the restore
  // is a third entry saying where it came from (data-model.md #9.2).
  it("writes an older selection back and appends a version saying so", async () => {
    const { resumeId, entryId } = await compose("For Acme");
    const original = await capture(resumeId);

    await amend(`/v1/resume-entries/${entryId}`, { isVisible: false });
    await amend(`/v1/resumes/${resumeId}`, { name: "For Zeta" });
    await capture(resumeId, "manual_save");

    const response = await send("POST", `/v1/resume-versions/${original.version.id}/restore`, {
      id: newUuid(),
    });
    expect(response.status).toBe(201);
    const restored = restoredResumeSchema.parse(await response.json());

    expect(restored.version.trigger).toBe("restore");
    expect(restored.version.seq).toBe(3);
    expect(restored.version.restoredFromVersionId).toBe(original.version.id);
    expect(restored.version.manifestHash).toBe(original.version.manifestHash);
    expect(restored.omissions).toEqual([]);

    expect(await read(`/v1/resume-entries/${entryId}`)).toMatchObject({ isVisible: true });
    expect(await read(`/v1/resumes/${resumeId}`)).toMatchObject({ name: "For Acme" });
  });

  it("refuses a restore of a version that is not there", async () => {
    const response = await send("POST", `/v1/resume-versions/${newUuid()}/restore`, {
      id: newUuid(),
    });

    expect(response.status).toBe(404);
    expect((await problemOf(response)).type).toBe(PROBLEM_TYPES.notFound);
  });
});

describe("resume snapshots", () => {
  it("stars a version, relabels it, and unstars it without losing it", async () => {
    const { resumeId } = await compose("For Acme");
    const { version } = await capture(resumeId);

    const snapshot = await star(version.id, "Sent to Acme, March");
    const relabelled = resumeSnapshotSchema.parse(
      await (
        await send("PATCH", `/v1/resume-snapshots/${snapshot.id}`, {
          expectedUpdatedAt: snapshot.updatedAt,
          patch: { note: "they replied" },
        })
      ).json(),
    );
    expect(relabelled.note).toBe("they replied");

    await send("DELETE", `/v1/resume-snapshots/${snapshot.id}`, {
      expectedUpdatedAt: relabelled.updatedAt,
    });
    expect(
      await items(
        await send("GET", `/v1/resume-snapshots?resumeId=${resumeId}`),
        resumeSnapshotSchema,
      ),
    ).toEqual([]);
    expect(
      await items(await send("GET", "/v1/resume-snapshots?archived=include"), resumeSnapshotSchema),
    ).toHaveLength(1);
  });

  it("refuses a second snapshot of one version", async () => {
    const { resumeId } = await compose("For Acme");
    const { version } = await capture(resumeId);
    await star(version.id, "Sent to Acme, March");

    const response = await send("POST", "/v1/resume-snapshots", {
      id: newUuid(),
      resumeVersionId: version.id,
      label: "Sent again",
      note: null,
    });

    expect(response.status).toBe(409);
  });

  it("refuses a snapshot of a version that is not there", async () => {
    const response = await send("POST", "/v1/resume-snapshots", {
      id: newUuid(),
      resumeVersionId: newUuid(),
      label: "Of nothing",
      note: null,
    });

    expect(response.status).toBe(404);
  });
});

describe("usage", () => {
  it("answers which versions a point and a record are printed in", async () => {
    const { resumeId, pointId, recordId } = await compose("For Acme");
    const { version } = await capture(resumeId);

    expect(await items(await send("GET", `/v1/points/${pointId}/usage`), versionRefSchema)).toEqual(
      [{ resumeVersionId: version.id, resumeId, seq: 1, createdAt: version.createdAt }],
    );
    expect(
      await items(await send("GET", `/v1/records/${recordId}/usage`), versionRefSchema),
    ).toHaveLength(1);
  });

  it("is a 404 for a point that is not there, not an empty list", async () => {
    expect((await send("GET", `/v1/points/${newUuid()}/usage`)).status).toBe(404);
    expect((await send("GET", `/v1/records/${newUuid()}/usage`)).status).toBe(404);
  });
});
