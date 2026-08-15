import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { standardFields } from "./standard-fields.js";

// A heading the built-in kinds do not cover - "Patents", "Press", "Grants". What
// prints under it is a record of kind `custom_entry`, so a custom row carries
// links, fields and points like any other record and no template learns a second
// shape (data-model.md #6).
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
