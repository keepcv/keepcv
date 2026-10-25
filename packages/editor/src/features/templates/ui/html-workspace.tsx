import {
  type HtmlTemplatePayload,
  htmlTemplateSourceSchema,
  isTemplatePath,
  type ResumeDocument,
  type TemplateSourceFile,
} from "@keepcv/schema";
import { definitionOf, type Template } from "@keepcv/templates";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { SelectField, TextField } from "../../../components/ui/field.js";
import type { TemplateEdit } from "../api/use-template-edit.js";
import { Control } from "./control.js";
import { TemplateData } from "./template-data.js";

const SourceEditor = lazy(() => import("./source-editor.js"));
const MEDIA: Record<string, TemplateSourceFile["mediaType"]> = {
  html: "text/html",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  woff2: "font/woff2",
};

export function HtmlWorkspace({
  state,
  document,
  template,
}: {
  state: TemplateEdit;
  document: ResumeDocument;
  template: Template | undefined;
}) {
  const { edit } = state;
  const parsed = htmlTemplateSourceSchema.safeParse(definitionOf(edit.spec).payload);
  const [selected, setSelected] = useState("");
  const [path, setPath] = useState("");
  const [problem, setProblem] = useState("");
  const [tab, setTab] = useState("code");
  const [insert, setInsert] = useState<{ text: string; key: number }>();
  const sequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const latest = useRef({ state, payload: parsed.data });
  latest.current = { state, payload: parsed.data };
  if (!parsed.success)
    return (
      <div role="alert" className="text-xs text-critical-text">
        This definition cannot be edited as an HTML bundle. Download the original template file to
        recover its source.
      </div>
    );
  const payload = parsed.data;
  const name = payload.files[selected] === undefined ? payload.entry : selected;
  const file = payload.files[name];
  const write = (next: HtmlTemplatePayload) =>
    state.change({ ...edit, spec: { type: "html", version: 1, payload: next } });
  const validPath = () => {
    if (
      !isTemplatePath(path) ||
      Object.keys(payload.files).some((member) => member.toLowerCase() === path.toLowerCase())
    ) {
      setProblem("Use a unique bundle path, such as partials/entry.html or theme.css.");
      return false;
    }
    return true;
  };
  const add = () => {
    if (!validPath()) return;
    const mediaType = path.endsWith(".css")
      ? "text/css"
      : path.endsWith(".html")
        ? "text/html"
        : undefined;
    if (mediaType === undefined) {
      setProblem("New source files use .html or .css. Use Add asset for images and fonts.");
      return;
    }
    write({
      ...payload,
      files: { ...payload.files, [path]: { mediaType, encoding: "utf8", content: "" } },
    });
    setSelected(path);
    setPath("");
    setProblem("");
  };
  const rename = () => {
    if (file === undefined || !validPath()) return;
    const files = { ...payload.files };
    delete files[name];
    files[path] = file;
    write({
      ...payload,
      files,
      entry: payload.entry === name ? path : payload.entry,
      styles: payload.styles.map((value) => (value === name ? path : value)),
    });
    setSelected(path);
    setPath("");
    setProblem("Update any partial, image, font or CSS references to the renamed path.");
  };
  const upload = async (asset: File) => {
    if (asset.size > 1024 * 1024) {
      setProblem("Assets are limited to 1 MiB in total.");
      return;
    }
    const member = `assets/${asset.name}`;
    const mediaType = MEDIA[asset.name.split(".").at(-1)?.toLowerCase() ?? ""];
    if (!isTemplatePath(member) || mediaType === undefined || mediaType.startsWith("text/")) {
      setProblem("Choose a PNG, JPEG, WebP or WOFF2 asset with a simple filename.");
      return;
    }
    const bytes = new Uint8Array(await asset.arrayBuffer());
    const current = latest.current;
    if (!mounted.current || current.payload === undefined || current.state.saving) return;
    if (
      Object.keys(current.payload.files).some(
        (value) => value.toLowerCase() === member.toLowerCase(),
      )
    ) {
      setProblem("An asset with that name already exists. Rename it before adding.");
      return;
    }
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    current.state.change({
      ...current.state.edit,
      spec: {
        type: "html",
        version: 1,
        payload: {
          ...current.payload,
          files: {
            ...current.payload.files,
            [member]: { mediaType, encoding: "base64", content: btoa(binary) },
          },
        },
      },
    });
    setSelected(member);
    setProblem("");
  };
  return (
    <div className="space-y-3">
      <fieldset aria-label="HTML workspace" className="flex flex-wrap gap-2">
        <Button
          size="sm"
          tone={tab === "code" ? "primary" : "secondary"}
          onClick={() => setTab("code")}
        >
          Files and code
        </Button>
        <Button
          size="sm"
          tone={tab === "data" ? "primary" : "secondary"}
          onClick={() => setTab("data")}
        >
          Resume data
        </Button>
      </fieldset>
      {tab === "data" ? (
        <div>
          <TemplateData
            document={document}
            onInsert={(text) => {
              if (file?.mediaType !== "text/html") {
                setProblem("Select an HTML source file before inserting a binding.");
                setTab("code");
                return;
              }
              setInsert({ text, key: ++sequence.current });
              setTab("code");
            }}
          />
        </div>
      ) : null}
      <div hidden={tab !== "code"} className="space-y-3">
        <SelectField
          label="Bundle file"
          value={name}
          options={Object.keys(payload.files).map((value) => ({ value, label: value }))}
          onChange={(value) => {
            setSelected(value);
            setInsert(undefined);
          }}
        />
        <details className="space-y-3 rounded border border-line p-2 text-xs text-text-muted">
          <summary className="cursor-pointer">Manage files</summary>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={file === undefined || name === payload.entry}
              onClick={() => {
                const files = { ...payload.files };
                delete files[name];
                write({
                  ...payload,
                  files,
                  styles: payload.styles.filter((value) => value !== name),
                });
                setSelected(payload.entry);
              }}
            >
              Remove file
            </Button>
            <label className="cursor-pointer rounded border border-line px-2 py-1 text-xs text-text-muted">
              Add asset
              <input
                className="sr-only"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.woff2"
                onChange={(event) => {
                  const asset = event.target.files?.[0];
                  if (asset !== undefined)
                    void upload(asset).catch(() => setProblem("Could not read that asset."));
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <TextField
            label="New file path"
            value={path}
            onChange={setPath}
            placeholder="partials/entry.html"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={add}>
              Add source file
            </Button>
            <Button size="sm" disabled={file === undefined} onClick={rename}>
              Rename selected file
            </Button>
          </div>
        </details>
        {file?.encoding === "utf8" ? (
          <Suspense fallback={<p className="text-xs">Loading code editor...</p>}>
            <SourceEditor
              key={name}
              value={file.content}
              language={file.mediaType}
              insert={insert}
              onChange={(content) =>
                write({ ...payload, files: { ...payload.files, [name]: { ...file, content } } })
              }
            />
          </Suspense>
        ) : (
          <p className="text-xs text-text-muted">
            Bundled asset. Refer to it using its bundle path in HTML or CSS.
          </p>
        )}
        {template === undefined ? null : (
          <details className="space-y-3 rounded border border-line p-2 text-xs text-text-muted">
            <summary className="cursor-pointer">Page defaults</summary>
            {template.fields.map((field) => (
              <Control
                key={field.key}
                field={field}
                config={template.defaultConfig}
                precise
                onChange={(value) => {
                  if (field.key === "pageSize" && (value === "a4" || value === "letter"))
                    write({ ...payload, page: { ...payload.page, size: value } });
                  if (field.key === "margin" && typeof value === "number")
                    write({ ...payload, page: { ...payload.page, marginMm: value } });
                }}
              />
            ))}
            <p>Defaults for new resumes. Existing resume fit overrides still apply.</p>
          </details>
        )}
        <details className="space-y-3 rounded border border-line p-2 text-xs text-text-muted">
          <summary className="cursor-pointer">Entry and stylesheets</summary>
          <SelectField
            label="HTML entry file"
            value={payload.entry}
            options={Object.entries(payload.files)
              .filter(([, value]) => value.mediaType === "text/html")
              .map(([value]) => ({ value, label: value }))}
            onChange={(entry) => write({ ...payload, entry })}
          />
          <fieldset className="space-y-1 text-xs text-text-muted">
            <legend className="mb-1">Loaded stylesheets (enable in load order)</legend>
            {Object.entries(payload.files)
              .filter(([, value]) => value.mediaType === "text/css")
              .map(([member]) => (
                <label key={member} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={payload.styles.includes(member)}
                    onChange={(event) =>
                      write({
                        ...payload,
                        styles: event.target.checked
                          ? [...payload.styles, member]
                          : payload.styles.filter((value) => value !== member),
                      })
                    }
                  />
                  {payload.styles.includes(member)
                    ? `${String(payload.styles.indexOf(member) + 1)}. `
                    : ""}
                  {member}
                </label>
              ))}
          </fieldset>
        </details>
        <p className="text-xs text-text-subtle">
          HTML fragments, not full documents. The app supplies the page shell. Local partials use
          render; assets use their bundle paths. Removing a file can be undone.
        </p>
      </div>
      {problem === "" ? null : (
        <p role="status" className="text-xs text-caution-text">
          {problem}
        </p>
      )}
      {state.cssProblem === undefined ? null : (
        <p role="alert" className="whitespace-pre-wrap text-xs text-critical-text">
          {state.cssProblem}
        </p>
      )}
    </div>
  );
}
