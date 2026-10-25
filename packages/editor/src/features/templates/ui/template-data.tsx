import { type ResumeDocument, templateDataSchema } from "@keepcv/schema";
import { htmlScope, resolveTemplate } from "@keepcv/templates";
import { useState } from "react";
import { z } from "zod";
import { Button } from "../../../components/ui/button.js";
import { TextField } from "../../../components/ui/field.js";

const shape = z.toJSONSchema(templateDataSchema, { cycles: "ref", reused: "inline" });

interface Field {
  path: string;
  type: string;
  optional: boolean;
  binding: string;
}

function schemaOf(node: unknown): Record<string, unknown> {
  if (node === null || typeof node !== "object") return {};
  const schema = node as Record<string, unknown>;
  const ref = schema["$ref"];
  if (typeof ref === "string" && ref.startsWith("#/$defs/"))
    return schemaOf(shape.$defs?.[ref.slice(8)]);
  return schema;
}

function fields(node: unknown, path: string, result: Field[], optional = false) {
  const schema = schemaOf(node);
  const item = schemaOf(schema["items"]);
  const rich = path.endsWith("summary") || path.endsWith(".text");
  const type = rich ? "rich text" : typeof schema["type"] === "string" ? schema["type"] : "value";
  const properties = schemaOf(item["properties"]);
  const display = [
    "heading",
    "title",
    "value",
    "plainText",
    "label",
    "name",
    "display",
    "key",
  ].find((key) => Object.hasOwn(properties, key));
  const value = display === undefined ? "item" : `item.${display}`;
  const binding = rich
    ? `{% if ${path} %}{% rich_text ${path} %}{% endif %}`
    : type === "array"
      ? `{% for item in ${path} %}\n  {{ ${value} | default: "" }}\n{% endfor %}`
      : type === "object"
        ? ""
        : `{{ ${path} | default: "" }}`;
  if (path !== "") result.push({ path, type, optional, binding });
  if (rich) return;
  if (schema["properties"] !== null && typeof schema["properties"] === "object") {
    const required = Array.isArray(schema["required"]) ? schema["required"] : [];
    for (const [key, child] of Object.entries(schema["properties"]))
      fields(
        child,
        path === "" ? key : `${path}.${key}`,
        result,
        optional || !required.includes(key),
      );
  }
  if (type === "array") fields(schema["items"], `${path}[0]`, result, optional);
}
const FIELDS: Field[] = [];
fields(shape, "", FIELDS);

function valueAt(scope: unknown, path: string): string {
  let value = scope;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, part))
      return "Absent in current preview";
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return `${String(value.length)} items`;
  if (value !== null && typeof value === "object") return "Object - expand its fields below";
  return String(value).slice(0, 140);
}

export function TemplateData({
  document,
  onInsert,
}: {
  document: ResumeDocument;
  onInsert?: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const [problem, setProblem] = useState("");
  let page: { size: "a4" | "letter"; marginMm: number } = { size: "a4", marginMm: 14 };
  try {
    const { config } = resolveTemplate(document);
    page = {
      size: config["pageSize"] === "letter" ? "letter" : "a4",
      marginMm: typeof config["margin"] === "number" ? config["margin"] : 14,
    };
  } catch {}
  const scope = htmlScope(document, page);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setProblem("");
    } catch {
      setProblem("Clipboard unavailable. Select and copy the binding below.");
    }
  };
  return (
    <div className="space-y-3 text-xs text-text-muted">
      <p>
        Only this resume's selected content is available. Sections, entries, groups and points
        retain their composition order. Optional fields can be absent; arrays can be empty. Use
        loops in saved templates; [0] is a sample index.
      </p>
      <TextField
        label="Find a template field"
        value={query}
        onChange={setQuery}
        placeholder="points, links, period..."
      />
      <div className="max-h-64 space-y-2 overflow-auto">
        {FIELDS.filter((field) => field.path.toLowerCase().includes(query.toLowerCase())).map(
          (field) => (
            <div key={field.path} className="rounded border border-line p-2">
              <code className="break-all text-text">{field.path}</code>
              <span className="ml-2 text-text-subtle">
                {field.type}
                {field.optional ? " (optional)" : ""}
              </span>
              <p className="mt-1 break-all text-text-subtle">{valueAt(scope, field.path)}</p>
              {field.binding === "" ? null : (
                <>
                  <code className="mt-1 block whitespace-pre-wrap break-all text-[10px]">
                    {field.binding}
                  </code>
                  <div className="mt-1 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        void copy(field.binding);
                      }}
                    >
                      Copy binding
                    </Button>
                    {onInsert === undefined ? null : (
                      <Button size="sm" onClick={() => onInsert(field.binding)}>
                        Insert
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ),
        )}
      </div>
      {copied === "" ? null : (
        <p role="status">
          Copied <code className="break-all">{copied}</code>
        </p>
      )}
      {problem === "" ? null : <p role="alert">{problem}</p>}
      <details>
        <summary className="cursor-pointer">Current data (JSON)</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-sunken p-2">
          {JSON.stringify(scope, null, 2)}
        </pre>
      </details>
      <details>
        <summary className="cursor-pointer">Binding language reference</summary>
        <div className="mt-2 space-y-2">
          <p>
            Use {"{{ path }}"} for escaped text, {"{% rich_text path %}"} for formatted text,{" "}
            {"{% if path %}...{% else %}...{% endif %}"} for optional data, and{" "}
            {"{% for entry in section.entries %}...{% endfor %}"} for lists. forloop.index, index0,
            first and last describe the current loop.
          </p>
          <p>
            Local partials: {`{% render "entry.html", entry: entry %}`}. Assign:{" "}
            {"{% assign title = entry.title | default: entry.subtitle %}"}. Conditions support ==,
            !=, &gt;, &lt;, contains, and, or. Filters: default, join, where, first, last, size,
            upcase, downcase, capitalize, slice, in_group. The in_group filter selects
            section.entries by a group's entryKeys.
          </p>
          <p>
            HTML fragments and local CSS only. Images and WOFF2 fonts must be bundle members.
            Scripts, forms, remote resources, embedded documents, SVG, animation and raw HTML
            filters are refused. Rendering errors include the source file and line when available.
          </p>
        </div>
      </details>
    </div>
  );
}

export function TemplateDataDisclosure({
  document,
  label,
}: {
  document: ResumeDocument;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="shrink-0 text-xs text-text-muted"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer">{label}</summary>
      {open ? (
        <div className="mt-3 max-h-72 overflow-auto">
          <TemplateData document={document} />
        </div>
      ) : null}
    </details>
  );
}
