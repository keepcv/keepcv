import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Landing } from "./landing.js";

describe("the landing page", () => {
  // It is what someone arriving without a token sees, and a token is only ever
  // printed by the launcher: a page that does not say so is a dead end.
  it("says how to start the app", () => {
    render(<Landing />);

    expect(screen.getByText("keepcv serve")).toBeInTheDocument();
    expect(screen.getByText(/token is in the fragment/)).toBeInTheDocument();
  });

  it("leads with the problem the store exists to solve", () => {
    render(<Landing />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Your career history is not a resume file/,
    );
    expect(
      screen.getByText(/every trim to fit one page is a delete you cannot undo/i),
    ).toBeInTheDocument();
  });

  // These are the differentiators, and every one of them was buried a level or
  // two inside the app with nothing naming it.
  it("names what the app can do", () => {
    render(<Landing />);

    for (const feature of [
      "Points, not bullets",
      "Wording with a history",
      "A resume is a selection",
      "Read the posting",
      "Checked as sent",
      "A length budget",
      "Versions and snapshots",
      "Leaves in your format",
      "One readable file",
    ]) {
      expect(screen.getByRole("heading", { name: feature })).toBeInTheDocument();
    }
  });

  it("promises export is never gated", () => {
    render(<Landing />);

    expect(screen.getByText(/Export is never gated/)).toBeInTheDocument();
  });
});
