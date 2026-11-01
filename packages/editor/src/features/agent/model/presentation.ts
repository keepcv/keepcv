import { projectPlainText } from "@keepcv/core";
import { type AgentOperation, richTextSchema } from "@keepcv/schema";

export function words(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .toLowerCase();
}

export function operationLabel(operation: AgentOperation): string {
  const [resource = "data", action = "change"] = operation.type.split(".");
  const verb =
    action === "update"
      ? "Change"
      : action === "create"
        ? "Add"
        : action.slice(0, 1).toUpperCase() + action.slice(1);
  return `${verb} ${words(resource)}`;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  const richText = richTextSchema.safeParse(value);
  if (richText.success) return projectPlainText(richText.data);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function changedValues(operation: AgentOperation): [string, string][] {
  const values =
    "patch" in operation ? operation.patch : "input" in operation ? operation.input : {};
  return Object.entries(values)
    .filter(([key]) => key !== "id")
    .map(([key, value]) => [words(key), displayValue(value)]);
}
