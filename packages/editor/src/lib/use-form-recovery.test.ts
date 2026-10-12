import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { useFormRecovery } from "./use-form-recovery.js";

const schema = z.object({ text: z.string() });
const initial = { text: "Stored" };
const key = "keepcv.form-test";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it("retains unreadable recovery until explicit input replaces it", () => {
  window.localStorage.setItem(key, '{"values":{"text":false}}');
  const hook = renderHook(() => useFormRecovery(key, schema, initial));
  expect(hook.result.current.values).toEqual(initial);
  expect(window.localStorage.getItem(key)).toBe('{"values":{"text":false}}');
});

it("warns only while unfinished and removes its listener on unmount", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  for (let index = 0; index < 2; index++) {
    const hook = renderHook(() => useFormRecovery(key, schema, initial));
    act(() => hook.result.current.setValues({ text: "Unfinished" }));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    hook.unmount();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  }
  const listeners = add.mock.calls.filter(([name]) => name === "beforeunload");
  expect(listeners).toHaveLength(2);
  expect(remove.mock.calls.filter(([name]) => name === "beforeunload")).toEqual(listeners);
});

it("keeps newer remounted input when an old save acknowledges or discards", () => {
  const old = renderHook(() => useFormRecovery(key, schema, initial));
  act(() => old.result.current.setValues({ text: "First" }));
  const sent = old.result.current.begin();
  if (sent === undefined) throw new Error("First save starts");
  expect(old.result.current.begin()).toBeUndefined();
  old.unmount();
  const reopened = renderHook(() => useFormRecovery(key, schema, initial));
  act(() => reopened.result.current.setValues({ text: "Newer" }));
  act(() => {
    old.result.current.acknowledge(sent, { text: "First" });
  });
  act(() => old.result.current.discard(initial));
  expect(window.localStorage.getItem(key)).toContain("Newer");
  expect(reopened.result.current.values.text).toBe("Newer");
});

it("allows saving and retains visible input when browser storage refuses writes", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Disabled");
  });
  const hook = renderHook(() => useFormRecovery(key, schema, initial));
  act(() => hook.result.current.setValues({ text: "Unfinished" }));
  expect(hook.result.current.values.text).toBe("Unfinished");
  const sent = hook.result.current.begin();
  if (sent === undefined) throw new Error("Save starts without browser storage");
  act(() => {
    hook.result.current.acknowledge(sent, { text: "Unfinished" });
  });
  expect(hook.result.current.pending).toBe(false);
});
