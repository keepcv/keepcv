// @vitest-environment node
import { createApi } from "@keepcv/api";
import { generateNKeysBetween, NotFoundError, newUuid, type UnitOfWorkOptions } from "@keepcv/core";
import { openServerStore, runAsOwner } from "@keepcv/db";
import { exportDocumentSchema } from "@keepcv/schema";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined && process.env["CI"] !== undefined)
  throw new Error("DATABASE_URL is required for installed PostgreSQL reliability tests");

describe.skipIf(connectionString === undefined)("installed PostgreSQL reliability", () => {
  it.each([2000, 3000])(
    "creates and exports %i Points with three Revisions, then restores the complete archive for two concurrent owners",
    async (count) => {
      const store = openServerStore({ connectionString: connectionString as string, max: 3 });
      const owners = [newUuid(), newUuid(), newUuid()];
      const [source, ...targets] = owners;
      if (source === undefined) throw new Error("Source owner required");
      const run = <T>(id: typeof source, work: Parameters<typeof store.unitOfWork.run<T>>[0]) =>
        runAsOwner(id, () => store.unitOfWork.run(work));
      const api = (id: typeof source) =>
        createApi({
          unitOfWork: store.unitOfWork,
          runAsOwner,
          authenticate: async () => id,
          reportUnexpectedError: null,
        });
      try {
        await store.migrate();
        await Promise.all(owners.map((id) => store.provisionOwner(id)));
        const keys = generateNKeysBetween(null, null, count);
        await run(source, async (r) => {
          for (const [index, sortKey] of keys.entries()) {
            const phrasingId = newUuid();
            await r.points.create({
              id: newUuid(),
              recordId: null,
              phrasingSetId: newUuid(),
              confidence: "unverified",
              occurredOn: null,
              sortKey,
              phrasing: {
                id: phrasingId,
                variant: "standard",
                label: null,
                sortKey,
                body: [{ t: "text", v: `Synthetic Point ${index} Revision 1` }],
              },
            });
            for (let revision = 2; revision <= 3; revision++)
              await r.phrasings.addRevision(phrasingId, [
                { t: "text", v: `Synthetic Point ${index} Revision ${revision}` },
              ]);
          }
        });
        const response = await api(source).request("/v1/export");
        expect(response.status).toBe(200);
        const document = exportDocumentSchema.parse(await response.json());
        expect(document.store.points).toHaveLength(count);
        expect(document.store.phrasings).toHaveLength(count);
        expect(document.store.phrasingRevisions).toHaveLength(count * 3);
        const imported = await Promise.all(
          targets.map((id) =>
            api(id).request("/v1/import", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(document),
            }),
          ),
        );
        expect(imported.map((result) => result.status)).toEqual([204, 204]);
        for (const id of owners)
          expect(await run(id, (r) => r.store.read())).toEqual(document.store);
        const first = targets[0];
        const second = targets[1];
        const phrasing = document.store.phrasings[0];
        if (first === undefined || second === undefined || phrasing === undefined)
          throw new Error("Two restored owners with phrasings required");
        await run(first, (r) =>
          r.phrasings.addRevision(phrasing.id, [{ t: "text", v: "Only the first restored owner" }]),
        );
        expect(await run(second, (r) => r.store.read())).toEqual(document.store);
        const privateTag = await run(first, (r) =>
          r.tags.create({ id: newUuid(), label: "Synthetic owner-only tag", category: null }),
        );
        await expect(run(second, (r) => r.tags.get(privateTag.id))).rejects.toBeInstanceOf(
          NotFoundError,
        );
        await expect(
          run(second, (r) =>
            r.tags.update(privateTag.id, { label: "Must be denied" }, privateTag.updatedAt),
          ),
        ).rejects.toBeInstanceOf(NotFoundError);
        expect(
          (
            await api(second).request("/v1/import", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(document),
            })
          ).status,
        ).toBe(409);
      } finally {
        await Promise.all(owners.map((id) => store.eraseOwner(id, { erasePermanently: true })));
        await store.close();
        await store.close();
      }
    },
    120_000,
  );

  it("forwards Request abort to the actual checked-out PostgreSQL operation and leaves another owner intact", async () => {
    const name = `keepcv_artifact_cancel_${newUuid()}`;
    const url = new URL(connectionString as string);
    url.searchParams.set("application_name", name);
    const store = openServerStore({ connectionString: url.toString(), max: 1 });
    const admin = new Pool({ connectionString });
    const owner = newUuid();
    const other = newUuid();
    const run = <T>(
      id: typeof owner,
      callback: Parameters<typeof store.unitOfWork.run<T>>[0],
      options?: UnitOfWorkOptions,
    ) => runAsOwner(id, () => store.unitOfWork.run(callback, options));
    const blocker = await admin.connect();
    try {
      await store.migrate();
      await store.provisionOwner(owner);
      await store.provisionOwner(other);
      const before = await run(owner, (r) => r.profile.get());
      const otherProfile = await run(other, (r) => r.profile.get());
      await run(other, (r) =>
        r.profile.update({ fullName: "Other owner kept intact" }, otherProfile.updatedAt),
      );
      const otherBefore = await run(other, (r) => r.store.read());
      const controller = new AbortController();
      const app = createApi({
        unitOfWork: store.unitOfWork,
        runAsOwner,
        authenticate: async () => owner,
        reportUnexpectedError: null,
      });
      await blocker.query("begin");
      await blocker.query("select id from profile where owner_id = $1 for update", [owner]);
      const pending = app.fetch(
        new Request("http://localhost/v1/profile", {
          method: "PATCH",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            patch: { fullName: "Cancelled through Request" },
            expectedUpdatedAt: before.updatedAt,
          }),
        }),
      );
      await expect
        .poll(
          async () =>
            (
              await admin.query<{ wait_event_type: string }>(
                "select wait_event_type from pg_stat_activity where application_name = $1",
                [name],
              )
            ).rows[0]?.wait_event_type,
          { timeout: 5000 },
        )
        .toBe("Lock");
      controller.abort();
      expect((await pending).status).toBe(500);
      expect(await run(owner, (r) => r.profile.get())).toEqual(before);
      expect(await run(other, (r) => r.store.read())).toEqual(otherBefore);
      const pre = new AbortController();
      pre.abort();
      let calls = 0;
      await expect(
        run(
          owner,
          async () => {
            calls++;
          },
          { signal: pre.signal },
        ),
      ).rejects.toBe(pre.signal.reason);
      expect(calls).toBe(0);
      await store.provisionOwner(other);
      expect(await run(other, (r) => r.store.read())).toEqual(otherBefore);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      await Promise.all(
        [owner, other].map((id) => store.eraseOwner(id, { erasePermanently: true })),
      );
      await store.close();
      await store.close();
      await admin.end();
    }
  });
});
