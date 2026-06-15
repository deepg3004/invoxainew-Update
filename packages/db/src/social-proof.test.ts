import { describe, expect, it } from "vitest";
import { socialProofName } from "./social-proof";

// socialProofName is the privacy boundary for the public social-proof popups: it must
// only ever emit a plausible first name or "Someone" — never an email domain, full
// address, phone, or surname. A leak here would expose buyer PII on public pages.

describe("socialProofName", () => {
  it("uses a captured first name when present", () => {
    expect(socialProofName({ name: "Priya Sharma" })).toBe("Priya");
  });

  it("derives a first name from the email local part", () => {
    expect(socialProofName({ email: "rahul.kumar@gmail.com" })).toBe("Rahul");
    expect(socialProofName({ email: "anita_99@outlook.com" })).toBe("Anita");
    expect(socialProofName({ email: "deepak+promo@x.io" })).toBe("Deepak");
  });

  it("never exposes the domain or full email", () => {
    const out = socialProofName({ email: "someone@secret-company.com" });
    expect(out).not.toContain("@");
    expect(out).not.toContain("secret");
    expect(out).not.toContain(".com");
  });

  it("falls back to 'Someone' for non-name-like locals", () => {
    expect(socialProofName({ email: "12345@x.com" })).toBe("Someone");
    expect(socialProofName({ email: "a@x.com" })).toBe("Someone"); // too short
    expect(socialProofName({ email: "x".repeat(20) + "@x.com" })).toBe("Someone"); // too long
    expect(socialProofName({ email: "x_y_z@x.com" })).toBe("Someone"); // single-letter tokens
    expect(socialProofName({ email: "99-77@x.com" })).toBe("Someone"); // digits only
  });

  it("falls back to 'Someone' when nothing usable is given", () => {
    expect(socialProofName({})).toBe("Someone");
    expect(socialProofName({ email: null, name: null })).toBe("Someone");
    expect(socialProofName({ email: "" })).toBe("Someone");
  });

  it("prefers the captured name over the email", () => {
    expect(socialProofName({ name: "Meera", email: "xyz123@x.com" })).toBe("Meera");
  });

  it("ignores a non-name captured value and falls through to email", () => {
    expect(socialProofName({ name: "  ", email: "kavya.r@x.com" })).toBe("Kavya");
  });
});
