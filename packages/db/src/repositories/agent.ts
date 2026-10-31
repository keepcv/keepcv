import { type AgentRepository, ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import {
  type AgentConversation,
  agentAttachmentSchema,
  agentConversationSchema,
  agentConversationSummarySchema,
} from "@keepcv/schema";
import { and, eq } from "drizzle-orm";
import type { Database } from "../database.js";
import { agentAttachment, agentConversation, phrasing } from "../schema/index.js";
import { insertOwned, live, owned, standardDto, toTimestamp, updateOwned } from "./owned-row.js";

function conversation(row: typeof agentConversation.$inferSelect): AgentConversation {
  const state = row.state as object;
  return agentConversationSchema.parse({ ...state, ...standardDto(row), title: row.title });
}
export function createAgentRepository(db: Database): AgentRepository {
  return {
    async list(includeArchived) {
      const rows = await db
        .select({
          id: agentConversation.id,
          title: agentConversation.title,
          createdAt: agentConversation.createdAt,
          updatedAt: agentConversation.updatedAt,
          archivedAt: agentConversation.archivedAt,
        })
        .from(agentConversation)
        .where(and(owned(agentConversation), live(agentConversation, includeArchived)))
        .orderBy(agentConversation.id);
      return rows.map((row) =>
        agentConversationSummarySchema.parse({ ...standardDto(row), title: row.title }),
      );
    },
    async history() {
      return (
        await db
          .select()
          .from(agentConversation)
          .where(owned(agentConversation))
          .orderBy(agentConversation.id)
      ).map(conversation);
    },
    async get(id, lock) {
      const query = db
        .select()
        .from(agentConversation)
        .where(and(owned(agentConversation), eq(agentConversation.id, id)));
      const [row] = await (lock === true ? query.for("update") : query);
      if (row === undefined) throw new NotFoundError("conversation", id);
      return conversation(row);
    },
    async create(id, title) {
      return conversation(
        await insertOwned(db, agentConversation, "conversation", {
          id,
          title,
          state: { messages: [], actions: [], run: null },
        }),
      );
    },
    async save(input) {
      const [previousRow] = await db
        .select()
        .from(agentConversation)
        .where(and(owned(agentConversation), eq(agentConversation.id, input.id)))
        .for("update");
      if (previousRow === undefined) throw new NotFoundError("conversation", input.id);
      const previous = conversation(previousRow);
      const messagesRetained = previous.messages.every(
        (message, index) => JSON.stringify(message) === JSON.stringify(input.messages[index]),
      );
      const actionsRetained = previous.actions.every((action, index) => {
        const next = input.actions[index];
        return (
          next !== undefined &&
          action.id === next.id &&
          action.summary === next.summary &&
          action.before === next.before &&
          action.createdAt === next.createdAt &&
          JSON.stringify(action.operations) === JSON.stringify(next.operations) &&
          (action.status === "pending" || JSON.stringify(action) === JSON.stringify(next))
        );
      });
      if (!messagesRetained || !actionsRetained)
        throw new Error("Conversation history and proposals cannot be rewritten.");
      const { messages, actions, run } = input;
      return conversation(
        await updateOwned<typeof agentConversation.$inferSelect>(
          db,
          agentConversation,
          "conversation",
          input.id,
          input.updatedAt,
          {
            title: input.title,
            archivedAt: input.archivedAt === null ? null : new Date(input.archivedAt),
            state: { messages, actions, run },
          },
        ),
      );
    },
    async attachments(conversationId) {
      const rows = await db
        .select()
        .from(agentAttachment)
        .where(
          and(
            owned(agentAttachment),
            conversationId === undefined
              ? undefined
              : eq(agentAttachment.conversationId, conversationId),
          ),
        )
        .orderBy(agentAttachment.id);
      return rows.map((row) => agentAttachmentSchema.parse({ ...row, ...standardDto(row) }));
    },
    async attach(input) {
      const [existing] = await db
        .select()
        .from(agentAttachment)
        .where(and(owned(agentAttachment), eq(agentAttachment.id, input.id)));
      if (existing !== undefined) {
        if (
          existing.data !== input.data ||
          existing.conversationId !== input.conversationId ||
          existing.mediaType !== input.mediaType ||
          existing.name !== input.name
        )
          throw new ConcurrencyConflictError(
            "attachment",
            input.id,
            toTimestamp(existing.updatedAt),
          );
        return agentAttachmentSchema.parse({ ...existing, ...standardDto(existing) });
      }
      const row = await insertOwned(db, agentAttachment, "attachment", input);
      return agentAttachmentSchema.parse({ ...row, ...standardDto(row) });
    },
    async archiveAttachment(id, expected, archived) {
      const row = await updateOwned<typeof agentAttachment.$inferSelect>(
        db,
        agentAttachment,
        "attachment",
        id,
        expected,
        { archivedAt: archived ? new Date() : null },
      );
      return agentAttachmentSchema.parse({ ...row, ...standardDto(row) });
    },
    async checkRevision(id, expected) {
      const [row] = await db
        .select()
        .from(phrasing)
        .where(and(owned(phrasing), eq(phrasing.id, id)))
        .for("update");
      if (row === undefined) throw new NotFoundError("phrasing", id);
      if (row.currentRevisionId !== expected)
        throw new ConcurrencyConflictError("phrasing", id, toTimestamp(row.updatedAt));
    },
  };
}
