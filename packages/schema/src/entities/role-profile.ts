import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { uuidSchema } from "../primitives/uuid.js";
import { standardFields } from "./standard-fields.js";

export const roleProfileSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    sortKey: sortKeySchema,
  })
  .meta({ id: "RoleProfile", title: "Role profile" });

export const roleProfileInputSchema = roleProfileSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const roleProfilePatchSchema = roleProfileInputSchema.omit({ id: true }).partial();

// The pair is the whole row, like a record's tags. It says the profile selects
// work filed under this word, which is not the same claim as a record carrying
// it, so it is the profile's rule rather than a tag on the profile.
export const roleProfileTagSchema = z
  .object({
    roleProfileId: uuidSchema,
    tagId: uuidSchema,
  })
  .meta({ id: "RoleProfileTag", title: "Role profile rule" });

// What applying one wrote. Additive, so there is nothing taken off to report.
export const roleProfileApplicationSchema = z
  .object({
    entries: z.number().int().nonnegative(),
    points: z.number().int().nonnegative(),
  })
  .meta({ id: "RoleProfileApplication", title: "Applied role profile" });

export type RoleProfile = z.infer<typeof roleProfileSchema>;
export type RoleProfileInput = z.infer<typeof roleProfileInputSchema>;
export type RoleProfilePatch = z.infer<typeof roleProfilePatchSchema>;
export type RoleProfileTag = z.infer<typeof roleProfileTagSchema>;
export type RoleProfileApplication = z.infer<typeof roleProfileApplicationSchema>;
