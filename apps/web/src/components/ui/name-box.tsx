import { useEffect, useRef, useState } from "react";
import { Button } from "./button.js";

// It replaces the control that was just clicked, so it appears under the cursor:
// one that is not focused reads as broken, which it did in a browser.
export function NameBox({
  label,
  placeholder,
  initial = "",
  confirm,
  disabled,
  onSave,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  initial?: string;
  confirm: string;
  disabled?: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(initial);

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        ref={box}
        aria-label={label}
        value={typed}
        placeholder={placeholder}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && typed.trim() !== "") onSave(typed.trim());
          if (event.key === "Escape") onCancel();
        }}
        className="min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      />
      <Button
        tone="primary"
        disabled={typed.trim() === "" || disabled === true}
        onClick={() => {
          onSave(typed.trim());
        }}
      >
        {confirm}
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
    </span>
  );
}
