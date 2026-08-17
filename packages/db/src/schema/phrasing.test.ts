import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTS_A_STORE } from "../repositories/contract.harness.js";
import { MIGRATIONS_FOLDER } from "../store.js";

const ownerId = "019891a4-6ac5-7000-8000-0000000000a0";
const setId = "019891a4-6ac5-7000-8000-0000000000a1";
const phrasingId = "019891a4-6ac5-7000-8000-0000000000a2";
const revisionId = "019891a4-6ac5-7000-8000-0000000000a3";

// The half of I2 that does not depend on the repository: raw SQL at the row.
describe("phrasing_revision immutability", () => {
  const client = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await client.query(`insert into owner (id) values ('${ownerId}')`);
    await client.query(
      `insert into phrasing_set (id, owner_id, purpose) values ('${setId}', '${ownerId}', 'point')`,
    );
    await client.query(
      `insert into phrasing (id, owner_id, phrasing_set_id, variant, sort_key)
         values ('${phrasingId}', '${ownerId}', '${setId}', 'standard', 'a0')`,
    );
    await client.query(
      `insert into phrasing_revision
         (id, owner_id, phrasing_id, body, plain_text, char_count, content_hash)
       values ('${revisionId}', '${ownerId}', '${phrasingId}',
               '[{"t":"text","v":"Designs engines"}]', 'Designs engines', 15, '${"0".repeat(64)}')`,
    );
  }, BOOTS_A_STORE);

  afterAll(async () => {
    await client.close();
  });

  it("refuses an update to a revision", async () => {
    const error = await client
      .query(`update phrasing_revision set plain_text = 'rewritten' where id = '${revisionId}'`)
      .then(
        () => undefined,
        (thrown: unknown) => thrown as { code?: string; message?: string },
      );

    expect(error?.code).toBe("23001");
    expect(error?.message).toContain("append-only");
  });

  it("still allows a delete, because purge has to stay possible", async () => {
    await client.query("begin");
    await expect(
      client.query(`delete from phrasing_revision where id = '${revisionId}'`),
    ).resolves.toBeDefined();
    await client.query("rollback");
  });
});
