import { fromJsonResume } from "@keepcv/interop";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, UnreadableFileError } from "./read-file.js";

const file = (body: string, name = "resume.json") => new File([body], name);

const json = (value: unknown, name?: string) => file(JSON.stringify(value), name);

describe("deciding which reader a file needs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refuses oversized files before reading them", async () => {
    const oversized = file("{}");
    Object.defineProperty(oversized, "size", { value: 16 * 1024 * 1024 + 1 });
    const read = vi.spyOn(oversized, "slice");
    await expect(readFile(oversized)).rejects.toThrow("at most 16 MiB");
    expect(read).not.toHaveBeenCalled();
  });

  it("detects Word bytes before decoding text and terminates its worker", async () => {
    const intake = { ...fromJsonResume({ basics: { name: "Ada" } }), source: "docx" };
    const worker = {
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
      onerror: undefined,
      postMessage: vi.fn(() =>
        queueMicrotask(() => worker.onmessage?.({ data: { intake } } as MessageEvent)),
      ),
      terminate: vi.fn(),
    };
    function Worker() {
      return worker;
    }
    vi.stubGlobal("Worker", Worker);
    const word = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "resume.json");
    const text = vi.spyOn(word, "text");
    await expect(readFile(word)).resolves.toMatchObject({ source: "docx" });
    expect(text).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("cancels a Word worker and reports its error", async () => {
    let markStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const worker = {
      onmessage: undefined,
      onerror: undefined,
      postMessage: () => markStarted(),
      terminate: vi.fn(),
    };
    function Worker() {
      return worker;
    }
    vi.stubGlobal("Worker", Worker);
    const word = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "resume.docx");
    const controller = new AbortController();
    const reading = readFile(word, controller.signal);
    await started;
    controller.abort();
    await expect(reading).rejects.toThrow("cancelled");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("reads JSON Resume", async () => {
    const intake = await readFile(json({ basics: { name: "Ada" }, work: [{ name: "Acme" }] }));

    expect(intake.source).toBe("json-resume");
    expect(intake.identity.fullName).toBe("Ada");
  });

  it("terminates a Word worker that exceeds its deadline", async () => {
    vi.useFakeTimers();
    let markStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const worker = {
      onmessage: undefined,
      onerror: undefined,
      postMessage: () => markStarted(),
      terminate: vi.fn(),
    };
    function Worker() {
      return worker;
    }
    vi.stubGlobal("Worker", Worker);
    const word = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "resume.docx");
    const reading = readFile(word);
    const refused = expect(reading).rejects.toThrow("took too long");
    await started;
    await vi.advanceTimersByTimeAsync(30_001);
    await refused;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  // Both formats have `basics`, so JSON Resume answers a Reactive Resume file
  // the moment it is checked first, and every section is silently dropped.
  it("reads Reactive Resume rather than JSON Resume, which its basics also fit", async () => {
    const intake = await readFile(
      json({
        basics: { name: "Ada" },
        sections: { experience: { items: [{ company: "Acme", position: "Lead" }] } },
      }),
    );

    expect(intake.source).toBe("reactive-resume");
    expect(intake.records).toHaveLength(1);
  });

  it("reads RenderCV written as YAML", async () => {
    const intake = await readFile(
      file(
        ["cv:", "  name: Ada", "  sections:", "    Work:", "      - company: Acme"].join("\n"),
        "cv.yaml",
      ),
    );

    expect(intake.source).toBe("rendercv");
    expect(intake.identity.fullName).toBe("Ada");
  });

  // YAML is a superset of JSON, so this format turns up written either way.
  it("reads RenderCV written as JSON", async () => {
    const intake = await readFile(json({ cv: { name: "Ada" } }, "cv.json"));

    expect(intake.source).toBe("rendercv");
  });

  // The two are chosen on different screens and only one of them restores ids.
  it("sends a whole-store backup to the screen that puts it back", async () => {
    await expect(readFile(json({ schemaVersion: 1, owner: {} }))).rejects.toThrow(
      /whole-store backup/,
    );
  });

  // A design is the other thing this product writes as JSON, and the screen
  // that reads one is not this one.
  it("sends a design to the screen that starts a design from it", async () => {
    await expect(
      readFile(json({ name: "Navy headings", spec: { settings: {}, extraCss: "" } })),
    ).rejects.toThrow(/design, not a resume/);
  });

  it("refuses a file that is no format it reads", async () => {
    await expect(readFile(file("just some words", "notes.txt"))).rejects.toThrow(
      UnreadableFileError,
    );
  });
});
