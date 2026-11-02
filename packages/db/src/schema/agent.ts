import { foreignKey, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { standardColumns } from "./owner.js";
export const agentConversation = pgTable(
  "agent_conversation",
  {
    ...standardColumns(),
    title: text("title").notNull(),
    state: jsonb("state").notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);
export const agentAttachment = pgTable(
  "agent_attachment",
  {
    ...standardColumns(),
    conversationId: uuid("conversation_id").notNull(),
    name: text("name").notNull(),
    mediaType: text("media_type").notNull(),
    data: text("data").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    foreignKey({
      columns: [table.ownerId, table.conversationId],
      foreignColumns: [agentConversation.ownerId, agentConversation.id],
    }).onDelete("cascade"),
  ],
);
