import { newUuid } from "@keepcv/core";
import type { Resume, Store } from "@keepcv/schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Meta } from "../../../components/ui/meta.js";
import { NameBox } from "../../../components/ui/name-box.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { counted } from "../../../lib/label.js";
import { useCreateResume, useDeriveResume } from "../api/use-resumes.js";
import { type ResumeRow, resumeRows } from "../model/resume-rows.js";

// The name is asked for, because two resumes called the same thing is the state
// this is most likely to produce and the hardest to unpick later.
function Derive({ resume, client }: { resume: Resume; client: ApiClient }) {
  const derive = useDeriveResume(client);
  const navigate = useNavigate();
  const [typed, setTyped] = useState<string | null>(null);

  if (typed === null) {
    return (
      <Button
        size="sm"
        icon="copy"
        label={`Start a resume from ${resume.name}`}
        onClick={() => {
          setTyped(`${resume.name} copy`);
        }}
      />
    );
  }

  return (
    <NameBox
      label={`A name for the resume started from ${resume.name}`}
      initial={`${resume.name} copy`}
      confirm={derive.isPending ? "Copying" : "Start it"}
      disabled={derive.isPending}
      onSave={(name) => {
        const id = newUuid();
        derive.mutate(
          { from: resume, id, name },
          {
            onSuccess: () => {
              void navigate({ to: "/resumes/$resumeId", params: { resumeId: id }, search: {} });
            },
          },
        );
        setTyped(null);
      }}
      onCancel={() => {
        setTyped(null);
      }}
    />
  );
}

function Row({
  row,
  resume,
  client,
}: {
  row: ResumeRow;
  resume: Resume | undefined;
  client: ApiClient;
}) {
  // The copy control is a glyph on the row rather than a labelled button under
  // it: one per resume, and a list of twelve was a list of twelve buttons.
  return (
    <li className="flex items-start gap-2 pr-2">
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: row.id }}
        className="block min-w-0 flex-1 rounded-lg px-3 py-2.5 hover:bg-surface-hover data-[archived=true]:opacity-60"
        data-archived={row.isArchived}
      >
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{row.name}</span>
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
          <span className="shrink-0 text-xs tabular-nums text-text-subtle">
            {row.applied === null ? "not sent" : `sent ${row.applied}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-text-subtle">
          {row.target ?? "No target role recorded"}
        </p>
        <Meta
          className="mt-1 text-xs tabular-nums text-text-subtle"
          parts={[
            counted(row.sections, "section", "sections"),
            counted(row.entries, "entry", "entries"),
            counted(row.points, "point", "points"),
            row.hidden === 0 ? null : `${String(row.hidden)} toggled off`,
            row.template,
          ]}
        />
      </Link>
      <span className="shrink-0 pt-2.5">
        {resume === undefined || row.isArchived ? null : <Derive resume={resume} client={client} />}
      </span>
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
      pageLimit: null,
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
        className="min-w-0 rounded-lg border border-line px-2 py-1.5 text-sm"
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
    <PageBody>
      <PageHeader title="Resumes" icon="resume" actions={<NewResume client={client} />}>
        A resume is a selection over the store, not a copy of it.
      </PageHeader>

      <Toolbar count={counted(rows.length, "resume", "resumes")}>
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
      </Toolbar>

      {rows.length === 0 ? (
        <Empty
          title={archived === "only" ? "Nothing archived here" : "No resumes yet"}
          spot={archived === "only" ? "permanent" : "compose"}
        >
          {archived === "only"
            ? "An archived resume keeps every version it ever had."
            : "Nothing a resume leaves out is lost; it stays in the store, ready for the next one."}
        </Empty>
      ) : (
        <ul className="rounded-xl border border-line bg-surface p-1 shadow-card">
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              resume={store.resumes.find((held) => held.id === row.id)}
              client={client}
            />
          ))}
        </ul>
      )}
    </PageBody>
  );
}
