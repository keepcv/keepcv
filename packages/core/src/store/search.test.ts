import { describe, expect, it } from "vitest";
import { search } from "./search.js";
import {
  anOrganisation,
  aPhrasingSet,
  aPoint,
  aRecord,
  aTag,
  EPOCH,
  emptyStore,
} from "./store.harness.js";

describe("searching the store", () => {
  it("finds a record by its title", () => {
    const store = emptyStore();
    const engine = aRecord({ title: "Engine rewrite" });
    store.records.push(engine, aRecord({ title: "Something else" }));

    expect(search(store, "engine")).toEqual([{ subject: "record", id: engine.id, score: 3 }]);
  });

  // Search-as-you-type is the whole reason a trigram index was in the plan: a
  // query has to match while it is still being typed.
  it("matches a prefix, not only a whole word", () => {
    const store = emptyStore();
    const postgres = aRecord({ title: "PostgreSQL" });
    store.records.push(postgres);

    expect(search(store, "postg").map((hit) => hit.id)).toEqual([postgres.id]);
    expect(search(store, "postgresql").map((hit) => hit.id)).toEqual([postgres.id]);
    // The other direction is not a prefix, so it is not a match.
    expect(search(store, "postgresqlx")).toEqual([]);
  });

  it("finds a point by the words it says", () => {
    const store = emptyStore();
    const point = aPoint(store, "Cut p95 latency from 800ms to 120ms");

    expect(search(store, "latency").map((hit) => hit.subject)).toEqual(["point"]);
    expect(search(store, "latency")[0]?.id).toBe(point.id);
  });

  it("finds a record through its organisation and its tags", () => {
    const store = emptyStore();
    const org = anOrganisation("Analytical Engines");
    store.organisations.push(org);
    const role = aRecord({ title: "Staff engineer", organisationId: org.id });
    store.records.push(role);
    const tag = aTag(store, "Distributed Systems");
    store.recordTags.push({ tagId: tag.id, recordId: role.id });

    expect(search(store, "analytical").map((hit) => hit.id)).toEqual([role.id]);
    expect(search(store, "distributed").map((hit) => hit.id)).toEqual([role.id]);
  });

  // Two words narrows. A search box where adding a word widens the result is
  // one nobody can use to find anything.
  it("requires every term to land somewhere", () => {
    const store = emptyStore();
    const org = anOrganisation("Analytical Engines");
    store.organisations.push(org);
    const role = aRecord({ title: "Staff engineer", organisationId: org.id });
    store.records.push(role, aRecord({ title: "Staff writer" }));

    expect(search(store, "staff analytical").map((hit) => hit.id)).toEqual([role.id]);
    expect(search(store, "staff missing")).toEqual([]);
  });

  it("ranks a title match above one in the detail", () => {
    const store = emptyStore();
    const named = aRecord({ title: "Kafka" });
    const mentioned = aRecord({ title: "Ingest pipeline", location: "Kafka House" });
    store.records.push(mentioned, named);

    const hits = search(store, "kafka");
    expect(hits.map((hit) => hit.id)).toEqual([named.id, mentioned.id]);
    // Strictly, not by the tie-break: two rows scoring the same would come back
    // in id order, which is the same assertion passing for the wrong reason.
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 0);
  });

  it("leaves archived rows out unless they are asked for", () => {
    const store = emptyStore();
    const shelved = aRecord({ title: "Engine rewrite", archivedAt: EPOCH });
    store.records.push(shelved);

    expect(search(store, "engine")).toEqual([]);
    expect(search(store, "engine", { includeArchived: true }).map((hit) => hit.id)).toEqual([
      shelved.id,
    ]);
  });

  it("narrows to one tag when asked", () => {
    const store = emptyStore();
    const tagged = aRecord({ title: "Engine rewrite" });
    const untagged = aRecord({ title: "Engine retirement" });
    store.records.push(tagged, untagged);
    const tag = aTag(store, "Platform");
    store.recordTags.push({ tagId: tag.id, recordId: tagged.id });

    expect(search(store, "engine")).toHaveLength(2);
    expect(search(store, "engine", { tagId: tag.id }).map((hit) => hit.id)).toEqual([tagged.id]);
  });

  it("searches a record's summary as well as its title", () => {
    const store = emptyStore();
    const role = aRecord({
      title: "Staff engineer",
      summarySetId: null,
    });
    role.summarySetId = aPhrasingSet(store, "record_summary", "Ran the platform team");
    store.records.push(role);

    expect(search(store, "platform").map((hit) => hit.id)).toEqual([role.id]);
  });

  // The mark has to be in the middle: a trailing one falls off the token
  // anyway.
  it("folds accents and case, so a plain query finds an accented word", () => {
    const store = emptyStore();
    const crepe = aRecord({ title: "Cr\u00eape rebuild" });
    store.records.push(crepe);

    expect(search(store, "crepe").map((hit) => hit.id)).toEqual([crepe.id]);
    expect(search(store, "CREPE").map((hit) => hit.id)).toEqual([crepe.id]);
  });

  it("answers with nothing for a query of no words at all", () => {
    const store = emptyStore();
    store.records.push(aRecord({ title: "Engine rewrite" }));

    expect(search(store, "")).toEqual([]);
    expect(search(store, "   ")).toEqual([]);
  });

  // Two searches of unchanged data give one list, so the rows do not reshuffle
  // under the cursor - the property every list in this store holds.
  it("returns a total order, records before points at equal score", () => {
    const store = emptyStore();
    const record = aRecord({ title: "Latency" });
    store.records.push(record);
    const point = aPoint(store, "Latency");

    const hits = search(store, "latency");
    expect(hits.map((hit) => hit.subject)).toEqual(["record", "point"]);
    expect(hits).toEqual(search(store, "latency"));
    expect(hits.map((hit) => hit.id)).toEqual([record.id, point.id]);
  });
});
