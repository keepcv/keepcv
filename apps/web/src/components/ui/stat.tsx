import { Link } from "@tanstack/react-router";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

function Body({ label, value, icon, note }: Omit<Props, "to" | "search">) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</p>
        {icon === undefined ? null : <Icon name={icon} size="sm" className="text-text-subtle" />}
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-text">{value}</p>
      {note === undefined ? null : <p className="mt-0.5 text-xs text-text-subtle">{note}</p>}
    </>
  );
}

interface Props {
  label: string;
  value: number | string;
  icon?: GlyphName;
  note?: string;
  to?: string;
  search?: Record<string, unknown>;
}

const SHELL = "rounded-xl border border-line bg-surface px-4 py-3 shadow-card transition-colors";

export function Stat({ to, search, ...body }: Props) {
  if (to === undefined) {
    return (
      <div className={SHELL}>
        <Body {...body} />
      </div>
    );
  }

  return (
    <Link
      to={to}
      {...(search === undefined ? {} : { search })}
      className={cn(SHELL, "block hover:border-brand hover:bg-surface-hover")}
    >
      <Body {...body} />
    </Link>
  );
}
