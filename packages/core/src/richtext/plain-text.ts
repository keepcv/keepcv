import type { Inline, RichText } from "@keepcv/schema";

function text(node: Inline): string {
  return node.t === "text" ? node.v : projectPlainText(node.c);
}

// A link contributes its text and not its href: the href is not what is read.
export function projectPlainText(body: RichText): string {
  return body.map(text).join("");
}
