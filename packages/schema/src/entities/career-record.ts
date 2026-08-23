import { z } from "zod";
import { partialDateSchema } from "../primitives/partial-date.js";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const CAREER_RECORD_KINDS = [
  "experience",
  "education",
  "project",
  "skill",
  "certification",
  "publication",
  "award",
  "language",
  "volunteering",
  "speaking",
  "custom_entry",
] as const;

export const careerRecordKindSchema = z.enum(CAREER_RECORD_KINDS);

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const SKILL_PROFICIENCIES = ["familiar", "working", "proficient", "expert"] as const;

const nullableText = z.string().nullable();
const nullablePartialDate = partialDateSchema.nullable();

// Nullable by design: a record can be saved half-entered.
export const recordBase = z.object({
  ...standardFields,
  title: nullableText,
  subtitle: nullableText,
  organisationId: uuidSchema.nullable(),
  startedOn: nullablePartialDate,
  endedOn: nullablePartialDate,
  // An ongoing period is this flag, never a null end date: different facts.
  isCurrent: z.boolean(),
  location: nullableText,
  sortKey: sortKeySchema,
  summarySetId: uuidSchema.nullable(),
});

const inputBase = recordBase.omit({ createdAt: true, updatedAt: true, archivedAt: true });
const patchBase = inputBase.omit({ id: true }).partial();

function capitalise(text: string): string {
  return `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

// Narrowed before each kind's extra fields are added: narrowing afterwards
// loses the key names to the generic and stops type-checking.
function recordKind<K extends (typeof CAREER_RECORD_KINDS)[number], E extends z.ZodRawShape>(
  kind: K,
  extras: E,
) {
  // No space: this id keys the definition in the published JSON Schema.
  const id = `${kind.split("_").map(capitalise).join("")}Record`;
  const title = `${capitalise(kind.replace("_", " "))} record`;
  return {
    full: recordBase.extend({ kind: z.literal(kind), ...extras }).meta({ id, title }),
    input: inputBase.extend({ kind: z.literal(kind), ...extras }),
    patch: patchBase.extend({ kind: z.literal(kind), ...z.object(extras).partial().shape }),
  };
}

// Read here and by the intake union, so a field added to one is a field the
// other cannot silently drop on the way in.
export const RECORD_EXTRAS = {
  experience: {
    employmentType: nullableText,
    mode: z.enum(WORK_MODES).nullable(),
  },
  education: {
    grade: nullableText,
    gradeScale: nullableText,
    thesisTitle: nullableText,
    honours: nullableText,
  },
  project: {},
  skill: {
    category: nullableText,
    proficiency: z.enum(SKILL_PROFICIENCIES).nullable(),
  },
  // `expiresOn` is not `endedOn`: conflating them breaks "what lapses in 90
  // days".
  certification: {
    credentialId: nullableText,
    expiresOn: nullablePartialDate,
  },
  publication: { doi: nullableText },
  award: {},
  // Free text, unlike a skill's proficiency: "C1" and "reading only" both occur.
  language: { proficiency: nullableText },
  volunteering: {},
  speaking: {},
  // The one kind with a required parent, and the only one that may carry it.
  custom_entry: { customSectionId: uuidSchema },
};

const experience = recordKind("experience", RECORD_EXTRAS.experience);
const education = recordKind("education", RECORD_EXTRAS.education);
const project = recordKind("project", RECORD_EXTRAS.project);
const skill = recordKind("skill", RECORD_EXTRAS.skill);
const certification = recordKind("certification", RECORD_EXTRAS.certification);
const publication = recordKind("publication", RECORD_EXTRAS.publication);
const award = recordKind("award", RECORD_EXTRAS.award);
const language = recordKind("language", RECORD_EXTRAS.language);
const volunteering = recordKind("volunteering", RECORD_EXTRAS.volunteering);
const speaking = recordKind("speaking", RECORD_EXTRAS.speaking);
const customEntry = recordKind("custom_entry", RECORD_EXTRAS.custom_entry);

export const careerRecordSchema = z.discriminatedUnion("kind", [
  experience.full,
  education.full,
  project.full,
  skill.full,
  certification.full,
  publication.full,
  award.full,
  language.full,
  volunteering.full,
  speaking.full,
  customEntry.full,
]);

export const careerRecordInputSchema = z.discriminatedUnion("kind", [
  experience.input,
  education.input,
  project.input,
  skill.input,
  certification.input,
  publication.input,
  award.input,
  language.input,
  volunteering.input,
  speaking.input,
  customEntry.input,
]);

export const careerRecordPatchSchema = z.discriminatedUnion("kind", [
  experience.patch,
  education.patch,
  project.patch,
  skill.patch,
  certification.patch,
  publication.patch,
  award.patch,
  language.patch,
  volunteering.patch,
  speaking.patch,
  customEntry.patch,
]);

export type CareerRecordKind = z.infer<typeof careerRecordKindSchema>;
export type WorkMode = (typeof WORK_MODES)[number];
export type SkillProficiency = (typeof SKILL_PROFICIENCIES)[number];
export type CareerRecord = z.infer<typeof careerRecordSchema>;
export type CareerRecordInput = z.infer<typeof careerRecordInputSchema>;
export type CareerRecordPatch = z.infer<typeof careerRecordPatchSchema>;
