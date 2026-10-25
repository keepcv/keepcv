import { newUuid } from "@keepcv/core";
import { type TemplateDefinition, templateSchema } from "@keepcv/schema";
import { HTML_TEMPLATES } from "@keepcv/templates";
import { expect, it } from "vitest";
import { problemOf, withApi } from "../api.harness.js";

const { send, otherOwner } = withApi();
const definition = HTML_TEMPLATES[0]?.definition;
if (definition === undefined) throw new Error("The sample contains its source");

it("saves complete HTML bundles, enforces owner scope and refuses stale edits", async () => {
  const id = newUuid();
  const made = await send("POST", "/v1/templates", { id, name: "My studio", spec: definition });
  expect(made.status).toBe(201);
  const row = templateSchema.parse(await made.json());
  expect(row.spec).toEqual(definition);
  const other = await otherOwner();
  expect((await other("GET", `/v1/templates/${id}`)).status).toBe(404);
  expect(
    (
      await send("PATCH", `/v1/templates/${id}`, {
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
        patch: { name: "Stale" },
      })
    ).status,
  ).toBe(409);
});

it.each([
  "<script>alert(1)</script>",
  '<img src="https://example.com/x" alt="">',
  "{% render 'missing.html' %}",
])("refuses unsafe or incomplete source on create and patch: %s", async (source) => {
  const id = newUuid();
  const response = await send("POST", "/v1/templates", {
    id,
    name: "Safe",
    spec: { settings: {}, extraCss: "" },
  });
  const row = templateSchema.parse(await response.json());
  const spec: TemplateDefinition = {
    type: "html",
    version: 1,
    payload: {
      documentVersions: [1],
      entry: "index.html",
      styles: [],
      page: { size: "a4", marginMm: 14 },
      files: { "index.html": { mediaType: "text/html", encoding: "utf8", content: source } },
    },
  };
  const created = await send("POST", "/v1/templates", { id: newUuid(), name: "Unsafe", spec });
  expect(created.status).toBe(422);
  expect((await problemOf(created)).detail).toContain("spec");
  expect(
    (
      await send("PATCH", `/v1/templates/${id}`, {
        expectedUpdatedAt: row.updatedAt,
        patch: { spec },
      })
    ).status,
  ).toBe(422);
  expect(
    templateSchema.parse(await (await send("GET", `/v1/templates/${id}`)).json()).spec,
  ).toEqual(row.spec);
});

it("refuses unknown type versions on ordinary writes", async () => {
  for (const spec of [
    { type: "latex", version: 1, payload: {} },
    { type: "html", version: 99, payload: {} },
  ])
    expect(
      (await send("POST", "/v1/templates", { id: newUuid(), name: "Unsupported", spec })).status,
    ).toBe(422);
});
