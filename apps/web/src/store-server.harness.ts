import {
  captureManifest,
  contentHash,
  deriveRevision,
  diffManifests,
  type JsonValue,
  newUuid,
} from "@keepcv/core";
import type { ResumeVersion, Store, Uuid, VersionTrigger } from "@keepcv/schema";
import {
  careerRecordSchema,
  draftSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
  resumeVersionSchema,
  richTextSchema,
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

// Points and phrasings are not here: creating either writes a revision too.
function createRow(store: Store, path: string, body: unknown, at: string): Response | undefined {
  const row = stamp(body, at);
  if (path === "/v1/organisations") {
    store.organisations.push(organisationSchema.parse(row));
  } else if (path === "/v1/records") {
    store.records.push(careerRecordSchema.parse(row));
  } else if (path === "/v1/metrics") {
    store.metrics.push(metricSchema.parse(row));
  } else {
    return undefined;
  }
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

function amend(store: Store, { method, path, body }: Call, at: string): Response {
  const [, collection, id] = /^\/v1\/([^/]+)\/([^/]+)/.exec(path) ?? [];
  const patch =
    method === "DELETE"
      ? { archivedAt: at }
      : path.endsWith("/restore")
        ? { archivedAt: null }
        : (body as { patch: object }).patch;
  const merged = { ...patch, updatedAt: at };

  if (collection === "points") {
    return amendIn(store.points, id, merged, (value) => pointSchema.parse(value));
  }
  if (collection === "metrics") {
    return amendIn(store.metrics, id, merged, (value) => metricSchema.parse(value));
  }
  if (collection === "phrasings") {
    return amendIn(store.phrasings, id, merged, (value) => phrasingSchema.parse(value));
  }
  if (collection === "phrasing-sets") {
    return amendIn(store.phrasingSets, id, merged, (value) => phrasingSetSchema.parse(value));
  }
  return amendIn(store.records, id, merged, (value) => careerRecordSchema.parse(value));
}

const DRAFT = /^\/v1\/drafts\/([^/]+)\/([^/]+)\/([^/]+)$/;
const REVISIONS = /^\/v1\/phrasings\/([^/]+)\/revisions$/;
const RESTORE = /^\/v1\/resume-versions\/([^/]+)\/restore$/;

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

// Everything but a phrasing's history and a resume's is in the boot payload.
function read(store: Store, versions: ResumeVersion[], url: URL): Response {
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

  if (url.pathname === "/v1/resume-versions") {
    const resumeId = url.searchParams.get("resumeId");
    return jsonOf({
      items: versions.filter((row) => resumeId === null || row.resumeId === resumeId),
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

function write(store: Store, versions: ResumeVersion[], call: Call, at: string): Response {
  const target = DRAFT.exec(call.path);
  if (target !== null) return onDraft(store, target, call, at);
  if (call.path.startsWith("/v1/resume-versions")) return onVersion(versions, store, call, at);

  const created = createRow(store, call.path, call.body, at);
  if (created !== undefined) return created;
  if (call.path === "/v1/points") return createPoint(store, call.body, at);
  if (call.path === "/v1/phrasings") return createPhrasing(store, call.body, at);
  if (REVISIONS.test(call.path)) return addRevision(store, call.path, call.body, at);
  return amend(store, call, at);
}

// A stub that writes, so an optimistic row is checked against what comes back
// rather than against itself.
export function storeServer(store: Store, intercept?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const versions: ResumeVersion[] = [];

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
    if (call.method === "GET") return read(store, versions, parsed);
    return write(store, versions, call, new Date().toISOString());
  }

  return { answer, calls, versions };
}
