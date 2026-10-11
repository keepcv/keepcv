import type { ExportDocument } from "@keepcv/schema";
import { exportDocumentSchema } from "@keepcv/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { STORE_KEY } from "../../../lib/store-cache.js";

// Not through `useStoreMutation`: an export writes nothing, and an import
// replaces every collection at once, so there is no row to patch either way.
export function useReadBackup(client: ApiClient) {
  return useMutation({
    mutationFn: async (): Promise<ExportDocument> =>
      exportDocumentSchema.parse(
        await unwrap(await client.v1.export.$get({ query: { format: "native" } })),
      ),
  });
}

export function useLoadBackup(client: ApiClient) {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async (body: unknown): Promise<void> => {
      await unwrap(
        await client.v1.import.$post({
          query: { format: "native" },
          // The document is whatever the file said, including a schema version
          // older than this build: migrating it is the store's job.
          json: body as { schemaVersion: number },
        }),
      );
    },
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: STORE_KEY });
    },
  });
}
