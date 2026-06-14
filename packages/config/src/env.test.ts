import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never load the real root .env during tests — stub the loader to a no-op so
// `serverEnv()` validates only the process.env we set here.
vi.mock("./loadEnv", () => ({ loadEnv: vi.fn() }));

const REQUIRED = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  DIRECT_URL: "postgres://u:p@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  REDIS_URL: "redis://localhost:6379",
} as const;

// Optional/defaulted keys that could otherwise leak in from the real shell env
// and mask a default-value assertion.
const CLEARED = ["ADMIN_EMAILS", "INVOICE_GST_RATE_BPS", "INVOICE_LEGAL_NAME"];

let saved: NodeJS.ProcessEnv;

function setEnv(vars: Record<string, string>) {
  for (const k of [...Object.keys(REQUIRED), ...CLEARED]) delete process.env[k];
  Object.assign(process.env, vars);
}

beforeEach(() => {
  saved = { ...process.env };
  // module-level `cached` must not survive between cases.
  vi.resetModules();
});

afterEach(() => {
  process.env = saved;
});

describe("serverEnv", () => {
  it("parses a valid environment and applies defaults", async () => {
    setEnv({ ...REQUIRED });
    const { serverEnv } = await import("./env");
    const env = serverEnv();
    expect(env.DATABASE_URL).toBe(REQUIRED.DATABASE_URL);
    expect(env.ADMIN_EMAILS).toBe(""); // optional → default ""
    expect(env.INVOICE_GST_RATE_BPS).toBe(1800); // default 18%
    expect(env.INVOICE_LEGAL_NAME).toBe("InvoxAI");
  });

  it("throws and names the missing variable when a required key is absent", async () => {
    const { DATABASE_URL: _omit, ...rest } = REQUIRED;
    setEnv({ ...rest });
    const { serverEnv } = await import("./env");
    expect(() => serverEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws when a URL variable is malformed", async () => {
    setEnv({ ...REQUIRED, DATABASE_URL: "not-a-url" });
    const { serverEnv } = await import("./env");
    expect(() => serverEnv()).toThrow(/Invalid or missing environment variables/);
  });

  it("coerces INVOICE_GST_RATE_BPS from its string env value", async () => {
    setEnv({ ...REQUIRED, INVOICE_GST_RATE_BPS: "500" });
    const { serverEnv } = await import("./env");
    expect(serverEnv().INVOICE_GST_RATE_BPS).toBe(500);
  });

  it("caches the result — a second call ignores later env mutations", async () => {
    setEnv({ ...REQUIRED, ADMIN_EMAILS: "first@x.com" });
    const { serverEnv } = await import("./env");
    const first = serverEnv();
    process.env.ADMIN_EMAILS = "second@x.com";
    const second = serverEnv();
    expect(second).toBe(first); // same cached object reference
    expect(second.ADMIN_EMAILS).toBe("first@x.com");
  });
});
