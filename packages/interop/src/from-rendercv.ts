import { fold } from "@keepcv/core";
import type {
  CareerRecordKind,
  ContactChannelKind,
  Intake,
  IntakeContactChannel,
  IntakeLink,
  IntakePoint,
  IntakeRecord,
} from "@keepcv/schema";
import type { Period } from "./reading.js";
import {
  at,
  channelOfNetwork,
  dateFromText,
  linksOf,
  Notes,
  nothing,
  Organisations,
  pointsOf,
  text,
  undated,
} from "./reading.js";
import type {
  RenderCvCv,
  RenderCvDate,
  RenderCvEntry,
  RenderCvFile,
  RenderCvOneOrMany,
} from "./rendercv.js";

const LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
// A second copy without `g`: `test` on a global regex moves `lastIndex`, so the
// same expression answers differently on every other call.
const HAS_LINK = /\[[^\]]*\]\([^)]*\)/;

// The file marks emphasis and links in the text itself. The words are kept and
// the marks go, because a point is plain text here.
function plain(value: string | undefined, notes: Notes): string | null {
  if (value === undefined) return null;
  if (HAS_LINK.test(value)) {
    notes.add(
      "Links written inside a sentence are not brought across, but the words around them are.",
    );
  }

  return text(
    value
      .replace(LINK, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1"),
  );
}

const listed = (value: RenderCvOneOrMany | undefined): string[] =>
  value === undefined
    ? []
    : (Array.isArray(value) ? value : [value]).flatMap((each) => {
        const found = text(each);
        return found === null ? [] : [found];
      });

const shown = (value: RenderCvDate | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

function channelsOf(cv: RenderCvCv): IntakeContactChannel[] {
  const named: [ContactChannelKind, string[]][] = [
    ["email", listed(cv.email)],
    ["phone", listed(cv.phone)],
    ["website", listed(cv.website)],
  ];

  return [
    ...named.flatMap(([kind, values]) => values.map((value) => ({ kind, label: null, value }))),
    ...(cv.social_networks ?? []).flatMap((social): IntakeContactChannel[] => {
      const value = text(social.username);
      return value === null ? [] : [channelOfNetwork(text(social.network), value)];
    }),
    ...(cv.custom_connections ?? []).flatMap((custom): IntakeContactChannel[] => {
      const value = text(custom.url) ?? text(custom.placeholder);
      return value === null ? [] : [{ kind: "other", label: text(custom.placeholder), value }];
    }),
  ];
}

// What every entry type answers, before anything decides which kind of record
// it is. The heading is the only thing that can decide that for most of them.
interface Read {
  title: string | null;
  subtitle: string | null;
  organisationName: string | null;
  location: string | null;
  period: Period;
  summary: string | null;
  points: IntakePoint[];
  links: IntakeLink[];
  doi: string | null;
}

const blank: Read = {
  title: null,
  subtitle: null,
  organisationName: null,
  location: null,
  period: undated,
  summary: null,
  points: [],
  links: [],
  doi: null,
};

// Explicitly `| undefined` under `exactOptionalPropertyTypes`, because a date
// read as a link is put back as absent rather than left out of the spread.
type Dates = {
  date?: RenderCvDate | undefined;
  start_date?: RenderCvDate | undefined;
  end_date?: RenderCvDate | undefined;
};

// A start date with nothing after it is still going on, and "present" says so
// outright. A lone `date` is one moment, so it is never current.
function periodOf(entry: Dates, about: string, notes: Notes): Period {
  const start = shown(entry.start_date);
  const end = shown(entry.end_date);

  if (start !== undefined || end !== undefined) {
    const startedOn = dateFromText(start, about, notes);
    if (end === undefined || fold(end) === "present") {
      return { startedOn, endedOn: null, isCurrent: startedOn !== null };
    }
    return { startedOn, endedOn: dateFromText(end, about, notes), isCurrent: false };
  }
  return at(dateFromText(shown(entry.date), about, notes));
}

const has = (entry: object, key: string): boolean =>
  Object.hasOwn(entry, key) && (entry as Record<string, unknown>)[key] !== undefined;

const WHOLE_LINK = /^\[([^\]]*)\]\(([^)]+)\)$/;

// The tool's own examples put a repository link in the date slot, so reading
// that as a date drops the link and reports a date nobody wrote.
function linkIn(value: string | undefined): IntakeLink | undefined {
  const found = value === undefined ? null : WHOLE_LINK.exec(value.trim());
  return found === null ? undefined : { kind: "other", label: text(found[1]), url: found[2] ?? "" };
}

interface Fields {
  of: (key: string) => string | undefined;
  strings: (key: string) => string[];
  described: Pick<Read, "location" | "summary" | "points" | "links">;
  dates: Dates;
}

function fieldsOf(entry: object, notes: Notes): Fields {
  const it = entry as Record<string, unknown>;
  const of = (key: string): string | undefined =>
    typeof it[key] === "string" ? it[key] : undefined;
  const strings = (key: string): string[] =>
    Array.isArray(it[key]) ? (it[key] as unknown[]).filter((each) => typeof each === "string") : [];
  const link = linkIn(of("date"));

  return {
    of,
    strings,
    described: {
      location: plain(of("location"), notes),
      summary: plain(of("summary"), notes),
      points: pointsOf(strings("highlights").flatMap((each) => plain(each, notes) ?? [])),
      links: link === undefined ? [] : [link],
    },
    // Cleared only when it held a link: a year is a number here, which `of`
    // does not answer, and blanking it unconditionally empties every one.
    dates: link === undefined ? (entry as Dates) : { ...(entry as Dates), date: undefined },
  };
}

function publicationRead({ of, strings, dates }: Fields, orgs: Organisations, notes: Notes): Read {
  const title = plain(of("title"), notes);
  return {
    ...blank,
    title,
    // Bolded in the file so the person can find their own name in the list.
    subtitle: text(
      strings("authors")
        .map((author) => plain(author, notes) ?? "")
        .join(", "),
    ),
    organisationName: orgs.seen(plain(of("journal"), notes), "publisher"),
    period: at(dateFromText(shown(dates.date), title ?? "a publication", notes)),
    summary: plain(of("summary"), notes),
    links: linksOf(of("url")),
    doi: plain(of("doi"), notes),
  };
}

// The entry type is worked out from which keys are set, which is how the tool
// that writes these files decides too.
function readEntry(entry: RenderCvEntry, orgs: Organisations, notes: Notes): Read {
  if (typeof entry === "string") return { ...blank, title: plain(entry, notes) };

  const fields = fieldsOf(entry, notes);
  const { of, described, dates } = fields;

  if (has(entry, "company") || has(entry, "position")) {
    const title = plain(of("position"), notes);
    return {
      ...blank,
      ...described,
      title,
      organisationName: orgs.seen(plain(of("company"), notes), "company"),
      period: periodOf(dates, title ?? "a job", notes),
    };
  }
  if (has(entry, "institution") || has(entry, "area")) {
    const title = plain(of("degree"), notes);
    return {
      ...blank,
      ...described,
      title,
      subtitle: plain(of("area"), notes),
      organisationName: orgs.seen(plain(of("institution"), notes), "institution"),
      period: periodOf(dates, title ?? "a course", notes),
    };
  }
  if (has(entry, "authors") || has(entry, "journal") || has(entry, "doi")) {
    return publicationRead(fields, orgs, notes);
  }
  if (has(entry, "label")) {
    return { ...blank, title: plain(of("label"), notes), subtitle: plain(of("details"), notes) };
  }
  for (const key of ["bullet", "number", "reversed_number"]) {
    if (has(entry, key)) return { ...blank, title: plain(of(key), notes) };
  }

  const title = plain(of("name"), notes);
  return { ...blank, ...described, title, period: periodOf(dates, title ?? "an entry", notes) };
}

// An entry type that names a company or an institution has already said what
// kind of record it is; nothing else has, so the heading answers for them.
function kindOfEntry(entry: RenderCvEntry): CareerRecordKind | undefined {
  if (typeof entry === "string") return undefined;
  if (has(entry, "company") || has(entry, "position")) return "experience";
  if (has(entry, "institution") || has(entry, "area")) return "education";
  if (has(entry, "authors") || has(entry, "journal") || has(entry, "doi")) return "publication";
  return undefined;
}

// Longest-standing words first: "Research Experience" is experience, and
// "Programming Languages" is a skill rather than a language.
const KIND_BY_HEADING: [RegExp, CareerRecordKind][] = [
  // "work" only at the front of a word, or every "Frameworks" heading is a job.
  [/experien|employ|(^|[^a-z])work|career|profession/, "experience"],
  [/educat|academic|universit|school|degree/, "education"],
  [/project|portfolio/, "project"],
  [/programming|skill|technolog|tool|competen|expertise|stack/, "skill"],
  [/certificat|licen/, "certification"],
  [/publicat|paper|preprint/, "publication"],
  [/award|honor|honour|achievement|scholarship|prize|grant/, "award"],
  [/language/, "language"],
  [/volunteer|communit|outreach|service/, "volunteering"],
  [/talk|speaking|presentation|conference|seminar|workshop/, "speaking"],
];

const kindOfHeading = (heading: string): CareerRecordKind | undefined =>
  KIND_BY_HEADING.find(([pattern]) => pattern.test(fold(heading)))?.[1];

// A one-line entry is a labelled fact - "Languages: English, Spanish" - with no
// employer and no period. The tool's own example heads a list of them
// "additional experience and awards", and filing those as jobs puts a teaching
// note in the work history.
const NEEDS_MORE_THAN_A_LABEL = new Set<CareerRecordKind>([
  "experience",
  "education",
  "volunteering",
]);

function kindFor(
  entry: RenderCvEntry,
  fromHeading: CareerRecordKind | undefined,
): CareerRecordKind {
  const said = kindOfEntry(entry);
  if (said !== undefined) return said;

  const guess = fromHeading ?? "custom_entry";
  const labelled = typeof entry !== "string" && has(entry, "label");
  return labelled && NEEDS_MORE_THAN_A_LABEL.has(guess) ? "custom_entry" : guess;
}

function recordOf(read: Read, kind: CareerRecordKind, heading: string): IntakeRecord {
  const base = {
    ...nothing,
    title: read.title,
    subtitle: read.subtitle,
    organisationName: read.organisationName,
    location: read.location,
    summary: read.summary,
    points: read.points,
    links: read.links,
    ...read.period,
  };

  switch (kind) {
    case "experience":
      return { ...base, kind, employmentType: null, mode: null };
    case "education":
      return { ...base, kind, grade: null, gradeScale: null, thesisTitle: null, honours: null };
    case "skill":
      return { ...base, kind, category: null, proficiency: null };
    case "certification":
      return { ...base, kind, credentialId: null, expiresOn: null };
    case "publication":
      return { ...base, kind, doi: read.doi };
    // A one-line entry under this heading is "English: Native", so the details
    // are the fluency rather than a second line of the title.
    case "language":
      return { ...base, kind, subtitle: null, proficiency: read.subtitle };
    case "custom_entry":
      return { ...base, kind, sectionHeading: heading };
    case "project":
    case "award":
    case "volunteering":
    case "speaking":
      return { ...base, kind };
  }
}

// A heading nothing matches is not a failure: it becomes a section of its own,
// which keeps the word the user chose instead of filing under a near miss.
export function fromRenderCv(file: RenderCvFile): Intake {
  const cv = file.cv ?? {};
  const orgs = new Organisations();
  const notes = new Notes();

  if (text(cv.photo) !== null) {
    notes.add(
      "The photo is not brought across; a resume this store compiles has no field for one.",
    );
  }

  const records = Object.entries(cv.sections ?? {}).flatMap(([heading, entries]) => {
    const fromHeading = kindOfHeading(heading);
    return (entries ?? []).flatMap((entry) => {
      const read = readEntry(entry, orgs, notes);
      if (read.title === null && read.summary === null && read.points.length === 0) return [];
      return [recordOf(read, kindFor(entry, fromHeading), heading)];
    });
  });

  return {
    source: "rendercv",
    fidelity: "declared",
    identity: {
      fullName: text(cv.name),
      headline: text(cv.headline),
      location: text(cv.location),
      // The format has no field for them, so nothing here could fill this in.
      pronouns: null,
      summary: null,
    },
    contactChannels: channelsOf(cv),
    organisations: orgs.all(),
    records,
    notes: notes.all(),
  };
}
