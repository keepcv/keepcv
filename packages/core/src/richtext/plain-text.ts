import type { Inline, RichText } from "@keepcv/schema";

function text(node: Inline): string {
  return node.t === "text" ? node.v : projectPlainText(node.c);
}

// Search, diffing, the ATS linter and length estimation read this and stay
// unaware that formatting exists (data-model.md #3.6). A link contributes its
// text and not its href, because the href is not what the reader sees.
export function projectPlainText(body: RichText): string {
  return body.map(text).join("");
}
