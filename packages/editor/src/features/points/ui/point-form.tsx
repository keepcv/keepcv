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
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { sentenceCase } from "../../../lib/label.js";
import { DATE_HINT } from "../../../lib/partial-date.js";
import { useFormRecovery } from "../../../lib/use-form-recovery.js";
import { KIND_NAMES, toRecordRow } from "../../records/model/record-rows.js";
import { useCreatePoint } from "../api/use-points.js";
import {
  blankPointValues,
  buildPointSubmission,
  CONFIDENCE_HINTS,
  type PointFormValues,
  type PointPlacementValues,
  pointFormValuesSchema,
} from "../model/point-form.js";

export function MissingPoint() {
  return (
    <Empty title="Point not found">Check the points list or return to the previous page.</Empty>
  );
}

function recordOptions(store: Store): Option[] {
  return [
    { value: "", label: "Choose later" },
    ...live(store.records).map((record) => {
      const row = toRecordRow(store, record);
      return {
        value: record.id,
        label: [row.title, row.organisation, row.period, KIND_NAMES[row.kind]]
          .filter(Boolean)
          .join(" - "),
      };
    }),
  ];
}

export function Placement({
  store,
  values,
  errors,
  onChange,
}: {
  store: Store;
  values: PointPlacementValues;
  errors: FieldErrors;
  onChange: (patch: Partial<PointPlacementValues>) => void;
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
        label="Date (optional)"
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
  const recovery = useFormRecovery(
    `keepcv.point-edit:new:${recordId ?? "unplaced"}`,
    pointFormValuesSchema,
    blankPointValues(recordId),
  );
  const { values, setValues } = recovery;
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

    const sent = recovery.begin();
    if (sent === undefined) return;
    const saved = await create
      .mutateAsync({ point: built.point })
      .catch(() => undefined)
      .finally(recovery.finish);
    if (saved === undefined) return;
    recovery.acknowledge(sent, blankPointValues(recordId));
    void navigate({ to: "/points/$pointId/edit", params: { pointId: saved.id } });
  }

  return (
    <form
      className="mx-auto w-full max-w-4xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <PageHeader
        title="New point"
        trail={[{ label: "Points", to: "/points", search: { filter: "all" } }]}
      />

      {create.error === null ? null : <Failure error={create.error} />}

      <Panel>
        <PanelHeader title="Point wording">
          Describe what you did and its impact. Add metrics and alternate wordings after saving.
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

      <Panel collapsible defaultOpen={recordId !== undefined}>
        <PanelHeader title="Record and confidence">
          Link to a job or project now, or do it later.
        </PanelHeader>
        <Placement store={store} values={values} errors={errors} onChange={change} />
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={create.isPending}
          onClick={() => recovery.discard(blankPointValues(recordId))}
        >
          Revert
        </Button>
        <Button tone="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving" : "Add point"}
        </Button>
        {recordId === undefined ? (
          <ButtonLink to="/points" search={{ filter: "all" }}>
            Cancel
          </ButtonLink>
        ) : (
          <ButtonLink to="/records/$recordId" params={{ recordId }}>
            Cancel
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
