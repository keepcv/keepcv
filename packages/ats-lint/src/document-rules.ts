import type { DocumentContact, ResumeDocument } from "@keepcv/schema";
import type { LintIssue, LintRule } from "./report.js";

const digitsOf = (text: string): string => text.replaceAll(/\D+/g, "");

// What has to survive into the visible text. A parser reads the words on the
// page, so an address that exists only in an `href` is an address it never sees.
function linkPayload(href: string): string {
  if (href.startsWith("mailto:")) return href.slice("mailto:".length).toLowerCase();
  return href
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function visibleText(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function losesItsLink(contact: DocumentContact): boolean {
  if (contact.href === undefined || contact.href === "") return false;
  if (contact.href.startsWith("tel:")) {
    const dialled = digitsOf(contact.href);
    const shown = digitsOf(contact.value);
    return shown === "" || !(dialled.endsWith(shown) || shown.endsWith(dialled));
  }
  return !visibleText(contact.value).includes(linkPayload(contact.href));
}

const contactExtractable: LintRule = {
  id: "contact-extractable",
  check: ({ document }) => {
    const issues: LintIssue[] = [];
    const emails = document.header.contacts.filter((contact) => contact.kind === "email");

    if (emails.length === 0) {
      issues.push({
        severity: "blocker",
        where: "Contact details",
        detail:
          "No email address anywhere, so a system that files applications by address has nothing to file this one under.",
      });
    }

    for (const email of emails) {
      if (!email.value.includes("@")) {
        issues.push({
          severity: "blocker",
          where: email.value,
          detail: "Written as an email address but with no @ in it, so it will not be read as one.",
        });
      }
    }

    for (const contact of document.header.contacts) {
      if (losesItsLink(contact)) {
        issues.push({
          severity: "warning",
          where: contact.label ?? contact.value,
          detail: `Only the link says ${linkPayload(contact.href ?? "")}. Text that is extracted from the page loses it, so write the address out.`,
        });
      }
    }

    return issues;
  },
};

// Headings systems are built to look for. Matched after `normalise`, so a
// plural, a capital or a punctuation mark makes no difference.
const RECOGNISED = [
  "summary",
  "professional summary",
  "profile",
  "objective",
  "about",
  "about me",
  "experience",
  "work experience",
  "professional experience",
  "relevant experience",
  "employment",
  "employment history",
  "work history",
  "career history",
  "education",
  "academic background",
  "skills",
  "technical skills",
  "core skills",
  "key skills",
  "core competencies",
  "projects",
  "personal projects",
  "selected projects",
  "certifications",
  "licenses and certifications",
  "licences and certifications",
  "publications",
  "papers",
  "awards",
  "honors",
  "honours",
  "awards and honors",
  "languages",
  "volunteering",
  "volunteer experience",
  "community involvement",
  "speaking",
  "talks",
  "presentations",
  "conference talks",
  "interests",
  "activities",
  "references",
  "professional development",
  "training",
  "courses",
];

function normalise(heading: string): string {
  return heading
    .toLowerCase()
    .replaceAll(/[^a-z\s]+/g, " ")
    .trim()
    .replaceAll(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

const KNOWN = new Set(RECOGNISED.map(normalise));

const SUGGESTED: Record<string, string> = {
  experience: "Experience",
  education: "Education",
  project: "Projects",
  skill: "Skills",
  certification: "Certifications",
  publication: "Publications",
  award: "Awards",
  language: "Languages",
  volunteering: "Volunteering",
  speaking: "Speaking",
};

const sectionHeadings: LintRule = {
  id: "section-headings",
  check: ({ document }) =>
    document.sections
      .filter((section) => !KNOWN.has(normalise(section.heading)))
      .map((section) => {
        const instead = SUGGESTED[section.kind];
        return {
          severity: "warning" as const,
          where: section.heading,
          detail:
            instead === undefined
              ? "Not a heading systems look for, so everything under it is filed as loose text."
              : `Not a heading systems look for, so everything under it is filed as loose text. This section holds ${instead.toLowerCase()}.`,
        };
      }),
};

// Any four consecutive digits: the year is the part every parser wants, and a
// value without one carries no date at all.
const HAS_A_YEAR = /\d{4}/;

// 03/04/2024 is March 4th in the United States and 3 April everywhere else, and
// nothing in the value says which.
const AMBIGUOUS = /\b(0?[1-9]|1[0-2])[/.-](0?[1-9]|1[0-2])[/.-]\d{4}\b/;

function dateIssue(label: string, value: string): LintIssue | undefined {
  if (!HAS_A_YEAR.test(value)) {
    return {
      severity: "warning",
      where: `${label}: ${value}`,
      detail: "Given as a date but with no four-digit year in it, so it will not be read as one.",
    };
  }
  if (AMBIGUOUS.test(value)) {
    return {
      severity: "warning",
      where: `${label}: ${value}`,
      detail:
        "Both numbers could be the month, so this reads as two different dates either side of the Atlantic. Write the month as a word.",
    };
  }
  return undefined;
}

function dateFields(document: ResumeDocument): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const section of document.sections) {
    for (const entry of section.entries) {
      for (const field of entry.fields) {
        if (field.kind !== "date") continue;
        const issue = dateIssue(field.label, field.value);
        if (issue !== undefined) issues.push(issue);
      }
    }
  }
  return issues;
}

const dateFormat: LintRule = {
  id: "date-format",
  check: ({ document }) => dateFields(document),
};

// The two a reader builds a timeline out of. A project or a skill has no dates
// to be missing, and a certification carries its own field.
const DATED_KINDS = new Set(["experience", "education"]);

// A period with no start is one the manifest resolved to a display string alone,
// which is what a reader gets: something to print and nothing to sort by.
const undatedHistory: LintRule = {
  id: "undated-history",
  check: ({ document }) =>
    document.sections
      .filter((section) => DATED_KINDS.has(section.kind))
      .flatMap((section) =>
        section.entries
          .filter((entry) => entry.period?.start === undefined)
          .map((entry) => ({
            severity: "warning" as const,
            where: entry.title ?? section.heading,
            detail:
              "Nothing here says when it was, so a reader that builds a history out of dates has nowhere to put it.",
          })),
      ),
};

export const DOCUMENT_RULES: readonly LintRule[] = [
  contactExtractable,
  sectionHeadings,
  dateFormat,
  undatedHistory,
];
