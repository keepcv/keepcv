import { z } from "zod";
import { standardFields } from "./standard-fields.js";

export const profileSchema = z
  .object({
    ...standardFields,
    fullName: z.string().nullable(),
    pronouns: z.string().nullable(),
    headline: z.string().nullable(),
    location: z.string().nullable(),
  })
  .meta({ id: "Profile", title: "Profile" });

// Sparse: an absent key leaves the field alone, an explicit null clears it.
// Almost every field is nullable by design (data-model.md P-A), so "unchanged"
// and "cleared" have to stay distinguishable.
export const profilePatchSchema = profileSchema
  .pick({ fullName: true, pronouns: true, headline: true, location: true })
  .partial();

export type Profile = z.infer<typeof profileSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
