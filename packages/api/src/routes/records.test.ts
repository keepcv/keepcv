import { newUuid } from "@keepcv/core";
import {
  type CareerRecord,
  type CustomSection,
  careerRecordSchema,
  customSectionSchema,
  type Organisation,
  organisationSchema,
  PROBLEM_TYPES,
  type RecordField,
  type RecordLink,
  recordFieldSchema,
  recordLinkSchema,
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

async function addOrganisation(name: string): Promise<Organisation> {
  return await created(
    await send("POST", "/v1/organisations", {
      id: newUuid(),
      name,
      kind: "company",
      website: null,
      industry: null,
      location: null,
    }),
    organisationSchema,
  );
}

async function addSection(heading: string, sortKey: string): Promise<CustomSection> {
  return await created(
    await send("POST", "/v1/custom-sections", { id: newUuid(), heading, sortKey }),
    customSectionSchema,
  );
}

// A kind's own columns are required keys that happen to be nullable, so a body
// missing them is not a record of that kind at all.
const columnsOfKind: Record<string, Record<string, unknown>> = {
  experience: { employmentType: null, mode: null },
  project: {},
  certification: { credentialId: null, expiresOn: null },
  custom_entry: {},
};

function recordBody(kind: string, sortKey: string, extras: Record<string, unknown> = {}) {
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
    summarySetId: null,
    ...columnsOfKind[kind],
    ...extras,
  };
}

async function addRecord(
  kind: string,
  sortKey: string,
  extras: Record<string, unknown> = {},
): Promise<CareerRecord> {
  return await created(
    await send("POST", "/v1/records", recordBody(kind, sortKey, extras)),
    careerRecordSchema,
  );
}

async function addLink(recordId: Uuid, sortKey: string, url: string): Promise<RecordLink> {
  return await created(
    await send("POST", "/v1/record-links", {
      id: newUuid(),
      recordId,
      kind: "repo",
      label: null,
      url,
      sortKey,
    }),
    recordLinkSchema,
  );
}

async function addField(recordId: Uuid, key: string, value: string): Promise<RecordField> {
  return await created(
    await send("POST", "/v1/record-fields", {
      id: newUuid(),
      recordId,
      key,
      label: "Credential ID",
      value,
      valueKind: "text",
      sortKey: "a0",
    }),
    recordFieldSchema,
  );
}

describe("organisations", () => {
  it("creates, reads back, archives and restores", async () => {
    const acme = await addOrganisation("Acme");

    const read = await send("GET", `/v1/organisations/${acme.id}`);
    expect(organisationSchema.parse(await read.json())).toEqual(acme);

    const archived = await send("DELETE", `/v1/organisations/${acme.id}`, {
      expectedUpdatedAt: acme.updatedAt,
    });
    expect(organisationSchema.parse(await archived.json()).archivedAt).not.toBeNull();

    expect(await items(await send("GET", "/v1/organisations"), organisationSchema)).toEqual([]);
    const hidden = await items(
      await send("GET", "/v1/organisations?archived=include"),
      organisationSchema,
    );
    expect(hidden).toHaveLength(1);

    const restored = await send("POST", `/v1/organisations/${acme.id}/restore`, {
      expectedUpdatedAt: hidden[0]?.updatedAt,
    });
    expect(organisationSchema.parse(await restored.json()).archivedAt).toBeNull();
  });

  it("is invisible to another owner who knows the id", async () => {
    const acme = await addOrganisation("Acme");
    const asIntruder: Send = await otherOwner();

    const response = await asIntruder("GET", `/v1/organisations/${acme.id}`);
    expect((await problemOf(response)).status).toBe(404);
  });
});

describe("records", () => {
  it("keeps the facts that belong to one kind and nothing else", async () => {
    const certification = await addRecord("certification", "a0", {
      credentialId: "AWS-1234",
      expiresOn: "2027-03",
    });

    expect(certification).toMatchObject({
      kind: "certification",
      credentialId: "AWS-1234",
      expiresOn: "2027-03",
    });
    // A skill's column is not a certification's, so it never reaches the wire.
    expect(certification).not.toHaveProperty("proficiency");
  });

  it("narrows a list to one kind", async () => {
    await addRecord("experience", "a0");
    await addRecord("project", "a0");

    const projects = await items(await send("GET", "/v1/records?kind=project"), careerRecordSchema);
    expect(projects.map((entry) => entry.kind)).toEqual(["project"]);
    expect(await items(await send("GET", "/v1/records"), careerRecordSchema)).toHaveLength(2);
  });

  it("refuses a filter naming a kind that does not exist", async () => {
    const problem = await problemOf(await send("GET", "/v1/records?kind=hobby"));
    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.validationFailed);
  });

  // A record's kind never changes, so a patch declaring the wrong one was wrong
  // when it was sent. Re-reading would not help, which is why it is not a 409.
  it("refuses a patch that names the wrong kind", async () => {
    const project = await addRecord("project", "a0");

    const response = await send("PATCH", `/v1/records/${project.id}`, {
      expectedUpdatedAt: project.updatedAt,
      patch: { kind: "experience", title: "renamed" },
    });

    const problem = await problemOf(response);
    expect(problem.status).toBe(422);
    expect(problem.errors?.map((issue) => issue.path)).toEqual(["patch.kind"]);
  });

  it("answers a stale patch with the state the server actually holds", async () => {
    const project = await addRecord("project", "a0");
    await send("PATCH", `/v1/records/${project.id}`, {
      expectedUpdatedAt: project.updatedAt,
      patch: { kind: "project", title: "first" },
    });

    const stale = await send("PATCH", `/v1/records/${project.id}`, {
      expectedUpdatedAt: project.updatedAt,
      patch: { kind: "project", title: "second" },
    });

    expect(stale.status).toBe(409);
    const problem = await problemOf(stale);
    expect(problem.type).toBe(PROBLEM_TYPES.staleWrite);
    expect(careerRecordSchema.parse(problem.current).title).toBe("first");
  });

  it("attaches an organisation the owner has", async () => {
    const acme = await addOrganisation("Acme");
    const job = await addRecord("experience", "a0", { organisationId: acme.id });
    expect(job.organisationId).toBe(acme.id);
  });

  // Only the store can refuse this, and it has to arrive as a caller mistake
  // rather than a server fault.
  it("refuses an organisation nobody owns, naming the constraint", async () => {
    const response = await send("POST", "/v1/records", {
      ...recordBody("experience", "a0"),
      organisationId: newUuid(),
    });

    const problem = await problemOf(response);
    expect(problem.status).toBe(422);
    expect(problem.type).toBe(PROBLEM_TYPES.constraintViolated);
    expect(problem.constraint).toBe("record_organisation_fk");
  });
});

describe("custom sections", () => {
  // What prints under a custom heading is a record like any other, so it is
  // created through /v1/records and there is no nested entries route.
  it("hold entries created through the records route", async () => {
    const section = await addSection("Patents", "a0");
    const entry = await addRecord("custom_entry", "a0", { customSectionId: section.id });

    expect(entry).toMatchObject({ kind: "custom_entry", customSectionId: section.id });
    expect(
      await items(await send("GET", "/v1/records?kind=custom_entry"), careerRecordSchema),
    ).toHaveLength(1);
  });

  it("refuse an entry pointing at a heading nobody owns", async () => {
    const response = await send("POST", "/v1/records", {
      ...recordBody("custom_entry", "a0"),
      customSectionId: newUuid(),
    });

    const problem = await problemOf(response);
    expect(problem.status).toBe(422);
    expect(problem.constraint).toBe("record_custom_section_fk");
  });
});

describe("record links and fields", () => {
  it("are narrowed to one record and ordered within it", async () => {
    const project = await addRecord("project", "a0");
    const other = await addRecord("project", "a1");
    await addLink(project.id, "a1", "https://second");
    await addLink(project.id, "a0", "https://first");
    await addLink(other.id, "a0", "https://elsewhere");

    const links = await items(
      await send("GET", `/v1/record-links?recordId=${project.id}`),
      recordLinkSchema,
    );
    expect(links.map((link) => link.url)).toEqual(["https://first", "https://second"]);
    expect(await items(await send("GET", "/v1/record-links"), recordLinkSchema)).toHaveLength(3);
  });

  it("stay readable by id once archived", async () => {
    const project = await addRecord("project", "a0");
    const link = await addLink(project.id, "a0", "https://example.com");

    await send("DELETE", `/v1/record-links/${link.id}`, { expectedUpdatedAt: link.updatedAt });

    const read = await send("GET", `/v1/record-links/${link.id}`);
    expect(read.status).toBe(200);
    expect(recordLinkSchema.parse(await read.json()).archivedAt).not.toBeNull();
    expect(
      await items(await send("GET", `/v1/record-links?recordId=${project.id}`), recordLinkSchema),
    ).toEqual([]);
  });

  it("give one record at most one field per key", async () => {
    const certification = await addRecord("certification", "a0");
    await addField(certification.id, "issuer", "AWS");

    const clash = await send("POST", "/v1/record-fields", {
      id: newUuid(),
      recordId: certification.id,
      key: "issuer",
      label: "Issuer",
      value: "Amazon",
      valueKind: "text",
      sortKey: "a1",
    });

    const problem = await problemOf(clash);
    expect(problem.status).toBe(409);
    expect(problem.constraint).toBe("record_field_key_unique");
  });

  it("update through the patch envelope", async () => {
    const certification = await addRecord("certification", "a0");
    const field = await addField(certification.id, "issuer", "AWS");

    const updated = await send("PATCH", `/v1/record-fields/${field.id}`, {
      expectedUpdatedAt: field.updatedAt,
      patch: { value: "Amazon Web Services" },
    });
    expect(recordFieldSchema.parse(await updated.json()).value).toBe("Amazon Web Services");
  });

  it("tell an unknown id apart from a stale write", async () => {
    const project = await addRecord("project", "a0");
    const link = await addLink(project.id, "a0", "https://example.com");

    const missing = await send("PATCH", `/v1/record-links/${newUuid()}`, {
      expectedUpdatedAt: link.updatedAt,
      patch: { label: "Repo" },
    });
    expect((await problemOf(missing)).status).toBe(404);
  });
});
