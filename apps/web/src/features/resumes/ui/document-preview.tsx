import type { Resume, ResumeDocument } from "@keepcv/schema";
import type { ConfigField, Template, TemplateConfig } from "@keepcv/templates";
import { resolveTemplate, TEMPLATES } from "@keepcv/templates";
import { useEffect, useState } from "react";
import { RangeField, SelectField } from "../../../components/ui/field.js";
import type { ApiClient } from "../../../lib/api.js";
import { usePatchResume } from "../api/use-resumes.js";
import { TemplateFrame } from "./template-frame.js";

// Long enough that dragging a slider is one write rather than forty. Each one
// carries the row's `updatedAt`, and a burst would race its own answers.
const SETTLES_AFTER = 500;

// Only what differs from the template's own defaults, so a default that moves in
// a later version moves with it (application-structure.md #5.5).
function overrides(template: Template, config: TemplateConfig): TemplateConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([key, value]) => template.defaultConfig[key] !== value),
  );
}

function Control({
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

export function DocumentPreview({
  client,
  resume,
  document,
}: {
  client: ApiClient;
  resume: Resume;
  document: ResumeDocument;
}) {
  const stored = resolveTemplate(document);
  const patch = usePatchResume(client);
  const [pending, setPending] = useState<TemplateConfig | null>(null);
  const config = pending ?? stored.config;
  const { mutate } = patch;

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      mutate({
        resume,
        patch: {
          templateId: stored.template.id,
          templateConfig: overrides(stored.template, pending),
        },
      });
      setPending(null);
    }, SETTLES_AFTER);

    return () => {
      clearTimeout(timer);
    };
  }, [pending, resume, stored.template, mutate]);

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4">
        <SelectField
          label="Template"
          options={TEMPLATES.map((option) => ({ value: option.id, label: option.name }))}
          value={stored.template.id}
          onChange={(templateId) => {
            setPending(null);
            mutate({ resume, patch: { templateId, templateConfig: {} } });
          }}
        />

        {stored.template.fields.map((field) => (
          <Control
            key={field.key}
            field={field}
            config={config}
            onChange={(value) => {
              setPending({ ...config, [field.key]: value });
            }}
          />
        ))}

        <div className="rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-medium text-slate-600">What this template does</h3>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-500">
            {stored.template.complianceNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </aside>

      <TemplateFrame title={`${resume.name}, as it prints`} styles={stored.template.styles(config)}>
        {stored.template.render(document, config)}
      </TemplateFrame>
    </div>
  );
}
