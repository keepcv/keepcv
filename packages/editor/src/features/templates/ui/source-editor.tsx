import { autocompletion, snippetCompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { liquid } from "@codemirror/lang-liquid";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { useEffect, useRef } from "react";

export default function SourceEditor({
  value,
  language,
  onChange,
  insert,
}: {
  value: string;
  language: string;
  onChange: (value: string) => void;
  insert: { text: string; key: number } | undefined;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const initial = useRef(value);
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    if (mount.current === null) return;
    const editor = new EditorView({
      parent: mount.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          language === "text/css" ? css() : liquid({ base: html() }),
          autocompletion({
            override: [
              (context) => {
                const word = context.matchBefore(/[\w.]*/);
                return word === null
                  ? null
                  : {
                      from: word.from,
                      options: [
                        snippetCompletion('{{ resume.header.fullName | default: "" }}', {
                          label: "resume.header.fullName",
                          detail: "Selected name",
                        }),
                        snippetCompletion(
                          '{% for section in resume.sections %}\n  <section><h2>{{ section.heading }}</h2>\n  {% for entry in section.entries %}\n    <h3>{{ entry.title | default: "" }}</h3>\n  {% endfor %}</section>\n{% endfor %}',
                          { label: "resume.sections", detail: "Ordered sections and entries" },
                        ),
                      ],
                    };
              },
            ],
          }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": "Template source", spellcheck: "false" }),
          EditorView.theme({
            "&": {
              fontSize: "12px",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
            },
            ".cm-scroller": {
              minHeight: "18rem",
              maxHeight: "34rem",
              overflow: "auto",
              fontFamily: "monospace",
            },
            ".cm-gutters": {
              backgroundColor: "var(--color-surface-sunken)",
              color: "var(--color-text-subtle)",
            },
            "&.cm-focused": { outline: "2px solid var(--color-brand)" },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changed.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [language]);
  useEffect(() => {
    const editor = view.current;
    if (editor !== null && editor.state.doc.toString() !== value)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);
  useEffect(() => {
    if (insert === undefined || view.current === null) return;
    const editor = view.current;
    editor.dispatch(editor.state.replaceSelection(insert.text));
    editor.focus();
  }, [insert]);
  return <div ref={mount} className="overflow-hidden rounded-lg border border-line" />;
}
