import { compile, live } from "@keepcv/core";
import type { ResumeDocument, Store, StoredTemplateSpec } from "@keepcv/schema";
import { FIXTURE_DOCUMENT, fromDefinition } from "@keepcv/templates";
import { useEffect, useMemo, useState } from "react";
import { SelectField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { LintPanel } from "../../resumes/ui/lint-report.js";
import { PaperPreview } from "../../resumes/ui/paper-preview.js";
import { SAMPLE_DOCUMENT } from "../model/sample.js";

function contrastOnWhite(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 1.05 / (red * 0.2126 + green * 0.7152 + blue * 0.0722 + 0.05);
}

export function BuilderPreview({
  store,
  id,
  name,
  spec,
  sourceResumeId,
  onDocument,
}: {
  store: Store;
  id: string;
  name: string;
  spec: StoredTemplateSpec;
  sourceResumeId?: string | undefined;
  onDocument?: (document: ResumeDocument) => void;
}) {
  const [source, setSource] = useState(sourceResumeId ?? "sample");
  const resumes = live(store.resumes);
  const resume = resumes.find((row) => row.id === source);
  const document = useMemo(() => {
    const content =
      source === "coverage"
        ? FIXTURE_DOCUMENT
        : resume === undefined
          ? SAMPLE_DOCUMENT
          : (compile(store, resume.id, { generatedAt: SAMPLE_DOCUMENT.meta.generatedAt }) ??
            SAMPLE_DOCUMENT);
    return {
      ...content,
      meta: {
        ...content.meta,
        templateId: id,
        templateName: name,
        templateSpec: spec,
        templateConfig: {},
      },
    };
  }, [store, resume, id, name, spec, source]);
  useEffect(() => onDocument?.(document), [document, onDocument]);
  const built = useMemo(() => {
    try {
      return fromDefinition(id, name, spec);
    } catch {
      return undefined;
    }
  }, [id, name, spec]);
  const color = built?.defaultConfig["accentColor"];
  const lowContrast = typeof color === "string" && color !== "" && contrastOnWhite(color) < 4.5;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="shrink-0 space-y-2">
        <SelectField
          label="Preview content"
          value={resume?.id ?? (source === "coverage" ? "coverage" : "sample")}
          options={[
            { value: "sample", label: "Sample resume" },
            ...resumes.map((row) => ({ value: row.id, label: row.name })),
            { value: "coverage", label: "Test content - all supported types" },
          ]}
          onChange={setSource}
          hint="Preview only; uses template defaults and does not change the selected resume."
        />
        {lowContrast ? (
          <p role="status" className="text-xs text-caution-text">
            The custom accent has low contrast on white. Choose a darker color for readable
            headings.
          </p>
        ) : null}
      </div>
      <PaperPreview document={document} />
      <Panel collapsible className="shrink-0">
        <PanelHeader title="Readability checks" />
        <PanelBody className="max-h-56 overflow-y-auto">
          <LintPanel document={document} />
        </PanelBody>
      </Panel>
    </div>
  );
}
