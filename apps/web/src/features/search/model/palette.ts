import type { Store } from "@keepcv/schema";
import type { GlyphName } from "../../../components/icon/glyphs.js";
import { KIND_NAMES } from "../../records/model/record-rows.js";
import { type SearchRow, searchRows } from "./search-rows.js";

// Enough that the palette stays one screen: the search screen is where a long
// result list belongs.
const PER_SUBJECT = 5;

export interface PaletteItem {
  key: string;
  group: string;
  label: string;
  context?: string;
  icon: GlyphName;
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
}

const DESTINATIONS: readonly PaletteItem[] = [
  { key: "go:overview", group: "Go to", label: "Overview", icon: "overview", to: "/" },
  {
    key: "go:records",
    group: "Go to",
    label: "Records",
    icon: "record",
    to: "/records",
    search: { archived: "exclude" },
  },
  {
    key: "go:points",
    group: "Go to",
    label: "Points",
    icon: "point",
    to: "/points",
    search: { filter: "all" },
  },
  { key: "go:profile", group: "Go to", label: "Profile", icon: "profile", to: "/profile" },
  {
    key: "go:tags",
    group: "Go to",
    label: "Tags",
    icon: "tag",
    to: "/tags",
    search: { filter: "all" },
  },
  {
    key: "go:sections",
    group: "Go to",
    label: "Sections",
    icon: "section",
    to: "/sections",
    search: { archived: false },
  },
  {
    key: "go:resumes",
    group: "Go to",
    label: "Resumes",
    icon: "resume",
    to: "/resumes",
    search: { archived: "exclude" },
  },
  { key: "go:data", group: "Go to", label: "Your data", icon: "data", to: "/data" },
];

const ACTIONS: readonly PaletteItem[] = [
  { key: "do:record", group: "Create", label: "New record", icon: "add", to: "/records/new" },
  {
    key: "do:point",
    group: "Create",
    label: "New point",
    icon: "add",
    to: "/points/new",
    search: {},
  },
];

function matches(item: PaletteItem, query: string): boolean {
  return item.label.toLowerCase().includes(query);
}

function hitItem(row: SearchRow): PaletteItem {
  const context = row.context === "" && row.kind !== null ? KIND_NAMES[row.kind] : row.context;

  return {
    key: row.key,
    group: row.subject === "record" ? "Records" : "Points",
    label: row.title,
    ...(context === "" ? {} : { context }),
    icon: row.subject,
    ...(row.subject === "record"
      ? { to: "/records/$recordId", params: { recordId: row.id } }
      : { to: "/points/$pointId/edit", params: { pointId: row.id } }),
  };
}

// The palette shows only the first few of each subject, so this is the way to
// the whole list, and the only way to reach an archived hit.
function everythingItem(query: string, matched: number): PaletteItem {
  return {
    key: "go:search",
    group: "Search",
    label: `Search for "${query}"`,
    context: `${String(matched)} ${matched === 1 ? "match" : "matches"}`,
    icon: "search",
    to: "/search",
    search: { q: query },
  };
}

// The same `search(store, query)` the search screen reads, so the palette can
// never disagree with the page it links to (application-structure.md #6).
export function paletteItems(store: Store, query: string): PaletteItem[] {
  const trimmed = query.trim();
  const folded = trimmed.toLowerCase();
  const fixed = [...ACTIONS, ...DESTINATIONS].filter(
    (item) => folded === "" || matches(item, folded),
  );

  if (folded === "") return fixed;

  const hits = searchRows(store, { q: query, archived: false });
  const found = (["record", "point"] as const).flatMap((subject) =>
    hits
      .filter((hit) => hit.subject === subject)
      .slice(0, PER_SUBJECT)
      .map(hitItem),
  );

  return [everythingItem(trimmed, hits.length), ...found, ...fixed];
}
