import type { Template } from "@keepcv/templates";
import { cn } from "../../../lib/cn.js";

// The shape of the design rather than a rendering of it: a list of ten would
// otherwise be ten iframes laying out ten resumes to show a box an inch wide.
export function TemplateThumbnail({ template }: { template: Template }) {
  const design = template.defaultConfig;
  const beside = design["headingPlace"] === "beside";
  const centred = design["headerAlign"] === "centre";

  return (
    <div
      aria-hidden
      className="hidden h-16 w-12 shrink-0 flex-col gap-1 rounded border border-line bg-paper p-1.5 shadow-sm sm:flex"
    >
      <div className={cn("flex flex-col gap-0.5", centred && "items-center")}>
        <span className="h-1.5 w-7 rounded-full bg-text-subtle" />
        <span className="h-0.5 w-9 rounded-full bg-line-strong" />
      </div>
      {design["headerRule"] === "under" ? <span className="h-px w-full bg-text-subtle" /> : null}
      {[0, 1].map((section) => (
        <div key={section} className={cn("flex gap-1", !beside && "flex-col gap-0.5")}>
          <span
            className={cn("h-0.5 rounded-full bg-text-subtle", beside ? "mt-0.5 w-3" : "w-5")}
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
