import type { Phrasing } from "@keepcv/schema";
import { phrasingRevisionSchema } from "@keepcv/schema";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Failure, Skeleton } from "../../../app/states.js";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { formatTimestamp } from "../../../lib/timestamp.js";

const revisions = z.object({ items: z.array(phrasingRevisionSchema) });

// Keyed by the revision the phrasing points at, so a commit lands on a key that
// has never been fetched rather than needing an invalidation of its own.
export function PhrasingHistory({ client, phrasing }: { client: ApiClient; phrasing: Phrasing }) {
  const history = useQuery({
    queryKey: ["phrasing", phrasing.id, "revisions", phrasing.currentRevisionId],
    queryFn: async () =>
      revisions.parse(
        await unwrap(
          await client.v1.phrasings[":id"].revisions.$get({ param: { id: phrasing.id } }),
        ),
      ),
  });

  if (history.error !== null) return <Failure error={history.error} />;
  if (history.data === undefined) return <Skeleton rows={2} />;

  return (
    <ol
      aria-label="Everything this wording has said"
      className="space-y-2 border-l border-slate-200 pl-3"
    >
      {[...history.data.items].reverse().map((revision, index) => (
        <li key={revision.id} className="text-xs">
          <p className="text-slate-400">
            {formatTimestamp(revision.createdAt)}
            {index === 0 ? " - what it says now" : null}
          </p>
          <p className="text-slate-700">{revision.plainText}</p>
        </li>
      ))}
    </ol>
  );
}
