import { describe, expect, it } from "vitest";
import { formatLocalTimestamp } from "./date-time";

describe("formatLocalTimestamp", () => {
  it("renders offset-bearing timestamps as the same instant in the requested local zone", () => {
    const rendered = formatLocalTimestamp(
      "2026-08-31T23:31:39+02:00",
      "detail",
      "Europe/London",
    );

    expect(rendered).toContain("22:31:39");
    expect(rendered).toMatch(/BST|GMT\+1/);
  });

  it("does not render invalid dates", () => {
    expect(formatLocalTimestamp("not-a-date")).toBe("—");
  });
});
