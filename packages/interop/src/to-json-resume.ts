import { projectPlainText } from "@keepcv/core";
import type {
  DocumentContact,
  DocumentEntry,
  DocumentSection,
  ResumeDocument,
  RichText,
} from "@keepcv/schema";
import type {
  JsonResume,
  JsonResumeBasics,
  JsonResumeProfile,
  JsonResumeWork,
} from "./json-resume.js";
import { JSON_RESUME_SCHEMA } from "./json-resume.js";

const said = (text: RichText | undefined): string | undefined => {
  if (text === undefined) return undefined;
  const plain = projectPlainText(text).trim();
  return plain === "" ? undefined : plain;
};

const highlights = (entry: DocumentEntry): string[] =>
  entry.points.map((point) => point.plainText.trim()).filter((text) => text !== "");

// `period.start` and `period.end` are the partial dates the record holds, and
// `YYYY`, `YYYY-MM` and `YYYY-MM-DD` are all ISO 8601, which is what JSON Resume
// asks for. `display` is ours and never travels.
const dates = (entry: DocumentEntry) => ({
  ...(entry.period?.start === undefined ? {} : { startDate: entry.period.start }),
  ...(entry.period?.end === undefined ? {} : { endDate: entry.period.end }),
});

const entriesOf = (document: ResumeDocument, kind: DocumentSection["kind"]): DocumentEntry[] =>
  document.sections
    .filter((section) => section.kind === kind)
    .flatMap((section) => section.entries);

const firstUrl = (entry: DocumentEntry): string | undefined =>
  entry.organisation?.url ?? entry.links[0]?.url;

// A profile is a contact that names a service. Email, phone and location are
// their own fields in `basics`, and a bare website is `basics.url`.
const PROFILE_KINDS = new Set(["linkedin", "github", "scholar", "orcid"]);

function profileOf(contact: DocumentContact): JsonResumeProfile {
  return {
    network: contact.label ?? contact.kind,
    username: contact.value,
    ...(contact.href === undefined ? {} : { url: contact.href }),
  };
}

function basicsOf(document: ResumeDocument): JsonResumeBasics {
  const { contacts } = document.header;
  const of = (kind: string) => contacts.find((contact) => contact.kind === kind)?.value;
  const profiles = contacts.filter((contact) => PROFILE_KINDS.has(contact.kind)).map(profileOf);
  const email = of("email");
  const phone = of("phone");
  const url = of("website");
  const summary = said(document.header.summary);

  return {
    ...(document.header.fullName === undefined ? {} : { name: document.header.fullName }),
    ...(document.header.headline === undefined ? {} : { label: document.header.headline }),
    ...(email === undefined ? {} : { email }),
    ...(phone === undefined ? {} : { phone }),
    ...(url === undefined ? {} : { url }),
    ...(summary === undefined ? {} : { summary }),
    // One free-text line here against five named parts there. `address` is the
    // only one that cannot mean the wrong thing.
    ...(document.header.location === undefined
      ? {}
      : { location: { address: document.header.location } }),
    ...(profiles.length === 0 ? {} : { profiles }),
  };
}

function workOf(entry: DocumentEntry): JsonResumeWork {
  const url = firstUrl(entry);
  const summary = said(entry.summary);
  const points = highlights(entry);

  return {
    ...(entry.organisation === undefined ? {} : { name: entry.organisation.name }),
    ...(entry.title === undefined ? {} : { position: entry.title }),
    // `work` is the only list there with a location. Every other kind loses it,
    // which `lossOf` counts.
    ...(entry.location === undefined ? {} : { location: entry.location }),
    ...(url === undefined ? {} : { url }),
    ...dates(entry),
    ...(summary === undefined ? {} : { summary }),
    ...(points.length === 0 ? {} : { highlights: points }),
  };
}

// Only what the format has somewhere to put; anything left out is named by
// `lossOf`.
export function toJsonResume(document: ResumeDocument): JsonResume {
  const work = entriesOf(document, "experience").map(workOf);

  // `location` is dropped rather than carried over from `workOf`: the volunteer
  // list is the same shape there minus that one field.
  const volunteer = entriesOf(document, "volunteering").map((entry) => {
    const { name, position, location: _at, ...rest } = workOf(entry);
    return {
      ...(name === undefined ? {} : { organization: name }),
      ...(position === undefined ? {} : { position }),
      ...rest,
    };
  });

  // `studyType` is the qualification and `area` its subject. A record holds one
  // title and one subtitle, and splitting a degree apart would be a guess.
  const education = entriesOf(document, "education").map((entry) => ({
    ...(entry.organisation === undefined ? {} : { institution: entry.organisation.name }),
    ...(entry.title === undefined ? {} : { studyType: entry.title }),
    ...(entry.subtitle === undefined ? {} : { area: entry.subtitle }),
    ...(firstUrl(entry) === undefined ? {} : { url: firstUrl(entry) }),
    ...dates(entry),
  }));

  const awards = entriesOf(document, "award").map((entry) => ({
    ...(entry.title === undefined ? {} : { title: entry.title }),
    ...(entry.period?.start === undefined ? {} : { date: entry.period.start }),
    ...(entry.organisation === undefined ? {} : { awarder: entry.organisation.name }),
    ...(said(entry.summary) === undefined ? {} : { summary: said(entry.summary) }),
  }));

  const certificates = entriesOf(document, "certification").map((entry) => ({
    ...(entry.title === undefined ? {} : { name: entry.title }),
    ...(entry.period?.start === undefined ? {} : { date: entry.period.start }),
    ...(entry.organisation === undefined ? {} : { issuer: entry.organisation.name }),
    ...(firstUrl(entry) === undefined ? {} : { url: firstUrl(entry) }),
  }));

  const publications = entriesOf(document, "publication").map((entry) => ({
    ...(entry.title === undefined ? {} : { name: entry.title }),
    ...(entry.organisation === undefined ? {} : { publisher: entry.organisation.name }),
    ...(entry.period?.start === undefined ? {} : { releaseDate: entry.period.start }),
    ...(firstUrl(entry) === undefined ? {} : { url: firstUrl(entry) }),
    ...(said(entry.summary) === undefined ? {} : { summary: said(entry.summary) }),
  }));

  const skills = entriesOf(document, "skill").map((entry) => ({
    ...(entry.title === undefined ? {} : { name: entry.title }),
    ...(entry.subtitle === undefined ? {} : { level: entry.subtitle }),
    ...(entry.tags.length === 0 ? {} : { keywords: entry.tags }),
  }));

  const languages = entriesOf(document, "language").map((entry) => ({
    ...(entry.title === undefined ? {} : { language: entry.title }),
    ...(entry.subtitle === undefined ? {} : { fluency: entry.subtitle }),
  }));

  const projects = entriesOf(document, "project").map((entry) => {
    const points = highlights(entry);
    return {
      ...(entry.title === undefined ? {} : { name: entry.title }),
      ...(said(entry.summary) === undefined ? {} : { description: said(entry.summary) }),
      ...(points.length === 0 ? {} : { highlights: points }),
      ...(entry.tags.length === 0 ? {} : { keywords: entry.tags }),
      ...dates(entry),
      ...(firstUrl(entry) === undefined ? {} : { url: firstUrl(entry) }),
      ...(entry.organisation === undefined ? {} : { entity: entry.organisation.name }),
    };
  });

  const sections = {
    work,
    volunteer,
    education,
    awards,
    certificates,
    publications,
    skills,
    languages,
    projects,
  };

  return {
    $schema: JSON_RESUME_SCHEMA,
    basics: basicsOf(document),
    ...Object.fromEntries(Object.entries(sections).filter(([, rows]) => rows.length > 0)),
    meta: { version: "v1.0.0", lastModified: document.meta.generatedAt },
  };
}
