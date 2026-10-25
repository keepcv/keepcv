import { fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { printFile } from "./files.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("iframe").forEach((frame) => {
    frame.remove();
  });
});

it("ignores the initial blank frame load and prints only the loaded resume", () => {
  const html = "<!doctype html><html><body><p>Resume</p></body></html>";
  printFile(html);
  const frame = document.querySelector("iframe");
  if (frame?.contentWindow == null || frame.contentDocument === null)
    throw new Error("The print frame exists");
  const print = vi.spyOn(frame.contentWindow, "print").mockImplementation(() => {});
  vi.spyOn(frame.contentWindow, "focus").mockImplementation(() => {});
  fireEvent.load(frame);
  expect(print).not.toHaveBeenCalled();
  expect(frame.getAttribute("sandbox")).toBe("allow-same-origin allow-modals");
  Object.defineProperty(frame.contentDocument, "URL", {
    configurable: true,
    value: "about:srcdoc",
  });
  fireEvent.load(frame);
  expect(print).toHaveBeenCalledOnce();
  expect(frame.srcdoc).toBe(html);
  fireEvent(frame.contentWindow, new Event("afterprint"));
  expect(document.querySelector("iframe")).toBeNull();
});
