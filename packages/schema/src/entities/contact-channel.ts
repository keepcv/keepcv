import { z } from "zod";
import { sortKeySchema } from "../primitives/sort-key.js";
import { standardFields } from "./standard-fields.js";

export const CONTACT_CHANNEL_KINDS = [
  "email",
  "phone",
  "website",
  "linkedin",
  "github",
  "scholar",
  "orcid",
  "location",
  "other",
] as const;

export const contactChannelKindSchema = z.enum(CONTACT_CHANNEL_KINDS);

export const contactChannelSchema = z
  .object({
    ...standardFields,
    kind: contactChannelKindSchema,
    label: z.string().nullable(),
    value: z.string().min(1),
    isDefaultVisible: z.boolean(),
    sortKey: sortKeySchema,
  })
  .meta({ id: "ContactChannel", title: "Contact channel" });

export const contactChannelInputSchema = contactChannelSchema.pick({
  id: true,
  kind: true,
  label: true,
  value: true,
  isDefaultVisible: true,
  sortKey: true,
});

export const contactChannelPatchSchema = contactChannelInputSchema.omit({ id: true }).partial();

export type ContactChannelKind = z.infer<typeof contactChannelKindSchema>;
export type ContactChannel = z.infer<typeof contactChannelSchema>;
export type ContactChannelInput = z.infer<typeof contactChannelInputSchema>;
export type ContactChannelPatch = z.infer<typeof contactChannelPatchSchema>;
