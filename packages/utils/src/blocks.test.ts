import { describe, expect, it } from "vitest";
import { safeUrl, toEmbedUrl } from "./blocks";

// safeUrl feeds hrefs/srcs rendered on PUBLIC tenant pages (AI pages, bio links)
// — these tests pin the trust boundary.
describe("safeUrl", () => {
  it("allows http(s) absolute URLs", () => {
    expect(safeUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows site-relative paths", () => {
    expect(safeUrl("/pay/my-link")).toBe("/pay/my-link");
  });

  it("blocks javascript: and data:", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,x")).toBe("");
  });

  it("blocks protocol-relative //host", () => {
    expect(safeUrl("//evil.com")).toBe("");
  });

  it("blocks backslash bypasses of the protocol-relative check", () => {
    // Browsers normalize \ to /, so these resolve like //evil.com.
    expect(safeUrl("/\\evil.com")).toBe("");
    expect(safeUrl("/\\/evil.com")).toBe("");
    expect(safeUrl("/x\\..\\..\\evil")).toBe("");
  });

  it("blocks tab/newline bypasses of the protocol-relative check", () => {
    // The URL parser strips ASCII tab/newline BEFORE parsing, so "/<tab>/evil.com"
    // resolves like //evil.com.
    expect(safeUrl("/\t/evil.com")).toBe("");
    expect(safeUrl("/\n/evil.com")).toBe("");
    expect(safeUrl("/\r/evil.com")).toBe("");
    expect(safeUrl("/\t\\evil.com")).toBe("");
  });

  it("blocks empty and non-string input", () => {
    expect(safeUrl("")).toBe("");
    expect(safeUrl(null)).toBe("");
    expect(safeUrl(42)).toBe("");
  });
});

// toEmbedUrl feeds <iframe src> directly — output must be provider-locked.
describe("toEmbedUrl", () => {
  it("rebuilds canonical YouTube embeds", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rebuilds canonical Vimeo embeds", () => {
    expect(toEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("drops arbitrary and hostile URLs", () => {
    expect(toEmbedUrl("https://evil.com/embed/x")).toBe("");
    expect(toEmbedUrl("javascript:alert(1)")).toBe("");
    expect(toEmbedUrl("")).toBe("");
  });
});
