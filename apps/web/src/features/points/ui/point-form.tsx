import { formatMetric, live } from "@keepcv/core";
import {
  POINT_CONFIDENCES,
  type Point,
  type PointConfidence,
  type Store,
  type Uuid,
} from "@keepcv/schema";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import {
  type Option,
  SelectField,
  TextAreaField,
  TextField,
} from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { sentenceCase } from "../../../lib/label.js";
import { DATE_HINT } from "../../../lib/partial-date.js";
import { KIND_NAMES } from "../../records/model/record-rows.js";
import {
  useAddMetric,
  useArchiveMetric,
  useCreatePoint,
  useSetPointArchived,
  useUpdatePoint,
} from "../api/use-points.js";
import {
  BLANK_METRIC,
  blankPointValues,
  buildMetric,
  buildPointPatch,
  buildPointSubmission,
  CONFIDENCE_HINTS,
  canonicalPhrasingId,
  changedBody,
  type FieldErrors,
  type MetricFormValues,
  type PointFormValues,
  pointValuesOf,
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

// Written straight away rather than staged with the rest of the form: a metric
// belongs to a point that already exists, and there is nothing to roll back.
function Metrics({ store, client, point }: { store: Store; client: ApiClient; point: Point }) {
  const add = useAddMetric(client);
  const archive = useArchiveMetric(client);
  const [values, setValues] = useState<MetricFormValues>(BLANK_METRIC);
  const [errors, setErrors] = useState<FieldErrors>({});

  const rows = live(store.metrics).filter((metric) => metric.pointId === point.id);
  const set = (patch: Partial<MetricFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  return (
    <Panel>
      <PanelHeader title="What it moved">
        Saved as you go, not on Save above. A number is what a reader remembers, and removing one
        archives it, because it is what a resume printed last March.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {rows.length === 0 ? null : (
          <ul className="space-y-1.5">
            {rows.map((metric) => (
              <li key={metric.id} className="flex items-center gap-2">
                <Badge tone="accent">
                  {metric.label} {formatMetric(metric, metric.id).display}
                </Badge>
                <button
                  type="button"
                  onClick={() => {
                    archive.mutate(metric);
                  }}
                  className="text-xs text-slate-500 underline-offset-2 hover:text-red-700 hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <TextField
            label="Label"
            value={values.label}
            onChange={(label) => {
              set({ label });
            }}
            placeholder="p95 latency"
            error={errors["label"]}
          />
          <TextField
            label="Value"
            value={values.value}
            onChange={(value) => {
              set({ value });
            }}
            placeholder="120"
            error={errors["value"]}
          />
          <TextField
            label="Unit"
            value={values.unit}
            onChange={(unit) => {
              set({ unit });
            }}
            placeholder="ms"
          />
          <TextField
            label="Was"
            value={values.baseline}
            onChange={(baseline) => {
              set({ baseline });
            }}
            placeholder="800"
            error={errors["baseline"]}
          />
        </div>

        {add.error === null ? null : <Failure error={add.error} />}
        {archive.error === null ? null : <Failure error={archive.error} />}

        <Button
          disabled={add.isPending}
          onClick={() => {
            const built = buildMetric(store, point.id, values);
            if ("errors" in built) {
              setErrors(built.errors);
              return;
            }
            setErrors({});
            setValues(BLANK_METRIC);
            add.mutate(built.metric);
          }}
        >
          Add metric
        </Button>
      </PanelBody>
    </Panel>
  );
}

export function PointForm({
  store,
  client,
  point,
  recordId,
}: {
  store: Store;
  client: ApiClient;
  point?: Point;
  recordId?: Uuid;
}) {
  const navigate = useNavigate();
  const create = useCreatePoint(client);
  const update = useUpdatePoint(client);
  const setArchived = useSetPointArchived(client);
  const pending = create.isPending || update.isPending;

  const [values, setValues] = useState<PointFormValues>(() =>
    point === undefined ? blankPointValues(recordId) : pointValuesOf(store, point),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = (patch: Partial<PointFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  const failure = create.error ?? update.error ?? setArchived.error;
  const isArchived = point !== undefined && point.archivedAt !== null;

  const leave = () => {
    void navigate(
      values.recordId === ""
        ? { to: "/points", search: { filter: "all" } }
        : { to: "/records/$recordId", params: { recordId: values.recordId } },
    );
  };

  async function save(): Promise<void> {
    if (point === undefined) {
      const built = buildPointSubmission(store, values);
      if ("errors" in built) {
        setErrors(built.errors);
        return;
      }
      setErrors({});
      const saved = await create.mutateAsync({ point: built.point }).catch(() => undefined);
      if (saved !== undefined) leave();
      return;
    }

    const built = buildPointPatch(values);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    const saved = await update
      .mutateAsync({
        point,
        patch: built.patch,
        body: changedBody(store, point, values.text),
        phrasingId: canonicalPhrasingId(store, point),
      })
      .catch(() => undefined);
    if (saved !== undefined) leave();
  }

  return (
    <div className="space-y-5">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {point === undefined ? "New point" : "Edit point"}
          </h1>
          {isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
          {point === undefined ? null : (
            <Button
              className="ml-auto"
              tone={isArchived ? "secondary" : "danger"}
              disabled={setArchived.isPending}
              onClick={() => {
                setArchived.mutate({ point, archived: !isArchived });
              }}
            >
              {isArchived ? "Restore" : "Archive"}
            </Button>
          )}
        </div>

        {failure === null ? null : <Failure error={failure} />}

        <Panel>
          <PanelHeader title="What you did, and what it moved">
            Editing this appends to its history rather than overwriting it, so a resume you sent in
            March goes on saying what it said.
          </PanelHeader>
          <PanelBody className="space-y-1">
            <TextAreaField
              label="Point"
              value={values.text}
              onChange={(text) => {
                set({ text });
              }}
              rows={3}
              placeholder="Cut p95 ingest latency from 800ms to 120ms across 40 services"
              error={errors["phrasing.body"]}
            />
            <p className="text-right text-xs tabular-nums text-slate-400">
              {values.text.trim().length} characters
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Where it belongs">
            A point with no record is not a mistake: capture it now, file it when you know where.
          </PanelHeader>
          <PanelBody className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Record"
              value={values.recordId}
              onChange={(next) => {
                set({ recordId: next });
              }}
              options={recordOptions(store)}
              error={errors["recordId"]}
            />
            <SelectField
              label="Confidence"
              value={values.confidence}
              onChange={(next) => {
                set({ confidence: next as PointConfidence });
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
                set({ occurredOn });
              }}
              placeholder="2026-03"
              hint={DATE_HINT}
              error={errors["occurredOn"]}
            />
          </PanelBody>
        </Panel>

        <div className="flex flex-wrap items-center gap-2">
          <Button tone="primary" type="submit" disabled={pending}>
            {pending ? "Saving" : point === undefined ? "Add point" : "Save"}
          </Button>
          <ButtonLink to="/points" search={{ filter: "all" }}>
            Cancel
          </ButtonLink>
        </div>
      </form>

      {point === undefined ? null : <Metrics store={store} client={client} point={point} />}
    </div>
  );
}
