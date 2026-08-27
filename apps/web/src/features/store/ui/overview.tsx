import { live, overview, recordCounts } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import type { GlyphName } from "../../../components/icon/glyphs.js";
import { Icon } from "../../../components/icon/icon.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import {
  formatPeriod,
  KIND_GLYPHS,
  KIND_LABELS,
  KIND_NAMES,
} from "../../records/model/record-rows.js";

// The gap is the rule: one pixel of the container showing between cells draws
// the dividers at any column count, so the strip wraps without a rule ending up
// on the outside of a row.
function Totals({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line-subtle shadow-card sm:grid-cols-4">
      {children}
    </dl>
  );
}

function Total({
  label,
  value,
  icon,
  note,
  to,
  search,
}: {
  label: string;
  value: number;
  icon: GlyphName;
  note?: string;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const body = (
    <>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-subtle">
        <Icon name={icon} size="xs" />
        {label}
      </dt>
      <dd className="mt-1.5 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-text">
        {value}
      </dd>
      {note === undefined ? null : <p className="mt-1 text-xs text-text-subtle">{note}</p>}
    </>
  );

  if (to === undefined) return <div className="bg-surface px-4 py-3.5">{body}</div>;

  return (
    <Link
      to={to}
      {...(search === undefined ? {} : { search })}
      className="bg-surface px-4 py-3.5 transition-colors duration-120 ease-out-soft hover:bg-surface-hover"
    >
      {body}
    </Link>
  );
}

// What the store actually holds, by kind. The overview is the screen that says
// how big the archive has got, and four totals do not say that.
function Holdings({ store }: { store: Store }) {
  const counts = recordCounts(store).filter((count) => count.live > 0);
  if (counts.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="What the store holds" icon="record">
        Every kind with something filed under it.
      </PanelHeader>
      <PanelBody className="px-2 py-2">
        <ul className="space-y-0.5">
          {counts.map((count) => (
            <li key={count.kind}>
              <Link
                to="/records"
                search={{ kind: count.kind, archived: "exclude" }}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors duration-120 ease-out-soft hover:bg-surface-hover hover:text-text"
              >
                <Icon name={KIND_GLYPHS[count.kind]} size="sm" className="text-text-subtle" />
                <span className="min-w-0 flex-1 truncate">{KIND_LABELS[count.kind]}</span>
                <span className="shrink-0 tabular-nums text-text-subtle">{count.live}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function Tally({ count }: { count: number }) {
  return (
    <span className="min-w-6 rounded bg-caution-soft px-1.5 text-center text-xs font-medium tabular-nums text-caution-text">
      {count}
    </span>
  );
}

// A nudge that names no destination is a nudge nobody acts on.
function Nudge({
  count,
  icon,
  to,
  search,
  children,
}: {
  count: number;
  icon: GlyphName;
  to: string;
  search: Record<string, unknown>;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <li>
      <Link
        to={to}
        search={search}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Tally count={count} />
        <Icon name={icon} size="sm" className="text-text-subtle" />
        <span className="min-w-0 flex-1">{children}</span>
        <Icon name="chevronRight" size="sm" className="text-text-subtle" />
      </Link>
    </li>
  );
}

export function Overview({ store, asOf }: { store: Store; asOf: string }) {
  const summary = overview(store, { asOf });
  const { unfinished } = summary;
  const nudgeCount =
    unfinished.missingEndDate.length +
    unfinished.pointsWithoutMetrics.length +
    unfinished.expiringCertifications.length +
    unfinished.unplacedPoints.length;

  if (summary.totals.records === 0 && summary.totals.points === 0) {
    return (
      <Empty
        title="Nothing in the store yet"
        action={
          <ButtonLink tone="primary" size="lg" icon="add" to="/records/new">
            Add your first record
          </ButtonLink>
        }
      >
        The permanent record, not a resume. What fits on one page is decided later.
      </Empty>
    );
  }

  return (
    <PageBody width="full" className="space-y-6">
      <PageHeader
        title="Overview"
        icon="overview"
        actions={
          <>
            <ButtonLink icon="add" to="/records/new">
              Record
            </ButtonLink>
            <ButtonLink tone="primary" icon="add" to="/resumes" search={{ archived: "exclude" }}>
              Resume
            </ButtonLink>
          </>
        }
      >
        Everything the store holds, and what is still half-finished.
      </PageHeader>

      <Totals>
        <Total
          label="Records"
          value={summary.totals.records}
          icon="record"
          to="/records"
          search={{ archived: "exclude" }}
        />
        <Total
          label="Points"
          value={summary.totals.points}
          icon="point"
          to="/points"
          search={{ filter: "all" }}
        />
        <Total
          label="Resumes"
          value={live(store.resumes).length}
          icon="resume"
          to="/resumes"
          search={{ archived: "exclude" }}
        />
        <Total
          label="Archived"
          value={summary.totals.archived}
          icon="archive"
          note="Kept, never deleted."
        />
      </Totals>

      <div className="grid gap-5 xl:grid-cols-3 xl:items-start">
        {/* Every row here opens: the screen whose job is re-entry cannot be a
            dead end. */}
        <Panel>
          <PanelHeader title="Where you left off" icon="history">
            Most recently edited, newest first.
          </PanelHeader>
          <PanelBody className="px-1 py-1">
            {summary.recentlyEdited.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">Nothing edited yet.</p>
            ) : (
              <ul>
                {summary.recentlyEdited.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to="/records/$recordId"
                      params={{ recordId: entry.id }}
                      className="flex items-baseline gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                        {entry.title ?? "Untitled"}
                      </span>
                      <span className="shrink-0 text-xs text-text-subtle">
                        {KIND_NAMES[entry.kind]}
                      </span>
                      <span className="hidden w-36 shrink-0 text-right text-xs tabular-nums text-text-subtle sm:block">
                        {formatPeriod(entry)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Loose ends" icon="warning">
            Nudges, not errors: a half-entered record is a state the store is designed to hold.
          </PanelHeader>
          <PanelBody className="px-2 py-2">
            {nudgeCount === 0 ? (
              <p className="px-2 py-1.5 text-sm text-text-muted">
                Nothing half-finished. Unusual, and good.
              </p>
            ) : (
              <ul className="space-y-0.5">
                <Nudge
                  count={unfinished.unplacedPoints.length}
                  icon="point"
                  to="/points"
                  search={{ filter: "unplaced" }}
                >
                  points captured but not placed on a record
                </Nudge>
                <Nudge
                  count={unfinished.pointsWithoutMetrics.length}
                  icon="metric"
                  to="/points"
                  search={{ filter: "unmeasured" }}
                >
                  points with no metric, so they say what you did but not what it moved
                </Nudge>
                <Nudge
                  count={unfinished.expiringCertifications.length}
                  icon="date"
                  to="/records"
                  search={{ kind: "certification", archived: "exclude" }}
                >
                  certifications lapsing within ninety days
                </Nudge>
                {/* Named rather than filtered: these are few, and a record opens. */}
                {unfinished.missingEndDate.length === 0 ? null : (
                  <li className="flex items-baseline gap-2.5 px-2 py-1.5 text-sm text-text-muted">
                    <Tally count={unfinished.missingEndDate.length} />
                    <span>
                      ended without an end date:{" "}
                      {unfinished.missingEndDate.slice(0, 5).map((entry, index) => (
                        <span key={entry.id}>
                          {index === 0 ? "" : ", "}
                          <Link
                            to="/records/$recordId"
                            params={{ recordId: entry.id }}
                            className="underline underline-offset-2 hover:text-text"
                          >
                            {entry.title ?? "Untitled"}
                          </Link>
                        </span>
                      ))}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Holdings store={store} />
      </div>
    </PageBody>
  );
}
