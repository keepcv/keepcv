import type { DocumentEntry, ResumeDocument, RichText } from "@keepcv/schema";

export interface Loss {
  what: string;
  count: number;
  detail: string;
}

// Every format a resume leaves as that is not this product's own. HTML is not
// one of them: that file is the resume, so there is nothing to count it
// against.
export const EXPORT_TARGETS = ["jsonresume", "latex", "typst", "docx"] as const;
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

const entriesOf = (document: ResumeDocument): DocumentEntry[] =>
  document.sections.flatMap((section) => section.entries);

// A text node has no children, so a mark anywhere means a mark at the top.
const hasMarks = (text: RichText | undefined): boolean =>
  text?.some((node) => node.t !== "text") ?? false;

// What the format has a list for. A section of any other kind has nowhere to
// go.
const KEPT_KINDS = new Set([
  "experience",
  "volunteering",
  "education",
  "award",
  "certification",
  "publication",
  "skill",
  "language",
  "project",
]);

// What the reader will call each list, whatever the resume called it.
const RENAMED_TO: Record<string, string> = {
  experience: "work",
  volunteering: "volunteer",
  education: "education",
  award: "awards",
  certification: "certificates",
  publication: "publications",
  skill: "skills",
  language: "languages",
  project: "projects",
};

// Counted against what the resume prints rather than against what the format
// could hold: these three carry every mark, every metric and every field, and
// what they do not carry is the design, because the file lays itself out.
const NAMED_BY: Record<string, string> = {
  inline: "run together on one line",
  grouped: "stacked under one employer",
};

function typesetLoss(document: ResumeDocument): Loss[] {
  const laidOut = document.sections.filter((section) => section.layout !== "entries");
  const kinds = [...new Set(laidOut.map((section) => NAMED_BY[section.layout] ?? section.layout))];

  return [
    {
      what: "The design you chose",
      count: document.meta.templateId === undefined ? 0 : 1,
      detail: `${document.meta.templateName ?? "The template"} is not carried: the file sets itself, and editing it is the point of asking for one.`,
    },
    {
      what: "Section layouts",
      count: laidOut.length,
      detail: `${kinds.join(" and ")} - every section is written as a list of entries, so that hint is not applied.`,
    },
  ].filter((loss) => loss.count > 0);
}

function jsonResumeLoss(document: ResumeDocument): Loss[] {
  const entries = entriesOf(document);
  const dropped = document.sections.filter((section) => !KEPT_KINDS.has(section.kind));
  const renamed = document.sections.filter((section) => {
    const called = RENAMED_TO[section.kind];
    return called !== undefined && section.heading.toLowerCase() !== called;
  });

  const found: Loss[] = [
    {
      what: "Sections with nowhere to go",
      count: dropped.reduce((total, section) => total + section.entries.length, 0),
      detail: `${dropped.map((section) => section.heading).join(", ")} - the format has a fixed set of lists and none of them is this.`,
    },
    {
      what: "Metrics",
      count: entries.reduce(
        (total, entry) => total + entry.points.reduce((n, point) => n + point.metrics.length, 0),
        0,
      ),
      detail:
        "A highlight is one string there, so a number attached to a point has nowhere to sit.",
    },
    {
      what: "Headings you chose",
      count: renamed.length,
      detail: `${renamed.map((section) => section.heading).join(", ")} - the reader names the lists, so these arrive renamed.`,
    },
    {
      what: "Emphasis",
      count:
        entries.filter((entry) => hasMarks(entry.summary)).length +
        entries.reduce((n, entry) => n + entry.points.filter((p) => hasMarks(p.text)).length, 0) +
        (hasMarks(document.header.summary) ? 1 : 0),
      detail: "Everything travels as plain text, so bold, italic and links inside a line are lost.",
    },
    {
      what: "Extra links and fields",
      count: entries.reduce(
        (total, entry) => total + Math.max(entry.links.length - 1, 0) + entry.fields.length,
        0,
      ),
      detail: "One URL per entry is all the format holds, and it carries no named values at all.",
    },
    {
      what: "Tags",
      count: entries.filter(
        (entry) => entry.tags.length > 0 && entry.kind !== "skill" && entry.kind !== "project",
      ).length,
      detail: "Keywords exist only on skills and projects, so tags anywhere else are dropped.",
    },
    {
      what: "Locations",
      count: entries.filter((entry) => entry.location !== undefined && entry.kind !== "experience")
        .length,
      detail: "Only the work list has somewhere to put one, so a location anywhere else is lost.",
    },
    {
      what: "Pronouns",
      count: document.header.pronouns === undefined ? 0 : 1,
      detail: "The format has no field for them.",
    },
    {
      what: "The template and its settings",
      count: document.meta.templateId === undefined ? 0 : 1,
      detail: "JSON Resume describes content; how it looks is the reader's to decide.",
    },
  ];

  return found.filter((loss) => loss.count > 0);
}

export function lossOf(document: ResumeDocument, target: ExportTarget): Loss[] {
  return target === "jsonresume" ? jsonResumeLoss(document) : typesetLoss(document);
}
