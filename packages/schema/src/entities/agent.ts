import { z } from "zod";
import { richTextSchema } from "../primitives/rich-text.js";
import { timestampSchema } from "../primitives/timestamp.js";
import { uuidSchema } from "../primitives/uuid.js";
import { careerRecordInputSchema, careerRecordPatchSchema } from "./career-record.js";
import { contactChannelInputSchema, contactChannelPatchSchema } from "./contact-channel.js";
import { customSectionInputSchema, customSectionPatchSchema } from "./custom-section.js";
import { metricInputSchema, metricPatchSchema } from "./metric.js";
import { organisationInputSchema, organisationPatchSchema } from "./organisation.js";
import {
  phrasingInputSchema,
  phrasingPatchSchema,
  phrasingSetInputSchema,
  phrasingSetPatchSchema,
} from "./phrasing.js";
import { pointInputSchema, pointPatchSchema } from "./point.js";
import { profilePatchSchema } from "./profile.js";
import { recordFieldInputSchema, recordFieldPatchSchema } from "./record-field.js";
import { recordLinkInputSchema, recordLinkPatchSchema } from "./record-link.js";
import {
  resumeEntryInputSchema,
  resumeEntryPatchSchema,
  resumeEntryPointInputSchema,
  resumeEntryPointPatchSchema,
  resumeInputSchema,
  resumePatchSchema,
  resumeSectionInputSchema,
  resumeSectionPatchSchema,
} from "./resume.js";
import { resumeSnapshotInputSchema, resumeSnapshotPatchSchema } from "./resume-version.js";
import { roleProfileInputSchema, roleProfilePatchSchema } from "./role-profile.js";
import { savedFilterInputSchema, savedFilterPatchSchema } from "./saved-filter.js";
import { standardFields } from "./standard-fields.js";
import { tagInputSchema, tagPatchSchema } from "./tag.js";
export const agentOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("records.create"), input: careerRecordInputSchema }).strict(),
  z
    .object({
      type: z.literal("records.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: careerRecordPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("records.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("records.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("organisations.create"), input: organisationInputSchema }).strict(),
  z
    .object({
      type: z.literal("organisations.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: organisationPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("organisations.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("organisations.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("customSections.create"), input: customSectionInputSchema }).strict(),
  z
    .object({
      type: z.literal("customSections.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: customSectionPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("customSections.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("customSections.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("savedFilters.create"), input: savedFilterInputSchema }).strict(),
  z
    .object({
      type: z.literal("savedFilters.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: savedFilterPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("savedFilters.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("savedFilters.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("roleProfiles.create"), input: roleProfileInputSchema }).strict(),
  z
    .object({
      type: z.literal("roleProfiles.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: roleProfilePatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("roleProfiles.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("roleProfiles.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("tags.create"), input: tagInputSchema }).strict(),
  z
    .object({
      type: z.literal("tags.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: tagPatchSchema,
    })
    .strict(),
  z
    .object({ type: z.literal("tags.archive"), id: uuidSchema, expectedUpdatedAt: timestampSchema })
    .strict(),
  z
    .object({ type: z.literal("tags.restore"), id: uuidSchema, expectedUpdatedAt: timestampSchema })
    .strict(),
  z.object({ type: z.literal("resumes.create"), input: resumeInputSchema }).strict(),
  z
    .object({
      type: z.literal("resumes.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: resumePatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumes.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumes.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({ type: z.literal("contactChannels.create"), input: contactChannelInputSchema })
    .strict(),
  z
    .object({
      type: z.literal("contactChannels.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: contactChannelPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("contactChannels.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("contactChannels.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("recordLinks.create"), input: recordLinkInputSchema }).strict(),
  z
    .object({
      type: z.literal("recordLinks.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: recordLinkPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("recordLinks.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("recordLinks.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("recordFields.create"), input: recordFieldInputSchema }).strict(),
  z
    .object({
      type: z.literal("recordFields.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: recordFieldPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("recordFields.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("recordFields.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("points.create"), input: pointInputSchema }).strict(),
  z
    .object({
      type: z.literal("points.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: pointPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("points.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("points.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("metrics.create"), input: metricInputSchema }).strict(),
  z
    .object({
      type: z.literal("metrics.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: metricPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("metrics.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("metrics.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("phrasingSets.create"), input: phrasingSetInputSchema }).strict(),
  z
    .object({
      type: z.literal("phrasingSets.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: phrasingSetPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("phrasingSets.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("phrasingSets.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("phrasings.create"), input: phrasingInputSchema }).strict(),
  z
    .object({
      type: z.literal("phrasings.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: phrasingPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("phrasings.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("phrasings.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("resumeSections.create"), input: resumeSectionInputSchema }).strict(),
  z
    .object({
      type: z.literal("resumeSections.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: resumeSectionPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeSections.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeSections.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("resumeEntries.create"), input: resumeEntryInputSchema }).strict(),
  z
    .object({
      type: z.literal("resumeEntries.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: resumeEntryPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeEntries.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeEntries.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({ type: z.literal("resumeEntryPoints.create"), input: resumeEntryPointInputSchema })
    .strict(),
  z
    .object({
      type: z.literal("resumeEntryPoints.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: resumeEntryPointPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeEntryPoints.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("resumeEntryPoints.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("snapshots.create"), input: resumeSnapshotInputSchema }).strict(),
  z
    .object({
      type: z.literal("snapshots.update"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
      patch: resumeSnapshotPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("snapshots.archive"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("snapshots.restore"),
      id: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("profile.update"),
      patch: profilePatchSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("wording.append"),
      id: uuidSchema,
      expectedRevisionId: uuidSchema.nullable(),
      body: richTextSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("tags.assign"),
      subject: z.enum(["record", "point", "roleProfile"]),
      id: uuidSchema,
      tagId: uuidSchema,
      assigned: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("tags.merge"),
      id: uuidSchema,
      intoTagId: uuidSchema,
      expectedUpdatedAt: timestampSchema,
    })
    .strict(),
]);
export type AgentOperation = z.infer<typeof agentOperationSchema>;
export const agentContextSchema = z
  .object({
    path: z
      .string()
      .max(500)
      .regex(/^\/[a-zA-Z0-9/-]*$/),
    resourceId: uuidSchema.optional(),
  })
  .strict();
export const agentSourceSchema = z.object({
  title: z.string(),
  url: z.url().optional(),
  attachmentId: uuidSchema.optional(),
  location: z.string().optional(),
});
export const agentActionSchema = z.object({
  id: uuidSchema,
  summary: z.string(),
  operations: z.array(agentOperationSchema).min(1).max(20),
  status: z.enum(["pending", "applied", "rejected"]),
  createdAt: timestampSchema,
  before: z.string(),
  receipt: z.string().nullable(),
});
export const agentMessageSchema = z.object({
  id: uuidSchema,
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  publicResearchQuery: z.string().max(500).optional(),
  attachmentIds: z.array(uuidSchema),
  sources: z.array(agentSourceSchema),
  createdAt: timestampSchema,
  state: z.enum(["complete", "interrupted"]),
  navigation: z.string().nullable(),
});
export const agentRunSchema = z.object({
  id: uuidSchema,
  state: z.enum(["running", "complete", "failed", "cancelled"]),
  context: agentContextSchema,
  error: z.string().nullable(),
  leaseUntil: timestampSchema.optional(),
});
export const agentConversationSummarySchema = z.object({
  ...standardFields,
  title: z.string().min(1).max(200),
});
export const agentConversationSchema = agentConversationSummarySchema.extend({
  messages: z.array(agentMessageSchema),
  actions: z.array(agentActionSchema),
  run: agentRunSchema.nullable(),
});
export const agentAttachmentSchema = z.object({
  ...standardFields,
  conversationId: uuidSchema,
  name: z.string().min(1).max(255),
  mediaType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]),
  data: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
export const agentTurnSchema = z
  .object({
    publicResearchQuery: z.string().trim().min(1).max(500).optional(),
    id: uuidSchema,
    text: z.string().max(32000),
    attachmentIds: z.array(uuidSchema).max(5),
    context: agentContextSchema,
    disclosure: z.literal(true),
  })
  .strict();
export const agentGrantSchema = z
  .object({
    resources: z.array(z.string().min(1)).min(1).max(30),
    expiresInSeconds: z.number().int().min(1).max(1800),
    writes: z.number().int().min(1).max(20),
  })
  .strict();
export type AgentConversation = z.infer<typeof agentConversationSchema>;
export type AgentConversationSummary = z.infer<typeof agentConversationSummarySchema>;
export type AgentAttachment = z.infer<typeof agentAttachmentSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentTurn = z.infer<typeof agentTurnSchema>;
export type AgentSource = z.infer<typeof agentSourceSchema>;
export type AgentGrant = z.infer<typeof agentGrantSchema>;
