import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ __kind: "server-client" })),
}));

import { createServerClient } from "@supabase/ssr";
import { createServerSupabaseClient, type CookieAdapter } from "./ssr";

const URL = "https://proj.supabase.co";
const ANON = "anon-public-key";

function fakeCookies(): CookieAdapter {
  return { getAll: () => [], setAll: () => {} };
}

describe("createServerSupabaseClient", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("passes the url, anon key and cookie adapter through to createServerClient", () => {
    const cookies = fakeCookies();
    const client = createServerSupabaseClient(cookies);
    expect(createServerClient).toHaveBeenCalledWith(URL, ANON, { cookies });
    expect(client).toEqual({ __kind: "server-client" });
  });

  it("throws when public env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createServerSupabaseClient(fakeCookies())).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
