import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit, because this suite does not use vitest globals: without it every
// render stacks in the same document and a query for one element finds three.
afterEach(cleanup);

// jsdom has no ResizeObserver, and the preview measures the page a template
// renders so it can scale it to fit.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
