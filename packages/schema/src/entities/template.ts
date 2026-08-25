import { z } from "zod";
import { standardFields } from "./standard-fields.js";

// A stylesheet that fetches is a resume that prints differently offline, and
// `</style` ends the element this is written into.
const FETCHES = /@import|url\s*\(\s*(?!['"]?data:)/i;
const CLOSES_STYLE = /<\/style/i;

export const extraCssSchema = z
  .string()
  .max(4000)
  .refine((css) => !FETCHES.test(css), {
    message: "Extra CSS may not fetch anything: no @import, and no url() outside a data: address.",
  })
  .refine((css) => !CLOSES_STYLE.test(css), {
    message: "Extra CSS may not contain </style.",
  });

// Values for the knobs the renderer declares, which is the same vocabulary a
// resume overrides through `templateConfig`. Loose here because the renderer's
// field list is what states the range, and it refuses anything outside it.
export const templateSpecSchema = z
  .object({
    settings: z.record(z.string(), z.union([z.string(), z.number()])),
    extraCss: extraCssSchema,
  })
  .meta({ id: "TemplateSpec", title: "Template design" });

export const templateSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    spec: templateSpecSchema,
  })
  .meta({ id: "Template", title: "Template" });

export const templateInputSchema = templateSchema.omit({
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const templatePatchSchema = templateInputSchema.omit({ id: true }).partial();

export type TemplateSpec = z.infer<typeof templateSpecSchema>;
export type StoredTemplate = z.infer<typeof templateSchema>;
export type StoredTemplateInput = z.infer<typeof templateInputSchema>;
export type StoredTemplatePatch = z.infer<typeof templatePatchSchema>;
