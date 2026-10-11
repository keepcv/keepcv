import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { NotFoundError, newUuid } from "@keepcv/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsOwner } from "./owner-scope.js";
import { fill } from "./repositories/contract-store.harness.js";
import { openServerStore, type ServerStoreOptions, type Store } from "./store.js";
import { tlsProxy } from "./testing/tls-proxy.harness.js";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for server configuration tests");

describe("server option validation", () => {
  it.each([
    { max: 0 },
    { max: -1 },
    { max: 1.5 },
    { connectionTimeoutMillis: -1 },
    { idleTimeoutMillis: Number.NaN },
    { statement_timeout: Number.POSITIVE_INFINITY },
  ])("refuses invalid numeric options: %j", (options) => {
    expect(() =>
      openServerStore({ connectionString: "postgres://localhost/test", ...options }),
    ).toThrow(RangeError);
  });
  it.each(["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"])(
    "refuses an SSL option overwritten by %s in the URL",
    (name) => {
      expect(() =>
        openServerStore({ connectionString: `postgres://localhost/test?${name}=ignored`, ssl: {} }),
      ).toThrow(TypeError);
    },
  );
});

describe.skipIf(connectionString === undefined)(
  "PostgreSQL server lifecycle and configuration",
  () => {
    let admin: Pool;
    let store: Store;
    let options: ServerStoreOptions;
    beforeAll(async () => {
      if (connectionString === undefined) throw new Error("Missing server fixture URL");
      options = { connectionString, max: 1, connectionTimeoutMillis: 2000 };
      admin = new Pool({ connectionString });
      store = openServerStore(options);
      await store.migrate();
    }, 60_000);
    afterAll(async () => {
      await store.close();
      await admin.end();
    });

    it("migrates and reruns with one connection and concurrent migrators", async () => {
      const other = openServerStore(options);
      try {
        await Promise.all([store.migrate(), other.migrate()]);
      } finally {
        await other.close();
      }
    });

    it("rolls back failed provisioning and repairs an owner missing its profile", async () => {
      const id = newUuid();
      const suffix = id.replaceAll("-", "");
      const name = `test_provision_${suffix}`;
      await admin.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner_id = '${id}'::uuid THEN RAISE EXCEPTION 'synthetic provisioning refusal' USING ERRCODE = 'P0001'; END IF; RETURN NEW; END $$`,
      );
      await admin.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON profile FOR EACH ROW EXECUTE FUNCTION ${name}()`,
      );
      try {
        await expect(store.provisionOwner(id)).rejects.toMatchObject({ cause: { code: "P0001" } });
        expect((await admin.query("SELECT id FROM owner WHERE id = $1", [id])).rowCount).toBe(0);
        expect(
          (await admin.query("SELECT id FROM profile WHERE owner_id = $1", [id])).rowCount,
        ).toBe(0);
      } finally {
        await admin.query(`DROP TRIGGER ${name} ON profile`);
        await admin.query(`DROP FUNCTION ${name}()`);
      }
      const retrying = openServerStore(options);
      try {
        await Promise.all([store.provisionOwner(id), retrying.provisionOwner(id)]);
      } finally {
        await retrying.close();
      }
      const original = await runAsOwner(id, () => store.unitOfWork.run((r) => r.profile.get()));
      await admin.query("DELETE FROM profile WHERE owner_id = $1", [id]);
      await store.provisionOwner(id);
      const repaired = await runAsOwner(id, () => store.unitOfWork.run((r) => r.profile.get()));
      expect(repaired.id).not.toBe(original.id);
      expect((await admin.query("SELECT id FROM owner WHERE id = $1", [id])).rowCount).toBe(1);
      expect((await admin.query("SELECT id FROM profile WHERE owner_id = $1", [id])).rowCount).toBe(
        1,
      );
      await store.eraseOwner(id, { erasePermanently: true });
    });

    it("rolls back refused erasure and removes every owned table on retry", async () => {
      const id = newUuid();
      const run: import("./repositories/contract.harness.js").Run = (work) =>
        runAsOwner(id, () => store.unitOfWork.run(work));
      await store.provisionOwner(id);
      await fill(run);
      const archive = await run((r) => r.store.read());
      const name = `test_erase_${id.replaceAll("-", "")}`;
      await admin.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.owner_id = '${id}'::uuid THEN RAISE EXCEPTION 'synthetic erasure refusal' USING ERRCODE = 'P0001'; END IF; RETURN OLD; END $$`,
      );
      await admin.query(
        `CREATE TRIGGER ${name} BEFORE DELETE ON tag FOR EACH ROW EXECUTE FUNCTION ${name}()`,
      );
      try {
        await expect(store.eraseOwner(id, { erasePermanently: true })).rejects.toMatchObject({
          cause: { code: "P0001" },
        });
        expect(await run((r) => r.store.read())).toEqual(archive);
      } finally {
        await admin.query(`DROP TRIGGER ${name} ON tag`);
        await admin.query(`DROP FUNCTION ${name}()`);
      }
      await store.eraseOwner(id, { erasePermanently: true });
      expect((await admin.query("SELECT id FROM owner WHERE id = $1", [id])).rowCount).toBe(0);
      const tables = await admin.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'owner_id'",
      );
      expect(tables.rows.length).toBeGreaterThan(0);
      for (const { table_name: table } of tables.rows) {
        const rows = await admin.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM "${table.replaceAll('"', '""')}" WHERE owner_id = $1`,
          [id],
        );
        expect(rows.rows[0]?.count, table).toBe(0);
      }
    });

    it("limits connections, bounds queued acquisition and recovers the pool", async () => {
      const limited = openServerStore({ ...options, connectionTimeoutMillis: 1000 });
      let release: () => void = () => undefined;
      let started: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const held = limited.unitOfWork.run(async () => {
        started();
        await gate;
      });
      try {
        await Promise.race([ready, held]);
        await expect(limited.unitOfWork.run(async () => await Promise.resolve())).rejects.toThrow(
          /timeout exceeded when trying to connect/,
        );
        release();
        await held;
        const id = newUuid();
        await limited.provisionOwner(id);
        await runAsOwner(id, () => limited.unitOfWork.run((r) => r.profile.get()));
        await limited.eraseOwner(id, { erasePermanently: true });
      } finally {
        release();
        await held.finally(() => limited.close());
      }
    });

    it("cancels a blocked statement, rolls back and permits a later retry", async () => {
      const id = newUuid();
      const timed = openServerStore({ ...options, statement_timeout: 1000 });
      const blocker = await admin.connect();
      await store.provisionOwner(id);
      try {
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM owner WHERE id = $1 FOR UPDATE", [id]);
        await expect(timed.eraseOwner(id, { erasePermanently: true })).rejects.toMatchObject({
          cause: { code: "57014" },
        });
        await blocker.query("ROLLBACK");
        await timed.eraseOwner(id, { erasePermanently: true });
        await expect(
          runAsOwner(id, () => timed.unitOfWork.run((r) => r.profile.get())),
        ).rejects.toBeInstanceOf(NotFoundError);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await timed.close();
      }
    });

    it("waits for active work and makes shutdown idempotent", async () => {
      const closingStore = openServerStore(options);
      let release: () => void = () => undefined;
      let started: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const work = closingStore.unitOfWork.run(async () => {
        started();
        await gate;
      });
      await ready;
      const closing = closingStore.close();
      expect(closingStore.close()).toBe(closing);
      let closed = false;
      void closing.then(() => {
        closed = true;
      });
      await Promise.resolve();
      expect(closed).toBe(false);
      release();
      await work;
      await closing;
      await closingStore.close();
      await expect(closingStore.provisionOwner(newUuid())).rejects.toThrow(
        /Cannot use a pool after calling end/,
      );
    });

    it("expires idle connections and opens a new one for later work", async () => {
      const id = newUuid();
      const name = `keepcv_idle_${id}`;
      const url = new URL(options.connectionString);
      url.searchParams.set("application_name", name);
      const idle = openServerStore({
        ...options,
        connectionString: url.toString(),
        idleTimeoutMillis: 200,
      });
      const connections = async () =>
        (
          await admin.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1",
            [name],
          )
        ).rows[0]?.count;
      try {
        await idle.provisionOwner(id);
        expect(await connections()).toBe(1);
        await expect.poll(connections).toBe(0);
        await runAsOwner(id, () => idle.unitOfWork.run((r) => r.profile.get()));
        expect(await connections()).toBe(1);
        await idle.eraseOwner(id, { erasePermanently: true });
      } finally {
        await idle.close();
      }
    });

    it("bounds a connection that never finishes PostgreSQL startup", async () => {
      const sockets: import("node:net").Socket[] = [];
      const stalled = createServer((socket) => sockets.push(socket));
      await new Promise<void>((resolve) => stalled.listen(0, "127.0.0.1", resolve));
      const address = stalled.address();
      if (address === null || typeof address === "string")
        throw new Error("Missing stalled-server port");
      const url = new URL(options.connectionString);
      url.hostname = "127.0.0.1";
      url.port = String(address.port);
      const blocked = openServerStore({
        connectionString: url.toString(),
        connectionTimeoutMillis: 100,
      });
      try {
        await expect(blocked.provisionOwner(newUuid())).rejects.toThrow(/timeout/);
      } finally {
        await blocked.close();
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => stalled.close(() => resolve()));
      }
    });

    it("validates TLS trust through both CA options and connection-string configuration", async () => {
      const proxy = await tlsProxy(options.connectionString);
      const ca = await readFile(new URL("./testing/tls/ca.pem", import.meta.url), "utf8");
      const untrusted = openServerStore({
        connectionString: proxy.connectionString,
        ssl: {},
        connectionTimeoutMillis: 2000,
      });
      const trusted = openServerStore({
        connectionString: proxy.connectionString,
        ssl: { ca },
        connectionTimeoutMillis: 2000,
      });
      const url = new URL(proxy.connectionString);
      url.searchParams.set("sslmode", "verify-full");
      url.searchParams.set(
        "sslrootcert",
        fileURLToPath(new URL("./testing/tls/ca.pem", import.meta.url)),
      );
      const fromUrl = openServerStore({
        connectionString: url.toString(),
        connectionTimeoutMillis: 2000,
      });
      try {
        await expect(untrusted.provisionOwner(newUuid())).rejects.toMatchObject({
          code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        });
        for (const validated of [trusted, fromUrl]) {
          const id = newUuid();
          await validated.provisionOwner(id);
          await runAsOwner(id, () => validated.unitOfWork.run((r) => r.profile.get()));
          await validated.eraseOwner(id, { erasePermanently: true });
        }
      } finally {
        await Promise.all([untrusted.close(), trusted.close(), fromUrl.close()]);
        await proxy.close();
      }
    });

    it("rejects a trusted certificate for the wrong hostname", async () => {
      const proxy = await tlsProxy(options.connectionString, "wrong-host.pem");
      const ca = await readFile(new URL("./testing/tls/ca.pem", import.meta.url), "utf8");
      const wrong = openServerStore({
        connectionString: proxy.connectionString,
        ssl: { ca },
        connectionTimeoutMillis: 2000,
      });
      try {
        await expect(wrong.provisionOwner(newUuid())).rejects.toMatchObject({
          code: "ERR_TLS_CERT_ALTNAME_INVALID",
        });
      } finally {
        await wrong.close();
        await proxy.close();
      }
    });

    it.each(["options", "url"])("validates an IP hostname with TLS from %s", async (source) => {
      const proxy = await tlsProxy(options.connectionString);
      const url = new URL(proxy.connectionString);
      url.hostname = "127.0.0.1";
      const ca = await readFile(new URL("./testing/tls/ca.pem", import.meta.url), "utf8");
      if (source === "url") {
        url.searchParams.set("sslmode", "verify-full");
        url.searchParams.set(
          "sslrootcert",
          fileURLToPath(new URL("./testing/tls/ca.pem", import.meta.url)),
        );
      }
      const wrong = openServerStore({
        connectionString: url.toString(),
        ...(source === "options" ? { ssl: { ca } } : {}),
        connectionTimeoutMillis: 2000,
      });
      try {
        await expect(wrong.provisionOwner(newUuid())).rejects.toMatchObject({
          code: "ERR_TLS_CERT_ALTNAME_INVALID",
        });
      } finally {
        await wrong.close();
        await proxy.close();
      }
    });
  },
);
