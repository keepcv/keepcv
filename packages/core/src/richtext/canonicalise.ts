import type { Inline, RichText } from "@keepcv/schema";

type Mark = Exclude<Inline, { t: "text" }>;

function sameMark(a: Mark, b: Mark): boolean {
  if (a.t !== b.t) return false;
  if (a.t === "a" && b.t === "a") return a.href === b.href;
  return true;
}

function withChildren(mark: Mark, c: Inline[]): Mark {
  return { ...mark, c };
}

function canonicaliseNode(node: Inline): Inline | null {
  if (node.t === "text") return node.v === "" ? null : node;

  const children = canonicaliseRichText(node.c);
  const only = children[0];
  if (only === undefined) return null;
  if (children.length === 1 && only.t !== "text" && sameMark(node, only)) return only;
  return withChildren(node, children);
}

// Bodies that render identically must canonicalise to the same tree, or an editor
// emitting b(x)b(y) then b(xy) defeats phrasing_revision_content_hash_unique.
export function canonicaliseRichText(body: RichText): RichText {
  const canonical: Inline[] = [];

  for (const node of body) {
    const next = canonicaliseNode(node);
    if (next === null) continue;

    const previous = canonical.at(-1);
    if (previous === undefined) {
      canonical.push(next);
    } else if (previous.t === "text" && next.t === "text") {
      canonical[canonical.length - 1] = { t: "text", v: previous.v + next.v };
    } else if (previous.t !== "text" && next.t !== "text" && sameMark(previous, next)) {
      canonical[canonical.length - 1] = withChildren(
        previous,
        canonicaliseRichText([...previous.c, ...next.c]),
      );
    } else {
      canonical.push(next);
    }
  }

  return canonical;
}
