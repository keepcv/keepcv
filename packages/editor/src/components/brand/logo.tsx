import { cn } from "../../lib/cn.js";
import { DrawerMark } from "./drawer.js";

export function Logo({
  mark = false,
  label,
  className,
}: {
  mark?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={mark ? "0 0 64 64" : "0 0 436 96"}
      fill="currentColor"
      focusable="false"
      className={cn("h-7 w-auto shrink-0", mark ? "text-brand-text" : "text-text", className)}
      aria-hidden={label === undefined ? true : undefined}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
    >
      <g
        className={mark ? undefined : "fill-brand-text"}
        transform={mark ? undefined : "translate(0 11) scale(1.15)"}
      >
        <DrawerMark />
      </g>
      {mark ? null : (
        <g transform="translate(96 0)">
          <path d="M4 12h10v24l20-24h13L23 40l25 28H34L14 45v23H4Z" />
          <path
            fillRule="evenodd"
            d="M99 46v6H67c2 9 8 12 15 10 4-1 7-3 10-6l6 6c-5 6-11 9-19 9-15 0-24-10-24-25s10-25 23-25c14 0 21 10 21 25ZM67 43h22c-1-8-5-12-11-12s-10 4-11 12Z"
          />
          <path
            fillRule="evenodd"
            d="M151 46v6h-32c2 9 8 12 15 10 4-1 7-3 10-6l6 6c-5 6-11 9-19 9-15 0-24-10-24-25s10-25 23-25c14 0 21 10 21 25Zm-32-3h22c-1-8-5-12-11-12s-10 4-11 12Z"
          />
          <path
            fillRule="evenodd"
            d="M160 23h10v6c4-5 9-8 15-8 13 0 22 10 22 25s-9 25-22 25c-6 0-11-2-15-7v22h-10Zm10 23c0 9 5 15 13 15s13-6 13-15-5-15-13-15-13 6-13 15Z"
          />
          <path d="m265 21-8 7c-4-5-9-8-15-8-12 0-19 9-19 20s7 20 19 20c6 0 12-3 16-8l8 7c-6 8-14 12-24 12-18 0-30-13-30-31s12-31 30-31c9 0 17 4 23 12Z" />
          <path d="M271 12h12l16 42 16-42h12l-23 56h-10Z" />
        </g>
      )}
    </svg>
  );
}
