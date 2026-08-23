import type { Store, Tag } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";
import { PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import {
  tagInput,
  useCreateTag,
  useMergeTag,
  useSetTagArchived,
  useUpdateTag,
} from "../api/use-tags.js";
import {
  labelError,
  TAG_BLURBS,
  TAG_FILTER_LABELS,
  TAG_FILTERS,
  type TagFilter,
  type TagRow,
  tagRows,
} from "../model/tag-rows.js";

function Count({ n, noun, to, search }: { n: number; noun: string; to: string; search: object }) {
  const text = `${String(n)} ${noun}${n === 1 ? "" : "s"}`;
  if (n === 0) return <span className="text-xs tabular-nums text-text-subtle">{text}</span>;
  return (
    <Link
      to={to}
      search={search}
      className="text-xs tabular-nums text-text-subtle underline-offset-2 hover:text-text hover:underline"
    >
      {text}
    </Link>
  );
}

function Rename({
  store,
  tag,
  onDone,
  client,
}: {
  store: Store;
  tag: Tag;
  onDone: () => void;
  client: ApiClient;
}) {
  const update = useUpdateTag(client);
  const [label, setLabel] = useState(tag.label);
  const [category, setCategory] = useState(tag.category ?? "");
  const problem = labelError(store, label, tag);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-48">
        <TextField label="Name" value={label} onChange={setLabel} error={problem} />
      </div>
      <div className="w-40">
        <TextField
          label="Category"
          value={category}
          onChange={setCategory}
          placeholder="optional"
          suggestions={[...new Set(store.tags.flatMap((row) => row.category ?? []))]}
        />
      </div>
      <Button
        tone="primary"
        disabled={problem !== undefined || update.isPending}
        onClick={() => {
          update.mutate({
            tag,
            patch: {
              label: label.trim(),
              category: category.trim() === "" ? null : category.trim(),
            },
          });
          onDone();
        }}
      >
        Save
      </Button>
      <Button onClick={onDone}>Cancel</Button>
    </div>
  );
}

// A merge is destructive to one name and to nothing else, so the target is named
// in the confirmation rather than chosen and applied in one click.
function Merge({
  row,
  rows,
  client,
  onDone,
}: {
  row: TagRow;
  rows: TagRow[];
  client: ApiClient;
  onDone: () => void;
}) {
  const merge = useMergeTag(client);
  const others = rows.filter((other) => other.tag.id !== row.tag.id);
  const [intoTagId, setIntoTagId] = useState(others[0]?.tag.id);

  if (intoTagId === undefined) {
    return <p className="text-sm text-text-muted">There is no other tag to merge this one into.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-muted">Move everything onto</span>
      <select
        aria-label={`Merge ${row.tag.label} into`}
        value={intoTagId}
        onChange={(event) => {
          setIntoTagId(event.target.value as typeof intoTagId);
        }}
        className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm"
      >
        {others.map((other) => (
          <option key={other.tag.id} value={other.tag.id}>
            {other.tag.label}
          </option>
        ))}
      </select>
      <Button
        tone="danger"
        disabled={merge.isPending}
        onClick={() => {
          merge.mutate({ tag: row.tag, intoTagId });
          onDone();
        }}
      >
        Merge and archive {row.tag.label}
      </Button>
      <Button onClick={onDone}>Cancel</Button>
    </div>
  );
}

function Row({
  store,
  rows,
  row,
  client,
}: {
  store: Store;
  rows: TagRow[];
  row: TagRow;
  client: ApiClient;
}) {
  const setArchived = useSetTagArchived(client);
  const [open, setOpen] = useState<"rename" | "merge">();
  const { tag } = row;

  return (
    <li className="border-t border-line-subtle px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium text-text">{tag.label}</span>
        {tag.category === null ? null : <Badge>{tag.category}</Badge>}
        {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <Count n={row.records} noun="record" to="/records" search={{ tag: tag.id }} />
        <Count n={row.points} noun="point" to="/points" search={{ tag: tag.id }} />
        <div className="ml-auto flex gap-2">
          {row.isArchived ? null : (
            <>
              <Button
                onClick={() => {
                  setOpen(open === "rename" ? undefined : "rename");
                }}
              >
                Rename
              </Button>
              <Button
                onClick={() => {
                  setOpen(open === "merge" ? undefined : "merge");
                }}
              >
                Merge
              </Button>
            </>
          )}
          <Button
            tone={row.isArchived ? "secondary" : "danger"}
            disabled={setArchived.isPending}
            onClick={() => {
              setArchived.mutate({ tag, archived: !row.isArchived });
            }}
          >
            {row.isArchived ? "Put back" : "Archive"}
          </Button>
        </div>
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}

      {open === undefined ? null : (
        <div className="mt-3 border-t border-line-subtle pt-3">
          {open === "rename" ? (
            <Rename
              store={store}
              tag={tag}
              client={client}
              onDone={() => {
                setOpen(undefined);
              }}
            />
          ) : (
            <Merge
              row={row}
              rows={rows}
              client={client}
              onDone={() => {
                setOpen(undefined);
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

function NewTag({ store, client }: { store: Store; client: ApiClient }) {
  const create = useCreateTag(client);
  const [label, setLabel] = useState("");
  const problem = label === "" ? undefined : labelError(store, label);

  return (
    <div className="flex items-end gap-2">
      <div className="w-full max-w-64">
        <TextField
          label="New tag"
          value={label}
          onChange={setLabel}
          placeholder="Kubernetes"
          error={problem}
        />
      </div>
      <Button
        tone="primary"
        disabled={label.trim() === "" || problem !== undefined || create.isPending}
        onClick={() => {
          create.mutate(tagInput(label, null));
          setLabel("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

export function TagList({
  store,
  client,
  filter,
}: {
  store: Store;
  client: ApiClient;
  filter: TagFilter;
}) {
  const rows = tagRows(store, filter);
  const live = tagRows(store, "all");

  return (
    <div className="space-y-5">
      <PageHeader title="Tags" icon="tag">
        {TAG_BLURBS[filter]}
      </PageHeader>

      <Toolbar>
        <Segmented label="Tags">
          {TAG_FILTERS.map((option) => (
            <Segment key={option} to="/tags" search={{ filter: option }} active={filter === option}>
              {TAG_FILTER_LABELS[option]}
            </Segment>
          ))}
        </Segmented>
      </Toolbar>

      {filter === "archived" ? null : (
        <Panel>
          <PanelBody>
            <NewTag store={store} client={client} />
          </PanelBody>
        </Panel>
      )}

      {rows.length === 0 ? (
        <Empty title={filter === "all" ? "No tags yet" : "Nothing here"} spot="noResults">
          {filter === "all"
            ? "A tag is a word you file work under. Add one here, or type a new one straight onto a record or a point."
            : "Nothing matches that filter, which on this screen is usually good news."}
        </Empty>
      ) : (
        <Panel>
          <PanelHeader title={`${String(rows.length)} shown`}>
            A tag is never deleted. Archiving puts it aside; merging moves everything it carried
            onto another one first.
          </PanelHeader>
          <ul>
            {rows.map((row) => (
              <Row key={row.tag.id} store={store} rows={live} row={row} client={client} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
