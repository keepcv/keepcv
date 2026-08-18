import { live } from "@keepcv/core";
import {
  type CareerRecord,
  type CareerRecordKind,
  careerRecordSchema,
  type Store,
  type Uuid,
} from "@keepcv/schema";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button, ButtonLink } from "../../../components/ui/button.js";
import {
  CheckboxField,
  type Option,
  SelectField,
  TextField,
} from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { type ApiClient, isProblem } from "../../../lib/api.js";
import { sentenceCase } from "../../../lib/label.js";
import { DATE_HINT } from "../../../lib/partial-date.js";
import { useCreateRecord, useUpdateRecord } from "../api/use-records.js";
import {
  blankValues,
  buildPatch,
  buildSubmission,
  creatableKinds,
  type Difference,
  differences,
  EXTRA_FIELDS,
  type ExtraField,
  type FieldErrors,
  type RecordFormValues,
  valuesOf,
} from "../model/record-form.js";
import { KIND_NAMES } from "../model/record-rows.js";

const NONE: Option = { value: "", label: "None" };

function optionsFor(store: Store, field: ExtraField): readonly Option[] | undefined {
  if (field.name === "customSectionId") {
    return [
      { value: "", label: "Choose a section" },
      ...live(store.customSections).map((row) => ({ value: row.id, label: row.heading })),
    ];
  }
  return field.options === undefined
    ? undefined
    : [NONE, ...field.options.map((value) => ({ value, label: sentenceCase(value) }))];
}

// Both sides of a stale write, named. Nothing is kept until one is chosen.
function Conflict({
  rows,
  onKeepTheirs,
  onKeepMine,
}: {
  rows: Difference[];
  onKeepTheirs: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Panel className="border-amber-300 bg-amber-50">
      <PanelHeader title="This record changed while you were editing it">
        Nothing has been saved. Both versions are below.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-amber-900">
            The change was to a field this form does not show.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1 sm:grid-cols-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  {row.label}
                </dt>
                <dd className="text-slate-800">
                  <span className="text-xs text-slate-500">yours: </span>
                  {row.mine}
                </dd>
                <dd className="text-slate-800">
                  <span className="text-xs text-slate-500">stored: </span>
                  {row.theirs}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={onKeepMine}>
            Save mine over it
          </Button>
          <Button onClick={onKeepTheirs}>Keep what is stored</Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

export function RecordForm({
  store,
  client,
  record,
  kind,
}: {
  store: Store;
  client: ApiClient;
  record?: CareerRecord;
  kind: CareerRecordKind;
}) {
  const navigate = useNavigate();
  const create = useCreateRecord(client);
  const update = useUpdateRecord(client);
  const pending = create.isPending || update.isPending;

  const [values, setValues] = useState<RecordFormValues>(() =>
    record === undefined ? blankValues(kind) : valuesOf(store, record),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<CareerRecord | undefined>(undefined);

  const set = (patch: Partial<RecordFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  const setExtra = (name: string, value: string) => {
    setValues((current) => ({ ...current, extras: { ...current.extras, [name]: value } }));
  };

  const failure = create.error ?? update.error;
  const openRecord = (recordId: Uuid) => {
    void navigate({ to: "/records/$recordId", params: { recordId } });
  };

  async function save(basedOn: CareerRecord | undefined): Promise<void> {
    setConflict(undefined);
    const target = basedOn ?? record;

    if (target === undefined) {
      const built = buildSubmission(store, values);
      if ("errors" in built) {
        setErrors(built.errors);
        return;
      }
      setErrors({});
      const saved = await create.mutateAsync(built.submission).catch(() => undefined);
      if (saved !== undefined) openRecord(saved.id);
      return;
    }

    const built = buildPatch(store, values);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    const saved = await update
      .mutateAsync({
        id: target.id,
        expectedUpdatedAt: target.updatedAt,
        patch: built.patch,
        organisation: built.organisation,
      })
      .catch((error: unknown) => {
        if (isProblem(error) && error.problem.status === 409) {
          const current = careerRecordSchema.safeParse(error.problem.current);
          if (current.success) setConflict(current.data);
        }
        return undefined;
      });
    if (saved !== undefined) openRecord(saved.id);
  }

  const extras = EXTRA_FIELDS[values.kind];
  const organisations = [...new Set(live(store.organisations).map((row) => row.name))];

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(undefined);
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {record === undefined ? "New record" : "Edit record"}
        </h1>
        <Badge>{KIND_NAMES[values.kind]}</Badge>
      </div>

      {conflict === undefined ? null : (
        <Conflict
          rows={differences(store, values, conflict)}
          onKeepTheirs={() => {
            openRecord(conflict.id);
          }}
          onKeepMine={() => {
            void save(conflict);
          }}
        />
      )}

      {failure === null || conflict !== undefined ? null : <Failure error={failure} />}

      <Panel>
        <PanelHeader title="What it is">
          Everything here may be left blank. A half-entered record is a state the store is built to
          hold, not an error.
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          {/* Fixed once stored: a record's kind decides which columns it has,
              and the store has no way to move a row between them. */}
          {record === undefined ? (
            <SelectField
              label="Kind"
              value={values.kind}
              onChange={(next) => {
                set({ kind: next as CareerRecordKind, extras: {} });
              }}
              options={creatableKinds(store).map((option) => ({
                value: option,
                label: KIND_NAMES[option],
              }))}
            />
          ) : null}
          <TextField
            label="Title"
            value={values.title}
            onChange={(title) => {
              set({ title });
            }}
            placeholder="Staff engineer, BSc Mathematics, a project name"
            error={errors["title"]}
          />
          <TextField
            label="Subtitle"
            value={values.subtitle}
            onChange={(subtitle) => {
              set({ subtitle });
            }}
            error={errors["subtitle"]}
          />
          {/* Typed, not chosen from a list: an organisation the store has never
              heard of is created by this submit. */}
          <TextField
            label="Organisation"
            value={values.organisation}
            onChange={(organisation) => {
              set({ organisation });
            }}
            suggestions={organisations}
            hint="A name the store does not have yet is added to it."
            error={errors["organisationId"]}
          />
          <TextField
            label="Location"
            value={values.location}
            onChange={(location) => {
              set({ location });
            }}
            error={errors["location"]}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="When">
          An ongoing period is the checkbox, never a missing end date: they are different facts.
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Started"
            value={values.startedOn}
            onChange={(startedOn) => {
              set({ startedOn });
            }}
            placeholder="2019-04"
            hint={DATE_HINT}
            error={errors["startedOn"]}
          />
          <TextField
            label="Ended"
            value={values.endedOn}
            onChange={(endedOn) => {
              set({ endedOn });
            }}
            placeholder="2024"
            error={errors["endedOn"]}
          />
          {/* Padded to clear the label its neighbours have, but only once the
              three are on one row. */}
          <CheckboxField
            label="Still ongoing"
            checked={values.isCurrent}
            onChange={(isCurrent) => {
              set({ isCurrent });
            }}
            className="sm:pt-5"
          />
        </PanelBody>
      </Panel>

      {extras.length === 0 ? null : (
        <Panel>
          <PanelHeader title="What this kind carries">
            Kept as real fields rather than folded into the title, so they stay queryable.
          </PanelHeader>
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            {extras.map((field) => {
              const options = optionsFor(store, field);
              const value = values.extras[field.name] ?? "";
              return options === undefined ? (
                <TextField
                  key={field.name}
                  label={field.label}
                  value={value}
                  onChange={(next) => {
                    setExtra(field.name, next);
                  }}
                  {...(field.hint === undefined ? {} : { hint: field.hint })}
                  error={errors[field.name]}
                />
              ) : (
                <SelectField
                  key={field.name}
                  label={field.label}
                  value={value}
                  onChange={(next) => {
                    setExtra(field.name, next);
                  }}
                  options={options}
                  {...(field.hint === undefined ? {} : { hint: field.hint })}
                  error={errors[field.name]}
                />
              );
            })}
          </PanelBody>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" type="submit" disabled={pending}>
          {pending ? "Saving" : record === undefined ? "Add record" : "Save"}
        </Button>
        {record === undefined ? (
          <ButtonLink to="/records" search={{ archived: "exclude" }}>
            Cancel
          </ButtonLink>
        ) : (
          <ButtonLink to="/records/$recordId" params={{ recordId: record.id }}>
            Cancel
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
