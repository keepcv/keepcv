import { createRoute } from "@hono/zod-openapi";
import type { ImportPlan, Repositories, UnitOfWork } from "@keepcv/core";
import { importPlan } from "@keepcv/core";
import { intakeDecisionsSchema, intakeSchema } from "@keepcv/schema";
import { z } from "zod";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";

const applied = z
  .object({
    organisations: z.int().min(0),
    customSections: z.int().min(0),
    contactChannels: z.int().min(0),
    records: z.int().min(0),
    points: z.int().min(0),
    tags: z.int().min(0),
  })
  .meta({ id: "IntakeApplied", title: "What an intake wrote" });

// Refused rather than partly applied: `importPlan` skips anything with no
// decision, so a short array would import some of a file and report success.
const reviewedIntake = z
  .object({ intake: intakeSchema, decisions: intakeDecisionsSchema })
  .refine(
    ({ intake, decisions }) =>
      decisions.organisations.length === intake.organisations.length &&
      decisions.contactChannels.length === intake.contactChannels.length &&
      decisions.records.length === intake.records.length,
    { error: "every incoming organisation, contact channel and record needs a decision" },
  );

// The intake travels with the decisions and the plan is worked out here, not
// sent: a client-computed list of rows to write is a client deciding what the
// store contains.
const applyIntake = createRoute({
  method: "post",
  path: "/v1/intake",
  tags: ["store"],
  summary: "Apply a reviewed intake",
  description:
    "Merges what a file said into a store that already holds things, which is what separates this from `/v1/import`. Every incoming thing needs a decision; a merge adds what the file had and leaves the record already there alone.",
  request: {
    body: { content: { "application/json": { schema: reviewedIntake } } },
  },
  responses: {
    ...sessionRequired,
    200: jsonResponse(applied, "what the intake wrote"),
    422: problemResponse("the decisions do not answer the intake one for one"),
  },
});

// Order matters: a record names an organisation, a section and a summary set,
// and a point names a record.
async function write(r: Repositories, plan: ImportPlan) {
  for (const row of plan.organisations) await r.organisations.create(row);
  for (const row of plan.customSections) await r.customSections.create(row);
  for (const row of plan.contactChannels) await r.profile.createContactChannel(row);
  for (const row of plan.phrasingSets) await r.phrasings.createSet(row);
  for (const row of plan.tags) await r.tags.create(row);
  for (const row of plan.records) await r.records.create(row);
  for (const row of plan.recordLinks) await r.records.createLink(row);
  for (const row of plan.points) await r.points.create(row);
  for (const row of plan.recordTags) await r.tags.tagRecord(row.recordId, row.tagId);
  if (plan.profile !== null) {
    const held = await r.profile.get();
    await r.profile.update(plan.profile, held.updatedAt);
  }
}

export function intakeRoutes(unitOfWork: UnitOfWork) {
  return router().openapi(applyIntake, async (c) => {
    const { intake, decisions } = c.req.valid("json");

    const counted = await unitOfWork.run(async (r) => {
      const store = await r.store.readCurrent();
      const plan = importPlan(store, intake, decisions);
      await write(r, plan);
      return {
        organisations: plan.organisations.length,
        customSections: plan.customSections.length,
        contactChannels: plan.contactChannels.length,
        records: plan.records.length,
        points: plan.points.length,
        tags: plan.tags.length,
      };
    });

    return c.json(counted, 200);
  });
}
