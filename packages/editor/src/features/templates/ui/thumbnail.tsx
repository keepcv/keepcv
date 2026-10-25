import type { Template } from "@keepcv/templates";
import { accentOf } from "@keepcv/templates";
import { cn } from "../../../lib/cn.js";

export function TemplateThumbnail({
  template,
  large = false,
}: {
  template: Template;
  large?: boolean;
}) {
  if (template.type === "html")
    return (
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 flex-col justify-between overflow-hidden rounded border border-line bg-document-paper p-2 shadow-sm",
          large ? "h-36 w-28" : "h-16 w-12",
        )}
      >
        <span className={cn("font-mono font-black text-text", large ? "text-3xl" : "text-xs")}>
          {template.name === "Studio" ? "Aa" : template.name === "Signal" ? "01/" : "Ab"}
        </span>
        <span className="grid grid-cols-2 gap-1">
          <span className="h-6 rounded bg-brand" />
          <span className="h-6 rounded-full border-2 border-line-strong" />
        </span>
        <span className="font-mono text-[8px] text-text-subtle">HTML</span>
      </div>
    );
  const design = template.defaultConfig;
  const beside = design["headingPlace"] === "beside";
  const centred = design["headerAlign"] === "centre";

  return (
    <div
      aria-hidden
      style={{ color: accentOf(design) }}
      className={cn(
        "flex shrink-0 flex-col gap-1 rounded border border-line bg-document-paper p-2 shadow-sm",
        large ? "h-36 w-28 gap-2 p-3" : "h-16 w-12 p-1.5",
      )}
    >
      <div className={cn("flex flex-col gap-0.5", centred && "items-center")}>
        <span className={cn("h-1.5 w-3/4 rounded-sm bg-current", large && "h-2")} />
        <span className="h-0.5 w-full rounded-full bg-line-strong" />
      </div>
      {design["headerRule"] === "under" ? <span className="h-px w-full bg-current" /> : null}
      {(large ? [0, 1, 2] : [0, 1]).map((section) => (
        <div key={section} className={cn("flex gap-1", !beside && "flex-col gap-0.5")}>
          <span
            className={cn("h-0.5 rounded-full bg-current", beside ? "mt-0.5 w-1/4" : "w-1/2")}
          />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="h-0.5 w-full rounded-full bg-line-strong" />
            <span className="h-0.5 w-4/5 rounded-full bg-line-strong" />
          </span>
        </div>
      ))}
    </div>
  );
}
