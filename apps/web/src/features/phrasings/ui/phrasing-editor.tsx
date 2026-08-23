import { phrasingsOfSet, resumesUsingPhrasing, textOfPhrasing } from "@keepcv/core";
import {
  PHRASING_VARIANTS,
  type Phrasing,
  type PhrasingSet,
  type PhrasingVariant,
  type Store,
  type Uuid,
} from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import type { ApiClient } from "../../../lib/api.js";
import { sentenceCase } from "../../../lib/label.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import {
  useAddVariant,
  useSetCanonical,
  useSetPhrasingArchived,
  useUpdatePhrasing,
} from "../api/use-phrasings.js";
import { buildVariant, VARIANT_HINTS } from "../model/editor.js";
import { type EditorStatus, usePhrasingText } from "../model/use-phrasing-text.js";
import { PhrasingHistory } from "./phrasing-history.js";

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
    <span className="text-xs text-text-subtle">
      on{" "}
      {resumes.map((resume, index) => (
        <span key={resume.id}>
          {index === 0 ? "" : ", "}
          <Link
            to="/resumes/$resumeId"
            params={{ resumeId: resume.id }}
            search={{ view: "composition" as const }}
            className="underline-offset-2 hover:underline"
          >
            {resume.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

// The offer the state machine owes a returning editor: it says a draft is there
// and takes neither side until one is chosen (application-structure.md #6).
function DraftWaiting({
  text,
  onRestore,
  onDiscard,
}: {
  text: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-lg border border-caution/40 bg-caution-soft px-3 py-2">
      <p className="text-xs font-medium text-caution-text">
        You were part-way through rewording this.
      </p>
      <p className="mt-1 text-sm text-caution-text">{text}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onRestore}>Put it back</Button>
        <Button tone="danger" onClick={onDiscard}>
          Throw it away
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
      placeholder="unlabelled"
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
}: {
  store: Store;
  client: ApiClient;
  set: PhrasingSet;
  phrasing: Phrasing;
  order: Reorder<Phrasing>;
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
      <div className="flex flex-wrap items-center gap-2">
        <DragGrip />
        <select
          value={phrasing.variant}
          aria-label="Variant"
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
              {sentenceCase(option)}
            </option>
          ))}
        </select>
        <Label client={client} phrasing={phrasing} />
        {isCanonical ? <Badge tone="accent">Canonical</Badge> : null}
        {isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <span className="ml-auto flex items-center gap-2">
          <UsedBy store={store} phrasingId={phrasing.id} />
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

      {/* Read-only once archived: appending to a wording nothing reaches would
          write history for a variant the user has put away. */}
      <textarea
        value={text.typed}
        rows={3}
        readOnly={isArchived}
        aria-label={`Wording, ${phrasing.variant}`}
        onChange={(event) => {
          text.onChange(event.target.value);
        }}
        onBlur={text.onBlur}
        className="w-full resize-y rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm leading-relaxed text-text outline-none read-only:bg-surface-sunken focus:border-brand"
      />

      {text.error === null ? null : <Failure error={text.error} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-subtle">
        <span className="tabular-nums">{text.typed.trim().length} characters</span>
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
              Make canonical
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

      {showing ? <PhrasingHistory client={client} phrasing={phrasing} /> : null}
    </div>
  );
}

function AddWording({
  store,
  client,
  phrasingSetId,
  from,
}: {
  store: Store;
  client: ApiClient;
  phrasingSetId: Uuid;
  from: string;
}) {
  const add = useAddVariant(client);
  const [variant, setVariant] = useState<PhrasingVariant>("short");
  const [label, setLabel] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
      <select
        value={variant}
        aria-label="New variant"
        onChange={(event) => {
          setVariant(event.target.value as PhrasingVariant);
        }}
        className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-text-muted"
      >
        {PHRASING_VARIANTS.map((option) => (
          <option key={option} value={option}>
            {sentenceCase(option)}
          </option>
        ))}
      </select>
      <input
        value={label}
        aria-label="New label"
        placeholder="What it is for"
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        className="w-48 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-text-subtle focus:border-brand"
      />
      <Button
        disabled={add.isPending}
        onClick={() => {
          setLabel("");
          add.mutate(buildVariant(store, { phrasingSetId, variant, label, text: from }));
        }}
      >
        Add a wording
      </Button>
      <span className="text-xs text-text-subtle">{VARIANT_HINTS[variant]}</span>
    </div>
  );
}

const TITLES = {
  point: "What it says",
  profile: "Professional summary",
} as const;

export function PhrasingEditor({
  store,
  client,
  phrasingSetId,
  subject = "point",
}: {
  store: Store;
  client: ApiClient;
  phrasingSetId: Uuid;
  subject?: keyof typeof TITLES;
}) {
  const update = useUpdatePhrasing(client);
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
            This {subject} names a wording the store does not hold, which no screen can repair.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title={TITLES[subject]}>
        Kept as a draft while you type and committed when you stop. Editing appends to the history
        rather than overwriting it, so a resume you sent in March goes on saying what it said.
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
          />
        ))}
        <AddWording
          store={store}
          client={client}
          phrasingSetId={phrasingSetId}
          from={canonical === undefined ? "" : textOfPhrasing(store, canonical)}
        />
      </PanelBody>
    </Panel>
  );
}
