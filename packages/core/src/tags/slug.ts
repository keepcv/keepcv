import { fold } from "../text/fold.js";

const PLUS = /\+/g;
const HASH = /#/g;
const SEPARATORS = /[^\p{L}\p{N}]+/gu;
const EDGES = /^-+|-+$/g;

// The projection `tag_slug_unique` is enforced on (data-model.md I17).
export function tagSlug(label: string): string {
  // Before the rest is stripped: C, C++ and C# are otherwise one tag.
  const spelled = label.replace(PLUS, "-plus").replace(HASH, "-sharp");
  const slug = fold(spelled).replace(SEPARATORS, "-").replace(EDGES, "");
  // An empty slug would make every punctuation-only label the same tag.
  return slug === "" ? label.trim().toLowerCase() : slug;
}
