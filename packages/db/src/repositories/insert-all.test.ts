import { PGlite } from "@electric-sql/pglite";
import { newUuid } from "@keepcv/core";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { expect, it } from "vitest";
import { insertAll } from "./insert-all.js";

it("keeps PGlite below its signed parameter ceiling and its connection queryable", async () => {
  const client = new PGlite();
  const counts: number[] = [];
  const db = drizzle(client, {
    logger: {
      logQuery: (_query, params) => {
        counts.push(params.length);
      },
    },
  });
  const table = pgTable("parameter_probe", { ownerId: uuid("owner_id"), value: integer("value") });
  const sample = { ownerId: newUuid(), value: 1 };
  const boundary = Math.floor(32_767 / 2);
  try {
    await client.exec("create temp table parameter_probe(owner_id uuid, value integer)");
    for (const count of [boundary - 1, boundary, boundary + 1]) {
      counts.length = 0;
      await insertAll(
        db,
        table,
        Array.from({ length: count }, () => sample),
      );
      expect(counts.every((value) => value <= 32_767)).toBe(true);
      expect(counts).toHaveLength(count > boundary ? 2 : 1);
      expect(
        (
          await client.query<{ count: number }>(
            "select count(*)::int as count from parameter_probe",
          )
        ).rows[0]?.count,
      ).toBe(count);
      await client.exec("truncate parameter_probe");
    }
  } finally {
    await client.close();
  }
}, 30_000);
