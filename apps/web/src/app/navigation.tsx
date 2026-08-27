import { live, recordCounts } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import type { GlyphName } from "../components/icon/glyphs.js";
import { Icon } from "../components/icon/icon.js";
import { KIND_LABELS } from "../features/records/model/record-rows.js";
import { cn } from "../lib/cn.js";

// The whole marker lives here rather than being coloured in from a transparent
// one in `rowClass`: the router appends this instead of merging it, so both
// `before:` colours land and the stylesheet's order picked transparent.
const ACTIVE =
  "bg-surface-sunken font-medium text-text before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand before:content-['']";

function rowClass(collapsed: boolean, indent = false): string {
  return cn(
    "relative flex items-center gap-2.5 rounded-lg py-1.5 pl-3 pr-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text",
    collapsed && "justify-center px-0",
    indent && "pl-8 text-xs",
  );
}

function NavLink({
  to,
  search,
  exact,
  icon,
  label,
  count,
  collapsed,
  indent,
}: {
  to: string;
  search?: Record<string, unknown>;
  exact?: boolean;
  icon?: GlyphName;
  label: string;
  count?: ReactNode;
  collapsed?: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      to={to}
      {...(search === undefined ? {} : { search })}
      activeOptions={{ exact: exact === true, includeSearch: search !== undefined }}
      activeProps={{ className: ACTIVE }}
      title={collapsed === true ? label : undefined}
      className={rowClass(collapsed === true, indent === true)}
    >
      {icon === undefined ? null : <Icon name={icon} size="sm" />}
      {collapsed === true ? null : (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count === undefined ? null : (
            <span className="shrink-0 text-xs tabular-nums text-text-subtle">{count}</span>
          )}
        </>
      )}
    </Link>
  );
}

function Group({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {collapsed ? (
        <hr className="mx-2 my-1.5 border-line-subtle" />
      ) : (
        <p className="flex items-center gap-2 px-2.5 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-subtle">
          {title}
          <span className="h-px flex-1 bg-line-subtle" aria-hidden="true" />
        </p>
      )}
      {children}
    </div>
  );
}

// A kind is a filter of the records list, so it nests under Records rather than
// standing beside it: eleven of them at the top level buried everything else.
function Kinds({ store, collapsed }: { store: Store; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const counts = recordCounts(store).filter((count) => count.live + count.archived > 0);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <span className="min-w-0 flex-1">
          <NavLink
            to="/records"
            search={{ archived: "exclude" }}
            icon="record"
            label="Records"
            count={live(store.records).length}
            collapsed={collapsed}
          />
        </span>
        {collapsed || counts.length === 0 ? null : (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide record kinds" : "Show record kinds"}
            onClick={() => {
              setOpen(!open);
            }}
            className="rounded-md p-1 text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Icon name={open ? "chevronUp" : "chevronDown"} size="xs" />
          </button>
        )}
      </div>
      {open && !collapsed
        ? counts.map((count) => (
            <NavLink
              key={count.kind}
              to="/records"
              search={{ kind: count.kind, archived: "exclude" }}
              label={KIND_LABELS[count.kind]}
              count={count.live}
              indent
            />
          ))
        : null}
    </>
  );
}

export function Navigation({
  store,
  collapsed = false,
  onSignOut,
}: {
  store: Store;
  collapsed?: boolean;
  onSignOut?: (() => void) | undefined;
}) {
  return (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Store">
      <NavLink to="/" exact icon="overview" label="Overview" collapsed={collapsed} />

      <Group title="Store" collapsed={collapsed}>
        <Kinds store={store} collapsed={collapsed} />
        <NavLink
          to="/points"
          search={{ filter: "all" }}
          icon="point"
          label="Points"
          count={live(store.points).length}
          collapsed={collapsed}
        />
        <NavLink
          to="/profile"
          icon="profile"
          label="Profile"
          count={store.profile.fullName === null ? "unnamed" : undefined}
          collapsed={collapsed}
        />
      </Group>

      <Group title="Vocabulary" collapsed={collapsed}>
        <NavLink
          to="/tags"
          search={{ filter: "all" }}
          icon="tag"
          label="Tags"
          count={live(store.tags).length}
          collapsed={collapsed}
        />
        <NavLink
          to="/sections"
          search={{ archived: false }}
          icon="section"
          label="Sections"
          count={live(store.customSections).length}
          collapsed={collapsed}
        />
      </Group>

      <Group title="Resumes" collapsed={collapsed}>
        <NavLink
          to="/resumes"
          search={{ archived: "exclude" }}
          icon="resume"
          label="Resumes"
          count={live(store.resumes).length}
          collapsed={collapsed}
        />
        <NavLink
          to="/templates"
          search={{ archived: "exclude" }}
          icon="template"
          label="Templates"
          count={live(store.templates).length}
          collapsed={collapsed}
        />
      </Group>

      <Group title="System" collapsed={collapsed}>
        <NavLink to="/import" icon="upload" label="Bring one in" collapsed={collapsed} />
        <NavLink to="/data" icon="data" label="Your data" collapsed={collapsed} />
        {onSignOut === undefined ? null : (
          <button
            type="button"
            onClick={onSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={rowClass(collapsed)}
          >
            <Icon name="signOut" size="sm" />
            {collapsed ? null : <span className="min-w-0 flex-1 truncate text-left">Sign out</span>}
          </button>
        )}
      </Group>
    </nav>
  );
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="KeepCV, go to overview">
      <span className="surface-gradient-brand grid size-7 shrink-0 place-items-center rounded-lg text-on-brand shadow-card">
        <Icon name="resume" size="sm" />
      </span>
      {collapsed ? null : (
        <span className="text-base font-semibold tracking-tight text-text">KeepCV</span>
      )}
    </Link>
  );
}
