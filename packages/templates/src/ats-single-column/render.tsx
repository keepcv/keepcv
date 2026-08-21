import type {
  DocumentEntry,
  DocumentField,
  DocumentGroup,
  DocumentSection,
  ResumeDocument,
  RichText,
} from "@keepcv/schema";
import { Fragment, type ReactElement } from "react";
import type { TemplateConfig } from "../contract.js";

function Marks({ nodes }: { nodes: RichText }): ReactElement {
  return (
    <>
      {nodes.map((node, index) => {
        const key = String(index);
        if (node.t === "text") return <Fragment key={key}>{node.v}</Fragment>;
        if (node.t === "b")
          return (
            <strong key={key}>
              <Marks nodes={node.c} />
            </strong>
          );
        if (node.t === "i")
          return (
            <em key={key}>
              <Marks nodes={node.c} />
            </em>
          );
        return (
          <a key={key} href={node.href}>
            <Marks nodes={node.c} />
          </a>
        );
      })}
    </>
  );
}

function joined(parts: (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined && part !== "").join(" - ");
}

// A field prints its label and a real colon, and a URL prints as its address:
// an extractor reading the page as text gets "Credential ID: AWS-1234" and a
// link whose text is a word loses the address entirely.
function Field({ field }: { field: DocumentField }): ReactElement {
  return (
    <li data-field={field.key}>
      <span className="kc-label">{field.label}: </span>
      {field.kind === "url" ? <a href={field.value}>{field.value}</a> : field.value}
    </li>
  );
}

function Points({ entry }: { entry: DocumentEntry }): ReactElement | null {
  if (entry.points.length === 0) return null;
  return (
    <ul className="kc-points">
      {entry.points.map((point) => (
        <li key={point.key} data-key={point.key}>
          <Marks nodes={point.text} />
          {point.metrics.map((metric) => (
            <span className="kc-metrics" key={metric.key} data-key={metric.key}>
              {` (${metric.label}: ${metric.display})`}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Entry({
  entry,
  showOrganisation,
}: {
  entry: DocumentEntry;
  showOrganisation: boolean;
}): ReactElement {
  const title = joined([entry.title, showOrganisation ? entry.organisation?.name : undefined]);
  const sub = joined([entry.subtitle, entry.location, entry.mode]);

  return (
    <div className="kc-entry" data-key={entry.key}>
      <div className="kc-row">
        <p className="kc-title">{title}</p>
        {entry.period === undefined ? null : <p className="kc-meta">{entry.period.display}</p>}
      </div>
      {sub === "" ? null : <p className="kc-sub">{sub}</p>}
      {entry.summary === undefined ? null : (
        <p>
          <Marks nodes={entry.summary} />
        </p>
      )}
      <Points entry={entry} />
      {entry.fields.length === 0 ? null : (
        <ul className="kc-fields">
          {entry.fields.map((field) => (
            <Field key={field.key} field={field} />
          ))}
        </ul>
      )}
      {entry.links.length === 0 ? null : (
        <p className="kc-links">
          {entry.links.map((link, index) => (
            <Fragment key={link.key}>
              {index === 0 ? null : "  |  "}
              <a href={link.url} data-key={link.key}>
                {link.url}
              </a>
            </Fragment>
          ))}
        </p>
      )}
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
  return (
    <div className="kc-group" data-key={group.key}>
      <div className="kc-row">
        <p className="kc-title">{group.title}</p>
        {group.period === undefined ? null : <p className="kc-meta">{group.period.display}</p>}
      </div>
      {group.subtitle === undefined ? null : <p className="kc-sub">{group.subtitle}</p>}
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
// entry no group claimed still prints (template-model.md #5).
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
