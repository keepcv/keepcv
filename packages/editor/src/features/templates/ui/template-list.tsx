import type { Store } from "@keepcv/schema";
import { TEMPLATES } from "@keepcv/templates";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { useSetTemplateArchived } from "../api/use-templates.js";
import { describeTemplate } from "../model/preview.js";
import { type TemplateRow, templateRows } from "../model/template-rows.js";
import { TemplateThumbnail } from "./thumbnail.js";

function Card({ row, client }: { row: TemplateRow; client: ApiClient }) {
  const archived = useSetTemplateArchived(client);
  const held = row.row;
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-surface shadow-card">
      <Link
        to="/templates/$templateId"
        params={{ templateId: row.id }}
        aria-label={row.name}
        className="flex flex-1 items-start gap-4 rounded-t-xl p-4 transition-colors hover:bg-surface-hover"
      >
        <TemplateThumbnail template={row.template} large />
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-text">{row.name}</h3>
          <Badge>{row.isBuiltIn ? "System" : "My template"}</Badge>
          <Badge>
            {row.template.type === "html"
              ? "HTML"
              : row.template.type === "default" || row.template.type === undefined
                ? "Default"
                : row.template.type}
          </Badge>
          {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
          <p className="text-xs leading-relaxed text-text-muted">{describeTemplate(row)}</p>
          {row.usedBy === 0 ? null : (
            <p className="text-xs text-text-subtle">
              Used by {String(row.usedBy)} {row.usedBy === 1 ? "resume" : "resumes"}
            </p>
          )}
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle p-3">
        {row.isArchived ? null : (
          <ButtonLink
            size="sm"
            to="/resumes"
            search={{ archived: "exclude", create: true, template: row.id }}
          >
            Create resume
          </ButtonLink>
        )}
        {row.isBuiltIn ? (
          <ButtonLink size="sm" tone="ghost" to="/templates/new" search={{ basedOn: row.id }}>
            Make a copy
          </ButtonLink>
        ) : (
          <ButtonLink
            size="sm"
            tone="ghost"
            to="/templates/$templateId"
            params={{ templateId: row.id }}
          >
            Edit template
          </ButtonLink>
        )}
        {held === undefined ? null : (
          <Button
            size="sm"
            tone="ghost"
            icon={row.isArchived ? "restore" : "archive"}
            label={row.isArchived ? "Restore this template" : "Archive this template"}
            pending={archived.isPending}
            onClick={() => archived.mutate({ template: held, archived: !row.isArchived })}
          />
        )}
      </div>
      {archived.error === null ? null : (
        <div className="p-3">
          <Failure error={archived.error} />
        </div>
      )}
    </li>
  );
}

export function TemplateList({
  store,
  client,
  archived,
  query = "",
  collection,
}: {
  store: Store;
  client: ApiClient;
  archived: ArchivedFilter;
  query?: string;
  collection?: "system" | "mine" | undefined;
}) {
  const navigate = useNavigate();
  const [type, setType] = useState("all");
  const active = collection ?? (archived === "only" ? "mine" : "system");
  const all = templateRows(store, "include");
  const system = all.filter(
    (row) => row.isBuiltIn && TEMPLATES.some((template) => template.id === row.id),
  );
  const mine = templateRows(store, archived).filter((row) => !row.isBuiltIn);
  const matches = (row: TemplateRow) =>
    `${row.name} ${describeTemplate(row)}`.toLowerCase().includes(query.toLowerCase());
  const shown = (active === "system" ? system : mine)
    .filter(matches)
    .filter((row) => type === "all" || (row.template.type ?? "default") === type);
  const originals = all.filter(
    (row) =>
      row.isBuiltIn && row.usedBy > 0 && !TEMPLATES.some((template) => template.id === row.id),
  );
  return (
    <PageBody width="full">
      <PageHeader
        title="Templates"
        icon="template"
        actions={
          <>
            <ButtonLink to="/templates/new" search={{ import: true }}>
              Import template
            </ButtonLink>
            <ButtonLink tone="primary" icon="add" to="/templates/new">
              Create template
            </ButtonLink>
          </>
        }
      >
        Choose a system template or build your own reusable design.
      </PageHeader>
      <div className="w-52">
        <SelectField
          label="Template type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All types" },
            ...Array.from(new Set(all.map((row) => row.template.type ?? "default"))).map(
              (value) => ({
                value,
                label: value === "default" ? "Default (visual)" : value.toUpperCase(),
              }),
            ),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Segmented label="Template collection">
          <Segment
            to="/templates"
            search={{ archived, collection: "system", q: query }}
            active={active === "system"}
          >{`System templates (${String(system.length)})`}</Segment>
          <Segment
            to="/templates"
            search={{ archived, collection: "mine", q: query }}
            active={active === "mine"}
          >{`My templates (${String(mine.length)})`}</Segment>
        </Segmented>
        <div className="w-full max-w-sm">
          <TextField
            label="Find a template"
            placeholder="Name, serif, compact..."
            value={query}
            onChange={(q) => {
              void navigate({
                to: "/templates",
                search: { archived, collection: active, q },
                replace: true,
              });
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {active === "system"
            ? "Provided by the app. Preview a template, or make an editable copy."
            : "Your reusable templates. Changes are saved explicitly in the builder."}
        </p>
        {active === "mine" ? (
          <Segmented label="My templates, archived">
            {ARCHIVED_FILTERS.map((option) => (
              <Segment
                key={option}
                to="/templates"
                search={{ archived: option, collection: "mine", q: query }}
                active={archived === option}
              >
                {ARCHIVED_LABELS[option]}
              </Segment>
            ))}
          </Segmented>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <Empty
          title={
            query !== ""
              ? "No matching templates"
              : archived === "only"
                ? "No archived templates"
                : "Make a template your own"
          }
          spot="compose"
        >
          {query !== ""
            ? "Try another name or style."
            : "Create a template from scratch, or make a copy of a system template. Your saved templates appear here."}
        </Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((row) => (
            <Card key={row.id} row={row} client={client} />
          ))}
        </ul>
      )}
      {active !== "system" || originals.length === 0 ? null : (
        <details className="text-sm text-text-muted">
          <summary className="cursor-pointer">
            Original templates in use ({String(originals.length)})
          </summary>
          <ul className="mt-3 flex flex-wrap gap-3">
            {originals.map((row) => (
              <li key={row.id}>
                <Link
                  to="/templates/$templateId"
                  params={{ templateId: row.id }}
                  className="underline underline-offset-2"
                >
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </PageBody>
  );
}
