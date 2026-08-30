import type {
  ResumeEntry,
  ResumeEntryPoint,
  ResumeSection,
  SortKey,
  Store,
  Uuid,
} from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
import { ApplyRoleProfile } from "../../role-profiles/ui/apply-role-profile.js";
import {
  type Placed,
  useAddComposed,
  usePatchComposed,
  useSetComposedArchived,
  useSetContactVisibility,
} from "../api/use-composition.js";
import {
  entriesOf,
  movedTo,
  type Placement,
  placePoint,
  placeRecord,
  placeSection,
  pointsOf,
  sectionsOf,
  toggled,
} from "../model/place.js";
import type {
  CompositionEntry,
  CompositionPoint,
  CompositionSection,
  ContactRow,
  ResumeDetail,
} from "../model/resume-detail.js";

// A row that vanished when toggled would read as a delete.
function Off() {
  return <Badge>off</Badge>;
}

interface Writes {
  toggle: (placed: Placed, isVisible: boolean) => void;
  move: (placed: Placed, sortKey: SortKey) => void;
  remove: (placed: Placed) => void;
  place: (placement: Placement) => void;
}

// Every label names its row: "Up" alone tells a screen reader nothing.
function Controls({
  subject,
  placed,
  isVisible,
  reorder,
  writes,
}: {
  subject: string;
  placed: Placed;
  isVisible: boolean;
  reorder: ReactNode;
  writes: Writes;
}) {
  return (
    // Dimmed, not hidden: revealed on hover alone they are gone on touch and to
    // the keyboard. `ml-auto` keeps them right when a long period wraps the
    // row.
    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity duration-150 focus-within:opacity-100 group-hover/row:opacity-100">
      {reorder}
      <Button
        tone="ghost"
        size="sm"
        icon={isVisible ? "visible" : "hidden"}
        label={`${isVisible ? "Stop printing" : "Print"} ${subject}`}
        onClick={() => {
          writes.toggle(placed, !isVisible);
        }}
      />
      <Button
        tone="ghost"
        size="sm"
        icon="close"
        label={`Take ${subject} off this resume`}
        onClick={() => {
          writes.remove(placed);
        }}
      />
    </span>
  );
}

// `empty` only where the picker is alone in a panel: everywhere else its
// absence is what says there is nothing left to add.
function AddPicker<T extends { label: string }>({
  label,
  empty,
  options,
  onPick,
}: {
  label: string;
  empty?: string;
  options: readonly T[];
  onPick: (option: T) => void;
}) {
  const [chosen, setChosen] = useState("");
  const picked = options[Number(chosen)];

  if (options.length === 0) {
    return empty === undefined ? null : <p className="text-xs text-text-subtle">{empty}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={label}
        value={chosen}
        onChange={(event) => {
          setChosen(event.target.value);
        }}
        className="min-w-0 max-w-full flex-1 rounded-lg border border-line px-2 py-1 text-xs text-text-muted"
      >
        <option value="">{label}</option>
        {options.map((option, at) => (
          <option key={option.label} value={String(at)}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        disabled={chosen === "" || picked === undefined}
        onClick={() => {
          if (picked !== undefined) onPick(picked);
          setChosen("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

function Point({
  point,
  order,
  writes,
  onChooseWording,
}: {
  point: CompositionPoint;
  order: Reorder<ResumeEntryPoint>;
  writes: Writes;
  onChooseWording: (phrasingId: Uuid) => void;
}) {
  const text = point.text || "an empty point";

  return (
    <li
      {...order.rowProps(point.row)}
      className="group/row -mx-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md px-2 py-0.5 text-sm text-text-muted transition-colors hover:bg-surface-sunken data-[held=true]:opacity-40 data-[off=true]:opacity-50"
      data-off={!point.isVisible}
    >
      <DragGrip />
      <Link
        to="/points/$pointId/edit"
        params={{ pointId: point.pointId }}
        className="min-w-40 flex-1 underline-offset-2 hover:underline"
      >
        {text}
      </Link>
      {point.wordings.length < 2 ? null : (
        <select
          aria-label={`Wording for ${text}`}
          value={point.row.phrasingId}
          onChange={(event) => {
            onChooseWording(event.target.value as Uuid);
          }}
          className="max-w-40 rounded border border-line px-1 py-0.5 text-xs text-text-muted"
        >
          {point.wordings.map((wording) => (
            <option key={wording.id} value={wording.id}>
              {wording.label}
            </option>
          ))}
        </select>
      )}
      {point.isVisible ? null : <Off />}
      <Controls
        subject={text}
        placed={{ level: "point", row: point.row }}
        isVisible={point.isVisible}
        reorder={<ReorderControls order={order} row={point.row} subject={text} />}
        writes={writes}
      />
    </li>
  );
}

function Entry({
  store,
  entry,
  order,
  writes,
  onPlacePoint,
  onChooseWording,
}: {
  store: Store;
  entry: CompositionEntry;
  order: Reorder<ResumeEntry>;
  writes: Writes;
  onPlacePoint: (point: CompositionEntry["placeable"][number]) => void;
  onChooseWording: (point: CompositionPoint, phrasingId: Uuid) => void;
}) {
  const points = useReorder(pointsOf(store, entry.row.id), (row, sortKey) => {
    writes.move({ level: "point", row }, sortKey);
  });

  return (
    <li
      {...order.rowProps(entry.row)}
      className="border-t border-line-subtle py-3 first:border-t-0 first:pt-0 last:pb-0 data-[held=true]:opacity-40"
    >
      {/* Wraps rather than hiding: which role, where and when is the whole
          identity of an entry, and dropping it below `sm` leaves a bare title. */}
      <div
        className="group/row -mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md px-2 py-0.5 transition-colors hover:bg-surface-sunken data-[off=true]:opacity-50"
        data-off={!entry.isVisible}
      >
        <DragGrip />
        <Link
          to="/records/$recordId"
          params={{ recordId: entry.recordId }}
          className="min-w-40 flex-1 truncate text-sm font-medium text-text underline-offset-2 hover:underline"
        >
          {entry.title}
        </Link>
        {entry.isVisible ? null : <Off />}
        {entry.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <span className="text-xs text-text-subtle">{entry.organisation}</span>
        <span className="text-xs tabular-nums text-text-subtle">{entry.period}</span>
        <Controls
          subject={entry.title}
          placed={{ level: "entry", row: entry.row }}
          isVisible={entry.isVisible}
          reorder={<ReorderControls order={order} row={entry.row} subject={entry.title} />}
          writes={writes}
        />
      </div>

      {entry.points.length === 0 ? (
        entry.available === 0 ? null : (
          <p className="mt-1 pl-6 text-xs text-text-subtle">
            None of its {entry.available} points are on this resume.
          </p>
        )
      ) : (
        <ul className="mt-1.5 ml-2 border-l border-line-subtle pl-4">
          {entry.points.map((point) => (
            <Point
              key={point.row.id}
              point={point}
              order={points}
              writes={writes}
              onChooseWording={(phrasingId) => {
                onChooseWording(point, phrasingId);
              }}
            />
          ))}
        </ul>
      )}

      <div className="mt-2 pl-6 empty:mt-0">
        <AddPicker
          label={`Add a point to ${entry.title}`}
          options={entry.placeable}
          onPick={onPlacePoint}
        />
      </div>
    </li>
  );
}

function Heading({
  section,
  typed,
  onType,
  onRename,
}: {
  section: CompositionSection;
  typed: string;
  onType: (typed: string | null) => void;
  onRename: (heading: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`Heading for ${section.heading}`}
        value={typed}
        placeholder={section.heading}
        onChange={(event) => {
          onType(event.target.value);
        }}
        className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-sm"
      />
      <Button
        tone="primary"
        onClick={() => {
          onRename(typed);
          onType(null);
        }}
      >
        Save
      </Button>
      <Button
        onClick={() => {
          onType(null);
        }}
      >
        Cancel
      </Button>
      <p className="w-full text-xs text-text-subtle">
        {section.isDefaultHeading
          ? `Currently the default "${section.heading}".`
          : `Empty the box to print "${section.heading}" no more.`}
      </p>
    </div>
  );
}

function Section({
  section,
  order,
  writes,
  store,
  onRename,
  onChooseWording,
}: {
  section: CompositionSection;
  order: Reorder<ResumeSection>;
  writes: Writes;
  store: Store;
  onRename: (heading: string) => void;
  onChooseWording: (point: CompositionPoint, phrasingId: Uuid) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const entries = useReorder(entriesOf(store, section.row.id), (row, sortKey) => {
    writes.move({ level: "entry", row }, sortKey);
  });

  return (
    <div {...order.rowProps(section.row)} className="group/row data-[held=true]:opacity-40">
      <Panel>
        <PanelHeader
          title={section.heading}
          aside={
            <span className="flex items-center gap-2">
              {section.isVisible ? null : <Badge>section off</Badge>}
              <Button
                tone="ghost"
                size="sm"
                icon="edit"
                label={`Rename ${section.heading}`}
                className="opacity-60 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100"
                onClick={() => {
                  setTyped(section.isDefaultHeading ? "" : section.heading);
                }}
              />
              <Controls
                subject={section.heading}
                placed={{ level: "section", row: section.row }}
                isVisible={section.isVisible}
                reorder={
                  <ReorderControls order={order} row={section.row} subject={section.heading} />
                }
                writes={writes}
              />
            </span>
          }
        />
        <PanelBody className="space-y-3">
          {typed === null ? null : (
            <Heading section={section} typed={typed} onType={setTyped} onRename={onRename} />
          )}

          {section.entries.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing placed in this section yet.</p>
          ) : (
            <ul>
              {section.entries.map((entry) => (
                <Entry
                  key={entry.row.id}
                  store={store}
                  entry={entry}
                  order={entries}
                  writes={writes}
                  onPlacePoint={(point) => {
                    writes.place(placePoint(store, entry.row, point.id, point.phrasingId));
                  }}
                  onChooseWording={onChooseWording}
                />
              ))}
            </ul>
          )}

          <AddPicker
            label={`Add a record to ${section.heading}`}
            options={section.placeable}
            onPick={(record) => {
              writes.place(placeRecord(store, section.row, record.id));
            }}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

// `null` follows the channel's own default, which is not the same as `false`.
function Contacts({
  resumeId,
  contacts,
  client,
}: {
  resumeId: Uuid;
  contacts: ContactRow[];
  client: ApiClient;
}) {
  const setVisibility = useSetContactVisibility(client);

  if (contacts.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="Contact details">
        What this resume prints in its header. Each starts from the channel&apos;s own default.
      </PanelHeader>
      <PanelBody>
        <ul className="space-y-1.5">
          {contacts.map((contact) => (
            <li key={contact.channel.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-text-subtle">
                {contact.label}
              </span>
              <span className="min-w-40 flex-1 truncate text-sm text-text-muted">
                {contact.channel.value}
              </span>
              {contact.prints ? null : <Off />}
              <Button
                tone="ghost"
                size="sm"
                label={`${contact.prints ? "Stop printing" : "Print"} ${contact.channel.value}`}
                onClick={() => {
                  setVisibility.mutate({
                    resumeId,
                    contactChannelId: contact.channel.id,
                    isVisible: !contact.prints,
                  });
                }}
              >
                {contact.prints ? "Hide" : "Show"}
              </Button>
              {contact.isOverridden ? (
                <Button
                  tone="ghost"
                  size="sm"
                  label={`Follow the default for ${contact.channel.value}`}
                  onClick={() => {
                    setVisibility.mutate({
                      resumeId,
                      contactChannelId: contact.channel.id,
                      isVisible: null,
                    });
                  }}
                >
                  Follow the default
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

export function Composer({
  store,
  client,
  detail,
  resumeId,
}: {
  store: Store;
  client: ApiClient;
  detail: ResumeDetail;
  resumeId: Uuid;
}) {
  const add = useAddComposed(client);
  const patch = usePatchComposed(client);
  const setArchived = useSetComposedArchived(client);

  const writes: Writes = {
    toggle: (placed, isVisible) => {
      patch.mutate(toggled(placed, isVisible));
    },
    move: (placed, sortKey) => {
      patch.mutate(movedTo(placed, sortKey));
    },
    remove: (placed) => {
      setArchived.mutate({ ...placed, archived: true });
    },
    place: (placement) => {
      if ("add" in placement) add.mutate(placement.add);
      else setArchived.mutate(placement.putBack);
    },
  };

  const sections = useReorder(sectionsOf(store, resumeId), (row, sortKey) => {
    writes.move({ level: "section", row }, sortKey);
  });

  // Optimistic: a refusal puts the row back, so only the reason is left to
  // show.
  const refused = add.error ?? patch.error ?? setArchived.error;

  return (
    <div className="space-y-5">
      {refused === null ? null : <Failure error={refused} />}

      {detail.sections.length === 0 ? (
        <Empty title="This resume is empty">
          Sections, then the records in them, then the points under each. Nothing is copied.
        </Empty>
      ) : (
        detail.sections.map((section) => (
          <Section
            key={section.row.id}
            section={section}
            order={sections}
            writes={writes}
            store={store}
            onRename={(heading) => {
              patch.mutate({
                level: "section",
                row: section.row,
                patch: { heading: heading.trim() === "" ? null : heading.trim() },
              });
            }}
            onChooseWording={(point, phrasingId) => {
              patch.mutate({ level: "point", row: point.row, patch: { phrasingId } });
            }}
          />
        ))
      )}

      <Panel>
        <PanelHeader title="Add a section">
          A kind already on the resume is not offered twice, and one taken off comes back where it
          was.
        </PanelHeader>
        <PanelBody>
          <AddPicker
            label="Add a section"
            empty="Every section kind is already on this resume."
            options={detail.addable.map((slot) => ({ ...slot, label: slot.heading }))}
            onPick={(slot) => {
              writes.place(placeSection(store, resumeId, slot));
            }}
          />
        </PanelBody>
      </Panel>

      <ApplyRoleProfile store={store} client={client} resumeId={resumeId} />

      <Contacts resumeId={resumeId} contacts={detail.contacts} client={client} />
    </div>
  );
}
