import { phrasingsOfSet, projectPlainText, resumesUsingPhrasing } from "@keepcv/core";
import {
  PHRASING_VARIANTS,
  type Phrasing,
  type PhrasingSet,
  type PhrasingVariant,
  type RichText,
  type Store,
  type Uuid,
} from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import {
  useAddVariant,
  useSetCanonical,
  useSetPhrasingArchived,
  useUpdatePhrasing,
} from "../api/use-phrasings.js";
import { buildVariant, VARIANT_HINTS, WORDING_LABELS } from "../model/editor.js";
import { type EditorStatus, usePhrasingText } from "../model/use-phrasing-text.js";
import { MarkupInput } from "./markup-input.js";
import { PhrasingHistory } from "./phrasing-history.js";
import { RichBody } from "./rich-body.js";

const STATUS_NOTES: Record<EditorStatus, string> = {
  clean: "",
  typing: "Not saved yet",
  "draft-kept": "Kept as a draft",
  committing: "Saving",
  committed: "Saved",
};

const TEXT_BUTTON = "text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline";

function UsedBy({ store, phrasingId }: { store: Store; phrasingId: Uuid }) {
  const resumes = resumesUsingPhrasing(store, phrasingId);
  if (resumes.length === 0) return null;

  return (
    <details className="text-xs text-text-subtle">
      <summary className="cursor-pointer underline-offset-2 hover:text-text hover:underline">
        Used in {resumes.length} {resumes.length === 1 ? "resume" : "resumes"}
      </summary>
      <ul className="mt-1 space-y-1">
        {resumes.map((resume) => (
          <li key={resume.id}>
            <Link
              to="/resumes/$resumeId"
              params={{ resumeId: resume.id }}
              search={{ view: "composition" }}
              className="underline-offset-2 hover:underline"
            >
              {resume.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DraftWaiting({
  text,
  onRestore,
  onDiscard,
}: {
  text: RichText;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-lg border border-caution/40 bg-caution-soft px-3 py-2">
      <p className="text-xs font-medium text-caution-text">An unfinished draft is available.</p>
      <p className="mt-1 text-sm text-caution-text">
        <RichBody body={text} />
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onRestore}>Restore draft</Button>
        <Button tone="danger" onClick={onDiscard}>
          Discard draft
        </Button>
      </div>
    </div>
  );
}

function Label({ client, phrasing }: { client: ApiClient; phrasing: Phrasing }) {
  const update = useUpdatePhrasing(client);
  const [label, setLabel] = useState(phrasing.label ?? "");
  const trimmed = label.trim();

  return (
    <input
      value={label}
      aria-label="Wording label"
      placeholder="Name (optional)"
      onChange={(event) => {
        setLabel(event.target.value);
      }}
      onBlur={() => {
        if (trimmed === (phrasing.label ?? "")) return;
        update.mutate({ phrasing, patch: { label: trimmed === "" ? null : trimmed } });
      }}
      className="w-40 border-b border-transparent bg-transparent text-xs text-text-muted outline-none placeholder:text-text-subtle hover:border-line-strong focus:border-brand"
    />
  );
}

function Wording({
  store,
  client,
  set,
  phrasing,
  order,
  expanded,
}: {
  store: Store;
  client: ApiClient;
  set: PhrasingSet;
  phrasing: Phrasing;
  order: Reorder<Phrasing>;
  expanded: boolean;
}) {
  const text = usePhrasingText(client, store, phrasing);
  const update = useUpdatePhrasing(client);
  const canonical = useSetCanonical(client);
  const setArchived = useSetPhrasingArchived(client);
  const [showing, setShowing] = useState(false);

  const isCanonical = set.canonicalPhrasingId === phrasing.id;
  const isArchived = phrasing.archivedAt !== null;

  return (
    <div
      {...order.rowProps(phrasing)}
      data-archived={isArchived}
      className="space-y-2 rounded-lg border border-line p-3 data-[archived=true]:opacity-60 data-[held=true]:opacity-40"
    >
      <details
        className="group/wording"
        open={expanded || text.waiting !== undefined || text.error !== null || undefined}
      >
        <summary className="cursor-pointer list-none space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">
              {phrasing.label || `${WORDING_LABELS[phrasing.variant]} wording`}
            </span>
            {isCanonical ? <Badge tone="accent">Default</Badge> : null}
            {isArchived ? <Badge tone="warning">Archived</Badge> : null}
            <span className="ml-auto text-xs tabular-nums text-text-subtle group-open/wording:hidden">
              {projectPlainText(text.typed).length} characters
            </span>
            <span className="text-xs text-text-muted group-open/wording:hidden">Edit</span>
            <span className="ml-auto hidden text-xs text-text-muted group-open/wording:inline">
              Collapse
            </span>
          </span>
          <span className="line-clamp-3 text-sm text-text-muted group-open/wording:hidden">
            <RichBody body={text.typed} />
          </span>
        </summary>
        <div className="space-y-2 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <DragGrip />
            <select
              value={phrasing.variant}
              aria-label="Wording type"
              onChange={(event) => {
                update.mutate({
                  phrasing,
                  patch: { variant: event.target.value as PhrasingVariant },
                });
              }}
              className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-text-muted"
            >
              {PHRASING_VARIANTS.map((option) => (
                <option key={option} value={option}>
                  {WORDING_LABELS[option]}
                </option>
              ))}
            </select>
            <Label client={client} phrasing={phrasing} />
            <span className="ml-auto flex items-center gap-2">
              <ReorderControls
                order={order}
                row={phrasing}
                subject={`the ${phrasing.variant} wording`}
              />
            </span>
          </div>

          {text.waiting === undefined ? null : (
            <DraftWaiting text={text.waiting} onRestore={text.restore} onDiscard={text.discard} />
          )}

          <MarkupInput
            body={text.typed}
            readOnly={isArchived}
            label={`Wording, ${phrasing.variant}`}
            onChange={text.onChange}
            onBlur={text.onBlur}
          />

          {text.error === null ? null : (
            <div>
              <Failure error={text.error} />
              <Button onClick={text.retry}>Retry saving wording</Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-subtle">
            <span className="tabular-nums">{projectPlainText(text.typed).length} characters</span>
            <span aria-live="polite">{STATUS_NOTES[text.status]}</span>
            <span className="ml-auto flex gap-3">
              {isCanonical || isArchived ? null : (
                <button
                  type="button"
                  className={TEXT_BUTTON}
                  onClick={() => {
                    canonical.mutate({ set, phrasingId: phrasing.id });
                  }}
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                className={TEXT_BUTTON}
                onClick={() => {
                  setShowing(!showing);
                }}
              >
                {showing ? "Hide history" : "History"}
              </button>
              {isCanonical ? null : (
                <button
                  type="button"
                  className={TEXT_BUTTON}
                  onClick={() => {
                    setArchived.mutate({ phrasing, archived: !isArchived });
                  }}
                >
                  {isArchived ? "Restore" : "Archive"}
                </button>
              )}
            </span>
          </div>

          <UsedBy store={store} phrasingId={phrasing.id} />

          {showing ? (
            <PhrasingHistory client={client} phrasing={phrasing} onRestore={text.onChange} />
          ) : null}
        </div>
      </details>
    </div>
  );
}

function AddWording({
  store,
  client,
  phrasingSetId,
  from,
  onAdded,
}: {
  store: Store;
  client: ApiClient;
  phrasingSetId: Uuid;
  from: RichText;
  onAdded: (phrasingId: Uuid) => void;
}) {
  const add = useAddVariant(client);
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<PhrasingVariant>("short");
  const [label, setLabel] = useState("");

  if (!open)
    return (
      <Button
        icon="add"
        expanded={false}
        onClick={() => {
          setOpen(true);
        }}
      >
        Add a wording
      </Button>
    );

  return (
    <form
      className="space-y-3 rounded-lg border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (add.isPending) return;
        add.mutate(buildVariant(store, { phrasingSetId, variant, label, body: from }), {
          onSuccess: (phrasing) => {
            setLabel("");
            setOpen(false);
            onAdded(phrasing.id);
          },
        });
      }}
    >
      <p className="text-xs text-text-muted">
        Starts with your default wording. Edit the copy after creating it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="New wording type"
          value={variant}
          onChange={(value) => {
            setVariant(value as PhrasingVariant);
          }}
          options={PHRASING_VARIANTS.map((value) => ({ value, label: WORDING_LABELS[value] }))}
          hint={VARIANT_HINTS[variant]}
        />
        <TextField
          label="Wording name (optional)"
          value={label}
          onChange={setLabel}
          placeholder="e.g. Leadership application"
        />
      </div>
      {add.error === null ? null : <Failure error={add.error} />}
      <div className="flex gap-2">
        <Button type="submit" tone="primary" disabled={add.isPending}>
          {add.isPending ? "Creating" : "Create wording"}
        </Button>
        <Button
          disabled={add.isPending}
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

const TITLES = {
  point: "Point wording",
  record: "Record summary",
  profile: "Professional summary",
} as const;

export function PhrasingEditor({
  store,
  client,
  phrasingSetId,
  subject = "point",
  initiallyOpen = subject !== "record",
}: {
  store: Store;
  client: ApiClient;
  phrasingSetId: Uuid;
  subject?: keyof typeof TITLES;
  initiallyOpen?: boolean;
}) {
  const update = useUpdatePhrasing(client);
  const [added, setAdded] = useState<Uuid | null>(null);
  const set = store.phrasingSets.find((row) => row.id === phrasingSetId);
  const wordings = phrasingsOfSet(store, phrasingSetId);
  const canonical = wordings.find((row) => row.id === set?.canonicalPhrasingId);
  const order = useReorder(
    store.phrasings.filter((row) => row.phrasingSetId === phrasingSetId),
    (phrasing, sortKey) => {
      update.mutate({ phrasing, patch: { sortKey } });
    },
  );

  if (set === undefined) {
    return (
      <Panel>
        <PanelHeader title={TITLES[subject]} />
        <PanelBody>
          <p className="text-sm text-text-muted">
            The wording is unavailable. Try reopening this page.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title={TITLES[subject]}>
        Changes save as you type. Expand a wording to edit it.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {wordings.map((phrasing) => (
          <Wording
            key={phrasing.id}
            store={store}
            client={client}
            set={set}
            phrasing={phrasing}
            order={order}
            expanded={
              phrasing.id === added || (initiallyOpen && phrasing.id === set.canonicalPhrasingId)
            }
          />
        ))}
        <p className="text-xs text-text-subtle">
          {subject === "point"
            ? "New resume selections use the default. Existing resumes keep their chosen wording."
            : "Resumes use the default summary. Changing the default updates it across your resumes."}
        </p>
        <AddWording
          store={store}
          client={client}
          phrasingSetId={phrasingSetId}
          onAdded={setAdded}
          from={
            store.phrasingRevisions.find((row) => row.id === canonical?.currentRevisionId)?.body ??
            []
          }
        />
      </PanelBody>
    </Panel>
  );
}
