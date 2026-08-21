import { newUuid } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { useCreateResume } from "../api/use-resumes.js";
import { type ResumeRow, resumeRows } from "../model/resume-rows.js";

function counted(value: number, singular: string, plural: string): string {
  return `${String(value)} ${value === 1 ? singular : plural}`;
}

function Row({ row }: { row: ResumeRow }) {
  return (
    <li>
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: row.id }}
        className="block rounded-lg px-3 py-2.5 hover:bg-slate-50 data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
            {row.name}
          </span>
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {row.applied === null ? "not sent" : `sent ${row.applied}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {row.target ?? "No target role recorded"}
        </p>
        <p className="mt-1 text-xs tabular-nums text-slate-400">
          {[
            counted(row.sections, "section", "sections"),
            counted(row.entries, "entry", "entries"),
            counted(row.points, "point", "points"),
          ].join(" - ")}
          {row.hidden === 0 ? "" : ` - ${String(row.hidden)} toggled off`}
        </p>
      </Link>
    </li>
  );
}

// The name is all a resume needs to exist; everything else about it is chosen on
// the resume itself.
function NewResume({ client }: { client: ApiClient }) {
  const create = useCreateResume(client);
  const navigate = useNavigate();
  const [typed, setTyped] = useState<string | null>(null);

  if (typed === null) {
    return (
      <Button
        tone="primary"
        onClick={() => {
          setTyped("");
        }}
      >
        New resume
      </Button>
    );
  }

  const start = () => {
    const id = newUuid();
    create.mutate({
      id,
      name: typed.trim(),
      targetCompany: null,
      targetRole: null,
      targetUrl: null,
      targetJdText: null,
      appliedOn: null,
      templateId: null,
      templateConfig: {},
    });
    setTyped(null);
    void navigate({ to: "/resumes/$resumeId", params: { resumeId: id }, search: {} });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label="A name for the new resume"
        value={typed}
        placeholder="Backend, Acme"
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        className="min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <Button tone="primary" disabled={typed.trim() === ""} onClick={start}>
        Start it
      </Button>
      <Button
        onClick={() => {
          setTyped(null);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

export function ResumeList({
  store,
  client,
  archived,
}: {
  store: Store;
  client: ApiClient;
  archived: ArchivedFilter;
}) {
  const rows = resumeRows(store, archived);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-xs text-slate-500">
            A resume is a selection over the store, not a copy of it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Archived">
            {ARCHIVED_FILTERS.map((option) => (
              <Segment
                key={option}
                to="/resumes"
                search={{ archived: option }}
                active={archived === option}
              >
                {ARCHIVED_LABELS[option]}
              </Segment>
            ))}
          </Segmented>
          <NewResume client={client} />
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title={archived === "only" ? "Nothing archived here" : "No resumes yet"}>
          {archived === "only"
            ? "An archived resume keeps every version it ever had, so what you sent stays answerable."
            : "A resume picks records and points out of the store and arranges them. Nothing it leaves out is lost - it stays here, ready for the next one."}
        </Empty>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white p-1">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
