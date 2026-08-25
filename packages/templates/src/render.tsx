import type { DocumentEntry, DocumentGroup, DocumentSection, ResumeDocument } from "@keepcv/schema";
import { Fragment, type ReactElement } from "react";
import type { TemplateConfig } from "./contract.js";
import { type Design, designOf } from "./knobs.js";
import { Fields, joined, Links, Marks, Points } from "./prose.js";

// `trailing` keeps the period out at the right margin and everything else on a
// line under the title; `inline` runs the lot on after it, which is what a
// narrow content column needs - a flexed date collided with the words.
function Entry({
  entry,
  design,
  showOrganisation,
}: {
  entry: DocumentEntry;
  design: Design;
  showOrganisation: boolean;
}): ReactElement {
  const organisation = showOrganisation ? entry.organisation?.name : undefined;
  const inline = design.entryMeta === "inline";
  const title = inline ? entry.title : joined([entry.title, organisation]);
  const meta = inline
    ? joined([organisation, entry.subtitle, entry.location, entry.mode, entry.period?.display])
    : joined([entry.subtitle, entry.location, entry.mode]);

  return (
    <div className="kc-entry" data-key={entry.key}>
      {inline ? (
        <p className="kc-title">{title}</p>
      ) : (
        <div className="kc-row">
          <p className="kc-title">{title}</p>
          {entry.period === undefined ? null : <p className="kc-meta">{entry.period.display}</p>}
        </div>
      )}
      {meta === "" ? null : <p className={inline ? "kc-meta" : "kc-sub"}>{meta}</p>}
      {entry.summary === undefined ? null : (
        <p>
          <Marks nodes={entry.summary} />
        </p>
      )}
      <Points entry={entry} />
      <Fields entry={entry} />
      <Links entry={entry} />
    </div>
  );
}

function Group({
  group,
  design,
  entries,
}: {
  group: DocumentGroup;
  design: Design;
  entries: Map<string, DocumentEntry>;
}): ReactElement {
  const inline = design.entryMeta === "inline";
  const meta = inline ? joined([group.subtitle, group.period?.display]) : (group.subtitle ?? "");

  return (
    <div className="kc-group" data-key={group.key}>
      {inline ? (
        <p className="kc-title">{group.title}</p>
      ) : (
        <div className="kc-row">
          <p className="kc-title">{group.title}</p>
          {group.period === undefined ? null : <p className="kc-meta">{group.period.display}</p>}
        </div>
      )}
      {meta === "" ? null : <p className={inline ? "kc-meta" : "kc-sub"}>{meta}</p>}
      {group.entryKeys.map((key) => {
        const entry = entries.get(key);
        return entry === undefined ? null : (
          <Entry key={key} entry={entry} design={design} showOrganisation={false} />
        );
      })}
    </div>
  );
}

// An empty section says so rather than printing a heading over nothing, and an
// entry no group claimed still prints.
function Body({ section, design }: { section: DocumentSection; design: Design }): ReactElement {
  if (section.entries.length === 0) {
    return <p className="kc-empty">Nothing under this heading prints yet.</p>;
  }

  if (section.layout === "inline") {
    return (
      <p>
        {section.entries.map((entry, index) => (
          <Fragment key={entry.key}>
            {index === 0 ? null : ", "}
            <span data-key={entry.key}>{joined([entry.title, entry.subtitle])}</span>
          </Fragment>
        ))}
      </p>
    );
  }

  const groups = section.groups ?? [];
  const byKey = new Map(section.entries.map((entry) => [entry.key, entry]));
  const claimed = new Set(groups.flatMap((group) => group.entryKeys));

  return (
    <>
      {groups.map((group) => (
        <Group key={group.key} group={group} design={design} entries={byKey} />
      ))}
      {section.entries
        .filter((entry) => !claimed.has(entry.key))
        .map((entry) => (
          <Entry key={entry.key} entry={entry} design={design} showOrganisation />
        ))}
    </>
  );
}

export function render(document: ResumeDocument, config: TemplateConfig): ReactElement {
  const design = designOf(config);
  const { header } = document;

  return (
    <article className="kc-doc" lang={document.meta.locale}>
      <div className="kc-page">
        <header className="kc-header">
          <h1 className="kc-name">
            {header.fullName ?? document.meta.resumeName}
            {header.pronouns === undefined ? null : ` (${header.pronouns})`}
          </h1>
          {header.headline === undefined ? null : <p className="kc-headline">{header.headline}</p>}
          <ul className="kc-contacts">
            {header.location === undefined ? null : <li>{header.location}</li>}
            {header.contacts.map((contact) => (
              <li key={contact.key} data-key={contact.key}>
                {contact.href === undefined ? (
                  contact.value
                ) : (
                  <a href={contact.href}>{contact.value}</a>
                )}
              </li>
            ))}
          </ul>
          {header.summary === undefined ? null : (
            <p className="kc-summary">
              <Marks nodes={header.summary} />
            </p>
          )}
        </header>

        {document.sections.map((section) => (
          <section className="kc-section" key={section.key} data-key={section.key}>
            <h2 className="kc-heading">{section.heading}</h2>
            <Body section={section} design={design} />
          </section>
        ))}
      </div>
    </article>
  );
}
