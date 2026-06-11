/**
 * Username (subdomain label) rules for tenants.
 *
 * Constraints: lowercase, 3–30 chars, letters/numbers/hyphen, must start and
 * end with an alphanumeric (so it is a valid DNS label), not a reserved name.
 *
 * Pure + dependency-free so it can be reused on the client (live form
 * validation), the server (authoritative re-check before insert), and tests.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Start and end alphanumeric; hyphens permitted in between.
const USERNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Reserved labels that must never become a tenant: platform subdomains,
 * common infra hostnames, auth/billing paths, and abuse-prone impersonation
 * names. This is a security/UX guard and is intentionally code-owned (unlike
 * pricing, which is DB-driven).
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // platform subdomains / apps
  "www", "app", "apps", "admin", "api", "tenant", "tenants", "internal",
  // infra hostnames
  "mail", "smtp", "imap", "pop", "ftp", "ns", "ns1", "ns2", "dns", "cdn",
  "static", "assets", "img", "images", "media", "files", "storage",
  // product/auth/billing surfaces
  "auth", "oauth", "login", "logout", "signin", "signup", "register",
  "account", "accounts", "billing", "pay", "payment", "payments", "checkout",
  "order", "orders", "wallet", "invoice", "subscribe", "subscription",
  "dashboard", "settings", "onboarding", "support", "help", "status", "docs",
  // store/course surfaces
  "store", "shop", "cart", "course", "courses", "buyer", "seller", "sellers",
  // brand / impersonation
  "invoxai", "invox", "official", "team", "staff", "root", "system", "sys",
  "superadmin", "administrator", "webmaster", "postmaster", "hostmaster",
  // misc reserved
  "about", "contact", "terms", "privacy", "legal", "security", "blog", "news",
  "user", "users", "me", "you", "null", "undefined", "test", "demo", "example",
]);

export type UsernameError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "reserved";

export type UsernameValidation =
  | { ok: true; value: string }
  | { ok: false; error: UsernameError; message: string };

/** Trim + lowercase. Validation always runs against the normalized form. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Validate a candidate username. Returns the normalized value on success so
 * callers always persist the canonical form. Uniqueness is checked separately
 * against the DB — this function is purely syntactic + reserved-name checks.
 */
export function validateUsername(input: string): UsernameValidation {
  const value = normalizeUsername(input);

  if (value.length < USERNAME_MIN) {
    return {
      ok: false,
      error: "too_short",
      message: `Username must be at least ${USERNAME_MIN} characters.`,
    };
  }
  if (value.length > USERNAME_MAX) {
    return {
      ok: false,
      error: "too_long",
      message: `Username must be at most ${USERNAME_MAX} characters.`,
    };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      ok: false,
      error: "invalid_chars",
      message:
        "Use lowercase letters, numbers, and hyphens. It cannot start or end with a hyphen.",
    };
  }
  if (RESERVED_USERNAMES.has(value)) {
    return { ok: false, error: "reserved", message: "That username is reserved." };
  }

  return { ok: true, value };
}

/** Convenience boolean wrapper. */
export function isValidUsername(input: string): boolean {
  return validateUsername(input).ok;
}
