import type { TemplateDefinition } from "@keepcv/schema";
import { ENTRY_SOURCE } from "./entry.js";

export const signalDefinition: TemplateDefinition = {
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
        content: `<main class="paper signal">
  <header class="masthead">
    <span class="stamp" aria-hidden="true">CV</span>
    <div class="identity">
      <h1>{{ resume.header.fullName | default: "" }}</h1>
      {% if resume.header.headline %}<p class="headline">{{ resume.header.headline }}</p>{% endif %}
      {% if resume.header.pronouns %}<p class="pronouns">{{ resume.header.pronouns }}</p>{% endif %}
      {% if resume.header.location %}<p class="location">{{ resume.header.location }}</p>{% endif %}
    </div>
    <div class="contacts">
      {% for contact in resume.header.contacts %}<p>{% if contact.href %}<a href="{{ contact.href }}">{{ contact.value }}</a>{% else %}{{ contact.value }}{% endif %}</p>{% endfor %}
    </div>
    {% if resume.header.summary %}<div class="intro">{% rich_text resume.header.summary %}</div>{% endif %}
  </header>
  <div class="contact-sheet">
    {% for section in resume.sections %}
      <section class="section section-{{ section.kind }}" data-key="{{ section.key }}">
        <h2><span class="index" aria-hidden="true">{{ forloop.index }}</span>{{ section.heading }}</h2>
        <div class="entry-grid">
          {% for entry in section.entries %}{% render 'partials/entry.html', entry: entry %}{% endfor %}
        </div>
      </section>
    {% endfor %}
  </div>
</main>`,
      },
      "theme.css": {
        mediaType: "text/css",
        encoding: "utf8",
        content: `:root {
  --ink: #27231f;
  --accent: #f4aa74;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #ded8d1;
  color: var(--ink);
  font:
    9pt / 1.4 Arial,
    sans-serif;
}
.paper {
  width: var(--page-width);
  min-height: var(--page-height);
  margin: 24px auto;
  background: #efaf80;
  background-image: radial-gradient(#a96a3f 0.5px, transparent 0.5px);
  background-size: 9px 9px;
  padding: var(--page-margin);
}
.masthead {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40mm;
  gap: 10pt 16pt;
  margin-bottom: 20pt;
  padding: 20pt;
  border: 1.5pt solid var(--ink);
  background: #fff9e9;
  box-shadow: 5pt 5pt 0 var(--ink);
}
h1 {
  position: relative;
  max-width: 115mm;
  margin: 0;
  font:
    700 36pt / 0.95 Georgia,
    serif;
  letter-spacing: -1.5pt;
  overflow-wrap: anywhere;
}
.headline {
  margin: 9pt 0 0;
  max-width: 100mm;
  font-size: 13pt;
  font-weight: 700;
}
.pronouns {
  margin: 4pt 0 0;
}
.location {
  margin: 4pt 0 0;
  font-size: 8pt;
}
.stamp {
  position: absolute;
  right: 22pt;
  top: -13pt;
  display: grid;
  place-items: center;
  width: 50pt;
  height: 50pt;
  border: 2pt solid var(--ink);
  border-radius: 50%;
  background: #dded9b;
  transform: rotate(12deg);
  font:
    700 23pt / 1 Georgia,
    serif;
}
.contacts {
  align-self: end;
  min-width: 0;
  padding-top: 30pt;
  font:
    7.5pt / 1.5 "Courier New",
    monospace;
}
.contacts p {
  margin: 3pt 0;
}
a {
  color: inherit;
  text-underline-offset: 2pt;
  overflow-wrap: anywhere;
}
.intro {
  grid-column: 1 / -1;
  margin-top: 5pt;
  padding-top: 9pt;
  border-top: 1pt dashed var(--ink);
}
.contact-sheet {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17pt 14pt;
}
.section {
  position: relative;
  min-width: 0;
  padding: 13pt;
  border: 1.2pt solid var(--ink);
  background: #fffdf6;
  box-shadow: 3pt 3pt 0 #86552c;
  transform: rotate(-0.8deg);
}
.section:nth-child(even) {
  transform: rotate(0.8deg);
  background: #f3f2e8;
}
.section-experience,
.section-project {
  grid-column: 1 / -1;
}
.section-project {
  background: #f5efbd;
}
h2 {
  display: flex;
  align-items: baseline;
  gap: 7pt;
  margin: 0 0 9pt;
  border-bottom: 1pt solid var(--ink);
  padding-bottom: 6pt;
  font:
    700 14pt / 1.15 Georgia,
    serif;
}
.index {
  display: inline-block;
  color: #7c3c18;
  font:
    700 9pt / 1 "Courier New",
    monospace;
}
.entry-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12pt;
}
.section-experience .entry-grid,
.section-project .entry-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.entry {
  min-width: 0;
  overflow-wrap: anywhere;
  break-inside: avoid;
}
.entry-heading {
  display: block;
}
h3 {
  margin: 0;
  font-size: 10pt;
}
.period {
  display: block;
  margin-top: 3pt;
  color: #615143;
  font:
    7.5pt / 1.4 "Courier New",
    monospace;
}
.organisation {
  margin: 3pt 0;
  font-weight: 700;
}
.subtitle,
.mode {
  margin: 3pt 0;
  font-size: 8.5pt;
}
.summary {
  margin-top: 5pt;
}
.points {
  margin: 5pt 0 0;
  padding-left: 12pt;
}
.points li + li {
  margin-top: 4pt;
}
.point-tags {
  display: block;
  font-size: 8pt;
}
.fields {
  margin: 5pt 0 0;
  font-size: 7.5pt;
}
.fields div {
  display: flex;
  flex-wrap: wrap;
  gap: 2pt 4pt;
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
  margin: 5pt 0 0;
  padding: 0;
  list-style: none;
  font-size: 7pt;
}
.tags {
  margin: 5pt 0 0;
  font-size: 8pt;
  color: #615143;
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
