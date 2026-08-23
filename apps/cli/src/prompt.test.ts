import { describe, expect, it } from "vitest";
import { keystroke } from "./prompt.js";

const DEL = String.fromCharCode(127);
const CTRL_C = String.fromCharCode(3);
const ESCAPE = String.fromCharCode(27);

function typeAll(keys: string): { typed: string; cancelled: boolean } | "still typing" {
  let typed = "";
  for (const key of keys) {
    const next = keystroke(typed, key);
    if (next.done) return { typed, cancelled: next.cancelled };
    typed = next.typed;
  }
  return "still typing";
}

describe("keystroke", () => {
  it("collects what was typed until Enter", () => {
    expect(typeAll("hunter2\r")).toEqual({ typed: "hunter2", cancelled: false });
    expect(typeAll("hunter2\n")).toEqual({ typed: "hunter2", cancelled: false });
    expect(typeAll("hunter2")).toBe("still typing");
  });

  // A terminal sends one or the other depending on which one it is.
  it("erases on either backspace", () => {
    expect(typeAll(`hunter23${DEL}\r`)).toEqual({ typed: "hunter2", cancelled: false });
    expect(typeAll("hunter23\b\r")).toEqual({ typed: "hunter2", cancelled: false });
    expect(typeAll(`${DEL}\r`)).toEqual({ typed: "", cancelled: false });
  });

  it("says cancelled rather than answering what had been typed so far", () => {
    expect(typeAll(`hunter2${CTRL_C}`)).toEqual({ typed: "hunter2", cancelled: true });
  });

  // An arrow key arrives as escape, `[`, `D`. Without dropping the escape the
  // password holds a character nobody typed and nothing signs in again.
  it("drops the control character an arrow key arrives as", () => {
    expect(typeAll(`hun${ESCAPE}[Dter2\r`)).toEqual({ typed: "hun[Dter2", cancelled: false });
  });

  it("keeps a space, which is a character a passphrase has", () => {
    expect(typeAll("two words\r")).toEqual({ typed: "two words", cancelled: false });
  });
});
