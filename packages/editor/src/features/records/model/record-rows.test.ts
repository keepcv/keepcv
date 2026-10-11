import { partialDateSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { formatPartialDate } from "../../../lib/partial-date.js";
import {
  addOrganisation,
  addPoint,
  addRecord,
  addTag,
  emptyStore,
} from "../../../store.harness.js";
import { formatPeriod, recordRows, toRecordRow } from "./record-rows.js";

describe("formatting a partial date", () => {
  // A partial date is a precision the user chose, not a full date with the tail
  // unknown. Rendering "2019" as "1 January 2019" invents a claim.
  it("shows exactly the precision it was given", () => {
    expect(formatPartialDate(partialDateSchema.parse("2019"))).toBe("2019");
    expect(formatPartialDate(partialDateSchema.parse("2019-04"))).toBe("Apr 2019");
    expect(formatPartialDate(partialDateSchema.parse("2019-04-07"))).toBe("7 Apr 2019");
  });
});

describe("formatting a period", () => {
  it("reads an ongoing period as Present and an unfinished one as open", () => {
    const store = emptyStore();
    const ongoing = addRecord(store, { startedOn: "2019", isCurrent: true });
    const open = addRecord(store, { startedOn: "2019", endedOn: null, isCurrent: false });
    const closed = addRecord(store, { startedOn: "2019", endedOn: "2021-06" });
    const undated = addRecord(store, {});

    expect(formatPeriod(ongoing)).toBe("2019 - Present");
    expect(formatPeriod(open)).toBe("2019 -");
    expect(formatPeriod(closed)).toBe("2019 - Jun 2021");
    expect(formatPeriod(undated)).toBeNull();
  });
});

describe("a record row", () => {
  it("resolves the organisation's name and counts the points on it", () => {
    const store = emptyStore();
    const engines = addOrganisation(store, "Analytical Engines");
    const role = addRecord(store, { title: "Engine lead", organisationId: engines });
    addPoint(store, "one", { recordId: role.id });
    const elsewhere = addPoint(store, "two");
    store.pointRecordLinks.push({ pointId: elsewhere.id, recordId: role.id });

    const row = toRecordRow(store, role);
    expect(row.organisation).toBe("Analytical Engines");
    // Both the point printing under it and the one merely related to it.
    expect(row.pointCount).toBe(2);
  });

  // A record can be saved half-entered: what is missing is an observation the
  // screen makes, not a constraint that blocked the save.
  it("names an untitled record rather than rendering a blank", () => {
    const store = emptyStore();
    expect(toRecordRow(store, addRecord(store, { title: null })).title).toBe("Untitled");
  });
});

describe("filtering the record list", () => {
  it("excludes archived rows by default and reaches them on request", () => {
    const store = emptyStore();
    addRecord(store, { title: "here" });
    addRecord(store, { title: "put away", archivedAt: "2026-01-01T00:00:00.000Z" });

    expect(recordRows(store, { archived: "exclude" }).map((r) => r.title)).toEqual(["here"]);
    expect(recordRows(store, { archived: "only" }).map((r) => r.title)).toEqual(["put away"]);
    expect(recordRows(store, { archived: "include" })).toHaveLength(2);
  });

  it("narrows to one kind", () => {
    const store = emptyStore();
    addRecord(store, { kind: "experience", title: "a job" });
    addRecord(store, { kind: "project", title: "a project" });

    expect(
      recordRows(store, { kind: "experience", archived: "exclude" }).map((r) => r.title),
    ).toEqual(["a job"]);
  });

  it("narrows to one tag, on top of every other narrowing", () => {
    const store = emptyStore();
    const job = addRecord(store, { kind: "experience", title: "a job" });
    const project = addRecord(store, { kind: "project", title: "a project" });
    addRecord(store, { kind: "experience", title: "untagged" });
    const tag = addTag(store, "Kubernetes");
    store.recordTags.push(
      { tagId: tag.id, recordId: job.id },
      { tagId: tag.id, recordId: project.id },
    );

    const filters = { tagId: tag.id, archived: "exclude" } as const;
    expect(recordRows(store, filters).map((r) => r.title)).toEqual(["a job", "a project"]);
    expect(recordRows(store, { ...filters, kind: "project" }).map((r) => r.title)).toEqual([
      "a project",
    ]);
  });

  // The store returns a total order, so two reads of unchanged data give the
  // same list and it does not reshuffle when a filter changes.
  it("keeps the store's order rather than imposing one", () => {
    const store = emptyStore();
    const titles = ["first", "second", "third"];
    for (const title of titles) addRecord(store, { title });

    expect(recordRows(store, { archived: "exclude" }).map((r) => r.title)).toEqual(titles);
  });
});
