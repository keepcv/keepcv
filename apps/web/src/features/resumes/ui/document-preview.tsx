import { projectPlainText } from "@keepcv/core";
import type { DocumentEntry, DocumentSection, ResumeDocument, RichText } from "@keepcv/schema";

function Prose({ body }: { body: RichText }) {
  return (
    <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{projectPlainText(body)}</p>
  );
}

function Points({ entry }: { entry: DocumentEntry }) {
  if (entry.points.length === 0) return null;
  return (
    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-slate-800 marker:text-slate-400">
      {entry.points.map((point) => (
        <li key={point.key}>{point.plainText}</li>
      ))}
    </ul>
  );
}

function Entry({ entry, showOrganisation }: { entry: DocumentEntry; showOrganisation: boolean }) {
  const left = [entry.title, showOrganisation ? entry.organisation?.name : undefined]
    .filter((part) => part !== undefined && part !== "")
    .join(" - ");
  const right = [entry.period?.display, entry.location]
    .filter((part) => part !== undefined && part !== "")
    .join(" - ");

  return (
    <article className="break-inside-avoid">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-sm font-semibold">{left}</h4>
        {right === "" ? null : (
          <span className="shrink-0 text-xs tabular-nums text-slate-500">{right}</span>
        )}
      </div>
      {entry.subtitle === undefined ? null : (
        <p className="text-[13px] italic text-slate-600">{entry.subtitle}</p>
      )}
      {entry.summary === undefined ? null : <Prose body={entry.summary} />}
      <Points entry={entry} />
    </article>
  );
}

// Three rules of the template contract meet here: an empty section is said out
// loud rather than dropped, a grouped section prints its organisation once, and
// an entry no group claimed still prints (template-model.md #5).
function Body({ section }: { section: DocumentSection }) {
  if (section.entries.length === 0) {
    return <p className="text-[13px] italic text-slate-400">Nothing under this heading prints.</p>;
  }

  if (section.layout === "inline") {
    return (
      <p className="text-[13px] leading-relaxed text-slate-800">
        {section.entries.map((entry) => entry.title ?? "").join(", ")}
      </p>
    );
  }

  if (section.groups === undefined) {
    return (
      <div className="space-y-3">
        {section.entries.map((entry) => (
          <Entry key={entry.key} entry={entry} showOrganisation />
        ))}
      </div>
    );
  }

  const byKey = new Map(section.entries.map((entry) => [entry.key, entry]));
  const grouped = new Set(section.groups.flatMap((group) => group.entryKeys));

  return (
    <div className="space-y-3">
      {section.groups.map((group) => (
        <div key={group.key}>
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="text-sm font-semibold">{group.title}</h4>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {[group.period?.display, group.subtitle].filter(Boolean).join(" - ")}
            </span>
          </div>
          <div className="mt-1 space-y-2 border-l border-slate-200 pl-3">
            {group.entryKeys.map((key) => {
              const entry = byKey.get(key);
              return entry === undefined ? null : (
                <Entry key={key} entry={entry} showOrganisation={false} />
              );
            })}
          </div>
        </div>
      ))}
      {section.entries
        .filter((entry) => !grouped.has(entry.key))
        .map((entry) => (
          <Entry key={entry.key} entry={entry} showOrganisation />
        ))}
    </div>
  );
}

// The same `ResumeDocument` a template renders and an export writes, compiled in
// the browser from the cached store (application-structure.md #2).
export function DocumentPreview({ document }: { document: ResumeDocument }) {
  const { header } = document;

  return (
    <article className="mx-auto w-full max-w-[46rem] rounded-lg bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200 sm:px-12 sm:py-10">
      <header className="border-b border-slate-300 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {header.fullName ?? "Your name is not in the store yet"}
        </h2>
        {header.headline === undefined ? null : (
          <p className="mt-0.5 text-sm text-slate-600">{header.headline}</p>
        )}
        <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-600">
          {[header.location, header.pronouns].filter(Boolean).map((part) => (
            <span key={part}>{part}</span>
          ))}
          {header.contacts.map((contact) => (
            <span key={contact.key}>
              {contact.href === undefined ? (
                contact.value
              ) : (
                <a
                  href={contact.href}
                  className="underline underline-offset-2 hover:text-slate-900"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {contact.label ?? contact.value}
                </a>
              )}
            </span>
          ))}
        </p>
        {header.summary === undefined ? null : <Prose body={header.summary} />}
      </header>

      {document.sections.length === 0 ? (
        <p className="pt-6 text-sm text-slate-500">
          Nothing prints yet. Every section is hidden, or none has an entry that survived.
        </p>
      ) : (
        <div className="space-y-5 pt-5">
          {document.sections.map((section) => (
            <section key={section.key}>
              <h3 className="mb-2 border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {section.heading}
              </h3>
              <Body section={section} />
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
