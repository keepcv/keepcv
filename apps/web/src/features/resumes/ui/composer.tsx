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
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { DragGrip, ReorderControls } from "../../../components/ui/reorder.js";
import type { ApiClient } from "../../../lib/api.js";
import { type Reorder, useReorder } from "../../../lib/order.js";
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

// Off is a state, not an absence: the row stays visible so the selection can be
// read, and only the document drops it.
function Off() {
  return <Badge>off</Badge>;
}

interface Writes {
  toggle: (placed: Placed, isVisible: boolean) => void;
  move: (placed: Placed, sortKey: SortKey) => void;
  remove: (placed: Placed) => void;
  place: (placement: Placement) => void;
}

// Every label names its row, because four of these repeat down the screen and
// "Up" on its own tells a screen reader nothing.
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
    <span className="flex shrink-0 items-center gap-1">
      {reorder}
      <Button
        tone="ghost"
        size="sm"
        label={`${isVisible ? "Stop printing" : "Print"} ${subject}`}
        onClick={() => {
          writes.toggle(placed, !isVisible);
        }}
      >
        {isVisible ? "Hide" : "Show"}
      </Button>
      <Button
        tone="ghost"
        size="sm"
        label={`Take ${subject} off this resume`}
        onClick={() => {
          writes.remove(placed);
        }}
      >
        Remove
      </Button>
    </span>
  );
}

// A picker rather than a dialog: what can be added is a list the boot payload
// already answers, and a row taken off comes back through the same control.
function AddPicker<T extends { label: string }>({
  label,
  empty,
  options,
  onPick,
}: {
  label: string;
  empty: string;
  options: readonly T[];
  onPick: (option: T) => void;
}) {
  const [chosen, setChosen] = useState("");
  const picked = options[Number(chosen)];

  if (options.length === 0) return <p className="text-xs text-slate-400">{empty}</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={label}
        value={chosen}
        onChange={(event) => {
          setChosen(event.target.value);
        }}
        className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
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
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-0.5 text-sm text-slate-700 data-[held=true]:opacity-40 data-[off=true]:opacity-50"
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
          className="max-w-40 rounded border border-slate-200 px-1 py-0.5 text-xs text-slate-600"
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
      className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0 last:pb-0 data-[held=true]:opacity-40"
    >
      {/* Wraps rather than hiding: which role, where and when is the whole
          identity of an entry, and dropping it below `sm` leaves a bare title. */}
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 data-[off=true]:opacity-50"
        data-off={!entry.isVisible}
      >
        <DragGrip />
        <Link
          to="/records/$recordId"
          params={{ recordId: entry.recordId }}
          className="min-w-40 flex-1 truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {entry.title}
        </Link>
        {entry.isVisible ? null : <Off />}
        {entry.isArchived ? <Badge tone="warning">Archived</Badge> : null}
        <span className="text-xs text-slate-500">{entry.organisation}</span>
        <span className="text-xs tabular-nums text-slate-500">{entry.period}</span>
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
          <p className="mt-1 text-xs text-slate-400">
            None of its {entry.available} points are on this resume.
          </p>
        )
      ) : (
        <ul className="mt-1.5">
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

      <div className="mt-2">
        <AddPicker
          label={`Add a point to ${entry.title}`}
          empty="Every point of this record is already on the resume."
          options={entry.placeable}
          onPick={onPlacePoint}
        />
      </div>
    </li>
  );
}

// The heading a section prints under, edited in place: it is one field, and a
// route for it would be a page with a single input on it.
function Heading({
  section,
  onRename,
}: {
  section: CompositionSection;
  onRename: (heading: string) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  if (typed === null) {
    return (
      <button
        type="button"
        onClick={() => {
          setTyped(section.isDefaultHeading ? "" : section.heading);
        }}
        className="text-xs text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        {section.isDefaultHeading
          ? `Rename, currently the default "${section.heading}"`
          : `Rename, or empty the box to print "${section.heading}" no more`}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`Heading for ${section.heading}`}
        value={typed}
        placeholder={section.heading}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      />
      <Button
        tone="primary"
        onClick={() => {
          onRename(typed);
          setTyped(null);
        }}
      >
        Save
      </Button>
      <Button
        onClick={() => {
          setTyped(null);
        }}
      >
        Cancel
      </Button>
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
  const entries = useReorder(entriesOf(store, section.row.id), (row, sortKey) => {
    writes.move({ level: "entry", row }, sortKey);
  });

  return (
    <div {...order.rowProps(section.row)} className="data-[held=true]:opacity-40">
      <Panel>
        <PanelHeader
          title={section.heading}
          aside={
            <span className="flex items-center gap-2">
              {section.isVisible ? null : <Badge>section off</Badge>}
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
          <Heading section={section} onRename={onRename} />

          {section.entries.length === 0 ? (
            <p className="text-sm text-slate-600">Nothing placed in this section yet.</p>
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
            empty="Every record of this kind is already in this section."
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

// An override on top of the channel's own default, which is why following the
// default again is a third choice rather than the same thing as hiding it.
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
              <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-slate-400">
                {contact.label}
              </span>
              <span className="min-w-40 flex-1 truncate text-sm text-slate-700">
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

  return (
    <div className="space-y-5">
      {detail.sections.length === 0 ? (
        <Empty title="This resume is empty">
          Sections come first, then the records that go in them, then the points under each. Nothing
          is copied - a resume points at the store.
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

      <Contacts resumeId={resumeId} contacts={detail.contacts} client={client} />
    </div>
  );
}
