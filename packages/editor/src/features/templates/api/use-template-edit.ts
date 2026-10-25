import { newUuid } from "@keepcv/core";
import type { Store, StoredTemplate, StoredTemplateSpec } from "@keepcv/schema";
import { templateDefinitionSchema, templateSpecSchema, uuidSchema } from "@keepcv/schema";
import { definitionOf, validateTemplate } from "@keepcv/templates";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { ApiClient } from "../../../lib/api.js";
import { readEdit, useRecoveryKey } from "../../../lib/edit-recovery.js";
import { useFormRecovery } from "../../../lib/use-form-recovery.js";
import { useCreateTemplate, useUpdateTemplate } from "./use-templates.js";

const recoverableSpec = templateSpecSchema.extend({ extraCss: z.string() });
const editSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  spec: z.union([templateDefinitionSchema, recoverableSpec]),
});
type Edit = z.infer<typeof editSchema>;

export function useTemplateEdit(
  client: ApiClient,
  store: Store,
  recoveryKey: string,
  template: StoredTemplate | undefined,
  startingSpec: StoredTemplateSpec,
  startingName: string,
) {
  const scopedKey = useRecoveryKey(recoveryKey);
  const [legacy] = useState(() => recoverableSpec.safeParse(readEdit(scopedKey)).data);
  const [initial] = useState<Edit>(() => ({
    id: template?.id ?? newUuid(),
    name: template?.name ?? startingName,
    spec: legacy ?? template?.spec ?? startingSpec,
  }));
  const form = useFormRecovery(recoveryKey, editSchema, initial, template?.updatedAt);
  const migrated = useRef(false);
  useEffect(() => {
    if (legacy === undefined || migrated.current) return;
    migrated.current = true;
    form.setValues(initial);
  }, [legacy, initial, form.setValues]);
  const create = useCreateTemplate(client);
  const update = useUpdateTemplate(client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [history, setHistory] = useState<{ past: Edit[]; future: Edit[] }>({
    past: [],
    future: [],
  });
  const edit = form.values;
  const storedEdit =
    template === undefined
      ? initial
      : { id: template.id, name: template.name, spec: template.spec };
  const nameProblem =
    edit.name.trim() === ""
      ? "Give this template a name."
      : store.templates.some((row) => row.id !== edit.id && row.name === edit.name.trim())
        ? "A template of yours already has that name."
        : undefined;
  let cssProblem: string | undefined;
  try {
    validateTemplate(edit.spec);
  } catch (reason) {
    cssProblem = reason instanceof Error ? reason.message : "Invalid template.";
  }

  async function write(
    values: Edit,
    name: string,
    copy: boolean,
    token: typeof form.expectedUpdatedAt,
  ) {
    if (template === undefined || copy) {
      return await create.mutateAsync({
        id: copy ? newUuid() : values.id,
        name,
        spec: definitionOf(values.spec),
      });
    }
    return await update.mutateAsync({
      template: { ...template, updatedAt: token ?? template.updatedAt },
      patch: { name, spec: definitionOf(values.spec) },
    });
  }

  function change(next: Edit) {
    if (JSON.stringify(edit) === JSON.stringify(next)) return;
    setHistory((held) => ({ past: [...held.past.slice(-49), edit], future: [] }));
    form.setValues(next);
    setError(null);
  }

  function travel(direction: "past" | "future") {
    const next = history[direction].at(-1);
    if (next === undefined) return;
    setHistory(
      direction === "past"
        ? { past: history.past.slice(0, -1), future: [...history.future, edit] }
        : { past: [...history.past.slice(-49), edit], future: history.future.slice(0, -1) },
    );
    form.setValues(next);
    setError(null);
  }

  async function save(copyName?: string): Promise<StoredTemplate | undefined> {
    const name = (copyName ?? edit.name).trim();
    const clash = store.templates.some(
      (row) => row.name === name && (copyName !== undefined || row.id !== edit.id),
    );
    if (name === "" || clash || cssProblem !== undefined) return undefined;
    const sent = form.begin();
    if (sent === undefined) return undefined;
    setSaving(true);
    setError(null);
    try {
      const stored = await write(sent.values, name, copyName !== undefined, sent.expectedUpdatedAt);
      if (copyName === undefined)
        form.acknowledge(
          sent,
          { id: stored.id, name: stored.name, spec: stored.spec },
          stored.updatedAt,
        );
      else form.acknowledge(sent, storedEdit, template?.updatedAt);
      return stored;
    } catch (reason) {
      setError(reason);
      return undefined;
    } finally {
      form.finish();
      setSaving(false);
    }
  }

  function discard() {
    form.discard(storedEdit, template?.updatedAt);
    setHistory({ past: [], future: [] });
    setError(null);
  }

  return {
    edit,
    change,
    travel,
    save,
    discard,
    saving,
    error,
    pending: form.pending,
    valid: nameProblem === undefined && cssProblem === undefined,
    nameProblem,
    cssProblem,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export type TemplateEdit = ReturnType<typeof useTemplateEdit>;
