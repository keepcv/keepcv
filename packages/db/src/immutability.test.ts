import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "./store.js";

// The two append-only tables are held that way by triggers, which are invisible
// to the Drizzle schema and so to every other test in this package: nothing
// goes through a repository here.
const OWNER = "00000000-0000-4000-8000-000000000001";
const RESUME = "00000000-0000-4000-8000-000000000002";
const VERSION = "00000000-0000-4000-8000-000000000003";
const SET = "00000000-0000-4000-8000-000000000004";
const PHRASING = "00000000-0000-4000-8000-000000000005";
const REVISION = "00000000-0000-4000-8000-000000000006";
const HASH = "0".repeat(64);

const RESTRICT_VIOLATION = "23001";

const BOOTS_A_STORE = 60_000;

describe("append-only tables", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await client.exec(`
      insert into owner (id) values ('${OWNER}');
      insert into resume (id, owner_id, name) values ('${RESUME}', '${OWNER}', 'A resume');
      insert into resume_version (id, owner_id, resume_id, seq, trigger, manifest, manifest_hash)
        values ('${VERSION}', '${OWNER}', '${RESUME}', 1, 'export', '{}', '${HASH}');
      insert into phrasing_set (id, owner_id, purpose) values ('${SET}', '${OWNER}', 'point');
      insert into phrasing (id, owner_id, phrasing_set_id, variant, sort_key)
        values ('${PHRASING}', '${OWNER}', '${SET}', 'standard', 'a0');
      insert into phrasing_revision (id, owner_id, phrasing_id, body, plain_text, char_count, content_hash)
        values ('${REVISION}', '${OWNER}', '${PHRASING}', '[]', 'a wording', 9, '${HASH}');
    `);
  }, BOOTS_A_STORE);

  afterAll(async () => {
    await client.close();
  });

  // Named, so the test still fails if the row is refused for some other reason.
  async function refused(query: string): Promise<{ code: unknown; message: string }> {
    const thrown = await client.query(query).then(
      () => undefined,
      (error: unknown) => error,
    );
    if (!(thrown instanceof Error)) throw new Error(`${query} was not refused`);
    return { code: (thrown as { code?: unknown }).code, message: thrown.message };
  }

  it("refuses an update to a resume version", async () => {
    expect(
      await refused(`update resume_version set trigger = 'manual_save' where id = '${VERSION}'`),
    ).toEqual({ code: RESTRICT_VIOLATION, message: "resume_version is append-only" });
  });

  it("refuses an update to a phrasing revision", async () => {
    expect(
      await refused(
        `update phrasing_revision set plain_text = 'rewritten' where id = '${REVISION}'`,
      ),
    ).toEqual({ code: RESTRICT_VIOLATION, message: "phrasing_revision is append-only" });
  });
});
