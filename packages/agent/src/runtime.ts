import {
  AgentRefusalError,
  type AgentRuntime,
  ConcurrencyConflictError,
  hasRunningAgentLease,
  NotFoundError,
  newUuid,
  type UnitOfWork,
} from "@keepcv/core";
import {
  type AgentAttachment,
  type AgentGrant,
  type AgentLimits,
  type AgentMessage,
  type AgentOperation,
  type AgentSource,
  type AgentToolCall,
  agentLimitsSchema,
  agentOperationSchema,
  agentToolCallSchema,
  type Store,
  type Timestamp,
  type Uuid,
} from "@keepcv/schema";
import { z } from "zod";
import { AgentProviderError } from "./openrouter.js";
import { applyOperation } from "./operations.js";

export interface ModelRequest {
  authorize?: () => Promise<void>;
  runId?: Uuid;
  messages: { role: "user" | "assistant"; content: string }[];
  attachments: AgentAttachment[];
  context: string;
  publicResearchQuery: string | undefined;
  signal: AbortSignal;
  text: (text: string) => Promise<void>;
  tool?: (name: string, summary: string) => Promise<void>;
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

export interface AgentAuthorization {
  ownerId: Uuid;
  conversationId: Uuid;
  scope: string | undefined;
  phase: "generate" | "read" | "propose" | "apply";
  signal: AbortSignal;
  operations?: readonly AgentOperation[];
}

async function whileActive<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return work();
      }),
      stopped,
    ]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

const AUTHORITY_CAPACITY = 128;
const REVIEW_WINDOW_MS = 30 * 60 * 1000;

export function createAgent(options: {
  unitOfWork: UnitOfWork;
  model: AgentModel;
  disclosure: string;
  deadlineMs?: number;
  limits?: Partial<AgentLimits>;
  authorize?: (context: AgentAuthorization) => Promise<void>;
}): AgentRuntime & { revoke(ownerId: Uuid, scope: string): void } {
  const limits = agentLimitsSchema.parse(options.limits ?? {});
  const deadlineMs = z
    .number()
    .int()
    .min(1)
    .max(180000)
    .parse(options.deadlineMs ?? 90000);
  const active = new Map<string, { controller: AbortController; scope: string | undefined }>();
  const admitted = new Map<
    string,
    { controller: AbortController; scope: string | undefined; expires: number }
  >();
  const grants = new Map<
    string,
    { grant: AgentGrant; expires: number; scope: string | undefined }
  >();
  const revoked = new Set<string>();
  const keyOf = (owner: Uuid, conversation: Uuid) => `${owner}:${conversation}`;
  const stamp = () => new Date().toISOString() as Timestamp;
  const unit = options.unitOfWork;
  const capabilities = { available: true, disclosure: options.disclosure, ...limits };
  let closed: string | null = null;

  function prune() {
    const now = Date.now();
    for (const [key, entry] of grants) if (entry.expires <= now) grants.delete(key);
    for (const [key, entry] of admitted)
      if (entry.expires <= now || entry.controller.signal.aborted) {
        entry.controller.abort(
          new AgentRefusalError(
            "The review window expired. Start a fresh task and review the proposal again.",
            409,
          ),
        );
        admitted.delete(key);
      }
  }
  const sweep = setInterval(prune, 60000);
  sweep.unref();

  function requireOpen() {
    if (closed !== null) throw new AgentRefusalError(closed, 503);
  }
  function close(reason = "This runtime is closed. Create a fresh authorized runtime.") {
    closed = reason;
    capabilities.available = false;
    clearInterval(sweep);
    for (const entry of active.values()) entry.controller.abort();
    for (const entry of admitted.values()) entry.controller.abort();
    active.clear();
    admitted.clear();
    grants.clear();
    revoked.clear();
  }

  async function check(context: AgentAuthorization) {
    prune();
    requireOpen();
    context.signal.throwIfAborted();
    if (
      context.scope !== undefined &&
      revoked.has(JSON.stringify([context.ownerId, context.scope]))
    )
      throw new AgentRefusalError("Task authority was revoked.", 403);
    try {
      await options.authorize?.(context);
    } catch {
      active.get(keyOf(context.ownerId, context.conversationId))?.controller.abort();
      grants.delete(keyOf(context.ownerId, context.conversationId));
      for (const [key, entry] of admitted)
        if (key.startsWith(`${keyOf(context.ownerId, context.conversationId)}:`)) {
          entry.controller.abort();
          admitted.delete(key);
        }
      throw new AgentRefusalError("Task authority was refused.", 403);
    }
    prune();
    requireOpen();
    context.signal.throwIfAborted();
    if (
      context.scope !== undefined &&
      revoked.has(JSON.stringify([context.ownerId, context.scope]))
    )
      throw new AgentRefusalError("Task authority was revoked.", 403);
  }

  async function decide(
    owner: Uuid,
    conversationId: Uuid,
    actionId: Uuid,
    accept: boolean,
    scope?: string,
    authorize?: () => void,
  ) {
    prune();
    const key = keyOf(owner, conversationId);
    const actionKey = `${key}:${actionId}`;
    const admission = admitted.get(actionKey);
    const signal = admission?.controller.signal ?? new AbortController().signal;
    const context = { ownerId: owner, conversationId, scope, signal };
    await check({ ...context, phase: "read" });
    function requireAdmission() {
      if (
        admission === undefined ||
        admitted.get(actionKey) !== admission ||
        admission.scope !== scope
      )
        throw new AgentRefusalError(
          "Start a fresh task and review a new proposal before applying it.",
          409,
        );
    }
    async function admitChanges(operations: AgentOperation[]) {
      requireAdmission();
      await check({ ...context, phase: "apply", operations });
      requireAdmission();
    }
    const decided = await unit.run(
      async (r) => {
        const conversation = await r.agent.get(conversationId, true);
        if (conversation.archivedAt !== null)
          throw new AgentRefusalError("Restore the conversation before applying changes.", 409);
        const action = conversation.actions.find((row) => row.id === actionId);
        if (action === undefined) throw new NotFoundError("proposal", actionId);
        if (action.status !== "pending") return conversation;
        await admitChanges(action.operations);
        authorize?.();
        if (accept) {
          for (const operation of action.operations) {
            await admitChanges([operation]);
            await applyOperation(r, operation);
          }
        }
        await admitChanges(action.operations);
        authorize?.();
        action.status = accept ? "applied" : "rejected";
        action.receipt = accept ? `Applied ${stamp()}` : `Rejected ${stamp()}`;
        return await r.agent.save(conversation);
      },
      { signal },
    );
    admitted.delete(actionKey);
    return decided;
  }

  return {
    capabilities,
    decide,
    grant(owner, id, grant, scope) {
      prune();
      const key = keyOf(owner, id);
      if (grant === null) {
        grants.delete(key);
        return;
      }
      requireOpen();
      if (scope !== undefined && revoked.has(JSON.stringify([owner, scope])))
        throw new AgentRefusalError("Task authority was revoked.", 403);
      if (!grants.has(key) && grants.size >= AUTHORITY_CAPACITY)
        throw new AgentRefusalError(
          "Too many temporary grants. Revoke a grant or wait for expiry.",
          503,
        );
      grants.set(key, { grant, expires: Date.now() + grant.expiresInSeconds * 1000, scope });
    },
    cancel(owner, id) {
      prune();
      const task = active.get(keyOf(owner, id));
      task?.controller.abort();
      for (const [key, entry] of admitted) {
        if (key.startsWith(`${keyOf(owner, id)}:`)) {
          entry.controller.abort();
          admitted.delete(key);
        }
      }
      grants.delete(keyOf(owner, id));
      return task !== undefined;
    },
    revoke(owner, scope) {
      prune();
      if (closed !== null) return;
      const scopeKey = JSON.stringify([owner, scope]);
      if (!revoked.has(scopeKey) && revoked.size >= AUTHORITY_CAPACITY) {
        close("Revocation capacity reached. Create a fresh runtime with current authorization.");
        return;
      }
      revoked.add(scopeKey);
      for (const [key, entry] of active)
        if (key.startsWith(`${owner}:`) && entry.scope === scope) entry.controller.abort();
      for (const [key, entry] of admitted)
        if (key.startsWith(`${owner}:`) && entry.scope === scope) {
          entry.controller.abort();
          admitted.delete(key);
        }
      for (const [key, entry] of grants)
        if (key.startsWith(`${owner}:`) && entry.scope === scope) grants.delete(key);
    },
    close: () => close(),
    async turn(owner, conversationId, input, emit, signal, scope) {
      requireOpen();
      prune();
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
      const timer = setTimeout(abort, deadlineMs);
      active.set(key, { controller, scope });
      const reviewExpires = Date.now() + REVIEW_WINDOW_MS;
      const context = { ownerId: owner, conversationId, scope, signal: controller.signal };
      let partial = "";
      const toolCalls: AgentToolCall[] = [];
      let started = false;
      try {
        await check({ ...context, phase: "generate" });
        if (
          input.text.length > limits.maxTextCharacters ||
          input.attachmentIds.length > limits.maxAttachments
        )
          throw new AgentRefusalError("This request exceeds the configured turn limits.", 413);
        await check({ ...context, phase: "read" });
        const conversation = await unit.run(async (r) => {
          const current = await r.agent.get(conversationId, true);
          if (current.messages.some((message) => message.id === input.id)) return null;
          if (hasRunningAgentLease(current.run, Date.now()))
            throw new AgentRefusalError(
              "This conversation has a running lease. Stop it in the process executing the task or wait for lease expiry.",
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
            leaseUntil: new Date(Date.now() + deadlineMs).toISOString() as Timestamp,
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
        await check({ ...context, phase: "read" });
        const attachments = await unit.run(async (r) => {
          const files = await r.agent.attachments(conversationId);
          return input.attachmentIds.map((id) => {
            const file = files.find((row) => row.id === id && row.archivedAt === null);
            if (file === undefined) throw new NotFoundError("attachment", id);
            return file;
          });
        });
        if (
          attachments.some(
            (file) =>
              Buffer.byteLength(file.data, "base64") >
              Math.min(
                limits.maxFileBytes,
                file.mediaType === "text/plain" ? limits.maxTextFileBytes : limits.maxFileBytes,
              ),
          )
        )
          throw new AgentRefusalError(
            "A selected attachment exceeds the configured file limit.",
            413,
          );
        if (
          attachments.reduce((sum, file) => sum + Buffer.byteLength(file.data, "base64"), 0) >
          limits.maxTurnBytes
        )
          throw new AgentRefusalError(
            "The selected attachments exceed the configured turn byte limit.",
            413,
          );
        await emit({ type: "status", text: "Reading your request" });
        await check({ ...context, phase: "generate" });
        const reply = await whileActive(
          () =>
            options.model.generate({
              runId: input.id,
              authorize: async () => await check({ ...context, phase: "generate" }),
              messages: conversation.messages
                .slice(-30)
                .map((message) => ({ role: message.role, content: message.text })),
              attachments,
              context: input.context.path,
              publicResearchQuery: input.publicResearchQuery,
              signal: controller.signal,
              text: async (text) => {
                await check({ ...context, phase: "generate" });
                partial += text;
                await emit({ type: "text", text });
              },
              tool: async (name, summary) => {
                await check({ ...context, phase: "generate" });
                if (toolCalls.length >= 128)
                  throw new AgentRefusalError("The task reached its tool activity limit.");
                const call = agentToolCallSchema.parse({ name, summary });
                toolCalls.push(call);
                await emit({ type: "tool", text: JSON.stringify(call) });
              },
              read: async (collection, query) => {
                await check({ ...context, phase: "read" });
                const result = await unit.run(async (r) => {
                  const rows = readableStore(await r.store.readCurrent())[collection];
                  if (rows === undefined)
                    throw new Error("This resource is not available to the assistant.");
                  return rows
                    .filter((row) =>
                      JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
                    )
                    .slice(0, 80);
                });
                await check({ ...context, phase: "read" });
                return result;
              },
              describe: (resource) =>
                agentOperationSchema.options
                  .filter((schema) => schema.shape.type.value.startsWith(`${resource}.`))
                  .map((schema) => z.toJSONSchema(schema)),
              propose: async (summary, values) => {
                await check({ ...context, phase: "propose" });
                const operations = values.map((value) => agentOperationSchema.parse(value));
                if (operations.length < 1 || operations.length > 20)
                  throw new Error("Propose between one and twenty operations.");
                const actionId = await unit.run(
                  async (r) => {
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
                    await check({ ...context, phase: "propose", operations });
                    await r.agent.save(current);
                    return id;
                  },
                  { signal: controller.signal },
                );
                await check({ ...context, phase: "propose", operations });
                const terminal = await unit.run(
                  async (r) => {
                    const action = (await r.agent.get(conversationId, true)).actions.find(
                      (row) => row.id === actionId,
                    );
                    if (action !== undefined && action.status !== "pending")
                      admitted.delete(`${key}:${actionId}`);
                    if (action?.status === "applied")
                      return `Applied proposal ${actionId}. Its existing receipt is retained.`;
                    if (action?.status === "rejected")
                      return `Proposal ${actionId} was rejected. Ask for revised instructions.`;
                    await check({ ...context, phase: "propose", operations });
                    if (!admitted.has(`${key}:${actionId}`) && admitted.size >= AUTHORITY_CAPACITY)
                      throw new AgentRefusalError(
                        "Too many proposals awaiting review. Decide a proposal or wait for its review window to expire, then request fresh review.",
                        503,
                      );
                    admitted.set(`${key}:${actionId}`, {
                      controller,
                      scope,
                      expires: reviewExpires,
                    });
                    return null;
                  },
                  { signal: controller.signal },
                );
                if (terminal !== null) return terminal;
                await emit({ type: "status", text: "A proposed change is ready for review" });
                const authority = grants.get(key);
                const allowed =
                  authority !== undefined &&
                  authority.scope === scope &&
                  authority.expires > Date.now() &&
                  authority.grant.writes > 0 &&
                  !requiresReview(operations) &&
                  operations.every(
                    (operation) =>
                      authority.grant.resources.includes(operation.type.split(".")[0] ?? "") &&
                      ("id" in operation
                        ? authority.grant.resources.includes(operation.id)
                        : false),
                  );
                if (allowed) {
                  controller.signal.throwIfAborted();
                  authority.grant.writes--;
                  try {
                    await decide(owner, conversationId, actionId, true, scope, () => {
                      controller.signal.throwIfAborted();
                      if (grants.get(key) !== authority || authority.expires <= Date.now())
                        throw new Error("Task edit permission expired or was revoked.");
                    });
                  } finally {
                    if (authority.grant.writes === 0 && grants.get(key) === authority)
                      grants.delete(key);
                  }
                  return `Applied proposal ${actionId}. A durable receipt was saved.`;
                }
                return `Proposal ${actionId} is pending. The user must review it; do not claim it was applied.`;
              },
            }),
          controller.signal,
        );
        await check({ ...context, phase: "generate" });
        const message: AgentMessage = {
          id: newUuid(),
          role: "assistant",
          text: reply.text,
          sources: reply.sources,
          toolCalls,
          navigation: reply.navigation,
          attachmentIds: [],
          createdAt: stamp(),
          state: "complete",
        };
        await unit.run(
          async (r) => {
            const current = await r.agent.get(conversationId, true);
            await check({ ...context, phase: "generate" });
            current.messages.push(message);
            if (current.run?.id === input.id) current.run.state = "complete";
            await r.agent.save(current);
          },
          { signal: controller.signal },
        );
        await emit({ type: "done", text: "Saved" });
      } catch (error) {
        const message =
          error instanceof AgentProviderError || error instanceof AgentRefusalError
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
              toolCalls,
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
