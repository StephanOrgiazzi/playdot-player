import { describe, expect, test } from "bun:test";
import { getErrorMessage } from "../src/shared/lib/error";

describe("getErrorMessage", () => {
  test("uses an Error message", () => {
    expect(getErrorMessage(new Error("native init failed"), "fallback")).toBe(
      "native init failed",
    );
  });

  test("preserves string rejections from Tauri commands", () => {
    expect(getErrorMessage("libmpv-2.dll was not found", "fallback")).toBe(
      "libmpv-2.dll was not found",
    );
  });

  test("falls back for empty or unknown failures", () => {
    expect(getErrorMessage("  ", "fallback")).toBe("fallback");
    expect(getErrorMessage({ reason: "unknown" }, "fallback")).toBe("fallback");
  });
});
