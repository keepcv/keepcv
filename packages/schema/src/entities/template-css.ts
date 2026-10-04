interface Token {
  kind: "name" | "string" | "punctuation";
  value: string;
  start: number;
  end: number;
}

const AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "page",
  "font-face",
  "layer",
  "keyframes",
  "-webkit-keyframes",
  "starting-style",
  "counter-style",
  "font-feature-values",
  "property",
]);
const FUNCTIONS = new Set([
  "var",
  "calc",
  "min",
  "max",
  "clamp",
  "round",
  "mod",
  "rem",
  "abs",
  "sign",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
  "translate",
  "translatex",
  "translatey",
  "translatez",
  "translate3d",
  "scale",
  "scalex",
  "scaley",
  "scalez",
  "scale3d",
  "rotate",
  "rotatex",
  "rotatey",
  "rotatez",
  "rotate3d",
  "skew",
  "skewx",
  "skewy",
  "matrix",
  "matrix3d",
  "perspective",
  "blur",
  "brightness",
  "contrast",
  "grayscale",
  "hue-rotate",
  "invert",
  "opacity",
  "saturate",
  "sepia",
  "drop-shadow",
  "repeat",
  "minmax",
  "fit-content",
  "cubic-bezier",
  "steps",
  "linear",
  "local",
  "format",
  "tech",
  "counter",
  "counters",
  "symbols",
  "is",
  "where",
  "not",
  "has",
  "nth-child",
  "nth-last-child",
  "nth-of-type",
  "nth-last-of-type",
  "lang",
  "dir",
  "selector",
  "style",
]);

function decodeEscapes(css: string): string {
  return css
    .replace(/\\(?:\r\n|[\n\r\f])/g, "")
    .replace(
      /\\([0-9a-f]{1,6})(?:\r\n|[ \t\n\r\f])?|\\(.)/gi,
      (_, hex: string | undefined, character: string | undefined) => {
        if (hex === undefined) return character ?? "";
        const code = Number.parseInt(hex, 16);
        return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
          ? "\ufffd"
          : String.fromCodePoint(code);
      },
    );
}

const CSS_ESCAPE = String.raw`\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\n\r\f])?|[^0-9a-f\n\r\f])`;
const STRING_CHARACTER = String.raw`(?:${CSS_ESCAPE}|\\(?:\r\n|[\n\r\f]))`;
const TOKEN_PATTERN = String.raw`\s+|/\*[\s\S]*?\*/|"(?:[^"\\\n\r\f]|${STRING_CHARACTER})*"|'(?:[^'\\\n\r\f]|${STRING_CHARACTER})*'|(?:[\w-]|[^\x00-\x7f]|${CSS_ESCAPE})+|[^"'\\]`;

function tokenOf(raw: string, start: number, end: number): Token {
  if (raw.startsWith('"') || raw.startsWith("'")) {
    return { kind: "string", value: decodeEscapes(raw.slice(1, -1)), start, end };
  }
  if (/[\w-]/.test(raw[0] ?? "") || raw.charCodeAt(0) > 127 || raw.startsWith("\\")) {
    return { kind: "name", value: decodeEscapes(raw).toLowerCase(), start, end };
  }
  return { kind: "punctuation", value: raw, start, end };
}

function tokens(css: string): Token[] | undefined {
  const pattern = new RegExp(TOKEN_PATTERN, "iyu");
  const result: Token[] = [];
  while (pattern.lastIndex < css.length) {
    const start = pattern.lastIndex;
    const match = pattern.exec(css);
    if (match === null) return undefined;
    const raw = match[0];
    if (/^\s/.test(raw) || raw.startsWith("/*")) continue;
    if (css.startsWith("/*", start)) return undefined;
    result.push(tokenOf(raw, start, pattern.lastIndex));
  }
  return result;
}

function localUrlEnd(css: string, parsed: Token[], opening: Token, at: number): number {
  const close = parsed.findIndex(
    (part, index) => index > at + 1 && part.kind === "punctuation" && part.value === ")",
  );
  if (close < 0) return -1;
  if (parsed.slice(at + 2, close).some((part) => part.kind === "punctuation" && part.value === "("))
    return -1;
  const address = parsed[at + 2];
  let value = decodeEscapes(css.slice(opening.end, parsed[close]?.start)).trim();
  if (address?.kind === "string") {
    if (close !== at + 3) return -1;
    value = address.value;
  }
  return /^data:/i.test(value) ? close : -1;
}

function startsFunction(
  token: Token,
  next: Token | undefined,
  previous: Token | undefined,
): next is Token {
  return (
    token.kind === "name" &&
    next?.kind === "punctuation" &&
    next.value === "(" &&
    next.start === token.end &&
    previous?.value !== "@"
  );
}

function localTokenEnd(css: string, parsed: Token[], at: number): number {
  const token = parsed[at];
  const next = parsed[at + 1];
  if (token === undefined) return at;
  if (token.kind === "punctuation" && token.value === "@") {
    if (next?.kind !== "name" || !AT_RULES.has(next.value)) return -1;
  }
  if (!startsFunction(token, next, parsed[at - 1])) return at;
  if (token.value === "url") return localUrlEnd(css, parsed, next, at);
  return FUNCTIONS.has(token.value) ? at : -1;
}

export function cssIsLocal(css: string): boolean {
  const parsed = tokens(css);
  if (parsed === undefined) return false;
  for (let at = 0; at < parsed.length; at += 1) {
    at = localTokenEnd(css, parsed, at);
    if (at < 0) return false;
  }
  return true;
}
