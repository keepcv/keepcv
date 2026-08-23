import { describe, expect, it } from "vitest";
import { readFile, UnreadableFileError } from "./read-file.js";

const file = (body: string, name = "resume.json") => new File([body], name);

const json = (value: unknown, name?: string) => file(JSON.stringify(value), name);

describe("deciding which reader a file needs", () => {
  it("reads JSON Resume", async () => {
    const intake = await readFile(json({ basics: { name: "Ada" }, work: [{ name: "Acme" }] }));

    expect(intake.source).toBe("json-resume");
    expect(intake.identity.fullName).toBe("Ada");
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

  it("refuses a file that is no format it reads", async () => {
    await expect(readFile(file("just some words", "notes.txt"))).rejects.toThrow(
      UnreadableFileError,
    );
  });
});
