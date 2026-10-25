import type { TemplateDefinition } from "@keepcv/schema";
import { ENTRY_SOURCE } from "./entry.js";

export const folioDefinition: TemplateDefinition = {
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
        content: `<main class="paper folio">
  <header class="masthead">
    {% if resume.header.headline %}<p class="eyebrow">{{ resume.header.headline }}</p>{% endif %}
    <h1>{{ resume.header.fullName | default: "" }}</h1>
    {% if resume.header.pronouns %}<p class="pronouns">{{ resume.header.pronouns }}</p>{% endif %}
    <div class="contacts">
      {% if resume.header.location %}<span>{{ resume.header.location }}</span>{% endif %}
      {% for contact in resume.header.contacts %}<span>{% if contact.href %}<a href="{{ contact.href }}">{{ contact.value }}</a>{% else %}{{ contact.value }}{% endif %}</span>{% endfor %}
    </div>
    {% if resume.header.summary %}<div class="intro">{% rich_text resume.header.summary %}</div>{% endif %}
  </header>
  {% for section in resume.sections %}
    <section class="section" data-key="{{ section.key }}">
      <header class="section-heading"><h2>{{ section.heading }}</h2><span aria-hidden="true">{{ forloop.index }}</span></header>
      {% for entry in section.entries %}{% render 'partials/entry.html', entry: entry %}{% endfor %}
    </section>
  {% endfor %}
</main>`,
      },
      "theme.css": {
        mediaType: "text/css",
        encoding: "utf8",
        content: `:root {
  --ink: #302924;
  --accent: #8a342d;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #dedbd5;
  color: var(--ink);
  font:
    10pt / 1.4 Georgia,
    serif;
}
.paper {
  width: var(--page-width);
  min-height: var(--page-height);
  padding: var(--page-margin);
  margin: 24px auto;
  background: #fffdf8;
}
.masthead {
  padding-bottom: 13pt;
  border-bottom: 2pt solid var(--ink);
}
.eyebrow {
  margin: 0 0 8pt;
  color: var(--accent);
  font:
    700 8pt / 1.3 Arial,
    sans-serif;
  text-transform: uppercase;
  letter-spacing: 1.5pt;
}
h1 {
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 41pt;
  font-weight: 400;
  letter-spacing: -1.4pt;
  line-height: 1.05;
}
.pronouns {
  margin: 5pt 0 0;
}
.contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 4pt 12pt;
  margin-top: 10pt;
  font:
    8pt / 1.4 Arial,
    sans-serif;
}
a {
  color: inherit;
  text-underline-offset: 2pt;
  overflow-wrap: anywhere;
}
.intro {
  margin-top: 12pt;
  max-width: 146mm;
  font-size: 11pt;
  line-height: 1.5;
}
.section {
  margin-top: 12pt;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8pt;
  border-bottom: 0.6pt solid #b4a394;
  margin-bottom: 8pt;
  padding-bottom: 4pt;
}
h2 {
  margin: 0;
  color: var(--accent);
  font:
    700 8.5pt / 1.3 Arial,
    sans-serif;
  text-transform: uppercase;
  letter-spacing: 1pt;
}
.section-heading > span {
  color: #8b7d70;
  font-size: 8pt;
}
.entry {
  min-width: 0;
  overflow-wrap: anywhere;
  break-inside: avoid;
}
.entry + .entry {
  margin-top: 9pt;
}
.entry-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12pt;
}
h3 {
  min-width: 0;
  margin: 0;
  font-size: 11pt;
}
.period {
  color: #63574e;
  font:
    8pt / 1.4 Arial,
    sans-serif;
}
.organisation {
  margin: 2pt 0;
  font-style: italic;
}
.subtitle,
.location,
.mode {
  margin: 2pt 0;
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
  font-size: 8pt;
}
.tags {
  margin: 5pt 0 0;
  font:
    8pt / 1.4 Arial,
    sans-serif;
  color: #63574e;
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
