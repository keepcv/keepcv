import { Fragment } from "react";

function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g).map((part, index) => {
    const key = String(index);
    if (part.startsWith("**"))
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`"))
      return (
        <code key={key} className="rounded bg-surface-sunken px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-4 break-words text-sm leading-7">
      {text.split(/(```[\s\S]*?(?:```|$))/g).map((section, sectionIndex) => {
        if (section.startsWith("```"))
          return (
            <pre
              key={String(sectionIndex)}
              className="max-w-full overflow-x-auto rounded-xl bg-surface-sunken p-4 text-xs leading-6"
            >
              <code>{section.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code>
            </pre>
          );
        return section
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((block, index) => {
            const key = String(sectionIndex) + ":" + String(index);
            const lines = block.split("\n");
            if (lines.every((line) => /^\s*[-*] /.test(line)))
              return (
                <ul key={key} className="list-disc space-y-1 pl-5">
                  {lines.map((line, at) => (
                    <li key={String(at)}>
                      <Inline text={line.replace(/^\s*[-*] /, "")} />
                    </li>
                  ))}
                </ul>
              );
            if (lines.every((line) => /^\s*\d+\. /.test(line)))
              return (
                <ol key={key} className="list-decimal space-y-1 pl-5">
                  {lines.map((line, at) => (
                    <li key={String(at)}>
                      <Inline text={line.replace(/^\s*\d+\. /, "")} />
                    </li>
                  ))}
                </ol>
              );
            if (/^#{1,3} [^\n]+$/.test(block))
              return (
                <p key={key} className="font-semibold">
                  <Inline text={block.replace(/^#{1,3} /, "")} />
                </p>
              );
            return (
              <p key={key} className="whitespace-pre-wrap">
                <Inline text={block} />
              </p>
            );
          });
      })}
    </div>
  );
}
