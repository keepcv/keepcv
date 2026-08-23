import type {
  ContactChannelKind,
  Intake,
  IntakeContactChannel,
  IntakeRecord,
} from "@keepcv/schema";
import { readHtml } from "./html.js";
import type {
  ReactiveResume,
  ReactiveResumeAward,
  ReactiveResumeCertification,
  ReactiveResumeEducation,
  ReactiveResumeExperience,
  ReactiveResumeInterest,
  ReactiveResumeLanguage,
  ReactiveResumeProfile,
  ReactiveResumeProject,
  ReactiveResumeProse,
  ReactiveResumePublication,
  ReactiveResumeReference,
  ReactiveResumeSkill,
  ReactiveResumeUrl,
  ReactiveResumeVolunteer,
} from "./reactive-resume.js";
import type { Common } from "./reading.js";
import {
  at,
  channelOfNetwork,
  dateFromText,
  linksOf,
  Notes,
  nothing,
  Organisations,
  periodFromText,
  proficiencyOf,
  tagsOf,
  text,
  undated,
} from "./reading.js";

const urlOf = (website: ReactiveResumeUrl | undefined): string | null => text(website?.url);

// A description is what the editor wrote: paragraphs are the summary and list
// items are points, which is the split every other format states outright.
function described(description: string | undefined): Pick<Common, "summary" | "points"> {
  const { summary, points } = readHtml(description ?? "");
  return { summary, points: points.map((point) => ({ text: point, occurredOn: null })) };
}

function channelOf(profile: ReactiveResumeProfile): IntakeContactChannel | undefined {
  const value = text(profile.username) ?? urlOf(profile.website);
  return value === null ? undefined : channelOfNetwork(text(profile.network), value);
}

function channelsOf(resume: ReactiveResume): IntakeContactChannel[] {
  const basics = resume.basics ?? {};
  const named: [ContactChannelKind, string | null, string | null][] = [
    ["email", text(basics.email), null],
    ["phone", text(basics.phone), null],
    ["website", urlOf(basics.website), text(basics.website?.label)],
  ];

  return [
    ...named.flatMap(([kind, value, label]) => (value === null ? [] : [{ kind, label, value }])),
    ...(resume.sections?.profiles?.items ?? []).flatMap((profile) => channelOf(profile) ?? []),
    // Whatever the user added to the header themselves. The text is the label
    // when there is a link behind it, and the value when there is not.
    ...(basics.customFields ?? []).flatMap((field) => {
      const link = text(field.link);
      const shown = text(field.text);
      const value = link ?? shown;
      return value === null
        ? []
        : [{ kind: "other" as const, label: link === null ? null : shown, value }];
    }),
  ];
}

function experienceRecords(
  items: ReactiveResumeExperience[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.flatMap((job) => {
    const about = text(job.position) ?? text(job.company) ?? "a job";
    const organisationName = orgs.seen(job.company, "company");
    const common = {
      ...nothing,
      kind: "experience" as const,
      location: text(job.location),
      organisationName,
      links: linksOf(urlOf(job.website)),
      employmentType: null,
      mode: null,
    };

    return [
      {
        ...common,
        title: text(job.position),
        ...periodFromText(job.period, about, notes),
        ...described(job.description),
      },
      // A role held at the same company is a record of its own, which is what
      // one organisation over several titles is for here.
      ...(job.roles ?? []).map((role) => ({
        ...common,
        title: text(role.position),
        ...periodFromText(role.period, text(role.position) ?? about, notes),
        ...described(role.description),
      })),
    ];
  });
}

function educationRecords(
  items: ReactiveResumeEducation[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.map((course) => {
    const about = text(course.degree) ?? text(course.school) ?? "a course";
    return {
      ...nothing,
      kind: "education" as const,
      title: text(course.degree),
      subtitle: text(course.area),
      location: text(course.location),
      organisationName: orgs.seen(course.school, "institution"),
      ...periodFromText(course.period, about, notes),
      ...described(course.description),
      links: linksOf(urlOf(course.website)),
      grade: text(course.grade),
      gradeScale: null,
      thesisTitle: null,
      honours: null,
    };
  });
}

function projectRecords(items: ReactiveResumeProject[], notes: Notes): IntakeRecord[] {
  return items.map((project) => ({
    ...nothing,
    kind: "project" as const,
    title: text(project.name),
    organisationName: null,
    ...periodFromText(project.period, text(project.name) ?? "a project", notes),
    ...described(project.description),
    links: linksOf(urlOf(project.website), "demo"),
  }));
}

function skillRecords(items: ReactiveResumeSkill[], notes: Notes): IntakeRecord[] {
  return items.map((skill) => {
    // One note rather than one per skill: the loss is the same every time, and
    // which skill it was on tells the reader nothing they can act on.
    if ((skill.level ?? 0) > 0) {
      notes.add(
        "A skill's level bar is a number out of five, which this store has nowhere to keep.",
      );
    }
    return {
      ...nothing,
      kind: "skill" as const,
      title: text(skill.name),
      organisationName: null,
      ...undated,
      tags: tagsOf(skill.keywords),
      category: null,
      proficiency: proficiencyOf(skill.proficiency, notes),
    };
  });
}

function languageRecords(items: ReactiveResumeLanguage[]): IntakeRecord[] {
  return items.map((language) => ({
    ...nothing,
    kind: "language" as const,
    title: text(language.language),
    organisationName: null,
    ...undated,
    proficiency: text(language.fluency),
  }));
}

function awardRecords(
  items: ReactiveResumeAward[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.map((award) => {
    const about = text(award.title) ?? "an award";
    return {
      ...nothing,
      kind: "award" as const,
      title: text(award.title),
      organisationName: orgs.seen(award.awarder, "issuer"),
      ...at(dateFromText(award.date, about, notes)),
      ...described(award.description),
      links: linksOf(urlOf(award.website)),
    };
  });
}

function certificationRecords(
  items: ReactiveResumeCertification[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.map((certificate) => {
    const about = text(certificate.title) ?? "a certificate";
    return {
      ...nothing,
      kind: "certification" as const,
      title: text(certificate.title),
      organisationName: orgs.seen(certificate.issuer, "issuer"),
      ...at(dateFromText(certificate.date, about, notes)),
      ...described(certificate.description),
      links: linksOf(urlOf(certificate.website), "verify"),
      credentialId: null,
      expiresOn: null,
    };
  });
}

function publicationRecords(
  items: ReactiveResumePublication[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.map((paper) => {
    const about = text(paper.title) ?? "a publication";
    return {
      ...nothing,
      kind: "publication" as const,
      title: text(paper.title),
      organisationName: orgs.seen(paper.publisher, "publisher"),
      ...at(dateFromText(paper.date, about, notes)),
      ...described(paper.description),
      links: linksOf(urlOf(paper.website)),
      doi: null,
    };
  });
}

function volunteerRecords(
  items: ReactiveResumeVolunteer[],
  orgs: Organisations,
  notes: Notes,
): IntakeRecord[] {
  return items.map((role) => {
    const about = text(role.organization) ?? "a volunteering role";
    return {
      ...nothing,
      kind: "volunteering" as const,
      // The format has no field for what the person did there, so every one of
      // these arrives named only by where it was done.
      title: null,
      location: text(role.location),
      organisationName: orgs.seen(role.organization, "other"),
      ...periodFromText(role.period, about, notes),
      ...described(role.description),
      links: linksOf(urlOf(role.website)),
    };
  });
}

function interestRecords(items: ReactiveResumeInterest[], heading: string): IntakeRecord[] {
  return items.flatMap((interest) => {
    const title = text(interest.name);
    return title === null
      ? []
      : [
          {
            ...nothing,
            kind: "custom_entry" as const,
            sectionHeading: heading,
            title,
            organisationName: null,
            ...undated,
            tags: tagsOf(interest.keywords),
          },
        ];
  });
}

function referenceRecords(
  items: ReactiveResumeReference[],
  heading: string,
  notes: Notes,
): IntakeRecord[] {
  return items.flatMap((reference) => {
    const title = text(reference.name);
    if (title === null) return [];
    if (text(reference.phone) !== null) {
      notes.add(`The phone number for ${title} has nowhere to go, so it is not brought across.`);
    }
    return [
      {
        ...nothing,
        kind: "custom_entry" as const,
        sectionHeading: heading,
        title,
        subtitle: text(reference.position),
        organisationName: null,
        ...undated,
        ...described(reference.description),
      },
    ];
  });
}

// A cover letter and an extra summary are prose under a heading, which is the
// one thing here with no kind of its own.
function proseRecords(items: ReactiveResumeProse[], heading: string): IntakeRecord[] {
  return items.flatMap((item) => {
    const { summary, points } = described(item.content);
    if (summary === null && points.length === 0) return [];
    return [
      {
        ...nothing,
        kind: "custom_entry" as const,
        sectionHeading: heading,
        title: text(item.recipient),
        organisationName: null,
        ...undated,
        summary,
        points,
      },
    ];
  });
}

interface Read {
  orgs: Organisations;
  notes: Notes;
}

// The declared type decides how a list is read, whether it is one of the twelve
// sections every file has or a heading the user added.
function itemsOf(type: string, items: unknown[], heading: string, { orgs, notes }: Read) {
  switch (type) {
    case "experience":
      return experienceRecords(items as ReactiveResumeExperience[], orgs, notes);
    case "education":
      return educationRecords(items as ReactiveResumeEducation[], orgs, notes);
    case "projects":
      return projectRecords(items as ReactiveResumeProject[], notes);
    case "skills":
      return skillRecords(items as ReactiveResumeSkill[], notes);
    case "languages":
      return languageRecords(items as ReactiveResumeLanguage[]);
    case "awards":
      return awardRecords(items as ReactiveResumeAward[], orgs, notes);
    case "certifications":
      return certificationRecords(items as ReactiveResumeCertification[], orgs, notes);
    case "publications":
      return publicationRecords(items as ReactiveResumePublication[], orgs, notes);
    case "volunteer":
      return volunteerRecords(items as ReactiveResumeVolunteer[], orgs, notes);
    case "interests":
      return interestRecords(items as ReactiveResumeInterest[], heading);
    case "references":
      return referenceRecords(items as ReactiveResumeReference[], heading, notes);
    case "summary":
    case "cover-letter":
      return proseRecords(items as ReactiveResumeProse[], heading);
    default:
      return undefined;
  }
}

function standardRecords(resume: ReactiveResume, read: Read): IntakeRecord[] {
  const sections = resume.sections ?? {};
  return Object.entries(sections).flatMap(([type, section]) => {
    const items = (section as { items?: unknown[] } | undefined)?.items ?? [];
    const heading = text((section as { title?: string } | undefined)?.title) ?? type;
    return itemsOf(type, items, heading, read) ?? [];
  });
}

const FILED_UNDER_A_HEADING = new Set(["interests", "references", "summary", "cover-letter"]);

// A custom section's items are typed, so they are filed as what they are rather
// than flattened under its heading: a job kept under "Consulting" is still a job
// and belongs in the same list as the rest. The heading is what does not
// survive, and it is named rather than dropped quietly.
function customRecords(resume: ReactiveResume, read: Read): IntakeRecord[] {
  return (resume.customSections ?? []).flatMap((section) => {
    const heading = text(section.title) ?? "Other";
    const type = text(section.type) ?? "";
    const records = itemsOf(type, section.items ?? [], heading, read);

    if (records === undefined) {
      read.notes.add(`"${heading}" holds items of a kind this does not read, so it is not read.`);
      return [];
    }
    if (records.length > 0 && !FILED_UNDER_A_HEADING.has(type)) {
      read.notes.add(
        `"${heading}" is a heading of your own, and its entries are filed as ${type} rather than under it.`,
      );
    }
    return records;
  });
}

// Everything a file holds, including what it was not printing: an item marked
// hidden is content the user wrote and chose to leave off, which is the whole
// reason a store sits behind a resume.
export function fromReactiveResume(resume: ReactiveResume): Intake {
  const read: Read = { orgs: new Organisations(), notes: new Notes() };
  const basics = resume.basics ?? {};

  const records = [...standardRecords(resume, read), ...customRecords(resume, read)];

  return {
    source: "reactive-resume",
    fidelity: "declared",
    identity: {
      fullName: text(basics.name),
      headline: text(basics.headline),
      location: text(basics.location),
      // The format has no field for them, so nothing here could fill this in.
      pronouns: null,
      summary: readHtml(resume.summary?.content ?? "").summary,
    },
    contactChannels: channelsOf(resume),
    organisations: read.orgs.all(),
    records,
    notes: read.notes.all(),
  };
}
