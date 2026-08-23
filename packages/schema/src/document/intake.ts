import { z } from "zod";
import { RECORD_EXTRAS, recordBase } from "../entities/career-record.js";
import { contactChannelKindSchema } from "../entities/contact-channel.js";
import { organisationKindSchema } from "../entities/organisation.js";
import { recordLinkKindSchema } from "../entities/record-link.js";
import { partialDateSchema } from "../primitives/partial-date.js";
import { uuidSchema } from "../primitives/uuid.js";

export const INTAKE_SOURCES = [
  "json-resume",
  "reactive-resume",
  "rendercv",
  "docx",
  "pdf",
] as const;

export const intakeSourceSchema = z.enum(INTAKE_SOURCES);

// Whether the file named each thing or the reader worked it out from how the
// file looked. Both are reviewed before anything is written; this decides how
// much the review has to show.
export const INTAKE_FIDELITIES = ["declared", "inferred"] as const;

export const intakeFidelitySchema = z.enum(INTAKE_FIDELITIES);

export const intakePointSchema = z.object({
  // Plain text: no reader can tell emphasis from a phrase it lifted out of a
  // rendered file, and inventing marks would put words in the user's mouth.
  text: z.string().min(1),
  occurredOn: partialDateSchema.nullable(),
});

export const intakeLinkSchema = z.object({
  kind: recordLinkKindSchema,
  label: z.string().nullable(),
  url: z.string().min(1),
});

const intakeRecordBase = recordBase
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
    sortKey: true,
    organisationId: true,
    summarySetId: true,
  })
  .extend({
    // The name that was printed. Which organisation it is, or whether it is a
    // new one, is the reviewer's answer and not the reader's.
    organisationName: z.string().nullable(),
    summary: z.string().nullable(),
    points: z.array(intakePointSchema),
    links: z.array(intakeLinkSchema),
    // Labels rather than ids, resolved the same way the pickers do it: a word
    // already in the vocabulary is reached for, and a new one is created.
    tags: z.array(z.string().min(1)),
  });

export const intakeRecordSchema = z.discriminatedUnion("kind", [
  intakeRecordBase.extend({ kind: z.literal("experience"), ...RECORD_EXTRAS.experience }),
  intakeRecordBase.extend({ kind: z.literal("education"), ...RECORD_EXTRAS.education }),
  intakeRecordBase.extend({ kind: z.literal("project"), ...RECORD_EXTRAS.project }),
  intakeRecordBase.extend({ kind: z.literal("skill"), ...RECORD_EXTRAS.skill }),
  intakeRecordBase.extend({ kind: z.literal("certification"), ...RECORD_EXTRAS.certification }),
  intakeRecordBase.extend({ kind: z.literal("publication"), ...RECORD_EXTRAS.publication }),
  intakeRecordBase.extend({ kind: z.literal("award"), ...RECORD_EXTRAS.award }),
  intakeRecordBase.extend({ kind: z.literal("language"), ...RECORD_EXTRAS.language }),
  intakeRecordBase.extend({ kind: z.literal("volunteering"), ...RECORD_EXTRAS.volunteering }),
  intakeRecordBase.extend({ kind: z.literal("speaking"), ...RECORD_EXTRAS.speaking }),
  // The heading that was printed rather than a section id, for the reason an
  // organisation arrives as a name: a heading nothing files is created here.
  intakeRecordBase.extend({
    kind: z.literal("custom_entry"),
    sectionHeading: z.string().min(1),
  }),
]);

export const intakeOrganisationSchema = z.object({
  name: z.string().min(1),
  kind: organisationKindSchema,
  website: z.string().nullable(),
  location: z.string().nullable(),
});

export const intakeContactChannelSchema = z.object({
  kind: contactChannelKindSchema,
  label: z.string().nullable(),
  value: z.string().min(1),
});

export const intakeIdentitySchema = z.object({
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  location: z.string().nullable(),
  pronouns: z.string().nullable(),
  summary: z.string().nullable(),
});

// What a file said, before anything decides what to do about it. No ids, no
// ordering and no foreign keys: a reader knows what was printed and nothing
// about the store it is headed for.
export const intakeSchema = z
  .object({
    source: intakeSourceSchema,
    fidelity: intakeFidelitySchema,
    identity: intakeIdentitySchema,
    contactChannels: z.array(intakeContactChannelSchema),
    organisations: z.array(intakeOrganisationSchema),
    records: z.array(intakeRecordSchema),
    // What the reader saw and could not place. A reader that guesses is worse
    // than one that says what it did not understand.
    notes: z.array(z.string()),
  })
  .meta({ id: "Intake", title: "Intake" });

// What the reviewer decided about one incoming thing. Nothing is written until
// every one of these has an answer.
export const intakeChoiceSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("merge"), into: uuidSchema }),
  z.object({ action: z.literal("skip") }),
]);

// The summary is not one of these: it becomes a phrasing set rather than a
// column on the profile.
export const INTAKE_IDENTITY_FIELDS = ["fullName", "headline", "location", "pronouns"] as const;

export const intakeIdentityFieldSchema = z.enum(INTAKE_IDENTITY_FIELDS);

// Positional, so each array is as long as the one it answers. A file and the
// answers about it travel together, and an index is the only name an incoming
// thing has.
export const intakeDecisionsSchema = z
  .object({
    organisations: z.array(intakeChoiceSchema),
    contactChannels: z.array(intakeChoiceSchema),
    records: z.array(intakeChoiceSchema),
    identity: z.array(intakeIdentityFieldSchema),
    summary: z.boolean(),
  })
  .meta({ id: "IntakeDecisions", title: "Intake decisions" });

export type IntakeChoice = z.infer<typeof intakeChoiceSchema>;
export type IntakeIdentityField = z.infer<typeof intakeIdentityFieldSchema>;
export type IntakeDecisions = z.infer<typeof intakeDecisionsSchema>;
export type IntakeSource = z.infer<typeof intakeSourceSchema>;
export type IntakeFidelity = z.infer<typeof intakeFidelitySchema>;
export type IntakePoint = z.infer<typeof intakePointSchema>;
export type IntakeLink = z.infer<typeof intakeLinkSchema>;
export type IntakeRecord = z.infer<typeof intakeRecordSchema>;
export type IntakeOrganisation = z.infer<typeof intakeOrganisationSchema>;
export type IntakeContactChannel = z.infer<typeof intakeContactChannelSchema>;
export type IntakeIdentity = z.infer<typeof intakeIdentitySchema>;
export type Intake = z.infer<typeof intakeSchema>;
