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
