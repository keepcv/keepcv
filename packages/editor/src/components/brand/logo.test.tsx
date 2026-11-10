import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo.js";

describe.each([false, true])("Logo with mark=%s", (mark) => {
  it("leaves the containing control responsible for its accessible name", () => {
    render(
      <a href="/" aria-label="KeepCV home">
        <Logo mark={mark} />
      </a>,
    );

    expect(screen.getByRole("link", { name: "KeepCV home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("names standalone vector lettering and symbols when a label is supplied", () => {
    render(<Logo mark={mark} label="KeepCV" />);

    expect(screen.getByRole("img", { name: "KeepCV" })).not.toHaveAttribute("aria-hidden");
  });
});
