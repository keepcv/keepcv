import type { HtmlTemplatePayload } from "@keepcv/schema";
import { richTextSchema, templateTextBytes } from "@keepcv/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Marks } from "../prose.js";
import { HtmlTemplateError } from "./error.js";

type Scope = Record<string, unknown>;
interface Location {
  file: string;
  line: number;
}
interface Token extends Location {
  kind: "text" | "output" | "tag";
  text: string;
}
type Node =
  | (Location & { kind: "text"; text: string })
  | (Location & { kind: "output" | "rich_text"; expression: string })
  | (Location & { kind: "assign"; name: string; expression: string })
  | (Location & { kind: "render"; fileName: string; arguments: Record<string, string> })
  | (Location & { kind: "for"; name: string; expression: string; body: Node[]; otherwise: Node[] })
  | (Location & {
      kind: "if";
      branches: { condition: string | null; invert: boolean; body: Node[] }[];
    });

const FORBIDDEN = new Set(["__proto__", "prototype", "constructor", "toString", "valueOf"]);
const ROOTS = new Set(["resume", "page", "forloop"]);
const FILTERS = new Set([
  "default",
  "join",
  "where",
  "first",
  "last",
  "size",
  "upcase",
  "downcase",
  "capitalize",
  "slice",
  "in_group",
]);

function fail(code: string, message: string, at: Location): never {
  throw new HtmlTemplateError(code, message, at.file, at.line);
}

export function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function split(source: string, separator: string): string[] {
  const parts: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== "") {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
    } else if (character === '"' || character === "'") quote = character;
    else if (source.startsWith(separator, index)) {
      parts.push(source.slice(start, index).trim());
      index += separator.length - 1;
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts;
}

function tokens(source: string, file: string): Token[] {
  const result: Token[] = [];
  let cursor = 0;
  let line = 1;
  let trimNext = false;
  while (cursor < source.length) {
    const output = source.indexOf("{{", cursor);
    const tag = source.indexOf("{%", cursor);
    const candidates = [output, tag].filter((index) => index >= 0);
    const start = candidates.length === 0 ? source.length : Math.min(...candidates);
    const raw = source.slice(cursor, start);
    let text = trimNext ? raw.trimStart() : raw;
    const trimBefore = source[start + 2] === "-";
    if (trimBefore) text = text.trimEnd();
    if (text !== "") result.push({ kind: "text", text, file, line });
    line += raw.split("\n").length - 1;
    if (start === source.length) break;
    const kind = start === output ? "output" : "tag";
    const end = source.indexOf(kind === "output" ? "}}" : "%}", start + 2);
    if (end < 0) fail("binding-syntax", "Unclosed template binding.", { file, line });
    trimNext = source[end - 1] === "-";
    const body = source.slice(start + (trimBefore ? 3 : 2), trimNext ? end - 1 : end).trim();
    result.push({ kind, text: body, file, line });
    line += source.slice(start, end + 2).split("\n").length - 1;
    cursor = end + 2;
    if (result.length > 10_000)
      fail("binding-budget", "Too many template bindings.", { file, line });
  }
  return result;
}

function variable(name: string, at: Location): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || FORBIDDEN.has(name) || ROOTS.has(name))
    fail(
      "binding-syntax",
      "Choose a local variable name that does not replace a reserved value.",
      at,
    );
}

function expressionSyntax(expression: string, at: Location): void {
  if (expression.length > 2048) fail("binding-budget", "A binding expression is too long.", at);
  const pieces = split(expression, "|");
  valueSyntax(pieces[0] ?? "", at);
  for (const piece of pieces.slice(1)) {
    const [name = "", args] = split(piece, ":");
    if (!FILTERS.has(name)) fail("unsupported-binding", `Unsupported filter: ${name}.`, at);
    for (const argument of args === undefined ? [] : split(args, ",")) valueSyntax(argument, at);
  }
}

function valueSyntax(value: string, at: Location): void {
  if (/^(?:true|false|nil|null|blank|empty|-?\d+(?:\.\d+)?)$/.test(value)) return;
  if (/^"(?:[^"\\]|\\[\\"'])*"$/.test(value) || /^'(?:[^'\\]|\\[\\"'])*'$/.test(value)) return;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.[a-zA-Z_][a-zA-Z0-9_]*)|(?:\[\d+\]))*$/.test(value))
    fail("binding-syntax", "Use a field path, quoted text or a literal value.", at);
  if (
    value
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .some((part) => FORBIDDEN.has(part))
  )
    fail("unsafe-binding", "Prototype and runtime properties are unavailable.", at);
}

function conditionSyntax(condition: string, at: Location): void {
  for (const alternative of split(condition, " or "))
    for (const part of split(alternative, " and ")) {
      const comparison = /^(.*?)\s+(==|!=|>=|<=|>|<|contains)\s+(.*?)$/.exec(part);
      if (comparison === null) expressionSyntax(part, at);
      else {
        expressionSyntax(comparison[1] ?? "", at);
        expressionSyntax(comparison[3] ?? "", at);
      }
    }
}

class Parser {
  private cursor = 0;
  private readonly input: Token[];
  constructor(input: Token[]) {
    this.input = input;
  }

  read(stops: string[] = [], depth = 0): Node[] {
    if (depth > 16)
      fail(
        "binding-budget",
        "Bindings may nest at most 16 levels.",
        this.input[this.cursor] ?? { file: "template", line: 1 },
      );
    const result: Node[] = [];
    while (this.cursor < this.input.length) {
      const token = this.input[this.cursor];
      if (token === undefined) break;
      const command = token.text.split(/\s/, 1)[0] ?? "";
      if (token.kind === "tag" && stops.includes(command)) break;
      this.cursor += 1;
      if (token.kind === "text") result.push({ ...token, kind: "text" });
      else if (token.kind === "output") {
        expressionSyntax(token.text, token);
        result.push({ ...token, kind: "output", expression: token.text });
      } else result.push(this.tag(token, command, depth));
    }
    return result;
  }

  private take(command: string, at: Location): void {
    if (this.input[this.cursor]?.text !== command)
      fail("binding-syntax", `Expected ${command}.`, at);
    this.cursor += 1;
  }

  private tag(token: Token, command: string, depth: number): Node {
    const expression = token.text.slice(command.length).trim();
    if (command === "rich_text") {
      expressionSyntax(expression, token);
      return { ...token, kind: "rich_text", expression };
    }
    if (command === "assign") {
      const found = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/.exec(expression);
      if (found === null) fail("binding-syntax", "Use assign name = value.", token);
      const name = found[1] ?? "";
      variable(name, token);
      const value = found[2] ?? "";
      expressionSyntax(value, token);
      return { ...token, kind: "assign", name, expression: value };
    }
    if (command === "render") return this.partial(token, expression);
    if (command === "for") {
      const found = /^([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([\s\S]+)$/.exec(expression);
      if (found === null) fail("binding-syntax", "Use for item in an array field.", token);
      const name = found[1] ?? "";
      variable(name, token);
      const value = found[2] ?? "";
      expressionSyntax(value, token);
      const body = this.read(["else", "endfor"], depth + 1);
      let otherwise: Node[] = [];
      if (this.input[this.cursor]?.text === "else") {
        this.cursor += 1;
        otherwise = this.read(["endfor"], depth + 1);
      }
      this.take("endfor", token);
      return { ...token, kind: "for", name, expression: value, body, otherwise };
    }
    if (command === "if" || command === "unless")
      return this.conditional(token, expression, command === "unless", depth);
    fail("unsupported-binding", `Unsupported tag: ${command}.`, token);
  }

  private partial(token: Token, expression: string): Node {
    const parts = split(expression, ",");
    const path = parts[0] ?? "";
    if (!/^['"][a-zA-Z0-9][a-zA-Z0-9._/-]*['"]$/.test(path) || path[0] !== path.at(-1))
      fail("binding-syntax", "Render a literal file name from this bundle.", token);
    const args: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const part of parts.slice(1)) {
      const [name = "", ...argument] = split(part, ":");
      const value = argument.join(":");
      variable(name, token);
      expressionSyntax(value, token);
      args[name] = value;
    }
    return { ...token, kind: "render", fileName: path.slice(1, -1), arguments: args };
  }

  private conditional(token: Token, expression: string, invert: boolean, depth: number): Node {
    const end = invert ? "endunless" : "endif";
    const branches: { condition: string | null; invert: boolean; body: Node[] }[] = [];
    conditionSyntax(expression, token);
    branches.push({
      condition: expression,
      invert,
      body: this.read(["elsif", "else", end], depth + 1),
    });
    while (this.input[this.cursor]?.text.startsWith("elsif ")) {
      const next = this.input[this.cursor];
      if (next === undefined) break;
      this.cursor += 1;
      const condition = next.text.slice(6).trim();
      conditionSyntax(condition, next);
      branches.push({
        condition,
        invert: false,
        body: this.read(["elsif", "else", end], depth + 1),
      });
    }
    if (this.input[this.cursor]?.text === "else") {
      this.cursor += 1;
      branches.push({ condition: null, invert: false, body: this.read([end], depth + 1) });
    }
    this.take(end, token);
    return { ...token, kind: "if", branches };
  }
}

class Budget {
  private operations = 0;
  private characters = 0;
  work(at: Location, amount = 1): void {
    this.operations += amount;
    if (this.operations > 100_000)
      fail("binding-budget", "Template work exceeded 100,000 operations.", at);
  }
  append(value: string, at: Location): string {
    this.characters += templateTextBytes(value);
    if (this.characters > 5 * 1024 * 1024)
      fail("output-budget", "Rendered HTML exceeds 5 MiB.", at);
    return value;
  }
}

function readPath(path: string, scope: Scope, at: Location, optional: boolean): unknown {
  let value: unknown = scope;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (FORBIDDEN.has(part))
      fail("unsafe-binding", "Prototype and runtime properties are unavailable.", at);
    if (part === "size" && (typeof value === "string" || Array.isArray(value)))
      value = value.length;
    else if ((part === "first" || part === "last") && Array.isArray(value))
      value = value[part === "first" ? 0 : value.length - 1];
    else if (value !== null && typeof value === "object" && Object.hasOwn(value, part))
      value = (value as Record<string, unknown>)[part];
    else value = undefined;
    if (value === undefined) break;
  }
  if (value === undefined && !optional)
    fail(
      "missing-field",
      `Field ${path} is unavailable; guard optional fields with if or default.`,
      at,
    );
  return value;
}

function literal(source: string, scope: Scope, at: Location, optional: boolean): unknown {
  if (source.startsWith('"') || source.startsWith("'"))
    return source.slice(1, -1).replace(/\\([\\'"])/g, "$1");
  if (source === "true" || source === "false") return source === "true";
  if (["nil", "null", "blank", "empty"].includes(source)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(source)) return Number(source);
  return readPath(source, scope, at, optional);
}

function empty(value: unknown): boolean {
  return (
    value == null || value === false || value === "" || (Array.isArray(value) && value.length === 0)
  );
}

function text(value: unknown, at: Location): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  fail(
    "binding-value",
    "Render a field value, or iterate an array instead of printing an object.",
    at,
  );
}

function objectFields(value: unknown): Scope {
  return value !== null && typeof value === "object" ? (value as Scope) : {};
}

function filter(
  name: string,
  value: unknown,
  args: unknown[],
  at: Location,
  budget: Budget,
): unknown {
  budget.work(at);
  if (name === "default") return empty(value) ? (args[0] ?? "") : value;
  if (name === "size") return typeof value === "string" || Array.isArray(value) ? value.length : 0;
  if (name === "first" || name === "last")
    return Array.isArray(value) ? value[name === "first" ? 0 : value.length - 1] : undefined;
  if (name === "where" || name === "in_group") {
    if (!Array.isArray(value)) fail("binding-value", `${name} expects an array.`, at);
    budget.work(at, value.length);
    if (name === "in_group") {
      if (!Array.isArray(args[0])) fail("binding-value", "in_group expects group.entryKeys.", at);
      budget.work(at, args[0].length);
      const entries = new Map(
        value.map((item: unknown) => [readPath("key", objectFields(item), at, true), item]),
      );
      return args[0].flatMap((key: unknown) => (entries.has(key) ? [entries.get(key)] : []));
    }
    const key = text(args[0], at);
    valueSyntax(key, at);
    return value.filter((item: unknown) => readPath(key, objectFields(item), at, true) === args[1]);
  }
  if (name === "join") {
    if (!Array.isArray(value)) fail("binding-value", "join expects an array of values.", at);
    budget.work(at, value.length);
    const separator = text(args[0] ?? ", ", at);
    let length = 0;
    const parts = value.map((item: unknown) => {
      const part = text(item, at);
      length += templateTextBytes(part) + templateTextBytes(separator);
      if (length > 5 * 1024 * 1024) fail("output-budget", "Joined text exceeds 5 MiB.", at);
      return part;
    });
    return parts.join(separator);
  }
  const string = text(value, at);
  budget.work(at, Math.ceil(string.length / 64));
  if (name === "upcase") return string.toUpperCase();
  if (name === "downcase") return string.toLowerCase();
  if (name === "capitalize") return string.slice(0, 1).toUpperCase() + string.slice(1);
  if (name === "slice") {
    const start = Number(args[0] ?? 0);
    const length = Number(args[1] ?? string.length);
    if (!Number.isFinite(start) || !Number.isFinite(length))
      fail("binding-value", "slice expects finite numeric values.", at);
    return string.slice(start, start + length);
  }
  fail("unsupported-binding", `Unsupported filter: ${name}.`, at);
}

function evaluate(
  expression: string,
  scope: Scope,
  at: Location,
  budget: Budget,
  optional = false,
): unknown {
  budget.work(at);
  const parts = split(expression, "|");
  let value = literal(
    parts[0] ?? "",
    scope,
    at,
    optional || parts.slice(1).some((part) => split(part, ":")[0] === "default"),
  );
  for (const part of parts.slice(1)) {
    const [name = "", argSource] = split(part, ":");
    const args =
      argSource === undefined
        ? []
        : split(argSource, ",").map((arg) => literal(arg, scope, at, optional));
    value = filter(name, value, args, at, budget);
  }
  return value;
}

function condition(source: string, scope: Scope, at: Location, budget: Budget): boolean {
  return split(source, " or ").some((alternative) =>
    split(alternative, " and ").every((part) => {
      const found = /^(.*?)\s+(==|!=|>=|<=|>|<|contains)\s+(.*?)$/.exec(part);
      if (found === null) return !empty(evaluate(part, scope, at, budget, true));
      const left = evaluate(found[1] ?? "", scope, at, budget, true);
      const right = evaluate(found[3] ?? "", scope, at, budget, true);
      switch (found[2] ?? "") {
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return typeof left === "number" && typeof right === "number" && left > right;
        case "<":
          return typeof left === "number" && typeof right === "number" && left < right;
        case ">=":
          return typeof left === "number" && typeof right === "number" && left >= right;
        case "<=":
          return typeof left === "number" && typeof right === "number" && left <= right;
        case "contains":
          budget.work(
            at,
            typeof left === "string"
              ? Math.ceil(left.length / 64)
              : Array.isArray(left)
                ? left.length
                : 1,
          );
          return typeof left === "string"
            ? left.includes(text(right, at))
            : Array.isArray(left) && left.includes(right);
        default:
          return false;
      }
    }),
  );
}

export function compileBindings(payload: HtmlTemplatePayload): (scope: Scope) => string {
  const files = new Map<string, Node[]>();
  for (const [name, file] of Object.entries(payload.files))
    if (file.mediaType === "text/html")
      files.set(name, new Parser(tokens(file.content, name)).read());
  const dependencies = (nodes: Node[]): string[] =>
    nodes.flatMap((node): string[] => {
      if (node.kind === "render") return [node.fileName];
      if (node.kind === "for") return [...dependencies(node.body), ...dependencies(node.otherwise)];
      if (node.kind === "if") return node.branches.flatMap((branch) => dependencies(branch.body));
      return [];
    });
  const visited = new Set<string>();
  const visit = (name: string, stack: string[]): void => {
    const nodes = files.get(name);
    if (nodes === undefined)
      fail("missing-partial", "Referenced HTML file is not in this bundle.", {
        file: name,
        line: 1,
      });
    if (stack.includes(name) || stack.length >= 16)
      fail("partial-cycle", "Partials cannot recurse or nest beyond 16 files.", {
        file: name,
        line: 1,
      });
    if (visited.has(name)) return;
    for (const child of dependencies(nodes)) visit(child, [...stack, name]);
    visited.add(name);
  };
  for (const name of files.keys()) visit(name, []);
  return (root) => {
    const budget = new Budget();
    const render = (nodes: Node[], scope: Scope, depth = 0): string =>
      nodes
        .map((node): string => {
          budget.work(node);
          switch (node.kind) {
            case "text":
              return budget.append(node.text, node);
            case "output":
              return budget.append(
                escapeHtml(text(evaluate(node.expression, scope, node, budget), node)),
                node,
              );
            case "rich_text": {
              const parsed = richTextSchema.safeParse(
                evaluate(node.expression, scope, node, budget),
              );
              if (!parsed.success)
                fail("binding-value", "rich_text expects a rich-text field.", node);
              return budget.append(
                renderToStaticMarkup(createElement(Marks, { nodes: parsed.data })),
                node,
              );
            }
            case "assign":
              scope[node.name] = evaluate(node.expression, scope, node, budget);
              return "";
            case "render": {
              if (depth >= 16) fail("partial-cycle", "Partials may nest at most 16 files.", node);
              const child: Scope = { resume: root["resume"], page: root["page"] };
              for (const [name, expression] of Object.entries(node.arguments))
                child[name] = evaluate(expression, scope, node, budget);
              return render(files.get(node.fileName) ?? [], child, depth + 1);
            }
            case "if": {
              const branch = node.branches.find(
                (candidate) =>
                  candidate.condition === null ||
                  condition(candidate.condition, scope, node, budget) !== candidate.invert,
              );
              return branch === undefined ? "" : render(branch.body, { ...scope }, depth);
            }
            case "for": {
              const values = evaluate(node.expression, scope, node, budget);
              if (!Array.isArray(values))
                fail("binding-value", "for expects an array field.", node);
              budget.work(node, values.length);
              if (values.length === 0) return render(node.otherwise, { ...scope }, depth);
              return values
                .map((value: unknown, index: number) =>
                  render(
                    node.body,
                    {
                      ...scope,
                      [node.name]: value,
                      forloop: {
                        index: index + 1,
                        index0: index,
                        first: index === 0,
                        last: index === values.length - 1,
                        length: values.length,
                      },
                    },
                    depth,
                  ),
                )
                .join("");
            }
          }
          return fail("unsupported-binding", "Unsupported binding node.", node);
        })
        .join("");
    return render(files.get(payload.entry) ?? [], { ...root });
  };
}
