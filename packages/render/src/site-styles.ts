// System fonts only: a page built from a store that never leaves the machine
// must not fetch a typeface the first time it is opened.
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// One stylesheet, no knobs. A print template is configured because a resume has
// to fit a page; a page has no page to fit.
export const SITE_STYLES = `
:root {
  --ink: #1a1714;
  --muted: #57514b;
  --subtle: #8a827a;
  --line: #e4ded6;
  --paper: #fbf9f6;
  --card: #ffffff;
  --accent: #4c3f8f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ink: #ece7e1;
    --muted: #b3aca4;
    --subtle: #857d75;
    --line: #322d29;
    --paper: #14120f;
    --card: #1c1916;
    --accent: #b0a2f0;
  }
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.6 ${STACK};
  -webkit-text-size-adjust: 100%;
}

a { color: var(--accent); }
a:hover { text-decoration: none; }

.kc-site {
  max-width: 46rem;
  margin: 0 auto;
  padding: 3rem 1.25rem 5rem;
}

.kc-name {
  margin: 0;
  font-size: clamp(1.9rem, 6vw, 2.6rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.kc-headline {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  color: var(--muted);
}

.kc-where { margin: 0.35rem 0 0; font-size: 0.9rem; color: var(--subtle); }

.kc-contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.kc-summary { margin: 1.5rem 0 0; color: var(--muted); }

/* A page is read by scrolling, so it gets the jump list a printed sheet has no
   use for. */
.kc-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 2rem 0 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--line);
  font-size: 0.85rem;
}
.kc-jump a { color: var(--muted); text-decoration: none; }
.kc-jump a:hover { color: var(--accent); }

.kc-section { margin: 3.5rem 0 0; scroll-margin-top: 1.5rem; }

.kc-heading {
  margin: 0 0 1.25rem;
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--subtle);
}

.kc-entry {
  margin: 0 0 1.75rem;
  padding: 1.25rem 1.35rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 0.75rem;
}
.kc-entry:last-child { margin-bottom: 0; }

.kc-entry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
}

.kc-title { margin: 0; font-size: 1.05rem; font-weight: 620; }
.kc-at { margin: 0.15rem 0 0; font-size: 0.95rem; color: var(--muted); }
.kc-when { font-size: 0.85rem; color: var(--subtle); font-variant-numeric: tabular-nums; }

.kc-entry-summary { margin: 0.85rem 0 0; color: var(--muted); }

.kc-points { margin: 0.85rem 0 0; padding-left: 1.15rem; }
.kc-points li { margin: 0 0 0.45rem; }
.kc-points li:last-child { margin-bottom: 0; }
.kc-metrics { color: var(--subtle); }

.kc-fields {
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  color: var(--muted);
}
.kc-label { color: var(--subtle); }

.kc-links { margin: 0.85rem 0 0; font-size: 0.9rem; word-break: break-word; }

.kc-foot {
  margin: 4rem 0 0;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
  color: var(--subtle);
}

@media print {
  body { background: #fff; }
  .kc-jump { display: none; }
  .kc-entry { break-inside: avoid; border-color: #ddd; }
}
`.trim();
