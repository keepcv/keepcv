import { z } from "zod";

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "a"; href: string; c: Inline[] };

const MAX_MARK_DEPTH = 3;

// A regex rather than a refinement so the restriction survives into the
// published JSON Schema and a third-party validator enforces it too. The point
// of the restriction is that `javascript:` never reaches a renderer.
const HREF = /^(?:https?|mailto):\S+$/;

const inlineSchema: z.ZodType<Inline> = z.lazy(() =>
  z.union([
    z.object({ t: z.literal("text"), v: z.string() }),
    z.object({ t: z.literal("b"), c: z.array(inlineSchema) }),
    z.object({ t: z.literal("i"), c: z.array(inlineSchema) }),
    z.object({
      t: z.literal("a"),
      href: z.string().regex(HREF, "a link must be http, https or mailto"),
      c: z.array(inlineSchema),
    }),
  ]),
);

function violation(nodes: Inline[], depth: number, insideLink: boolean): string | null {
  for (const node of nodes) {
    if (node.t === "text") continue;
    if (node.t === "a" && insideLink) return "a link may not contain a link";
    if (depth + 1 > MAX_MARK_DEPTH) {
      return `inline markup may nest at most ${MAX_MARK_DEPTH} marks deep`;
    }
    const inner = violation(node.c, depth + 1, insideLink || node.t === "a");
    if (inner !== null) return inner;
  }
  return null;
}

// One paragraph, no block constructs (data-model.md #3.6). Merging adjacent
// text nodes is canonicalisation, so it belongs to @keepcv/core, not parsing.
export const richTextSchema = z.array(inlineSchema).superRefine((nodes, ctx) => {
  const message = violation(nodes, 0, false);
  if (message !== null) ctx.addIssue({ code: "custom", message });
});

export type RichText = z.infer<typeof richTextSchema>;
