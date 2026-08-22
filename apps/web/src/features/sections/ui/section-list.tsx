import type { CustomSection, Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import {
  sectionInput,
  useCreateCustomSection,
  useSetCustomSectionArchived,
  useUpdateCustomSection,
} from "../api/use-custom-sections.js";
import { headingError, type SectionRow, sectionRows } from "../model/section-rows.js";

function Rename({
  store,
  section,
  client,
  onDone,
}: {
  store: Store;
  section: CustomSection;
  client: ApiClient;
  onDone: () => void;
}) {
  const update = useUpdateCustomSection(client);
  const [heading, setHeading] = useState(section.heading);
  const problem = headingError(store, heading, section);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-64">
        <TextField label="Heading" value={heading} onChange={setHeading} error={problem} />
      </div>
      <Button
        tone="primary"
        disabled={problem !== undefined || update.isPending}
        onClick={() => {
          update.mutate({ section, patch: { heading: heading.trim() } });
          onDone();
        }}
      >
        Save
      </Button>
      <Button onClick={onDone}>Cancel</Button>
    </div>
  );
}

function Row({
  store,
  row,
  client,
  order,
}: {
  store: Store;
  row: SectionRow;
  client: ApiClient;
  order: Reorder<CustomSection>;
}) {
  const setArchived = useSetCustomSectionArchived(client);
  const [renaming, setRenaming] = useState(false);
  const { section } = row;

  return (
    <li
      {...order.rowProps(section)}
      className="border-t border-slate-100 px-4 py-3 first:border-t-0 data-[held=true]:opacity-40"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DragGrip />
        <span className="text-sm font-medium text-slate-900">{section.heading}</span>
        {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        {row.records === 0 ? (
          <span className="text-xs tabular-nums text-slate-400">nothing under it</span>
        ) : (
          <Link
            to="/records"
            search={{ kind: "custom_entry", archived: "exclude" }}
            className="text-xs tabular-nums text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {row.records} {row.records === 1 ? "entry" : "entries"}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          {row.isArchived ? null : (
            <>
              <ReorderControls order={order} row={section} subject={section.heading} />
              <Button
                onClick={() => {
                  setRenaming(!renaming);
                }}
              >
                Rename
              </Button>
            </>
          )}
          <Button
            tone={row.isArchived ? "secondary" : "danger"}
            disabled={setArchived.isPending}
            onClick={() => {
              setArchived.mutate({ section, archived: !row.isArchived });
            }}
          >
            {row.isArchived ? "Put back" : "Archive"}
          </Button>
        </div>
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}

      {renaming ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Rename
            store={store}
            section={section}
            client={client}
            onDone={() => {
              setRenaming(false);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function NewSection({ store, client }: { store: Store; client: ApiClient }) {
  const create = useCreateCustomSection(client);
  const [heading, setHeading] = useState("");
  const problem = heading === "" ? undefined : headingError(store, heading);

  return (
    <div className="flex items-end gap-2">
      <div className="w-full max-w-72">
        <TextField
          label="New section"
          value={heading}
          onChange={setHeading}
          placeholder="Patents"
          error={problem}
          hint="The heading it prints under."
        />
      </div>
      <Button
        tone="primary"
        disabled={heading.trim() === "" || problem !== undefined || create.isPending}
        onClick={() => {
          create.mutate(sectionInput(store, heading));
          setHeading("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

export function SectionList({
  store,
  client,
  archived,
}: {
  store: Store;
  client: ApiClient;
  archived: boolean;
}) {
  const update = useUpdateCustomSection(client);
  const rows = sectionRows(store, archived);
  const order = useReorder(store.customSections, (section, sortKey) => {
    update.mutate({ section, patch: { sortKey } });
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sections</h1>
          <p className="max-w-xl text-xs text-slate-500">
            Headings of your own, for work the eleven built-in kinds have no name for. A record
            filed under one prints there and nowhere else.
          </p>
        </div>
        <Segmented label="Sections">
          <Segment to="/sections" search={{ archived: false }} active={!archived}>
            In use
          </Segment>
          <Segment to="/sections" search={{ archived: true }} active={archived}>
            Archived
          </Segment>
        </Segmented>
      </div>

      {archived ? null : (
        <Panel>
          <PanelBody>
            <NewSection store={store} client={client} />
          </PanelBody>
        </Panel>
      )}

      {rows.length === 0 ? (
        <Empty title={archived ? "Nothing put aside" : "No sections of your own yet"}>
          {archived
            ? "A section archived here keeps everything filed under it."
            : "Add one and a record can be filed under it. Patents, licences, exhibitions - whatever the built-in kinds do not cover."}
        </Empty>
      ) : (
        <Panel>
          <PanelHeader title={`${String(rows.length)} shown`}>
            Archiving a section leaves every record under it alone, so nothing about a resume that
            already printed changes.
          </PanelHeader>
          <ul>
            {rows.map((row) => (
              <Row key={row.section.id} store={store} row={row} client={client} order={order} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
