import type { RecordField, Store, Uuid } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { useAddRecordField, useArchiveRecordField } from "../api/use-records.js";
import {
  BLANK_FIELD,
  buildField,
  type RecordFieldFormValues,
  VALUE_KIND_OPTIONS,
} from "../model/record-parts.js";

export function RecordFields({
  store,
  client,
  recordId,
  fields,
}: {
  store: Store;
  client: ApiClient;
  recordId: Uuid;
  fields: RecordField[];
}) {
  const add = useAddRecordField(client);
  const archive = useArchiveRecordField(client);
  const [values, setValues] = useState<RecordFieldFormValues>(BLANK_FIELD);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [adding, setAdding] = useState(false);

  const set = (patch: Partial<RecordFieldFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  return (
    <Panel>
      <PanelHeader title="Fields">
        Anything this kind of record carries that the form above has no box for. Kept as a value
        with a name rather than folded into the title, so it stays queryable.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {fields.length === 0 ? null : (
          <dl className="space-y-1.5 text-sm">
            {fields.map((field) => (
              <div key={field.id} className="flex items-baseline gap-3">
                <dt className="text-text-subtle">{field.label}</dt>
                <dd className="text-text">{field.value}</dd>
                <span className="ml-auto">
                  <Button
                    tone="ghost"
                    size="sm"
                    icon="close"
                    label={`Remove ${field.label}`}
                    onClick={() => {
                      archive.mutate(field);
                    }}
                  />
                </span>
              </div>
            ))}
          </dl>
        )}

        {add.error === null ? null : <Failure error={add.error} />}
        {archive.error === null ? null : <Failure error={archive.error} />}

        {/* Behind the control that names it, rather than three empty inputs
            sitting open under every record with the button that submits them
            below. */}
        {adding ? (
          <div className="space-y-3 rounded-lg border border-line bg-surface-sunken p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Name"
                value={values.label}
                onChange={(label) => {
                  set({ label });
                }}
                placeholder="Credential ID"
                error={errors["label"]}
              />
              <TextField
                label="Value"
                value={values.value}
                onChange={(value) => {
                  set({ value });
                }}
                placeholder="AWS-1234"
                error={errors["value"]}
              />
              <SelectField
                label="Reads as"
                options={VALUE_KIND_OPTIONS}
                value={values.valueKind}
                onChange={(valueKind) => {
                  set({ valueKind: valueKind as RecordFieldFormValues["valueKind"] });
                }}
                hint="A date says so, so a reader knows to parse it."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                tone="primary"
                icon="confirm"
                disabled={add.isPending}
                onClick={() => {
                  const plan = buildField(store, recordId, values);
                  if ("errors" in plan) {
                    setErrors(plan.errors);
                    return;
                  }
                  setErrors({});
                  setValues(BLANK_FIELD);
                  setAdding(false);
                  add.mutate(plan);
                }}
              >
                Add field
              </Button>
              <Button
                onClick={() => {
                  setErrors({});
                  setValues(BLANK_FIELD);
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            icon="add"
            onClick={() => {
              setAdding(true);
            }}
          >
            Add a field
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}
