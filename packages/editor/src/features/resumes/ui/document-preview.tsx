import type { LengthBudget, Pagination } from "@keepcv/core";
import { lengthBudget } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { cn } from "../../../lib/cn.js";
import { templateRowFor } from "../../templates/model/template-rows.js";
import { Control } from "../../templates/ui/control.js";
import { TemplateChooser } from "../../templates/ui/template-chooser.js";
import { TemplateDataDisclosure } from "../../templates/ui/template-data.js";
import type { ResumeSettings } from "../api/use-resume-settings.js";
import { LintPanel } from "./lint-report.js";
import { PaperPreview } from "./paper-preview.js";

const LIMITS = [
  { value: "", label: "No limit" },
  { value: "1", label: "One page" },
  { value: "2", label: "Two pages" },
  { value: "3", label: "Three pages" },
];

function FitControls({
  store,
  settings,
  budget,
}: {
  store: Store;
  settings: ResumeSettings;
  budget: LengthBudget;
}) {
  const row = templateRowFor(store, settings.template.id);
  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Fit this resume">These settings affect this resume only.</PanelHeader>
        <PanelBody className="space-y-4">
          {settings.template.fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Control
                field={field}
                config={settings.config}
                onChange={(value) => settings.fit(field.key, value)}
              />
              {settings.resume.templateConfig[field.key] === undefined ? null : (
                <Button size="sm" tone="ghost" onClick={() => settings.reset(field.key)}>
                  Reset {field.label}
                </Button>
              )}
            </div>
          ))}
          <Button
            size="sm"
            disabled={Object.keys(settings.resume.templateConfig).length === 0}
            onClick={() => settings.reset()}
          >
            Reset fit to template defaults
          </Button>
          {settings.template.type === "html" ? (
            <p className="text-xs text-text-subtle">
              Page limit estimates are unavailable for authored HTML. Check print preview.
            </p>
          ) : (
            <SelectField
              label="Page limit"
              value={settings.resume.pageLimit === null ? "" : String(settings.resume.pageLimit)}
              options={LIMITS}
              onChange={(value) =>
                settings.change({ pageLimit: value === "" ? null : Number(value) })
              }
            />
          )}
          {settings.template.type === "html" || budget.fits || budget.limit === null ? null : (
            <div className="space-y-2 text-xs text-caution-text">
              <p>
                {String(budget.pages)} pages, over the {String(budget.limit)}-page limit.
              </p>
              <ul>
                {budget.over.slice(0, 5).map((piece) => (
                  <li key={piece.key}>{piece.label}</li>
                ))}
              </ul>
            </div>
          )}
        </PanelBody>
      </Panel>
      <Panel collapsible>
        <PanelHeader title="Readability checks" />
        <PanelBody>
          <LintPanel document={settings.document} />
        </PanelBody>
      </Panel>
      <TemplateDataDisclosure document={settings.document} label="Template data" />
      <details className="text-xs text-text-muted">
        <summary className="cursor-pointer">Template actions</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink
            size="sm"
            to="/templates/new"
            search={{ basedOn: settings.template.id, from: settings.resume.id }}
          >
            Make a copy and customize
          </ButtonLink>
          {row?.row === undefined ? null : (
            <ButtonLink
              size="sm"
              to="/templates/$templateId"
              params={{ templateId: row.id }}
              search={{ from: settings.resume.id }}
            >
              Edit reusable template ({String(row.usedBy)} {row.usedBy === 1 ? "resume" : "resumes"}
              )
            </ButtonLink>
          )}
          <ButtonLink
            size="sm"
            to="/templates/$templateId"
            params={{ templateId: settings.template.id }}
          >
            Template details
          </ButtonLink>
        </div>
      </details>
    </div>
  );
}

export function DocumentPreview({
  store,
  settings,
  suggestedTemplateId,
}: {
  store: Store;
  settings: ResumeSettings;
  suggestedTemplateId?: string | undefined;
}) {
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(suggestedTemplateId !== undefined);
  const [controls, setControls] = useState(false);
  const [mobileView, setMobileView] = useState<"preview" | "controls">("preview");
  const [pagination, setPagination] = useState<Pagination>({ pages: 1, pageOf: {}, breaks: [] });
  const report = useCallback((next: Pagination) => setPagination(next), []);
  useEffect(() => {
    if (suggestedTemplateId !== undefined) setChoosing(true);
  }, [suggestedTemplateId]);
  const row = templateRowFor(store, settings.template.id);
  const budget = lengthBudget(settings.document, pagination, settings.resume.pageLimit);
  const overLimit = settings.template.type !== "html" && !budget.fits;
  const controlsVisible = controls || mobileView === "controls";
  const closeChooser = () => {
    setChoosing(false);
    if (suggestedTemplateId !== undefined)
      void navigate({
        to: "/resumes/$resumeId",
        params: { resumeId: settings.resume.id },
        search: { view: "preview" },
        replace: true,
      });
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text">{row?.name ?? settings.template.name}</span>
        <Badge>{row?.isBuiltIn === false ? "My template" : "System"}</Badge>
        {row?.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <Button size="sm" onClick={() => setChoosing(true)}>
          Change template
        </Button>
        <Button
          size="sm"
          expanded={controls}
          className="hidden @3xl:inline-flex"
          onClick={() => setControls(!controls)}
        >
          {controls ? "Hide controls" : "Fit and checks"}
        </Button>
        {overLimit ? <span className="text-xs text-caution-text">Over page limit</span> : null}
      </div>
      <fieldset aria-label="Design view" className="flex shrink-0 gap-2 @3xl:hidden">
        <Button
          tone={mobileView === "preview" ? "primary" : "secondary"}
          onClick={() => setMobileView("preview")}
        >
          Preview
        </Button>
        <Button
          tone={mobileView === "controls" ? "primary" : "secondary"}
          onClick={() => setMobileView("controls")}
        >
          Controls
        </Button>
      </fieldset>
      <div
        className={cn(
          "grid min-h-0 min-w-0 flex-1 gap-4",
          controls && "@3xl:grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        {controlsVisible ? (
          <div
            className={cn(
              "min-h-0 overflow-y-auto pr-2",
              mobileView === "preview" && "hidden",
              controls ? "@3xl:block" : "@3xl:hidden",
            )}
          >
            <FitControls store={store} settings={settings} budget={budget} />
          </div>
        ) : null}
        <div className={cn("min-h-0 min-w-0", mobileView === "controls" && "hidden @3xl:block")}>
          <PaperPreview
            document={settings.document}
            pageLimit={settings.resume.pageLimit}
            onPaginate={report}
          />
        </div>
      </div>
      {choosing ? (
        <TemplateChooser
          store={store}
          document={settings.document}
          currentId={suggestedTemplateId ?? settings.template.id}
          actionLabel="Apply to this resume"
          allowFitReset
          onClose={closeChooser}
          onChoose={(templateId, resetFit) => {
            settings.change({ templateId, ...(resetFit ? { templateConfig: {} } : {}) });
            closeChooser();
          }}
        />
      ) : null}
    </div>
  );
}
