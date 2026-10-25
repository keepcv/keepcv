import type { ConfigField, TemplateConfig } from "@keepcv/templates";
import { useId } from "react";
import { Button } from "../../../components/ui/button.js";
import { RangeField, SelectField } from "../../../components/ui/field.js";

export function Control({
  field,
  config,
  onChange,
  hint,
  precise = false,
}: {
  field: ConfigField;
  config: TemplateConfig;
  onChange: (value: string | number) => void;
  hint?: string;
  precise?: boolean;
}) {
  const id = useId();
  const value = config[field.key];

  if (field.kind === "color") {
    const color = typeof value === "string" ? value : field.default;
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-xs font-medium text-text-muted">
          {field.label}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={color || "#101418"}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={`${id}-hint`}
            className="h-8 w-12 cursor-pointer rounded border border-line bg-surface"
          />
          <span className="text-xs tabular-nums text-text-muted">{color || "Preset color"}</span>
          <Button size="sm" tone="ghost" disabled={color === ""} onClick={() => onChange("")}>
            Use preset color
          </Button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-text-subtle">
          {hint ?? "Pick any color, or keep the preset accent."}
        </p>
      </div>
    );
  }

  if (field.kind === "choice") {
    return (
      <SelectField
        label={field.label}
        {...(hint === undefined ? {} : { hint })}
        options={field.options}
        value={typeof value === "string" ? value : field.default}
        onChange={onChange}
      />
    );
  }

  return (
    <RangeField
      label={field.label}
      {...(hint === undefined ? {} : { hint })}
      min={field.min}
      max={field.max}
      step={field.step}
      unit={field.unit}
      precise={precise}
      value={typeof value === "number" ? value : field.default}
      onChange={onChange}
    />
  );
}
