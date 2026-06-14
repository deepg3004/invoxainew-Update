import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase browser-client factory so we never hit the network and can
// assert exactly how it's called.
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ __kind: "browser-client" })),
}));

import { createBrowserClient } from "@supabase/ssr";
import { createBrowserSupabaseClient } from "./client";

const URL = "https://proj.supabase.co";
const ANON = "anon-public-key";

describe("createBrowserSupabaseClient", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("builds the client from the public url + anon key", () => {
    const client = createBrowserSupabaseClient();
    expect(createBrowserClient).toHaveBeenCalledWith(URL, ANON);
    expect(client).toEqual({ __kind: "browser-client" });
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createBrowserSupabaseClient()).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createBrowserSupabaseClient()).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  });
});
