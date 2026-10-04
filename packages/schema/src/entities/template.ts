import { z } from "zod";
import { standardFields } from "./standard-fields.js";
import { cssIsLocal } from "./template-css.js";

const CLOSES_STYLE = /<\/style/i;

export const extraCssSchema = z
  .string()
  .max(4000)
  .refine(cssIsLocal, {
    message:
      "Extra CSS may not fetch anything: no @import, external URLs, resource functions or unknown CSS constructs.",
  })
  .refine((css) => !CLOSES_STYLE.test(css), {
    message: "Extra CSS may not contain </style.",
  });

export const templateSpecSchema = z
  .object({
    settings: z.record(z.string(), z.union([z.string(), z.number()])),
    extraCss: z.string().max(4000),
  })
  .meta({ id: "TemplateSpec", title: "Template design" });

export const templateSchema = z
  .object({
    ...standardFields,
    name: z.string().min(1),
    spec: templateSpecSchema,
  })
  .meta({ id: "Template", title: "Template" });

export const templateInputSchema = templateSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
  })
  .extend({ spec: templateSpecSchema.extend({ extraCss: extraCssSchema }) });

export const templatePatchSchema = templateInputSchema.omit({ id: true }).partial();

export const templateFileSchema = z.object({
  name: z.string().min(1),
  spec: templateInputSchema.shape.spec,
});

export type TemplateSpec = z.infer<typeof templateSpecSchema>;
export type TemplateFile = z.infer<typeof templateFileSchema>;
export type StoredTemplate = z.infer<typeof templateSchema>;
export type StoredTemplateInput = z.infer<typeof templateInputSchema>;
export type StoredTemplatePatch = z.infer<typeof templatePatchSchema>;
