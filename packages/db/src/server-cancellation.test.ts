import { createServer, type Socket } from "node:net";
import {
  ConstraintViolationError,
  newUuid,
  type Repositories,
  type UnitOfWorkOptions,
} from "@keepcv/core";
import { DrizzleQueryError } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsOwner } from "./owner-scope.js";
import { openServerStore, type Store } from "./store.js";
import { connectionProxy } from "./testing/connection-proxy.harness.js";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for cancellation tests");

function barrier() {
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
}

describe.skipIf(connectionString === undefined)(
  "PostgreSQL cancellation",
  { timeout: 15_000 },
  () => {
    let admin: Pool;
    let lifecycle: Store;
    beforeAll(async () => {
      admin = new Pool({ connectionString });
      lifecycle = openServerStore({ connectionString: connectionString as string });
      await lifecycle.migrate();
    }, 60_000);
    afterAll(async () => {
      await lifecycle.close();
      await admin.end();
    });

    async function fixture(
      work: (f: {
        store: Store;
        name: string;
        run: <T>(
          callback: (r: Repositories) => Promise<T>,
          options?: UnitOfWorkOptions,
        ) => Promise<T>;
      }) => Promise<void>,
      url = connectionString as string,
    ) {
      const id = newUuid();
      const name = `keepcv_cancel_${newUuid()}`;
      const target = new URL(url);
      target.searchParams.set("application_name", name);
      const store = openServerStore({
        connectionString: target.toString(),
        max: 1,
        connectionTimeoutMillis: 2000,
      });
      await lifecycle.provisionOwner(id);
      const run = <T>(callback: (r: Repositories) => Promise<T>, options?: UnitOfWorkOptions) =>
        runAsOwner(id, () => store.unitOfWork.run(callback, options));
      try {
        await work({ store, name, run });
      } finally {
        await store.close();
        await store.close();
        await lifecycle.eraseOwner(id, { erasePermanently: true });
      }
    }

    async function activity(name: string) {
      return (
        await admin.query<{ pid: number; wait_event_type: string; state: string }>(
          "select pid, wait_event_type, state from pg_stat_activity where application_name = $1",
          [name],
        )
      ).rows;
    }

    it("rejects an already-aborted unit without acquisition or callback work", async () => {
      await fixture(async ({ run, name }) => {
        const controller = new AbortController();
        const reason = new Error("Before start");
        controller.abort(reason);
        let calls = 0;
        await expect(
          run(
            () => {
              calls++;
              return Promise.resolve();
            },
            { signal: controller.signal },
          ),
        ).rejects.toBe(reason);
        expect(calls).toBe(0);
        expect(await activity(name)).toEqual([]);
        expect((await run((r) => r.profile.get())).fullName).toBeNull();
      });
    });

    it("removes cancelled slot waiters while a checked-out callback remains blocked", async () => {
      await fixture(async ({ run, name, store }) => {
        const entered = barrier();
        const gate = barrier();
        const active = run(async () => {
          entered.release();
          await gate.ready;
        });
        try {
          await entered.ready;
          const pid = (await activity(name))[0]?.pid;
          for (let index = 0; index < 5; index++) {
            const controller = new AbortController();
            let calls = 0;
            const waiting = run(
              () => {
                calls++;
                return Promise.resolve();
              },
              { signal: controller.signal },
            );
            const refused = waiting.catch((error) => error as unknown);
            controller.abort();
            await expect(waiting).rejects.toBe(controller.signal.reason);
            expect(await refused).toBe(controller.signal.reason);
            expect(calls).toBe(0);
          }
          expect((await activity(name))[0]?.pid).toBe(pid);
        } finally {
          gate.release();
          await active;
        }
        await run((r) => r.profile.get());
        const closing = store.close();
        expect(store.close()).toBe(closing);
        await closing;
        await expect.poll(() => activity(name)).toEqual([]);
      });
    });

    it("aborts connection startup and closes the unresponsive transport", async () => {
      const accepted = barrier();
      const closed = barrier();
      let socket: Socket | undefined;
      const server = createServer((peer) => {
        socket = peer;
        peer.on("error", () => undefined);
        peer.on("close", closed.release);
        peer.resume();
        accepted.release();
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("Missing test port");
      const url = new URL(connectionString as string);
      url.hostname = "127.0.0.1";
      url.port = String(address.port);
      url.searchParams.set("sslmode", "disable");
      const store = openServerStore({ connectionString: url.toString(), max: 1 });
      const controller = new AbortController();
      let calls = 0;
      const operation = store.unitOfWork.run(
        () => {
          calls++;
          return Promise.resolve();
        },
        { signal: controller.signal },
      );
      const refused = operation.catch((error) => error as unknown);
      try {
        await accepted.ready;
        controller.abort();
        expect(await refused).toBe(controller.signal.reason);
        await closed.ready;
        expect(calls).toBe(0);
        await store.close();
      } finally {
        socket?.destroy();
        await store.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("interrupts the actual checked-out query and rolls back authored work before releasing its lock blocker", async () => {
      await fixture(async ({ run, name }) => {
        const before = await run((r) => r.profile.get());
        const blocker = await admin.connect();
        const controller = new AbortController();
        let calls = 0;
        await blocker.query("begin");
        await blocker.query("lock table tag in access exclusive mode");
        try {
          const operation = run(
            async (r) => {
              calls++;
              await r.profile.update({ fullName: "Must roll back" }, before.updatedAt);
              await r.tags.list();
            },
            { signal: controller.signal },
          );
          const refused = operation.catch((error) => error as unknown);
          await expect
            .poll(async () => (await activity(name))[0]?.wait_event_type, { timeout: 5000 })
            .toBe("Lock");
          controller.abort();
          await expect
            .poll(
              async () => (await activity(name)).some((row) => row.wait_event_type === "Lock"),
              { timeout: 5000 },
            )
            .toBe(false);
          expect(await refused).toBe(controller.signal.reason);
          expect(await run((r) => r.profile.get())).toEqual(before);
          expect(calls).toBe(1);
        } finally {
          await blocker.query("rollback");
          blocker.release();
        }
      });
    });

    it("cancels blocked caller code, refuses its late statements and cannot be swallowed before commit", async () => {
      await fixture(async ({ run }) => {
        const before = await run((r) => r.profile.get());
        const entered = barrier();
        const gate = barrier();
        const controller = new AbortController();
        let late: Promise<unknown> | undefined;
        const operation = run(
          async (r) => {
            await r.profile.update({ fullName: "Before callback wait" }, before.updatedAt);
            entered.release();
            await gate.ready;
            late = r.profile.get().catch((error) => error as unknown);
            await late;
          },
          { signal: controller.signal },
        );
        const refused = operation.catch((error) => error as unknown);
        await entered.ready;
        controller.abort();
        expect(await refused).toBe(controller.signal.reason);
        expect(await run((r) => r.profile.get())).toEqual(before);
        gate.release();
        await expect.poll(() => late !== undefined).toBe(true);
        expect(await late).toBeInstanceOf(Error);
        const swallowed = new AbortController();
        const reason = new Error("Swallowed cancellation");
        await expect(
          run(
            async (r) => {
              await r.profile.update({ fullName: "Before swallowed abort" }, before.updatedAt);
              swallowed.abort(reason);
              await r.profile.get().catch(() => undefined);
            },
            { signal: swallowed.signal },
          ),
        ).rejects.toBe(reason);
        expect(await run((r) => r.profile.get())).toEqual(before);
      });
    });

    it("keeps explicit inner units independent and never inherits request cancellation into lifecycle work", async () => {
      await fixture(async ({ run }) => {
        const inner = openServerStore({ connectionString: connectionString as string, max: 1 });
        const id = newUuid();
        const controller = new AbortController();
        const reason = new Error("Outer cancellation");
        const finished = barrier();
        try {
          await expect(
            run(
              async () => {
                controller.abort(reason);
                await inner.provisionOwner(id);
                await runAsOwner(id, () =>
                  inner.unitOfWork.run(async (r) => {
                    const profile = await r.profile.get();
                    await r.profile.update(
                      { fullName: "Independent inner unit" },
                      profile.updatedAt,
                    );
                  }),
                );
                finished.release();
              },
              { signal: controller.signal },
            ),
          ).rejects.toBe(reason);
          await finished.ready;
          expect(
            await runAsOwner(id, () => inner.unitOfWork.run((r) => r.profile.get())),
          ).toMatchObject({ fullName: "Independent inner unit" });
        } finally {
          await inner.eraseOwner(id, { erasePermanently: true });
          await inner.close();
        }
      });
    });

    it.each([
      { label: "callback", error: new Error("Meaningful callback failure") },
      {
        label: "driver",
        error: new DrizzleQueryError(
          "synthetic statement",
          [],
          new Error("Meaningful encoding failure"),
        ),
      },
    ])(
      "preserves the $label operation error when rollback loses its connection",
      async ({ error: original }) => {
        await fixture(async ({ run, name }) => {
          await expect(
            run(
              async () => {
                const pid = (await activity(name))[0]?.pid;
                await admin.query("select pg_terminate_backend($1)", [pid]);
                throw original;
              },
              { signal: new AbortController().signal },
            ),
          ).rejects.toBe(original);
          await run((r) => r.profile.get());
        });
      },
    );

    it("preserves a named constraint failure when rollback also loses its connection", async () => {
      await fixture(async ({ run, name }) => {
        const refusal = await run(
          async (r) => {
            const input = { id: newUuid(), label: "Synthetic duplicate tag", category: null };
            await r.tags.create(input);
            const error = await r.tags
              .create({ ...input, id: newUuid() })
              .catch((error) => error as unknown);
            const pid = (await activity(name))[0]?.pid;
            await admin.query("select pg_terminate_backend($1)", [pid]);
            throw error;
          },
          { signal: new AbortController().signal },
        ).catch((error) => error as unknown);
        expect(refusal).toBeInstanceOf(ConstraintViolationError);
        expect((refusal as ConstraintViolationError).constraint).toBe("tag_slug_unique");
        expect(await run((r) => r.tags.list())).toEqual([]);
      });
    });

    it("cancels both an outer unit and an explicitly signalled nested acquisition without replay", async () => {
      await fixture(async ({ run }) => {
        const controller = new AbortController();
        const reason = new Error("Shared nested cancellation");
        let outerCalls = 0;
        let innerCalls = 0;
        let nested: Promise<unknown> | undefined;
        await expect(
          run(
            async () => {
              outerCalls++;
              nested = run(
                () => {
                  innerCalls++;
                  return Promise.resolve();
                },
                { signal: controller.signal },
              ).catch((error) => error as unknown);
              controller.abort(reason);
              await nested;
            },
            { signal: controller.signal },
          ),
        ).rejects.toBe(reason);
        expect(await nested).toBe(reason);
        expect(outerCalls).toBe(1);
        expect(innerCalls).toBe(0);
        await run((r) => r.profile.get());
      });
    });

    it("ignores abort after a confirmed commit and cannot cancel later work on the reused connection", async () => {
      await fixture(async ({ run, name }) => {
        const controller = new AbortController();
        const before = await run((r) => r.profile.get());
        let calls = 0;
        await run(
          async (r) => {
            calls++;
            await r.profile.update({ fullName: "Committed" }, before.updatedAt);
          },
          { signal: controller.signal },
        );
        const pid = (await activity(name))[0]?.pid;
        const entered = barrier();
        const gate = barrier();
        const next = run(async (r) => {
          entered.release();
          await gate.ready;
          return await r.profile.get();
        });
        await entered.ready;
        controller.abort();
        gate.release();
        expect(await next).toMatchObject({ fullName: "Committed" });
        expect((await activity(name))[0]?.pid).toBe(pid);
        expect(calls).toBe(1);
      });
    });

    it("does not relabel a lost COMMIT reply as a successful rollback when abort races it", async () => {
      const url = new URL(connectionString as string);
      url.searchParams.set("sslmode", "disable");
      const proxy = await connectionProxy(url.toString());
      try {
        await fixture(async ({ run }) => {
          const before = await run((r) => r.profile.get());
          const controller = new AbortController();
          let calls = 0;
          await expect(
            run(
              async (r) => {
                calls++;
                await r.profile.update(
                  { fullName: "Committed without acknowledgment" },
                  before.updatedAt,
                );
                proxy.loseNextCommitReply(() => controller.abort());
              },
              { signal: controller.signal },
            ),
          ).rejects.toThrow(/connection|queryable|terminated/i);
          controller.abort();
          expect(proxy.lostCommitReplies()).toBe(1);
          expect(calls).toBe(1);
          expect(await run((r) => r.profile.get())).toMatchObject({
            fullName: "Committed without acknowledgment",
          });
        }, proxy.connectionString);
      } finally {
        await proxy.close();
      }
    });

    it("reports a confirmed commit when abort arrives after the server committed but before its reply", async () => {
      const url = new URL(connectionString as string);
      url.searchParams.set("sslmode", "disable");
      const proxy = await connectionProxy(url.toString());
      try {
        await fixture(async ({ run }) => {
          const before = await run((r) => r.profile.get());
          const controller = new AbortController();
          const held = proxy.holdNextCommitReply();
          let calls = 0;
          const operation = run(
            async (r) => {
              calls++;
              await r.profile.update({ fullName: "Confirmed after commit race" }, before.updatedAt);
              return "committed";
            },
            { signal: controller.signal },
          );
          await held.ready;
          controller.abort();
          held.release();
          expect(await operation).toBe("committed");
          expect(calls).toBe(1);
          expect(await run((r) => r.profile.get())).toMatchObject({
            fullName: "Confirmed after commit race",
          });
        }, proxy.connectionString);
      } finally {
        await proxy.close();
      }
    });
  },
);
