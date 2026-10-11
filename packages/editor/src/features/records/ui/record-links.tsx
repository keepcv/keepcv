import type { RecordLink, Store, Uuid } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import type { FieldErrors } from "../../../lib/form.js";
import { useAddRecordLink, useArchiveRecordLink } from "../api/use-records.js";
import {
  BLANK_LINK,
  buildLink,
  LINK_KIND_OPTIONS,
  type LinkFormValues,
} from "../model/record-parts.js";

// Written as it is added rather than staged: a link belongs to a record that
// already exists, so there is nothing to roll back.
export function RecordLinks({
  store,
  client,
  recordId,
  links,
}: {
  store: Store;
  client: ApiClient;
  recordId: Uuid;
  links: RecordLink[];
}) {
  const add = useAddRecordLink(client);
  const archive = useArchiveRecordLink(client);
  const [values, setValues] = useState<LinkFormValues>(BLANK_LINK);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [adding, setAdding] = useState(false);

  const set = (patch: Partial<LinkFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  return (
    <Panel>
      <PanelHeader title="Links">
        Where the work itself lives. Removing one archives it.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {links.length === 0 ? null : (
          <ul className="space-y-1.5">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-2 text-sm">
                <a
                  href={link.url}
                  className="truncate text-brand-text underline underline-offset-2 hover:text-brand-hover"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {link.label ?? link.url}
                </a>
                <span className="text-xs text-text-subtle">{link.kind}</span>
                <span className="ml-auto">
                  <Button
                    tone="ghost"
                    size="sm"
                    icon="close"
                    label={`Remove ${link.label ?? link.url}`}
                    onClick={() => {
                      archive.mutate(link);
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}

        {add.error === null ? null : <Failure error={add.error} />}
        {archive.error === null ? null : <Failure error={archive.error} />}

        {/* Behind the control that names it, rather than three empty inputs
            sitting open under every record with the button that submits them
            below. */}
        {adding ? (
          <div className="space-y-3 rounded-lg border border-line bg-surface-sunken p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label="Kind"
                options={LINK_KIND_OPTIONS}
                value={values.kind}
                onChange={(kind) => {
                  set({ kind: kind as LinkFormValues["kind"] });
                }}
              />
              <TextField
                label="Address"
                value={values.url}
                onChange={(url) => {
                  set({ url });
                }}
                placeholder="https://github.com/ada/engine"
                error={errors["url"]}
              />
              <TextField
                label="Shown as"
                value={values.label}
                onChange={(label) => {
                  set({ label });
                }}
                placeholder="optional"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                tone="primary"
                icon="confirm"
                disabled={add.isPending}
                onClick={() => {
                  const built = buildLink(store, recordId, values);
                  if ("errors" in built) {
                    setErrors(built.errors);
                    return;
                  }
                  setErrors({});
                  setValues(BLANK_LINK);
                  setAdding(false);
                  add.mutate(built.link);
                }}
              >
                Add link
              </Button>
              <Button
                onClick={() => {
                  setErrors({});
                  setValues(BLANK_LINK);
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
            Add a link
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}
