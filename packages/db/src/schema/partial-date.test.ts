import { PGlite } from "@electric-sql/pglite";
import { partialDateSchema } from "@keepcv/schema";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTS_A_STORE } from "../repositories/contract.harness.js";
import { MIGRATIONS_FOLDER } from "../store.js";

// Both sides see the same values: a value that parses in the browser and then
// fails on insert is the failure this prevents.
const values = [
  "2019",
  "2019-03",
  "2019-03-01",
  "0001-01-01",
  "9999-12-31",
  "",
  "19",
  "2019-",
  "2019-3",
  "2019-00",
  "2019-13",
  "2019-03-00",
  "2019-03-32",
  "2019-03-01T00:00:00Z",
  " 2019",
  // Postgres anchors `$` at the end of the string; JavaScript also matches
  // before a trailing newline, which is why the Zod pattern carries a lookahead.
  "2019\n",
];

describe("the partial_date domain", () => {
  const client = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  }, BOOTS_A_STORE);

  afterAll(async () => {
    await client.close();
  });

  it.each(values)("agrees with partialDateSchema on %j", async (value) => {
    const accepted = await client
      .query("select $1::partial_date", [value])
      .then(() => true)
      .catch(() => false);

    expect(accepted).toBe(partialDateSchema.safeParse(value).success);
  });
});
