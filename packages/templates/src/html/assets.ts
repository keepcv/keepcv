import type { HtmlTemplatePayload, TemplateSourceFile } from "@keepcv/schema";
import { HtmlTemplateError } from "./error.js";

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0);
}
function u32(bytes: Uint8Array, offset: number): number {
  return u16(bytes, offset) * 65536 + u16(bytes, offset + 2);
}
function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
function jpegSize(bytes: Uint8Array): number[] {
  if (u16(bytes, 0) !== 0xffd8) return [];
  let at = 2;
  while (at + 8 < bytes.length) {
    if (bytes[at] !== 0xff) return [];
    while (bytes[at] === 0xff) at += 1;
    const marker = bytes[at] ?? 0;
    at += 1;
    const length = u16(bytes, at);
    if (length < 2 || at + length > bytes.length) return [];
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    )
      return [u16(bytes, at + 5), u16(bytes, at + 3)];
    if (marker === 0xda) return [];
    at += length;
  }
  return [];
}
function webpSize(bytes: Uint8Array): number[] {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return [];
  let chunk = 12;
  while (chunk + 8 <= bytes.length) {
    const name = ascii(bytes, chunk, 4);
    if (name === "ANIM" || name === "ANMF") return [];
    const size =
      (bytes[chunk + 4] ?? 0) +
      (bytes[chunk + 5] ?? 0) * 256 +
      (bytes[chunk + 6] ?? 0) * 65536 +
      (bytes[chunk + 7] ?? 0) * 16777216;
    if (size > bytes.length - chunk - 8) return [];
    chunk += 8 + size + (size % 2);
  }
  const format = ascii(bytes, 12, 4);
  if (format === "VP8X" && ((bytes[20] ?? 0) & 2) === 0) {
    const read = (offset: number) =>
      1 + (bytes[offset] ?? 0) + (bytes[offset + 1] ?? 0) * 256 + (bytes[offset + 2] ?? 0) * 65536;
    return [read(24), read(27)];
  }
  if (format === "VP8L" && bytes[20] === 0x2f) {
    const value =
      (bytes[21] ?? 0) +
      (bytes[22] ?? 0) * 256 +
      (bytes[23] ?? 0) * 65536 +
      (bytes[24] ?? 0) * 16777216;
    return [1 + (value & 0x3fff), 1 + ((value >>> 14) & 0x3fff)];
  }
  if (format === "VP8 " && ascii(bytes, 23, 3) === "\x9d\x01\x2a")
    return [
      ((bytes[26] ?? 0) + (bytes[27] ?? 0) * 256) & 0x3fff,
      ((bytes[28] ?? 0) + (bytes[29] ?? 0) * 256) & 0x3fff,
    ];
  return [];
}

function assetSize(
  file: TemplateSourceFile,
  bytes: Uint8Array,
): { pixels: number; fontBytes: number } | undefined {
  if (file.mediaType === "font/woff2")
    return bytes.length >= 48 &&
      ascii(bytes, 0, 4) === "wOF2" &&
      u32(bytes, 8) === bytes.length &&
      u32(bytes, 16) > 0 &&
      u32(bytes, 16) <= 8 * 1024 * 1024
      ? { pixels: 0, fontBytes: u32(bytes, 16) }
      : undefined;
  let dimensions: number[] = [];
  if (
    file.mediaType === "image/png" &&
    ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n" &&
    ascii(bytes, 12, 4) === "IHDR"
  ) {
    dimensions = [u32(bytes, 16), u32(bytes, 20)];
    let at = 8;
    while (at + 12 <= bytes.length) {
      const size = u32(bytes, at);
      if (ascii(bytes, at + 4, 4) === "acTL") return undefined;
      if (size > bytes.length - at - 12) return undefined;
      at += size + 12;
    }
  }
  if (file.mediaType === "image/jpeg") dimensions = jpegSize(bytes);
  if (file.mediaType === "image/webp" && bytes.length >= 30) dimensions = webpSize(bytes);
  const [width = 0, height = 0] = dimensions;
  return width > 0 && height > 0 && width <= 4096 && height <= 4096 && width * height <= 4_194_304
    ? { pixels: width * height, fontBytes: 0 }
    : undefined;
}

export function assetUrls(payload: HtmlTemplatePayload): ReadonlyMap<string, string> {
  const assets = new Map<string, string>();
  let pixels = 0;
  let fonts = 0;
  for (const [path, file] of Object.entries(payload.files)) {
    if (file.mediaType.startsWith("text/")) continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(file.content), (character) => character.charCodeAt(0));
    } catch {
      throw new HtmlTemplateError("invalid-asset", "Asset base64 could not be decoded.", path);
    }
    const size = assetSize(file, bytes);
    if (size === undefined)
      throw new HtmlTemplateError(
        "invalid-asset",
        "Asset content, dimensions or static format is unsupported.",
        path,
      );
    pixels += size.pixels;
    fonts += size.fontBytes;
    if (pixels > 4_194_304 || fonts > 8 * 1024 * 1024)
      throw new HtmlTemplateError(
        "asset-budget",
        "Combined decoded image/font sizes exceed the bundle budget.",
        path,
      );
    assets.set(path, `data:${file.mediaType};base64,${file.content}`);
  }
  return assets;
}

export function resolveAsset(
  path: string,
  assets: ReadonlyMap<string, string>,
  file: string,
): string {
  const resolved = assets.get(path);
  if (resolved === undefined)
    throw new HtmlTemplateError(
      "unsafe-resource",
      "Resources must name a validated asset in this bundle.",
      file,
    );
  return resolved;
}
