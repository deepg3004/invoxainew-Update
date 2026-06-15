import { describe, expect, it } from "vitest";
import { safeUrl, toEmbedUrl, normalizeToBlocks, normalizeSeo } from "./blocks";

// Per-page SEO overrides (audit). ogImage must pass the same URL trust boundary.
describe("normalizeSeo", () => {
  it("caps text fields and sanitizes ogImage", () => {
    expect(normalizeSeo({ seo: { metaTitle: " Hi ", description: " desc ", ogImage: "https://x.com/a.png" } })).toEqual({
      metaTitle: "Hi",
      description: "desc",
      ogImage: "https://x.com/a.png",
    });
  });
  it("drops a javascript: ogImage and defaults missing fields to empty", () => {
    expect(normalizeSeo({ seo: { ogImage: "javascript:alert(1)" } })).toEqual({ metaTitle: "", description: "", ogImage: "" });
    expect(normalizeSeo({})).toEqual({ metaTitle: "", description: "", ogImage: "" });
  });
  it("is included in normalizeToBlocks output", () => {
    expect(normalizeToBlocks({ title: "T", blocks: [], seo: { description: "d" } }).seo).toEqual({
      metaTitle: "",
      description: "d",
      ogImage: "",
    });
  });
});

// Builder Part 2 — widget blocks must be validated + capped by normalizeToBlocks (the
// trust boundary) so AI-generated / edited content stays safe and well-formed.
describe("normalizeToBlocks — Part 2 widgets", () => {
  const norm = (block: unknown) => normalizeToBlocks({ blocks: [block] }).blocks;

  it("accepts a list and drops empty items, capping at 20", () => {
    const out = norm({ type: "list", items: ["A", "  ", "B", 5, null] });
    expect(out).toEqual([{ type: "list", items: ["A", "B"] }]);
    const big = norm({ type: "list", items: Array.from({ length: 30 }, (_, i) => `i${i}`) });
    expect((big[0] as { items: string[] }).items).toHaveLength(20);
  });

  it("drops a list with no usable items", () => {
    expect(norm({ type: "list", items: ["", "   "] })).toEqual([]);
    expect(norm({ type: "list" })).toEqual([]);
  });

  it("accepts a testimonial (author optional) and requires a quote", () => {
    expect(norm({ type: "testimonial", quote: "Great!", author: "Asha" })).toEqual([
      { type: "testimonial", quote: "Great!", author: "Asha" },
    ]);
    expect(norm({ type: "testimonial", quote: "Solo" })).toEqual([
      { type: "testimonial", quote: "Solo", author: "" },
    ]);
    expect(norm({ type: "testimonial", author: "No quote" })).toEqual([]);
  });

  it("accepts a callout and requires text", () => {
    expect(norm({ type: "callout", text: "Limited offer" })).toEqual([
      { type: "callout", text: "Limited offer" },
    ]);
    expect(norm({ type: "callout", text: "   " })).toEqual([]);
  });

  it("accepts an faq, drops pairs missing q or a, caps at 20", () => {
    const out = norm({
      type: "faq",
      items: [
        { q: "Q1", a: "A1" },
        { q: "no answer" },
        { a: "no question" },
        { q: "  ", a: "blank q" },
      ],
    });
    expect(out).toEqual([{ type: "faq", items: [{ q: "Q1", a: "A1" }] }]);
    const big = norm({ type: "faq", items: Array.from({ length: 25 }, (_, i) => ({ q: `q${i}`, a: `a${i}` })) });
    expect((big[0] as { items: unknown[] }).items).toHaveLength(20);
    expect(norm({ type: "faq", items: [] })).toEqual([]);
  });

  it("accepts a countdown with a parseable date and drops a bad one", () => {
    const out = norm({ type: "countdown", until: "2030-01-01T00:00:00.000Z", label: "Sale ends in" });
    expect(out).toEqual([{ type: "countdown", until: "2030-01-01T00:00:00.000Z", label: "Sale ends in" }]);
    expect(norm({ type: "countdown", until: "not a date" })).toEqual([]);
    expect(norm({ type: "countdown" })).toEqual([]);
  });

  it("accepts a columns block, drops empty cells, caps at 4", () => {
    const out = norm({ type: "columns", cells: [{ title: "A", text: "x" }, { title: "", text: "" }] });
    expect(out).toEqual([{ type: "columns", cells: [{ title: "A", text: "x" }] }]);
    const big = norm({ type: "columns", cells: Array.from({ length: 6 }, (_, i) => ({ title: `c${i}`, text: "t" })) });
    expect((big[0] as { cells: unknown[] }).cells).toHaveLength(4);
    expect(norm({ type: "columns", cells: [] })).toEqual([]);
  });

  it("accepts a socialProof block (no config)", () => {
    expect(norm({ type: "socialProof" })).toEqual([{ type: "socialProof" }]);
  });

  it("still drops unknown block types", () => {
    expect(norm({ type: "script", text: "alert(1)" })).toEqual([]);
  });
});

// Builder Part 3 — entity-bound widgets store ONLY a validated UUID; the renderer
// resolves it tenant-scoped. normalizeToBlocks must accept well-formed ids and
// drop anything that isn't a UUID (so a malformed/injected ref never persists).
describe("normalizeToBlocks — Part 3 entity widgets", () => {
  const norm = (block: unknown) => normalizeToBlocks({ blocks: [block] }).blocks;
  const UUID = "11111111-2222-4333-8444-555555555555";

  it("accepts product/course/leadForm with a valid UUID", () => {
    expect(norm({ type: "product", productId: UUID })).toEqual([{ type: "product", productId: UUID }]);
    expect(norm({ type: "course", courseId: UUID })).toEqual([{ type: "course", courseId: UUID }]);
    expect(norm({ type: "leadForm", formId: UUID })).toEqual([{ type: "leadForm", formId: UUID }]);
  });

  it("drops an entity widget whose id isn't a UUID", () => {
    expect(norm({ type: "product", productId: "not-a-uuid" })).toEqual([]);
    expect(norm({ type: "product", productId: "../../etc/passwd" })).toEqual([]);
    expect(norm({ type: "course" })).toEqual([]);
    expect(norm({ type: "leadForm", formId: 123 })).toEqual([]);
  });

  it("storeGrid is valid with no collection, and keeps a valid collectionId", () => {
    expect(norm({ type: "storeGrid" })).toEqual([{ type: "storeGrid", collectionId: null }]);
    expect(norm({ type: "storeGrid", collectionId: "bad" })).toEqual([{ type: "storeGrid", collectionId: null }]);
    expect(norm({ type: "storeGrid", collectionId: UUID })).toEqual([{ type: "storeGrid", collectionId: UUID }]);
  });

  it("paymentButton requires a valid pageId and defaults the label", () => {
    expect(norm({ type: "paymentButton", pageId: UUID })).toEqual([
      { type: "paymentButton", pageId: UUID, label: "Buy now" },
    ]);
    expect(norm({ type: "paymentButton", pageId: UUID, label: "Enrol now" })).toEqual([
      { type: "paymentButton", pageId: UUID, label: "Enrol now" },
    ]);
    expect(norm({ type: "paymentButton", label: "no id" })).toEqual([]);
  });
});

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
