import { describe, expect, it } from "vitest";
import { bioAllowedHrefs, bioRender, trackHref } from "./bio";

// bioRender is the SINGLE source of truth for a bio page's clickable targets,
// shared by the public page (rendering) and the /bio/r redirect (its allowlist).
// Two invariants matter most:
//   1. Every href is sanitized via safeUrl — javascript:/data:/protocol-relative
//      URLs must NEVER survive (XSS + open-redirect prevention).
//   2. bioAllowedHrefs must contain EXACTLY the hrefs bioRender produced, so the
//      redirect can only forward to a target really on this tenant's bio.
// These tests lock both. (safeUrl is exercised through the real module, not a
// mock, so the security contract is asserted end-to-end.)

const EMPTY: Parameters<typeof bioRender>[0] = {
  linksText: null,
  instagram: null,
  youtube: null,
  twitter: null,
  facebook: null,
  whatsapp: null,
  website: null,
  tiktok: null,
  linkedin: null,
  threads: null,
};

const NO_CATALOG = { hasProducts: false, hasCourses: false };

describe("bioRender — socials", () => {
  it("includes only the socials that have a valid https URL", () => {
    const { socials } = bioRender(
      { ...EMPTY, instagram: "https://instagram.com/acme", website: "https://acme.test" },
      NO_CATALOG,
    );
    expect(socials).toEqual([
      { label: "Instagram", href: "https://instagram.com/acme" },
      { label: "Website", href: "https://acme.test" },
    ]);
  });

  it("drops socials whose URL is unsafe (javascript:/data:/protocol-relative)", () => {
    const { socials } = bioRender(
      {
        ...EMPTY,
        instagram: "javascript:alert(1)",
        youtube: "data:text/html,<script>alert(1)</script>",
        twitter: "//evil.example.com",
        facebook: "https://facebook.com/ok",
      },
      NO_CATALOG,
    );
    expect(socials).toEqual([{ label: "Facebook", href: "https://facebook.com/ok" }]);
  });

  it("returns no socials when all fields are blank", () => {
    expect(bioRender(EMPTY, NO_CATALOG).socials).toEqual([]);
  });
});

describe("bioRender — auto buttons + parsed links", () => {
  it("prepends store/courses buttons based on catalog flags", () => {
    const { buttons } = bioRender(EMPTY, { hasProducts: true, hasCourses: true });
    expect(buttons).toEqual([
      { label: "🛍️ Visit store", href: "/store" },
      { label: "🎓 Browse courses", href: "/courses" },
    ]);
  });

  it("parses 'Label | url' lines into sanitized targets", () => {
    const { buttons } = bioRender(
      { ...EMPTY, linksText: "My Blog | https://blog.test\nShop | https://shop.test" },
      NO_CATALOG,
    );
    expect(buttons).toEqual([
      { label: "My Blog", href: "https://blog.test" },
      { label: "Shop", href: "https://shop.test" },
    ]);
  });

  it("drops link lines whose URL is unsafe", () => {
    const { buttons } = bioRender(
      { ...EMPTY, linksText: "Evil | javascript:alert(1)\nGood | https://ok.test" },
      NO_CATALOG,
    );
    expect(buttons).toEqual([{ label: "Good", href: "https://ok.test" }]);
  });

  it("drops a line with no '|' separator (href comes only from after the pipe)", () => {
    // "https://nolabel.test" has no pipe → href is parsed from "" → empty → dropped.
    const { buttons } = bioRender(
      { ...EMPTY, linksText: "https://nolabel.test" },
      NO_CATALOG,
    );
    expect(buttons).toEqual([]);
  });

  it("falls back to the href as the label when the label part is empty", () => {
    const { buttons } = bioRender(
      { ...EMPTY, linksText: "| https://nolabel.test" },
      NO_CATALOG,
    );
    expect(buttons).toEqual([{ label: "https://nolabel.test", href: "https://nolabel.test" }]);
  });

  it("caps parsed links at 30 lines", () => {
    const linksText = Array.from({ length: 40 }, (_, i) => `L${i} | https://x${i}.test`).join("\n");
    const { buttons } = bioRender({ ...EMPTY, linksText }, NO_CATALOG);
    expect(buttons).toHaveLength(30);
  });
});

describe("bioAllowedHrefs", () => {
  it("maps exactly the hrefs that bioRender produced (allowlist parity)", () => {
    const rendered = bioRender(
      {
        ...EMPTY,
        instagram: "https://instagram.com/acme",
        linksText: "Blog | https://blog.test",
      },
      { hasProducts: true, hasCourses: false },
    );
    const allowed = bioAllowedHrefs(rendered);

    const expectedHrefs = [...rendered.socials, ...rendered.buttons].map((t) => t.href);
    expect([...allowed.keys()].sort()).toEqual([...expectedHrefs].sort());
    expect(allowed.get("https://instagram.com/acme")).toBe("Instagram");
    expect(allowed.get("/store")).toBe("🛍️ Visit store");
    // An off-bio target is NOT in the allowlist → redirect would refuse it.
    expect(allowed.has("https://evil.example.com")).toBe(false);
  });
});

describe("trackHref", () => {
  it("wraps a target through the tracking redirect with an encoded url", () => {
    expect(trackHref("https://blog.test/a?b=c")).toBe(
      "/bio/r?u=https%3A%2F%2Fblog.test%2Fa%3Fb%3Dc",
    );
  });
});
