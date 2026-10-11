import type { Phrasing, RichText, Uuid } from "@keepcv/schema";
import { phrasingRevisionSchema } from "@keepcv/schema";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Failure, Skeleton } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { formatTimestamp } from "../../../lib/timestamp.js";
import { RichBody } from "./rich-body.js";

const revisions = z.object({ items: z.array(phrasingRevisionSchema) });

// Keyed by the revision the phrasing points at, so a commit lands on a key that
// has never been fetched rather than needing an invalidation of its own.
export function PhrasingHistory({
  client,
  phrasing,
  onRestore,
}: {
  client: ApiClient;
  phrasing: Phrasing;
  onRestore: (body: RichText) => void;
}) {
  const [selectedId, setSelectedId] = useState<Uuid | null>(null);
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
  const current = history.data.items.find((row) => row.id === phrasing.currentRevisionId);
  const selected = history.data.items.find((row) => row.id === selectedId);

  return (
    <div className="space-y-3">
      {selected === undefined || current === undefined ? null : (
        <section
          className="grid gap-3 rounded border border-line p-3 sm:grid-cols-2"
          aria-label="Wording comparison"
        >
          <div>
            <p className="text-xs text-text-subtle">Current wording</p>
            <p className="text-sm">
              <RichBody body={current.body} />
            </p>
          </div>
          <div>
            <p className="text-xs text-text-subtle">Selected revision</p>
            <p className="text-sm">
              <RichBody body={selected.body} />
            </p>
          </div>
          <p className="text-xs text-text-subtle sm:col-span-2">
            {selected.plainText === current.plainText
              ? "The words match; compare the formatting and links."
              : "Use the selected wording to edit it again. Previous revisions stay intact."}
          </p>
          <Button
            disabled={phrasing.archivedAt !== null || selected.id === current.id}
            onClick={() => {
              onRestore(selected.body);
            }}
          >
            Use this wording
          </Button>
          <Button
            onClick={() => {
              setSelectedId(null);
            }}
          >
            Close comparison
          </Button>
        </section>
      )}
      <ol
        aria-label="Everything this wording has said"
        className="space-y-2 border-l border-line pl-3"
      >
        {[...history.data.items].reverse().map((revision) => (
          <li key={revision.id} className="text-xs">
            <p className="text-text-subtle">
              {formatTimestamp(revision.createdAt)}
              {revision.id === phrasing.currentRevisionId ? " - what it says now" : null}
            </p>
            <p className="text-text-muted">
              <RichBody body={revision.body} />
            </p>
            {revision.id === phrasing.currentRevisionId ? null : (
              <Button
                onClick={() => {
                  setSelectedId(revision.id);
                }}
              >
                Compare with current
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
