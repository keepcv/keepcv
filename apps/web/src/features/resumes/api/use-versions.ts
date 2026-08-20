import { newUuid } from "@keepcv/core";
import type { ManifestDiff, RestoredResume, ResumeVersion, Uuid } from "@keepcv/schema";
import { manifestDiffSchema, restoredResumeSchema, resumeVersionSchema } from "@keepcv/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { STORE_KEY } from "../../../lib/store-cache.js";

const versionList = z.object({ items: z.array(resumeVersionSchema) });

function versionsKey(resumeId: Uuid) {
  return ["resume", resumeId, "versions"] as const;
}

// Not in the boot payload: a manifest is history, and history grows without
// bound (api-contract.md #3).
export function useVersions(client: ApiClient, resumeId: Uuid) {
  return useQuery({
    queryKey: versionsKey(resumeId),
    queryFn: async (): Promise<ResumeVersion[]> =>
      versionList.parse(
        await unwrap(await client.v1["resume-versions"].$get({ query: { resumeId } })),
      ).items,
  });
}

// Keyed by the pair, because two immutable versions can never differ twice.
export function useVersionDiff(client: ApiClient, resumeId: Uuid, a: Uuid, b: Uuid) {
  return useQuery({
    queryKey: ["resume", resumeId, "diff", a, b],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<ManifestDiff> =>
      manifestDiffSchema.parse(
        await unwrap(await client.v1["resume-versions"].diff.$get({ query: { a, b } })),
      ),
  });
}

export function useCaptureVersion(client: ApiClient, resumeId: Uuid) {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ResumeVersion> =>
      resumeVersionSchema.parse(
        await unwrap(
          await client.v1["resume-versions"].$post({
            json: { id: newUuid(), resumeId, trigger: "manual_save", restoredFromVersionId: null },
          }),
        ),
      ),
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: versionsKey(resumeId) });
    },
  });
}

// The whole composition is what a restore writes, so the boot payload is
// re-read rather than patched: there is no optimistic edit this wide.
export function useRestoreVersion(client: ApiClient, resumeId: Uuid) {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: Uuid): Promise<RestoredResume> =>
      restoredResumeSchema.parse(
        await unwrap(
          await client.v1["resume-versions"][":id"].restore.$post({
            param: { id: versionId },
            json: { id: newUuid() },
          }),
        ),
      ),
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: versionsKey(resumeId) });
      await queries.invalidateQueries({ queryKey: STORE_KEY });
    },
  });
}
