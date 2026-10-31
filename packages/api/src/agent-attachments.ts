import { AgentRefusalError } from "@keepcv/core";
import { type AgentAttachment, agentAttachmentSchema, type Uuid } from "@keepcv/schema";
import { fileTypeFromBuffer } from "file-type";

export async function attachmentInput(
  id: Uuid,
  conversationId: Uuid,
  name: string,
  bytes: Uint8Array,
): Promise<Omit<AgentAttachment, "createdAt" | "updatedAt" | "archivedAt">> {
  if (bytes.length === 0 || bytes.length > 16 * 1024 * 1024)
    throw new AgentRefusalError("Choose a non-empty file of at most 16 MiB.", 413);
  const detected = await fileTypeFromBuffer(bytes);
  let mediaType = detected?.mime;
  if (mediaType === undefined) {
    if (bytes.length > 1024 * 1024 || bytes.includes(0))
      throw new AgentRefusalError("Choose a UTF-8 text file of at most 1 MiB.");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AgentRefusalError(
        "That text file is not valid UTF-8. Save it as UTF-8 and attach it again.",
      );
    }
    mediaType = "text/plain";
  }
  const input = agentAttachmentSchema
    .omit({ createdAt: true, updatedAt: true, archivedAt: true })
    .parse({
      id,
      conversationId,
      name: Array.from(name, (c) => (c.charCodeAt(0) < 32 || c === "/" || c === "\\" ? "_" : c))
        .join("")
        .slice(0, 255),
      mediaType,
      data: Buffer.from(bytes).toString("base64"),
    });
  return input;
}
