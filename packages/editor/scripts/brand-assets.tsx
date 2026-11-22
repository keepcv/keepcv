import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import Color from "colorjs.io";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo } from "../src/components/brand/logo.js";
import { GLYPHS } from "../src/components/icon/glyphs.js";
import { SPOTS, Spot, type SpotName } from "../src/components/icon/spot.js";

const root = new URL("../", import.meta.url);
const destination = new URL("public/brand/", root);
await mkdir(destination, { recursive: true });
const css = await readFile(new URL("src/styles/app.css", root), "utf8");
const declarations = (text: string) =>
  Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
const palette = declarations(css.match(/@theme \{([^}]+)\}/s)?.[1] ?? "");
const light = declarations([...css.matchAll(/:root \{([^}]+)\}/gs)].at(-1)?.[1] ?? "");
const dark = declarations([...css.matchAll(/\.dark \{([^}]+)\}/gs)].at(-1)?.[1] ?? "");
const requestedWidths = process.argv.slice(2).map(Number);
if (requestedWidths.some((width) => !Number.isSafeInteger(width) || width < 1 || width > 4096)) {
  throw new Error("Widths must be integers from 1 to 4096.");
}
const catalog: { file: string; width: number; height: number }[] = [];

async function save(file: string, content: string | Uint8Array) {
  await writeFile(new URL(file, destination), content);
}

async function asset(name: string, svg: string, widths: number[]) {
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert(box, `Missing viewBox: ${name}`);
  const ratio = Number(box[2]) / Number(box[1]);
  await save(`${name}.svg`, svg);
  for (const width of new Set([...widths, ...requestedWidths])) {
    const rendered = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render();
    const height = Math.round(width * ratio);
    if (rendered.width !== width || rendered.height !== height) throw new Error(`Size: ${name}`);
    const file = `${name}-${width}.png`;
    await save(file, rendered.asPng());
    catalog.push({ file, width, height });
  }
}

for (const theme of ["light", "dark"] as const) {
  const tokens = { ...palette, ...light, ...(theme === "dark" ? dark : {}) };
  function color(token: string): string {
    const value = tokens[`--${token}`];
    if (!value) throw new Error(`Unknown color: ${token}`);
    const reference = value.match(/^var\(--([\w-]+)\)$/);
    return reference
      ? color(reference[1] ?? "")
      : new Color(value).to("srgb").toString({ format: "hex" });
  }
  function standalone(element: ReactElement) {
    return renderToStaticMarkup(element)
      .replace(/<svg(?![^>]*xmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg"')
      .replace(/var\(--([\w-]+)\)/g, (_, token: string) => color(token))
      .replace(/class="([^"]*)"/g, (_, classes: string) => {
        const styles = classes.split(" ").flatMap((name) => {
          if (name.startsWith("text-")) return [`color:${color(name.slice(5))}`];
          if (name.startsWith("fill-")) return [`fill:${color(name.slice(5))}`];
          return [];
        });
        return styles.length ? `style="${styles.join(";")}"` : "";
      });
  }
  await asset(`logo-${theme}`, standalone(<Logo label="KeepCV" />), [218, 436, 872]);
  const mark = standalone(<Logo mark label="KeepCV" />);
  await asset(`mark-${theme}`, mark, [32, 64, 128, 256, 512, 1024]);
  for (const name of Object.keys(SPOTS) as SpotName[]) {
    await asset(`${name}-${theme}`, standalone(<Spot name={name} />), [160, 320, 640]);
  }
  if (theme === "light") {
    for (const [name, Glyph] of Object.entries(GLYPHS)) {
      await asset(`icon-${name}`, standalone(<Glyph color={color("text")} />), []);
    }
    const opaque = mark.replace(
      /(<svg[^>]*>)/,
      `$1<rect width="64" height="64" fill="${color("surface")}"/>`,
    );
    await asset("app", opaque, [180, 192, 512]);
    const maskable = opaque.replace(
      /(<rect[^>]+\/>)(.*)<\/svg>$/,
      '$1<g transform="translate(12 12) scale(0.625)">$2</g></svg>',
    );
    await asset("maskable", maskable, [192, 512]);
  }
}

const favicon = await readFile(new URL("src/components/brand/favicon.svg", root), "utf8");
await save("favicon.svg", favicon);
await writeFile(new URL("public/favicon.svg", root), favicon);
const pngs: Uint8Array[] = [];
for (const size of [16, 32, 48]) {
  const png = new Resvg(favicon, { fitTo: { mode: "width", value: size } }).render().asPng();
  await save(`favicon-${size}.png`, png);
  pngs.push(png);
  catalog.push({ file: `favicon-${size}.png`, width: size, height: size });
}
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
for (const [i, png] of pngs.entries()) {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = Buffer.from(png).readUInt32BE(16);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await save("favicon.ico", Buffer.concat([header, ...pngs]));
await save("catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
process.stdout.write(`Generated branding in ${fileURLToPath(destination)}\n`);
