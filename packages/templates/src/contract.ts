import type { ResumeDocument } from "@keepcv/schema";
import type { ReactElement } from "react";

export type ConfigValue = string | number;

export type TemplateConfig = Record<string, ConfigValue>;

export interface ConfigOption {
  value: string;
  label: string;
}

export type ConfigField =
  | {
      key: string;
      label: string;
      kind: "choice";
      options: readonly ConfigOption[];
      default: string;
    }
  | {
      key: string;
      label: string;
      kind: "number";
      min: number;
      max: number;
      step: number;
      unit: string;
      default: number;
    };

// `styles` and `render` are handed the document and the config and nothing
// else, which is what makes a template unable to fetch.
export interface Template {
  id: string;
  name: string;
  version: string;
  documentVersions: readonly number[];
  fields: readonly ConfigField[];
  defaultConfig: TemplateConfig;
  complianceNotes: readonly string[];
  styles: (config: TemplateConfig) => string;
  render: (document: ResumeDocument, config: TemplateConfig) => ReactElement;
}

export type TemplateDefinition = Omit<Template, "defaultConfig">;

export function defineTemplate(definition: TemplateDefinition): Template {
  return { ...definition, defaultConfig: defaultsOf(definition.fields) };
}

function defaultsOf(fields: readonly ConfigField[]): TemplateConfig {
  return Object.fromEntries(fields.map((field) => [field.key, field.default]));
}

// The keys a template reads, and the values each choice can take, derived from
// the fields it declares so the two cannot drift.
export type ConfigOf<F extends readonly ConfigField[]> = {
  [K in F[number] as K["key"]]: K extends { options: readonly ConfigOption[] }
    ? K["options"][number]["value"]
    : number;
};

export function configOf<F extends readonly ConfigField[]>(
  fields: F,
  config: TemplateConfig,
): ConfigOf<F> {
  return { ...defaultsOf(fields), ...config } as ConfigOf<F>;
}

function accepted(field: ConfigField, raw: unknown): ConfigValue | undefined {
  if (field.kind === "choice") {
    return typeof raw === "string" && field.options.some((option) => option.value === raw)
      ? raw
      : undefined;
  }
  return typeof raw === "number" && raw >= field.min && raw <= field.max ? raw : undefined;
}

// A stored config outlives the template version that wrote it: a key the
// template has since dropped is ignored, one it has added takes its default,
// and a value outside the declared range is refused rather than rendered.
export function configFor(
  template: Template,
  stored: Readonly<Record<string, unknown>> | undefined,
): TemplateConfig {
  const config = { ...template.defaultConfig };
  for (const field of template.fields) {
    const value = accepted(field, stored?.[field.key]);
    if (value !== undefined) config[field.key] = value;
  }
  return config;
}
