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

// The vocabulary every kind shares (data-model.md #3.2). Almost all of it is
// nullable: a record can be saved half-entered, and what is missing is an
// observation the UI makes rather than a constraint that blocks a save.
const recordBase = z.object({
  ...standardFields,
  title: nullableText,
  subtitle: nullableText,
  organisationId: uuidSchema.nullable(),
  startedOn: nullablePartialDate,
  endedOn: nullablePartialDate,
  // "Still there" and "I have not filled this in yet" are different facts the UI
  // renders differently, which is why an ongoing period is a flag and not a null
  // end date.
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

// One kind, three shapes. The three bases are narrowed before the kind's extra
// fields are added, because narrowing after the fact loses the key names to the
// generic and stops type-checking. `kind` stays required on the patch: a record's
// kind never changes - swapping an experience for a project would discard that
// kind's facts - but carrying it types the caller into the right set of fields.
function recordKind<K extends (typeof CAREER_RECORD_KINDS)[number], E extends z.ZodRawShape>(
  kind: K,
  extras: E,
) {
  // `custom_entry` is the one kind whose name is two words. The id keys this
  // record's definition in the published JSON Schema, so it carries no space.
  const id = `${kind.split("_").map(capitalise).join("")}Record`;
  const title = `${capitalise(kind.replace("_", " "))} record`;
  return {
    full: recordBase.extend({ kind: z.literal(kind), ...extras }).meta({ id, title }),
    input: inputBase.extend({ kind: z.literal(kind), ...extras }),
    patch: patchBase.extend({ kind: z.literal(kind), ...z.object(extras).partial().shape }),
  };
}

const experience = recordKind("experience", {
  employmentType: nullableText,
  mode: z.enum(WORK_MODES).nullable(),
});
const education = recordKind("education", {
  grade: nullableText,
  gradeScale: nullableText,
  thesisTitle: nullableText,
  honours: nullableText,
});
const project = recordKind("project", {});
const skill = recordKind("skill", {
  category: nullableText,
  proficiency: z.enum(SKILL_PROFICIENCIES).nullable(),
});
// `expiresOn` is not `endedOn`: an expiry is not an ending, and conflating them
// would break "which certifications lapse in the next 90 days".
const certification = recordKind("certification", {
  credentialId: nullableText,
  expiresOn: nullablePartialDate,
});
// The author list is the publication's `subtitle` (template-model.md #6), so it
// is not a field of its own.
const publication = recordKind("publication", { doi: nullableText });
const award = recordKind("award", {});
// Free text where a skill's proficiency is a controlled vocabulary: "C1",
// "Native" and "reading only" are all things people mean.
const language = recordKind("language", { proficiency: nullableText });
const volunteering = recordKind("volunteering", {});
const speaking = recordKind("speaking", {});
// The one kind with a required parent: a custom entry means nothing apart from
// the heading it prints under, and no other kind may carry the column at all.
const customEntry = recordKind("custom_entry", { customSectionId: uuidSchema });

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
