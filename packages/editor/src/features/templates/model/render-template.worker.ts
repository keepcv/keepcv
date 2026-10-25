import { renderHtml } from "@keepcv/render";
import { resumeDocumentSchema } from "@keepcv/schema";

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  try {
    self.postMessage({ html: renderHtml(resumeDocumentSchema.parse(event.data)) });
  } catch (error) {
    self.postMessage({
      problem: error instanceof Error ? error.message : "Could not render this template.",
    });
  }
});
