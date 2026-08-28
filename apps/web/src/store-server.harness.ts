import {
  captureManifest,
  contentHash,
  derivePlan,
  deriveRevision,
  diffManifests,
  importPlan,
  type JsonValue,
  newUuid,
  type PlanChange,
  renderManifest,
  roleProfileAdds,
  roleProfilePlan,
  tagSlug,
} from "@keepcv/core";
import type { ResumeSnapshot, ResumeVersion, Store, Uuid, VersionTrigger } from "@keepcv/schema";
import {
  CURRENT_SCHEMA_VERSION,
  careerRecordSchema,
  contactChannelSchema,
  customSectionSchema,
  draftSchema,
  evidenceSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  pointTagSchema,
  profileSchema,
  recordFieldSchema,
  recordLinkSchema,
  recordTagSchema,
  resumeContactChannelSchema,
  resumeEntryPointSchema,
  resumeEntrySchema,
  resumeSchema,
  resumeSectionSchema,
  resumeSnapshotSchema,
  resumeVersionSchema,
  richTextSchema,
  roleProfileSchema,
  roleProfileTagSchema,
  savedFilterSchema,
  tagSchema,
} from "@keepcv/schema";

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

export function jsonOf(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });
}

function stamp(body: unknown, at: string) {
  return { ...(body as object), createdAt: at, updatedAt: at, archivedAt: null };
}

function revisionOf(phrasingId: string, body: unknown, at: string) {
  return phrasingRevisionSchema.parse({
    id: newUuid(),
    createdAt: at,
    phrasingId,
    ...deriveRevision(richTextSchema.parse(body)),
  });
}

// Points and phrasings are not here: creating either writes a revision too. A
// tag is, because the slug it derives is the only thing this stub adds.
const CREATABLE: Record<string, (store: Store, row: object) => void> = {
  "/v1/organisations": (store, row) => store.organisations.push(organisationSchema.parse(row)),
  "/v1/contact-channels": (store, row) =>
    store.contactChannels.push(contactChannelSchema.parse(row)),
  "/v1/records": (store, row) => store.records.push(careerRecordSchema.parse(row)),
  "/v1/resumes": (store, row) => store.resumes.push(resumeSchema.parse(row)),
  "/v1/metrics": (store, row) => store.metrics.push(metricSchema.parse(row)),
  "/v1/resume-sections": (store, row) => store.resumeSections.push(resumeSectionSchema.parse(row)),
  "/v1/resume-entries": (store, row) => store.resumeEntries.push(resumeEntrySchema.parse(row)),
  "/v1/resume-entry-points": (store, row) =>
    store.resumeEntryPoints.push(resumeEntryPointSchema.parse(row)),
  "/v1/evidence": (store, row) => store.evidence.push(evidenceSchema.parse(row)),
  "/v1/record-links": (store, row) => store.recordLinks.push(recordLinkSchema.parse(row)),
  "/v1/record-fields": (store, row) => store.recordFields.push(recordFieldSchema.parse(row)),
  "/v1/custom-sections": (store, row) => store.customSections.push(customSectionSchema.parse(row)),
  "/v1/saved-filters": (store, row) => store.savedFilters.push(savedFilterSchema.parse(row)),
  "/v1/role-profiles": (store, row) => store.roleProfiles.push(roleProfileSchema.parse(row)),
  "/v1/tags": (store, row) => {
    const { label } = row as { label: string };
    store.tags.push(tagSchema.parse({ ...row, slug: tagSlug(label) }));
  },
};

function createRow(store: Store, path: string, body: unknown, at: string): Response | undefined {
  const create = CREATABLE[path];
  if (create === undefined) return undefined;

  const row = stamp(body, at);
  create(store, row);
  return jsonOf(row, 201);
}

function createPhrasing(store: Store, body: unknown, at: string): Response {
  const { body: text, ...columns } = body as { id: string; body: unknown };
  const revision = revisionOf(columns.id, text, at);
  const row = phrasingSchema.parse({ ...stamp(columns, at), currentRevisionId: revision.id });

  store.phrasings.push(row);
  store.phrasingRevisions.push(revision);
  return jsonOf(row, 201);
}

// A set with its first wording, which is how a profile summary is started.
function createPhrasingSet(store: Store, body: unknown, at: string): Response {
  const { phrasing, ...columns } = body as {
    id: string;
    purpose: string;
    phrasing: { id: string; body: unknown };
  };
  const revision = revisionOf(phrasing.id, phrasing.body, at);

  store.phrasings.push(
    phrasingSchema.parse({
      ...stamp(phrasing, at),
      phrasingSetId: columns.id,
      currentRevisionId: revision.id,
    }),
  );
  store.phrasingRevisions.push(revision);

  const row = phrasingSetSchema.parse({
    ...stamp({ id: columns.id }, at),
    purpose: columns.purpose,
    canonicalPhrasingId: phrasing.id,
  });
  store.phrasingSets.push(row);
  return jsonOf(row, 201);
}

function createPoint(store: Store, body: unknown, at: string): Response {
  const { phrasing, ...columns } = body as {
    phrasingSetId: string;
    phrasing: { id: string; body: unknown };
  };
  const revision = revisionOf(phrasing.id, phrasing.body, at);

  store.phrasings.push(
    phrasingSchema.parse({
      ...stamp(phrasing, at),
      phrasingSetId: columns.phrasingSetId,
      currentRevisionId: revision.id,
    }),
  );
  store.phrasingSets.push(
    phrasingSetSchema.parse({
      ...stamp({ id: columns.phrasingSetId }, at),
      purpose: "point",
      canonicalPhrasingId: phrasing.id,
    }),
  );
  store.phrasingRevisions.push(revision);

  const row = pointSchema.parse(stamp(columns, at));
  store.points.push(row);
  return jsonOf(row, 201);
}

// Appended and the pointer moved, exactly as the store does it.
function addRevision(store: Store, path: string, body: unknown, at: string): Response {
  const phrasingId = /^\/v1\/phrasings\/([^/]+)\/revisions/.exec(path)?.[1];
  const index = store.phrasings.findIndex((row) => row.id === phrasingId);
  const phrasing = store.phrasings[index];
  if (phrasing === undefined) return jsonOf({ status: 404 }, 404);

  const revision = revisionOf(phrasing.id, (body as { body: unknown }).body, at);
  store.phrasingRevisions.push(revision);
  store.phrasings.splice(index, 1, { ...phrasing, currentRevisionId: revision.id });
  return jsonOf(revision, 201);
}

function amendIn<T extends { id: string }>(
  rows: T[],
  id: string | undefined,
  patch: object,
  parse: (value: unknown) => T,
): Response {
  const index = rows.findIndex((row) => row.id === id);
  const found = rows[index];
  if (found === undefined) return jsonOf({ status: 404 }, 404);

  const row = parse({ ...found, ...patch });
  rows.splice(index, 1, row);
  return jsonOf(row);
}

// A plan's changes, applied where the route would: the row is put back and made
// visible in one write, which is what `applyChange` does server-side.
function amendAll<T extends { id: string }>(
  rows: T[],
  changes: readonly PlanChange<object>[],
  at: string,
  parse: (value: unknown) => T,
): void {
  for (const change of changes) {
    const index = rows.findIndex((row) => row.id === change.id);
    const found = rows[index];
    if (found === undefined) continue;
    rows.splice(
      index,
      1,
      parse({
        ...found,
        ...(change.unarchive ? { archivedAt: null } : {}),
        ...change.patch,
        updatedAt: at,
      }),
    );
  }
}

interface Amendable {
  rows: { id: string }[];
  parse: (value: unknown) => { id: string };
}

const AMENDABLE: Record<string, (store: Store) => Amendable> = {
  points: (store) => ({ rows: store.points, parse: (v) => pointSchema.parse(v) }),
  metrics: (store) => ({ rows: store.metrics, parse: (v) => metricSchema.parse(v) }),
  phrasings: (store) => ({ rows: store.phrasings, parse: (v) => phrasingSchema.parse(v) }),
  "phrasing-sets": (store) => ({
    rows: store.phrasingSets,
    parse: (v) => phrasingSetSchema.parse(v),
  }),
  resumes: (store) => ({ rows: store.resumes, parse: (v) => resumeSchema.parse(v) }),
  "resume-sections": (store) => ({
    rows: store.resumeSections,
    parse: (v) => resumeSectionSchema.parse(v),
  }),
  "resume-entries": (store) => ({
    rows: store.resumeEntries,
    parse: (v) => resumeEntrySchema.parse(v),
  }),
  "resume-entry-points": (store) => ({
    rows: store.resumeEntryPoints,
    parse: (v) => resumeEntryPointSchema.parse(v),
  }),
  records: (store) => ({ rows: store.records, parse: (v) => careerRecordSchema.parse(v) }),
  evidence: (store) => ({ rows: store.evidence, parse: (v) => evidenceSchema.parse(v) }),
  "record-links": (store) => ({ rows: store.recordLinks, parse: (v) => recordLinkSchema.parse(v) }),
  "record-fields": (store) => ({
    rows: store.recordFields,
    parse: (v) => recordFieldSchema.parse(v),
  }),
  "custom-sections": (store) => ({
    rows: store.customSections,
    parse: (v) => customSectionSchema.parse(v),
  }),
  "saved-filters": (store) => ({
    rows: store.savedFilters,
    parse: (v) => savedFilterSchema.parse(v),
  }),
  "role-profiles": (store) => ({
    rows: store.roleProfiles,
    parse: (v) => roleProfileSchema.parse(v),
  }),
  "contact-channels": (store) => ({
    rows: store.contactChannels,
    parse: (v) => contactChannelSchema.parse(v),
  }),
  tags: (store) => ({ rows: store.tags, parse: (v) => tagSchema.parse(v) }),
};

function amend(store: Store, { method, path, body }: Call, at: string): Response {
  const [, collection, id] = /^\/v1\/([^/]+)\/([^/]+)/.exec(path) ?? [];
  const patch =
    method === "DELETE"
      ? { archivedAt: at }
      : path.endsWith("/restore")
        ? { archivedAt: null }
        : (body as { patch: object }).patch;
  const merged = { ...patch, updatedAt: at };

  const target = AMENDABLE[collection ?? ""];
  // Named rather than defaulted: a path this stub has never heard of used to
  // amend a record, so a typo in a test passed while writing to the wrong table.
  if (target === undefined) {
    throw new Error(`the store stub has no collection ${String(collection)}`);
  }

  const { label } = merged as { label?: string };
  const withSlug =
    collection === "tags" && label !== undefined ? { ...merged, slug: tagSlug(label) } : merged;

  const { rows, parse } = target(store);
  return amendIn(rows, id, withSlug, parse);
}

// The pair is the whole row: putting it twice is the same answer, and taking it
// off destroys nothing at either end.
function onAssignment<T extends { tagId: string }>(
  rows: T[],
  row: T,
  method: string,
  carrierOf: (held: T) => string,
): Response {
  const index = rows.findIndex(
    (held) => held.tagId === row.tagId && carrierOf(held) === carrierOf(row),
  );

  if (method === "DELETE") {
    if (index >= 0) rows.splice(index, 1);
    return new Response(null, { status: 204 });
  }
  if (index < 0) rows.push(row);
  return jsonOf(row);
}

// Everything carrying the tag moves across and the tag is archived; a row that
// already carried both keeps the one it had.
function onMerge(store: Store, id: string, intoTagId: string, at: string): Response {
  const moved = <T extends { tagId: string }>(rows: T[], carrierOf: (row: T) => string): T[] => {
    const already = new Set(rows.filter((row) => row.tagId === intoTagId).map(carrierOf));
    return rows.flatMap((row) => {
      if (row.tagId !== id) return [row];
      return already.has(carrierOf(row)) ? [] : [{ ...row, tagId: intoTagId }];
    });
  };

  store.recordTags = moved(store.recordTags, (row) => row.recordId);
  store.pointTags = moved(store.pointTags, (row) => row.pointId);
  return amendIn(store.tags, id, { archivedAt: at, updatedAt: at }, (value) =>
    tagSchema.parse(value),
  );
}

const DRAFT = /^\/v1\/drafts\/([^/]+)\/([^/]+)\/([^/]+)$/;
const RECORD_TAG = /^\/v1\/records\/([^/]+)\/tags\/([^/]+)$/;
const POINT_TAG = /^\/v1\/points\/([^/]+)\/tags\/([^/]+)$/;
const MERGE = /^\/v1\/tags\/([^/]+)\/merge$/;
const PROFILE_TAG = /^\/v1\/role-profiles\/([^/]+)\/tags\/([^/]+)$/;
const APPLY_PROFILE = /^\/v1\/role-profiles\/([^/]+)\/apply$/;
const REVISIONS = /^\/v1\/phrasings\/([^/]+)\/revisions$/;
const RESTORE = /^\/v1\/resume-versions\/([^/]+)\/restore$/;
const DERIVE = /^\/v1\/resumes\/([^/]+)\/derive$/;
const VERSION_DOCUMENT = /^\/v1\/resume-versions\/([^/]+)\/document$/;
const CONTACT = /^\/v1\/resumes\/([^/]+)\/contact-channels\/([^/]+)$/;

interface CaptureInput {
  id: Uuid;
  resumeId: Uuid;
  trigger: VersionTrigger;
  restoredFromVersionId: Uuid | null;
}

// Versions are not in the boot payload, so the stub keeps them beside it. The
// manifest is captured here for the reason the store captures it: a version
// records what the resume said, which no client can assert. Answers the current
// version unchanged, exactly as the store does, unless it is a restore.
function appendVersion(
  versions: ResumeVersion[],
  store: Store,
  input: CaptureInput,
  at: string,
): ResumeVersion | undefined {
  const manifest = captureManifest(store, input.resumeId);
  if (manifest === undefined) return undefined;

  const manifestHash = contentHash(manifest as unknown as JsonValue);
  const current = versions.filter((row) => row.resumeId === input.resumeId).at(-1);
  if (current?.manifestHash === manifestHash && input.restoredFromVersionId === null) {
    return current;
  }

  const version = resumeVersionSchema.parse({
    ...input,
    createdAt: at,
    seq: (current?.seq ?? 0) + 1,
    restoredFromVersionId: input.restoredFromVersionId ?? null,
    manifest,
    manifestHash,
  });
  versions.push(version);
  return version;
}

// Addressed by what it drafts, so saving twice replaces rather than appends.
function onDraft(store: Store, target: RegExpExecArray, call: Call, at: string): Response {
  const [, targetKind, targetId, field] = target;
  const index = store.drafts.findIndex(
    (row) => row.targetKind === targetKind && row.targetId === targetId && row.field === field,
  );

  if (call.method === "DELETE") {
    if (index >= 0) store.drafts.splice(index, 1);
    return new Response(null, { status: 204 });
  }

  const draft = draftSchema.parse({
    targetKind,
    targetId,
    field,
    createdAt: at,
    updatedAt: at,
    ...(call.body as object),
  });
  store.drafts.splice(index >= 0 ? index : store.drafts.length, index >= 0 ? 1 : 0, draft);
  return jsonOf(draft);
}

export interface Archive {
  versions: ResumeVersion[];
  snapshots: ResumeSnapshot[];
}

// Everything but a phrasing's history and a resume's is in the boot payload.
function read(store: Store, archive: Archive, url: URL): Response {
  const { versions, snapshots } = archive;
  const revisions = REVISIONS.exec(url.pathname);
  if (revisions !== null) {
    return jsonOf({
      items: store.phrasingRevisions.filter((row) => row.phrasingId === revisions[1]),
    });
  }

  if (url.pathname === "/v1/resume-versions/diff") {
    const a = versions.find((row) => row.id === url.searchParams.get("a"));
    const b = versions.find((row) => row.id === url.searchParams.get("b"));
    if (a === undefined || b === undefined) return jsonOf({ status: 404 }, 404);
    return jsonOf(diffManifests(a.manifest, b.manifest, store.phrasingRevisions));
  }

  const compiling = VERSION_DOCUMENT.exec(url.pathname);
  if (compiling !== null) {
    const version = versions.find((row) => row.id === compiling[1]);
    if (version === undefined) return jsonOf({ status: 404 }, 404);
    return jsonOf(
      renderManifest(version.manifest, store.phrasingRevisions, {
        generatedAt: new Date().toISOString(),
      }),
    );
  }

  if (url.pathname === "/v1/resume-versions") {
    const resumeId = url.searchParams.get("resumeId");
    return jsonOf({
      items: versions.filter((row) => resumeId === null || row.resumeId === resumeId),
    });
  }

  if (url.pathname === "/v1/resume-snapshots") {
    const of = new Set(
      versions
        .filter((row) => row.resumeId === url.searchParams.get("resumeId"))
        .map((row) => row.id),
    );
    return jsonOf({
      items: snapshots.filter((row) => row.archivedAt === null && of.has(row.resumeVersionId)),
    });
  }

  // The archive rather than the boot payload: an export carries history too.
  if (url.pathname === "/v1/export") {
    return jsonOf({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      store: { ...store, resumeVersions: versions, resumeSnapshots: snapshots },
    });
  }

  return jsonOf(store);
}

// The composition rewrite a restore performs is the store's, and it is tested
// there; what the app answers for is the request and the re-read that follows.
function onVersion(versions: ResumeVersion[], store: Store, call: Call, at: string): Response {
  const restoring = RESTORE.exec(call.path);
  if (restoring === null) {
    const version = appendVersion(versions, store, call.body as CaptureInput, at);
    return version === undefined ? jsonOf({ status: 404 }, 404) : jsonOf(version, 201);
  }

  const source = versions.find((row) => row.id === restoring[1]);
  if (source === undefined) return jsonOf({ status: 404 }, 404);
  const version = appendVersion(
    versions,
    store,
    {
      ...(call.body as { id: Uuid }),
      resumeId: source.resumeId,
      trigger: "restore",
      restoredFromVersionId: source.id,
    },
    at,
  );
  return version === undefined
    ? jsonOf({ status: 404 }, 404)
    : jsonOf({ version, omissions: [] }, 201);
}

// An override keyed by the pair, so setting it twice replaces rather than appends.
function onContactChannel(store: Store, pair: RegExpExecArray, call: Call): Response {
  const [, resumeId, contactChannelId] = pair;
  const index = store.resumeContactChannels.findIndex(
    (row) => row.resumeId === resumeId && row.contactChannelId === contactChannelId,
  );

  if (call.method === "DELETE") {
    if (index >= 0) store.resumeContactChannels.splice(index, 1);
    return new Response(null, { status: 204 });
  }

  const override = resumeContactChannelSchema.parse({
    resumeId,
    contactChannelId,
    ...(call.body as object),
  });
  store.resumeContactChannels.splice(
    index >= 0 ? index : store.resumeContactChannels.length,
    index >= 0 ? 1 : 0,
    override,
  );
  return jsonOf(override);
}

// A version the user named, which is an ordinary owned row: unstarring archives.
function onSnapshot(snapshots: ResumeSnapshot[], call: Call, at: string): Response {
  if (call.path === "/v1/resume-snapshots") {
    const row = resumeSnapshotSchema.parse({ ...stamp(call.body, at), starredAt: at });
    snapshots.push(row);
    return jsonOf(row, 201);
  }
  return amendIn(
    snapshots,
    /^\/v1\/resume-snapshots\/([^/]+)/.exec(call.path)?.[1],
    { archivedAt: call.method === "DELETE" ? at : null, updatedAt: at },
    (value) => resumeSnapshotSchema.parse(value),
  );
}

// The plan is the store's, as it is in the API: what the app answers for is the
// request it sent and the re-read that follows.
function onDerive(store: Store, from: RegExpExecArray, call: Call, at: string): Response {
  const plan = derivePlan(store, (from[1] ?? "") as Uuid, call.body as { id: Uuid; name: string });
  if (plan === undefined) return jsonOf({ status: 404 }, 404);

  const resume = resumeSchema.parse(stamp(plan.resume, at));
  store.resumes.push(resume);
  for (const row of plan.sections) {
    store.resumeSections.push(resumeSectionSchema.parse(stamp(row, at)));
  }
  for (const row of plan.entries) {
    store.resumeEntries.push(resumeEntrySchema.parse(stamp(row, at)));
  }
  for (const row of plan.entryPoints) {
    store.resumeEntryPoints.push(resumeEntryPointSchema.parse(stamp(row, at)));
  }
  store.resumeContactChannels.push(...plan.contacts);
  return jsonOf(resume, 201);
}

// All or nothing, and only into a store nothing has been written to yet.
function onImport(store: Store, call: Call): Response {
  if (store.records.length > 0 || store.resumes.length > 0) {
    return jsonOf(
      {
        type: "https://keepcv.app/problems/conflict",
        title: "Conflict",
        status: 409,
        detail: "The store already holds something.",
        instance: "/v1/import",
      },
      409,
    );
  }
  Object.assign(store, (call.body as { store: Store }).store);
  return new Response(null, { status: 204 });
}

function onTagAssignment(store: Store, call: Call): Response | undefined {
  const onRecord = RECORD_TAG.exec(call.path);
  if (onRecord !== null) {
    return onAssignment(
      store.recordTags,
      recordTagSchema.parse({ recordId: onRecord[1], tagId: onRecord[2] }),
      call.method,
      (row) => row.recordId,
    );
  }

  const onPoint = POINT_TAG.exec(call.path);
  if (onPoint !== null) {
    return onAssignment(
      store.pointTags,
      pointTagSchema.parse({ pointId: onPoint[1], tagId: onPoint[2] }),
      call.method,
      (row) => row.pointId,
    );
  }

  const onProfile = PROFILE_TAG.exec(call.path);
  if (onProfile !== null) {
    return onAssignment(
      store.roleProfileTags,
      roleProfileTagSchema.parse({ roleProfileId: onProfile[1], tagId: onProfile[2] }),
      call.method,
      (row) => row.roleProfileId,
    );
  }

  return undefined;
}

// The planner the route runs, for the reason deriving and importing run theirs:
// a screen test must not pass against a plan the server would not have made.
function onApplyProfile(store: Store, from: RegExpExecArray, call: Call, at: string): Response {
  const plan = roleProfilePlan(
    store,
    (call.body as { resumeId: Uuid }).resumeId,
    (from[1] ?? "") as Uuid,
  );
  if (plan === undefined) return jsonOf({ status: 404 }, 404);

  for (const row of plan.addSections) {
    store.resumeSections.push(resumeSectionSchema.parse(stamp(row, at)));
  }
  for (const row of plan.addEntries) {
    store.resumeEntries.push(resumeEntrySchema.parse(stamp(row, at)));
  }
  for (const row of plan.addEntryPoints) {
    store.resumeEntryPoints.push(resumeEntryPointSchema.parse(stamp(row, at)));
  }
  amendAll(store.resumeSections, plan.sections, at, (v) => resumeSectionSchema.parse(v));
  amendAll(store.resumeEntries, plan.entries, at, (v) => resumeEntrySchema.parse(v));
  amendAll(store.resumeEntryPoints, plan.entryPoints, at, (v) => resumeEntryPointSchema.parse(v));

  return jsonOf(roleProfileAdds(plan), 201);
}

// The planner the route runs, so a screen test cannot pass against a plan the
// server would not have made.
function onIntake(store: Store, call: Call): Response {
  const { intake, decisions } = call.body as {
    intake: Parameters<typeof importPlan>[1];
    decisions: Parameters<typeof importPlan>[2];
  };
  const plan = importPlan(store, intake, decisions);
  return jsonOf({
    organisations: plan.organisations.length,
    customSections: plan.customSections.length,
    contactChannels: plan.contactChannels.length,
    records: plan.records.length,
    points: plan.points.length,
    tags: plan.tags.length,
  });
}

// The routes a path pattern picks out, rather than a collection name.
function onPattern(store: Store, archive: Archive, call: Call, at: string): Response | undefined {
  const target = DRAFT.exec(call.path);
  if (target !== null) return onDraft(store, target, call, at);
  const pair = CONTACT.exec(call.path);
  if (pair !== null) return onContactChannel(store, pair, call);

  const tagged = onTagAssignment(store, call);
  if (tagged !== undefined) return tagged;
  const merging = MERGE.exec(call.path);
  if (merging !== null) {
    return onMerge(store, merging[1] ?? "", (call.body as { intoTagId: string }).intoTagId, at);
  }

  const deriving = DERIVE.exec(call.path);
  if (deriving !== null) return onDerive(store, deriving, call, at);
  const applying = APPLY_PROFILE.exec(call.path);
  if (applying !== null) return onApplyProfile(store, applying, call, at);

  if (call.path === "/v1/import") return onImport(store, call);
  if (call.path === "/v1/intake") return onIntake(store, call);
  if (call.path.startsWith("/v1/resume-snapshots")) return onSnapshot(archive.snapshots, call, at);
  if (call.path.startsWith("/v1/resume-versions")) {
    return onVersion(archive.versions, store, call, at);
  }
  return undefined;
}

function write(store: Store, archive: Archive, call: Call, at: string): Response {
  const matched = onPattern(store, archive, call, at);
  if (matched !== undefined) return matched;

  // One per owner, so it is patched at a path with no id in it.
  if (call.path === "/v1/profile") {
    store.profile = profileSchema.parse({
      ...store.profile,
      ...(call.body as { patch: object }).patch,
      updatedAt: at,
    });
    return jsonOf(store.profile);
  }

  const created = createRow(store, call.path, call.body, at);
  if (created !== undefined) return created;
  if (call.path === "/v1/points") return createPoint(store, call.body, at);
  if (call.path === "/v1/phrasing-sets") return createPhrasingSet(store, call.body, at);
  if (call.path === "/v1/phrasings") return createPhrasing(store, call.body, at);
  if (REVISIONS.test(call.path)) return addRevision(store, call.path, call.body, at);
  return amend(store, call, at);
}

// A stub that writes, so an optimistic row is checked against what comes back
// rather than against itself.
export function storeServer(store: Store, intercept?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const archive: Archive = { versions: [], snapshots: [] };

  function answer(url: string, init?: RequestInit): Response {
    const parsed = new URL(url);
    const call: Call = {
      method: init?.method ?? "GET",
      path: parsed.pathname,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);

    const forced = intercept?.(call);
    if (forced !== undefined) return forced;
    if (call.method === "GET") return read(store, archive, parsed);
    return write(store, archive, call, new Date().toISOString());
  }

  return { answer, calls, ...archive };
}
