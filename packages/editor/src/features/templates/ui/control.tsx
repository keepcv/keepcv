import type { ConfigField, TemplateConfig } from "@keepcv/templates";
import { RangeField, SelectField } from "../../../components/ui/field.js";

// One control for a declared field, so the resume's fit settings and the
// template editor's design settings cannot drift into two ways of drawing the
// same knob.
export function Control({
  field,
  config,
  onChange,
}: {
  field: ConfigField;
  config: TemplateConfig;
  onChange: (value: string | number) => void;
}) {
  const value = config[field.key];

  if (field.kind === "choice") {
    return (
      <SelectField
        label={field.label}
        options={field.options}
        value={typeof value === "string" ? value : field.default}
        onChange={onChange}
      />
    );
  }

  return (
    <RangeField
      label={field.label}
      min={field.min}
      max={field.max}
      step={field.step}
      unit={field.unit}
      value={typeof value === "number" ? value : field.default}
      onChange={onChange}
    />
  );
}
