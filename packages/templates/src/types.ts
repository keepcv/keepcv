import type { StoredTemplateSpec, TemplateDefinition, TemplateSpec } from "@keepcv/schema";
import {
  extraCssSchema,
  htmlTemplatePayloadSchema,
  isTemplateDefinition,
  templateSpecSchema,
} from "@keepcv/schema";
import type { Template } from "./contract.js";
import { fromSpec } from "./from-spec.js";
import { HtmlTemplateError } from "./html/error.js";
import { fromHtmlDefinition, validateHtmlTemplate } from "./html/template.js";

export interface TemplateType {
  type: string;
  version: number;
  label: string;
  validate: (definition: TemplateDefinition) => void;
  html?: (id: string, name: string, definition: TemplateDefinition) => Template;
}

export const TEMPLATE_TYPES: readonly TemplateType[] = [
  {
    type: "default",
    version: 1,
    label: "Default (visual)",
    validate: (definition) => {
      const spec = templateSpecSchema.parse(definition.payload);
      extraCssSchema.parse(spec.extraCss);
    },
    html: (id, name, definition) => ({
      ...fromSpec(id, name, templateSpecSchema.parse(definition.payload)),
      type: "default",
      definition,
    }),
  },
  {
    type: "html",
    version: 1,
    label: "HTML",
    validate: (definition) =>
      validateHtmlTemplate(htmlTemplatePayloadSchema.parse(definition.payload)),
    html: fromHtmlDefinition,
  },
];

export function definitionOf(spec: StoredTemplateSpec): TemplateDefinition {
  return isTemplateDefinition(spec) ? spec : { type: "default", version: 1, payload: spec };
}

export function visualSpecOf(spec: StoredTemplateSpec): TemplateSpec {
  const definition = definitionOf(spec);
  if (definition.type !== "default" || definition.version !== 1)
    throw new HtmlTemplateError(
      "template-type",
      "This definition is not a supported visual template.",
    );
  return templateSpecSchema.parse(definition.payload);
}

export function validateTemplate(
  spec: StoredTemplateSpec,
  types: readonly TemplateType[] = TEMPLATE_TYPES,
): void {
  const definition = definitionOf(spec);
  const type = types.find(
    (entry) => entry.type === definition.type && entry.version === definition.version,
  );
  if (type === undefined)
    throw new HtmlTemplateError(
      "template-type",
      `Unsupported template type or version: ${definition.type} v${String(definition.version)}.`,
    );
  type.validate(definition);
}

export function fromDefinition(
  id: string,
  name: string,
  spec: StoredTemplateSpec,
  types: readonly TemplateType[] = TEMPLATE_TYPES,
): Template {
  if (!isTemplateDefinition(spec)) return fromSpec(id, name, spec);
  const type = types.find((entry) => entry.type === spec.type && entry.version === spec.version);
  if (type?.html === undefined)
    throw new HtmlTemplateError(
      "template-type",
      `No HTML renderer is installed for ${spec.type} v${String(spec.version)}.`,
    );
  return type.html(id, name, spec);
}
