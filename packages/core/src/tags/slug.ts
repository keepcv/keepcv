import { fold } from "../text/fold.js";

const PLUS = /\+/g;
const HASH = /#/g;
const SEPARATORS = /[^\p{L}\p{N}]+/gu;
const EDGES = /^-+|-+$/g;

// A tag's slug is the projection its uniqueness is enforced on, so it collapses
// the differences nobody means: case, spacing, punctuation and accents. Derived
// on every write and again on import rather than trusted, for the reason a
// revision's plain text is (data-model.md I17).
export function tagSlug(label: string): string {
  // Spelled out before the rest is stripped, because C, C++ and C# are three
  // different skills and dropping the punctuation would make them one tag.
  const spelled = label.replace(PLUS, "-plus").replace(HASH, "-sharp");
  const slug = fold(spelled).replace(SEPARATORS, "-").replace(EDGES, "");
  // A label of nothing but punctuation projects to nothing, and an empty slug
  // would make every one of them the same tag.
  return slug === "" ? label.trim().toLowerCase() : slug;
}
