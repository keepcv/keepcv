import { renderHtml } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { definitionOf, templateById } from "@keepcv/templates";

export function isHtmlTemplate(document: ResumeDocument): boolean {
  return document.meta.templateSpec === undefined
    ? templateById(document.meta.templateId)?.type === "html"
    : definitionOf(document.meta.templateSpec).type === "html";
}

export function renderTemplate(document: ResumeDocument, signal?: AbortSignal): Promise<string> {
  if (!isHtmlTemplate(document)) return Promise.resolve(renderHtml(document));
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new Error("Rendering cancelled."));
      return;
    }
    const worker = new Worker(new URL("./render-template.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = (problem: string | undefined, html?: string) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (problem === undefined && html !== undefined) resolve(html);
      else reject(new Error(problem ?? "No template output was produced."));
    };
    const cancel = () => finish("Rendering cancelled.");
    const timer = setTimeout(
      () =>
        finish(
          "Rendering took too long. Simplify loops or split the source into smaller partials.",
        ),
      2500,
    );
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ html?: string; problem?: string }>) =>
      finish(event.data.problem, event.data.html);
    worker.onerror = () => finish("The template renderer could not start or stopped unexpectedly.");
    worker.postMessage(document);
  });
}
