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
  uuidSchema,
} from "@keepcv/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type ApiClient, unwrap } from "../../../lib/api.js";
import { keepEdit, useRecoveryKey } from "../../../lib/edit-recovery.js";
import { STORE_KEY } from "../../../lib/store-cache.js";
import { type PendingFile, retainFiles } from "../model/files.js";

const capabilitiesSchema = agentCapabilitiesSchema;
const eventSchema = z.object({
  type: z.enum(["text", "status", "error", "done", "tool"]),
  text: z.string(),
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
  const [error, setError] = useState("");
  const [disclosed, setDisclosed] = useState(false);
  const [grant, setGrant] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
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
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

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
  async function ensureConversation() {
    if (id !== null) return id;
    const created = agentConversationSchema.parse(
      await unwrap(
        await api.v1.agent.conversations.$post({
          json: { id: newUuid(), title: text.trim().slice(0, 80) || "New conversation" },
        }),
      ),
    );
    setId(created.id);
    return created.id;
  }
  async function send() {
    if (
      busy ||
      decision.current ||
      !enabled ||
      capabilities.data?.available !== true ||
      conversation.data?.archivedAt != null ||
      (!text.trim() && files.length === 0 && selectedAttachments.length === 0) ||
      !disclosed
    )
      return;
    const limits = capabilitiesSchema.parse(capabilities.data);
    const selected = uploaded.data?.filter((file) => selectedAttachments.includes(file.id)) ?? [];
    const sizes = [
      ...files.map((file) => file.file.size),
      ...selected.map((file) => file.sizeBytes ?? 0),
    ];
    if (
      text.length > limits.maxTextCharacters ||
      files.length + selectedAttachments.length > limits.maxAttachments ||
      sizes.some((size) => size > limits.maxFileBytes) ||
      sizes.reduce((sum, bytes) => sum + bytes, 0) > limits.maxTurnBytes
    ) {
      setError(
        "This request exceeds the configured file, text or turn limits. Your input is retained.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setPartial("");
    setStatus("Saving your request");
    setToolCalls([]);
    const submittedText = text;
    const submittedFiles = files;
    try {
      const conversationId = await ensureConversation();
      for (const pending of submittedFiles) {
        fileMetadataSchema.parse(
          await unwrap(
            await api.v1.agent.conversations[":id"].attachments[":fileId"].$post({
              param: { id: conversationId, fileId: pending.id },
              form: { file: pending.file },
            }),
          ),
        );
      }
      const controller = new AbortController();
      request.current = controller;
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
            else if (event.type === "error") setError(event.text);
            else setStatus(event.text);
          }
          end = buffer.indexOf("\n\n");
        }
      }
    } catch (reason) {
      if (!request.current?.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "The request could not finish. Reopen the conversation to check saved changes.",
        );
    } finally {
      setBusy(false);
      request.current = null;
      await refresh();
      setPartial("");
      setToolCalls([]);
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
      setError(
        reason instanceof Error
          ? reason.message
          : "The proposal was not applied. Refresh and review the current data.",
      );
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
      setError(reason instanceof Error ? reason.message : "Permission could not be updated.");
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
      setError(reason instanceof Error ? reason.message : "The file could not be downloaded.");
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
      setError(reason instanceof Error ? reason.message : "The file could not be updated.");
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
      setError(reason instanceof Error ? reason.message : "The conversation could not be updated.");
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
    setError,
    setStatus,
    disclosed,
    setDisclosed,
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
