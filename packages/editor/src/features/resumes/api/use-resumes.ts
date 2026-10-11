import type { Resume, ResumeInput, ResumePatch, Store, Uuid } from "@keepcv/schema";
import { resumeSchema } from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, replaceRow, useStoreMutation } from "../../../lib/store-cache.js";

function writeInto(store: Store, resume: Resume): Store {
  return { ...store, resumes: replaceRow(store.resumes, resume) };
}

export function useCreateResume(client: ApiClient) {
  return useStoreMutation<ResumeInput, Resume>({
    send: async (input) =>
      resumeSchema.parse(await unwrap(await client.v1.resumes.$post({ json: input }))),
    optimistic: (store, input) => {
      const at = now();
      return writeInto(
        store,
        resumeSchema.parse({ ...input, createdAt: at, updatedAt: at, archivedAt: null }),
      );
    },
  });
}

export interface PatchResume {
  resume: Resume;
  patch: ResumePatch;
}

export function usePatchResume(client: ApiClient) {
  return useStoreMutation<PatchResume, Resume>({
    send: async ({ resume, patch }) =>
      resumeSchema.parse(
        await unwrap(
          await client.v1.resumes[":id"].$patch({
            param: { id: resume.id },
            json: { expectedUpdatedAt: resume.updatedAt, patch },
          }),
        ),
      ),
    optimistic: (store, { resume, patch }) =>
      writeInto(store, resumeSchema.parse({ ...resume, ...patch, updatedAt: now() })),
    settle: writeInto,
  });
}

export interface SetResumeArchived {
  resume: Resume;
  archived: boolean;
}

export function useSetResumeArchived(client: ApiClient) {
  return useStoreMutation<SetResumeArchived, Resume>({
    send: async ({ resume, archived }) => {
      const param = { id: resume.id };
      const json = { expectedUpdatedAt: resume.updatedAt };
      const response = archived
        ? await client.v1.resumes[":id"].$delete({ param, json })
        : await client.v1.resumes[":id"].restore.$post({ param, json });
      return resumeSchema.parse(await unwrap(response));
    },
    optimistic: (store, { resume, archived }) => {
      const at = now();
      return writeInto(store, { ...resume, archivedAt: archived ? at : null, updatedAt: at });
    },
    settle: writeInto,
  });
}

export interface DeriveResume {
  from: Resume;
  id: Uuid;
  name: string;
}

// Nothing optimistic: the store mints every row of the copy, so there is no
// composition to show until the re-read brings it back.
export function useDeriveResume(client: ApiClient) {
  return useStoreMutation<DeriveResume, Resume>({
    send: async ({ from, id, name }) =>
      resumeSchema.parse(
        await unwrap(
          await client.v1.resumes[":id"].derive.$post({
            param: { id: from.id },
            json: { id, name },
          }),
        ),
      ),
    optimistic: (store) => store,
  });
}
