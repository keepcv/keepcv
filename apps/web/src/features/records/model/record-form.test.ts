import type { CareerRecordKind } from "@keepcv/schema";
import { CAREER_RECORD_KINDS, careerRecordInputSchema } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { addOrganisation, addRecord, emptyStore } from "../../../store.harness.js";
import {
  blankValues,
  buildPatch,
  buildSubmission,
  differences,
  EXTRA_FIELDS,
  valuesOf,
} from "./record-form.js";

// The columns every kind has, which the form lays out itself.
const SHARED = new Set([
  "id",
  "kind",
  "title",
  "subtitle",
  "organisationId",
  "startedOn",
  "endedOn",
  "isCurrent",
  "location",
  "sortKey",
  "summarySetId",
]);

function columnsOfKind(kind: CareerRecordKind): string[] {
  const member = careerRecordInputSchema.options.find((option) => option.shape.kind.value === kind);
  if (member === undefined) throw new Error(`no input schema for ${kind}`);
  return Object.keys(member.shape)
    .filter((name) => !SHARED.has(name))
    .sort((a, b) => a.localeCompare(b));
}

describe("the record form", () => {
  // Without this, a column added to a kind is storable, exportable and
  // unreachable from the only screen that writes one.
  it.each(CAREER_RECORD_KINDS)("offers every column a %s record carries", (kind) => {
    const offered = EXTRA_FIELDS[kind]
      .map((field) => field.name)
      .sort((a, b) => a.localeCompare(b));

    expect(offered).toEqual(columnsOfKind(kind));
  });

  it("stores a blank field as absent rather than as an empty string", () => {
    const built = buildSubmission(emptyStore(), blankValues("project"));

    expect(built).toHaveProperty("submission");
    if (!("submission" in built)) return;
    expect(built.submission.record.title).toBeNull();
    expect(built.submission.record.organisationId).toBeNull();
  });

  it("names the field a date was refused on", () => {
    const built = buildSubmission(emptyStore(), {
      ...blankValues("experience"),
      startedOn: "April 2019",
    });

    if (!("errors" in built)) throw new Error("should have been refused");
    expect(Object.keys(built.errors)).toEqual(["startedOn"]);
    expect(built.errors["startedOn"]).toContain("YYYY");
  });

  it("adds an organisation the store has not heard of, and reuses one it has", () => {
    const store = emptyStore();
    addOrganisation(store, "Analytical Engines");

    const fresh = buildSubmission(store, {
      ...blankValues("experience"),
      organisation: "Babbage Ltd",
    });
    // Matched by name, so retyping an employer does not make a second one.
    const known = buildSubmission(store, {
      ...blankValues("experience"),
      organisation: "analytical engines",
    });

    if (!("submission" in fresh) || !("submission" in known)) throw new Error("both should build");
    expect(fresh.submission.organisation?.name).toBe("Babbage Ltd");
    expect(fresh.submission.record.organisationId).toBe(fresh.submission.organisation?.id);
    expect(known.submission.organisation).toBeNull();
    expect(known.submission.record.organisationId).toBe(store.organisations[0]?.id);
  });

  // Sending either would clear a summary or reorder a list the form never showed.
  it("patches without touching the summary or the ordering", () => {
    const store = emptyStore();
    const built = buildPatch(store, { ...blankValues("project"), title: "Difference Engine" });

    if (!("patch" in built)) throw new Error("should build");
    expect(built.patch).not.toHaveProperty("summarySetId");
    expect(built.patch).not.toHaveProperty("sortKey");
    expect(built.patch).not.toHaveProperty("id");
    expect(built.patch.title).toBe("Difference Engine");
  });

  it("reads a stored record back into the form it was written in", () => {
    const store = emptyStore();
    const organisationId = addOrganisation(store, "Analytical Engines");
    const record = addRecord(store, {
      kind: "experience",
      title: "Engine lead",
      organisationId,
      startedOn: "2019-04",
      isCurrent: true,
      employmentType: "Full-time",
    });

    expect(valuesOf(store, record)).toMatchObject({
      title: "Engine lead",
      organisation: "Analytical Engines",
      startedOn: "2019-04",
      endedOn: "",
      isCurrent: true,
      extras: { employmentType: "Full-time", mode: "" },
    });
  });

  it("names both sides of a stale write, and stays quiet about what matches", () => {
    const store = emptyStore();
    const stored = addRecord(store, { kind: "experience", title: "Engine lead", location: "Bath" });
    const mine = { ...valuesOf(store, stored), title: "Engine lead, acting" };

    expect(differences(store, mine, stored)).toEqual([
      { label: "Title", mine: "Engine lead, acting", theirs: "Engine lead" },
    ]);
  });
});
