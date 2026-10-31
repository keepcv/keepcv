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
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import { type ApiClient, isProblem } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { useFormRecovery } from "../../../lib/use-form-recovery.js";
import { SummaryEditor } from "../../phrasings/ui/summary-editor.js";
import {
  useCreateChannel,
  useSetChannelArchived,
  useUpdateChannel,
  useUpdateProfile,
} from "../api/use-profile.js";
import {
  buildChannel,
  buildProfilePatch,
  CHANNEL_LABELS,
  type ChannelValues,
  channelRows,
  channelValuesOf,
  channelValuesSchema,
  EXTRACTABLE_KINDS,
  isChanged,
  missingExtractable,
  newChannelValues,
  type ProfileValues,
  profileDifferences,
  profileValuesOf,
  profileValuesSchema,
} from "../model/profile-form.js";

const KIND_OPTIONS = CONTACT_CHANNEL_KINDS.map((kind) => ({
  value: kind,
  label: CHANNEL_LABELS[kind],
}));

function Identity({ profile, client }: { profile: Profile; client: ApiClient }) {
  const update = useUpdateProfile(client);
  const recovery = useFormRecovery(
    `keepcv.profile-edit:${profile.id}`,
    profileValuesSchema,
    profileValuesOf(profile),
    profile.updatedAt,
  );
  const { values, setValues } = recovery;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<Profile | undefined>(undefined);

  const changed = isChanged(values, profile);
  const unfinished = changed || recovery.pending;
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
    const sent = recovery.begin();
    if (sent === undefined) return;
    await update
      .mutateAsync({
        profile: basedOn ?? { ...profile, updatedAt: sent.expectedUpdatedAt ?? profile.updatedAt },
        patch: built.patch,
      })
      .then((saved) => recovery.acknowledge(sent, profileValuesOf(saved), saved.updatedAt))
      .catch((error: unknown) => {
        if (isProblem(error) && error.problem.status === 409) {
          const current = profileSchema.safeParse(error.problem.current);
          if (current.success) setConflict(current.data);
        }
      })
      .finally(recovery.finish);
  }

  return (
    <>
      {conflict === undefined ? null : (
        <Conflict
          title="The profile changed while you were editing it"
          rows={profileDifferences(values, conflict)}
          onKeepTheirs={() => {
            recovery.discard(profileValuesOf(conflict), conflict.updatedAt);
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
          title="Personal details"
          aside={unfinished ? <Badge tone="warning">Not saved yet</Badge> : undefined}
        >
          These details appear in your resume headers.
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={values.fullName}
              onChange={(fullName) => {
                set({ fullName });
              }}
              error={errors["fullName"]}
            />
            <TextField
              label="Pronouns"
              value={values.pronouns}
              onChange={(pronouns) => {
                set({ pronouns });
              }}
              placeholder="optional"
              error={errors["pronouns"]}
            />
            <TextField
              label="Headline"
              value={values.headline}
              onChange={(headline) => {
                set({ headline });
              }}
              placeholder="Staff engineer, distributed systems"
              error={errors["headline"]}
            />
            <TextField
              label="Location"
              value={values.location}
              onChange={(location) => {
                set({ location });
              }}
              placeholder="Bengaluru, India"
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
              disabled={!unfinished || update.isPending}
              onClick={() => {
                recovery.discard(profileValuesOf(profile), profile.updatedAt);
                setConflict(undefined);
                update.reset();
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
  const recovery = useFormRecovery(
    `keepcv.contact-edit:${channel.id}`,
    channelValuesSchema,
    channelValuesOf(channel),
    channel.updatedAt,
  );
  const { values, setValues } = recovery;
  const [editing, setEditing] = useState(recovery.pending);
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
                disabled={update.isPending}
                onClick={() => {
                  if (editing || !recovery.pending)
                    recovery.discard(channelValuesOf(channel), channel.updatedAt);
                  setEditing(!editing);
                }}
              >
                {editing ? "Cancel" : "Edit"}
              </Button>
            </>
          )}
          <Button
            icon={isArchived ? "restore" : "archive"}
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

      {!editing ? null : (
        <div className="mt-3 space-y-3 border-t border-line-subtle pt-3">
          <ChannelFields
            values={values}
            errors={errors}
            onChange={(patch) => {
              setValues((current) => ({ ...current, ...patch }));
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
              const sent = recovery.begin();
              if (sent === undefined) return;
              void update
                .mutateAsync({
                  channel: { ...channel, updatedAt: sent.expectedUpdatedAt ?? channel.updatedAt },
                  patch: {
                    kind: values.kind,
                    label: values.label.trim() === "" ? null : values.label.trim(),
                    value: values.value.trim(),
                    isDefaultVisible: values.isDefaultVisible,
                  },
                })
                .then((saved) => {
                  if (recovery.acknowledge(sent, channelValuesOf(saved), saved.updatedAt))
                    setEditing(false);
                })
                .catch(() => undefined)
                .finally(recovery.finish);
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
  const recovery = useFormRecovery(
    `keepcv.contact-edit:new:${store.profile.id}`,
    channelValuesSchema,
    newChannelValues(),
  );
  const { values, setValues } = recovery;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(recovery.pending);

  const rows = channelRows(store, showArchived);
  const missing = missingExtractable(store);
  const order = useReorder(store.contactChannels, (channel, sortKey) => {
    update.mutate({ channel, patch: { sortKey } });
  });

  return (
    <Panel>
      <PanelHeader
        title="Contact details"
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
        Choose contact details for your resume headers.
      </PanelHeader>

      {missing.length === 0 ? null : (
        <div className="mx-4 mt-3 rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution-text">
          No {missing.map((kind) => CHANNEL_LABELS[kind].toLowerCase()).join(" and no ")} yet.{" "}
          {missing.length === EXTRACTABLE_KINDS.length
            ? "Add an email or phone number so employers can reach you."
            : "Add another way for employers to reach you."}
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
        {adding || rows.length === 0 ? (
          <>
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
                const sent = recovery.begin();
                if (sent === undefined) return;
                void create
                  .mutateAsync(built.input)
                  .then(() => {
                    if (recovery.acknowledge(sent, newChannelValues())) setAdding(false);
                  })
                  .catch(() => undefined)
                  .finally(recovery.finish);
              }}
            >
              {create.isPending ? "Adding" : "Add contact"}
            </Button>
            <Button
              tone="ghost"
              disabled={create.isPending}
              onClick={() => {
                recovery.discard(newChannelValues());
                setAdding(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            icon="add"
            onClick={() => {
              setAdding(true);
            }}
          >
            Add contact
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}

export function ProfileScreen({ store, client }: { store: Store; client: ApiClient }) {
  return (
    <PageBody>
      <PageHeader title="Profile" icon="profile">
        Your name, introduction, and contact details are shared across resumes.
      </PageHeader>

      <Identity key={store.profile.id} profile={store.profile} client={client} />
      <SummaryEditor
        store={store}
        client={client}
        owner={{ kind: "profile", row: store.profile }}
      />
      <Contacts store={store} client={client} />
    </PageBody>
  );
}
