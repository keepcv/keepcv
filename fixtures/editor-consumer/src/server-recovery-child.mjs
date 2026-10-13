import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { newUuid } from "@keepcv/core";
import { openServerStore, runAsOwner } from "@keepcv/db";
import { pointInputSchema } from "@keepcv/schema";
import { Pool } from "pg";

const url = new URL(process.env.DATABASE_URL);
const name = `keepcv_installed_${newUuid()}`;
url.searchParams.set("application_name", name);
const store = openServerStore({
  connectionString: url.toString(),
  max: 1,
  connectionTimeoutMillis: 1000,
  statement_timeout: 1000,
  idleTimeoutMillis: 0,
});
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = newUuid();
const run = (work) => runAsOwner(owner, () => store.unitOfWork.run(work));

async function terminate() {
  const backend = await admin.query(
    "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
    [name],
  );
  assert.equal(backend.rowCount, 1);
  const pid = backend.rows[0].pid;
  assert.equal(
    (await admin.query("SELECT pg_terminate_backend($1) AS terminated", [pid])).rows[0].terminated,
    true,
  );
  const until = Date.now() + 2000;
  while (
    (await admin.query("SELECT pid FROM pg_stat_activity WHERE pid = $1", [pid])).rowCount > 0
  ) {
    assert(Date.now() < until, "Synthetic backend did not terminate");
    await setTimeout(10);
  }
}

async function readAfterDisconnect() {
  const until = Date.now() + 2000;
  for (;;) {
    try {
      return await run((r) => r.store.read());
    } catch (error) {
      if (Date.now() >= until) throw error;
      await setTimeout(10);
    }
  }
}

try {
  await store.migrate();
  await store.provisionOwner(owner);
  const point = await run((r) =>
    r.points.create(
      pointInputSchema.parse({
        id: newUuid(),
        phrasingSetId: newUuid(),
        sortKey: "a0",
        confidence: "verified",
        recordId: null,
        occurredOn: null,
        phrasing: {
          id: newUuid(),
          variant: "standard",
          label: null,
          sortKey: "a0",
          body: [{ t: "text", v: "Synthetic authored secret" }],
        },
      }),
    ),
  );
  const before = await run((r) => r.store.read());
  await terminate();
  assert.deepEqual(await readAfterDisconnect(), before);
  let started;
  let release;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  const work = run(async (r) => {
    attempts++;
    await r.phrasings.addRevision(before.phrasings[0].id, [
      { t: "text", v: "Must remain uncommitted" },
    ]);
    started();
    await gate;
  });
  const refused = assert.rejects(work, /connection|terminated|not queryable/i);
  await ready;
  await terminate();
  release();
  await refused;
  assert.equal(attempts, 1);
  assert.deepEqual(await run((r) => r.store.read()), before);
  assert.equal((await run((r) => r.points.get(point.id))).id, point.id);
  await store.eraseOwner(owner, { erasePermanently: true });
} finally {
  const closing = store.close();
  assert.equal(store.close(), closing);
  await closing;
  await admin.end();
}
