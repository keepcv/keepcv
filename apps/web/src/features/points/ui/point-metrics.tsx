import { formatMetric, live } from "@keepcv/core";
import type { Point, Store } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { useAddMetric, useArchiveMetric } from "../api/use-points.js";
import { BLANK_METRIC, buildMetric, type MetricFormValues } from "../model/point-form.js";

// Written straight away rather than staged with the rest of the screen: a metric
// belongs to a point that already exists, and there is nothing to roll back.
export function PointMetrics({
  store,
  client,
  point,
}: {
  store: Store;
  client: ApiClient;
  point: Point;
}) {
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
        Saved as you add them. Removing one archives it.
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
                  className="text-xs text-text-subtle underline-offset-2 hover:text-critical-text hover:underline"
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
