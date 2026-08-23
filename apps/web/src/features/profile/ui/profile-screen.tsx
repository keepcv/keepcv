import {
  CONTACT_CHANNEL_KINDS,
  type ContactChannel,
  type Profile,
  profileSchema,
  type Store,
} from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Conflict } from "../../../components/ui/conflict.js";
import { CheckboxField, SelectField, TextField } from "../../../components/ui/field.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import { type ApiClient, isProblem } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { PhrasingEditor } from "../../phrasings/ui/phrasing-editor.js";
import {
  useCreateChannel,
  useSetChannelArchived,
  useStartSummary,
  useUpdateChannel,
  useUpdateProfile,
} from "../api/use-profile.js";
import {
  buildChannel,
  buildProfilePatch,
  buildSummarySet,
  CHANNEL_LABELS,
  type ChannelValues,
  channelRows,
  channelValuesOf,
  EXTRACTABLE_KINDS,
  isChanged,
  missingExtractable,
  newChannelValues,
  PROFILE_HINTS,
  type ProfileValues,
  profileDifferences,
  profileValuesOf,
} from "../model/profile-form.js";

const KIND_OPTIONS = CONTACT_CHANNEL_KINDS.map((kind) => ({
  value: kind,
  label: CHANNEL_LABELS[kind],
}));

function Identity({ profile, client }: { profile: Profile; client: ApiClient }) {
  const update = useUpdateProfile(client);
  const [values, setValues] = useState<ProfileValues>(() => profileValuesOf(profile));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<Profile | undefined>(undefined);

  const changed = isChanged(values, profile);
  const set = (next: Partial<ProfileValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  async function save(basedOn: Profile | undefined): Promise<void> {
    setConflict(undefined);
    const built = buildProfilePatch(values);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await update
      .mutateAsync({ profile: basedOn ?? profile, patch: built.patch })
      .catch((error: unknown) => {
        if (isProblem(error) && error.problem.status === 409) {
          const current = profileSchema.safeParse(error.problem.current);
          if (current.success) setConflict(current.data);
        }
      });
  }

  return (
    <>
      {conflict === undefined ? null : (
        <Conflict
          title="The profile changed while you were editing it"
          rows={profileDifferences(values, conflict)}
          onKeepTheirs={() => {
            setValues(profileValuesOf(conflict));
            setConflict(undefined);
          }}
          onKeepMine={() => {
            void save(conflict);
          }}
        />
      )}

      {update.error === null || conflict !== undefined ? null : <Failure error={update.error} />}

      <Panel>
        <PanelHeader
          title="Who the resume says you are"
          aside={changed ? <Badge tone="warning">Not saved yet</Badge> : undefined}
        >
          The header of every resume this store compiles, and the only place it comes from.
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={values.fullName}
              onChange={(fullName) => {
                set({ fullName });
              }}
              hint={PROFILE_HINTS.fullName}
              error={errors["fullName"]}
            />
            <TextField
              label="Pronouns"
              value={values.pronouns}
              onChange={(pronouns) => {
                set({ pronouns });
              }}
              placeholder="optional"
              hint={PROFILE_HINTS.pronouns}
              error={errors["pronouns"]}
            />
            <TextField
              label="Headline"
              value={values.headline}
              onChange={(headline) => {
                set({ headline });
              }}
              placeholder="Staff engineer, distributed systems"
              hint={PROFILE_HINTS.headline}
              error={errors["headline"]}
            />
            <TextField
              label="Location"
              value={values.location}
              onChange={(location) => {
                set({ location });
              }}
              placeholder="Bengaluru, India"
              hint={PROFILE_HINTS.location}
              error={errors["location"]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              tone="primary"
              disabled={!changed || update.isPending}
              onClick={() => {
                void save(undefined);
              }}
            >
              {update.isPending ? "Saving" : "Save"}
            </Button>
            <Button
              disabled={!changed}
              onClick={() => {
                setValues(profileValuesOf(profile));
                setErrors({});
              }}
            >
              Revert
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}

// Written as it is typed, like a metric on a point: a channel is a row of the
// profile that already exists, so there is nothing to stage and nothing to roll
// back.
function ChannelFields({
  values,
  errors,
  onChange,
}: {
  values: ChannelValues;
  errors: FieldErrors;
  onChange: (patch: Partial<ChannelValues>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <SelectField
        label="Kind"
        value={values.kind}
        onChange={(kind) => {
          onChange({ kind: kind as ChannelValues["kind"] });
        }}
        options={KIND_OPTIONS}
      />
      <TextField
        label="Value"
        value={values.value}
        onChange={(value) => {
          onChange({ value });
        }}
        placeholder="you@example.com"
        error={errors["value"]}
      />
      <TextField
        label="Label"
        value={values.label}
        onChange={(label) => {
          onChange({ label });
        }}
        placeholder="optional"
        error={errors["label"]}
      />
      <div className="flex items-end pb-1.5">
        <CheckboxField
          label="Prints by default"
          checked={values.isDefaultVisible}
          onChange={(isDefaultVisible) => {
            onChange({ isDefaultVisible });
          }}
        />
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  label,
  isArchived,
  client,
  order,
}: {
  channel: ContactChannel;
  label: string;
  isArchived: boolean;
  client: ApiClient;
  order: Reorder<ContactChannel>;
}) {
  const update = useUpdateChannel(client);
  const setArchived = useSetChannelArchived(client);
  const [values, setValues] = useState<ChannelValues | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <li
      {...order.rowProps(channel)}
      className="border-t border-line-subtle px-4 py-3 first:border-t-0 data-[held=true]:opacity-40"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DragGrip />
        <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-subtle">
          {label}
        </span>
        <span className="min-w-40 flex-1 truncate text-sm text-text">{channel.value}</span>
        {channel.isDefaultVisible ? null : <Badge>off by default</Badge>}
        {isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <div className="ml-auto flex items-center gap-2">
          {isArchived ? null : (
            <>
              <ReorderControls order={order} row={channel} subject={channel.value} />
              <Button
                onClick={() => {
                  setValues(values === undefined ? channelValuesOf(channel) : undefined);
                }}
              >
                {values === undefined ? "Edit" : "Cancel"}
              </Button>
            </>
          )}
          <Button
            tone={isArchived ? "secondary" : "danger"}
            disabled={setArchived.isPending}
            onClick={() => {
              setArchived.mutate({ channel, archived: !isArchived });
            }}
          >
            {isArchived ? "Put back" : "Archive"}
          </Button>
        </div>
      </div>

      {setArchived.error === null ? null : <Failure error={setArchived.error} />}
      {update.error === null ? null : <Failure error={update.error} />}

      {values === undefined ? null : (
        <div className="mt-3 space-y-3 border-t border-line-subtle pt-3">
          <ChannelFields
            values={values}
            errors={errors}
            onChange={(patch) => {
              setValues((current) => (current === undefined ? current : { ...current, ...patch }));
            }}
          />
          <Button
            tone="primary"
            disabled={update.isPending}
            onClick={() => {
              if (values.value.trim() === "") {
                setErrors({ value: "a contact with no value prints nothing" });
                return;
              }
              setErrors({});
              update.mutate({
                channel,
                patch: {
                  kind: values.kind,
                  label: values.label.trim() === "" ? null : values.label.trim(),
                  value: values.value.trim(),
                  isDefaultVisible: values.isDefaultVisible,
                },
              });
              setValues(undefined);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </li>
  );
}

function Contacts({ store, client }: { store: Store; client: ApiClient }) {
  const create = useCreateChannel(client);
  const update = useUpdateChannel(client);
  const [values, setValues] = useState<ChannelValues>(newChannelValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showArchived, setShowArchived] = useState(false);

  const rows = channelRows(store, showArchived);
  const missing = missingExtractable(store);
  const order = useReorder(store.contactChannels, (channel, sortKey) => {
    update.mutate({ channel, patch: { sortKey } });
  });

  return (
    <Panel>
      <PanelHeader
        title="How to reach you"
        aside={
          <label className="flex items-center gap-1.5 text-xs text-text-subtle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => {
                setShowArchived(event.target.checked);
              }}
              className="size-3.5 rounded border-line-strong"
            />
            Show archived
          </label>
        }
      >
        Each carries a default, and a resume can override it one channel at a time.
      </PanelHeader>

      {missing.length === 0 ? null : (
        <div className="mx-4 mt-3 rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution-text">
          No {missing.map((kind) => CHANNEL_LABELS[kind].toLowerCase()).join(" and no ")} yet.{" "}
          {missing.length === EXTRACTABLE_KINDS.length
            ? "A resume with neither is one a machine reading it cannot file an application from."
            : "Both are worth having: a reader that pulls the text back out looks for each."}
        </div>
      )}

      {rows.length === 0 ? null : (
        <ul>
          {rows.map((row) => (
            <ChannelRow
              key={row.channel.id}
              channel={row.channel}
              label={row.label}
              isArchived={row.isArchived}
              client={client}
              order={order}
            />
          ))}
        </ul>
      )}

      <PanelBody className="space-y-3 border-t border-line-subtle">
        <ChannelFields
          values={values}
          errors={errors}
          onChange={(patch) => {
            setValues((current) => ({ ...current, ...patch }));
          }}
        />
        {create.error === null ? null : <Failure error={create.error} />}
        <Button
          disabled={values.value.trim() === "" || create.isPending}
          onClick={() => {
            const built = buildChannel(store, values);
            if ("errors" in built) {
              setErrors(built.errors);
              return;
            }
            setErrors({});
            create.mutate(built.input);
            setValues(newChannelValues());
          }}
        >
          Add a way to reach you
        </Button>
      </PanelBody>
    </Panel>
  );
}

// The summary is a phrasing set like a point's, so it gets variants and an
// append-only history for free - but a profile that has never had one names no
// set, and there is nowhere to type until one is made.
function Summary({
  store,
  client,
  profile,
}: {
  store: Store;
  client: ApiClient;
  profile: Profile;
}) {
  const start = useStartSummary(client);

  if (profile.summarySetId !== null) {
    return (
      <PhrasingEditor
        store={store}
        client={client}
        phrasingSetId={profile.summarySetId}
        subject="profile"
      />
    );
  }

  return (
    <Panel>
      <PanelHeader title="Professional summary">
        A paragraph at the top of the resume. It gets variants and a history like any other wording,
        so the short one for a full page is a variant rather than a rewrite.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {start.error === null ? null : <Failure error={start.error} />}
        <Button
          tone="primary"
          disabled={start.isPending}
          onClick={() => {
            start.mutate({ profile, input: buildSummarySet("") });
          }}
        >
          {start.isPending ? "Starting" : "Write a summary"}
        </Button>
      </PanelBody>
    </Panel>
  );
}

export function ProfileScreen({ store, client }: { store: Store; client: ApiClient }) {
  return (
    <div className="space-y-5">
      <PageHeader title="Profile" icon="profile">
        One profile, and every resume prints from it. Nothing here is per-resume except which
        contacts a resume shows.
      </PageHeader>

      <Identity profile={store.profile} client={client} />
      <Summary store={store} client={client} profile={store.profile} />
      <Contacts store={store} client={client} />
    </div>
  );
}
