import { z } from "zod";

const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function templateTextBytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function isTemplatePath(path: string): boolean {
  return (
    path.length <= 180 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path) &&
    path
      .split("/")
      .every(
        (part) =>
          part !== "" &&
          part !== "." &&
          part !== ".." &&
          !part.endsWith(".") &&
          !RESERVED.test(part) &&
          !OBJECT_KEYS.has(part.toLowerCase()),
      )
  );
}

export const templatePathSchema = z.string().refine(isTemplatePath, "Use a canonical bundle path.");

function boundedPayload(value: Record<string, unknown>): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  let characters = 0;
  while (pending.length > 0) {
    const item = pending.pop();
    if (item === undefined) break;
    nodes += 1;
    if (nodes > 20_000 || item.depth > 24) return false;
    if (typeof item.value === "string") characters += item.value.length;
    else if (typeof item.value === "number") {
      if (!Number.isFinite(item.value)) return false;
    } else if (item.value !== null && typeof item.value === "object") {
      for (const [key, child] of Object.entries(item.value)) {
        if (OBJECT_KEYS.has(key)) return false;
        characters += key.length;
        pending.push({ value: child, depth: item.depth + 1 });
      }
    } else if (item.value !== null && typeof item.value !== "boolean") return false;
    if (characters > 2_200_000) return false;
  }
  return true;
}

export const templateDefinitionSchema = z
  .object({
    type: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    version: z.int().positive(),
    payload: z.preprocess(
      (value, context) => {
        if (
          value === null ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          !boundedPayload(value as Record<string, unknown>)
        )
          context.addIssue({
            code: "custom",
            message: "Template payload exceeds its JSON budget or contains unsupported values.",
          });
        return value;
      },
      z.record(z.string(), z.unknown()),
    ),
  })
  .meta({ id: "TemplateDefinition", title: "Versioned template definition" });

export const templateSourceFileSchema = z.object({
  mediaType: z.enum([
    "text/html",
    "text/css",
    "image/png",
    "image/jpeg",
    "image/webp",
    "font/woff2",
  ]),
  encoding: z.enum(["utf8", "base64"]),
  content: z.string().max(1_400_000),
});

export const htmlTemplateSourceSchema = z.object({
  documentVersions: z.array(z.int().positive()).min(1).max(8),
  entry: templatePathSchema,
  styles: z.array(templatePathSchema).max(16),
  files: z.record(templatePathSchema, templateSourceFileSchema),
  page: z.object({ size: z.enum(["a4", "letter"]), marginMm: z.number().min(0).max(35) }),
});

export const htmlTemplatePayloadSchema = htmlTemplateSourceSchema
  .superRefine((payload, context) => {
    const members = Object.entries(payload.files);
    const names = new Set<string>();
    let text = 0;
    let assets = 0;
    if (members.length < 1 || members.length > 64)
      context.addIssue({
        code: "custom",
        message: "A template contains between 1 and 64 files.",
        path: ["files"],
      });
    for (const [name, file] of members) {
      if (names.has(name.toLowerCase()))
        context.addIssue({
          code: "custom",
          message: "Bundle paths must be unique regardless of case.",
          path: ["files", name],
        });
      names.add(name.toLowerCase());
      if (file.mediaType.startsWith("text/")) {
        if (file.encoding !== "utf8")
          context.addIssue({
            code: "custom",
            message: "Source files use UTF-8 text.",
            path: ["files", name],
          });
        text += templateTextBytes(file.content);
      } else {
        if (
          file.encoding !== "base64" ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)
        )
          context.addIssue({
            code: "custom",
            message: "Assets use canonical base64.",
            path: ["files", name],
          });
        assets += Math.floor((file.content.length * 3) / 4);
      }
    }
    if (text > 512 * 1024 || assets > 1024 * 1024)
      context.addIssue({
        code: "custom",
        message: "Template source is limited to 512 KiB and assets to 1 MiB.",
        path: ["files"],
      });
    if (payload.files[payload.entry]?.mediaType !== "text/html")
      context.addIssue({
        code: "custom",
        message: "Choose an HTML entry file in this bundle.",
        path: ["entry"],
      });
    for (const style of payload.styles)
      if (payload.files[style]?.mediaType !== "text/css")
        context.addIssue({
          code: "custom",
          message: "Styles must name CSS files in this bundle.",
          path: ["styles"],
        });
  })
  .meta({ id: "HtmlTemplatePayload", title: "HTML source bundle" });

export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;
export type TemplateSourceFile = z.infer<typeof templateSourceFileSchema>;
export type HtmlTemplatePayload = z.infer<typeof htmlTemplatePayloadSchema>;

export function isTemplateDefinition(value: unknown): value is TemplateDefinition {
  return (
    value !== null && typeof value === "object" && "type" in value && typeof value.type === "string"
  );
}
