import { projectPlainText } from "@keepcv/core";
import type {
  DocumentEntry,
  DocumentSection,
  Inline,
  ResumeDocument,
  RichText,
} from "@keepcv/schema";

// What a line of a resume is for, rather than what it should look like. A
// writer maps each role onto whatever its format calls a heading or a bullet,
// and none of them re-derives what a resume is made of.
export type BlockRole =
  | "name"
  | "headline"
  | "contacts"
  | "heading"
  | "entry"
  | "detail"
  | "note"
  | "point";

// `aside` is the period on an entry head, which every format sets away from the
// title rather than after it. Nothing else has one.
export interface ResumeBlock {
  role: BlockRole;
  text: RichText;
  aside?: string;
}

const words = (value: string): RichText => [{ t: "text", v: value }];

const joined = (parts: (string | undefined)[]): string =>
  parts.filter((part) => part !== undefined && part !== "").join(" - ");

const block = (role: BlockRole, text: RichText, aside?: string): ResumeBlock[] =>
  text.length === 0 ? [] : [aside === undefined ? { role, text } : { role, text, aside }];

const said = (role: BlockRole, value: string | undefined): ResumeBlock[] =>
  value === undefined || value === "" ? [] : block(role, words(value));

const prose = (role: BlockRole, text: RichText | undefined): ResumeBlock[] =>
  text === undefined || projectPlainText(text).trim() === "" ? [] : block(role, text);

// A contact reachable by a link travels as one, so a writer that can make an
// address clickable does, and one that cannot still prints the address.
const contactRun = (value: string, href: string | undefined): Inline =>
  href === undefined ? { t: "text", v: value } : { t: "a", href, c: words(value) };

function contactsOf(document: ResumeDocument): ResumeBlock[] {
  const runs: Inline[] = [];
  for (const contact of document.header.contacts) {
    if (runs.length > 0) runs.push({ t: "text", v: "  |  " });
    runs.push(contactRun(contact.value, contact.href));
  }
  return block("contacts", runs);
}

// The same trailing metric spans the templates print, because a point that
// names a number and a file that drops it are not the same claim.
function pointText(point: DocumentEntry["points"][number]): RichText {
  const metrics = point.metrics.map(
    (metric): Inline => ({ t: "text", v: ` (${metric.label}: ${metric.display})` }),
  );
  return [...point.text, ...metrics];
}

function fieldRuns(field: DocumentEntry["fields"][number]): RichText {
  const label: Inline = { t: "text", v: `${field.label}: ` };
  if (field.kind !== "url") return [label, { t: "text", v: field.value }];
  return [label, { t: "a", href: field.value, c: words(field.value) }];
}

function linkRuns(entry: DocumentEntry): RichText {
  const runs: Inline[] = [];
  for (const link of entry.links) {
    if (runs.length > 0) runs.push({ t: "text", v: "  |  " });
    runs.push({ t: "a", href: link.url, c: words(link.url) });
  }
  return runs;
}

function entryBlocks(entry: DocumentEntry): ResumeBlock[] {
  const title = joined([entry.title, entry.subtitle]);
  const at = joined([entry.organisation?.name, entry.location ?? entry.mode]);

  return [
    ...block("entry", words(title), entry.period?.display),
    ...said("detail", at),
    ...prose("note", entry.summary),
    ...entry.points.flatMap((point) => block("point", pointText(point))),
    ...entry.fields.flatMap((field) => block("detail", fieldRuns(field))),
    ...block("detail", linkRuns(entry)),
  ];
}

// Tags are not written, for the reason no template prints them: they are the
// words the store files work under, not words the user chose to send.
//
// Groups are ignored deliberately. They are a hint for stacking roles at one
// employer on a page, and none of these formats is being laid out here.
const sectionBlocks = (section: DocumentSection): ResumeBlock[] => [
  ...said("heading", section.heading),
  ...section.entries.flatMap(entryBlocks),
];

// The mirror of `DocumentLine[]`: an extractor turns a file into lines and
// `fromLines` reasons about them, so a writer reasons here and every format
// only has to know how to set a heading, a bullet and a bold run.
export function toBlocks(document: ResumeDocument): ResumeBlock[] {
  const { header } = document;

  return [
    ...said("name", header.fullName ?? document.meta.resumeName),
    ...said("headline", header.headline),
    ...said("headline", joined([header.pronouns, header.location])),
    ...contactsOf(document),
    ...prose("note", header.summary),
    ...document.sections.filter((section) => section.entries.length > 0).flatMap(sectionBlocks),
  ];
}
