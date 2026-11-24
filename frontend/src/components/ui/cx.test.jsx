import { describe, it, expect } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy class names and skips falsy values", () => {
    expect(cx("a", false, "b", null, undefined, "")).toBe("a b");
  });
});
