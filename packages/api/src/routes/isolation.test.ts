import { newUuid } from "@keepcv/core";
import { type Store, storeSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, type Send, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();

// Every collection a client creates into without a parent row, so one table
// covers all of them. A collection added here without an owner predicate on its
// repository fails four ways.
const COLLECTIONS: readonly {
  path: string;
  body: () => Record<string, unknown>;
  patch: Record<string, unknown>;
}[] = [
  {
    path: "/v1/contact-channels",
    body: () => ({
      id: newUuid(),
      kind: "email",
      label: null,
      value: "someone@example.com",
      isDefaultVisible: true,
      sortKey: "a0",
    }),
    patch: { sortKey: "b0" },
  },
  {
    path: "/v1/organisations",
    body: () => ({
      id: newUuid(),
      name: "Acme",
      kind: "company",
      website: null,
      industry: null,
      location: null,
    }),
    patch: { name: "Renamed" },
  },
  {
    path: "/v1/custom-sections",
    body: () => ({ id: newUuid(), heading: "Talks", sortKey: "a0" }),
    patch: { heading: "Renamed" },
  },
  {
    path: "/v1/tags",
    body: () => ({ id: newUuid(), label: "React", category: null }),
    patch: { label: "Renamed" },
  },
  {
    path: "/v1/records",
    body: () => ({
      id: newUuid(),
      kind: "project",
      title: "Difference Engine",
      subtitle: null,
      organisationId: null,
      startedOn: null,
      endedOn: null,
      isCurrent: false,
      location: null,
      summarySetId: null,
      sortKey: "a0",
    }),
    // A record patch is a union discriminated on `kind`, so a body without
    // one is refused as malformed before the owner is ever consulted.
    patch: { kind: "project", title: "Renamed" },
  },
  {
    path: "/v1/resumes",
    body: () => ({
      id: newUuid(),
      name: "Backend",
      targetCompany: null,
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
    }),
    patch: { name: "Renamed" },
  },
  {
    path: "/v1/saved-filters",
    body: () => ({
      id: newUuid(),
      name: "Recent",
      subject: "record",
      query: "",
      kind: null,
      tagId: null,
      archived: "exclude",
      unfinished: null,
      sortKey: "a0",
    }),
    patch: { name: "Renamed" },
  },
  {
    path: "/v1/role-profiles",
    body: () => ({ id: newUuid(), name: "Backend", sortKey: "a0" }),
    patch: { name: "Renamed" },
  },
];

async function createdId(response: Response): Promise<string> {
  expect(response.status).toBe(201);
  return z.object({ id: z.string(), updatedAt: z.string() }).parse(await response.json()).id;
}

describe.each(COLLECTIONS)("$path", ({ path, body, patch }) => {
  it("is invisible to another owner who knows the id", async () => {
    const id = await createdId(await send("POST", path, body()));
    const asIntruder: Send = await otherOwner();

    expect((await problemOf(await asIntruder("GET", `${path}/${id}`))).status).toBe(404);
    expect((await asIntruder("GET", path)).status).toBe(200);
    expect(
      z
        .object({ items: z.array(z.object({ id: z.string() })) })
        .parse(await (await asIntruder("GET", path)).json()).items,
    ).toEqual([]);
  });

  it("cannot be written or archived by another owner who knows the id", async () => {
    const created = await send("POST", path, body());
    const { id, updatedAt } = z
      .object({ id: z.string(), updatedAt: z.string() })
      .parse(await created.json());
    const asIntruder: Send = await otherOwner();

    expect(
      (
        await problemOf(
          await asIntruder("PATCH", `${path}/${id}`, {
            expectedUpdatedAt: updatedAt,
            patch,
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await problemOf(
          await asIntruder("DELETE", `${path}/${id}`, { expectedUpdatedAt: updatedAt }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await problemOf(
          await asIntruder("POST", `${path}/${id}/restore`, { expectedUpdatedAt: updatedAt }),
        )
      ).status,
    ).toBe(404);

    // Refused rather than half-applied: the row is exactly as it was left.
    expect((await send("GET", `${path}/${id}`)).status).toBe(200);
  });
});

async function storeOf(as: Send): Promise<Store> {
  const response = await as("GET", "/v1/store");
  expect(response.status).toBe(200);
  return storeSchema.parse(await response.json());
}

describe("the owner scope", () => {
  // The scope is ambient rather than a parameter, so the failure this guards is
  // one request reading the owner another request put there. It only shows up
  // with both in flight, which no per-resource test arranges.
  it("keeps two owners apart with their requests interleaved", async () => {
    const asOther = await otherOwner();
    const name = (which: string, index: number) => `${which}-${String(index)}`;

    const writes = Array.from({ length: 8 }, (_, index) => [
      send("POST", "/v1/organisations", {
        id: newUuid(),
        name: name("mine", index),
        kind: "company",
        website: null,
        industry: null,
        location: null,
      }),
      asOther("POST", "/v1/organisations", {
        id: newUuid(),
        name: name("theirs", index),
        kind: "company",
        website: null,
        industry: null,
        location: null,
      }),
    ]).flat();

    for (const response of await Promise.all(writes)) expect(response.status).toBe(201);

    const [mine, theirs] = await Promise.all([storeOf(send), storeOf(asOther)]);
    expect(mine.organisations.map((row) => row.name).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => name("mine", index)).sort(),
    );
    expect(theirs.organisations.map((row) => row.name).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => name("theirs", index)).sort(),
    );
  });

  it("answers each of two concurrent reads with only its own rows", async () => {
    const asOther = await otherOwner();
    await send("POST", "/v1/tags", { id: newUuid(), label: "mine", category: null });
    await asOther("POST", "/v1/tags", { id: newUuid(), label: "theirs", category: null });

    const reads = await Promise.all(
      Array.from({ length: 6 }, (_, index) => (index % 2 === 0 ? storeOf(send) : storeOf(asOther))),
    );

    expect(reads.map((store) => store.tags.map((tag) => tag.label))).toEqual([
      ["mine"],
      ["theirs"],
      ["mine"],
      ["theirs"],
      ["mine"],
      ["theirs"],
    ]);
  });
});
