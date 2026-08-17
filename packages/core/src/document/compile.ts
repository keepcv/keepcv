import type {
  CareerRecord,
  DocumentContact,
  DocumentEntry,
  DocumentField,
  DocumentGroup,
  DocumentLink,
  DocumentPoint,
  DocumentSection,
  Organisation,
  Phrasing,
  ResumeDocument,
  SectionKind,
  Store,
  Uuid,
} from "@keepcv/schema";
import { RESUME_DOCUMENT_SCHEMA_VERSION } from "@keepcv/schema";
import { projectPlainText } from "../richtext/plain-text.js";
import { type ComposedEntry, composition, live } from "../store/selectors.js";
import { contactHref, formatMetric, formatPeriod } from "./format.js";
import { present } from "./presenters.js";

export interface CompileOptions {
  generatedAt: string;
  locale?: string;
}

const DEFAULT_LOCALE = "en-GB";

// The heading a kind prints under when the section carries no override.
const HEADINGS: Record<SectionKind, string> = {
  experience: "Experience",
  education: "Education",
  project: "Projects",
  skill: "Skills",
  certification: "Certifications",
  publication: "Publications",
  award: "Awards",
  language: "Languages",
  volunteering: "Volunteering",
  speaking: "Speaking",
  custom: "Other",
};

function keyed<T>(rows: readonly T[], prefix: string): { key: string; row: T }[] {
  return rows.map((row, index) => ({ key: `${prefix}${index}`, row }));
}

function textOf(store: Store, phrasing: Phrasing | undefined) {
  if (phrasing?.currentRevisionId == null) return undefined;
  return store.phrasingRevisions.find((row) => row.id === phrasing.currentRevisionId);
}

function summaryOf(store: Store, setId: Uuid | null) {
  if (setId === null) return undefined;
  const set = store.phrasingSets.find((row) => row.id === setId);
  if (set?.canonicalPhrasingId == null) return undefined;
  const phrasing = store.phrasings.find((row) => row.id === set.canonicalPhrasingId);
  return textOf(store, phrasing)?.body;
}

function tagLabels(store: Store, ids: readonly Uuid[]): string[] {
  const labels = ids.flatMap((id) => {
    const tag = store.tags.find((row) => row.id === id && row.archivedAt === null);
    return tag === undefined ? [] : [tag.label];
  });
  return labels.sort((a, b) => a.localeCompare(b));
}

// A user-defined field whose key collides with a presenter's keeps its label and
// takes a suffixed key: specialised templates address the typed column by key
// and must not be handed user-entered data instead (template-model.md #3).
function withUserFields(store: Store, record: CareerRecord, presented: DocumentField[]) {
  const taken = new Set(presented.map((entry) => entry.key));
  const own = live(store.recordFields)
    .filter((row) => row.recordId === record.id)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));

  return [
    ...presented,
    ...own.map((row) => {
      const key = taken.has(row.key) ? `${row.key}-user` : row.key;
      taken.add(key);
      return { key, label: row.label, value: row.value, kind: row.valueKind };
    }),
  ];
}

function linksOf(store: Store, record: CareerRecord, prefix: string): DocumentLink[] {
  return keyed(
    live(store.recordLinks)
      .filter((row) => row.recordId === record.id)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id)),
    `${prefix}l`,
  ).map(({ key, row }) => ({
    key,
    kind: row.kind,
    label: row.label ?? row.url,
    url: row.url,
  }));
}

function pointsOf(store: Store, entry: ComposedEntry, prefix: string): DocumentPoint[] {
  return keyed(
    entry.points.filter(
      (placed) => placed.entryPoint.isVisible && placed.point.archivedAt === null,
    ),
    `${prefix}p`,
  ).flatMap(({ key, row }) => {
    const revision = textOf(store, row.phrasing);
    if (revision === undefined) return [];
    return [
      {
        key,
        text: revision.body,
        plainText: projectPlainText(revision.body),
        metrics: keyed(
          live(store.metrics)
            .filter((metric) => metric.pointId === row.point.id)
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id)),
          `${key}m`,
        ).map(({ key: metricKey, row: metric }) => formatMetric(metric, metricKey)),
        tags: tagLabels(
          store,
          store.pointTags.filter((tag) => tag.pointId === row.point.id).map((tag) => tag.tagId),
        ),
      },
    ];
  });
}

function organisationOf(store: Store, id: Uuid | null): Organisation | undefined {
  return id === null ? undefined : store.organisations.find((row) => row.id === id);
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
  store: Store,
  composed: ComposedEntry[],
  entries: DocumentEntry[],
  prefix: string,
  locale: string,
): DocumentGroup[] {
  const order: Uuid[] = [];
  const byOrganisation = new Map<Uuid, DocumentEntry[]>();

  for (const [index, entry] of composed.entries()) {
    const organisationId = entry.record.organisationId;
    const emitted = entries[index];
    if (organisationId === null || emitted === undefined) continue;
    if (!byOrganisation.has(organisationId)) {
      order.push(organisationId);
      byOrganisation.set(organisationId, []);
    }
    byOrganisation.get(organisationId)?.push(emitted);
  }

  return order.flatMap((organisationId, index) => {
    const organisation = organisationOf(store, organisationId);
    const members = byOrganisation.get(organisationId) ?? [];
    if (organisation === undefined) return [];
    const period = spanOf(members, locale);
    return [
      {
        key: `${prefix}g${index}`,
        title: organisation.name,
        ...(organisation.location === null ? {} : { subtitle: organisation.location }),
        ...(period === undefined ? {} : { period }),
        entryKeys: members.map((member) => member.key),
      },
    ];
  });
}

function entriesOf(
  store: Store,
  composed: ComposedEntry[],
  prefix: string,
  locale: string,
): DocumentEntry[] {
  return keyed(composed, `${prefix}e`).map(({ key, row }) => {
    const presented = present(row.record, locale);
    const organisation = organisationOf(store, row.record.organisationId);
    const summary = summaryOf(store, row.record.summarySetId);

    return {
      key,
      kind: row.record.kind,
      ...presented,
      ...(organisation === undefined
        ? {}
        : {
            organisation: {
              name: organisation.name,
              ...(organisation.website === null ? {} : { url: organisation.website }),
              ...(organisation.location === null ? {} : { location: organisation.location }),
            },
          }),
      ...(row.record.location === null ? {} : { location: row.record.location }),
      ...(summary === undefined ? {} : { summary }),
      points: pointsOf(store, row, key),
      tags: tagLabels(
        store,
        store.recordTags.filter((tag) => tag.recordId === row.record.id).map((tag) => tag.tagId),
      ),
      links: linksOf(store, row.record, key),
      fields: withUserFields(store, row.record, presented.fields),
    };
  });
}

function contactsOf(store: Store, resumeId: Uuid): DocumentContact[] {
  const overrides = new Map(
    store.resumeContactChannels
      .filter((row) => row.resumeId === resumeId)
      .map((row) => [row.contactChannelId, row.isVisible]),
  );

  const shown = live(store.contactChannels)
    .filter((channel) => overrides.get(channel.id) ?? channel.isDefaultVisible)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));

  return keyed(shown, "c").map(({ key, row }) => {
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

// The same function serves the browser preview and a server-side export
// (template-model.md #7). Nothing here reaches outside the store it is given.
export function compile(
  store: Store,
  resumeId: Uuid,
  options: CompileOptions,
): ResumeDocument | undefined {
  const composed = composition(store, resumeId);
  if (composed === undefined) return undefined;

  const locale = options.locale ?? DEFAULT_LOCALE;
  const { profile } = store;

  const sections: DocumentSection[] = keyed(
    composed.sections.filter((section) => section.section.isVisible),
    "s",
  ).map(({ key, row }) => {
    const custom =
      row.section.customSectionId === null
        ? undefined
        : store.customSections.find((entry) => entry.id === row.section.customSectionId);
    const visible = row.entries.filter(
      (entry) => entry.entry.isVisible && entry.record.archivedAt === null,
    );
    const entries = entriesOf(store, visible, key, locale);
    const layout = row.section.layout ?? "entries";

    return {
      key,
      kind: row.section.kind,
      heading: row.section.heading ?? custom?.heading ?? HEADINGS[row.section.kind],
      layout,
      ...(layout === "grouped" ? { groups: groupsOf(store, visible, entries, key, locale) } : {}),
      entries,
    };
  });

  const summary = summaryOf(store, profile.summarySetId);

  return {
    schemaVersion: RESUME_DOCUMENT_SCHEMA_VERSION,
    meta: { generatedAt: options.generatedAt, resumeName: composed.resume.name, locale },
    header: {
      ...(profile.fullName === null ? {} : { fullName: profile.fullName }),
      ...(profile.headline === null ? {} : { headline: profile.headline }),
      ...(profile.pronouns === null ? {} : { pronouns: profile.pronouns }),
      ...(profile.location === null ? {} : { location: profile.location }),
      ...(summary === undefined ? {} : { summary }),
      contacts: contactsOf(store, resumeId),
    },
    sections,
  };
}
