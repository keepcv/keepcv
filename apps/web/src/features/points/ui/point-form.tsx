import { live } from "@keepcv/core";
import { POINT_CONFIDENCES, type PointConfidence, type Store, type Uuid } from "@keepcv/schema";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import {
  type Option,
  SelectField,
  TextAreaField,
  TextField,
} from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { sentenceCase } from "../../../lib/label.js";
import { DATE_HINT } from "../../../lib/partial-date.js";
import { KIND_NAMES } from "../../records/model/record-rows.js";
import { useCreatePoint } from "../api/use-points.js";
import {
  blankPointValues,
  buildPointSubmission,
  CONFIDENCE_HINTS,
  type PointFormValues,
} from "../model/point-form.js";

export function MissingPoint() {
  return (
    <Empty title="No point with that id">
      It may have been on another store, or the link may be older than the row. Everything the store
      holds is on the points list.
    </Empty>
  );
}

function recordOptions(store: Store): Option[] {
  return [
    { value: "", label: "Nothing yet - leave it unplaced" },
    ...live(store.records).map((record) => ({
      value: record.id,
      label: `${record.title ?? "Untitled"} (${KIND_NAMES[record.kind]})`,
    })),
  ];
}

// The same three columns whether a point is being written or filed afterwards,
// so the two screens cannot drift into asking for different things.
export function Placement({
  store,
  values,
  errors,
  onChange,
}: {
  store: Store;
  values: PointFormValues;
  errors: FieldErrors;
  onChange: (patch: Partial<PointFormValues>) => void;
}) {
  return (
    <PanelBody className="grid gap-4 sm:grid-cols-3">
      <SelectField
        label="Record"
        value={values.recordId}
        onChange={(recordId) => {
          onChange({ recordId });
        }}
        options={recordOptions(store)}
        error={errors["recordId"]}
      />
      <SelectField
        label="Confidence"
        value={values.confidence}
        onChange={(next) => {
          onChange({ confidence: next as PointConfidence });
        }}
        options={POINT_CONFIDENCES.map((option) => ({
          value: option,
          label: sentenceCase(option),
        }))}
        hint={CONFIDENCE_HINTS[values.confidence]}
      />
      <TextField
        label="When"
        value={values.occurredOn}
        onChange={(occurredOn) => {
          onChange({ occurredOn });
        }}
        placeholder="2026-03"
        hint={DATE_HINT}
        error={errors["occurredOn"]}
      />
    </PanelBody>
  );
}

// A point arrives with the words it holds, so this screen writes text and the
// editing one hands it to the phrasing editor (application-structure.md #5.4).
export function PointForm({
  store,
  client,
  recordId,
}: {
  store: Store;
  client: ApiClient;
  recordId?: Uuid;
}) {
  const navigate = useNavigate();
  const create = useCreatePoint(client);
  const [values, setValues] = useState<PointFormValues>(() => blankPointValues(recordId));
  const [errors, setErrors] = useState<FieldErrors>({});

  const change = (patch: Partial<PointFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  async function save(): Promise<void> {
    const built = buildPointSubmission(store, values);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});

    const saved = await create.mutateAsync({ point: built.point }).catch(() => undefined);
    if (saved === undefined) return;
    void navigate({ to: "/points/$pointId/edit", params: { pointId: saved.id } });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h1 className="text-xl font-semibold tracking-tight">New point</h1>

      {create.error === null ? null : <Failure error={create.error} />}

      <Panel>
        <PanelHeader title="What you did, and what it moved">
          One sentence. Numbers and variants come next, on the point itself.
        </PanelHeader>
        <PanelBody className="space-y-1">
          <TextAreaField
            label="Point"
            value={values.text}
            onChange={(text) => {
              change({ text });
            }}
            rows={3}
            placeholder="Cut p95 ingest latency from 800ms to 120ms across 40 services"
            error={errors["phrasing.body"]}
          />
          <p className="text-right text-xs tabular-nums text-text-subtle">
            {values.text.trim().length} characters
          </p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Where it belongs">
          A point with no record is not a mistake: capture it now, file it when you know where.
        </PanelHeader>
        <Placement store={store} values={values} errors={errors} onChange={change} />
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving" : "Add point"}
        </Button>
        <ButtonLink to="/points" search={{ filter: "all" }}>
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
