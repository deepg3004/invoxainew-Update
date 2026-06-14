import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// redirect() normally throws (it never returns) — model that so code after it
// does not run, and we can assert the redirect target.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const env = vi.hoisted(() => ({ ADMIN_EMAILS: "admin@invoxai.io, Boss@Example.com" }));
vi.mock("@invoxai/config", () => ({ serverEnv: () => env }));

const h = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("./supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ auth: { getUser: h.getUser } })),
}));

import { getSessionUser, isAdminEmail, requireAdmin } from "./auth";

function asUser(user: unknown) {
  h.getUser.mockResolvedValueOnce({ data: { user } });
}

beforeEach(() => {
  vi.clearAllMocks();
  env.ADMIN_EMAILS = "admin@invoxai.io, Boss@Example.com";
});

describe("isAdminEmail", () => {
  it("is false for null / undefined / empty", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("matches allowlisted emails case-insensitively and trims whitespace", () => {
    expect(isAdminEmail("admin@invoxai.io")).toBe(true);
    expect(isAdminEmail("ADMIN@INVOXAI.IO")).toBe(true);
    expect(isAdminEmail("  admin@invoxai.io  ")).toBe(true);
    // entry was "Boss@Example.com" — allowlist is lowercased on parse.
    expect(isAdminEmail("boss@example.com")).toBe(true);
  });

  it("is false for non-allowlisted emails", () => {
    expect(isAdminEmail("attacker@evil.com")).toBe(false);
  });

  it("is always false when the allowlist is empty", () => {
    env.ADMIN_EMAILS = "";
    expect(isAdminEmail("admin@invoxai.io")).toBe(false);
  });
});

describe("getSessionUser", () => {
  it("returns the user from getUser()", async () => {
    asUser({ id: "u1", email: "a@b.com" });
    expect(await getSessionUser()).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("returns null when there is no session", async () => {
    asUser(null);
    expect(await getSessionUser()).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("redirects to /login when unauthenticated", async () => {
    asUser(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns a non-ok gate (no redirect) for a signed-in non-admin", async () => {
    const user = { id: "u2", email: "user@example.com" };
    asUser(user);
    await expect(requireAdmin()).resolves.toEqual({
      ok: false,
      user,
      reason: "not_allowlisted",
    });
  });

  it("returns an ok gate for an allowlisted admin", async () => {
    const user = { id: "u3", email: "admin@invoxai.io" };
    asUser(user);
    await expect(requireAdmin()).resolves.toEqual({ ok: true, user });
  });
});
