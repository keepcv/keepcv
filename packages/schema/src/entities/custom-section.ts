import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { standardFields } from "./standard-fields.js";

export const customSectionSchema = z
  .object({
    ...standardFields,
    heading: z.string().min(1),
    sortKey: sortKeySchema,
  })
  .meta({ id: "CustomSection", title: "Custom section" });

export const customSectionInputSchema = customSectionSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const customSectionPatchSchema = customSectionInputSchema.omit({ id: true }).partial();

export type CustomSection = z.infer<typeof customSectionSchema>;
export type CustomSectionInput = z.infer<typeof customSectionInputSchema>;
export type CustomSectionPatch = z.infer<typeof customSectionPatchSchema>;
