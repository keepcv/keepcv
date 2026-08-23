import type {
  CareerRecordKind,
  ContactChannelKind,
  Intake,
  IntakeContactChannel,
  IntakeOrganisation,
  IntakePoint,
  IntakeRecord,
  IntakeSource,
} from "@keepcv/schema";
import { type ReadPeriod, readPeriod } from "./dates.js";
import { type DocumentLine, looksLikeHeading, looksListed, withoutBullet } from "./lines.js";

// What a heading has to say for a section to be filed as a kind. Everything
// else becomes a custom section under the heading that was printed, which is
// how a resume keeps a list this store has no kind for.
const KIND_OF_HEADING: [RegExp, CareerRecordKind][] = [
  [/^(work|professional|employment|career)?\s*(experience|history)$/, "experience"],
  [/^(experience|employment|work)$/, "experience"],
  [/^education$/, "education"],
  [/^(technical\s+)?skills$/, "skill"],
  [/^(projects|selected projects|personal projects)$/, "project"],
  [/^(certifications?|licen[cs]es?|licen[cs]es and certifications?)$/, "certification"],
  [/^(publications?|papers)$/, "publication"],
  [/^(awards?|honou?rs|awards and honou?rs)$/, "award"],
  [/^languages$/, "language"],
  [/^(volunteering|volunteer( experience| work)?|community)$/, "volunteering"],
  [/^(talks|speaking|presentations|conference talks)$/, "speaking"],
];

function kindOf(heading: string): CareerRecordKind | undefined {
  const folded = heading.trim().toLowerCase().replace(/\s+/g, " ");
  return KIND_OF_HEADING.find(([pattern]) => pattern.test(folded))?.[1];
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;

// A scheme, or a bare host with a top-level domain a resume actually prints.
// Anything looser matches the "Ltd." at the end of an employer's name.
const URL =
  /\b(?:https?:\/\/|www\.)?[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|me|co|ai|app|edu|gov|xyz)(?:\.[a-z]{2})?(?:\/[^\s,;|]*)?/i;

const SERVICE: [RegExp, ContactChannelKind][] = [
  [/linkedin\.com/i, "linkedin"],
  [/github\.com/i, "github"],
  [/scholar\.google\./i, "scholar"],
  [/orcid\.org/i, "orcid"],
];

function channelsIn(text: string): IntakeContactChannel[] {
  const found: IntakeContactChannel[] = [];
  const email = EMAIL.exec(text)?.[0];
  if (email !== undefined) found.push({ kind: "email", label: null, value: email });

  const phone = PHONE.exec(text.replace(EMAIL, ""))?.[0]?.trim();
  if (phone !== undefined && phone.replace(/\D/g, "").length >= 8) {
    found.push({ kind: "phone", label: null, value: phone });
  }

  // The email is taken out first: its domain is a host, and matching it would
  // file the same address twice under two kinds.
  const url = URL.exec(text.replace(EMAIL, ""))?.[0];
  if (url !== undefined) {
    const kind = SERVICE.find(([pattern]) => pattern.test(url))?.[1] ?? "website";
    found.push({ kind, label: null, value: url });
  }
  return found;
}

interface Section {
  heading: string;
  kind: CareerRecordKind | undefined;
  lines: DocumentLine[];
}

// Everything before the first heading is the person, not a section.
function split(lines: readonly DocumentLine[]): { header: DocumentLine[]; sections: Section[] } {
  const header: DocumentLine[] = [];
  const sections: Section[] = [];

  for (const line of lines) {
    const isHeading = line.emphasis === "heading" || looksLikeHeading(line.text);
    if (isHeading && !line.listed) {
      sections.push({ heading: line.text.trim(), kind: kindOf(line.text), lines: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current === undefined) header.push(line);
    else current.lines.push(line);
  }

  return { header, sections };
}

// The separators a template sets between a title and where it happened.
const PARTS = /(?:\s*[,|\u2022]\s+|\s+[-\u2013\u2014]\s+|\s+at\s+)/;

interface Head {
  title: string | null;
  organisationName: string | null;
  period: ReadPeriod | undefined;
  location: string | null;
}

// A heading line is a handful of parts in an order nobody agrees on, so each is
// identified by what it is rather than where it sat.
function readHead(text: string): Head {
  const parts = text
    .split(PARTS)
    .map((part) => part.trim())
    .filter((part) => part !== "");

  let period: ReadPeriod | undefined;
  const rest: string[] = [];
  for (const part of parts) {
    const read = readPeriod(part);
    if (read !== undefined && period === undefined) period = read;
    else rest.push(part);
  }

  return {
    title: rest[0] ?? null,
    organisationName: rest[1] ?? null,
    location: rest[2] ?? null,
    period,
  };
}

const NOTHING: ReadPeriod = { startedOn: null, endedOn: null, isCurrent: false };

function entryOf(
  section: Section,
  head: Head,
  points: IntakePoint[],
  summary: string | null,
): IntakeRecord {
  const common = {
    title: head.title,
    subtitle: null,
    organisationName: head.organisationName,
    location: head.location,
    summary,
    points,
    links: [],
    tags: [],
    ...(head.period ?? NOTHING),
  };

  switch (section.kind) {
    case "experience":
      return { ...common, kind: "experience", employmentType: null, mode: null };
    case "education":
      return {
        ...common,
        kind: "education",
        grade: null,
        gradeScale: null,
        thesisTitle: null,
        honours: null,
      };
    case "skill":
      return { ...common, kind: "skill", category: null, proficiency: null };
    case "certification":
      return { ...common, kind: "certification", credentialId: null, expiresOn: null };
    case "publication":
      return { ...common, kind: "publication", doi: null };
    case "language":
      return { ...common, kind: "language", proficiency: null };
    case "project":
      return { ...common, kind: "project" };
    case "award":
      return { ...common, kind: "award" };
    case "volunteering":
      return { ...common, kind: "volunteering" };
    case "speaking":
      return { ...common, kind: "speaking" };
    // A heading this store files under no kind of its own, which is what a
    // custom section is for.
    case "custom_entry":
    case undefined:
      return { ...common, kind: "custom_entry", sectionHeading: section.heading };
  }
}

// A skill or a language section is a list of names, not a list of entries with
// bullets under them, so every line is its own record.
const ONE_PER_LINE = new Set<CareerRecordKind>(["skill", "language"]);

function listedRecords(section: Section): IntakeRecord[] {
  return section.lines
    .flatMap((line) => withoutBullet(line.text).split(/\s*[,;|]\s*/))
    .map((name) => name.trim())
    .filter((name) => name !== "")
    .map((name) => entryOf(section, { ...readHead(name), title: name }, [], null));
}

type Step =
  | { as: "nothing" }
  | { as: "point"; text: string }
  | { as: "period"; period: ReadPeriod }
  | { as: "head"; text: string }
  | { as: "summary"; text: string };

// What one line is, given whether an entry is open above it. A period on a line
// of its own belongs to the entry above rather than starting a new one.
function stepFor(line: DocumentLine, open: boolean): Step {
  const text = line.text.trim();
  if (text === "") return { as: "nothing" };
  if (line.listed || looksListed(text)) return { as: "point", text: withoutBullet(text) };

  const alone = readPeriod(text);
  if (alone !== undefined && open) return { as: "period", period: alone };
  if (line.emphasis === "strong" || !open) return { as: "head", text };
  return { as: "summary", text };
}

function recordsIn(section: Section): IntakeRecord[] {
  if (section.kind !== undefined && ONE_PER_LINE.has(section.kind)) return listedRecords(section);

  const records: IntakeRecord[] = [];
  let head: Head | undefined;
  let points: IntakePoint[] = [];
  let summary: string | null = null;

  const close = () => {
    if (head !== undefined) records.push(entryOf(section, head, points, summary));
    points = [];
    summary = null;
  };

  for (const line of section.lines) {
    const step = stepFor(line, head !== undefined);
    if (step.as === "point") points.push({ text: step.text, occurredOn: null });
    else if (step.as === "period" && head !== undefined) {
      head = { ...head, period: head.period ?? step.period };
    } else if (step.as === "head") {
      close();
      head = readHead(step.text);
    } else if (step.as === "summary") {
      summary = summary === null ? step.text : `${summary} ${step.text}`;
    }
  }

  close();
  return records;
}

function organisationsOf(records: readonly IntakeRecord[]): IntakeOrganisation[] {
  const byName = new Map<string, IntakeOrganisation>();
  for (const record of records) {
    const name = record.organisationName;
    if (name === null) continue;
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, {
        name,
        kind: record.kind === "education" ? "institution" : "company",
        website: null,
        location: null,
      });
    }
  }
  return [...byName.values()];
}

// The biggest thing at the top with no digits in it. A name is the one field a
// resume never labels, so it is found by where it sits.
function nameIn(header: readonly DocumentLine[]): string | null {
  const candidate = header.find(
    (line) =>
      line.text.trim() !== "" &&
      !EMAIL.test(line.text) &&
      !URL.test(line.text) &&
      !/\d/.test(line.text) &&
      line.text.trim().length < 60,
  );
  return candidate?.text.trim() ?? null;
}

// Structure worked out from how the file looked, never from what it said it
// was. Everything here is reviewed field by field before it is written, which
// is what makes a reader this shallow acceptable.
export function fromLines(lines: readonly DocumentLine[], source: IntakeSource): Intake {
  const { header, sections } = split(lines);
  const records = sections.flatMap(recordsIn);
  const headerText = header.map((line) => line.text).join("  ");
  const fullName = nameIn(header);

  const notes: string[] = [];
  if (sections.length === 0) {
    notes.push(
      "No headings were found, so nothing could be filed. A resume set as one block of text reads as one block of text.",
    );
  }
  for (const section of sections) {
    if (section.kind === undefined) {
      notes.push(
        `"${section.heading}" is not a heading this store files, so it arrives as a section of its own.`,
      );
    }
  }

  return {
    source,
    fidelity: "inferred",
    identity: {
      fullName,
      // A headline and a location are not separable from the contact line
      // without guessing, and a wrong name in the resume header is worse than
      // an empty one.
      headline: null,
      location: null,
      pronouns: null,
      summary: null,
    },
    contactChannels: channelsIn(headerText),
    organisations: organisationsOf(records),
    records,
    notes,
  };
}
