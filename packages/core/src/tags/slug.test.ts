import { describe, expect, it } from "vitest";
import { tagSlug } from "./slug.js";

describe("a tag's slug", () => {
  it("lowercases and hyphenates", () => {
    expect(tagSlug("Distributed Systems")).toBe("distributed-systems");
  });

  // The whole reason the column exists: uniqueness is enforced on the slug, so
  // these have to collide rather than becoming three words for one thing.
  it("collapses case, spacing and punctuation onto one slug", () => {
    expect(tagSlug("React")).toBe("react");
    expect(tagSlug("  react  ")).toBe("react");
    expect(tagSlug("React!")).toBe("react");
  });

  it("folds accents, so an accented spelling is not a second tag", () => {
    expect(tagSlug("Cr\u00eape")).toBe(tagSlug("Crepe"));
  });

  // Three different skills. Stripping the punctuation the way every other
  // symbol is stripped would file all three under "c".
  it("keeps C, C++ and C# apart", () => {
    expect(tagSlug("C")).toBe("c");
    expect(tagSlug("C++")).toBe("c-plus-plus");
    expect(tagSlug("C#")).toBe("c-sharp");
  });

  it("keeps letters no ASCII slug could carry", () => {
    expect(tagSlug("\u65e5\u672c\u8a9e")).toBe("\u65e5\u672c\u8a9e");
  });

  // An empty slug would make every punctuation-only label the same tag, and the
  // second one would be refused by a uniqueness rule the user cannot see.
  it("falls back to the label when there is nothing to project", () => {
    expect(tagSlug("!!!")).toBe("!!!");
  });

  it("is idempotent, so re-deriving it on import changes nothing", () => {
    for (const label of ["React", "Distributed Systems", "Cr\u00eape", "C++", "!!!"]) {
      expect(tagSlug(tagSlug(label))).toBe(tagSlug(label));
    }
  });
});
