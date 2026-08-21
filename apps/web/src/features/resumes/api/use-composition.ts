import type {
  ResumeContactChannel,
  ResumeEntry,
  ResumeEntryInput,
  ResumeEntryPatch,
  ResumeEntryPoint,
  ResumeEntryPointInput,
  ResumeEntryPointPatch,
  ResumeSection,
  ResumeSectionInput,
  ResumeSectionPatch,
  Store,
  Uuid,
} from "@keepcv/schema";
import {
  resumeContactChannelSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSectionSchema,
} from "@keepcv/schema";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { now, useStoreMutation } from "../../../lib/store-cache.js";

// The three levels of a composition are written the same way, so they share
// these hooks rather than each having its own set of six.
export type Placed =
  | { level: "section"; row: ResumeSection }
  | { level: "entry"; row: ResumeEntry }
  | { level: "point"; row: ResumeEntryPoint };

function replace<T extends { id: Uuid }>(rows: readonly T[], row: T): T[] {
  return rows.some((existing) => existing.id === row.id)
    ? rows.map((existing) => (existing.id === row.id ? row : existing))
    : [...rows, row];
}

// Also the settle: a composition write answers with the row it wrote, so the
// boot payload takes that rather than being read again (application-structure.md #4).
function writeInto(store: Store, placed: Placed): Store {
  switch (placed.level) {
    case "section":
      return { ...store, resumeSections: replace(store.resumeSections, placed.row) };
    case "entry":
      return { ...store, resumeEntries: replace(store.resumeEntries, placed.row) };
    case "point":
      return { ...store, resumeEntryPoints: replace(store.resumeEntryPoints, placed.row) };
  }
}

export type AddComposition =
  | { level: "section"; input: ResumeSectionInput }
  | { level: "entry"; input: ResumeEntryInput }
  | { level: "point"; input: ResumeEntryPointInput };

export function useAddComposed(client: ApiClient) {
  return useStoreMutation<AddComposition, Placed>({
    send: async (variables) => {
      switch (variables.level) {
        case "section":
          return {
            level: "section",
            row: resumeSectionSchema.parse(
              await unwrap(await client.v1["resume-sections"].$post({ json: variables.input })),
            ),
          };
        case "entry":
          return {
            level: "entry",
            row: resumeEntrySchema.parse(
              await unwrap(await client.v1["resume-entries"].$post({ json: variables.input })),
            ),
          };
        case "point":
          return {
            level: "point",
            row: resumeEntryPointSchema.parse(
              await unwrap(await client.v1["resume-entry-points"].$post({ json: variables.input })),
            ),
          };
      }
    },
    optimistic: (store, variables) => writeInto(store, guessAdded(variables)),
    settle: writeInto,
  });
}

function guessAdded(variables: AddComposition): Placed {
  const at = now();
  const standard = { createdAt: at, updatedAt: at, archivedAt: null };
  switch (variables.level) {
    case "section":
      return { level: "section", row: { ...variables.input, ...standard } };
    case "entry":
      return { level: "entry", row: { ...variables.input, ...standard } };
    case "point":
      return { level: "point", row: { ...variables.input, ...standard } };
  }
}

export type PatchComposition =
  | { level: "section"; row: ResumeSection; patch: ResumeSectionPatch }
  | { level: "entry"; row: ResumeEntry; patch: ResumeEntryPatch }
  | { level: "point"; row: ResumeEntryPoint; patch: ResumeEntryPointPatch };

export function usePatchComposed(client: ApiClient) {
  return useStoreMutation<PatchComposition, Placed>({
    send: async (variables) => {
      const param = { id: variables.row.id };
      const expectedUpdatedAt = variables.row.updatedAt;
      switch (variables.level) {
        case "section":
          return {
            level: "section",
            row: resumeSectionSchema.parse(
              await unwrap(
                await client.v1["resume-sections"][":id"].$patch({
                  param,
                  json: { expectedUpdatedAt, patch: variables.patch },
                }),
              ),
            ),
          };
        case "entry":
          return {
            level: "entry",
            row: resumeEntrySchema.parse(
              await unwrap(
                await client.v1["resume-entries"][":id"].$patch({
                  param,
                  json: { expectedUpdatedAt, patch: variables.patch },
                }),
              ),
            ),
          };
        case "point":
          return {
            level: "point",
            row: resumeEntryPointSchema.parse(
              await unwrap(
                await client.v1["resume-entry-points"][":id"].$patch({
                  param,
                  json: { expectedUpdatedAt, patch: variables.patch },
                }),
              ),
            ),
          };
      }
    },
    optimistic: (store, variables) => {
      const updatedAt = now();
      switch (variables.level) {
        case "section":
          return writeInto(store, {
            level: "section",
            row: resumeSectionSchema.parse({ ...variables.row, ...variables.patch, updatedAt }),
          });
        case "entry":
          return writeInto(store, {
            level: "entry",
            row: resumeEntrySchema.parse({ ...variables.row, ...variables.patch, updatedAt }),
          });
        case "point":
          return writeInto(store, {
            level: "point",
            row: resumeEntryPointSchema.parse({ ...variables.row, ...variables.patch, updatedAt }),
          });
      }
    },
    settle: writeInto,
  });
}

export type SetComposedArchived = Placed & { archived: boolean };

// Removing from a resume is archiving the row, so what was chosen and where it
// sat both survive being taken off.
export function useSetComposedArchived(client: ApiClient) {
  return useStoreMutation<SetComposedArchived, Placed>({
    send: async (variables) => {
      const param = { id: variables.row.id };
      const json = { expectedUpdatedAt: variables.row.updatedAt };
      switch (variables.level) {
        case "section": {
          const of = client.v1["resume-sections"][":id"];
          const response = variables.archived
            ? await of.$delete({ param, json })
            : await of.restore.$post({ param, json });
          return { level: "section", row: resumeSectionSchema.parse(await unwrap(response)) };
        }
        case "entry": {
          const of = client.v1["resume-entries"][":id"];
          const response = variables.archived
            ? await of.$delete({ param, json })
            : await of.restore.$post({ param, json });
          return { level: "entry", row: resumeEntrySchema.parse(await unwrap(response)) };
        }
        case "point": {
          const of = client.v1["resume-entry-points"][":id"];
          const response = variables.archived
            ? await of.$delete({ param, json })
            : await of.restore.$post({ param, json });
          return { level: "point", row: resumeEntryPointSchema.parse(await unwrap(response)) };
        }
      }
    },
    optimistic: (store, variables) => {
      const at = now();
      const changed = { archivedAt: variables.archived ? at : null, updatedAt: at };
      switch (variables.level) {
        case "section":
          return writeInto(store, { level: "section", row: { ...variables.row, ...changed } });
        case "entry":
          return writeInto(store, { level: "entry", row: { ...variables.row, ...changed } });
        case "point":
          return writeInto(store, { level: "point", row: { ...variables.row, ...changed } });
      }
    },
    settle: writeInto,
  });
}

export interface SetContactVisibility {
  resumeId: Uuid;
  contactChannelId: Uuid;
  // `null` reverts to the channel's own default rather than hiding it.
  isVisible: boolean | null;
}

function withOverride(
  store: Store,
  pair: Pick<ResumeContactChannel, "resumeId" | "contactChannelId">,
  override: ResumeContactChannel | null,
): Store {
  const others = store.resumeContactChannels.filter(
    (row) => row.resumeId !== pair.resumeId || row.contactChannelId !== pair.contactChannelId,
  );
  return {
    ...store,
    resumeContactChannels: override === null ? others : [...others, override],
  };
}

export function useSetContactVisibility(client: ApiClient) {
  return useStoreMutation<SetContactVisibility, ResumeContactChannel | null>({
    send: async ({ resumeId, contactChannelId, isVisible }) => {
      const of = client.v1.resumes[":id"]["contact-channels"][":contactChannelId"];
      const param = { id: resumeId, contactChannelId };
      if (isVisible === null) {
        await unwrap(await of.$delete({ param }));
        return null;
      }
      return resumeContactChannelSchema.parse(
        await unwrap(await of.$put({ param, json: { isVisible } })),
      );
    },
    optimistic: (store, variables) =>
      withOverride(
        store,
        variables,
        variables.isVisible === null ? null : { ...variables, isVisible: variables.isVisible },
      ),
    settle: (store, result) => (result === null ? store : withOverride(store, result, result)),
  });
}
