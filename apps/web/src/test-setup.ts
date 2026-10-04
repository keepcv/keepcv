import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom 30's Blob no longer fits Vitest's object-URL bridge.
globalThis.URL.createObjectURL = () => "blob:test";
globalThis.URL.revokeObjectURL = () => undefined;

// jsdom has no ResizeObserver, which the DOM lib declares unconditionally.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
