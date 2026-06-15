import { describe, expect, it } from "vitest";
import { renderEmail } from "./email-render";

describe("renderEmail", () => {
  it("renders a themed, escaped, email-safe document", () => {
    const html = renderEmail({
      storeName: "Acme & Co",
      heading: "Big news",
      bodyText: "Hello <there>\n\nSecond paragraph.",
      cta: { label: "Buy now", href: "https://acme.test/pay/x" },
      accent: "#FF0000",
      footerNote: "You opted in.",
      preheader: "A quick note",
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Acme &amp; Co"); // store name escaped
    expect(html).toContain("Hello &lt;there&gt;"); // body escaped
    expect(html).toContain("Second paragraph."); // blank line → second <p>
    expect(html).toContain('bgcolor="#FF0000"'); // accent header + button
    expect(html).toContain('href="https://acme.test/pay/x"');
    expect(html).toContain("A quick note"); // preheader
    expect(html).toContain("You opted in.");
  });

  it("falls back to the default accent on a bad colour and omits a missing CTA", () => {
    const html = renderEmail({ storeName: "S", bodyText: "Hi", accent: "not-a-color" });
    expect(html).toContain('bgcolor="#7C3AED"');
    expect(html).not.toContain("<a "); // no CTA button when cta is omitted
  });
});
