import { ConcurrencyConflictError, NotFoundError, newUuid } from "@keepcv/core";
import type { Uuid } from "@keepcv/schema";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runAsOwner } from "./owner-scope.js";
import type { Run } from "./repositories/contract.harness.js";
import { fill } from "./repositories/contract-store.harness.js";
import { openServerStore, type Store } from "./store.js";
import { connectionProxy } from "./testing/connection-proxy.harness.js";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for server recovery tests");

describe.skipIf(connectionString === undefined)("PostgreSQL disconnect recovery", () => {
  let admin: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString });
    const store = openServerStore({ connectionString: connectionString as string });
    try {
      await store.migrate();
    } finally {
      await store.close();
    }
  }, 60_000);
  afterAll(async () => await admin.end());

  function named(name: string): Store {
    const url = new URL(connectionString as string);
    url.searchParams.set("application_name", name);
    return openServerStore({
      connectionString: url.toString(),
      max: 1,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      idleTimeoutMillis: 0,
    });
  }
  const asOwner =
    (store: Store, id: Uuid): Run =>
    (work) =>
      runAsOwner(id, () => store.unitOfWork.run(work));
  async function backend(name: string) {
    const answer = await admin.query<{ pid: number }>(
      "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
      [name],
    );
    const pid = answer.rows[0]?.pid;
    if (pid === undefined) throw new Error("Missing synthetic backend");
    return pid;
  }
  async function terminate(name: string) {
    const pid = await backend(name);
    await admin.query("SELECT pg_terminate_backend($1)", [pid]);
    await expect
      .poll(
        async () =>
          (await admin.query("SELECT pid FROM pg_stat_activity WHERE pid = $1", [pid])).rowCount,
      )
      .toBe(0);
    return pid;
  }

  it("survives repeated idle disconnects silently and reuses a healthy replacement", async () => {
    const id = newUuid();
    const name = `keepcv_disconnect_${id}`;
    const store = named(name);
    const run = asOwner(store, id);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await store.provisionOwner(id);
      const profile = await run((r) => r.profile.get());
      await run((r) => r.profile.update({ fullName: "Authored secret" }, profile.updatedAt));
      const archive = await run((r) => r.store.read());
      for (let index = 0; index < 3; index++) {
        const old = await terminate(name);
        // pg_stat_activity lost the backend before its socket error reached the pool.
        await expect.poll(() => run((r) => r.store.read()), { timeout: 2000 }).toEqual(archive);
        const replacement = await backend(name);
        expect(replacement).not.toBe(old);
        await run((r) => r.profile.get());
        expect(await backend(name)).toBe(replacement);
      }
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      await store.eraseOwner(id, { erasePermanently: true });
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
      await store.close();
    }
  });

  it.each(["between statements", "during statement"])(
    "rejects a checked-out disconnect %s without replay or partial history",
    async (when) => {
      const id = newUuid();
      const name = `keepcv_active_${id}`;
      const store = named(name);
      const run = asOwner(store, id);
      let release: () => void = () => undefined;
      let started: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      let attempts = 0;
      try {
        await store.provisionOwner(id);
        await fill(run);
        const archive = await run((r) => r.store.read());
        const phrasing = archive.phrasings[0];
        if (phrasing === undefined) throw new Error("Fixture has authored history");
        const work = run(async (r) => {
          attempts++;
          await r.phrasings.addRevision(phrasing.id, [{ t: "text", v: "Must roll back" }]);
          started();
          await gate;
          if (when === "during statement") await r.store.read();
        });
        const refused = expect(work).rejects.toThrow(/not queryable|terminated|connection/i);
        await ready;
        if (when === "during statement") {
          const blocker = await admin.connect();
          try {
            await blocker.query("BEGIN");
            await blocker.query("LOCK TABLE tag IN ACCESS EXCLUSIVE MODE");
            release();
            await expect
              .poll(
                async () =>
                  (
                    await admin.query<{ wait_event_type: string }>(
                      "SELECT wait_event_type FROM pg_stat_activity WHERE application_name = $1",
                      [name],
                    )
                  ).rows[0]?.wait_event_type,
              )
              .toBe("Lock");
            await terminate(name);
          } finally {
            await blocker.query("ROLLBACK");
            blocker.release();
          }
        } else {
          await terminate(name);
          release();
        }
        await refused;
        expect(attempts).toBe(1);
        expect(await run((r) => r.store.read())).toEqual(archive);
        await store.eraseOwner(id, { erasePermanently: true });
      } finally {
        release();
        await store.close();
      }
    },
  );

  it("bounds outage refusals and preserves concurrent owners with identical imported ids after reconnect", async () => {
    const proxy = await connectionProxy(connectionString as string);
    const store = openServerStore({
      connectionString: proxy.connectionString,
      max: 2,
      connectionTimeoutMillis: 500,
      statement_timeout: 1000,
    });
    const owners = [newUuid(), newUuid()];
    const first = asOwner(store, owners[0] as Uuid);
    const second = asOwner(store, owners[1] as Uuid);
    try {
      await Promise.all(owners.map((id) => store.provisionOwner(id)));
      await fill(first);
      const archive = await first((r) => r.store.read());
      await second((r) => r.store.load(archive));
      proxy.setAvailable(false);
      await expect(
        store.eraseOwner(
          owners[0] as Uuid,
          { erasePermanently: false } as unknown as { erasePermanently: true },
        ),
      ).rejects.toBeInstanceOf(TypeError);
      const started = Date.now();
      const attempts = await Promise.allSettled([
        first((r) => r.store.read()),
        second((r) => r.store.read()),
        store.provisionOwner(newUuid()),
        store.migrate(),
      ]);
      expect(attempts.every((attempt) => attempt.status === "rejected")).toBe(true);
      expect(Date.now() - started).toBeLessThan(5000);
      proxy.setAvailable(true);
      expect(
        await Promise.all([first((r) => r.store.read()), second((r) => r.store.read())]),
      ).toEqual([archive, archive]);
      const profile = archive.profile;
      await first((r) => r.profile.update({ fullName: "Only first owner" }, profile.updatedAt));
      await expect(
        first((r) => r.profile.update({ fullName: "Stale" }, profile.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
      expect(await second((r) => r.store.read())).toEqual(archive);
      const phrasing = archive.phrasings[0];
      if (phrasing === undefined) throw new Error("Fixture has a phrasing");
      await first((r) =>
        r.phrasings.addRevision(phrasing.id, [{ t: "text", v: "First owner after recovery" }]),
      );
      expect(await second((r) => r.store.read())).toEqual(archive);
      await store.eraseOwner(owners[0] as Uuid, { erasePermanently: true });
      await expect(first((r) => r.profile.get())).rejects.toBeInstanceOf(NotFoundError);
      expect(await second((r) => r.store.read())).toEqual(archive);
      await store.provisionOwner(owners[0] as Uuid);
      expect((await first((r) => r.store.read())).phrasingRevisions).toEqual([]);
      await Promise.all(owners.map((id) => store.eraseOwner(id, { erasePermanently: true })));
      proxy.setAvailable(false);
      const closing = store.close();
      expect(store.close()).toBe(closing);
      await closing;
    } finally {
      await store.close();
      await proxy.close();
    }
  });

  it("drains an active failed connection while closing and shares repeated close", async () => {
    const name = `keepcv_close_${newUuid()}`;
    const store = named(name);
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const work = store.unitOfWork.run(async () => {
      started();
      await gate;
    });
    const refused = expect(work).rejects.toThrow(/not queryable|terminated|connection/i);
    try {
      await ready;
      await terminate(name);
      const closing = store.close();
      expect(store.close()).toBe(closing);
      release();
      await refused;
      await closing;
      await store.close();
      await expect(store.provisionOwner(newUuid())).rejects.toThrow(/after calling end/);
    } finally {
      release();
      await store.close();
    }
  });

  it("rejects a lost COMMIT acknowledgment without replaying committed authored history", async () => {
    const url = new URL(connectionString as string);
    url.searchParams.set("sslmode", "disable");
    const proxy = await connectionProxy(url.toString());
    const store = openServerStore({
      connectionString: proxy.connectionString,
      max: 1,
      connectionTimeoutMillis: 500,
      statement_timeout: 1000,
    });
    const id = newUuid();
    const run = asOwner(store, id);
    let attempts = 0;
    try {
      await store.provisionOwner(id);
      await fill(run);
      const before = await run((r) => r.store.read());
      const phrasing = before.phrasings[0];
      if (phrasing === undefined) throw new Error("Fixture has a phrasing");
      await expect(
        run(async (r) => {
          attempts++;
          await r.phrasings.addRevision(phrasing.id, [
            { t: "text", v: "Committed despite lost acknowledgment" },
          ]);
          proxy.loseNextCommitReply();
        }),
      ).rejects.toThrow(/terminated|connection/i);
      expect(proxy.lostCommitReplies()).toBe(1);
      expect(attempts).toBe(1);
      const after = await run((r) => r.store.read());
      expect(after.phrasingRevisions).toHaveLength(before.phrasingRevisions.length + 1);
      expect(
        after.phrasingRevisions.filter(
          (row) => row.plainText === "Committed despite lost acknowledgment",
        ),
      ).toHaveLength(1);
      for (const revision of before.phrasingRevisions)
        expect(after.phrasingRevisions).toContainEqual(revision);
      await store.eraseOwner(id, { erasePermanently: true });
    } finally {
      await store.close();
      await proxy.close();
    }
  });
});
