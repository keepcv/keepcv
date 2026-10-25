import { FIXTURE_DOCUMENT, HTML_TEMPLATES } from "@keepcv/templates";
import { afterEach, expect, it, vi } from "vitest";
import { renderTemplate } from "./render-template.js";

class RenderWorker {
  static workers: RenderWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    RenderWorker.workers.push(this);
  }
}
const document = {
  ...FIXTURE_DOCUMENT,
  meta: { ...FIXTURE_DOCUMENT.meta, templateSpec: HTML_TEMPLATES[0]?.definition },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  RenderWorker.workers = [];
});

it("terminates a renderer that exceeds its parent deadline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", RenderWorker);
  const pending = renderTemplate(document);
  const rejected = expect(pending).rejects.toThrow("too long");
  await vi.advanceTimersByTimeAsync(2501);
  await rejected;
  expect(RenderWorker.workers[0]?.terminate).toHaveBeenCalledOnce();
});

it("cancels obsolete jobs and terminates successful workers", async () => {
  vi.stubGlobal("Worker", RenderWorker);
  const controller = new AbortController();
  const obsolete = renderTemplate(document, controller.signal);
  const rejected = expect(obsolete).rejects.toThrow("cancelled");
  controller.abort();
  await rejected;
  const pending = renderTemplate(document);
  const worker = RenderWorker.workers[1];
  worker?.onmessage?.(new MessageEvent("message", { data: { html: "CHECKED_OUTPUT" } }));
  await expect(pending).resolves.toBe("CHECKED_OUTPUT");
  expect(worker?.terminate).toHaveBeenCalledOnce();
  expect(worker?.postMessage).toHaveBeenCalledWith(document);
});
