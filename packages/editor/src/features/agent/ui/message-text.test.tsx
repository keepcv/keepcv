import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MessageText } from "./message-text.js";
import { ToolActivity } from "./tool-activity.js";

it("formats emphasis, lists and code without interpreting model-authored HTML", () => {
  const { container } = render(
    <MessageText
      text={
        '**Review** your `Point`.\n\n- First\n- Second\n\n<img src="https://example.com/tracker" onerror="alert(1)">'
      }
    />,
  );
  expect(screen.getByText("Review").tagName).toBe("STRONG");
  expect(screen.getByText("Point").tagName).toBe("CODE");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent('<img src="https://example.com/tracker" onerror="alert(1)">');
});

it("keeps HTML and formatting markers literal inside fenced code", () => {
  const { container } = render(<MessageText text={"```html\n<strong>**literal**</strong>\n```"} />);
  expect(container.querySelector("pre code")).toHaveTextContent("<strong>**literal**</strong>");
  expect(container.querySelector("strong")).toBeNull();
});

it("shows actual tool names and purposes without any disclosure control", () => {
  const { container } = render(
    <ToolActivity
      calls={[
        { name: "read_store", summary: "Read records" },
        { name: "propose_changes", summary: "Propose 1 changes" },
      ]}
    />,
  );
  expect(screen.getByRole("list", { name: "Tools called" })).toBeVisible();
  expect(screen.getByText("read_store")).toBeVisible();
  expect(screen.getByText("Read records")).toBeVisible();
  expect(screen.getByText("propose_changes")).toBeVisible();
  expect(container.querySelector("details")).toBeNull();
});
