import { renderHtml } from "@keepcv/render";
import type { DocumentContact, DocumentField, ResumeDocument } from "@keepcv/schema";
import { FIXTURE_DOCUMENT, TEMPLATES } from "@keepcv/templates";
import { describe, expect, it } from "vitest";
import { lint } from "./lint.js";
import type { LintFinding, LintRuleId } from "./report.js";
import { tierFor } from "./report.js";

// The shared fixture heads its custom section with a phrase nobody
// standardised, which is a finding in its own right. Every test but the one
// naming it starts from a resume that has been given a heading instead.
const RESUME: ResumeDocument = {
  ...FIXTURE_DOCUMENT,
  sections: FIXTURE_DOCUMENT.sections.map((section) =>
    section.kind === "custom" ? { ...section, heading: "Publications" } : section,
  ),
};

const CLEAN_HTML = renderHtml(RESUME);

const linted = (document: ResumeDocument, html = CLEAN_HTML) => lint({ document, html });

const rules = (findings: readonly LintFinding[]): LintRuleId[] =>
  findings.map((finding) => finding.rule);

function withContacts(contacts: DocumentContact[]): ResumeDocument {
  return { ...RESUME, header: { ...RESUME.header, contacts } };
}

const EMAIL: DocumentContact = {
  key: "c0",
  kind: "email",
  value: "ada@example.org",
  href: "mailto:ada@example.org",
};

function withHeading(heading: string): ResumeDocument {
  const [first, ...rest] = RESUME.sections;
  if (first === undefined) throw new Error("the fixture holds a section");
  return { ...RESUME, sections: [{ ...first, heading }, ...rest] };
}

function withField(field: DocumentField): ResumeDocument {
  const [section, ...others] = RESUME.sections;
  const entry = section?.entries[0];
  if (section === undefined || entry === undefined) throw new Error("the fixture holds an entry");
  return {
    ...RESUME,
    sections: [
      { ...section, entries: [{ ...entry, fields: [field] }, ...section.entries.slice(1)] },
      ...others,
    ],
  };
}

const aDate = (value: string): DocumentField => ({
  key: "f0",
  label: "Awarded",
  value,
  kind: "date",
});

describe("linting a resume the way a machine reads it", () => {
  // A rule firing on any shipped template fires on every resume made with it.
  it.each(TEMPLATES.map((template) => template.id))(
    "finds nothing wrong with the file %s writes",
    (id) => {
      const document = { ...RESUME, meta: { ...RESUME.meta, templateId: id } };
      expect(lint({ document, html: renderHtml(document) })).toEqual({
        tier: "clean",
        findings: [],
      });
    },
  );

  describe("contact details", () => {
    it("refuses a resume with no email address on it", () => {
      const report = linted(withContacts([{ key: "c0", kind: "location", value: "London, UK" }]));

      expect(report.tier).toBe("at-risk");
      expect(rules(report.findings)).toEqual(["contact-extractable"]);
    });

    it("refuses an email address with no @ in it", () => {
      const report = linted(
        withContacts([{ key: "c0", kind: "email", value: "ada at example dot org" }]),
      );

      expect(report.findings[0]?.severity).toBe("blocker");
      expect(report.findings[0]?.where).toBe("ada at example dot org");
    });

    // The failure this guards: a contact whose address is only in the `href`
    // reads perfectly on screen and arrives empty.
    it("names a link whose address is not in the text beside it", () => {
      const report = linted(
        withContacts([
          EMAIL,
          {
            key: "c1",
            kind: "linkedin",
            label: "LinkedIn",
            value: "Profile",
            href: "https://linkedin.com/in/ada",
          },
        ]),
      );

      expect(report.tier).toBe("readable");
      expect(report.findings[0]?.detail).toContain("linkedin.com/in/ada");
    });

    it("accepts an address written out beside its link", () => {
      const report = linted(
        withContacts([
          EMAIL,
          {
            key: "c1",
            kind: "github",
            label: "GitHub",
            value: "github.com/ada",
            href: "https://github.com/ada",
          },
          { key: "c2", kind: "phone", value: "+44 20 7946 0000", href: "tel:+442079460000" },
        ]),
      );

      expect(report.findings).toEqual([]);
    });
  });

  describe("section headings", () => {
    it("accepts a heading a system is built to look for", () => {
      expect(linted(withHeading("Employment History")).findings).toEqual([]);
    });

    it("accepts one carrying punctuation", () => {
      expect(linted(withHeading("Technical Skills:")).findings).toEqual([]);
    });

    it("accepts one written in the singular", () => {
      expect(linted(withHeading("Certification")).findings).toEqual([]);
    });

    it("names a heading nothing will file, and what the section holds", () => {
      const report = linted(withHeading("Things I have shipped"));

      expect(report.tier).toBe("readable");
      expect(report.findings[0]?.where).toBe("Things I have shipped");
      expect(report.findings[0]?.detail).toContain("experience");
    });

    // A custom section is where a user writes their own heading, so it is the
    // one most likely to be a phrase only they use.
    it("reads a custom section's heading like any other", () => {
      const report = lint({ document: FIXTURE_DOCUMENT, html: renderHtml(FIXTURE_DOCUMENT) });

      expect(rules(report.findings)).toEqual(["section-headings"]);
      expect(report.findings[0]?.where).toBe("Selected writing");
    });
  });

  describe("dates", () => {
    it("accepts a date carrying a year", () => {
      expect(linted(withField(aDate("June 2024"))).findings).toEqual([]);
    });

    it("names a date with no year in it", () => {
      const report = linted(withField(aDate("last spring")));

      expect(rules(report.findings)).toEqual(["date-format"]);
      expect(report.findings[0]?.where).toBe("Awarded: last spring");
    });

    it("names a numeric date that reads two ways", () => {
      const report = linted(withField(aDate("03/04/2024")));

      expect(rules(report.findings)).toEqual(["date-format"]);
      expect(report.findings[0]?.detail).toContain("month");
    });

    it("leaves a date alone when the day is past twelve", () => {
      expect(linted(withField(aDate("21/04/2024"))).findings).toEqual([]);
    });

    it("reads only the fields a record said were dates", () => {
      const text: DocumentField = { key: "f0", label: "Cohort", value: "spring", kind: "text" };

      expect(linted(withField(text)).findings).toEqual([]);
    });
  });

  describe("what the template did with it", () => {
    const outputOf = (html: string) => linted(RESUME, `${CLEAN_HTML}${html}`);

    it("refuses two columns", () => {
      const report = outputOf("<style>.side { column-count: 2 }</style>");

      expect(report.tier).toBe("at-risk");
      expect(rules(report.findings)).toEqual(["reading-order"]);
    });

    it("refuses a sidebar placed by coordinate", () => {
      expect(outputOf("<style>.side { position: absolute; left: 0 }</style>").tier).toBe("at-risk");
    });

    it("refuses boxes painted out of order", () => {
      expect(outputOf("<style>.side { order: 2 }</style>").tier).toBe("at-risk");
      expect(outputOf("<style>.side { flex-direction: row-reverse }</style>").tier).toBe("at-risk");
      expect(outputOf("<style>.side { float: left }</style>").tier).toBe("at-risk");
    });

    it("refuses text that is a picture", () => {
      const report = outputOf('<img alt="" src="data:image/png;base64,AA">');

      expect(rules(report.findings)).toEqual(["text-as-image"]);
      expect(report.findings[0]?.severity).toBe("blocker");
    });

    it("warns about a table and a drawn shape rather than refusing them", () => {
      expect(outputOf("<table></table>").tier).toBe("readable");
      expect(outputOf("<svg></svg>").tier).toBe("readable");
    });

    // The shipping template writes `content: "- "` and `content: "  |  "`. A
    // rule firing on those would fire on every resume this product produces.
    it("leaves a bullet and a separator alone but names a generated word", () => {
      expect(outputOf('<style>.a::before { content: "* " }</style>').findings).toEqual([]);
      expect(outputOf('<style>.a::before { content: "Present" }</style>').tier).toBe("readable");
    });
  });

  describe("the tier", () => {
    const finding = (severity: "blocker" | "warning"): LintFinding => ({
      rule: "date-format",
      severity,
      where: "x",
      detail: "y",
    });

    it("is derived from the findings and nothing else", () => {
      expect(tierFor([])).toBe("clean");
      expect(tierFor([finding("warning")])).toBe("readable");
      expect(tierFor([finding("warning"), finding("blocker")])).toBe("at-risk");
    });
  });
});
