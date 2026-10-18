import { newUuid } from "@keepcv/core";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { expect, it, vi } from "vitest";
import { runAsOwner } from "../owner-scope.js";
import { openServerStore } from "../store.js";
import { fill } from "./contract-store.harness.js";
import * as inserts from "./insert-all.js";
import { insertAll } from "./insert-all.js";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for import boundary tests");

it.skipIf(connectionString === undefined)(
  "bounds every native-loader table below, at and above its actual parameter boundary on PostgreSQL",
  async () => {
    const store = openServerStore({ connectionString: connectionString as string });
    const pool = new Pool({ connectionString });
    const owners = [newUuid(), newUuid()];
    const captures = new Map<PgTable, PgInsertValue<PgTable>[]>();
    try {
      await store.migrate();
      await Promise.all(owners.map((id) => store.provisionOwner(id)));
      const source = owners[0];
      const target = owners[1];
      if (source === undefined || target === undefined) throw new Error("Two test owners required");
      await runAsOwner(source, () => fill((work) => store.unitOfWork.run(work)));
      const archive = await runAsOwner(source, () => store.unitOfWork.run((r) => r.store.read()));
      const insert = insertAll;
      const spy = vi.spyOn(inserts, "insertAll").mockImplementation(async (db, table, values) => {
        captures.set(table, values);
        await insert(db, table, values);
      });
      try {
        await runAsOwner(target, () => store.unitOfWork.run((r) => r.store.load(archive)));
      } finally {
        spy.mockRestore();
      }
      expect(await runAsOwner(target, () => store.unitOfWork.run((r) => r.store.read()))).toEqual(
        archive,
      );
      expect(captures.size).toBe(Object.values(archive).filter(Array.isArray).length + 1);
      const client = await pool.connect();
      try {
        const counts: number[] = [];
        const db = drizzle(client, {
          logger: {
            logQuery: (_query, params) => {
              counts.push(params.length);
            },
          },
        });
        for (const [table, rows] of captures) {
          const sample = rows[0];
          if (sample === undefined)
            throw new Error(`Covering fixture missed ${getTableName(table)}`);
          const name = getTableName(table);
          await client.query(
            `create temp table "${name}" (like public."${name}" including defaults)`,
          );
          const width = db.insert(table).values([sample]).toSQL().params.length;
          const boundary = Math.floor(65_535 / width);
          for (const count of [boundary - 1, boundary, boundary + 1]) {
            counts.length = 0;
            await insertAll(
              db,
              table,
              Array.from({ length: count }, () => sample),
            );
            expect(
              counts.every((value) => value <= 65_535),
              name,
            ).toBe(true);
            expect(counts.length, name).toBe(count > boundary ? 2 : 1);
            expect(
              counts.reduce((sum, value) => sum + value, 0),
              name,
            ).toBe(count * width);
            const result = await client.query<{ count: number }>(
              `select count(*)::int as count from "${name}"`,
            );
            expect(result.rows[0]?.count, name).toBe(count);
            await client.query(`truncate "${name}"`);
          }
        }
      } finally {
        client.release();
      }
    } finally {
      await Promise.all(owners.map((id) => store.eraseOwner(id, { erasePermanently: true })));
      await store.close();
      await pool.end();
    }
  },
  120_000,
);
