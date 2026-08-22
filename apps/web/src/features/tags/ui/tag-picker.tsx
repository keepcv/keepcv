import { live, tagForLabel, tagsOfPoint, tagsOfRecord } from "@keepcv/core";
import type { Store, Tag } from "@keepcv/schema";
import { useId, useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import type { ApiClient } from "../../../lib/api.js";
import {
  newTag,
  type TagSubject,
  tagInput,
  useAssignTag,
  useUnassignTag,
} from "../api/use-tags.js";

function carried(store: Store, subject: TagSubject): Tag[] {
  return subject.kind === "record"
    ? tagsOfRecord(store, subject.id)
    : tagsOfPoint(store, subject.id);
}

function Chip({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pl-1.5 pr-1 text-xs font-medium text-slate-600">
      {tag.label}
      <button
        type="button"
        aria-label={`Take ${tag.label} off`}
        onClick={onRemove}
        className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-900"
      >
        x
      </button>
    </span>
  );
}

// One control for both sides of the vocabulary: a label nobody has used yet is
// created and assigned in one motion, and an existing one is never duplicated.
export function TagPicker({
  store,
  client,
  subject,
}: {
  store: Store;
  client: ApiClient;
  subject: TagSubject;
}) {
  const assign = useAssignTag(client);
  const unassign = useUnassignTag(client);
  const listId = useId();
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState<string>();

  const on = carried(store, subject);
  const offered = live(store.tags).filter((tag) => !on.some((held) => held.id === tag.id));

  function add() {
    const typed = label.trim();
    if (typed === "") return;

    const existing = tagForLabel(store, typed);
    if (existing !== undefined && on.some((held) => held.id === existing.id)) {
      setProblem(`${existing.label} is already on this.`);
      return;
    }
    if (existing !== undefined && existing.archivedAt !== null) {
      setProblem(`${existing.label} is archived. Put it back on the tags screen first.`);
      return;
    }

    setProblem(undefined);
    setLabel("");
    assign.mutate({
      subject,
      tag: existing ?? newTag(tagInput(typed, null)),
      isNew: existing === undefined,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {on.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing filed under a tag yet.</p>
        ) : (
          on.map((tag) => (
            <Chip
              key={tag.id}
              tag={tag}
              onRemove={() => {
                setProblem(undefined);
                unassign.mutate({ subject, tag, isNew: false });
              }}
            />
          ))
        )}
      </div>

      <div className="flex items-start gap-2">
        <div className="w-full max-w-64">
          <input
            value={label}
            list={listId}
            aria-label="Add a tag"
            placeholder="Add a tag"
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
            aria-invalid={problem !== undefined}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 aria-[invalid=true]:border-red-400"
          />
          <datalist id={listId}>
            {offered.map((tag) => (
              <option key={tag.id} value={tag.label} />
            ))}
          </datalist>
          {problem === undefined ? null : <p className="mt-1 text-xs text-red-700">{problem}</p>}
        </div>
        <Button disabled={assign.isPending} onClick={add}>
          Add
        </Button>
      </div>

      {assign.error === null ? null : <Failure error={assign.error} />}
      {unassign.error === null ? null : <Failure error={unassign.error} />}
    </div>
  );
}
