import type { ResumeDocument, Store, Uuid } from "@keepcv/schema";
import { captureManifest } from "./capture.js";
import { type CompileOptions, renderManifest } from "./render.js";

// Capture then render, so the preview and a pinned version resolve through one
// path and cannot disagree (template-model.md #7).
export function compile(
  store: Store,
  resumeId: Uuid,
  options: CompileOptions,
): ResumeDocument | undefined {
  const manifest = captureManifest(store, resumeId);
  if (manifest === undefined) return undefined;
  return renderManifest(manifest, store.phrasingRevisions, options);
}
