import type {
  DocumentEntry,
  DocumentHeader,
  DocumentSection,
  ResumeDocument,
} from "@keepcv/schema";
import { Fields, joined, Links, Marks, Points } from "@keepcv/templates";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SITE_STYLES } from "./site-styles.js";
import { documentTitle } from "./title.js";

// What every static host looks for, and what keeps a page from overwriting the
// resume when both are written into one directory.
export const SITE_FILE_NAME = "index.html";

// Positional, like every key in the document: a section anchor must not be a
// store identifier, and a heading the user renames must not break a link.
function anchor(section: DocumentSection): string {
  return `s-${section.key}`;
}

function Contacts({ header }: { header: DocumentHeader }): ReactElement | null {
  if (header.contacts.length === 0) return null;
  return (
    <ul className="kc-contacts">
      {header.contacts.map((contact) => (
        <li key={contact.key} data-key={contact.key}>
          {contact.href === undefined ? contact.value : <a href={contact.href}>{contact.value}</a>}
        </li>
      ))}
    </ul>
  );
}

function Entry({ entry }: { entry: DocumentEntry }): ReactElement {
  const at = joined([entry.organisation?.name, entry.location ?? entry.mode]);

  return (
    <article className="kc-entry" data-key={entry.key}>
      <div className="kc-entry-head">
        <h3 className="kc-title">{joined([entry.title, entry.subtitle])}</h3>
        {entry.period === undefined ? null : (
          <span className="kc-when">{entry.period.display}</span>
        )}
      </div>
      {at === "" ? null : <p className="kc-at">{at}</p>}
      {entry.summary === undefined ? null : (
        <p className="kc-entry-summary">
          <Marks nodes={entry.summary} />
        </p>
      )}
      <Points entry={entry} />
      <Fields entry={entry} />
      <Links entry={entry} />
    </article>
  );
}

// Tags are not printed. They are the words the store files work under, not
// words the user chose to publish, and a page that prints more than the resume
// does is a page that leaks a decision nobody made.

// Groups are ignored deliberately: they are a print hint for stacking roles at
// one employer, and a page has the room to give each its own card.
function Section({ section }: { section: DocumentSection }): ReactElement {
  return (
    <section className="kc-section" id={anchor(section)} data-key={section.key}>
      <h2 className="kc-heading">{section.heading}</h2>
      {section.entries.map((entry) => (
        <Entry key={entry.key} entry={entry} />
      ))}
    </section>
  );
}

function Page({ document }: { document: ResumeDocument }): ReactNode {
  const { header, sections } = document;
  const printed = sections.filter((section) => section.entries.length > 0);

  return (
    <div className="kc-site">
      <header>
        <h1 className="kc-name">{header.fullName ?? document.meta.resumeName}</h1>
        {header.headline === undefined ? null : <p className="kc-headline">{header.headline}</p>}
        {joined([header.pronouns, header.location]) === "" ? null : (
          <p className="kc-where">{joined([header.pronouns, header.location])}</p>
        )}
        <Contacts header={header} />
        {header.summary === undefined ? null : (
          <p className="kc-summary">
            <Marks nodes={header.summary} />
          </p>
        )}
        {printed.length < 2 ? null : (
          <nav className="kc-jump" aria-label="Sections">
            {printed.map((section) => (
              <a key={section.key} href={`#${anchor(section)}`}>
                {section.heading}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {printed.map((section) => (
          <Section key={section.key} section={section} />
        ))}
      </main>

      <p className="kc-foot">Built with KeepCV.</p>
    </div>
  );
}

// Which contact details it prints is the resume's decision, made in the
// composer, so there is no knob for it here.
export function renderSite(document: ResumeDocument): string {
  const markup = renderToStaticMarkup(
    <html lang={document.meta.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{documentTitle(document)}</title>
        {document.header.headline === undefined ? null : (
          <meta name="description" content={document.header.headline} />
        )}
        <style>{SITE_STYLES}</style>
      </head>
      <body>
        <Page document={document} />
      </body>
    </html>,
  );

  return `<!doctype html>\n${markup}\n`;
}
