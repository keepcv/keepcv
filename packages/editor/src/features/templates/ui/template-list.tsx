import { newUuid } from "@keepcv/core";
import type { Store, TemplateFile, TemplateSpec } from "@keepcv/schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { ARCHIVED_FILTERS, ARCHIVED_LABELS, type ArchivedFilter } from "../../../lib/archived.js";
import { counted } from "../../../lib/label.js";
import { useCreateTemplate, useSetTemplateArchived } from "../api/use-templates.js";
import { readDesign } from "../model/design-file.js";
import { type TemplateRow, templateRows } from "../model/template-rows.js";
import { TemplateThumbnail } from "./thumbnail.js";

// A built-in has no row, so its design is read back off the template it built.
function specOf(row: TemplateRow): TemplateSpec {
  return row.row?.spec ?? { settings: { ...row.template.defaultConfig }, extraCss: "" };
}

// `template_name_unique` covers archived rows, so the clash is named here
// rather than left to the store to refuse.
function NewDesign({
  store,
  client,
  rows,
  onDone,
}: {
  store: Store;
  client: ApiClient;
  rows: TemplateRow[];
  onDone: () => void;
}) {
  const create = useCreateTemplate(client);
  const navigate = useNavigate();
  const fileId = useId();
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState(rows[0]?.id ?? "");
  const [loaded, setLoaded] = useState<TemplateFile | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const clash = store.templates.some((row) => row.name === name.trim());
  const from = rows.find((row) => row.id === basedOn);
  const spec = loaded?.spec ?? (from === undefined ? undefined : specOf(from));

  const start = () => {
    if (spec === undefined) return;
    const id = newUuid();
    create.mutate({ id, name: name.trim(), spec });
    onDone();
    void navigate({ to: "/templates/$templateId", params: { templateId: id } });
  };

  const read = (file: File) => {
    setProblem(undefined);
    void file.text().then((body) => {
      const answer = readDesign(body);
      if ("problem" in answer) {
        setProblem(answer.problem);
        return;
      }
      setLoaded(answer.design);
      // Only when nothing has been typed: a name the user chose outranks the
      // one the file was saved under.
      setName((typed) => (typed.trim() === "" ? answer.design.name : typed));
    });
  };

  return (
    <Panel>
      <PanelHeader title="Start a design">
        From one that is already here, or from a file somebody saved out. It is read in this tab and
        never uploaded.
      </PanelHeader>
      <PanelBody className="max-w-xl space-y-3">
        <TextField
          label="Name"
          value={name}
          placeholder="Navy headings"
          onChange={setName}
          error={clash ? "A design of yours is already called that." : undefined}
        />

        {loaded === undefined ? (
          <>
            <SelectField
              label="Based on"
              options={rows.map((row) => ({ value: row.id, label: row.name }))}
              value={basedOn}
              onChange={setBasedOn}
            />
            <div className="space-y-1">
              <label htmlFor={fileId} className="block text-xs font-medium text-text-muted">
                Or load one from a file
              </label>
              <input
                id={fileId}
                type="file"
                accept=".json,application/json"
                className="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:text-on-brand"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) read(file);
                }}
              />
              {problem === undefined ? null : (
                <p className="text-xs text-critical-text">{problem}</p>
              )}
            </div>
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span>
              Read from a file, saved as <span className="text-text">{loaded.name}</span>.
            </span>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => {
                setLoaded(undefined);
              }}
            >
              Use one from here instead
            </Button>
          </p>
        )}

        <div className="flex gap-2">
          <Button
            tone="primary"
            icon="confirm"
            disabled={name.trim() === "" || clash || spec === undefined}
            onClick={start}
          >
            Start it
          </Button>
          <Button tone="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </PanelBody>
    </Panel>
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
  const [starting, setStarting] = useState(false);
  const rows = templateRows(store, archived);
  const startable = templateRows(store, "exclude");

  return (
    <PageBody>
      <PageHeader
        title="Templates"
        icon="template"
        actions={
          starting ? null : (
            <Button
              tone="primary"
              icon="add"
              expanded={false}
              onClick={() => {
                setStarting(true);
              }}
            >
              New design
            </Button>
          )
        }
      >
        What a resume prints through. Yours are kept in the store and travel in your export.
      </PageHeader>

      {starting ? (
        <NewDesign
          store={store}
          client={client}
          rows={startable}
          onDone={() => {
            setStarting(false);
          }}
        />
      ) : null}

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
