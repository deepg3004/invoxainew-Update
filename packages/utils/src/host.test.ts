import { describe, expect, it } from "vitest";
import { tenantUsernameFromHost } from "./host";

describe("tenantUsernameFromHost", () => {
  it("resolves a single-label subdomain to a username", () => {
    expect(tenantUsernameFromHost("deep.invoxai.io")).toBe("deep");
    expect(tenantUsernameFromHost("deep-store.invoxai.io:443")).toBe(
      "deep-store",
    );
    expect(tenantUsernameFromHost("Deep.Invoxai.IO")).toBe("deep");
  });

  it("resolves tenants in local dev under localhost", () => {
    expect(tenantUsernameFromHost("deep.localhost:3003")).toBe("deep");
  });

  it("returns null for the apex and www", () => {
    expect(tenantUsernameFromHost("invoxai.io")).toBeNull();
    expect(tenantUsernameFromHost("www.invoxai.io")).toBeNull();
    expect(tenantUsernameFromHost("localhost:3003")).toBeNull();
  });

  it("returns null for reserved platform subdomains", () => {
    for (const h of ["app.invoxai.io", "admin.invoxai.io", "api.invoxai.io"]) {
      expect(tenantUsernameFromHost(h)).toBeNull();
    }
  });

  it("returns null for nested subdomains and bad input", () => {
    expect(tenantUsernameFromHost("a.b.invoxai.io")).toBeNull();
    expect(tenantUsernameFromHost("foo.example.com")).toBeNull();
    expect(tenantUsernameFromHost("")).toBeNull();
    expect(tenantUsernameFromHost(null)).toBeNull();
  });
});
