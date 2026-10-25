import { compile } from "@keepcv/core";
import type { Resume, ResumeDocument, ResumePatch, Store } from "@keepcv/schema";
import { resumePatchSchema, resumeSchema } from "@keepcv/schema";
import { resolveTemplate } from "@keepcv/templates";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiClient } from "../../../lib/api.js";
import { STORE_KEY } from "../../../lib/store-cache.js";
import { useAutosave } from "../../../lib/use-autosave.js";
import { templateRowFor } from "../../templates/model/template-rows.js";
import { usePatchResume } from "./use-resumes.js";

const valid = () => true;
const read = (value: unknown) => resumePatchSchema.safeParse(value).data ?? null;

export function useResumeSettings(
  client: ApiClient,
  store: Store,
  resume: Resume,
  document: ResumeDocument,
) {
  const patch = usePatchResume(client);
  const queries = useQueryClient();
  const autosave = useAutosave(
    `keepcv.resume-settings:${resume.id}`,
    read,
    async (changes: ResumePatch) => {
      const current =
        queries.getQueryData<Store>(STORE_KEY)?.resumes.find((row) => row.id === resume.id) ??
        resume;
      await patch.mutateAsync({ resume: current, patch: changes });
    },
    valid,
  );
  const shownResume = resumeSchema.parse({ ...resume, ...autosave.pending });
  const shown =
    compile(
      { ...store, resumes: store.resumes.map((row) => (row.id === resume.id ? shownResume : row)) },
      resume.id,
      { generatedAt: document.meta.generatedAt, locale: document.meta.locale },
    ) ?? document;
  let resolved: ReturnType<typeof resolveTemplate>;
  try {
    resolved = resolveTemplate(shown);
  } catch (error) {
    const unavailable = templateRowFor(store, shown.meta.templateId ?? "")?.template;
    if (unavailable === undefined) throw error;
    resolved = { template: unavailable, config: {} };
  }
  const change = (changes: ResumePatch) => autosave.change({ ...autosave.pending, ...changes });
  const fit = (key: string, value: string | number) => {
    const config = { ...shownResume.templateConfig, [key]: value };
    if (resolved.template.defaultConfig[key] === value) delete config[key];
    change({ templateConfig: config });
  };
  const reset = (key?: string) => {
    const config = { ...shownResume.templateConfig };
    if (key === undefined) change({ templateConfig: {} });
    else {
      delete config[key];
      change({ templateConfig: config });
    }
  };
  return { ...autosave, resume: shownResume, document: shown, ...resolved, change, fit, reset };
}

export type ResumeSettings = ReturnType<typeof useResumeSettings>;
