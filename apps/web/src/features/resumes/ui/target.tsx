import type { Resume, Store } from "@keepcv/schema";
import { resumeSchema } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Conflict } from "../../../components/ui/conflict.js";
import { TextAreaField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { type ApiClient, isProblem } from "../../../lib/api.js";
import { DATE_HINT } from "../../../lib/partial-date.js";
import { usePatchComposed } from "../api/use-composition.js";
import { usePatchResume } from "../api/use-resumes.js";
import {
  buildTargetPatch,
  isChanged,
  type TargetErrors,
  type TargetReading,
  type TargetValues,
  targetDifferences,
  targetReading,
  targetValuesOf,
  type WeakPoint,
} from "../model/target.js";

// Enough to act on. A resume answering none of a long posting would otherwise
// list every point it holds.
const DROPS_AT_MOST = 6;
const TERMS_AT_MOST = 3;

function Terms({ terms, tone }: { terms: TargetReading["covered"]; tone: "neutral" | "warning" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {terms.map((term) => (
        <li key={term.term}>
          <Badge tone={tone}>{term.term}</Badge>
        </li>
      ))}
    </ul>
  );
}

function answers(matched: string[]): string {
  if (matched.length === 0) return "Answers nothing the posting asks for.";
  const shown = matched.slice(0, TERMS_AT_MOST).join(", ");
  const rest = matched.length - TERMS_AT_MOST;
  return `Answers ${shown}${rest > 0 ? ` and ${String(rest)} more` : ""}.`;
}

function Weakest({
  points,
  onTakeOff,
}: {
  points: WeakPoint[];
  onTakeOff: (point: WeakPoint) => void;
}) {
  return (
    <ul className="divide-y divide-line-subtle">
      {points.slice(0, DROPS_AT_MOST).map((point) => (
        <li key={point.row.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm text-text">{point.text || "an empty point"}</p>
            <p className="mt-0.5 text-xs text-text-subtle">
              {point.under} - {answers(point.matched)}
            </p>
          </div>
          <Button
            className="shrink-0"
            onClick={() => {
              onTakeOff(point);
            }}
          >
            Take off the page
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function TargetScreen({
  store,
  client,
  resume,
}: {
  store: Store;
  client: ApiClient;
  resume: Resume;
}) {
  const patch = usePatchResume(client);
  const patchComposed = usePatchComposed(client);

  const [values, setValues] = useState<TargetValues>(() => targetValuesOf(resume));
  const [errors, setErrors] = useState<TargetErrors>({});
  const [conflict, setConflict] = useState<Resume | undefined>(undefined);

  const reading = targetReading(store, resume.id);
  const asked = reading.covered.length + reading.missing.length;
  const changed = isChanged(values, resume);

  const set = (next: Partial<TargetValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  async function save(basedOn: Resume | undefined): Promise<void> {
    setConflict(undefined);
    const built = buildTargetPatch(values);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await patch
      .mutateAsync({ resume: basedOn ?? resume, patch: built.patch })
      .catch((error: unknown) => {
        if (isProblem(error) && error.problem.status === 409) {
          const current = resumeSchema.safeParse(error.problem.current);
          if (current.success) setConflict(current.data);
        }
      });
  }

  return (
    <div className="space-y-5">
      {conflict === undefined ? null : (
        <Conflict
          title="This resume changed while you were editing it"
          rows={targetDifferences(values, conflict)}
          onKeepTheirs={() => {
            setValues(targetValuesOf(conflict));
            setConflict(undefined);
          }}
          onKeepMine={() => {
            void save(conflict);
          }}
        />
      )}

      {patch.error === null || conflict !== undefined ? null : <Failure error={patch.error} />}

      <Panel>
        <PanelHeader
          title="What this resume is for"
          aside={changed ? <Badge tone="warning">Not saved yet</Badge> : undefined}
        >
          The posting is read here and nowhere else: it never prints, and it is what the match below
          is measured against.
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Company"
              value={values.company}
              onChange={(company) => {
                set({ company });
              }}
              error={errors.company}
            />
            <TextField
              label="Role"
              value={values.role}
              onChange={(role) => {
                set({ role });
              }}
              hint="Read as part of the posting when none is pasted."
              error={errors.role}
            />
            <TextField
              label="Posting"
              value={values.url}
              onChange={(url) => {
                set({ url });
              }}
              placeholder="https://"
              error={errors.url}
            />
            <TextField
              label="Applied on"
              value={values.appliedOn}
              onChange={(appliedOn) => {
                set({ appliedOn });
              }}
              hint={DATE_HINT}
              error={errors.appliedOn}
            />
          </div>
          <TextAreaField
            label="Job description"
            value={values.jdText}
            onChange={(jdText) => {
              set({ jdText });
            }}
            rows={10}
            placeholder="Paste the posting."
            hint="Kept whole. Nothing here reaches the printed page."
            error={errors.jdText}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              tone="primary"
              disabled={!changed || patch.isPending}
              onClick={() => {
                void save(undefined);
              }}
            >
              {patch.isPending ? "Saving" : "Save"}
            </Button>
            <Button
              disabled={!changed}
              onClick={() => {
                setValues(targetValuesOf(resume));
                setErrors({});
              }}
            >
              Revert
            </Button>
          </div>
        </PanelBody>
      </Panel>

      {asked === 0 ? (
        <Panel>
          <PanelBody>
            <p className="text-sm text-text-muted">
              Paste the posting above and this resume is measured against it: which of the terms it
              leans on you answer, and which placed points answer none of them.
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="What the posting asks for"
              aside={
                <span className="text-xs tabular-nums text-text-subtle">
                  {String(reading.covered.length)} of {String(asked)} answered
                </span>
              }
            >
              Ranked by how much the posting leans on each term. What the store already files work
              under counts for more than a word said once.
            </PanelHeader>
            <PanelBody className="space-y-3">
              {reading.missing.length === 0 ? null : (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-text-muted">
                    Nothing placed answers these
                  </p>
                  <Terms terms={reading.missing} tone="warning" />
                </div>
              )}
              {reading.covered.length === 0 ? null : (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-text-muted">Answered</p>
                  <Terms terms={reading.covered} tone="neutral" />
                </div>
              )}
            </PanelBody>
          </Panel>

          {reading.weakest.length === 0 ? null : (
            <Panel>
              <PanelHeader title="Least like the posting">
                Taken off the page, not deleted: the point stays on this resume and prints again the
                moment you put it back.
              </PanelHeader>
              <PanelBody className="py-0">
                <Weakest
                  points={reading.weakest}
                  onTakeOff={(point) => {
                    patchComposed.mutate({
                      level: "point",
                      row: point.row,
                      patch: { isVisible: false },
                    });
                  }}
                />
              </PanelBody>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
