import { fromLines } from "@keepcv/interop";
import { docxLines } from "@keepcv/interop/files";

globalThis.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    globalThis.postMessage({ intake: fromLines(docxLines(new Uint8Array(event.data)), "docx") });
  } catch (error) {
    globalThis.postMessage({
      error: error instanceof Error ? error.message : "That Word document could not be read.",
    });
  }
};
