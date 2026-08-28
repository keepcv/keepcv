import { keyForPosition, live, tagForLabel } from "@keepcv/core";
import type { RoleProfile, Store, Tag } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";
import { PageBody, PageHeader, Toolbar } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import { Segment, Segmented } from "../../../components/ui/segmented.js";
import type { ApiClient } from "../../../lib/api.js";
import { counted } from "../../../lib/label.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { newTag, tagInput } from "../../tags/api/use-tags.js";
import {
  roleProfileInput,
  useAddRoleProfileTag,
  useCreateRoleProfile,
  useRemoveRoleProfileTag,
  useSetRoleProfileArchived,
  useUpdateRoleProfile,
} from "../api/use-role-profiles.js";
import { nameError, type RoleProfileRow, roleProfileRows } from "../model/role-profile-rows.js";

// The same one control the picker on a record is: a word nobody has used yet is
// created and added to the rule in one motion.
function Words({
  store,
  profile,
  tags,
  client,
}: {
  store: Store;
  profile: RoleProfile;
  tags: Tag[];
  client: ApiClient;
}) {
  const add = useAddRoleProfileTag(client);
  const remove = useRemoveRoleProfileTag(client);
  const listId = useId();
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState<string>();

  const offered = live(store.tags).filter((tag) => !tags.some((held) => held.id === tag.id));

  function put() {
    const typed = label.trim();
    if (typed === "") return;

    const existing = tagForLabel(store, typed);
    if (existing !== undefined && tags.some((held) => held.id === existing.id)) {
      setProblem(`${existing.label} is already in this profile.`);
      return;
    }
    if (existing !== undefined && existing.archivedAt !== null) {
      setProblem(`${existing.label} is archived. Put it back on the tags screen first.`);
      return;
    }

    setProblem(undefined);
    setLabel("");
    add.mutate({
      profile,
      tag: existing ?? newTag(tagInput(typed, null)),
      isNew: existing === undefined,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-text-subtle">No words yet, so this profile selects nothing.</p>
        ) : (
          tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-sunken py-0.5 pl-1.5 pr-1 text-xs font-medium text-text-muted"
            >
              {tag.label}
              <button
                type="button"
                aria-label={`Take ${tag.label} out of ${profile.name}`}
                onClick={() => {
                  setProblem(undefined);
                  remove.mutate({ profile, tag, isNew: false });
                }}
                className="rounded px-1 text-text-subtle hover:bg-surface-hover hover:text-text"
              >
                x
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex items-start gap-2">
        <div className="w-full max-w-64">
          <input
            value={label}
            list={listId}
            aria-label={`Add a word to ${profile.name}`}
            placeholder="Add a word"
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              put();
            }}
            aria-invalid={problem !== undefined}
            className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-text-subtle focus:border-brand aria-[invalid=true]:border-critical"
          />
          <datalist id={listId}>
            {offered.map((tag) => (
              <option key={tag.id} value={tag.label} />
            ))}
          </datalist>
          {problem === undefined ? null : (
            <p className="mt-1 text-xs text-critical-text">{problem}</p>
          )}
        </div>
        <Button disabled={add.isPending} onClick={put}>
          Add to {profile.name}
        </Button>
      </div>

      {add.error === null ? null : <Failure error={add.error} />}
      {remove.error === null ? null : <Failure error={remove.error} />}
    </div>
  );
}

function Rename({
  store,
  profile,
  client,
  onDone,
}: {
  store: Store;
  profile: RoleProfile;
  client: ApiClient;
  onDone: () => void;
}) {
  const update = useUpdateRoleProfile(client);
  const [name, setName] = useState(profile.name);
  const problem = nameError(store, name, profile);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-64">
        <TextField label="Name" value={name} onChange={setName} error={problem} />
      </div>
      <Button
        tone="primary"
        disabled={problem !== undefined || update.isPending}
        onClick={() => {
          update.mutate({ profile, patch: { name: name.trim() } });
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
  row: RoleProfileRow;
  client: ApiClient;
  order: Reorder<RoleProfile>;
}) {
  const setArchived = useSetRoleProfileArchived(client);
  const [renaming, setRenaming] = useState(false);
  const { profile } = row;

  return (
    <li
      {...order.rowProps(profile)}
      className="border-t border-line-subtle px-4 py-3 first:border-t-0 data-[held=true]:opacity-40"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DragGrip />
        <span className="text-sm font-medium text-text">{profile.name}</span>
        {row.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <span className="text-xs tabular-nums text-text-subtle">
          {counted(row.records, "record", "records")}, {counted(row.points, "point", "points")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {row.isArchived ? null : (
            <>
              <ReorderControls order={order} row={profile} subject={profile.name} />
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
            icon={row.isArchived ? "restore" : "archive"}
            disabled={setArchived.isPending}
            onClick={() => {
              setArchived.mutate({ profile, archived: !row.isArchived });
            }}
          >
            {row.isArchived ? "Put back" : "Archive"}
          </Button>
        </div>
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}

      {renaming ? (
        <div className="mt-3 border-t border-line-subtle pt-3">
          <Rename
            store={store}
            profile={profile}
            client={client}
            onDone={() => {
              setRenaming(false);
            }}
          />
        </div>
      ) : null}

      {row.isArchived ? null : (
        <div className="mt-3">
          <Words store={store} profile={profile} tags={row.tags} client={client} />
        </div>
      )}
    </li>
  );
}

function NewProfile({ store, client }: { store: Store; client: ApiClient }) {
  const create = useCreateRoleProfile(client);
  const [name, setName] = useState("");
  const problem = name === "" ? undefined : nameError(store, name);

  return (
    <div className="flex items-end gap-2">
      <div className="w-full max-w-72">
        <TextField
          label="New role profile"
          value={name}
          onChange={setName}
          placeholder="Backend"
          error={problem}
          hint="The words a role like this is hired for."
        />
      </div>
      <Button
        tone="primary"
        disabled={name.trim() === "" || problem !== undefined || create.isPending}
        onClick={() => {
          create.mutate(
            roleProfileInput(
              name,
              // `role_profile_sort_key_unique` covers archived rows, so the key
              // comes from the whole collection rather than the live part.
              keyForPosition(store.roleProfiles, null, store.roleProfiles.length),
            ),
          );
          setName("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

export function RoleProfileList({
  store,
  client,
  archived,
}: {
  store: Store;
  client: ApiClient;
  archived: boolean;
}) {
  const update = useUpdateRoleProfile(client);
  const rows = roleProfileRows(store, archived);
  const order = useReorder(store.roleProfiles, (profile, sortKey) => {
    update.mutate({ profile, patch: { sortKey } });
  });

  return (
    <PageBody>
      <PageHeader title="Role profiles" icon="roleProfile">
        The words a kind of role is hired for. Applying one to a resume places everything filed
        under them, so tailoring is a click rather than an afternoon.
      </PageHeader>

      <Toolbar count={counted(rows.length, "profile", "profiles")}>
        <Segmented label="Role profiles">
          <Segment to="/role-profiles" search={{ archived: false }} active={!archived}>
            In use
          </Segment>
          <Segment to="/role-profiles" search={{ archived: true }} active={archived}>
            Archived
          </Segment>
        </Segmented>
      </Toolbar>

      {archived ? null : (
        <Panel>
          <PanelBody>
            <NewProfile store={store} client={client} />
          </PanelBody>
        </Panel>
      )}

      {rows.length === 0 ? (
        <Empty
          title={archived ? "Nothing put aside" : "No role profiles yet"}
          spot={archived ? "permanent" : "emptyStore"}
        >
          {archived ? (
            "A profile archived here keeps its words, and the tags it named are untouched."
          ) : (
            <>
              Backend, Platform, Data - a named set of words. Apply one on a resume to place what it
              selects. It reads the{" "}
              <Link to="/tags" search={{ filter: "all" }}>
                tags
              </Link>{" "}
              you already file work under.
            </>
          )}
        </Empty>
      ) : (
        <Panel>
          <PanelHeader title="What each one selects">
            A record carrying one of the words comes whole; a record that is not brings only the
            points that carry one.
          </PanelHeader>
          <ul>
            {rows.map((row) => (
              <Row key={row.profile.id} store={store} row={row} client={client} order={order} />
            ))}
          </ul>
        </Panel>
      )}
    </PageBody>
  );
}
