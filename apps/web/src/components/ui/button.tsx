import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { GlyphName } from "../icon/glyphs.js";
import { Icon } from "../icon/icon.js";

const TONES = {
  primary: "bg-brand text-on-brand shadow-card hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-text hover:bg-surface-hover",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
  danger: "border border-line bg-surface text-critical-text hover:bg-critical-soft",
} as const;

const SIZES = {
  sm: "h-7 rounded-md px-2 text-xs",
  md: "h-8 rounded-lg px-3 text-sm",
  lg: "h-10 rounded-lg px-4 text-sm",
} as const;

const SQUARE = { sm: "w-7 px-0", md: "w-8 px-0", lg: "w-10 px-0" } as const;
const GLYPH = { sm: "xs", md: "sm", lg: "md" } as const;

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors duration-150 ease-out-soft disabled:pointer-events-none disabled:opacity-50";

interface Look {
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  icon?: GlyphName;
  iconEnd?: GlyphName;
  className?: string;
}

function look({ tone = "secondary", size = "md", className }: Look, square: boolean): string {
  return cn(BASE, TONES[tone], SIZES[size], square && SQUARE[size], className);
}

function Content({
  icon,
  iconEnd,
  size = "md",
  pending,
  children,
}: Pick<Look, "icon" | "iconEnd" | "size"> & {
  pending?: boolean | undefined;
  children?: ReactNode;
}) {
  const leading = pending === true ? "pending" : icon;

  return (
    <>
      {leading === undefined ? null : <Icon name={leading} size={GLYPH[size]} />}
      {children}
      {iconEnd === undefined ? null : <Icon name={iconEnd} size={GLYPH[size]} />}
    </>
  );
}

export function Button({
  type = "button",
  disabled,
  pending,
  onClick,
  label,
  children,
  ...rest
}: Look & {
  type?: "button" | "submit";
  disabled?: boolean;
  pending?: boolean;
  onClick?: () => void;
  // An icon-only button carries no text to announce, so it passes `label` and
  // nothing else.
  label?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type={type === "submit" ? "submit" : "button"}
      disabled={disabled === true || pending === true}
      onClick={onClick}
      aria-label={label}
      title={children === undefined ? label : undefined}
      className={look(rest, children === undefined)}
    >
      <Content {...rest} pending={pending}>
        {children}
      </Content>
    </button>
  );
}

export function ButtonLink({
  to,
  params,
  search,
  label,
  children,
  ...rest
}: Look & {
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      {...(search === undefined ? {} : { search })}
      aria-label={label}
      title={children === undefined ? label : undefined}
      className={look(rest, children === undefined)}
    >
      <Content {...rest}>{children}</Content>
    </Link>
  );
}
