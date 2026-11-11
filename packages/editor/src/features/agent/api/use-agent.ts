import { newUuid } from "@keepcv/core";
import {
  type AgentAction,
  type AgentConversation,
  type AgentToolCall,
  agentAttachmentMetadataSchema,
  agentCapabilitiesSchema,
  agentConversationSchema,
  agentConversationSummarySchema,
  agentToolCallSchema,
  problemSchema,
  uuidSchema,
} from "@keepcv/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type ApiClient, ProblemError, unwrap } from "../../../lib/api.js";
import { keepEdit, useRecoveryKey } from "../../../lib/edit-recovery.js";
import { STORE_KEY } from "../../../lib/store-cache.js";
import { generationMediaType, type PendingFile, retainFiles } from "../model/files.js";

const capabilitiesSchema = agentCapabilitiesSchema;
const eventSchema = z.object({
  type: z.enum(["text", "status", "error", "done", "tool"]),
  text: z.string(),
  problem: problemSchema.optional(),
  retryAfter: z.string().optional(),
});
const fileMetadataSchema = agentAttachmentMetadataSchema;
export function useAgentController(api: ApiClient, enabled = true) {
  const queries = useQueryClient();
  const recoveryKey = useRecoveryKey("keepcv.chat.composer");
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [id, setId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const decision = useRef(false);
  const [status, setStatus] = useState("");
  const [partial, setPartial] = useState("");
  const [toolCalls, setToolCalls] = useState<AgentToolCall[]>([]);
  const [failure, setError] = useState<unknown>("");
  const error =
    typeof failure === "string"
      ? failure
      : failure instanceof Error
        ? failure.message
        : "The request could not finish.";
  const [acceptedScope, setAcceptedScope] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const pendingConsent = useRef<{ draft: string; scope: string } | null>(null);
  const checking = useRef(false);
  const intentVersion = useRef(0);
  const sending = useRef(false);
  const mounted = useRef(true);
  const [grant, setGrant] = useState(false);
  const [webSearchEnabled, changeWebSearchEnabled] = useState(true);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const contextPath = sourcePath ?? path;
  const currentText = useRef(text);
  currentText.current = text;
  const currentFiles = useRef(files);
  currentFiles.current = files;
  const request = useRef<AbortController | null>(null);
  const capabilities = useQuery({
    queryKey: ["agent", "capabilities"],
    enabled: path === "/conversations" || (enabled && (path === "/" || path === "/assistant")),
    retry: false,
    queryFn: async () =>
      capabilitiesSchema.parse(await unwrap(await api.v1.agent.capabilities.$get())),
  });
  const conversations = useQuery({
    queryKey: ["agent", "conversations"],
    notifyOnChangeProps: ["data", "error", "isPending", "isError"],
    enabled: path === "/conversations" || (enabled && (path === "/" || path === "/assistant")),
    retry: false,
    queryFn: async () =>
      z
        .object({ items: z.array(agentConversationSummarySchema) })
        .parse(await unwrap(await api.v1.agent.conversations.$get())).items,
  });
  const conversation = useQuery({
    queryKey: ["agent", "conversation", id],
    enabled: id !== null,
    queryFn: async () =>
      agentConversationSchema.parse(
        await unwrap(await api.v1.agent.conversations[":id"].$get({ param: { id: id ?? "" } })),
      ),
  });
  const uploaded = useQuery({
    queryKey: ["agent", "files", id],
    enabled: id !== null,
    queryFn: async () =>
      z
        .object({ items: z.array(fileMetadataSchema) })
        .parse(
          await unwrap(
            await api.v1.agent.conversations[":id"].attachments.$get({ param: { id: id ?? "" } }),
          ),
        ).items,
  });
  const scopeOf = (data: z.infer<typeof capabilitiesSchema> | undefined, web = webSearchEnabled) =>
    JSON.stringify([
      recoveryKey,
      data?.disclosure,
      data?.generationMediaTypes,
      data?.webSearchAvailable,
      web,
    ]);
  const sharingScope = scopeOf(capabilities.data);
  const disclosed = acceptedScope === sharingScope;
  useEffect(
    () => setAcceptedScope((previous) => (previous === sharingScope ? previous : null)),
    [sharingScope],
  );
  const draftIdentity = JSON.stringify([
    id,
    text,
    files.map(({ id }) => id),
    selectedAttachments,
    contextPath,
    enabled,
    conversation.data?.archivedAt,
  ]);
  const latest = useRef({ draftIdentity, sharingScope });
  latest.current = { draftIdentity, sharingScope };
  function setWebSearchEnabled(value: boolean) {
    changeWebSearchEnabled(value);
    if (pendingConsent.current !== null)
      pendingConsent.current.scope = scopeOf(capabilities.data, value);
  }
  function setDisclosed(value: boolean) {
    setAcceptedScope(value ? sharingScope : null);
  }
  function closeConsent() {
    intentVersion.current++;
    pendingConsent.current = null;
    setConsent(false);
    document.getElementById("agent-message")?.focus();
  }
  const grantScope = id === null ? null : `${id}:${contextPath}`;
  useEffect(() => {
    setSelectedAttachments([]);
    setGrant(false);
    if (enabled && capabilities.data?.available === true && grantScope !== null && id !== null)
      void api.v1.agent.conversations[":id"].grant
        .$put({ param: { id }, json: { grant: null } })
        .then(unwrap)
        .catch(() =>
          setError(
            "Task access could not be revoked. Stop the conversation or wait for its permission to expire.",
          ),
        );
    return () => {
      if (enabled && capabilities.data?.available === true && id !== null)
        void api.v1.agent.conversations[":id"].grant
          .$put({ param: { id }, json: { grant: null } })
          .then(unwrap)
          .catch(() =>
            setError(
              "Task access could not be revoked. Stop the conversation or wait for its permission to expire.",
            ),
          );
    };
  }, [api, id, grantScope, enabled, capabilities.data?.available]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingConsent.current = null;
      request.current?.abort();
    };
  }, []);

  function changeText(value: string) {
    setText(value);
    keepEdit(recoveryKey, value);
  }
  function changeFiles(value: PendingFile[]) {
    setFiles(value);
    void retainFiles(recoveryKey, value).catch(() =>
      setError(
        "Attachments remain in this tab, but browser recovery is unavailable. Send them before closing.",
      ),
    );
  }
  async function refresh() {
    if (queries.isMutating() > 0)
      await new Promise<void>((resolve) => {
        const unsubscribe = queries.getMutationCache().subscribe(() => {
          if (queries.isMutating() === 0) {
            unsubscribe();
            resolve();
          }
        });
      });
    await Promise.all([
      queries.invalidateQueries({ queryKey: ["agent"] }),
      queries.invalidateQueries({ queryKey: STORE_KEY }),
    ]);
  }
  async function ensureConversation(signal: AbortSignal) {
    if (id !== null) return id;
    const created = agentConversationSchema.parse(
      await unwrap(
        await api.v1.agent.conversations.$post(
          {
            json: { id: newUuid(), title: text.trim().slice(0, 80) || "New conversation" },
          },
          { init: { signal } },
        ),
      ),
    );
    signal.throwIfAborted();
    setId(created.id);
    return created.id;
  }
  async function submit(affirmed: boolean, limits: z.infer<typeof capabilitiesSchema>) {
    if (
      !mounted.current ||
      sending.current ||
      busy ||
      decision.current ||
      !enabled ||
      limits.available !== true ||
      conversation.data?.archivedAt != null ||
      (!text.trim() && files.length === 0 && selectedAttachments.length === 0)
    )
      return;
    const scope = scopeOf(limits);
    const selected = uploaded.data?.filter((file) => selectedAttachments.includes(file.id)) ?? [];
    if (
      files.some(
        ({ file }) =>
          !limits.generationMediaTypes.includes(
            generationMediaType(file) as (typeof limits.generationMediaTypes)[number],
          ),
      ) ||
      selected.some((file) => !limits.generationMediaTypes.includes(file.mediaType))
    ) {
      setError("A selected file format is unavailable for generation. Your input is retained.");
      return;
    }
    const sizes = [
      ...files.map((file) => file.file.size),
      ...selected.map((file) => file.sizeBytes ?? 0),
    ];
    if (
      text.length > limits.maxTextCharacters ||
      files.length + selectedAttachments.length > limits.maxAttachments ||
      sizes.some((size) => size > limits.maxFileBytes) ||
      files.some(
        ({ file }) =>
          generationMediaType(file) === "text/plain" && file.size > limits.maxTextFileBytes,
      ) ||
      selected.some(
        (file) =>
          file.mediaType === "text/plain" && (file.sizeBytes ?? 0) > limits.maxTextFileBytes,
      ) ||
      sizes.reduce((sum, bytes) => sum + bytes, 0) > limits.maxTurnBytes
    ) {
      setError(
        "This request exceeds the configured file, text or turn limits. Your input is retained.",
      );
      return;
    }
    if (affirmed && pendingConsent.current?.draft !== latest.current.draftIdentity)
      return closeConsent();
    if (
      (!affirmed && acceptedScope !== scope) ||
      (affirmed && pendingConsent.current?.scope !== scope)
    ) {
      setAcceptedScope(null);
      pendingConsent.current = { draft: draftIdentity, scope };
      setConsent(true);
      return;
    }
    if (affirmed) {
      pendingConsent.current = null;
      setConsent(false);
      setAcceptedScope(scope);
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setPartial("");
    setStatus("Saving your request");
    setToolCalls([]);
    const submittedText = text;
    const submittedFiles = files;
    const submittedScope = scope;
    const controller = new AbortController();
    request.current = controller;
    try {
      const conversationId = await ensureConversation(controller.signal);
      controller.signal.throwIfAborted();
      for (const pending of submittedFiles) {
        fileMetadataSchema.parse(
          await unwrap(
            await api.v1.agent.conversations[":id"].attachments[":fileId"].$post(
              {
                param: { id: conversationId, fileId: pending.id },
                form: { file: pending.file },
              },
              { init: { signal: controller.signal } },
            ),
          ),
        );
      }
      controller.signal.throwIfAborted();
      if (!mounted.current || latest.current.sharingScope !== submittedScope)
        throw new Error(
          "The sharing scope changed. Review the current disclosure before sending again.",
        );
      const response = await api.v1.agent.conversations[":id"].turns.$post(
        {
          param: { id: conversationId },
          json: {
            id: newUuid(),
            text: submittedText,
            attachmentIds: [...selectedAttachments, ...submittedFiles.map((file) => file.id)].map(
              (id) => uuidSchema.parse(id),
            ),
            context: {
              path: contextPath,
              ...(contextPath.split("/")[2]?.match(/^[a-f0-9-]{36}$/)
                ? { resourceId: uuidSchema.parse(contextPath.split("/")[2]) }
                : {}),
            },
            disclosure: true,
            webSearchEnabled: webSearchEnabled && capabilities.data?.webSearchAvailable === true,
          },
        },
        { init: { signal: controller.signal } },
      );
      if (!response.ok) await unwrap(response);
      let acknowledged = false;
      let terminal = false;
      const reader: ReadableStreamDefaultReader<Uint8Array> | undefined =
        response.body?.getReader();
      if (reader === undefined) throw new Error("The assistant returned no response stream.");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        if (buffer.length > 1024 * 1024)
          throw new Error("The assistant response exceeded its streaming budget.");
        let end = buffer.indexOf("\n\n");
        while (end >= 0) {
          const packet = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = packet.split("\n").find((line) => line.startsWith("data: "));
          if (data !== undefined) {
            const event = eventSchema.parse(JSON.parse(data.slice(6)));
            if (event.type === "done" || event.type === "error") terminal = true;
            if (!acknowledged && event.type === "status") {
              acknowledged = true;
              void queries.invalidateQueries({
                queryKey: ["agent", "conversation", conversationId],
              });
              void queries.invalidateQueries({ queryKey: ["agent", "files", conversationId] });
              if (currentText.current === submittedText) changeText("");
              if (submittedFiles.length > 0 && currentFiles.current === submittedFiles)
                changeFiles([]);
            }
            if (event.type === "tool")
              setToolCalls((calls) => [
                ...calls,
                agentToolCallSchema.parse(JSON.parse(event.text)),
              ]);
            else if (event.type === "text") setPartial((text) => text + event.text);
            else if (event.type === "error")
              setError(
                event.problem === undefined
                  ? event.text
                  : new ProblemError(event.problem, event.retryAfter),
              );
            else setStatus(event.text);
          }
          end = buffer.indexOf("\n\n");
        }
      }
      if (!terminal)
        throw new Error(
          "The assistant response was interrupted. Reopen the conversation to check saved changes before sending again.",
        );
    } catch (reason) {
      if (!request.current?.signal.aborted) setError(reason);
    } finally {
      sending.current = false;
      setBusy(false);
      request.current = null;
      await refresh();
      setPartial("");
      setToolCalls([]);
    }
  }
  async function send(affirmed = false) {
    if (
      checking.current ||
      sending.current ||
      busy ||
      decision.current ||
      !enabled ||
      capabilities.data?.available !== true ||
      conversation.data?.archivedAt != null ||
      (!text.trim() && files.length === 0 && selectedAttachments.length === 0)
    )
      return;
    const version = intentVersion.current;
    checking.current = true;
    try {
      const fresh = await capabilities.refetch({ throwOnError: true });
      if (!mounted.current || version !== intentVersion.current) return;
      if (draftIdentity !== latest.current.draftIdentity) return closeConsent();
      if (fresh.data?.available !== true) return closeConsent();
      await submit(affirmed, fresh.data);
    } catch (reason) {
      if (mounted.current) setError(reason);
    } finally {
      checking.current = false;
    }
  }
  async function decide(action: AgentAction, accept: boolean) {
    if (id === null || busy || decision.current || !enabled) return;
    decision.current = true;
    setDeciding(action.id);
    setError("");
    try {
      const next = agentConversationSchema.parse(
        await unwrap(
          await api.v1.agent.conversations[":id"].actions[":actionId"].$post({
            param: { id, actionId: action.id },
            json: { accept },
          }),
        ),
      );
      queries.setQueryData(["agent", "conversation", id], next);
      setStatus(
        accept
          ? "Changes saved. The receipt is retained."
          : "Suggestion rejected. Your data is unchanged.",
      );
      await refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      decision.current = false;
      setDeciding(null);
    }
  }
  async function stop() {
    setStopping(true);
    try {
      if (id !== null)
        await unwrap(await api.v1.agent.conversations[":id"].cancel.$post({ param: { id } }));
      request.current?.abort();
      setGrant(false);
      setStatus("Stop requested. Completed edits remain saved.");
    } finally {
      setStopping(false);
    }
  }
  async function authorize() {
    const resource = contextPath.split("/")[1];
    const target = contextPath.split("/")[2];
    if (
      id === null ||
      resource === undefined ||
      target === undefined ||
      !uuidSchema.safeParse(target).success
    ) {
      setError(
        "Open a saved record, Point or resume and start a conversation to authorize edits to that resource.",
      );
      return;
    }
    try {
      await unwrap(
        await api.v1.agent.conversations[":id"].grant.$put({
          param: { id },
          json: {
            grant: grant
              ? null
              : { resources: [resource, target], expiresInSeconds: 600, writes: 5 },
          },
        }),
      );
      setGrant(!grant);
    } catch (reason) {
      setError(reason);
    }
  }
  async function downloadFile(fileId: string, name: string) {
    if (id === null) return;
    try {
      const response = await api.v1.agent.conversations[":id"].attachments[":fileId"].$get({
        param: { id, fileId },
      });
      if (!response.ok) await unwrap(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason);
    }
  }
  async function archiveFile(fileId: string, expectedUpdatedAt: string, archived: boolean) {
    if (id === null) return;
    try {
      await unwrap(
        await api.v1.agent.conversations[":id"].attachments[":fileId"].$patch({
          param: { id, fileId },
          json: { expectedUpdatedAt, archived },
        }),
      );
      setSelectedAttachments((values) => values.filter((value) => value !== fileId));
      await refresh();
    } catch (reason) {
      setError(reason);
    }
  }
  async function archive(value: AgentConversation) {
    try {
      await unwrap(
        await api.v1.agent.conversations[":id"].$patch({
          param: { id: value.id },
          json: { expectedUpdatedAt: value.updatedAt, archived: value.archivedAt === null },
        }),
      );
      await refresh();
    } catch (reason) {
      setError(reason);
    }
  }
  return {
    enabled,
    canGenerate: enabled && capabilities.data?.available === true,
    id,
    setId: (value: string | null) => {
      setId(value);
      setSourcePath(null);
      setError("");
      setStatus("");
    },
    startFromPage: () => {
      setId(null);
      setSourcePath(path);
      setError("");
      setStatus("");
      setPartial("");
      setToolCalls([]);
      setSelectedAttachments([]);
      setGrant(false);
    },
    sourcePath,
    contextPath,
    clearPageContext: () => setSourcePath(null),
    deciding,
    stopping,
    text,
    changeText,
    files,
    changeFiles,
    busy,
    status,
    partial,
    toolCalls,
    error,
    failure,
    setError,
    setStatus,
    disclosed,
    setDisclosed,
    consent,
    closeConsent,
    allowAndSend: () => send(true),
    webSearchEnabled,
    setWebSearchEnabled,
    grant,
    authorize,
    capabilities,
    conversations,
    conversation,
    uploaded,
    selectedAttachments,
    setSelectedAttachments,
    send,
    decide,
    stop,
    archive,
    downloadFile,
    archiveFile,
    path,
    recoveryKey,
  };
}
