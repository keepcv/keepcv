import {
  ConcurrencyConflictError,
  DuplicatePointRecordLinkError,
  generateNKeysBetween,
  NotFoundError,
  newUuid,
} from "@keepcv/core";
import {
  EVIDENCE_KINDS,
  type EvidenceInput,
  METRIC_DIRECTIONS,
  type MetricInput,
  POINT_CONFIDENCES,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import {
  eachDriver,
  evidenceInput,
  metricInput,
  pointInput,
  recordInput,
  violatedConstraint,
} from "./contract.harness.js";

eachDriver(({ run, otherOwner }) => {
  describe("points", () => {
    // A point without its words is a row nothing can render.
    it("is created with the phrasing set, phrasing and revision holding its words", async () => {
      const input = await run(async (r) => {
        const record = await r.records.create(recordInput("experience", "a0"));
        return pointInput(record.id, "a0", "Cut p95 latency from 800ms to 120ms");
      });
      const created = await run(async (r) => await r.points.create(input));

      expect(created.phrasingSetId).toBe(input.phrasingSetId);
      expect(created.confidence).toBe("unverified");

      const set = await run(async (r) => await r.phrasings.getSet(input.phrasingSetId));
      expect(set.purpose).toBe("point");
      expect(set.canonicalPhrasingId).toBe(input.phrasing.id);

      const revisions = await run(
        async (r) => await r.phrasings.listRevisions({ phrasingId: input.phrasing.id }),
      );
      expect(revisions.map((revision) => revision.plainText)).toEqual([
        "Cut p95 latency from 800ms to 120ms",
      ]);
    });

    it("lists a record's points in sort-key order and hides archived ones", async () => {
      const { recordId, third } = await run(async (r) => {
        const record = await r.records.create(recordInput("experience", "a0"));
        const elsewhere = await r.records.create(recordInput("project", "a0"));
        await r.points.create(pointInput(elsewhere.id, "a0", "Under a different record"));
        await r.points.create(pointInput(record.id, "a1", "Second"));
        await r.points.create(pointInput(record.id, "a0", "First"));
        const third = await r.points.create(pointInput(record.id, "a2", "Third"));
        return { recordId: record.id, third };
      });

      const listed = await run(async (r) => await r.points.list({ recordId }));
      expect(listed.map((entry) => entry.sortKey)).toEqual(["a0", "a1", "a2"]);

      const archived = await run(async (r) => await r.points.archive(third.id, third.updatedAt));
      expect(await run(async (r) => await r.points.list({ recordId }))).toHaveLength(2);
      expect(
        await run(async (r) => await r.points.list({ recordId, includeArchived: true })),
      ).toHaveLength(3);

      const restored = await run(
        async (r) => await r.points.restore(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    // Capturing a point before deciding where it belongs is the whole reason
    // `recordId` is nullable, and those points are a list of their own.
    it("keeps the points nobody has placed in one ordered list, at the end", async () => {
      const recordId = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        await r.points.create(pointInput(record.id, "a0", "Placed"));
        await r.points.create(pointInput(null, "a1", "Captured later"));
        await r.points.create(pointInput(null, "a0", "Captured first"));
        return record.id;
      });

      const listed = await run(async (r) => await r.points.list());
      expect(listed.map((entry) => entry.recordId)).toEqual([recordId, null, null]);
      expect(listed.slice(1).map((entry) => entry.sortKey)).toEqual(["a0", "a1"]);
    });

    // Nulls distinct by default would leave every unplaced point in a scope of
    // its own, and I11 holding vacuously over the list the user drags within.
    it("narrows a list to one confidence", async () => {
      await run(async (r) => {
        await r.points.create(pointInput(null, "a0", "Measured", { confidence: "verified" }));
        await r.points.create(pointInput(null, "a1", "Guessed", { confidence: "estimated" }));
      });

      const verified = await run(async (r) => await r.points.list({ confidence: "verified" }));
      expect(verified.map((point) => point.confidence)).toEqual(["verified"]);
      expect(await run(async (r) => await r.points.list())).toHaveLength(2);
    });

    it("refuses two unplaced points the same sort key", async () => {
      await run(async (r) => await r.points.create(pointInput(null, "a0", "Captured")));

      expect(
        await violatedConstraint(
          run(async (r) => await r.points.create(pointInput(null, "a0", "Also captured"))),
        ),
      ).toBe("point_sort_key_unique");
    });

    it("allows one sort key under each of two records", async () => {
      const created = await run(async (r) => {
        const first = await r.records.create(recordInput("experience", "a0"));
        const second = await r.records.create(recordInput("project", "a0"));
        await r.points.create(pointInput(first.id, "a0", "Under the role"));
        return await r.points.create(pointInput(second.id, "a0", "Under the project"));
      });
      expect(created.sortKey).toBe("a0");
    });

    it("places a captured point and takes it back out without losing it", async () => {
      const { point, recordId } = await run(async (r) => {
        const record = await r.records.create(recordInput("experience", "a0"));
        return {
          point: await r.points.create(pointInput(null, "a0", "Captured")),
          recordId: record.id,
        };
      });

      const placed = await run(
        async (r) => await r.points.update(point.id, { recordId }, point.updatedAt),
      );
      expect(placed.recordId).toBe(recordId);

      const unplaced = await run(
        async (r) => await r.points.update(placed.id, { recordId: null }, placed.updatedAt),
      );
      expect(unplaced.recordId).toBeNull();
      expect(await run(async (r) => await r.points.list())).toHaveLength(1);
    });

    it("distinguishes an unknown id from a stale one", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      await run(
        async (r) => await r.points.update(point.id, { confidence: "verified" }, point.updatedAt),
      );

      await expect(
        run(async (r) => await r.points.update(newUuid(), {}, point.updatedAt)),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        run(async (r) => await r.points.update(point.id, {}, point.updatedAt)),
      ).rejects.toBeInstanceOf(ConcurrencyConflictError);
    });

    it("cannot be hung off another owner's record", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.records.create(recordInput("project", "a0")),
      );

      expect(
        await violatedConstraint(
          run(async (r) => await r.points.create(pointInput(theirs.id, "a0", "Theirs"))),
        ),
      ).toBe("point_record_fk");
    });

    // Down to the metrics and the evidence, because evidence is the one thing in
    // the store that must never reach anybody else.
    it("is invisible to another owner", async () => {
      const point = await run(async (r) => {
        const point = await r.points.create(pointInput(null, "a0", "Mine"));
        await r.points.createMetric(metricInput(point.id, "a0"));
        await r.points.createEvidence(evidenceInput(point.id));
        return point;
      });

      const asIntruder = await otherOwner();
      expect(await asIntruder(async (r) => await r.points.list({ includeArchived: true }))).toEqual(
        [],
      );
      expect(await asIntruder(async (r) => await r.points.listMetrics())).toEqual([]);
      expect(await asIntruder(async (r) => await r.points.listEvidence())).toEqual([]);
      await expect(asIntruder(async (r) => await r.points.get(point.id))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("secondary record links", () => {
    it("relates a point to a record it does not print under", async () => {
      const { point, sideProject } = await run(async (r) => {
        const role = await r.records.create(recordInput("experience", "a0"));
        const sideProject = await r.records.create(recordInput("project", "a0"));
        return {
          point: await r.points.create(pointInput(role.id, "a0", "Spanned both")),
          sideProject,
        };
      });

      const link = await run(async (r) => await r.points.linkRecord(point.id, sideProject.id));
      expect(link).toEqual({ pointId: point.id, recordId: sideProject.id });
      expect(await run(async (r) => await r.points.listRecordLinks({ pointId: point.id }))).toEqual(
        [{ pointId: point.id, recordId: sideProject.id }],
      );
    });

    // The pair is the whole row, so there is nothing a second link could change.
    it("links the same pair twice without complaint", async () => {
      const { point, recordId } = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        return {
          point: await r.points.create(pointInput(null, "a0", "Words")),
          recordId: record.id,
        };
      });

      await run(async (r) => await r.points.linkRecord(point.id, recordId));
      await run(async (r) => await r.points.linkRecord(point.id, recordId));
      expect(await run(async (r) => await r.points.listRecordLinks())).toHaveLength(1);
    });

    it("refuses to link the record the point already prints under", async () => {
      const { point, recordId } = await run(async (r) => {
        const record = await r.records.create(recordInput("experience", "a0"));
        return {
          point: await r.points.create(pointInput(record.id, "a0", "Words")),
          recordId: record.id,
        };
      });

      await expect(
        run(async (r) => await r.points.linkRecord(point.id, recordId)),
      ).rejects.toBeInstanceOf(DuplicatePointRecordLinkError);
    });

    // Otherwise the same relationship would be recorded twice, and every read of
    // "which records does this relate to" would have to deduplicate.
    it("drops the link when its record becomes the primary one", async () => {
      const { point, recordId } = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        const point = await r.points.create(pointInput(null, "a0", "Words"));
        await r.points.linkRecord(point.id, record.id);
        return { point, recordId: record.id };
      });

      await run(async (r) => await r.points.update(point.id, { recordId }, point.updatedAt));
      expect(await run(async (r) => await r.points.listRecordLinks())).toEqual([]);
    });

    it("unlinks a record that was never linked, and refuses an unknown point", async () => {
      const { point, recordId } = await run(async (r) => {
        const record = await r.records.create(recordInput("project", "a0"));
        return {
          point: await r.points.create(pointInput(null, "a0", "Words")),
          recordId: record.id,
        };
      });

      await run(async (r) => await r.points.unlinkRecord(point.id, recordId));
      await expect(
        run(async (r) => await r.points.unlinkRecord(newUuid(), recordId)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("cannot reach another owner's record", async () => {
      const asIntruder = await otherOwner();
      const theirs = await asIntruder(
        async (r) => await r.records.create(recordInput("project", "a0")),
      );
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Mine")));

      expect(
        await violatedConstraint(run(async (r) => await r.points.linkRecord(point.id, theirs.id))),
      ).toBe("point_record_link_record_fk");
    });
  });

  describe("metrics and evidence", () => {
    it("keeps a point's numbers in sort-key order, archived ones aside", async () => {
      const { point, superseded } = await run(async (r) => {
        const elsewhere = await r.points.create(pointInput(null, "a1", "A different point"));
        await r.points.createMetric(metricInput(elsewhere.id, "a0", { label: "Elsewhere" }));

        const point = await r.points.create(pointInput(null, "a0", "Words"));
        await r.points.createMetric(metricInput(point.id, "a1", { label: "Cost", unit: "USD" }));
        await r.points.createMetric(metricInput(point.id, "a0"));
        const superseded = await r.points.createMetric(
          metricInput(point.id, "a2", { label: "Old" }),
        );
        return { point, superseded };
      });

      const listed = await run(async (r) => await r.points.listMetrics({ pointId: point.id }));
      expect(listed.map((entry) => entry.label)).toEqual(["p95 latency", "Cost", "Old"]);
      expect(listed[0]).toMatchObject({ value: 120, baseline: 800, direction: "decrease" });

      const archived = await run(
        async (r) => await r.points.archiveMetric(superseded.id, superseded.updatedAt),
      );
      expect(
        await run(async (r) => await r.points.listMetrics({ pointId: point.id })),
      ).toHaveLength(2);
      const restored = await run(
        async (r) => await r.points.restoreMetric(archived.id, archived.updatedAt),
      );
      expect(restored.archivedAt).toBeNull();
    });

    it("refuses two metrics the same sort key on one point", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      await run(async (r) => await r.points.createMetric(metricInput(point.id, "a0")));

      expect(
        await violatedConstraint(
          run(async (r) => await r.points.createMetric(metricInput(point.id, "a0"))),
        ),
      ).toBe("metric_sort_key_unique");
    });

    it("stores a fractional value as it was given", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      const created = await run(
        async (r) =>
          await r.points.createMetric(
            metricInput(point.id, "a0", { value: 0.125, baseline: null, unit: "%" }),
          ),
      );
      expect(created.value).toBe(0.125);
      expect(created.baseline).toBeNull();
    });

    it("keeps evidence beside a point, archived and restored like anything else", async () => {
      const { point, note } = await run(async (r) => {
        const elsewhere = await r.points.create(pointInput(null, "a1", "A different point"));
        await r.points.createEvidence(evidenceInput(elsewhere.id));

        const point = await r.points.create(pointInput(null, "a0", "Words"));
        await r.points.createEvidence(evidenceInput(point.id));
        const note = await r.points.createEvidence(
          evidenceInput(point.id, { kind: "note", value: "Confirmed by the platform team" }),
        );
        return { point, note };
      });

      expect(
        await run(async (r) => await r.points.listEvidence({ pointId: point.id })),
      ).toHaveLength(2);

      const archived = await run(
        async (r) => await r.points.archiveEvidence(note.id, note.updatedAt),
      );
      expect(
        await run(async (r) => await r.points.listEvidence({ pointId: point.id })),
      ).toHaveLength(1);
      const restored = await run(
        async (r) => await r.points.restoreEvidence(archived.id, archived.updatedAt),
      );
      expect(restored.note).toBeNull();
    });

    it("read one back by id, archived or not", async () => {
      const { metric, evidence } = await run(async (r) => {
        const point = await r.points.create(pointInput(null, "a0", "Words"));
        return {
          metric: await r.points.createMetric(metricInput(point.id, "a0")),
          evidence: await r.points.createEvidence(evidenceInput(point.id)),
        };
      });

      expect(await run(async (r) => await r.points.getMetric(metric.id))).toEqual(metric);
      expect(await run(async (r) => await r.points.getEvidence(evidence.id))).toEqual(evidence);

      // Reading one by id ignores `archived_at`, unlike listing: a link to an
      // archived row must resolve, or "where did it go" has no answer.
      const archived = await run(
        async (r) => await r.points.archiveMetric(metric.id, metric.updatedAt),
      );
      expect(await run(async (r) => await r.points.getMetric(metric.id))).toEqual(archived);

      await expect(run(async (r) => await r.points.getMetric(newUuid()))).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(run(async (r) => await r.points.getEvidence(newUuid()))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("are invisible to another owner who knows the id", async () => {
      const evidence = await run(async (r) => {
        const point = await r.points.create(pointInput(null, "a0", "Words"));
        return await r.points.createEvidence(evidenceInput(point.id));
      });
      const asIntruder = await otherOwner();

      await expect(
        asIntruder(async (r) => await r.points.getEvidence(evidence.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    // Soft delete, not cascade: archiving the point it hangs off says nothing
    // about the metric, and restoring the point has to bring it back intact.
    it("survives its point being archived", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      await run(async (r) => {
        await r.points.createMetric(metricInput(point.id, "a0"));
        await r.points.createEvidence(evidenceInput(point.id));
        await r.points.archive(point.id, point.updatedAt);
      });

      expect(await run(async (r) => await r.points.listMetrics())).toHaveLength(1);
      expect(await run(async (r) => await r.points.listEvidence())).toHaveLength(1);
    });
  });

  describe("vocabularies", () => {
    it("accepts exactly the confidences the schema declares", async () => {
      const keys = generateNKeysBetween(null, null, POINT_CONFIDENCES.length);
      await run(async (r) => {
        for (const [index, confidence] of POINT_CONFIDENCES.entries()) {
          await r.points.create(pointInput(null, keys[index] ?? "", "Words", { confidence }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.points.create(pointInput(null, "z0", "Words", { confidence: "disputed" })),
        ),
      ).rejects.toThrow();
    });

    it("accepts exactly the metric directions the schema declares", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      const keys = generateNKeysBetween(null, null, METRIC_DIRECTIONS.length);
      await run(async (r) => {
        for (const [index, direction] of METRIC_DIRECTIONS.entries()) {
          await r.points.createMetric(metricInput(point.id, keys[index] ?? "", { direction }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.points.createMetric(
              metricInput(point.id, "z0", { direction: "sideways" as MetricInput["direction"] }),
            ),
        ),
      ).rejects.toThrow();
    });

    it("accepts exactly the evidence kinds the schema declares", async () => {
      const point = await run(async (r) => await r.points.create(pointInput(null, "a0", "Words")));
      await run(async (r) => {
        for (const kind of EVIDENCE_KINDS) {
          await r.points.createEvidence(evidenceInput(point.id, { kind }));
        }
      });

      await expect(
        run(
          async (r) =>
            await r.points.createEvidence(
              evidenceInput(point.id, { kind: "screenshot" as EvidenceInput["kind"] }),
            ),
        ),
      ).rejects.toThrow();
    });
  });
});
