import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const h = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getTenantByOwnerId: vi.fn(),
}));
vi.mock("./auth", () => ({ getSessionUser: h.getSessionUser }));
vi.mock("@invoxai/db", () => ({ getTenantByOwnerId: h.getTenantByOwnerId }));

import { requireTenant } from "./tenant";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireTenant", () => {
  it("redirects to /login when signed out", async () => {
    h.getSessionUser.mockResolvedValueOnce(null);
    await expect(requireTenant()).rejects.toThrow("REDIRECT:/login");
    expect(h.getTenantByOwnerId).not.toHaveBeenCalled();
  });

  it("redirects to /onboarding when the user has no tenant", async () => {
    h.getSessionUser.mockResolvedValueOnce({ id: "u1" });
    h.getTenantByOwnerId.mockResolvedValueOnce(null);
    await expect(requireTenant()).rejects.toThrow("REDIRECT:/onboarding");
    expect(h.getTenantByOwnerId).toHaveBeenCalledWith("u1");
  });

  it("scopes by the owner's id and returns only the whitelisted tenant fields", async () => {
    const user = { id: "owner-1", email: "seller@example.com" };
    h.getSessionUser.mockResolvedValueOnce(user);
    h.getTenantByOwnerId.mockResolvedValueOnce({
      id: "t1",
      username: "deepstore",
      name: "Deep Store",
      stateCode: "KA",
      // fields that MUST NOT leak through requireTenant:
      ownerId: "owner-1",
      secretInternalColumn: "nope",
    });

    const result = await requireTenant();

    expect(result.user).toBe(user);
    expect(result.tenant).toEqual({
      id: "t1",
      username: "deepstore",
      name: "Deep Store",
      stateCode: "KA",
    });
    // tenant id is derived from the session lookup, never from request input.
    expect(h.getTenantByOwnerId).toHaveBeenCalledWith("owner-1");
    expect(result.tenant).not.toHaveProperty("secretInternalColumn");
  });
});
