import { expect, it } from "vitest";
import { templateDataSchema } from "../document/template-data.js";
import {
  htmlTemplatePayloadSchema,
  templateDefinitionSchema,
  templatePathSchema,
} from "./template-definition.js";

it.each([
  "../main.html",
  "assets/../main.html",
  "/main.html",
  "C:/main.html",
  "a//b",
  "CON.html",
  "__proto__",
  "name.",
  "a\\b",
])("refuses unsafe bundle path %s", (path) => {
  expect(templatePathSchema.safeParse(path).success).toBe(false);
});

it("rejects case aliases and source budgets in decoded UTF-8 bytes", () => {
  const payload = {
    documentVersions: [1],
    entry: "index.html",
    styles: [],
    page: { size: "a4", marginMm: 14 },
    files: {
      "index.html": { mediaType: "text/html", encoding: "utf8", content: "x" },
      "INDEX.html": { mediaType: "text/html", encoding: "utf8", content: "x" },
    },
  };
  expect(htmlTemplatePayloadSchema.safeParse(payload).success).toBe(false);
  expect(
    htmlTemplatePayloadSchema.safeParse({
      ...payload,
      files: {
        "index.html": {
          mediaType: "text/html",
          encoding: "utf8",
          content: "\u20ac".repeat(180000),
        },
      },
    }).success,
  ).toBe(false);
});

it("keeps unknown type payloads portable while refusing prototype names and excessive depth", () => {
  expect(
    templateDefinitionSchema.parse({
      type: "consumer",
      version: 8,
      payload: { files: { "main.tex": "TEXT" } },
    }).type,
  ).toBe("consumer");
  expect(
    templateDefinitionSchema.safeParse(
      JSON.parse('{"type":"html","version":1,"payload":{"__proto__":{}}}'),
    ).success,
  ).toBe(false);
  let deep: unknown = "leaf";
  for (let index = 0; index < 26; index += 1) deep = { child: deep };
  expect(
    templateDefinitionSchema.safeParse({ type: "html", version: 1, payload: { deep } }).success,
  ).toBe(false);
});

it("narrows source metadata away from selected template data structurally", () => {
  const data = templateDataSchema.parse({
    resume: {
      schemaVersion: 1,
      header: { contacts: [] },
      sections: [],
      meta: {
        generatedAt: "date",
        resumeName: "Name",
        locale: "en",
        templateConfig: { private: true },
        templateSpec: { secret: true },
      },
      evidence: "PRIVATE",
    },
    page: { size: "a4", marginMm: 14 },
  });
  expect(data.resume.meta).toEqual({ generatedAt: "date", resumeName: "Name", locale: "en" });
  expect(JSON.stringify(data)).not.toContain("PRIVATE");
});
