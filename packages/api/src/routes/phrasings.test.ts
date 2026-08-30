import { newUuid } from "@keepcv/core";
import {
  type Phrasing,
  type PhrasingRevision,
  type PhrasingSet,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  type Uuid,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, withApi } from "../api.harness.js";

const { send } = withApi();

async function created<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  expect(response.status).toBe(201);
  return schema.parse(await response.json());
}

async function items<T>(response: Response, schema: z.ZodType<T>): Promise<T[]> {
  expect(response.status).toBe(200);
  return z.object({ items: z.array(schema) }).parse(await response.json()).items;
}

function words(text: string, sortKey = "a0") {
  return {
    id: newUuid(),
    variant: "standard",
    label: null,
    sortKey,
    body: [{ t: "text", v: text }],
  };
}

// A set is never created empty: its first phrasing goes in with it, in one
// transaction, and becomes the canonical one.
async function addSet(text: string): Promise<PhrasingSet> {
  return await created(
    await send("POST", "/v1/phrasing-sets", {
      id: newUuid(),
      purpose: "record_summary",
      phrasing: words(text),
    }),
    phrasingSetSchema,
  );
}

async function addPhrasing(
  phrasingSetId: Uuid,
  text: string,
  sortKey: string,
  overrides: Record<string, unknown> = {},
): Promise<Phrasing> {
  return await created(
    await send("POST", "/v1/phrasings", {
      ...words(text, sortKey),
      phrasingSetId,
      ...overrides,
    }),
    phrasingSchema,
  );
}

async function revisionsOf(phrasingId: Uuid): Promise<PhrasingRevision[]> {
  return await items(
    await send("GET", `/v1/phrasings/${phrasingId}/revisions`),
    phrasingRevisionSchema,
  );
}

async function onlyPhrasing(setId: Uuid): Promise<Phrasing> {
  const found = await items(
    await send("GET", `/v1/phrasings?phrasingSetId=${setId}`),
    phrasingSchema,
  );
  expect(found).toHaveLength(1);
  return found[0] as Phrasing;
}

describe("phrasing sets", () => {
  it("arrive holding their first wording, which becomes the canonical one", async () => {
    const set = await addSet("Led the migration");

    const phrasing = await onlyPhrasing(set.id);
    expect(set.canonicalPhrasingId).toBe(phrasing.id);
    expect((await revisionsOf(phrasing.id)).map((r) => r.plainText)).toEqual(["Led the migration"]);
  });

  it("promote a different wording by pointing at it", async () => {
    const set = await addSet("Led the migration");
    const shorter = await addPhrasing(set.id, "Led a migration", "a1", { variant: "short" });

    const updated = await send("PATCH", `/v1/phrasing-sets/${set.id}`, {
      expectedUpdatedAt: set.updatedAt,
      patch: { canonicalPhrasingId: shorter.id },
    });
    expect(phrasingSetSchema.parse(await updated.json()).canonicalPhrasingId).toBe(shorter.id);
  });

  it("hold every wording of one thing, in sort-key order", async () => {
    const set = await addSet("Led the migration");
    await addPhrasing(set.id, "Led a migration", "a1", { variant: "short" });
    await addPhrasing(set.id, "Led the platform migration end to end", "a2", { variant: "long" });

    const all = await items(
      await send("GET", `/v1/phrasings?phrasingSetId=${set.id}`),
      phrasingSchema,
    );
    expect(all.map((phrasing) => phrasing.variant)).toEqual(["standard", "short", "long"]);
  });
});

describe("phrasing text is append-only", () => {
  // A version pinned in March must not silently acquire June's wording.
  it("keeps the superseded wording and moves the pointer", async () => {
    const set = await addSet("Led the migration");
    const phrasing = await onlyPhrasing(set.id);

    const appended = await created(
      await send("POST", `/v1/phrasings/${phrasing.id}/revisions`, {
        body: [{ t: "text", v: "Led the platform migration" }],
      }),
      phrasingRevisionSchema,
    );

    const history = await revisionsOf(phrasing.id);
    expect(history.map((r) => r.plainText)).toEqual([
      "Led the migration",
      "Led the platform migration",
    ]);

    const after = phrasingSchema.parse(
      await (await send("GET", `/v1/phrasings/${phrasing.id}`)).json(),
    );
    expect(after.currentRevisionId).toBe(appended.id);
  });

  // Two people appending different wordings at once must both keep their text.
  it("carries no concurrency token", async () => {
    const set = await addSet("Led the migration");
    const phrasing = await onlyPhrasing(set.id);

    await send("POST", `/v1/phrasings/${phrasing.id}/revisions`, {
      body: [{ t: "text", v: "first" }],
    });
    const second = await send("POST", `/v1/phrasings/${phrasing.id}/revisions`, {
      body: [{ t: "text", v: "second" }],
    });

    expect(second.status).toBe(201);
    expect(await revisionsOf(phrasing.id)).toHaveLength(3);
  });

  it("returns the revision that already says it rather than storing it twice", async () => {
    const set = await addSet("Led the migration");
    const phrasing = await onlyPhrasing(set.id);

    const again = await created(
      await send("POST", `/v1/phrasings/${phrasing.id}/revisions`, {
        body: [{ t: "text", v: "Led the migration" }],
      }),
      phrasingRevisionSchema,
    );

    const history = await revisionsOf(phrasing.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(again.id);
  });

  // The route shape is what makes the rule structural: there is no field a
  // patch could carry the text in.
  it("has no way to change text through a patch", async () => {
    const set = await addSet("Led the migration");
    const phrasing = await onlyPhrasing(set.id);

    const updated = await send("PATCH", `/v1/phrasings/${phrasing.id}`, {
      expectedUpdatedAt: phrasing.updatedAt,
      patch: { label: "the short one", body: [{ t: "text", v: "smuggled" }] },
    });

    // The patch has to have been applied, or this passes for the wrong reason:
    // a rejected patch leaves the text alone too.
    expect(phrasingSchema.parse(await updated.json()).label).toBe("the short one");
    expect((await revisionsOf(phrasing.id)).map((r) => r.plainText)).toEqual(["Led the migration"]);
  });

  it("refuses rich text that is not rich text", async () => {
    const set = await addSet("Led the migration");
    const phrasing = await onlyPhrasing(set.id);

    const problem = await problemOf(
      await send("POST", `/v1/phrasings/${phrasing.id}/revisions`, { body: "just a string" }),
    );
    expect(problem.status).toBe(422);
  });

  // An empty history would read as "this phrasing has never said anything",
  // which is not a state any phrasing can be in.
  it("answers an unknown phrasing rather than an empty history", async () => {
    const problem = await problemOf(await send("GET", `/v1/phrasings/${newUuid()}/revisions`));
    expect(problem.status).toBe(404);
  });

  it("answers an unknown phrasing rather than appending nowhere", async () => {
    const problem = await problemOf(
      await send("POST", `/v1/phrasings/${newUuid()}/revisions`, {
        body: [{ t: "text", v: "orphan" }],
      }),
    );
    expect(problem.status).toBe(404);
  });
});
