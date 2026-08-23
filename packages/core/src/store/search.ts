import type { Store, Uuid } from "@keepcv/schema";
import { fold } from "../text/fold.js";
import { live, organisationOf, tagsOfPoint, tagsOfRecord, textOfPhrasingSet } from "./selectors.js";

export type SearchSubject = "record" | "point";

export interface SearchHit {
  subject: SearchSubject;
  id: Uuid;
  score: number;
}

// What a thing is called beats what it is filed under, which beats the rest.
const NAME = 3;
const CONTEXT = 2;
const DETAIL = 1;

const RANK: Record<SearchSubject, number> = { record: 0, point: 1 };

const SEPARATORS = /[^\p{L}\p{N}]+/u;

function words(value: string | null): string[] {
  if (value === null) return [];
  return fold(value)
    .split(SEPARATORS)
    .filter((word) => word !== "");
}

interface Field {
  words: string[];
  weight: number;
}

function field(value: string | null, weight: number): Field {
  return { words: words(value), weight };
}

function bestWeight(term: string, fields: readonly Field[]): number {
  let best = 0;
  for (const entry of fields) {
    // Prefixes, not whole words: "postg" has to find "PostgreSQL" mid-
    // keystroke.
    if (entry.weight > best && entry.words.some((word) => word.startsWith(term))) {
      best = entry.weight;
    }
  }
  return best;
}

// Every term has to land somewhere, so a two-word query narrows rather than
// widens.
function score(terms: readonly string[], fields: readonly Field[]): number {
  let total = 0;
  for (const term of terms) {
    const best = bestWeight(term, fields);
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function search(
  store: Store,
  query: string,
  options?: { tagId?: Uuid | undefined; includeArchived?: boolean | undefined },
): SearchHit[] {
  const terms = words(query);
  if (terms.length === 0) return [];

  const includeArchived = options?.includeArchived === true;
  const records = includeArchived ? store.records : live(store.records);
  const points = includeArchived ? store.points : live(store.points);
  const tagged = (assigned: Uuid[]): boolean =>
    options?.tagId === undefined || assigned.includes(options.tagId);

  const hits: SearchHit[] = [];

  for (const entry of records) {
    const tags = tagsOfRecord(store, entry.id);
    if (!tagged(tags.map((tag) => tag.id))) continue;
    const found = score(terms, [
      field(entry.title, NAME),
      field(entry.subtitle, CONTEXT),
      field(organisationOf(store, entry)?.name ?? null, CONTEXT),
      ...tags.map((tag) => field(tag.label, CONTEXT)),
      field(entry.location, DETAIL),
      field(textOfPhrasingSet(store, entry.summarySetId), DETAIL),
    ]);
    if (found > 0) hits.push({ subject: "record", id: entry.id, score: found });
  }

  for (const point of points) {
    const tags = tagsOfPoint(store, point.id);
    if (!tagged(tags.map((tag) => tag.id))) continue;
    const parent = records.find((entry) => entry.id === point.recordId);
    const found = score(terms, [
      field(textOfPhrasingSet(store, point.phrasingSetId), NAME),
      ...tags.map((tag) => field(tag.label, CONTEXT)),
      field(parent?.title ?? null, DETAIL),
    ]);
    if (found > 0) hits.push({ subject: "point", id: point.id, score: found });
  }

  // A total order, so rows do not reshuffle under the cursor between
  // keystrokes.
  return hits.sort(
    (a, b) => b.score - a.score || RANK[a.subject] - RANK[b.subject] || a.id.localeCompare(b.id),
  );
}
