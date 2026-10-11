import { bySortKey, live, roleProfileMatch } from "@keepcv/core";
import type { RoleProfile, Store, Tag } from "@keepcv/schema";

export interface RoleProfileRow {
  profile: RoleProfile;
  tags: Tag[];
  records: number;
  points: number;
  isArchived: boolean;
}

export function roleProfileRows(store: Store, archived: boolean): RoleProfileRow[] {
  return [...store.roleProfiles]
    .sort(bySortKey)
    .filter((profile) => (profile.archivedAt !== null) === archived)
    .map((profile) => {
      const match = roleProfileMatch(store, profile.id);
      return {
        profile,
        tags: match?.tags ?? [],
        records: match?.entries.length ?? 0,
        points: match?.points ?? 0,
        isArchived: profile.archivedAt !== null,
      };
    });
}

export function nameError(store: Store, name: string, editing?: RoleProfile): string | undefined {
  const typed = name.trim();
  if (typed === "") return "A role profile needs a name.";
  const clash = live(store.roleProfiles).find(
    (row) => row.id !== editing?.id && row.name.toLowerCase() === typed.toLowerCase(),
  );
  return clash === undefined ? undefined : `${clash.name} already goes by that.`;
}
