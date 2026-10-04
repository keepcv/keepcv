import { projectPlainText } from "@keepcv/core";
import type { RichText } from "@keepcv/schema";
import { useRef, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { editBody, markBody } from "../model/markup.js";
import { RichBody } from "./rich-body.js";

export function MarkupInput({
  body,
  label,
  readOnly,
  onChange,
  onBlur,
}: {
  body: RichText;
  label: string;
  readOnly: boolean;
  onChange: (body: RichText) => void;
  onBlur: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const before = useRef<{ start: number; end: number } | undefined>(undefined);
  const selection = useRef({ start: 0, end: 0 });
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);
  const apply = (mark: Parameters<typeof markBody>[3]) => {
    try {
      onChange(markBody(body, selection.current.start, selection.current.end, mark));
      setError(null);
      setLinking(false);
      input.current?.focus();
      input.current?.setSelectionRange(selection.current.start, selection.current.end);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That formatting is not allowed.");
    }
  };
  return (
    <fieldset
      aria-label={`Editor for ${label}`}
      className="space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
    >
      {readOnly ? null : (
        <fieldset aria-label={`Formatting for ${label}`} className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              apply({ t: "b" });
            }}
          >
            Bold
          </Button>
          <Button
            onClick={() => {
              apply({ t: "i" });
            }}
          >
            Italic
          </Button>
          <Button
            onClick={() => {
              setLinking(!linking);
            }}
          >
            Link
          </Button>
          <Button
            onClick={() => {
              apply("clear");
            }}
          >
            Clear formatting
          </Button>
        </fieldset>
      )}
      {linking ? (
        <div className="flex gap-2">
          <input
            aria-label="Link address"
            value={href}
            onChange={(event) => {
              setHref(event.target.value);
            }}
            placeholder="https://..."
            className="min-w-0 flex-1 rounded border border-line-strong bg-surface px-2 text-sm"
          />
          <Button
            onClick={() => {
              apply({ t: "a", href: href.trim() });
            }}
          >
            Apply link
          </Button>
          <Button
            onClick={() => {
              setLinking(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      <textarea
        ref={input}
        value={projectPlainText(body)}
        rows={3}
        readOnly={readOnly}
        aria-label={label}
        onSelect={(event) => {
          selection.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
        }}
        onBeforeInput={(event) => {
          before.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
        }}
        onChange={(event) => {
          onChange(editBody(body, event.target.value, before.current));
          before.current = undefined;
        }}
        onKeyDown={(event) => {
          if (readOnly || !(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (!["b", "i", "k"].includes(key)) return;
          event.preventDefault();
          selection.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
          if (key === "k") setLinking(true);
          else apply({ t: key === "b" ? "b" : "i" });
        }}
        className="w-full resize-y rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm leading-relaxed text-text outline-none read-only:bg-surface-sunken focus:border-brand"
      />
      <section aria-label={`Formatted ${label}`}>
        <p className="text-sm leading-relaxed text-text-muted">
          <RichBody body={body} />
        </p>
      </section>
      {readOnly ? null : (
        <p className="text-xs text-text-subtle">
          Select words to format them. Ctrl/Cmd+B: bold; Ctrl/Cmd+I: italic; Ctrl/Cmd+K: link.
          Pasted text keeps no outside formatting.
        </p>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs text-caution-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}
