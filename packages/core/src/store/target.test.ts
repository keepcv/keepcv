import type { Store, Uuid } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { newUuid } from "../identity/uuid.js";
import {
  anEntry,
  anEntryPoint,
  anOrganisation,
  aPoint,
  aRecord,
  aResume,
  aSection,
  aTag,
  emptyStore,
} from "./store.harness.js";
import { targetMatch } from "./target.js";

function aTargetedResume(
  store: Store,
  posting: { jd?: string; role?: string; title?: string; organisationId?: Uuid },
) {
  const record = aRecord({
    title: posting.title ?? "Ledger rewrite",
    organisationId: posting.organisationId ?? null,
  });
  store.records.push(record);

  const resume = aResume(store, "Backend, Acme", {
    targetRole: posting.role ?? null,
    targetJdText: posting.jd ?? null,
  });
  const section = aSection(store, resume.id, "project");
  return { resume, record, entry: anEntry(store, section, record.id) };
}

const termsOf = (store: Store, resumeId: Uuid) =>
  targetMatch(store, resumeId)?.terms.map((term) => term.term);

describe("what the posting asks for", () => {
  it("names the terms it leans on, the heaviest first", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, {
      jd: "Kubernetes and Terraform. More Kubernetes.",
    });

    expect(termsOf(store, resume.id)).toEqual(["Kubernetes", "Terraform"]);
  });

  // A posting is mostly about itself. Without this the ranking is "experience,
  // team, work" on every job that was ever advertised.
  it("drops what a posting says about itself", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, {
      jd: "Strong experience working in a fast-paced team. Excellent communication required.",
    });

    expect(termsOf(store, resume.id)).toEqual(["communication"]);
  });

  // Listing "Engineer" and "engineers" as two separate asks is what makes the
  // ranking read as noise, and it double-counts what the resume answers.
  it("counts two spellings of one word as one term", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, { jd: "Engineer among engineers. Engineering." });

    expect(targetMatch(store, resume.id)?.terms).toEqual([
      { term: "Engineer", weight: 3, isCovered: false },
    ]);
  });

  it("ignores a bare figure, which is the number in 5+ years", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, { jd: "5+ years of Rust. 3 days in office." });

    expect(termsOf(store, resume.id)).toEqual(["Rust"]);
  });

  // The one thing here that knows this is a career store: a word the user
  // already files work under is technical, not one of the posting's asides.
  it("weights a term the store has a name for above one merely said once", () => {
    const store = emptyStore();
    aTag(store, "Terraform");
    const { resume } = aTargetedResume(store, { jd: "Kubernetes, Kubernetes, and Terraform." });

    expect(termsOf(store, resume.id)).toEqual(["Terraform", "Kubernetes"]);
  });

  it("reads the role when no posting was pasted", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, { role: "Staff Platform Engineer" });

    expect(termsOf(store, resume.id)).toEqual(["Engineer", "Platform", "Staff"]);
  });

  it("answers nothing at all when there is no posting and no role", () => {
    const store = emptyStore();
    const { resume } = aTargetedResume(store, {});

    expect(targetMatch(store, resume.id)).toEqual({ terms: [], points: [] });
  });

  it("answers undefined for a resume the store does not hold", () => {
    expect(targetMatch(emptyStore(), newUuid())).toBeUndefined();
  });
});

describe("what the resume answers", () => {
  it("says which terms nothing placed covers", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Kubernetes and Terraform." });
    anEntryPoint(store, entry, aPoint(store, "Ran Kubernetes in anger", { recordId: record.id }));

    const match = targetMatch(store, resume.id);
    expect(match?.terms.filter((term) => term.isCovered).map((term) => term.term)).toEqual([
      "Kubernetes",
    ]);
    expect(match?.terms.filter((term) => !term.isCovered).map((term) => term.term)).toEqual([
      "Terraform",
    ]);
  });

  it("counts a longer term against the shorter word the resume used", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Platform engineering." });
    anEntryPoint(store, entry, aPoint(store, "Engineer on the platform", { recordId: record.id }));

    expect(targetMatch(store, resume.id)?.terms.every((term) => term.isCovered)).toBe(true);
  });

  // A prefix that runs past an inflection is a coincidence, not a match: this
  // is "data" covering "database".
  it("stops a prefix short of a different word", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Data pipelines." });
    anEntryPoint(store, entry, aPoint(store, "Ran the database", { recordId: record.id }));

    expect(targetMatch(store, resume.id)?.terms.some((term) => term.isCovered)).toBe(false);
  });

  // "go" finding "governance" would call every posting covered.
  it("holds a short term to an exact word", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Go on the backend." });
    anEntryPoint(
      store,
      entry,
      aPoint(store, "Owned governance of the estate", { recordId: record.id }),
    );

    expect(targetMatch(store, resume.id)?.terms).toEqual([
      { term: "backend", weight: 1, isCovered: false },
      { term: "Go", weight: 1, isCovered: false },
    ]);
  });

  it("covers a term through the record an entry prints, not only its points", () => {
    const store = emptyStore();
    const org = anOrganisation("Terraform Labs");
    store.organisations.push(org);
    const { resume } = aTargetedResume(store, {
      jd: "Kubernetes and Terraform.",
      title: "Kubernetes migration",
      organisationId: org.id,
    });

    expect(targetMatch(store, resume.id)?.terms.every((term) => term.isCovered)).toBe(true);
  });

  it("covers a term through a tag rather than the words themselves", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Kubernetes." });
    const point = aPoint(store, "Halved the deploy time", { recordId: record.id });
    const tag = aTag(store, "Kubernetes");
    store.pointTags.push({ tagId: tag.id, pointId: point.id });
    anEntryPoint(store, entry, point);

    expect(targetMatch(store, resume.id)?.terms[0]?.isCovered).toBe(true);
  });

  // A point taken off the page is not evidence of anything, and offering it as
  // the thing to drop would be advice to drop what is already dropped.
  it("ignores a point that is placed but toggled off", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Kubernetes." });
    const point = aPoint(store, "Ran Kubernetes in anger", { recordId: record.id });
    anEntryPoint(store, entry, point, { isVisible: false });

    const match = targetMatch(store, resume.id);
    expect(match?.terms[0]?.isCovered).toBe(false);
    expect(match?.points).toEqual([]);
  });

  // The same rule one and two levels up: a point prints only if everything it
  // sits inside prints too.
  it.each(["section", "entry"])("ignores a point under a %s that is toggled off", (level) => {
    const store = emptyStore();
    const record = aRecord({ title: "Kubernetes migration" });
    store.records.push(record);
    const resume = aResume(store, "Backend, Acme", { targetJdText: "Kubernetes." });
    const section = aSection(store, resume.id, "project", { isVisible: level === "entry" });
    const entry = anEntry(store, section, record.id, { isVisible: level === "section" });
    anEntryPoint(store, entry, aPoint(store, "Ran Kubernetes in anger", { recordId: record.id }));

    const match = targetMatch(store, resume.id);
    expect(match?.terms[0]?.isCovered).toBe(false);
    expect(match?.points).toEqual([]);
  });
});

describe("which placed point to drop", () => {
  it("ranks the weakest first and says what each one answers", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, {
      jd: "Kubernetes and Terraform, plus Kubernetes.",
    });
    const weak = aPoint(store, "Wrote the onboarding guide", { recordId: record.id });
    const strong = aPoint(store, "Ran Kubernetes and Terraform", { recordId: record.id });
    const weakOn = anEntryPoint(store, entry, weak, { sortKey: "a0" });
    const strongOn = anEntryPoint(store, entry, strong, { sortKey: "a1" });

    expect(targetMatch(store, resume.id)?.points).toEqual([
      { pointId: weak.id, entryPointId: weakOn.id, score: 0, matched: [] },
      {
        pointId: strong.id,
        entryPointId: strongOn.id,
        score: 3,
        matched: ["Kubernetes", "Terraform"],
      },
    ]);
  });

  // Ties are common - most points answer nothing - and a ranking that reorders
  // them is one the user cannot follow back to the page.
  it("leaves points that score alike in the order the resume prints them", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, { jd: "Kubernetes." });
    const first = aPoint(store, "Wrote the onboarding guide", { recordId: record.id });
    const second = aPoint(store, "Ran the standup", { recordId: record.id });
    anEntryPoint(store, entry, first, { sortKey: "a0" });
    anEntryPoint(store, entry, second, { sortKey: "a1" });

    expect(targetMatch(store, resume.id)?.points.map((point) => point.pointId)).toEqual([
      first.id,
      second.id,
    ]);
  });

  // Otherwise the ranking cannot tell a point on a job the posting is about
  // from the same words on a job it is not.
  it("credits a point for the record it sits under", () => {
    const store = emptyStore();
    const { resume, record, entry } = aTargetedResume(store, {
      jd: "Kubernetes.",
      title: "Kubernetes migration",
    });
    const point = aPoint(store, "Wrote the onboarding guide", { recordId: record.id });
    anEntryPoint(store, entry, point);

    expect(targetMatch(store, resume.id)?.points[0]?.matched).toEqual(["Kubernetes"]);
  });
});
