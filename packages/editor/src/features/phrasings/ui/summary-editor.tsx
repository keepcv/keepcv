import { newUuid } from "@keepcv/core";
import type { PhrasingSetInput, Store } from "@keepcv/schema";
import { phrasingSetInputSchema } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { type SummaryOwner, useStartSummary } from "../api/use-summary.js";
import { PhrasingEditor } from "./phrasing-editor.js";

export function SummaryEditor({
  store,
  client,
  owner,
}: {
  store: Store;
  client: ApiClient;
  owner: SummaryOwner;
}) {
  const start = useStartSummary(client);
  const [input] = useState<PhrasingSetInput>(() =>
    phrasingSetInputSchema.parse({
      id: newUuid(),
      purpose: owner.kind === "profile" ? "profile_summary" : "record_summary",
      phrasing: { id: newUuid(), variant: "standard", label: null, sortKey: "a0", body: [] },
    }),
  );
  const setId = owner.row.summarySetId;

  if (setId !== null && !start.isPending)
    return (
      <PhrasingEditor
        store={store}
        client={client}
        phrasingSetId={setId}
        subject={owner.kind}
        initiallyOpen={owner.kind === "profile" || start.isSuccess}
      />
    );

  return (
    <Panel collapsible defaultOpen={start.error !== null || start.isPending}>
      <PanelHeader title={owner.kind === "profile" ? "Professional summary" : "Record summary"}>
        {owner.kind === "profile"
          ? "A short introduction at the top of your resumes."
          : "A short description of this job, project, or qualification."}
      </PanelHeader>
      <PanelBody className="space-y-3">
        {start.error === null ? null : <Failure error={start.error} />}
        <Button
          tone="secondary"
          disabled={start.isPending}
          onClick={() => {
            start.mutate({
              owner,
              input,
              setExists: store.phrasingSets.some((set) => set.id === input.id),
            });
          }}
        >
          {start.isPending
            ? "Starting"
            : start.error !== null
              ? "Retry summary"
              : "Write a summary"}
        </Button>
      </PanelBody>
    </Panel>
  );
}
