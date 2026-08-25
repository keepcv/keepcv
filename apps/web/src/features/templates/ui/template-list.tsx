import { newUuid } from "@keepcv/core";
import type { Store, TemplateSpec } from "@keepcv/schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { counted } from "../../../lib/label.js";
import { useCreateTemplate, useSetTemplateArchived } from "../api/use-templates.js";
import { type TemplateRow, templateRows } from "../model/template-rows.js";
import { TemplateThumbnail } from "./thumbnail.js";

// A built-in has no row, so its design is read back off the template it built.
function specOf(row: TemplateRow): TemplateSpec {
  return row.row?.spec ?? { settings: { ...row.template.defaultConfig }, extraCss: "" };
}

// One control rather than a copy button on every row: the thing being chosen is
// which design to start from, and a select says that in one place.
// `template_name_unique` covers archived rows, so the clash is named here rather
// than left to the store to refuse.
function NewDesign({
  store,
  client,
  rows,
}: {
  store: Store;
  client: ApiClient;
  rows: TemplateRow[];
}) {
  const create = useCreateTemplate(client);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState(rows[0]?.id ?? "");

  if (!open) {
    return (
      <Button
        tone="primary"
        icon="add"
        expanded={false}
        onClick={() => {
          setOpen(true);
        }}
      >
        New design
      </Button>
    );
  }

  const clash = store.templates.some((row) => row.name === name.trim());
  const from = rows.find((row) => row.id === basedOn);

  const start = () => {
    if (from === undefined) return;
    const id = newUuid();
    create.mutate({ id, name: name.trim(), spec: specOf(from) });
    setOpen(false);
    setName("");
    void navigate({ to: "/templates/$templateId", params: { templateId: id } });
  };

  // A row, not a stacked card: this replaces the control it opened from, and the
  // page header's action slot is a narrow right-aligned strip.
  return (
    <div className="flex flex-wrap items-end justify-end gap-2">
      <TextField label="Name" value={name} placeholder="Navy headings" onChange={setName} />
      <SelectField
        label="Based on"
        options={rows.map((row) => ({ value: row.id, label: row.name }))}
        value={basedOn}
        onChange={setBasedOn}
      />
      <Button tone="primary" icon="confirm" disabled={name.trim() === "" || clash} onClick={start}>
        Start it
      </Button>
      <Button
        tone="ghost"
        onClick={() => {
          setOpen(false);
        }}
      >
        Cancel
      </Button>
      {clash ? (
        <p className="w-full text-right text-xs text-caution-text">
          A design of yours is already called that.
        </p>
      ) : null}
    </div>
  );
}

function Row({ row, client }: { row: TemplateRow; client: ApiClient }) {
  const setArchived = useSetTemplateArchived(client);
  const held = row.row;

  return (
    <li className="flex items-start gap-4 border-t border-line-subtle p-3 first:border-t-0">
      <TemplateThumbnail template={row.template} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {held === undefined ? (
            <span className="text-sm font-medium text-text">{row.name}</span>
          ) : (
            <Link
              to="/templates/$templateId"
              params={{ templateId: row.id }}
              className="text-sm font-medium text-text underline-offset-2 hover:underline"
            >
              {row.name}
            </Link>
          )}
          {row.isBuiltIn ? <Badge>Built in</Badge> : null}
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-text-subtle">
          {row.usedBy === 0 ? "On no resume yet" : `On ${counted(row.usedBy, "resume", "resumes")}`}
        </p>
      </div>
      {held === undefined ? null : (
        <Button
          size="sm"
          icon={row.isArchived ? "restore" : "archive"}
          label={row.isArchived ? "Put this design back" : "Archive this design"}
          onClick={() => {
            setArchived.mutate({ template: held, archived: !row.isArchived });
          }}
        />
      )}
    </li>
  );
}

export function TemplateList({
  store,
  client,
  archived,
}: {
  store: Store;
  client: ApiClient;
  archived: ArchivedFilter;
}) {
  const rows = templateRows(store, archived);
  const startable = templateRows(store, "exclude");

  return (
    <PageBody>
      <PageHeader
        title="Templates"
        icon="template"
        actions={<NewDesign store={store} client={client} rows={startable} />}
      >
        What a resume prints through. Yours are kept in the store and travel in your export.
      </PageHeader>

      <Toolbar count={counted(rows.length, "design", "designs")}>
        <Segmented label="Archived">
          {ARCHIVED_FILTERS.map((option) => (
            <Segment
              key={option}
              to="/templates"
              search={{ archived: option }}
              active={archived === option}
            >
              {ARCHIVED_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
      </Toolbar>

      {rows.length === 0 ? (
        <Empty title="Nothing archived here" spot="permanent">
          An archived design stays on every resume that already printed with it.
        </Empty>
      ) : (
        <ul className="rounded-xl border border-line bg-surface shadow-card">
          {rows.map((row) => (
            <Row key={row.id} row={row} client={client} />
          ))}
        </ul>
      )}
    </PageBody>
  );
}
