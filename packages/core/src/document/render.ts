import type {
  DocumentContact,
  DocumentEntry,
  DocumentField,
  DocumentGroup,
  DocumentLink,
  DocumentPoint,
  DocumentSection,
  ManifestEntry,
  ManifestSection,
  Organisation,
  PhrasingRevision,
  ResumeManifest,
  RichText,
  Uuid,
} from "@keepcv/schema";
import { RESUME_DOCUMENT_SCHEMA_VERSION, type ResumeDocument } from "@keepcv/schema";
import { projectPlainText } from "../richtext/plain-text.js";
import { contactHref, formatMetric, formatPeriod } from "./format.js";
import { present } from "./presenters.js";

export interface CompileOptions {
  generatedAt: string;
  locale?: string;
}

const DEFAULT_LOCALE = "en-GB";

type Texts = Map<Uuid, RichText>;

function keyed<T>(rows: readonly T[], prefix: string): { key: string; row: T }[] {
  return rows.map((row, index) => ({ key: `${prefix}${index}`, row }));
}

// A user-defined field whose key collides with a presenter's keeps its label
// and takes a suffixed key: specialised templates address the typed column by
// key and must not be handed user-entered data instead.
function withUserFields(entry: ManifestEntry, presented: DocumentField[]): DocumentField[] {
  const taken = new Set(presented.map((field) => field.key));
  return [
    ...presented,
    ...entry.fields.map((row) => {
      const key = taken.has(row.key) ? `${row.key}-user` : row.key;
      taken.add(key);
      return { key, label: row.label, value: row.value, kind: row.valueKind };
    }),
  ];
}

function linksOf(entry: ManifestEntry, prefix: string): DocumentLink[] {
  return keyed(entry.links, `${prefix}l`).map(({ key, row }) => ({
    key,
    kind: row.kind,
    label: row.label ?? row.url,
    url: row.url,
  }));
}

function pointsOf(entry: ManifestEntry, texts: Texts, prefix: string): DocumentPoint[] {
  return keyed(entry.points, `${prefix}p`).flatMap(({ key, row }) => {
    const body = texts.get(row.phrasingRevisionId);
    if (body === undefined) return [];
    return [
      {
        key,
        text: body,
        plainText: projectPlainText(body),
        metrics: keyed(row.metrics, `${key}m`).map(({ key: metricKey, row: metric }) =>
          formatMetric(metric, metricKey),
        ),
        tags: row.tags,
      },
    ];
  });
}

// A section's own period, spanning the entries grouped under it.
function spanOf(entries: DocumentEntry[], locale: string) {
  const starts = entries.flatMap((entry) =>
    entry.period?.start === undefined ? [] : [entry.period.start],
  );
  const ends = entries.flatMap((entry) =>
    entry.period?.end === undefined ? [] : [entry.period.end],
  );
  const isCurrent = entries.some((entry) => entry.period?.isCurrent === true);
  if (starts.length === 0 && ends.length === 0 && !isCurrent) return undefined;

  return formatPeriod(
    starts.length === 0 ? null : (starts.sort()[0] ?? null),
    isCurrent || ends.length === 0 ? null : (ends.sort().at(-1) ?? null),
    isCurrent,
    locale,
  );
}

function groupsOf(
  section: ManifestSection,
  entries: DocumentEntry[],
  prefix: string,
  locale: string,
): DocumentGroup[] {
  const order: Uuid[] = [];
  const groups = new Map<Uuid, { organisation: Organisation; members: DocumentEntry[] }>();

  for (const [index, entry] of section.entries.entries()) {
    const organisation = entry.organisation;
    const emitted = entries[index];
    if (organisation === null || emitted === undefined) continue;
    const group = groups.get(organisation.id);
    if (group === undefined) {
      order.push(organisation.id);
      groups.set(organisation.id, { organisation, members: [emitted] });
    } else {
      group.members.push(emitted);
    }
  }

  return order.flatMap((organisationId, index) => {
    const group = groups.get(organisationId);
    if (group === undefined) return [];
    const period = spanOf(group.members, locale);
    return [
      {
        key: `${prefix}g${index}`,
        title: group.organisation.name,
        ...(group.organisation.location === null ? {} : { subtitle: group.organisation.location }),
        ...(period === undefined ? {} : { period }),
        entryKeys: group.members.map((entry) => entry.key),
      },
    ];
  });
}

function entriesOf(
  section: ManifestSection,
  texts: Texts,
  prefix: string,
  locale: string,
): DocumentEntry[] {
  return keyed(section.entries, `${prefix}e`).map(({ key, row }) => {
    const presented = present(row.record, locale);
    const summary = row.summaryRevisionId === null ? undefined : texts.get(row.summaryRevisionId);

    return {
      key,
      kind: row.record.kind,
      ...presented,
      ...(row.organisation === null
        ? {}
        : {
            organisation: {
              name: row.organisation.name,
              ...(row.organisation.website === null ? {} : { url: row.organisation.website }),
              ...(row.organisation.location === null
                ? {}
                : { location: row.organisation.location }),
            },
          }),
      ...(row.record.location === null ? {} : { location: row.record.location }),
      ...(summary === undefined ? {} : { summary }),
      points: pointsOf(row, texts, key),
      tags: row.tags,
      links: linksOf(row, key),
      fields: withUserFields(row, presented.fields),
    };
  });
}

function contactsOf(manifest: ResumeManifest): DocumentContact[] {
  return keyed(manifest.profile.contacts, "c").map(({ key, row }) => {
    const href = contactHref(row.kind, row.value);
    return {
      key,
      kind: row.kind,
      ...(row.label === null ? {} : { label: row.label }),
      value: row.value,
      ...(href === undefined ? {} : { href }),
    };
  });
}

export function renderManifest(
  manifest: ResumeManifest,
  revisions: readonly PhrasingRevision[],
  options: CompileOptions,
): ResumeDocument {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const texts: Texts = new Map(revisions.map((row) => [row.id, row.body]));
  const summary =
    manifest.profile.summaryRevisionId === null
      ? undefined
      : texts.get(manifest.profile.summaryRevisionId);

  const sections: DocumentSection[] = keyed(manifest.sections, "s").map(({ key, row }) => {
    const entries = entriesOf(row, texts, key, locale);
    return {
      key,
      kind: row.kind,
      heading: row.heading,
      layout: row.layout,
      ...(row.layout === "grouped" ? { groups: groupsOf(row, entries, key, locale) } : {}),
      entries,
    };
  });

  return {
    schemaVersion: RESUME_DOCUMENT_SCHEMA_VERSION,
    meta: {
      generatedAt: options.generatedAt,
      resumeName: manifest.resume.name,
      locale,
      ...(manifest.template.id === null ? {} : { templateId: manifest.template.id }),
      ...(Object.keys(manifest.template.config).length === 0
        ? {}
        : { templateConfig: manifest.template.config }),
    },
    header: {
      ...(manifest.profile.fullName === null ? {} : { fullName: manifest.profile.fullName }),
      ...(manifest.profile.headline === null ? {} : { headline: manifest.profile.headline }),
      ...(manifest.profile.pronouns === null ? {} : { pronouns: manifest.profile.pronouns }),
      ...(manifest.profile.location === null ? {} : { location: manifest.profile.location }),
      ...(summary === undefined ? {} : { summary }),
      contacts: contactsOf(manifest),
    },
    sections,
  };
}
