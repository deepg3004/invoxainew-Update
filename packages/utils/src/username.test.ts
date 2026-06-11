import { describe, expect, it } from "vitest";
import {
  isValidUsername,
  normalizeUsername,
  validateUsername,
} from "./username";

describe("validateUsername", () => {
  it("accepts simple valid names", () => {
    for (const name of ["abc", "user123", "a-b-c", "deep-store", "x".repeat(30)]) {
      expect(validateUsername(name)).toEqual({ ok: true, value: name });
    }
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(validateUsername("  DeepStore  ")).toEqual({
      ok: true,
      value: "deepstore",
    });
    expect(normalizeUsername("  ABC ")).toBe("abc");
  });

  it("rejects too short / too long", () => {
    expect(validateUsername("ab")).toMatchObject({ ok: false, error: "too_short" });
    expect(validateUsername("x".repeat(31))).toMatchObject({
      ok: false,
      error: "too_long",
    });
  });

  it("rejects invalid characters and hyphen edges", () => {
    for (const bad of ["-abc", "abc-", "ab c", "abc_", "abç", "a.b", "UPPER!"]) {
      expect(validateUsername(bad)).toMatchObject({
        ok: false,
        error: "invalid_chars",
      });
    }
  });

  it("blocks reserved names (case-insensitively)", () => {
    for (const r of ["admin", "API", "Invoxai", "www", "checkout", "wallet"]) {
      expect(validateUsername(r)).toMatchObject({ ok: false, error: "reserved" });
    }
  });

  it("isValidUsername mirrors validateUsername", () => {
    expect(isValidUsername("good-name")).toBe(true);
    expect(isValidUsername("admin")).toBe(false);
  });
});
