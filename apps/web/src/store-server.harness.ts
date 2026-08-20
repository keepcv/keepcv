import { deriveRevision, newUuid } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import {
  careerRecordSchema,
  draftSchema,
  metricSchema,
  organisationSchema,
  phrasingRevisionSchema,
  phrasingSchema,
  phrasingSetSchema,
  pointSchema,
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

// Everything but a phrasing's history is in the boot payload.
function read(store: Store, path: string): Response {
  const revisions = REVISIONS.exec(path);
  if (revisions === null) return jsonOf(store);
  return jsonOf({
    items: store.phrasingRevisions.filter((row) => row.phrasingId === revisions[1]),
  });
}

function write(store: Store, call: Call, at: string): Response {
  const target = DRAFT.exec(call.path);
  if (target !== null) return onDraft(store, target, call, at);

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

  function answer(url: string, init?: RequestInit): Response {
    const call: Call = {
      method: init?.method ?? "GET",
      path: new URL(url).pathname,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);

    const forced = intercept?.(call);
    if (forced !== undefined) return forced;
    if (call.method === "GET") return read(store, call.path);
    return write(store, call, new Date().toISOString());
  }

  return { answer, calls };
}
