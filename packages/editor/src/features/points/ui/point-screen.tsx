import { resumesUsingPoint } from "@keepcv/core";
import type { Point, Store } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { ContentGuide } from "../../../components/ui/content-guide.js";
import { type Crumb, PageBody, PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { PhrasingEditor } from "../../phrasings/ui/phrasing-editor.js";
import { toRecordRow } from "../../records/model/record-rows.js";
import { TagPicker } from "../../tags/ui/tag-picker.js";
import { useSetPointArchived, useUpdatePoint } from "../api/use-points.js";
import { buildPointPatch, type PointFormValues, pointValuesOf } from "../model/point-form.js";
import { PointEvidence } from "./point-evidence.js";
import { Placement } from "./point-form.js";
import { PointMetrics } from "./point-metrics.js";

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
  const parent = store.records.find((row) => row.id === point.recordId);
  const trail: Crumb[] = [{ label: "Points", to: "/points", search: { filter: "all" } }];
  if (parent !== undefined) {
    const row = toRecordRow(store, parent);
    trail.push({
      label: [row.title, row.organisation].filter(Boolean).join(" - "),
      to: "/records/$recordId",
      params: { recordId: parent.id },
    });
  }

  return (
    <PageBody>
      <PageHeader
        title="Point"
        trail={trail}
        actions={
          <>
            {isArchived ? <Badge tone="warning">Archived</Badge> : null}
            {onResumes === 0 ? null : (
              <Badge>on {onResumes === 1 ? "one resume" : `${String(onResumes)} resumes`}</Badge>
            )}
            <Button
              className="ml-auto"
              icon={isArchived ? "restore" : "archive"}
              disabled={setArchived.isPending}
              onClick={() => {
                setArchived.mutate({ point, archived: !isArchived });
              }}
            >
              {isArchived ? "Restore" : "Archive"}
            </Button>
          </>
        }
      >
        {parent === undefined
          ? "Choose a record below to connect this point to a job or project."
          : "Edit wording here. Open the record above to see its other points."}
      </PageHeader>

      {failure === null ? null : <Failure error={failure} />}

      <PhrasingEditor store={store} client={client} phrasingSetId={point.phrasingSetId} />

      <ContentGuide />

      <Panel collapsible>
        <PanelHeader title="Record and confidence">
          Link this point to a job or project and note how certain its claims are.
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

      <Panel collapsible>
        <PanelHeader title="Tags">Use tags to find and select related work.</PanelHeader>
        <PanelBody>
          <TagPicker store={store} client={client} subject={{ kind: "point", id: point.id }} />
        </PanelBody>
      </Panel>

      <ButtonLink to="/points" search={{ filter: "all" }}>
        Back to points
      </ButtonLink>
    </PageBody>
  );
}
