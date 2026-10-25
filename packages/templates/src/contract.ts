import type { ResumeDocument, TemplateDefinition } from "@keepcv/schema";
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
      kind: "color";
      default: string;
    }
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

export interface Template {
  type?: string;
  definition?: TemplateDefinition;
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

export function defaultsOf(fields: readonly ConfigField[]): TemplateConfig {
  return Object.fromEntries(fields.map((field) => [field.key, field.default]));
}

export function withDefaults(
  fields: readonly ConfigField[],
  settings: Readonly<Record<string, unknown>>,
): ConfigField[] {
  return fields.map((field) => {
    const value = accepted(field, settings[field.key]);
    if (field.kind !== "number") {
      return typeof value === "string" ? { ...field, default: value } : field;
    }
    return typeof value === "number" ? { ...field, default: value } : field;
  });
}

export type ConfigOf<F extends readonly ConfigField[]> = {
  [K in F[number] as K["key"]]: K extends { options: readonly ConfigOption[] }
    ? K["options"][number]["value"]
    : K extends { kind: "color" }
      ? string
      : number;
};

export function configOf<F extends readonly ConfigField[]>(
  fields: F,
  config: TemplateConfig,
): ConfigOf<F> {
  return { ...defaultsOf(fields), ...config } as ConfigOf<F>;
}

function accepted(field: ConfigField, raw: unknown): ConfigValue | undefined {
  if (field.kind === "color") {
    return typeof raw === "string" && /^(?:#[0-9a-f]{6})?$/i.test(raw) ? raw : undefined;
  }
  if (field.kind === "choice") {
    return typeof raw === "string" && field.options.some((option) => option.value === raw)
      ? raw
      : undefined;
  }
  return typeof raw === "number" && raw >= field.min && raw <= field.max ? raw : undefined;
}

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
