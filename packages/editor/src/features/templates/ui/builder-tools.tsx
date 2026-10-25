import {
  type Resume,
  type Store,
  type StoredTemplate,
  templateSpecSchema,
  type Uuid,
} from "@keepcv/schema";
import { definitionOf, visualSpecOf } from "@keepcv/templates";
import { useEffect, useRef, useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { TextAreaField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { saveFile } from "../../../lib/files.js";
import type { TemplateEdit } from "../api/use-template-edit.js";
import { designFile, designFileName, readDesign } from "../model/design-file.js";

export function BuilderActions({
  state,
  existing,
  fromResume,
  reading,
  onSave,
  onCopy,
}: {
  state: TemplateEdit;
  existing: boolean;
  fromResume: Uuid | undefined;
  reading: boolean;
  onSave: () => void;
  onCopy: () => void;
}) {
  return (
    <>
      {fromResume === undefined ? null : (
        <ButtonLink
          to="/resumes/$resumeId"
          params={{ resumeId: fromResume }}
          search={{ view: "preview" }}
        >
          Back to resume
        </ButtonLink>
      )}
      <Button
        disabled={state.saving || reading}
        icon="download"
        onClick={() =>
          saveFile(
            designFileName(state.edit.name),
            "application/json",
            designFile(state.edit.name.trim(), state.edit.spec),
          )
        }
      >
        Download template file
      </Button>
      {existing ? (
        <Button
          disabled={state.cssProblem !== undefined || state.saving || reading}
          onClick={onCopy}
        >
          Save as new template
        </Button>
      ) : null}
      <Button
        tone="primary"
        icon="confirm"
        pending={state.saving}
        disabled={!state.valid || reading || (existing && !state.pending)}
        onClick={onSave}
      >
        Save template
      </Button>
    </>
  );
}

function status(state: TemplateEdit, existing: boolean) {
  if (state.saving) return "Saving template";
  if (state.error !== null) return "Could not save";
  if (state.pending || !existing) return "Unsaved changes - kept in this browser";
  return "Saved";
}

export function BuilderToolbar({ state, existing }: { state: TemplateEdit; existing: boolean }) {
  const definition = definitionOf(state.edit.spec);
  const visual =
    definition.type === "default" && definition.version === 1
      ? templateSpecSchema.safeParse(definition.payload).data
      : undefined;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line pb-3">
      <Button
        size="sm"
        icon="revert"
        disabled={!state.canUndo || state.saving}
        onClick={() => state.travel("past")}
      >
        Undo
      </Button>
      <Button
        size="sm"
        disabled={!state.canRedo || state.saving}
        onClick={() => state.travel("future")}
      >
        Redo
      </Button>
      {visual !== undefined ? (
        <Button
          size="sm"
          tone="ghost"
          disabled={Object.keys(visual.settings).length === 0 || state.saving}
          onClick={() =>
            state.change({
              ...state.edit,
              spec: { ...visual, settings: {} },
            })
          }
        >
          Reset controls
        </Button>
      ) : null}
      <p role="status" className="ml-auto text-xs text-text-subtle">
        {status(state, existing)}
      </p>
    </div>
  );
}

export function TemplateIdentity({
  state,
  usedBy,
  archived,
}: {
  state: TemplateEdit;
  usedBy: Resume[];
  archived: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="My template"
        aside={
          <Badge>
            {definitionOf(state.edit.spec).type === "html"
              ? "HTML"
              : definitionOf(state.edit.spec).type === "default"
                ? "Default (visual)"
                : definitionOf(state.edit.spec).type}
          </Badge>
        }
      />
      <PanelBody className="space-y-3">
        <TextField
          label="Template name"
          value={state.edit.name}
          onChange={(name) => state.change({ ...state.edit, name })}
          error={state.pending ? state.nameProblem : undefined}
          placeholder="My resume template"
        />
        {usedBy.length === 0 ? null : (
          <details className="text-xs text-text-muted">
            <summary className="cursor-pointer">
              Saving updates {String(usedBy.length)} {usedBy.length === 1 ? "resume" : "resumes"}
            </summary>
            <ul className="mt-2 space-y-1">
              {usedBy.map((resume) => (
                <li key={resume.id}>{resume.name}</li>
              ))}
            </ul>
          </details>
        )}
        {archived ? <Badge tone="warning">Archived</Badge> : null}
        <Button size="sm" tone="ghost" disabled={!state.pending} onClick={state.discard}>
          Discard changes
        </Button>
      </PanelBody>
    </Panel>
  );
}

export function CustomCss({ state }: { state: TemplateEdit }) {
  return (
    <Panel collapsible defaultOpen={state.cssProblem !== undefined}>
      <PanelHeader title="Custom CSS" aside={<Badge>Advanced</Badge>}>
        Optional local overrides; external resources are refused.
      </PanelHeader>
      <PanelBody className="space-y-3">
        <TextAreaField
          label="Extra CSS"
          value={visualSpecOf(state.edit.spec).extraCss}
          rows={6}
          error={state.cssProblem}
          onChange={(extraCss) =>
            state.change({ ...state.edit, spec: { ...visualSpecOf(state.edit.spec), extraCss } })
          }
          placeholder=".kc-name { letter-spacing: 0; }"
        />
        {state.cssProblem === undefined ? null : (
          <p className="text-xs text-caution-text">
            This CSS is omitted from the preview. Correct it before saving or downloading.
          </p>
        )}
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">Styling and file reference</summary>
          <p className="mt-2 leading-relaxed">
            Style .kc-name, .kc-header, .kc-heading, .kc-entry or .kc-points. Keep text visible and
            in reading order. CSS is limited to 4,000 characters.
          </p>
          <p className="mt-2 leading-relaxed">
            A template file is JSON containing name and spec. The spec contains settings and
            extraCss. Download template file writes this format; Import template reads it.
          </p>
        </details>
      </PanelBody>
    </Panel>
  );
}

export function ImportTemplate({
  onLoad,
  onBusy,
}: {
  onLoad: (name: string, spec: TemplateEdit["edit"]["spec"]) => void;
  onBusy: (reading: boolean) => void;
}) {
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const attempt = useRef(0);
  const latest = useRef({ onLoad, onBusy });
  latest.current = { onLoad, onBusy };
  useEffect(
    () => () => {
      attempt.current += 1;
    },
    [],
  );
  const read = async (file: File) => {
    const id = ++attempt.current;
    latest.current.onBusy(true);
    setProblem(undefined);
    try {
      const answer = readDesign(await file.text());
      if (id !== attempt.current) return;
      if ("problem" in answer) setProblem(answer.problem);
      else latest.current.onLoad(answer.design.name, answer.design.spec);
    } catch {
      if (id === attempt.current) setProblem("The file could not be read. Choose it again.");
    } finally {
      if (id === attempt.current) latest.current.onBusy(false);
    }
  };
  return (
    <Panel>
      <PanelHeader title="Import template">
        Choose a KeepCV template JSON file. It becomes your own editable copy.
      </PanelHeader>
      <PanelBody>
        <label className="block space-y-2 text-xs text-text-muted">
          <span>Template file</span>
          <input
            type="file"
            accept=".json,application/json"
            className="block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void read(file);
              event.target.value = "";
            }}
          />
        </label>
        {problem === undefined ? null : (
          <p role="alert" className="mt-2 text-xs text-critical-text">
            {problem}
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}

export function SaveTemplateCopy({
  state,
  store,
  onClose,
  onSaved,
}: {
  state: TemplateEdit;
  store: Store;
  onClose: () => void;
  onSaved: (template: StoredTemplate) => void;
}) {
  const [name, setName] = useState(`${state.edit.name} copy`);
  const clash = store.templates.some((row) => row.name === name.trim());
  return (
    <Dialog title="Save as new template" onClose={onClose}>
      <div className="space-y-4 p-4">
        <TextField
          label="New template name"
          value={name}
          onChange={setName}
          error={clash ? "A template of yours already has that name." : undefined}
        />
        <p className="text-sm text-text-muted">
          The original template and its resumes stay unchanged.
        </p>
        <Button
          tone="primary"
          pending={state.saving}
          disabled={name.trim() === "" || clash}
          onClick={() => {
            void state.save(name).then((stored) => {
              if (stored !== undefined) onSaved(stored);
            });
          }}
        >
          Save copy
        </Button>
        {state.error === null ? null : <Failure error={state.error} />}
      </div>
    </Dialog>
  );
}

export function LeaveTemplate({
  state,
  onLeave,
  onStay,
}: {
  state: TemplateEdit;
  onLeave: () => void;
  onStay: () => void;
}) {
  return (
    <Dialog title="Unsaved template changes" onClose={onStay}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-text-muted">
          Your draft is kept in this browser. It has not changed the saved template.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            tone="primary"
            pending={state.saving}
            disabled={!state.valid}
            onClick={() => {
              void state.save().then((stored) => {
                if (stored !== undefined) onLeave();
              });
            }}
          >
            Save and leave
          </Button>
          <Button onClick={onLeave} disabled={state.saving}>
            Keep draft and leave
          </Button>
          <Button tone="ghost" onClick={onStay}>
            Keep editing
          </Button>
        </div>
        {state.error === null ? null : <Failure error={state.error} />}
      </div>
    </Dialog>
  );
}
