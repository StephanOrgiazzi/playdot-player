import { describe, expect, test } from "bun:test";
import {
  parseReleaseChecksumLine,
  pickMpvDevArchive,
  pickReleaseFile,
} from "../scripts/setup-lib.mjs";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("release checksum parsing", () => {
  test("parses GNU binary checksum lines", () => {
    expect(parseReleaseChecksumLine(`${HASH_A} *runtime.zip`)).toEqual({
      sha256: HASH_A,
      fileName: "runtime.zip",
    });
  });

  test("parses BSD checksum lines", () => {
    expect(parseReleaseChecksumLine(`SHA256 (runtime.zip) = ${HASH_B}`)).toEqual({
      sha256: HASH_B,
      fileName: "runtime.zip",
    });
  });

  test("returns the checksum together with the selected filename", () => {
    expect(
      pickReleaseFile(
        `${HASH_A} first.zip\n${HASH_B} wanted.zip`,
        (fileName) => fileName === "wanted.zip",
      ),
    ).toEqual({ sha256: HASH_B, fileName: "wanted.zip" });
  });
});

describe("mpv archive selection", () => {
  test("prefers the LGPL archive and rejects v3-only builds", () => {
    const selected = pickMpvDevArchive(
      [
        `${HASH_A} mpv-dev-x86_64-v3-20260718.7z`,
        `${HASH_B} mpv-dev-lgpl-x86_64-20260718.7z`,
      ].join("\n"),
      "x86_64",
    );

    expect(selected).toEqual({
      sha256: HASH_B,
      fileName: "mpv-dev-lgpl-x86_64-20260718.7z",
    });
  });
});
