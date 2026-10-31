import { AgentRefusalError, newUuid } from "@keepcv/core";
import { expect, it } from "vitest";
import { attachmentInput } from "./agent-attachments.js";

it("detects image bytes independently of filenames and keeps the original bytes", async () => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  const file = await attachmentInput(newUuid(), newUuid(), "notes.txt", bytes);
  expect(file.mediaType).toBe("image/png");
  expect(Buffer.from(file.data, "base64")).toEqual(bytes);
});

it("refuses incomplete binary headers as invalid uploads", async () => {
  await expect(
    attachmentInput(
      newUuid(),
      newUuid(),
      "broken.png",
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ),
  ).rejects.toBeInstanceOf(AgentRefusalError);
});

it("strictly decodes UTF-8 and refuses invalid text and empty files", async () => {
  const file = await attachmentInput(
    newUuid(),
    newUuid(),
    "notes.asc",
    new TextEncoder().encode("ASCII and caf\u00e9"),
  );
  expect(file.mediaType).toBe("text/plain");
  await expect(
    attachmentInput(newUuid(), newUuid(), "notes.txt", Uint8Array.from([255])),
  ).rejects.toBeInstanceOf(AgentRefusalError);
  await expect(
    attachmentInput(newUuid(), newUuid(), "empty.txt", new Uint8Array()),
  ).rejects.toMatchObject({ status: 413 });
});
