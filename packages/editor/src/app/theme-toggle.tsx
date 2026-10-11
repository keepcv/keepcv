import { Icon } from "../components/icon/icon.js";
import { cn } from "../lib/cn.js";
import { THEME_CHOICES, type ThemeChoice } from "../lib/theme.js";

const LABELS: Record<ThemeChoice, string> = {
  system: "Follow the system",
  light: "Light",
  dark: "Dark",
};

// The state is the shell's, not this component's: the rail and the narrow
// header each render one, and two hooks would let the two disagree.
export function ThemeToggle({
  choice,
  choose,
  stacked = false,
}: {
  choice: ThemeChoice;
  choose: (choice: ThemeChoice) => void;
  // A collapsed rail is narrower than three buttons in a row.
  stacked?: boolean;
}) {
  return (
    <fieldset
      className={cn(
        "flex items-center rounded-lg border border-line bg-surface-sunken p-0.5",
        stacked && "flex-col",
      )}
    >
      <legend className="sr-only">Colour scheme</legend>
      {THEME_CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={choice === option}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          onClick={() => {
            choose(option);
          }}
          className={cn(
            "grid size-6 place-items-center rounded-md transition-colors",
            choice === option
              ? "bg-surface text-text shadow-card"
              : "text-text-subtle hover:text-text",
          )}
        >
          <Icon name={option} size="xs" />
        </button>
      ))}
    </fieldset>
  );
}
