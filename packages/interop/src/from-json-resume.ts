import type {
  ContactChannelKind,
  Intake,
  IntakeContactChannel,
  IntakeRecord,
} from "@keepcv/schema";
import type { JsonResume, JsonResumeLocation, JsonResumeProfile } from "./json-resume.js";
import type { Period } from "./reading.js";
import {
  at,
  channelOfNetwork,
  linksOf,
  Notes,
  nothing,
  Organisations,
  pointsOf,
  proficiencyOf,
  tagsOf,
  text,
} from "./reading.js";

// One free-text line out of five named parts, which is the shape the store
// holds and the reverse of what the adapter writes.
const locationOf = (location: JsonResumeLocation | undefined): string | null => {
  if (location === undefined) return null;
  const parts = [location.address, location.city, location.region, location.countryCode];
  const joined = parts
    .map((part) => part?.trim())
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
  return joined === "" ? null : joined;
};

function channelOf(profile: JsonResumeProfile): IntakeContactChannel | undefined {
  const value = text(profile.username) ?? text(profile.url);
  return value === null ? undefined : channelOfNetwork(text(profile.network), value);
}

function channelsOf(resume: JsonResume): IntakeContactChannel[] {
  const basics = resume.basics ?? {};
  const named: [ContactChannelKind, string | undefined][] = [
    ["email", basics.email],
    ["phone", basics.phone],
    ["website", basics.url],
  ];
  return [
    ...named.flatMap(([kind, value]) => {
      const found = text(value);
      return found === null ? [] : [{ kind, label: null, value: found }];
    }),
    ...(basics.profiles ?? []).flatMap((profile) => channelOf(profile) ?? []),
  ];
}

// No end date means ongoing only where the kind has a period at all. An award
// carries one date, and calling it current would be nonsense.
function periodOf(
  dates: { startDate?: string; endDate?: string },
  about: string,
  notes: Notes,
): Period {
  const startedOn = notes.date(dates.startDate, about);
  const endedOn = notes.date(dates.endDate, about);
  return { startedOn, endedOn, isCurrent: startedOn !== null && endedOn === null };
}

function workRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.work ?? []).map((job) => {
    const about = text(job.position) ?? text(job.name) ?? "a job";
    if (text(job.description) !== null) {
      notes.add(`The description of ${text(job.name) ?? "an employer"} is not brought across.`);
    }
    return {
      ...nothing,
      kind: "experience",
      title: text(job.position),
      location: text(job.location),
      organisationName: orgs.seen(job.name, "company"),
      ...periodOf(job, about, notes),
      summary: text(job.summary),
      points: pointsOf(job.highlights),
      links: linksOf(job.url),
      employmentType: null,
      mode: null,
    };
  });
}

// The two lists with no kind of their own. A custom section is exactly what
// they are, so they arrive whole rather than as a note saying they were seen.
function interestRecords(resume: JsonResume): IntakeRecord[] {
  return (resume.interests ?? []).flatMap((interest) => {
    const title = text(interest.name);
    if (title === null) return [];
    return [
      {
        ...nothing,
        kind: "custom_entry" as const,
        sectionHeading: "Interests",
        title,
        organisationName: null,
        startedOn: null,
        endedOn: null,
        isCurrent: false,
        tags: tagsOf(interest.keywords),
      },
    ];
  });
}

function referenceRecords(resume: JsonResume): IntakeRecord[] {
  return (resume.references ?? []).flatMap((reference) => {
    const title = text(reference.name);
    if (title === null) return [];
    return [
      {
        ...nothing,
        kind: "custom_entry" as const,
        sectionHeading: "References",
        title,
        organisationName: null,
        startedOn: null,
        endedOn: null,
        isCurrent: false,
        summary: text(reference.reference),
      },
    ];
  });
}

function volunteerRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.volunteer ?? []).map((role) => {
    const about = text(role.position) ?? text(role.organization) ?? "a volunteering role";
    return {
      ...nothing,
      kind: "volunteering",
      title: text(role.position),
      organisationName: orgs.seen(role.organization, "other"),
      ...periodOf(role, about, notes),
      summary: text(role.summary),
      points: pointsOf(role.highlights),
      links: linksOf(role.url),
    };
  });
}

function educationRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.education ?? []).map((course) => {
    const about = text(course.studyType) ?? text(course.institution) ?? "a course";
    if ((course.courses ?? []).length > 0) {
      notes.add(`The course list on ${about} has nowhere to go, so it is not brought across.`);
    }
    return {
      ...nothing,
      kind: "education",
      // `studyType` is the qualification and `area` its subject, which is the
      // split the adapter writes.
      title: text(course.studyType),
      subtitle: text(course.area),
      organisationName: orgs.seen(course.institution, "institution"),
      ...periodOf(course, about, notes),
      links: linksOf(course.url),
      grade: text(course.score),
      gradeScale: null,
      thesisTitle: null,
      honours: null,
    };
  });
}

function awardRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.awards ?? []).map((award) => {
    const about = text(award.title) ?? "an award";
    return {
      ...nothing,
      kind: "award",
      title: text(award.title),
      organisationName: orgs.seen(award.awarder, "issuer"),
      ...at(notes.date(award.date, about)),
      summary: text(award.summary),
    };
  });
}

function certificateRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.certificates ?? []).map((certificate) => {
    const about = text(certificate.name) ?? "a certificate";
    return {
      ...nothing,
      kind: "certification",
      title: text(certificate.name),
      organisationName: orgs.seen(certificate.issuer, "issuer"),
      ...at(notes.date(certificate.date, about)),
      links: linksOf(certificate.url, "verify"),
      credentialId: null,
      expiresOn: null,
    };
  });
}

function publicationRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.publications ?? []).map((paper) => {
    const about = text(paper.name) ?? "a publication";
    return {
      ...nothing,
      kind: "publication",
      title: text(paper.name),
      organisationName: orgs.seen(paper.publisher, "publisher"),
      ...at(notes.date(paper.releaseDate, about)),
      summary: text(paper.summary),
      links: linksOf(paper.url),
      doi: null,
    };
  });
}

function skillRecords(resume: JsonResume, notes: Notes): IntakeRecord[] {
  return (resume.skills ?? []).map((skill) => ({
    ...nothing,
    kind: "skill",
    title: text(skill.name),
    organisationName: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    tags: tagsOf(skill.keywords),
    category: null,
    proficiency: proficiencyOf(skill.level, notes),
  }));
}

function languageRecords(resume: JsonResume): IntakeRecord[] {
  return (resume.languages ?? []).map((language) => ({
    ...nothing,
    kind: "language",
    title: text(language.language),
    organisationName: null,
    startedOn: null,
    endedOn: null,
    isCurrent: false,
    proficiency: text(language.fluency),
  }));
}

function projectRecords(resume: JsonResume, orgs: Organisations, notes: Notes): IntakeRecord[] {
  return (resume.projects ?? []).map((project) => {
    const about = text(project.name) ?? "a project";
    return {
      ...nothing,
      kind: "project",
      title: text(project.name),
      organisationName: orgs.seen(project.entity, "company"),
      ...periodOf(project, about, notes),
      summary: text(project.description),
      points: pointsOf(project.highlights),
      links: linksOf(project.url, "demo"),
      tags: tagsOf(project.keywords),
    };
  });
}

function projectNotes(resume: JsonResume, notes: Notes): void {
  for (const project of resume.projects ?? []) {
    const about = text(project.name) ?? "a project";
    if ((project.roles ?? []).length > 0) {
      notes.add(`The roles listed on ${about} have nowhere to go, so they are not brought across.`);
    }
    if (text(project.type) !== null) {
      notes.add(`The type of ${about} has nowhere to go, so it is not brought across.`);
    }
  }
}

// The way back in from the format the adapter writes. Every field the format
// holds is either placed or named in `notes`; nothing is inferred, which is
// what makes this the one reader whose fidelity is `declared`.
export function fromJsonResume(resume: JsonResume): Intake {
  const orgs = new Organisations();
  const notes = new Notes();
  const basics = resume.basics ?? {};

  projectNotes(resume, notes);

  const records = [
    ...workRecords(resume, orgs, notes),
    ...volunteerRecords(resume, orgs, notes),
    ...educationRecords(resume, orgs, notes),
    ...projectRecords(resume, orgs, notes),
    ...skillRecords(resume, notes),

    ...certificateRecords(resume, orgs, notes),
    ...publicationRecords(resume, orgs, notes),
    ...awardRecords(resume, orgs, notes),
    ...languageRecords(resume),
    ...interestRecords(resume),
    ...referenceRecords(resume),
  ];

  return {
    source: "json-resume",
    fidelity: "declared",
    identity: {
      fullName: text(basics.name),
      headline: text(basics.label),
      location: locationOf(basics.location),
      // The format has no field for them, so nothing here could fill this in.
      pronouns: null,
      summary: text(basics.summary),
    },
    contactChannels: channelsOf(resume),
    organisations: orgs.all(),
    records,
    notes: notes.all(),
  };
}
