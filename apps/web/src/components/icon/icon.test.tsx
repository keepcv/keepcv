import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GLYPHS } from "./glyphs.js";
import { Icon } from "./icon.js";
import { Spot } from "./spot.js";

const names = Object.keys(GLYPHS) as (keyof typeof GLYPHS)[];

describe("Icon", () => {
  // A name whose lucide export was renamed or removed by an upgrade is
  // `undefined` here, and React renders nothing rather than failing.
  it("draws something for every name in the registry", () => {
    const { container } = render(
      <div>
        {names.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </div>,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(names.length);
  });

  it("hides a decorative icon from the accessibility tree", () => {
    const { container } = render(<Icon name="record" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  // An icon that is the whole control has to announce something.
  it("names an icon given a label", () => {
    render(<Icon name="archive" label="Archive" />);

    expect(screen.getByRole("img", { name: "Archive" })).toBeInTheDocument();
  });
});

describe("Spot", () => {
  it("draws every illustration", () => {
    const { container } = render(
      <div>
        <Spot name="emptyStore" />
        <Spot name="noResults" />
        <Spot name="permanent" />
        <Spot name="compose" />
        <Spot name="versions" />
      </div>,
    );

    const spots = container.querySelectorAll("svg");
    expect(spots).toHaveLength(5);
    for (const spot of spots) expect(spot.childElementCount).toBeGreaterThan(0);
  });
});
