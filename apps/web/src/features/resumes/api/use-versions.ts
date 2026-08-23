import { newUuid } from "@keepcv/core";
import type {
  ManifestDiff,
  RestoredResume,
  ResumeDocument,
  ResumeSnapshot,
  ResumeVersion,
  Uuid,
} from "@keepcv/schema";
import {
  manifestDiffSchema,
  restoredResumeSchema,
  resumeDocumentSchema,
  resumeSnapshotSchema,
  resumeVersionSchema,
} from "@keepcv/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { STORE_KEY } from "../../../lib/store-cache.js";

const versionList = z.object({ items: z.array(resumeVersionSchema) });

function versionsKey(resumeId: Uuid) {
  return ["resume", resumeId, "versions"] as const;
}

// Not in the boot payload: a manifest is history, and history grows without
// bound.
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

const snapshotList = z.object({ items: z.array(resumeSnapshotSchema) });

function snapshotsKey(resumeId: Uuid) {
  return ["resume", resumeId, "snapshots"] as const;
}

export function useSnapshots(client: ApiClient, resumeId: Uuid) {
  return useQuery({
    queryKey: snapshotsKey(resumeId),
    queryFn: async (): Promise<ResumeSnapshot[]> =>
      snapshotList.parse(
        await unwrap(await client.v1["resume-snapshots"].$get({ query: { resumeId } })),
      ).items,
  });
}

export interface Star {
  // The snapshot already on the version, if starring is being undone.
  snapshot: ResumeSnapshot | undefined;
  resumeVersionId: Uuid;
  label: string;
}

// Starring and unstarring through one hook: a snapshot is an owned row, so
// unstarring archives it rather than reaching for a second route.
export function useStarVersion(client: ApiClient, resumeId: Uuid) {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async ({ snapshot, resumeVersionId, label }: Star): Promise<ResumeSnapshot> => {
      const of = client.v1["resume-snapshots"];
      if (snapshot === undefined) {
        return resumeSnapshotSchema.parse(
          await unwrap(
            await of.$post({ json: { id: newUuid(), resumeVersionId, label, note: null } }),
          ),
        );
      }
      return resumeSnapshotSchema.parse(
        await unwrap(
          await of[":id"].$delete({
            param: { id: snapshot.id },
            json: { expectedUpdatedAt: snapshot.updatedAt },
          }),
        ),
      );
    },
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: snapshotsKey(resumeId) });
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

// Fetched on demand rather than with the timeline: a manifest resolves to a
// whole document, and a list of forty would fetch forty of them to show a
// button. Immutable, so once fetched it never goes stale.
export function useVersionDocument(client: ApiClient, versionId: Uuid, enabled: boolean) {
  return useQuery({
    queryKey: ["resume-version", versionId, "document"],
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<ResumeDocument> =>
      resumeDocumentSchema.parse(
        await unwrap(
          await client.v1["resume-versions"][":id"].document.$get({
            param: { id: versionId },
            query: {},
          }),
        ),
      ),
  });
}
