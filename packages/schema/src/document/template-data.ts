import { z } from "zod";
import { htmlTemplateSourceSchema } from "../entities/template-definition.js";
import { documentMetaSchema, resumeDocumentSchema } from "./resume-document.js";

export const templateDataSchema = z
  .object({
    resume: resumeDocumentSchema.extend({
      meta: documentMetaSchema.pick({ generatedAt: true, resumeName: true, locale: true }),
    }),
    page: htmlTemplateSourceSchema.shape.page,
  })
  .meta({ id: "TemplateData", title: "Selected template data" });

export type TemplateData = z.infer<typeof templateDataSchema>;
