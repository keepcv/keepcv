import type { ResumeDocument } from "@keepcv/schema";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/ui/field.js";
import { renderTemplate } from "../../templates/model/render-template.js";

export function HtmlPreview({ document }: { document: ResumeDocument }) {
  const [answer, setAnswer] = useState<{
    document: ResumeDocument;
    attempt: number;
    html?: string;
    problem?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState("fit");
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState({ width: 794, height: 1123 });
  const [body, setBody] = useState<HTMLElement | null>(null);
  const room = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void renderTemplate(document, controller.signal).then(
        (html) => {
          if (!controller.signal.aborted) setAnswer({ document, attempt, html });
        },
        (error) => {
          if (!controller.signal.aborted)
            setAnswer({
              document,
              attempt,
              problem: error instanceof Error ? error.message : "Rendering failed.",
            });
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [document, attempt]);
  useEffect(() => {
    if (room.current === null) return;
    const measure = () => setWidth(room.current?.clientWidth ?? 0);
    const observer = new ResizeObserver(measure);
    observer.observe(room.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const current = answer?.document === document && answer.attempt === attempt ? answer : undefined;
  useEffect(() => {
    const inside = body?.ownerDocument;
    if (inside === undefined || current?.html === undefined) return;
    const measure = () => {
      const paper = inside.querySelector<HTMLElement>(".kc-page");
      if (paper !== null) setSize({ width: paper.scrollWidth, height: paper.scrollHeight });
    };
    const stopLink = (event: MouseEvent) => {
      const ElementType = inside.defaultView?.Element;
      if (
        ElementType !== undefined &&
        event.target instanceof ElementType &&
        event.target.closest("a") !== null
      )
        event.preventDefault();
    };
    inside.addEventListener("click", stopLink);
    const observer = new ResizeObserver(measure);
    observer.observe(inside.body);
    measure();
    return () => {
      observer.disconnect();
      inside.removeEventListener("click", stopLink);
    };
  }, [current, body]);
  const scale = zoom === "fit" ? Math.min(1, width > 0 ? width / size.width : 1) : Number(zoom);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <SelectField
            label="Zoom"
            value={zoom}
            onChange={setZoom}
            options={[
              { value: "fit", label: "Fit to width" },
              { value: "0.75", label: "75%" },
              { value: "1", label: "100%" },
            ]}
          />
        </div>
        <p className="flex-1 text-xs text-text-subtle">
          HTML layout. Page estimates are unavailable; check browser print preview.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface-sunken p-3">
        {current?.problem === undefined ? null : (
          <p
            role="alert"
            className="whitespace-pre-wrap rounded border border-line bg-surface p-4 text-sm text-critical-text"
          >
            {current.problem}
            <span className="mt-2 block text-xs text-text-muted">
              The current source has no preview. Your source is kept for correction.
            </span>
          </p>
        )}
        {current === undefined ? (
          <p role="status" className="text-xs text-text-muted">
            Rendering current source...
          </p>
        ) : null}
        {current?.problem === undefined ? null : (
          <Button
            size="sm"
            onClick={() => {
              setAnswer(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            Retry preview
          </Button>
        )}
        <div ref={room} className="min-w-0">
          {current?.html === undefined ? null : (
            <div
              style={{ width: size.width * scale, height: size.height * scale }}
              className="mx-auto overflow-hidden shadow-sm"
            >
              <iframe
                ref={frame}
                title={`${document.meta.resumeName}, HTML preview`}
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
                srcDoc={current.html}
                onLoad={() => {
                  const inside = frame.current?.contentDocument;
                  const paper = inside?.querySelector(".kc-page");
                  if (paper !== undefined && paper !== null) {
                    setSize({ width: paper.scrollWidth, height: paper.scrollHeight });
                  }
                  setBody(inside?.body ?? null);
                }}
                className="block border-0 bg-document-paper"
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `scale(${String(scale)})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
