import {
  AgentRefusalError,
  type AgentRuntime,
  ConcurrencyConflictError,
  NotFoundError,
  newUuid,
  type UnitOfWork,
} from "@keepcv/core";
import {
  type AgentAttachment,
  type AgentGrant,
  type AgentMessage,
  type AgentOperation,
  type AgentSource,
  agentOperationSchema,
  type Store,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { z } from "zod";
import { AgentProviderError } from "./openrouter.js";
import { applyOperation } from "./operations.js";

export interface ModelRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  attachments: AgentAttachment[];
  context: string;
  publicResearchQuery: string | undefined;
  signal: AbortSignal;
  text: (text: string) => Promise<void>;
  read: (collection: string, query: string) => Promise<unknown>;
  describe: (resource: string) => unknown;
  propose: (summary: string, operations: unknown[]) => Promise<string>;
}
export interface ModelReply {
  text: string;
  sources: AgentSource[];
  navigation: string | null;
}
export interface AgentModel {
  generate(request: ModelRequest): Promise<ModelReply>;
}

export function readableStore(store: Store): Record<string, unknown[]> {
  return {
    records: store.records,
    organisations: store.organisations,
    points: store.points,
    phrasings: store.phrasings,
    phrasingSets: store.phrasingSets,
    phrasingRevisions: store.phrasingRevisions,
    metrics: store.metrics,
    tags: store.tags,
    recordTags: store.recordTags,
    pointTags: store.pointTags,
    customSections: store.customSections,
    savedFilters: store.savedFilters,
    roleProfiles: store.roleProfiles,
    roleProfileTags: store.roleProfileTags,
    resumes: store.resumes,
    resumeSections: store.resumeSections,
    resumeEntries: store.resumeEntries,
    resumeEntryPoints: store.resumeEntryPoints,
    recordLinks: store.recordLinks,
    recordFields: store.recordFields,
    profile: [store.profile],
    contactChannels: store.contactChannels,
    templates: store.templates.map(({ id, name }) => ({ id, name })),
  };
}

function requiresReview(operations: AgentOperation[]): boolean {
  return (
    operations.length > 1 || operations.some((op) => /\.(archive|restore|merge)$/.test(op.type))
  );
}

export function createAgent(options: {
  unitOfWork: UnitOfWork;
  model: AgentModel;
  disclosure: string;
  deadlineMs?: number;
}): AgentRuntime {
  const active = new Map<string, AbortController>();
  const admitted = new Set<string>();
  const grants = new Map<string, { grant: AgentGrant; expires: number }>();
  const keyOf = (owner: Uuid, conversation: Uuid) => `${owner}:${conversation}`;
  const stamp = () => new Date().toISOString() as Timestamp;
  const unit = options.unitOfWork;

  async function decide(
    owner: Uuid,
    conversationId: Uuid,
    actionId: Uuid,
    accept: boolean,
    authorize?: () => void,
  ) {
    const key = keyOf(owner, conversationId);
    return await unit.run(async (r) => {
      const conversation = await r.agent.get(conversationId, true);
      if (conversation.archivedAt !== null)
        throw new AgentRefusalError("Restore the conversation before applying changes.", 409);
      const action = conversation.actions.find((row) => row.id === actionId);
      if (action === undefined) throw new NotFoundError("proposal", actionId);
      if (action.status !== "pending") return conversation;
      if (!admitted.has(`${key}:${actionId}`))
        throw new AgentRefusalError(
          "Reopen this task and review a new proposal before applying it.",
          409,
        );
      authorize?.();
      if (accept) {
        for (const operation of action.operations) await applyOperation(r, operation);
      }
      authorize?.();
      action.status = accept ? "applied" : "rejected";
      action.receipt = accept ? `Applied ${stamp()}` : `Rejected ${stamp()}`;
      return await r.agent.save(conversation);
    });
  }

  return {
    capabilities: {
      available: true,
      disclosure: options.disclosure,
      maxFileBytes: 16 * 1024 * 1024,
    },
    decide,
    grant(owner, id, grant) {
      const key = keyOf(owner, id);
      if (grant === null) grants.delete(key);
      else grants.set(key, { grant, expires: Date.now() + grant.expiresInSeconds * 1000 });
    },
    cancel(owner, id) {
      active.get(keyOf(owner, id))?.abort();
      grants.delete(keyOf(owner, id));
    },
    close() {
      for (const controller of active.values()) controller.abort();
      grants.clear();
      admitted.clear();
    },
    async turn(owner, conversationId, input, emit, signal) {
      const key = keyOf(owner, conversationId);
      if (active.has(key))
        throw new AgentRefusalError("This conversation already has a running task.", 409);
      if (active.size >= 4)
        throw new AgentRefusalError(
          "The assistant is busy. Try again after a running task finishes.",
          503,
        );
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) controller.abort();
      const timer = setTimeout(abort, options.deadlineMs ?? 90000);
      active.set(key, controller);
      let partial = "";
      let started = false;
      try {
        const conversation = await unit.run(async (r) => {
          const current = await r.agent.get(conversationId, true);
          if (current.messages.some((message) => message.id === input.id)) return null;
          if (
            current.run?.state === "running" &&
            current.run.leaseUntil !== undefined &&
            Date.parse(current.run.leaseUntil) > Date.now() &&
            Date.parse(current.run.leaseUntil) <= Date.now() + 180000
          )
            throw new AgentRefusalError(
              "This conversation has a running task. Stop it or wait for its deadline.",
              409,
            );
          if (current.archivedAt !== null)
            throw new Error("Restore this conversation before sending a message.");
          current.messages.push({
            id: input.id,
            role: "user",
            text: input.text,
            ...(input.publicResearchQuery === undefined
              ? {}
              : { publicResearchQuery: input.publicResearchQuery }),
            attachmentIds: input.attachmentIds,
            sources: [],
            createdAt: stamp(),
            state: "complete",
            navigation: null,
          });
          current.run = {
            id: input.id,
            context: input.context,
            state: "running",
            error: null,
            leaseUntil: new Date(
              Date.now() + (options.deadlineMs ?? 90000),
            ).toISOString() as Timestamp,
          };
          return await r.agent.save(current);
        });
        if (conversation === null) {
          await emit({
            type: "done",
            text: "This message is already saved. Reopen it to see its status.",
          });
          return;
        }
        started = true;
        const attachments = await unit.run(async (r) => {
          const files = await r.agent.attachments(conversationId);
          return input.attachmentIds.map((id) => {
            const file = files.find((row) => row.id === id && row.archivedAt === null);
            if (file === undefined) throw new NotFoundError("attachment", id);
            return file;
          });
        });
        if (
          attachments.reduce((sum, file) => sum + Buffer.byteLength(file.data, "base64"), 0) >
          32 * 1024 * 1024
        )
          throw new Error("Choose attachments totaling at most 32 MiB.");
        await emit({ type: "status", text: "Reading your request" });
        const reply = await options.model.generate({
          messages: conversation.messages
            .slice(-30)
            .map((message) => ({ role: message.role, content: message.text })),
          attachments,
          context: input.context.path,
          publicResearchQuery: input.publicResearchQuery,
          signal: controller.signal,
          text: async (text) => {
            partial += text;
            await emit({ type: "text", text });
          },
          read: async (collection, query) =>
            await unit.run(async (r) => {
              const rows = readableStore(await r.store.readCurrent())[collection];
              if (rows === undefined)
                throw new Error("This resource is not available to the assistant.");
              return rows
                .filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
                .slice(0, 80);
            }),
          describe: (resource) =>
            agentOperationSchema.options
              .filter((schema) => schema.shape.type.value.startsWith(`${resource}.`))
              .map((schema) => z.toJSONSchema(schema)),
          propose: async (summary, values) => {
            controller.signal.throwIfAborted();
            const operations = values.map((value) => agentOperationSchema.parse(value));
            if (operations.length < 1 || operations.length > 20)
              throw new Error("Propose between one and twenty operations.");
            const actionId = await unit.run(async (r) => {
              const current = await r.agent.get(conversationId, true);
              const matching = current.actions.find(
                (action) => JSON.stringify(action.operations) === JSON.stringify(operations),
              );
              if (matching !== undefined) return matching.id;
              const store = readableStore(await r.store.readCurrent());
              const before = operations.map((operation) => {
                const resource = operation.type.split(".")[0] ?? "";
                return {
                  type: operation.type,
                  current:
                    operation.type === "profile.update"
                      ? store["profile"]
                      : "id" in operation
                        ? store[resource]?.find(
                            (row) =>
                              typeof row === "object" &&
                              row !== null &&
                              "id" in row &&
                              row.id === operation.id,
                          )
                        : null,
                };
              });
              const id = newUuid();
              current.actions.push({
                id,
                summary,
                operations,
                status: "pending",
                createdAt: stamp(),
                before: JSON.stringify(before),
                receipt: null,
              });
              await r.agent.save(current);
              return id;
            });
            admitted.add(`${key}:${actionId}`);
            const existingAction = await unit.run(async (r) =>
              (await r.agent.get(conversationId)).actions.find((action) => action.id === actionId),
            );
            if (existingAction?.status === "applied")
              return `Applied proposal ${actionId}. Its existing receipt is retained.`;
            if (existingAction?.status === "rejected")
              return `Proposal ${actionId} was rejected. Ask for revised instructions.`;
            await emit({ type: "status", text: "A proposed change is ready for review" });
            const authority = grants.get(key);
            const allowed =
              authority !== undefined &&
              authority.expires > Date.now() &&
              authority.grant.writes > 0 &&
              !requiresReview(operations) &&
              operations.every(
                (operation) =>
                  authority.grant.resources.includes(operation.type.split(".")[0] ?? "") &&
                  ("id" in operation ? authority.grant.resources.includes(operation.id) : false),
              );
            if (allowed) {
              controller.signal.throwIfAborted();
              authority.grant.writes--;
              await decide(owner, conversationId, actionId, true, () => {
                controller.signal.throwIfAborted();
                if (grants.get(key) !== authority || authority.expires <= Date.now())
                  throw new Error("Task edit permission expired or was revoked.");
              });
              return `Applied proposal ${actionId}. A durable receipt was saved.`;
            }
            return `Proposal ${actionId} is pending. The user must review it; do not claim it was applied.`;
          },
        });
        const message: AgentMessage = {
          id: newUuid(),
          role: "assistant",
          text: reply.text,
          sources: reply.sources,
          navigation: reply.navigation,
          attachmentIds: [],
          createdAt: stamp(),
          state: "complete",
        };
        await unit.run(async (r) => {
          const current = await r.agent.get(conversationId, true);
          current.messages.push(message);
          if (current.run?.id === input.id) current.run.state = "complete";
          await r.agent.save(current);
        });
        await emit({ type: "done", text: "Saved" });
      } catch (error) {
        const message =
          error instanceof AgentProviderError
            ? error.message
            : controller.signal.aborted
              ? "The task stopped. Completed edits remain saved."
              : error instanceof ConcurrencyConflictError
                ? "The data changed. Review the current values before trying again."
                : "The assistant could not finish. Your request and any completed changes remain saved.";
        if (started)
          await unit.run(async (r) => {
            const current = await r.agent.get(conversationId, true);
            current.messages.push({
              id: newUuid(),
              role: "assistant",
              text: partial || message,
              sources: [],
              navigation: null,
              attachmentIds: [],
              createdAt: stamp(),
              state: "interrupted",
            });
            if (current.run?.id === input.id) {
              current.run.state = controller.signal.aborted ? "cancelled" : "failed";
              current.run.error = message;
            }
            await r.agent.save(current);
          });
        await emit({ type: "error", text: message });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        active.delete(key);
      }
    },
  };
}
