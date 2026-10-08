import { describe, expect, test } from "bun:test";
import { getErrorMessage } from "../src/shared/lib/errorMessage";

describe("getErrorMessage", () => {
  test("reads native and serialized errors", () => {
    expect(getErrorMessage(new Error("native failure"))).toBe("native failure");
    expect(getErrorMessage(" backend failure ")).toBe("backend failure");
    expect(getErrorMessage({ message: "serialized failure" })).toBe("serialized failure");
  });

  test("reads nested Tauri-style error payloads", () => {
    expect(getErrorMessage({ error: { cause: "mpv instance not found" } })).toBe(
      "mpv instance not found",
    );
  });

  test("ignores values without a useful message", () => {
    expect(getErrorMessage("   ")).toBeNull();
    expect(getErrorMessage({ message: "" })).toBeNull();
    expect(getErrorMessage(404)).toBeNull();
  });
});
