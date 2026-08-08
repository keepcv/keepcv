// Deliberately thin (ADR-0017).
//
// Biome owns formatting and the bulk of linting. ESLint exists here for one
// reason: the type-aware rules whose full implementation still lives in
// typescript-eslint. Biome v2's type inference covers roughly 75-85% of these,
// and the gap is exactly where async bugs hide.
//
// Do not add stylistic or non-type-aware rules to this file. If a rule does not
// need type information, it belongs in biome.json or nowhere.

import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
    extends: [tseslint.configs.base],
    languageOptions: {
      parserOptions: {
        // Point at the test configs rather than using `projectService`: the
        // build tsconfigs exclude *.test.ts so they never emit test files into
        // dist, which means the project service cannot type them. The
        // tsconfig.test.json in each package includes everything.
        project: ["packages/*/tsconfig.test.json", "apps/*/tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The reason this file exists.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "always"],

      // Exhaustiveness. Invariant I14 (one presenter per record kind) and the
      // discriminated unions in the schema layer depend on this being enforced.
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // Type-aware correctness that Biome cannot see.
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
);
