import { type ReactNode, useId } from "react";
import { cn } from "../../lib/cn.js";

const CONTROL =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-line-strong focus:border-brand aria-[invalid=true]:border-critical";

interface Common {
  label: string;
  hint?: string;
  error?: string | undefined;
}

// The label, the hint and the error are wired to the control by id here, so no
// screen has to remember to do it.
function Wrapper({
  label,
  hint,
  error,
  controlId,
  describedBy,
  children,
}: Common & { controlId: string; describedBy: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={controlId} className="block text-xs font-medium text-text-muted">
        {label}
      </label>
      {children}
      {error === undefined ? (
        hint === undefined ? null : (
          <p id={describedBy} className="text-xs text-text-subtle">
            {hint}
          </p>
        )
      ) : (
        <p id={describedBy} className="text-xs text-critical-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  suggestions,
  type = "text",
  ...common
}: Common & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  type?: "text" | "password";
}) {
  const controlId = useId();
  const describedBy = `${controlId}-note`;
  const listId = `${controlId}-list`;

  return (
    <Wrapper {...common} controlId={controlId} describedBy={describedBy}>
      <input
        id={controlId}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        list={suggestions === undefined ? undefined : listId}
        aria-invalid={common.error !== undefined}
        aria-describedby={describedBy}
        className={CONTROL}
      />
      {suggestions === undefined ? null : (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </Wrapper>
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  ...common
}: Common & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const controlId = useId();
  const describedBy = `${controlId}-note`;

  return (
    <Wrapper {...common} controlId={controlId} describedBy={describedBy}>
      <textarea
        id={controlId}
        value={value}
        rows={rows}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        aria-invalid={common.error !== undefined}
        aria-describedby={describedBy}
        className={cn(CONTROL, "resize-y leading-relaxed")}
      />
    </Wrapper>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  value,
  onChange,
  options,
  ...common
}: Common & {
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
}) {
  const controlId = useId();
  const describedBy = `${controlId}-note`;

  return (
    <Wrapper {...common} controlId={controlId} describedBy={describedBy}>
      <select
        id={controlId}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={common.error !== undefined}
        aria-describedby={describedBy}
        className={CONTROL}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function RangeField({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  ...common
}: Common & {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  const controlId = useId();
  const describedBy = `${controlId}-note`;

  return (
    <Wrapper {...common} controlId={controlId} describedBy={describedBy}>
      <div className="flex items-center gap-2">
        <input
          id={controlId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
          aria-describedby={describedBy}
          className="h-4 flex-1 cursor-pointer accent-brand"
        />
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-muted">
          {value}
          {unit}
        </span>
      </div>
    </Wrapper>
  );
}

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const controlId = useId();

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input
        id={controlId}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="mt-0.5 size-4 rounded border-line accent-brand"
      />
      <div>
        <label htmlFor={controlId} className="text-sm text-text">
          {label}
        </label>
        {hint === undefined ? null : <p className="text-xs text-text-subtle">{hint}</p>}
      </div>
    </div>
  );
}
