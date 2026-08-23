import type { ResumeDocument, Store, Uuid } from "@keepcv/schema";
import { captureManifest } from "./capture.js";
import { type CompileOptions, renderManifest } from "./render.js";

export function compile(
  store: Store,
  resumeId: Uuid,
  options: CompileOptions,
): ResumeDocument | undefined {
  const manifest = captureManifest(store, resumeId);
  if (manifest === undefined) return undefined;
  return renderManifest(manifest, store.phrasingRevisions, options);
}
