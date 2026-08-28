import { newUuid } from "@keepcv/core";
import {
  PROBLEM_TYPES,
  type RoleProfile,
  roleProfileApplicationSchema,
  roleProfileSchema,
  roleProfileTagSchema,
  type Store,
  storeSchema,
  type Uuid,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

async function addProfile(name: string, as: Send = send): Promise<RoleProfile> {
  const response = await as("POST", "/v1/role-profiles", { id: newUuid(), name, sortKey: "a0" });
  expect(response.status).toBe(201);
  return roleProfileSchema.parse(await response.json());
}

async function addTag(label: string): Promise<Uuid> {
  const id = newUuid();
  expect((await send("POST", "/v1/tags", { id, label, category: null })).status).toBe(201);
  return id;
}

async function addRecord(title: string, sortKey = "a0"): Promise<Uuid> {
  const id = newUuid();
  const response = await send("POST", "/v1/records", {
    id,
    kind: "project",
    title,
    subtitle: null,
    organisationId: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    location: null,
    sortKey,
    summarySetId: null,
  });
  expect(response.status).toBe(201);
  return id;
}

async function addPoint(recordId: Uuid, text: string): Promise<Uuid> {
  const id = newUuid();
  const response = await send("POST", "/v1/points", {
    id,
    recordId,
    phrasingSetId: newUuid(),
    confidence: "unverified",
    occurredOn: null,
    sortKey: "a0",
    phrasing: {
      id: newUuid(),
      variant: "standard",
      label: null,
      sortKey: "a0",
      body: [{ t: "text", v: text }],
    },
  });
  expect(response.status).toBe(201);
  return id;
}

async function addResume(name: string): Promise<Uuid> {
  const id = newUuid();
  const response = await send("POST", "/v1/resumes", {
    id,
    name,
    targetCompany: null,
    targetRole: null,
    targetUrl: null,
    targetJdText: null,
    appliedOn: null,
  });
  expect(response.status).toBe(201);
  return id;
}

async function readStore(): Promise<Store> {
  const response = await send("GET", "/v1/store");
  expect(response.status).toBe(200);
  return storeSchema.parse(await response.json());
}

async function apply(profileId: Uuid, resumeId: Uuid) {
  const response = await send("POST", `/v1/role-profiles/${profileId}/apply`, { resumeId });
  expect(response.status).toBe(201);
  return roleProfileApplicationSchema.parse(await response.json());
}

describe("role profiles", () => {
  it("keeps a named rule over the vocabulary", async () => {
    const profile = await addProfile("Backend");
    const tagId = await addTag("Go");

    const added = await send("PUT", `/v1/role-profiles/${profile.id}/tags/${tagId}`);
    expect(added.status).toBe(200);
    expect(roleProfileTagSchema.parse(await added.json())).toEqual({
      roleProfileId: profile.id,
      tagId,
    });

    const listed = await send("GET", `/v1/role-profiles/${profile.id}/tags`);
    expect(
      z.object({ items: z.array(roleProfileTagSchema) }).parse(await listed.json()).items,
    ).toHaveLength(1);

    expect((await send("DELETE", `/v1/role-profiles/${profile.id}/tags/${tagId}`)).status).toBe(
      204,
    );
    expect((await readStore()).roleProfileTags).toEqual([]);
  });

  it("refuses a word that is not in the vocabulary", async () => {
    const profile = await addProfile("Backend");
    const problem = await problemOf(
      await send("PUT", `/v1/role-profiles/${profile.id}/tags/${newUuid()}`),
    );
    expect(problem.status).toBe(422);
  });

  it("places what the words select, and writes nothing the second time", async () => {
    const profile = await addProfile("Backend");
    const tagId = await addTag("Go");
    const recordId = await addRecord("Queue runner");
    const pointId = await addPoint(recordId, "Cut queue latency");
    const resumeId = await addResume("Staff engineer");

    await send("PUT", `/v1/role-profiles/${profile.id}/tags/${tagId}`);
    await send("PUT", `/v1/points/${pointId}/tags/${tagId}`);

    expect(await apply(profile.id, resumeId)).toEqual({ entries: 1, points: 1 });

    const after = await readStore();
    expect(after.resumeSections.map((row) => row.kind)).toEqual(["project"]);
    expect(after.resumeEntries.map((row) => row.recordId)).toEqual([recordId]);
    expect(after.resumeEntryPoints.map((row) => row.pointId)).toEqual([pointId]);

    // The property the whole design rests on: every write is a create or a
    // put-back, so a second application is a no-op.
    expect(await apply(profile.id, resumeId)).toEqual({ entries: 0, points: 0 });
    expect(await readStore()).toEqual(after);
  });

  it("takes nothing off a resume the words do not reach", async () => {
    const profile = await addProfile("Backend");
    const tagId = await addTag("Go");
    const kept = await addRecord("Something else");
    const resumeId = await addResume("Staff engineer");

    const wanted = await addRecord("Queue runner", "a1");
    await send("PUT", `/v1/role-profiles/${profile.id}/tags/${tagId}`);
    await send("PUT", `/v1/records/${wanted}/tags/${tagId}`);

    // Placed by hand first, so the profile arrives at a curated resume.
    const sectionId = newUuid();
    await send("POST", "/v1/resume-sections", {
      id: sectionId,
      resumeId,
      kind: "project",
      customSectionId: null,
      heading: null,
      layout: null,
      sortKey: "a0",
      isVisible: true,
    });
    const entryId = newUuid();
    await send("POST", "/v1/resume-entries", {
      id: entryId,
      resumeId,
      resumeSectionId: sectionId,
      recordId: kept,
      sortKey: "a0",
      isVisible: true,
    });

    await apply(profile.id, resumeId);

    const after = await readStore();
    expect(after.resumeSections.map((row) => row.id)).toEqual([sectionId]);
    expect(after.resumeEntries.map((row) => row.recordId).sort()).toEqual([kept, wanted].sort());
    expect(after.resumeEntries.every((row) => row.isVisible)).toBe(true);
  });

  it("answers 404 for a resume of another owner", async () => {
    const profile = await addProfile("Backend");
    const theirs = await (async () => {
      const as = await otherOwner();
      const id = newUuid();
      await as("POST", "/v1/resumes", {
        id,
        name: "Theirs",
        targetCompany: null,
        targetRole: null,
        targetUrl: null,
        targetJdText: null,
        appliedOn: null,
      });
      return id;
    })();

    const problem = await problemOf(
      await send("POST", `/v1/role-profiles/${profile.id}/apply`, { resumeId: theirs }),
    );
    expect(problem.type).toBe(PROBLEM_TYPES.notFound);
  });

  it("cannot reach another owner's profile, and says which thing is missing", async () => {
    const theirs = await addProfile("Theirs", await otherOwner());
    const resumeId = await addResume("Staff engineer");
    expect((await send("GET", `/v1/role-profiles/${theirs.id}`)).status).toBe(404);

    // Named, because "no resume has that id" beside a resume the user is
    // looking at sends them after the wrong thing.
    const problem = await problemOf(
      await send("POST", `/v1/role-profiles/${theirs.id}/apply`, { resumeId }),
    );
    expect(problem.status).toBe(404);
    expect(problem.detail).toContain("roleProfile");
  });
});
