import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit, because this suite does not use vitest globals: without it every
// render stacks in the same document and a query for one element finds three.
afterEach(cleanup);
