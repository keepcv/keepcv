import { live, overview } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty } from "../../../app/states.js";
import type { GlyphName } from "../../../components/icon/glyphs.js";
import { Icon } from "../../../components/icon/icon.js";
import { ButtonLink } from "../../../components/ui/button.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Stat } from "../../../components/ui/stat.js";
import { formatPeriod, KIND_NAMES } from "../../records/model/record-rows.js";

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
        This is the permanent record, not a resume. Add everything you have done; deciding what fits
        on one page happens later, and nothing you write here is ever trimmed away.
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Records"
          value={summary.totals.records}
          icon="record"
          to="/records"
          search={{ archived: "exclude" }}
        />
        <Stat
          label="Points"
          value={summary.totals.points}
          icon="point"
          to="/points"
          search={{ filter: "all" }}
        />
        <Stat
          label="Resumes"
          value={live(store.resumes).length}
          icon="resume"
          to="/resumes"
          search={{ archived: "exclude" }}
        />
        <Stat
          label="Archived"
          value={summary.totals.archived}
          icon="archive"
          note="Kept, never deleted."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
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
      </div>
    </div>
  );
}
