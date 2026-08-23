import type { RestoreOmission, Uuid } from "@keepcv/schema";
import { useState } from "react";
import { Empty, Failure, Skeleton } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import {
  type Star,
  useCaptureVersion,
  useRestoreVersion,
  useSnapshots,
  useStarVersion,
  useVersionDiff,
  useVersionDocument,
  useVersions,
} from "../api/use-versions.js";
import {
  CHANGE_LABELS,
  type ChangeLine,
  diffLines,
  type VersionRow,
  versionRows,
} from "../model/version-rows.js";
import { DownloadResume } from "./download.js";

const INDENTS = ["pl-0", "pl-4", "pl-8"];

function Line({ line }: { line: ChangeLine }) {
  return (
    <li className={INDENTS[line.indent] ?? "pl-8"}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Badge tone={line.change === "removed" ? "warning" : "accent"}>
          {CHANGE_LABELS[line.change]}
        </Badge>
        {line.subject === null ? null : (
          <span className="min-w-0 flex-1 text-sm text-text">{line.subject}</span>
        )}
      </div>
      {line.fields.length === 0 ? null : (
        <dl className="mt-1 space-y-0.5">
          {line.fields.map((field) => (
            <div key={field.key} className="flex flex-wrap gap-x-2 text-xs">
              <dt className="text-text-subtle">{field.label}</dt>
              <dd className="min-w-0 flex-1 text-text-muted">
                <span className="text-text-subtle line-through">{field.from}</span>{" "}
                <span>{field.to}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function Comparison({
  client,
  resumeId,
  a,
  b,
}: {
  client: ApiClient;
  resumeId: Uuid;
  a: Uuid;
  b: Uuid;
}) {
  const diff = useVersionDiff(client, resumeId, a, b);

  if (diff.error !== null) return <Failure error={diff.error} />;
  if (diff.data === undefined) return <Skeleton rows={2} />;

  const lines = diffLines(diff.data);
  if (lines.length === 0) {
    return <p className="text-sm text-text-muted">These two say exactly the same thing.</p>;
  }

  return (
    <ol aria-label="What changed between these two" className="space-y-2">
      {lines.map((line) => (
        <Line key={line.key} line={line} />
      ))}
    </ol>
  );
}

function Omissions({ omissions }: { omissions: readonly RestoreOmission[] }) {
  if (omissions.length === 0) return null;

  return (
    <p className="mt-2 text-xs text-caution-text">
      Put back what it could. The store no longer holds{" "}
      {omissions.map((row) => row.reference).join(", ")}.
    </p>
  );
}

// A snapshot is a version the user named, so starring one asks for the name
// rather than setting a flag.
function Starring({ row, onStar }: { row: VersionRow; onStar: (star: Star) => void }) {
  const [typed, setTyped] = useState<string | null>(null);

  if (row.snapshot !== undefined) {
    return (
      <Button
        onClick={() => {
          onStar({ snapshot: row.snapshot, resumeVersionId: row.id, label: "" });
        }}
      >
        Unstar
      </Button>
    );
  }

  if (typed === null) {
    return (
      <Button
        onClick={() => {
          setTyped("");
        }}
      >
        Star
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <input
        aria-label={`A name for version ${String(row.seq)}`}
        value={typed}
        placeholder="What this version was for"
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        className="w-48 rounded-lg border border-line px-2 py-1 text-sm"
      />
      <Button
        tone="primary"
        disabled={typed.trim() === ""}
        onClick={() => {
          onStar({ snapshot: undefined, resumeVersionId: row.id, label: typed.trim() });
          setTyped(null);
        }}
      >
        Save
      </Button>
    </span>
  );
}

// A version is a file the same way the working resume is: the store compiles
// the manifest, the browser renders it. Nothing is restored to send an old one.
function ExportVersion({ client, row }: { client: ApiClient; row: VersionRow }) {
  const [open, setOpen] = useState(false);
  const document = useVersionDocument(client, row.id, open);

  return (
    <>
      <Button
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? "Close" : "Export"}
      </Button>
      {!open ? null : (
        <div className="w-full">
          {document.error === null ? null : <Failure error={document.error} />}
          {document.data === undefined ? (
            <Skeleton rows={1} />
          ) : (
            <div className="max-w-xs">
              <p className="pb-2 text-xs text-text-subtle">
                Version #{row.seq}, in the words it pinned rather than the ones the store holds now.
              </p>
              <DownloadResume document={document.data} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ResumeHistory({ client, resumeId }: { client: ApiClient; resumeId: Uuid }) {
  const versions = useVersions(client, resumeId);
  const snapshots = useSnapshots(client, resumeId);
  const capture = useCaptureVersion(client, resumeId);
  const restore = useRestoreVersion(client, resumeId);
  const star = useStarVersion(client, resumeId);
  const [chosen, setChosen] = useState<{ a: Uuid; b: Uuid } | null>(null);

  if (versions.error !== null) return <Failure error={versions.error} />;
  if (versions.data === undefined) return <Skeleton rows={3} />;

  const rows = versionRows(versions.data, snapshots.data ?? []);
  const newest = rows[0];
  const previous = rows[1];
  const compare =
    chosen ??
    (newest !== undefined && previous !== undefined ? { a: previous.id, b: newest.id } : null);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Timeline"
          aside={
            <Button tone="primary" disabled={capture.isPending} onClick={() => capture.mutate()}>
              Save a version
            </Button>
          }
        >
          Nothing here is ever overwritten. Saving twice with nothing changed keeps one entry.
        </PanelHeader>
        <PanelBody>
          {restore.error === null ? null : <Failure error={restore.error} />}
          {capture.error === null ? null : <Failure error={capture.error} />}
          {star.error === null ? null : <Failure error={star.error} />}

          {rows.length === 0 ? (
            <Empty title="Versions are what a resume said">
              Every export saves one, and you can save one by hand. A version pins the wording, the
              dates and the titles, so editing them later cannot rewrite what you sent.
            </Empty>
          ) : (
            <ol aria-label="Versions of this resume" className="space-y-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line-subtle py-2 first:border-t-0 first:pt-0"
                >
                  <span className="w-8 text-sm font-medium tabular-nums text-text">#{row.seq}</span>
                  <Badge>{row.trigger}</Badge>
                  {row.label === null ? null : <Badge tone="accent">{row.label}</Badge>}
                  <span className="min-w-0 flex-1 text-xs tabular-nums text-text-subtle">
                    {row.when}
                    {row.restoredFrom === null ? "" : ` - from #${String(row.restoredFrom)}`}
                  </span>
                  <Starring
                    row={row}
                    onStar={(next) => {
                      star.mutate(next);
                    }}
                  />
                  <ExportVersion client={client} row={row} />
                  <Button
                    disabled={restore.isPending || row.seq === newest?.seq}
                    onClick={() => {
                      restore.mutate(row.id);
                    }}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ol>
          )}
          {restore.data === undefined ? null : <Omissions omissions={restore.data.omissions} />}
        </PanelBody>
      </Panel>

      {rows.length < 2 || compare === null ? null : (
        <Panel>
          <PanelHeader title="What changed">
            Any two, in either direction. The right-hand one is read as the newer.
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                aria-label="Compare from"
                value={compare.a}
                onChange={(event) => {
                  setChosen({ a: event.target.value as Uuid, b: compare.b });
                }}
                className="rounded-lg border border-line px-2 py-1"
              >
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.seq} - {row.when}
                  </option>
                ))}
              </select>
              <span className="text-text-subtle">with</span>
              <select
                aria-label="Compare with"
                value={compare.b}
                onChange={(event) => {
                  setChosen({ a: compare.a, b: event.target.value as Uuid });
                }}
                className="rounded-lg border border-line px-2 py-1"
              >
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.seq} - {row.when}
                  </option>
                ))}
              </select>
            </div>
            {compare.a === compare.b ? (
              <p className="text-sm text-text-muted">Pick two different versions.</p>
            ) : (
              <Comparison client={client} resumeId={resumeId} a={compare.a} b={compare.b} />
            )}
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
