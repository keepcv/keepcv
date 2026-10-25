import { resumesUsingTemplate } from "@keepcv/core";
import type {
  ResumeDocument,
  Store,
  StoredTemplate,
  StoredTemplateSpec,
  Uuid,
} from "@keepcv/schema";
import { definitionOf, fromDefinition, visualSpecOf } from "@keepcv/templates";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { PageHeader } from "../../../components/ui/page.js";
import type { ApiClient } from "../../../lib/api.js";
import { cn } from "../../../lib/cn.js";
import { type TemplateEdit, useTemplateEdit } from "../api/use-template-edit.js";
import { SAMPLE_DOCUMENT } from "../model/sample.js";
import { BuilderControls } from "./builder-controls.js";
import { BuilderPreview } from "./builder-preview.js";
import {
  BuilderActions,
  BuilderToolbar,
  CustomCss,
  ImportTemplate,
  LeaveTemplate,
  SaveTemplateCopy,
  TemplateIdentity,
} from "./builder-tools.js";
import { HtmlWorkspace } from "./html-workspace.js";

function shortcut(event: KeyboardEvent, state: TemplateEdit, save: () => Promise<void>) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    void save();
    return;
  }
  if (!["z", "y"].includes(key)) return;
  if (state.saving) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.matches("input,textarea,select,[contenteditable=true]")
  )
    return;
  event.preventDefault();
  state.travel(event.shiftKey || key === "y" ? "future" : "past");
}

export function TemplateBuilder({
  store,
  client,
  template,
  startingSpec,
  startingName = "",
  recoveryKey,
  fromResume,
  importing = false,
}: {
  store: Store;
  client: ApiClient;
  template?: StoredTemplate;
  startingSpec: StoredTemplateSpec;
  startingName?: string;
  recoveryKey: string;
  fromResume?: Uuid | undefined;
  importing?: boolean;
}) {
  const state = useTemplateEdit(client, store, recoveryKey, template, startingSpec, startingName);
  const { edit, change } = state;
  const navigate = useNavigate();
  const allowLeave = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: () => state.pending && !allowLeave.current,
    withResolver: true,
    enableBeforeUnload: false,
  });
  const [view, setView] = useState<"controls" | "preview">("controls");
  const [copying, setCopying] = useState(false);
  const [reading, setReading] = useState(false);
  const definition = definitionOf(edit.spec);
  const type = definition.type;
  const html = type === "html" && definition.version === 1;
  let built: ReturnType<typeof fromDefinition> | undefined;
  try {
    built = fromDefinition(edit.id, edit.name, edit.spec);
  } catch {
    built = undefined;
  }
  let visual: ReturnType<typeof visualSpecOf> | undefined;
  try {
    visual = type === "default" ? visualSpecOf(edit.spec) : undefined;
  } catch {
    visual = undefined;
  }
  const [document, setDocument] = useState<ResumeDocument>(SAMPLE_DOCUMENT);
  const usedBy = resumesUsingTemplate(store, edit.id);
  const afterCreate = async (stored: StoredTemplate) => {
    allowLeave.current = true;
    if (fromResume === undefined)
      await navigate({ to: "/templates/$templateId", params: { templateId: stored.id } });
    else
      await navigate({
        to: "/resumes/$resumeId",
        params: { resumeId: fromResume },
        search: { view: "preview", template: stored.id },
      });
  };
  const save = async () => {
    if (reading) return;
    const stored = await state.save();
    if (stored !== undefined && template === undefined) await afterCreate(stored);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (copying || blocker.status === "blocked") return;
      shortcut(event, state, save);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const failure = state.error !== null && !copying && blocker.status !== "blocked";
  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title={template?.name ?? "Create template"}
        icon="template"
        trail={[{ label: "Templates", to: "/templates", search: { archived: "exclude" } }]}
        actions={
          <BuilderActions
            state={state}
            existing={template !== undefined}
            fromResume={fromResume}
            reading={reading}
            onSave={() => {
              void save();
            }}
            onCopy={() => setCopying(true)}
          />
        }
      >
        {template === undefined
          ? "Build a reusable layout. Save it when you are ready."
          : "My template. Save changes to update its current use; saved versions keep their design."}
      </PageHeader>
      <BuilderToolbar state={state} existing={template !== undefined} />
      {failure ? (
        <div className="flex flex-wrap items-center gap-3">
          <Failure error={state.error} />
          <Button
            disabled={!state.valid || state.saving}
            onClick={() => {
              void save();
            }}
          >
            Retry saving
          </Button>
        </div>
      ) : null}
      <fieldset aria-label="Builder view" className="flex shrink-0 gap-2 @4xl:hidden">
        <Button
          tone={view === "controls" ? "primary" : "secondary"}
          onClick={() => setView("controls")}
        >
          Edit template
        </Button>
        <Button
          tone={view === "preview" ? "primary" : "secondary"}
          onClick={() => setView("preview")}
        >
          Preview
        </Button>
      </fieldset>
      <div className="grid min-h-0 min-w-0 flex-1 gap-5 @4xl:grid-cols-[minmax(21rem,0.85fr)_minmax(0,1fr)]">
        <fieldset
          disabled={state.saving}
          className={cn(
            "min-h-0 min-w-0 space-y-4 overflow-y-auto pr-2",
            view === "preview" && "hidden @4xl:block",
          )}
        >
          <TemplateIdentity state={state} usedBy={usedBy} archived={template?.archivedAt != null} />
          {importing ? (
            <ImportTemplate
              onBusy={setReading}
              onLoad={(name, spec) =>
                change({ ...edit, name: edit.name.trim() === "" ? name : edit.name, spec })
              }
            />
          ) : null}
          {html ? (
            <HtmlWorkspace state={state} document={document} template={built} />
          ) : visual !== undefined ? (
            <>
              <BuilderControls
                config={built?.defaultConfig ?? {}}
                spec={visual}
                onChange={(spec) => change({ ...edit, spec })}
              />
              <CustomCss state={state} />
            </>
          ) : (
            <p role="alert" className="text-xs text-critical-text">
              This template type is unavailable. Its source is preserved; download the file for
              recovery.
            </p>
          )}
        </fieldset>
        <div className={cn("min-h-0 min-w-0", view === "controls" && "hidden @4xl:block")}>
          <BuilderPreview
            store={store}
            id={edit.id}
            name={edit.name || "New template"}
            spec={edit.spec}
            onDocument={setDocument}
            sourceResumeId={fromResume}
          />
        </div>
      </div>
      {copying ? (
        <SaveTemplateCopy
          state={state}
          store={store}
          onClose={() => setCopying(false)}
          onSaved={(stored) => {
            void afterCreate(stored);
          }}
        />
      ) : null}
      {blocker.status === "blocked" ? (
        <LeaveTemplate state={state} onLeave={blocker.proceed} onStay={blocker.reset} />
      ) : null}
    </div>
  );
}
