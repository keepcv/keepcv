import { z } from "zod";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const profileSchema = z
  .object({
    ...standardFields,
    fullName: z.string().nullable(),
    pronouns: z.string().nullable(),
    headline: z.string().nullable(),
    location: z.string().nullable(),
    summarySetId: uuidSchema.nullable(),
  })
  .meta({ id: "Profile", title: "Profile" });

export const profilePatchSchema = profileSchema
  .pick({
    fullName: true,
    pronouns: true,
    headline: true,
    location: true,
    summarySetId: true,
  })
  .partial();

export type Profile = z.infer<typeof profileSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
