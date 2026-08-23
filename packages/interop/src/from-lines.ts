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

const ALL_URLS = new RegExp(URL.source, "gi");

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

  // Every one of them, and the email taken out first: its domain is a host, so
  // matching it would file the same address twice under two kinds.
  for (const match of text.replace(EMAIL, "").matchAll(ALL_URLS)) {
    const url = match[0];
    const kind = SERVICE.find(([pattern]) => pattern.test(url))?.[1] ?? "website";
    if (!found.some((each) => each.value === url)) found.push({ kind, label: null, value: url });
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

  lines.forEach((line, index) => {
    // The name is the first thing on a resume and is often set in caps, which
    // is otherwise the strongest signal a section heading gives. Nothing opens
    // with a section heading, so the first line is never one.
    const isHeading = index > 0 && (line.emphasis === "heading" || looksLikeHeading(line.text));
    if (isHeading && !line.listed) {
      sections.push({ heading: line.text.trim(), kind: kindOf(line.text), lines: [] });
      return;
    }
    const current = sections.at(-1);
    if (current === undefined) header.push(line);
    else current.lines.push(line);
  });

  return { header, sections };
}

// The separators a template sets between a title and where it happened.
const PARTS = /(?:\s*[,|\u2022]\s+|\s+at\s+)/;

// A dash separates a title from an employer and both ends of a date range, so
// splitting on it first turns "Oct 2025 - Present" into a period and an
// organisation called "Present". Parts that already read as a period are left
// whole and only the rest are split again.
const DASH = /\s+[-\u2013\u2014]\s+/;

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
    .flatMap((part) => (readPeriod(part) === undefined ? part.split(DASH) : [part]))
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

// Two printed lines, one entry:
//
//   Visa                    Oct 2025 - Present
//   Software Engineer       Bengaluru
//
// The employer is named first in this layout, so the line already read becomes
// the organisation and the one under it the title. Without this the second line
// lands in the summary and the entry has no role on it at all.
const looksLikeSecondHalf = (text: string): boolean => text.length <= 60 && !/[.;]/.test(text);

function merged(first: Head, second: Head): Head {
  return {
    organisationName: first.title,
    title: second.title,
    location: second.organisationName ?? second.location,
    period: first.period ?? second.period,
  };
}

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

// "Languages: Java, Python" is one category and two skills, not a skill called
// "Languages: Java". The label before the colon is the category, so it has to
// come off before the line is split.
function listedRecords(section: Section): IntakeRecord[] {
  return section.lines.flatMap((line) => {
    const text = withoutBullet(line.text);
    const labelled = /^([^:]{1,40}):\s*(.+)$/.exec(text);
    const category = labelled?.[1]?.trim() ?? null;

    return (labelled?.[2] ?? text)
      .split(/\s*[,;|]\s*/)
      .map((name) => name.trim())
      .filter((name) => name !== "")
      .map((name) => {
        const record = entryOf(section, { ...readHead(name), title: name }, [], null);
        return record.kind === "skill" ? { ...record, category } : record;
      });
  });
}

type Step =
  | { as: "nothing" }
  | { as: "point"; text: string }
  | { as: "continues"; text: string }
  | { as: "period"; period: ReadPeriod }
  | { as: "head"; text: string }
  | { as: "summary"; text: string };

interface Where {
  open: boolean;
  wrapping: boolean;
  halfOpen: boolean;
  startsSomething: boolean;
}

// A point set across three lines wraps; one that has come to a full stop has
// not. Without this the employer under a finished bullet is read as more of
// that bullet, and a whole job disappears into the one above it.
const finished = (text: string): boolean => /[.!?]\s*$/.test(text);

// A typesetter breaks a word across two lines and leaves the hyphen behind, so
// joining with a space gives "en- forceable". The hyphen goes with it.
const continuing = (held: string, next: string): string =>
  held.endsWith("-") ? `${held.slice(0, -1)}${next}` : `${held} ${next}`;

// A line carrying a date range names an entry, whatever came above it.
const hasPeriodIn = (text: string): boolean =>
  text.split(/\s*[|\u2022]\s+/).some((part) => readPeriod(part.trim()) !== undefined);

// What one line is, given what came above it. A period on a line of its own
// belongs to the entry above rather than starting a new one, and a plain line
// under a bullet is the rest of that bullet: a point set across three lines
// otherwise keeps one line and loses the other two into the summary.
function stepFor(line: DocumentLine, where: Where): Step {
  const text = line.text.trim();
  if (text === "") return { as: "nothing" };
  if (line.listed || looksListed(text)) return { as: "point", text: withoutBullet(text) };

  const alone = readPeriod(text);
  if (alone !== undefined && where.open) return { as: "period", period: alone };
  if (where.wrapping && line.emphasis !== "heading") return { as: "continues", text };
  if (where.startsSomething) return { as: "head", text };
  if (where.halfOpen && looksLikeSecondHalf(text)) return { as: "summary", text };
  if (line.emphasis === "strong" || !where.open) return { as: "head", text };
  return { as: "summary", text };
}

// An entry that has named nowhere and said nothing yet is still half written,
// so the line under it is the rest of its head rather than a summary.
const halfOpen = (head: Head | undefined, points: readonly IntakePoint[]): boolean =>
  head !== undefined && head.organisationName === null && points.length === 0;

interface Building {
  records: IntakeRecord[];
  head: Head | undefined;
  points: IntakePoint[];
  summary: string | null;
}

function close(building: Building, section: Section): void {
  const { head } = building;
  if (head !== undefined) {
    building.records.push(entryOf(section, head, building.points, building.summary));
  }
  building.points = [];
  building.summary = null;
}

function apply(building: Building, step: Step, section: Section): void {
  const { head } = building;
  switch (step.as) {
    case "point":
      building.points.push({ text: step.text, occurredOn: null });
      return;
    case "continues": {
      const last = building.points.at(-1);
      if (last !== undefined) last.text = continuing(last.text, step.text);
      return;
    }
    case "period":
      if (head !== undefined) building.head = { ...head, period: head.period ?? step.period };
      return;
    case "head":
      close(building, section);
      building.head = readHead(step.text);
      return;
    case "summary":
      if (head !== undefined && halfOpen(head, building.points)) {
        building.head = merged(head, readHead(step.text));
        return;
      }
      building.summary = building.summary === null ? step.text : `${building.summary} ${step.text}`;
      return;
    case "nothing":
      return;
  }
}

function recordsIn(section: Section): IntakeRecord[] {
  if (section.kind !== undefined && ONE_PER_LINE.has(section.kind)) return listedRecords(section);

  const building: Building = { records: [], head: undefined, points: [], summary: null };
  let wrapping = false;

  for (const line of section.lines) {
    const step = stepFor(line, {
      open: building.head !== undefined,
      wrapping,
      halfOpen: halfOpen(building.head, building.points),
      // A period on the line means it names when something happened, which a
      // continuation never does.
      startsSomething: readPeriod(line.text.trim()) === undefined && hasPeriodIn(line.text),
    });
    wrapping = (step.as === "point" || step.as === "continues") && !finished(step.text);
    apply(building, step, section);
  }

  close(building, section);
  return building.records;
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
