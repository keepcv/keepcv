import { canonicaliseRichText, projectPlainText } from "@keepcv/core";
import type { Inline, RichText } from "@keepcv/schema";
import { richTextSchema } from "@keepcv/schema";

type Mark = { t: "b" } | { t: "i" } | { t: "a"; href: string };
interface Run {
  text: string;
  marks: Mark[];
}

function runs(body: RichText, marks: Mark[] = []): Run[] {
  return body.flatMap((node): Run[] => {
    if (node.t === "text") return [{ text: node.v, marks }];
    const mark: Mark = node.t === "a" ? { t: "a", href: node.href } : { t: node.t };
    return runs(node.c, [...marks.filter((held) => held.t !== mark.t), mark]);
  });
}

function bodyOfRuns(values: Run[]): RichText {
  return canonicaliseRichText(
    values.map(({ text, marks }) => {
      let node: Inline = { t: "text", v: text };
      for (const mark of [...marks].reverse()) node = { ...mark, c: [node] };
      return node;
    }),
  );
}

function slice(values: Run[], start: number, end: number): Run[] {
  let offset = 0;
  return values.flatMap((run) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    return from >= to ? [] : [{ ...run, text: run.text.slice(from, to) }];
  });
}

export function trimBody(body: RichText): RichText {
  const text = projectPlainText(body);
  if (text === text.trim()) return canonicaliseRichText(body);
  return bodyOfRuns(
    slice(runs(body), text.length - text.trimStart().length, text.trimEnd().length),
  );
}

export function editBody(
  body: RichText,
  next: string,
  selection?: { start: number; end: number },
): RichText {
  const previous = projectPlainText(body);
  let start = selection?.start ?? 0;
  let end = selection?.end ?? previous.length;
  let added = next.length - previous.length + end - start;
  if (
    selection === undefined ||
    added < 0 ||
    next.slice(0, start) !== previous.slice(0, start) ||
    next.slice(start + added) !== previous.slice(end)
  ) {
    start = 0;
    while (start < previous.length && start < next.length && previous[start] === next[start])
      start++;
    end = previous.length;
    let tail = next.length;
    while (end > start && tail > start && previous[end - 1] === next[tail - 1]) {
      end--;
      tail--;
    }
    added = tail - start;
  }
  const values = runs(body);
  const marks =
    slice(
      values,
      start === end && start > 0 ? start - 1 : start,
      start === end && start > 0 ? start : start + 1,
    )[0]?.marks ?? [];
  return richTextSchema.parse(
    bodyOfRuns([
      ...slice(values, 0, start),
      { text: next.slice(start, start + added).replace(/[\r\n]+/g, " "), marks },
      ...slice(values, end, previous.length),
    ]),
  );
}

export function markBody(
  body: RichText,
  start: number,
  end: number,
  mark: Mark | "clear",
): RichText {
  if (start === end) return body;
  const values = runs(body);
  const selected = slice(values, start, end);
  const remove =
    mark === "clear" ||
    (mark.t !== "a" && selected.every((run) => run.marks.some((held) => held.t === mark.t)));
  const changed = selected.map((run) => ({
    ...run,
    marks:
      mark === "clear"
        ? []
        : remove
          ? run.marks.filter((held) => held.t !== mark.t)
          : [...run.marks.filter((held) => held.t !== mark.t), mark],
  }));
  return richTextSchema.parse(
    bodyOfRuns([
      ...slice(values, 0, start),
      ...changed,
      ...slice(values, end, projectPlainText(body).length),
    ]),
  );
}
