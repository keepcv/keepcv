import type { Intake, IntakeDecisions } from "@keepcv/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { STORE_KEY } from "../../../lib/store-cache.js";

export interface IntakeApplied {
  organisations: number;
  customSections: number;
  contactChannels: number;
  records: number;
  points: number;
  tags: number;
}

// Not through `useStoreMutation`: one apply writes across nine collections, so
// there is no row to patch ahead of the answer and nothing to put back.
export function useApplyIntake(client: ApiClient) {
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      intake: Intake;
      decisions: IntakeDecisions;
    }): Promise<IntakeApplied> =>
      (await unwrap(await client.v1.intake.$post({ json: body }))) as IntakeApplied,
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: STORE_KEY });
    },
  });
}
