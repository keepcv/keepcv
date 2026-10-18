import { deriveRevision, generateNKeysBetween, newUuid } from "@keepcv/core";
import { type Archive, sortKeySchema } from "@keepcv/schema";

export function withPoints(empty: Archive, count: number, revisions = 3): Archive {
  const archive = structuredClone(empty);
  for (const sortKey of generateNKeysBetween(null, null, count)) {
    const standard = {
      createdAt: empty.profile.createdAt,
      updatedAt: empty.profile.updatedAt,
      archivedAt: null,
    };
    const setId = newUuid();
    const phrasingId = newUuid();
    let currentRevisionId = newUuid();
    for (let index = 0; index < revisions; index++) {
      currentRevisionId = newUuid();
      archive.phrasingRevisions.push({
        id: currentRevisionId,
        phrasingId,
        createdAt: standard.createdAt,
        ...deriveRevision([{ t: "text", v: `Synthetic Point ${sortKey} Revision ${index}` }]),
      });
    }
    archive.phrasingSets.push({
      ...standard,
      id: setId,
      purpose: "point",
      canonicalPhrasingId: phrasingId,
    });
    archive.phrasings.push({
      ...standard,
      id: phrasingId,
      phrasingSetId: setId,
      variant: "standard",
      label: null,
      sortKey: sortKeySchema.parse("a0"),
      currentRevisionId,
    });
    archive.points.push({
      ...standard,
      id: newUuid(),
      recordId: null,
      phrasingSetId: setId,
      confidence: "unverified",
      occurredOn: null,
      sortKey,
    });
  }
  return archive;
}
