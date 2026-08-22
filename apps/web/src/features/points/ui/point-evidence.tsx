import type { Evidence, EvidenceKind, Point, Store } from "@keepcv/schema";
import { EVIDENCE_KINDS } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { useAddEvidence, useArchiveEvidence } from "../api/use-points.js";
import {
  BLANK_EVIDENCE,
  buildEvidence,
  EVIDENCE_KIND_LABELS,
  EVIDENCE_PLACEHOLDERS,
  type EvidenceFormValues,
  evidenceOfPoint,
  hrefOf,
} from "../model/evidence-form.js";

const KIND_OPTIONS = EVIDENCE_KINDS.map((kind) => ({
  value: kind,
  label: EVIDENCE_KIND_LABELS[kind],
}));

// A link only when a browser would actually open it, so a path or a half-typed
// address is still shown rather than swallowed.
function Value({ evidence }: { evidence: Evidence }) {
  const href = hrefOf(evidence);
  if (href === undefined) {
    return <span className="break-words text-sm text-slate-800">{evidence.value}</span>;
  }
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      className="break-all text-sm text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
    >
      {evidence.value}
    </a>
  );
}

// Private, and structurally so: `ResumeDocument` has no field this could travel
// in (template-model.md #2).
export function PointEvidence({
  store,
  client,
  point,
}: {
  store: Store;
  client: ApiClient;
  point: Point;
}) {
  const add = useAddEvidence(client);
  const archive = useArchiveEvidence(client);
  const [values, setValues] = useState<EvidenceFormValues>(BLANK_EVIDENCE);
  const [errors, setErrors] = useState<FieldErrors>({});

  const rows = evidenceOfPoint(store, point.id);
  const set = (patch: Partial<EvidenceFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  return (
    <Panel>
      <PanelHeader
        title="What backs it up"
        aside={<Badge tone="warning">Never leaves the store</Badge>}
      >
        The link, the note or the file that proves this. No resume can carry it and no template can
        reach it - it is here so you can answer the question in an interview.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {rows.length === 0 ? null : (
          <ul className="space-y-2">
            {rows.map((evidence) => (
              <li key={evidence.id} className="flex items-baseline gap-2">
                <Badge>{EVIDENCE_KIND_LABELS[evidence.kind]}</Badge>
                <span className="min-w-0 flex-1">
                  <Value evidence={evidence} />
                  {evidence.note === null ? null : (
                    <span className="block text-xs text-slate-500">{evidence.note}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    archive.mutate(evidence);
                  }}
                  className="text-xs text-slate-500 underline-offset-2 hover:text-red-700 hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr]">
          <SelectField
            label="Kind"
            value={values.kind}
            onChange={(kind) => {
              set({ kind: kind as EvidenceKind });
            }}
            options={KIND_OPTIONS}
          />
          <TextField
            label={EVIDENCE_KIND_LABELS[values.kind]}
            value={values.value}
            onChange={(value) => {
              set({ value });
            }}
            placeholder={EVIDENCE_PLACEHOLDERS[values.kind]}
            error={errors["value"]}
          />
          <TextField
            label="Why it matters"
            value={values.note}
            onChange={(note) => {
              set({ note });
            }}
            placeholder="optional"
          />
        </div>

        {add.error === null ? null : <Failure error={add.error} />}
        {archive.error === null ? null : <Failure error={archive.error} />}

        <Button
          disabled={add.isPending}
          onClick={() => {
            const built = buildEvidence(point.id, values);
            if ("errors" in built) {
              setErrors(built.errors);
              return;
            }
            setErrors({});
            setValues(BLANK_EVIDENCE);
            add.mutate(built.evidence);
          }}
        >
          Add evidence
        </Button>
      </PanelBody>
    </Panel>
  );
}
