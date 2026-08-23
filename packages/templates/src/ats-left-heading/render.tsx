import type { DocumentEntry, DocumentGroup, DocumentSection, ResumeDocument } from "@keepcv/schema";
import { Fragment, type ReactElement } from "react";
import type { TemplateConfig } from "../contract.js";
import { Fields, joined, Links, Marks, Points } from "../prose.js";

// The period runs on with the rest rather than sitting at the right margin: the
// content column is the page minus the gutter, and a flexed date collided.
function Entry({
  entry,
  showOrganisation,
}: {
  entry: DocumentEntry;
  showOrganisation: boolean;
}): ReactElement {
  const meta = joined([
    showOrganisation ? entry.organisation?.name : undefined,
    entry.subtitle,
    entry.location,
    entry.mode,
    entry.period?.display,
  ]);

  return (
    <div className="kc-entry" data-key={entry.key}>
      <p className="kc-title">{entry.title}</p>
      {meta === "" ? null : <p className="kc-meta">{meta}</p>}
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
  entries,
}: {
  group: DocumentGroup;
  entries: Map<string, DocumentEntry>;
}): ReactElement {
  const meta = joined([group.subtitle, group.period?.display]);

  return (
    <div className="kc-group" data-key={group.key}>
      <p className="kc-title">{group.title}</p>
      {meta === "" ? null : <p className="kc-meta">{meta}</p>}
      {group.entryKeys.map((key) => {
        const entry = entries.get(key);
        return entry === undefined ? null : (
          <Entry key={key} entry={entry} showOrganisation={false} />
        );
      })}
    </div>
  );
}

// An empty section says so rather than printing a heading over nothing, and an
// entry no group claimed still prints.
function Body({ section }: { section: DocumentSection }): ReactElement {
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
        <Group key={group.key} group={group} entries={byKey} />
      ))}
      {section.entries
        .filter((entry) => !claimed.has(entry.key))
        .map((entry) => (
          <Entry key={entry.key} entry={entry} showOrganisation />
        ))}
    </>
  );
}

export function render(document: ResumeDocument, _config: TemplateConfig): ReactElement {
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
            <Body section={section} />
          </section>
        ))}
      </div>
    </article>
  );
}
