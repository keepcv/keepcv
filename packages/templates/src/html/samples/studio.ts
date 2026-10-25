import type { TemplateDefinition } from "@keepcv/schema";
import { ENTRY_SOURCE } from "./entry.js";

export const studioDefinition: TemplateDefinition = {
  type: "html",
  version: 1,
  payload: {
    documentVersions: [1],
    entry: "index.html",
    styles: ["theme.css"],
    page: { size: "a4", marginMm: 14 },
    files: {
      "index.html": {
        mediaType: "text/html",
        encoding: "utf8",
        content: `<main class="paper studio">
  <header class="masthead">
    <p class="edition">Design practice / Curriculum vitae</p>
    <div class="name-line">
      <h1>{{ resume.header.fullName | default: "" }}</h1>
      <span class="motif" aria-hidden="true">+</span>
    </div>
    <div class="header-details">
      <div>
        {% if resume.header.headline %}<p class="headline">{{ resume.header.headline }}</p>{% endif %}
        {% if resume.header.pronouns %}<p class="pronouns">{{ resume.header.pronouns }}</p>{% endif %}
      </div>
      {% if resume.header.summary %}<div class="intro">{% rich_text resume.header.summary %}</div>{% endif %}
    </div>
    <div class="contact-line">
      {% if resume.header.location %}<span>{{ resume.header.location }}</span>{% endif %}
      {% for contact in resume.header.contacts %}
        <span>{% if contact.href %}<a href="{{ contact.href }}">{{ contact.value }}</a>{% else %}{{ contact.value }}{% endif %}</span>
      {% endfor %}
    </div>
  </header>
  {% for section in resume.sections %}
    <section class="section" data-key="{{ section.key }}">
      <div class="section-label"><span class="section-index">{{ forloop.index }}</span><h2>{{ section.heading }}</h2></div>
      <div class="entries">
        {% for entry in section.entries %}{% render 'partials/entry.html', entry: entry %}{% endfor %}
      </div>
    </section>
  {% endfor %}
</main>`,
      },
      "theme.css": {
        mediaType: "text/css",
        encoding: "utf8",
        content: `:root {
  --accent: #d5fa46;
  --ink: #17241f;
  --pink: #ff7ba0;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: var(--ink);
  background: #dedfd7;
  font:
    9.5pt / 1.4 Arial,
    sans-serif;
}
.paper {
  width: var(--page-width);
  min-height: var(--page-height);
  padding: var(--page-margin);
  margin: 24px auto;
  background: #f8f2e5;
}
.masthead {
  position: relative;
}
.edition {
  margin: 0 0 9pt;
  font:
    8pt / 1.3 "Courier New",
    monospace;
  text-transform: uppercase;
  letter-spacing: 1pt;
}
.name-line {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12pt;
  padding: 18pt 14pt;
  background: var(--accent);
  border: 2pt solid var(--ink);
  overflow: hidden;
}
.name-line::before {
  content: "";
  position: absolute;
  z-index: -1;
  width: 145pt;
  height: 145pt;
  right: -26pt;
  top: -32pt;
  border: 2pt solid var(--ink);
  border-radius: 50%;
  background: var(--pink);
}
h1 {
  min-width: 0;
  max-width: 85%;
  margin: 0;
  font-size: 55pt;
  font-weight: 900;
  letter-spacing: -3.4pt;
  line-height: 0.95;
  overflow-wrap: anywhere;
}
.motif {
  flex-shrink: 0;
  font-size: 70pt;
  font-weight: 400;
  line-height: 1;
  transform: rotate(-15deg);
}
.header-details {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 16pt;
  margin-top: 12pt;
}
.headline {
  margin: 0;
  font-size: 16pt;
  font-weight: 800;
  line-height: 1.12;
}
.pronouns {
  margin: 5pt 0 0;
}
.intro {
  padding-left: 12pt;
  border-left: 2pt solid var(--ink);
}
.contact-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4pt 12pt;
  margin-top: 12pt;
  padding: 6pt 0;
  border-top: 1pt solid var(--ink);
  border-bottom: 1pt solid var(--ink);
  font:
    8pt / 1.4 "Courier New",
    monospace;
}
a {
  color: inherit;
  text-underline-offset: 2pt;
  overflow-wrap: anywhere;
}
.section {
  display: grid;
  grid-template-columns: 29mm minmax(0, 1fr);
  gap: 7mm;
  margin-top: 13pt;
}
.section-label {
  position: relative;
  padding: 5pt 0;
}
.section-index {
  display: inline-block;
  padding: 1pt 5pt;
  border: 1pt solid var(--ink);
  background: var(--pink);
  font:
    700 20pt / 1 "Courier New",
    monospace;
  transform: rotate(-7deg);
}
.section:nth-child(odd) .section-index {
  background: var(--accent);
  transform: rotate(7deg);
}
h2 {
  margin: 8pt 0 0;
  font-size: 10.5pt;
  font-weight: 900;
  line-height: 1.15;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.entries {
  padding-top: 5pt;
  border-top: 2pt solid var(--ink);
}
.entry {
  min-width: 0;
  overflow-wrap: anywhere;
  break-inside: avoid;
}
.entry + .entry {
  margin-top: 10pt;
}
.entry-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10pt;
}
h3 {
  min-width: 0;
  margin: 0;
  font-size: 10.5pt;
}
.period {
  flex-shrink: 0;
  color: #3b4941;
  font:
    7.5pt / 1.4 "Courier New",
    monospace;
}
.organisation {
  margin: 2pt 0;
  font-weight: 700;
}
.subtitle,
.location,
.mode {
  margin: 2pt 0;
  color: #3b4941;
  font-size: 8.5pt;
}
.summary {
  margin-top: 4pt;
}
.points {
  margin: 4pt 0 0;
  padding-left: 12pt;
}
.points li + li {
  margin-top: 3pt;
}
.point-tags {
  display: block;
  font-size: 8pt;
}
.fields {
  margin: 4pt 0 0;
  font-size: 8pt;
}
.fields div {
  display: flex;
  gap: 4pt;
}
dt {
  font-weight: 700;
}
dt::after {
  content: ":";
}
dd {
  margin: 0;
}
.links {
  margin: 4pt 0 0;
  padding: 0;
  list-style: none;
  font-size: 7.5pt;
}
.tags {
  margin: 5pt 0 0;
  font-size: 8pt;
  font-weight: 700;
}
@media print {
  body {
    background: #fff;
  }
  .paper {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
  }
  * {
    print-color-adjust: exact;
  }
}`,
      },
      "partials/entry.html": { mediaType: "text/html", encoding: "utf8", content: ENTRY_SOURCE },
    },
  },
};
