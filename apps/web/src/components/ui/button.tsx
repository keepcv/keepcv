import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

const TONES = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
} as const;

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  tone = "secondary",
  type = "button",
  disabled,
  onClick,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type === "submit" ? "submit" : "button"}
      disabled={disabled}
      onClick={onClick}
      className={cn(BASE, TONES[tone], className)}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  params,
  search,
  tone = "secondary",
  children,
}: {
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      {...(search === undefined ? {} : { search })}
      className={cn(BASE, TONES[tone])}
    >
      {children}
    </Link>
  );
}
