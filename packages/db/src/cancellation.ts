import { AsyncLocalStorage } from "node:async_hooks";
import { Socket } from "node:net";
import type { CancellationSignal } from "@keepcv/core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, type ClientConfig, type Pool, type PoolClient, type QueryConfig } from "pg";
import type { Database } from "./database.js";

const acquiring = new AsyncLocalStorage<CancellationSignal>();

export class CancellableClient extends Client {
  constructor(config?: ClientConfig) {
    const signal = acquiring.getStore();
    const socket = signal === undefined ? undefined : new Socket();
    super(socket === undefined ? config : { ...config, stream: () => socket });
    if (signal !== undefined && socket !== undefined) {
      const abort = () => socket.destroy(new Error("Connection acquisition cancelled"));
      const cleanup = () => signal.removeEventListener("abort", abort);
      signal.addEventListener("abort", abort, { once: true });
      this.once("connect", cleanup);
      this.once("end", cleanup);
      if (signal.aborted) abort();
    }
  }
}

export function checkCancellation(signal?: CancellationSignal): void {
  if (signal?.aborted) throw signal.reason;
}

export function connectionSlots(max: number, timeout: number) {
  let active = 0;
  const waiting = new Set<() => void>();
  return async (signal?: CancellationSignal): Promise<() => void> => {
    checkCancellation(signal);
    if (active < max) active++;
    else {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          signal?.removeEventListener("abort", abort);
          clearTimeout(timer);
        };
        const ready = () => {
          cleanup();
          resolve();
        };
        const abort = () => {
          waiting.delete(ready);
          cleanup();
          reject(signal?.reason);
        };
        const timer =
          timeout === 0
            ? undefined
            : setTimeout(() => {
                waiting.delete(ready);
                cleanup();
                reject(new Error("timeout exceeded when trying to connect"));
              }, timeout);
        waiting.add(ready);
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return () => {
      const next = waiting.values().next().value;
      if (next === undefined) active--;
      else {
        waiting.delete(next);
        next();
      }
    };
  };
}

export async function acquire(pool: Pool, signal?: CancellationSignal): Promise<PoolClient> {
  checkCancellation(signal);
  try {
    const client = await (signal === undefined
      ? pool.connect()
      : acquiring.run(signal, () => pool.connect()));
    if (signal?.aborted) {
      client.release();
      throw signal.reason;
    }
    return client;
  } catch (error) {
    throw signal?.aborted ? signal.reason : error;
  }
}

export async function cancellableTransaction<T>(
  pool: Pool,
  client: PoolClient,
  signal: CancellationSignal,
  work: (db: Database) => Promise<T>,
): Promise<T> {
  checkCancellation(signal);
  let phase: "work" | "commit" | "finished" = "work";
  let failure: { error: unknown } | undefined;
  let cancellation: Promise<void> | undefined;
  let pid: number | undefined;
  let rejectAbort: (error: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  // The listener can reject before the callback reaches its race.
  void aborted.catch(() => undefined);

  async function cancel(): Promise<void> {
    if (pid === undefined) {
      await client.end();
      return;
    }
    const control = new Client({
      ...pool.options,
      connectionTimeoutMillis: pool.options.connectionTimeoutMillis || 5000,
      query_timeout: 5000,
      statement_timeout: 5000,
    });
    control.on("error", () => undefined);
    try {
      await control.connect();
      await control.query("select pg_cancel_backend($1)", [pid]);
    } catch {
      await client.end();
    } finally {
      await control.end();
    }
  }

  const abort = () => {
    if (phase !== "work") return;
    failure ??= { error: signal.reason };
    cancellation ??= cancel();
    void cancellation.then(
      () => rejectAbort(failure?.error),
      () => rejectAbort(failure?.error),
    );
  };
  signal.addEventListener("abort", abort, { once: true });

  function checkQuery(text: string): void {
    if (phase === "finished") throw new Error("The unit of work has finished");
    if (text === "rollback") return;
    if (failure !== undefined) throw failure.error;
    checkCancellation(signal);
  }

  const query = async (config: string | QueryConfig, values?: unknown[]) => {
    const text = typeof config === "string" ? config : config.text;
    checkQuery(text);
    if (text === "commit") phase = "commit";
    try {
      return await client.query(config, values);
    } catch (error) {
      if (text === "commit") failure ??= { error };
      throw error;
    }
  };
  const guarded = new Proxy(client, {
    get(target, key, receiver) {
      if (key === "query") return query;
      const value: unknown = Reflect.get(target, key, receiver);
      return value;
    },
  });
  try {
    const backend = await client.query<{ pid: number }>("select pg_backend_pid() as pid");
    pid = backend.rows[0]?.pid;
    checkCancellation(signal);
    return await drizzle(guarded).transaction(async (tx) => {
      try {
        const result = await Promise.race([work(tx), aborted]);
        checkCancellation(signal);
        return result;
      } catch (error) {
        failure ??= { error };
        throw failure.error;
      }
    });
  } catch (error) {
    throw failure === undefined ? error : failure.error;
  } finally {
    phase = "finished";
    signal.removeEventListener("abort", abort);
    await cancellation?.catch(() => undefined);
  }
}
