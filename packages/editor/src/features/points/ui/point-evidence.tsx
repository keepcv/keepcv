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
import { useFormRecovery } from "../../../lib/use-form-recovery.js";
import { useAddEvidence, useArchiveEvidence } from "../api/use-points.js";
import {
  BLANK_EVIDENCE,
  buildEvidence,
  EVIDENCE_KIND_LABELS,
  EVIDENCE_PLACEHOLDERS,
  type EvidenceFormValues,
  evidenceFormValuesSchema,
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
    return <span className="break-words text-sm text-text">{evidence.value}</span>;
  }
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      className="break-all text-sm text-brand-text underline underline-offset-2 hover:text-brand-hover"
    >
      {evidence.value}
    </a>
  );
}

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
  const recovery = useFormRecovery(
    `keepcv.evidence-edit:${point.id}`,
    evidenceFormValuesSchema,
    BLANK_EVIDENCE,
  );
  const { values, setValues } = recovery;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [adding, setAdding] = useState(recovery.pending);

  const rows = evidenceOfPoint(store, point.id);
  const set = (patch: Partial<EvidenceFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  return (
    <Panel collapsible defaultOpen={rows.length > 0 || recovery.pending}>
      <PanelHeader title="Private evidence" aside={<Badge>Excluded from resumes</Badge>}>
        Keep supporting links and notes here. They are included in backups.
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
                    <span className="block text-xs text-text-subtle">{evidence.note}</span>
                  )}
                </span>
                <Button
                  tone="ghost"
                  size="sm"
                  icon="close"
                  label={`Remove ${evidence.value}`}
                  onClick={() => {
                    archive.mutate(evidence);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {add.error === null ? null : <Failure error={add.error} />}
        {archive.error === null ? null : <Failure error={archive.error} />}

        {adding ? (
          <div className="space-y-3 rounded-lg border border-line bg-surface-sunken p-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                tone="primary"
                icon="confirm"
                disabled={add.isPending}
                onClick={() => {
                  const built = buildEvidence(point.id, values);
                  if ("errors" in built) {
                    setErrors(built.errors);
                    return;
                  }
                  setErrors({});
                  const sent = recovery.begin();
                  if (sent === undefined) return;
                  void add
                    .mutateAsync(built.evidence)
                    .then(() => {
                      if (recovery.acknowledge(sent, BLANK_EVIDENCE)) setAdding(false);
                    })
                    .catch(() => undefined)
                    .finally(recovery.finish);
                }}
              >
                Add evidence
              </Button>
              <Button
                disabled={add.isPending}
                onClick={() => {
                  setErrors({});
                  recovery.discard(BLANK_EVIDENCE);
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            icon="add"
            onClick={() => {
              setAdding(true);
            }}
          >
            Add evidence
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}
