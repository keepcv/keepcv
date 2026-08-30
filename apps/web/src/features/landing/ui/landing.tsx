import type { ReactNode } from "react";
import type { GlyphName } from "../../../components/icon/glyphs.js";
import { Icon } from "../../../components/icon/icon.js";
import { Spot } from "../../../components/icon/spot.js";
import { Kbd } from "../../../components/ui/kbd.js";

function Command({ children }: { children: string }) {
  return (
    <code className="block overflow-x-auto rounded-lg border border-line bg-surface-sunken px-3 py-2 font-mono text-sm text-text">
      <span className="select-none text-text-subtle">$ </span>
      {children}
    </code>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: GlyphName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-text">
        <Icon name={icon} size="md" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">{children}</p>
    </div>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-14">
      <h2 className="text-2xl font-semibold tracking-tight text-text">{title}</h2>
      {lead === undefined ? null : (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">{lead}</p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

// Also the no-token state: the app is reached through a URL the launcher
// prints, so anyone arriving without one used to get a red 401 panel. This is
// what belongs there.
export function Landing() {
  return (
    <main className="min-h-screen bg-canvas text-text">
      <div className="backdrop-grid border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-text-muted shadow-card">
            <span className="surface-gradient-brand grid size-4 place-items-center rounded text-on-brand">
              <Icon name="resume" size="xs" />
            </span>
            KeepCV - a career store that compiles into resumes
          </span>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Your career history is not <span className="text-gradient-brand">a resume file</span>.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
            Every trim to fit one page is a delete you cannot undo. KeepCV keeps all of it, and a
            resume becomes a selection over the store rather than the store itself.
          </p>

          <div className="mt-8 max-w-lg space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">
              Start it
            </p>
            <Command>keepcv serve</Command>
            <p className="text-xs leading-relaxed text-text-subtle">
              Open the URL it prints: the token is in the fragment, which no browser sends to a
              server, and the app has no other way to get one.
            </p>
          </div>
        </div>
      </div>

      <Section
        title="Nothing you wrote is ever destroyed"
        lead="Archiving is the only removal there is, so nothing about an application you already sent changes underneath you."
      >
        <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <Spot name="permanent" className="w-32" />
          <ul className="space-y-3 text-sm leading-relaxed text-text-muted">
            <li className="flex gap-2">
              <Icon name="confirm" size="sm" className="mt-0.5 text-positive" />
              Rows are archived, never deleted. Erasing for real is a separate, confirmed step.
            </li>
            <li className="flex gap-2">
              <Icon name="confirm" size="sm" className="mt-0.5 text-positive" />
              Wording is append-only: editing a phrasing adds a revision and moves a pointer.
            </li>
            <li className="flex gap-2">
              <Icon name="confirm" size="sm" className="mt-0.5 text-positive" />
              Export is never gated by an account, a licence or anything else.
            </li>
          </ul>
        </div>
      </Section>

      <Section
        title="What it does"
        lead="The store is the permanent thing. Everything below is a view over it."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon="point" title="Points, not bullets">
            One thing you did, and what it moved. Each resume picks the wording it wants.
          </Feature>
          <Feature icon="variants" title="Wording with a history">
            Editing appends. A resume pins the exact revision it was sent with.
          </Feature>
          <Feature icon="resume" title="A resume is a selection">
            Choose, order and toggle. Taking something off never touches the store.
          </Feature>
          <Feature icon="match" title="Read the posting">
            Paste a posting to see which of its terms you answer. It never leaves the machine.
          </Feature>
          <Feature icon="lint" title="Checked as sent">
            The linter reads the file you send, not a preview of it, and derives the tier from what
            it found.
          </Feature>
          <Feature icon="budget" title="A length budget">
            The browser lays it out, the app counts the pages and names what sits past your limit.
          </Feature>
          <Feature icon="history" title="Versions and snapshots">
            Captured automatically; star one to keep it. An old one can be sent again as it was.
          </Feature>
          <Feature icon="download" title="Leaves in your format">
            One self-contained HTML file, PDF through the browser's printer, or JSON Resume.
          </Feature>
          <Feature icon="data" title="One readable file">
            The store exports as JSON you can read, mirrored beside your data directory.
          </Feature>
        </div>
      </Section>

      <Section
        title="It runs on your machine"
        lead="One process serves the app and the API on a single origin. PostgreSQL is the only dialect, and locally that is PGlite - real Postgres in WebAssembly, no Docker."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <h3 className="text-sm font-semibold text-text">Back it up</h3>
            <p className="mt-1 text-sm text-text-muted">
              Written whole and moved into place, and skipped when nothing changed.
            </p>
            <div className="mt-3 space-y-2">
              <Command>keepcv backup</Command>
              <Command>keepcv restore</Command>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <h3 className="text-sm font-semibold text-text">Render without the app</h3>
            <p className="mt-1 text-sm text-text-muted">
              The same bytes the tab produces, from the store on disk.
            </p>
            <div className="mt-3 space-y-2">
              <Command>keepcv render --resume "Staff Engineer"</Command>
            </div>
          </div>
        </div>
      </Section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-xs text-text-subtle">
          <span>KeepCV - MIT licensed.</span>
          <span className="flex items-center gap-1.5">
            Once the app is open, press <Kbd>/</Kbd> or <Kbd>ctrl K</Kbd> to search anything in the
            store.
          </span>
        </div>
      </footer>
    </main>
  );
}
