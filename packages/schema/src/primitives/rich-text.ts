import { z } from "zod";

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "a"; href: string; c: Inline[] };

const MAX_MARK_DEPTH = 3;

// A regex, not a refinement, so it survives into the published JSON Schema. The
// point of it is that `javascript:` never reaches a renderer.
const HREF = /^(?:https?|mailto):\S+$/;

// Named because it recurses: without an id the published JSON Schema calls the
// node `__schema0`, and third parties read that file.
const inlineSchema: z.ZodType<Inline> = z
  .lazy(() =>
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
  )
  .meta({ id: "Inline", title: "Inline node" });

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

// One paragraph, no block constructs.
export const richTextSchema = z.array(inlineSchema).superRefine((nodes, ctx) => {
  const message = violation(nodes, 0, false);
  if (message !== null) ctx.addIssue({ code: "custom", message });
});

export type RichText = z.infer<typeof richTextSchema>;
