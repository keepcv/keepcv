import type { IntakeChoice, Uuid } from "@keepcv/schema";
import { cn } from "../../../lib/cn.js";

const ACTIONS = ["create", "merge", "skip"] as const;

const LABELS: Record<(typeof ACTIONS)[number], string> = {
  create: "Add as new",
  merge: "Merge",
  skip: "Skip",
};

// A radio group rather than three buttons: the three are one answer, and a
// screen reader has to announce which of them is currently given.
export function ChoiceRow({
  title,
  detail,
  existing,
  choice,
  mergeInto,
  onChoose,
}: {
  title: string;
  detail?: string | null;
  existing?: string | undefined;
  choice: IntakeChoice | undefined;
  mergeInto?: Uuid | undefined;
  onChoose: (choice: IntakeChoice) => void;
}) {
  const chosen = choice?.action ?? "skip";
  const offered = ACTIONS.filter((action) => action !== "merge" || mergeInto !== undefined);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", chosen === "skip" ? "text-text-subtle" : "text-text")}>
          {title}
        </p>
        {detail === undefined || detail === null || detail === "" ? null : (
          <p className="truncate text-xs text-text-subtle">{detail}</p>
        )}
        {existing === undefined ? null : (
          <p className="truncate text-xs text-caution-text">{`Already here: ${existing}`}</p>
        )}
      </div>

      <fieldset className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5">
        <legend className="sr-only">{`What to do with ${title}`}</legend>
        {offered.map((action) => (
          <label
            key={action}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              chosen === action ? "bg-surface text-text shadow-card" : "text-text-muted",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={`${title}-${String(offered.length)}`}
              checked={chosen === action}
              onChange={() => {
                onChoose(
                  action === "merge" && mergeInto !== undefined
                    ? { action: "merge", into: mergeInto }
                    : { action: action === "merge" ? "skip" : action },
                );
              }}
            />
            {LABELS[action]}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function IdentityRow({
  match,
  taken,
  onToggle,
}: {
  match: { field: string; incoming: string; existing: string | null };
  taken: boolean;
  onToggle: (taken: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={taken}
        className="mt-1 size-4 shrink-0 accent-brand"
        onChange={(event) => {
          onToggle(event.target.checked);
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-text">{match.incoming}</span>
        <span className="block text-xs text-text-subtle">
          {match.existing === null
            ? `${match.field} - nothing here yet`
            : `${match.field} - replaces "${match.existing}"`}
        </span>
      </span>
    </label>
  );
}
