import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const changesets = createRequire(import.meta.resolve("@changesets/cli"));
const config = createRequire(changesets.resolve("@changesets/config"));
const matcher = createRequire(config.resolve("micromatch"));
const braces = matcher("braces");

test("the brace parser refuses patterns before they exhaust the stack", () => {
  assert.throws(
    () => braces.parse(`${"{".repeat(1000)}a,b${"}".repeat(1000)}`),
    /Brace nesting exceeds 128 levels/,
  );
});

for (const method of ["compile", "expand", "stringify"]) {
  test(`the brace ${method} walker bounds caller-provided trees`, () => {
    let ast = { type: "text", value: "x" };
    for (let depth = 0; depth < 1000; depth += 1) ast = { type: "root", nodes: [ast] };
    assert.throws(() => braces[method](ast), /Brace nesting exceeds 128 levels/);
  });
}

test("ordinary nested brace patterns retain their expansion", () => {
  assert.deepEqual(braces.expand("src/{a,{b,c}}.ts"), ["src/a.ts", "src/b.ts", "src/c.ts"]);
});
