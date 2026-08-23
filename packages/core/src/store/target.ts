import type { CareerRecord, Resume, Store, Uuid } from "@keepcv/schema";
import { fold } from "../text/fold.js";
import { STOPWORDS } from "../text/stopwords.js";
import {
  type ComposedPoint,
  type Composition,
  composition,
  live,
  organisationOf,
  tagsOfPoint,
  tagsOfRecord,
  textOfPhrasing,
} from "./selectors.js";

// A pure function over the boot payload, like `search` beside it: what the
// posting asks for, and how much of it the resume answers.

export interface TargetTerm {
  // As the posting first spelled it, so a heading reads back the way it was
  // written rather than folded.
  term: string;
  weight: number;
  isCovered: boolean;
}

export interface TargetPoint {
  pointId: Uuid;
  entryPointId: Uuid;
  score: number;
  matched: string[];
}

export interface TargetMatch {
  terms: TargetTerm[];
  points: TargetPoint[];
}

const TOKENS = /[\p{L}\p{N}]+/gu;
const FIGURE = /^\d+$/;

// Below this a word is a list marker or an initial, and a bare figure is the
// "5" in "5+ years": neither is something a resume could answer.
const SHORTEST = 2;

// "engineer" has to find "engineering", but "go" must not find "governance", so
// only a term with room to be wrong matches on its prefix.
const PREFIXABLE = 4;

// And only as far as an inflection reaches: without this "data" covers
// "database" and "test" covers "testimonial".
const INFLECTION = 3;

// A term the store already files work under is one the posting means
// technically rather than in passing.
const KNOWN = 2;

function words(value: string | null): string[] {
  if (value === null) return [];
  return (value.match(TOKENS) ?? [])
    .map(fold)
    .filter((word) => word.length >= SHORTEST && !FIGURE.test(word) && !STOPWORDS.has(word));
}

function matches(term: string, word: string): boolean {
  if (term === word) return true;
  const shorter = Math.min(term.length, word.length);
  const longer = Math.max(term.length, word.length);
  return (
    shorter >= PREFIXABLE &&
    longer - shorter <= INFLECTION &&
    (word.startsWith(term) || term.startsWith(word))
  );
}

// What the store has a name for already, which is the one thing here that knows
// this is a career store rather than a bag of prose.
function vocabulary(store: Store): Set<string> {
  return new Set(
    [
      ...live(store.tags).map((tag) => tag.label),
      ...live(store.records)
        .filter((record) => record.kind === "skill")
        .map((record) => record.title),
    ].flatMap(words),
  );
}

interface PostingTerm {
  word: string;
  term: string;
  weight: number;
}

// The role counts too: a posting nobody pasted still says what it is for.
function postingOf(resume: Resume): string {
  return [resume.targetRole, resume.targetJdText].filter((part) => part !== null).join("\n");
}

function postingTerms(store: Store, resume: Resume): PostingTerm[] {
  const found: PostingTerm[] = [];
  const seen = new Map<string, PostingTerm>();

  for (const raw of postingOf(resume).match(TOKENS) ?? []) {
    const word = fold(raw);
    if (word.length < SHORTEST || FIGURE.test(word) || STOPWORDS.has(word)) continue;

    // "engineer" and "engineers" are one thing the posting asks for, not two,
    // and listing both is what makes the ranking read as noise.
    const already = seen.get(word) ?? found.find((term) => matches(term.word, word));
    if (already === undefined) {
      const term = { word, term: raw, weight: 1 };
      found.push(term);
      seen.set(word, term);
    } else {
      already.weight += 1;
      seen.set(word, already);
    }
  }

  const known = vocabulary(store);
  for (const term of found) {
    if (known.has(term.word)) term.weight += KNOWN;
  }

  return found.sort((a, b) => b.weight - a.weight || a.word.localeCompare(b.word));
}

interface Candidate {
  pointId: Uuid;
  entryPointId: Uuid;
  words: string[];
}

function contextWords(store: Store, record: CareerRecord): string[] {
  return [
    ...words(record.title),
    ...words(record.subtitle),
    ...words(organisationOf(store, record)?.name ?? null),
    ...tagsOfRecord(store, record.id).flatMap((tag) => words(tag.label)),
  ];
}

function pointWords(store: Store, point: ComposedPoint): string[] {
  return [
    ...words(textOfPhrasing(store, point.phrasing)),
    ...tagsOfPoint(store, point.point.id).flatMap((tag) => words(tag.label)),
  ];
}

// Only what prints: a point toggled off is neither covering anything nor a
// candidate to drop.
function printed(
  store: Store,
  composed: Composition,
): { covering: string[][]; candidates: Candidate[] } {
  const covering: string[][] = [];
  const candidates: Candidate[] = [];

  const entries = composed.sections
    .filter((section) => section.section.isVisible)
    .flatMap((section) => section.entries)
    .filter((entry) => entry.entry.isVisible);

  for (const entry of entries) {
    const context = contextWords(store, entry.record);
    covering.push(context);

    for (const point of entry.points.filter((row) => row.entryPoint.isVisible)) {
      const own = pointWords(store, point);
      covering.push(own);
      candidates.push({
        pointId: point.point.id,
        entryPointId: point.entryPoint.id,
        // The record it sits under counts for it: a point under a job nothing
        // in the posting asks about is the better one to drop.
        words: [...own, ...context],
      });
    }
  }

  return { covering, candidates };
}

export function targetMatch(store: Store, resumeId: Uuid): TargetMatch | undefined {
  const composed = composition(store, resumeId);
  if (composed === undefined) return undefined;

  const terms = postingTerms(store, composed.resume);
  if (terms.length === 0) return { terms: [], points: [] };

  const { covering, candidates } = printed(store, composed);

  const covered = (term: PostingTerm): boolean =>
    covering.some((list) => list.some((word) => matches(term.word, word)));

  const points = candidates.map((candidate) => {
    const hit = terms.filter((term) => candidate.words.some((word) => matches(term.word, word)));
    return {
      pointId: candidate.pointId,
      entryPointId: candidate.entryPointId,
      score: hit.reduce((total, term) => total + term.weight, 0),
      matched: hit.map((term) => term.term),
    };
  });

  return {
    terms: terms.map((term) => ({
      term: term.term,
      weight: term.weight,
      isCovered: covered(term),
    })),
    // Weakest first, which is the order the question "what do I drop" is asked
    // in; a stable sort leaves ties in the order the resume prints them.
    points: points.sort((a, b) => a.score - b.score),
  };
}
