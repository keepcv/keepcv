import { describe, expect, it } from "vitest";
import { fold } from "./fold.js";
import { STOPWORDS } from "./stopwords.js";

describe("the stopword list", () => {
  // A word that does not survive folding is one the caller can never match,
  // because it asks with a folded word.
  it("holds every word in the form a caller asks with", () => {
    expect([...STOPWORDS].filter((word) => fold(word) !== word)).toEqual([]);
  });

  it("drops what a posting says about itself and keeps what it asks for", () => {
    for (const word of ["the", "and", "experience", "responsibilities", "team", "years"]) {
      expect(STOPWORDS.has(word), word).toBe(true);
    }
    for (const word of ["kubernetes", "postgres", "rust", "latency", "migration", "mentoring"]) {
      expect(STOPWORDS.has(word), word).toBe(false);
    }
  });
});
