import { z } from "zod";
import { standardFields } from "./standard-fields.js";

export const ORGANISATION_KINDS = [
  "company",
  "institution",
  "issuer",
  "publisher",
  "venue",
  "other",
] as const;

export const organisationKindSchema = z.enum(ORGANISATION_KINDS);

// First-class rather than a string on each record, so two roles at one company
// group under a single heading and a certification, a talk and a paper can share
// one issuer identity (data-model.md #6). No sort key: organisations are listed
// by name, never dragged.
export const organisationSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    kind: organisationKindSchema,
    website: z.string().nullable(),
    industry: z.string().nullable(),
    location: z.string().nullable(),
  })
  .meta({ id: "Organisation", title: "Organisation" });

// The id comes from the client so a retried create is idempotent
// (api-contract.md #2).
export const organisationInputSchema = organisationSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const organisationPatchSchema = organisationInputSchema.omit({ id: true }).partial();

export type OrganisationKind = z.infer<typeof organisationKindSchema>;
export type Organisation = z.infer<typeof organisationSchema>;
export type OrganisationInput = z.infer<typeof organisationInputSchema>;
export type OrganisationPatch = z.infer<typeof organisationPatchSchema>;
