import { resumesUsingPoint } from "@keepcv/core";
import type { Point, Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { PhrasingEditor } from "../../phrasings/ui/phrasing-editor.js";
import { TagPicker } from "../../tags/ui/tag-picker.js";
import { useSetPointArchived, useUpdatePoint } from "../api/use-points.js";
import { buildPointPatch, type PointFormValues, pointValuesOf } from "../model/point-form.js";
import { PointEvidence } from "./point-evidence.js";
import { Placement } from "./point-form.js";
import { PointMetrics } from "./point-metrics.js";

function FiledUnder({ store, point }: { store: Store; point: Point }) {
  const record = store.records.find((row) => row.id === point.recordId);
  if (record === undefined) {
    return <p className="text-sm text-text-subtle">Not filed under a record yet.</p>;
  }

  return (
    <p className="text-sm text-text-subtle">
      Filed under{" "}
      <Link
        to="/records/$recordId"
        params={{ recordId: record.id }}
        className="text-text-muted underline-offset-2 hover:underline"
      >
        {record.title ?? "Untitled"}
      </Link>
    </p>
  );
}

// Nothing here navigates away when it saves: the wording commits itself, the
// metrics save as they are added, and only the filing has a button.
export function PointScreen({
  store,
  client,
  point,
}: {
  store: Store;
  client: ApiClient;
  point: Point;
}) {
  const update = useUpdatePoint(client);
  const setArchived = useSetPointArchived(client);
  const [values, setValues] = useState<PointFormValues>(() => pointValuesOf(store, point));
  const [errors, setErrors] = useState<FieldErrors>({});

  const isArchived = point.archivedAt !== null;
  const onResumes = resumesUsingPoint(store, point.id).length;
  const failure = update.error ?? setArchived.error;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Point</h1>
          {isArchived ? <Badge tone="warning">Archived, and kept</Badge> : null}
          {onResumes === 0 ? null : (
            <Badge>on {onResumes === 1 ? "one resume" : `${String(onResumes)} resumes`}</Badge>
          )}
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
        </div>
        <FiledUnder store={store} point={point} />
      </div>

      {failure === null ? null : <Failure error={failure} />}

      <PhrasingEditor store={store} client={client} phrasingSetId={point.phrasingSetId} />

      <Panel>
        <PanelHeader title="Where it belongs">
          A point with no record is not a mistake: capture it now, file it when you know where.
        </PanelHeader>
        <Placement
          store={store}
          values={values}
          errors={errors}
          onChange={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
          }}
        />
        <div className="flex items-center gap-2 px-4 pb-3">
          <Button
            tone="primary"
            disabled={update.isPending}
            onClick={() => {
              const built = buildPointPatch(values);
              if ("errors" in built) {
                setErrors(built.errors);
                return;
              }
              setErrors({});
              update.mutate({ point, patch: built.patch });
            }}
          >
            {update.isPending ? "Saving" : "Save"}
          </Button>
          {update.isSuccess && !update.isPending ? (
            <span className="text-xs text-text-subtle">Saved</span>
          ) : null}
        </div>
      </Panel>

      <PointMetrics store={store} client={client} point={point} />

      <PointEvidence store={store} client={client} point={point} />

      <Panel>
        <PanelHeader title="Tags">
          The words this is filed under. A resume is matched against them, and search reads them.
        </PanelHeader>
        <PanelBody>
          <TagPicker store={store} client={client} subject={{ kind: "point", id: point.id }} />
        </PanelBody>
      </Panel>

      <ButtonLink to="/points" search={{ filter: "all" }}>
        Back to points
      </ButtonLink>
    </div>
  );
}
