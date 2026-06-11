import { isValidUsername } from "./username";

/**
 * Root domains under which a single-label subdomain is a tenant.
 * `localhost` is included so tenants resolve in local dev via
 * `username.localhost:3003`.
 */
export const DEFAULT_ROOT_DOMAINS: readonly string[] = [
  "invoxai.io",
  "localhost",
];

/**
 * Extract the tenant username from an incoming Host header.
 *
 * Rules:
 *  - strip the port and lowercase;
 *  - the apex (`invoxai.io`) and `www.invoxai.io` are NOT tenants → null;
 *  - exactly one sub-label under a root domain is a candidate
 *    (`deep.invoxai.io` → `deep`); deeper nesting → null;
 *  - the label must pass tenant username validation (which also rejects
 *    reserved labels like `app`, `admin`, `api`, `www`).
 *
 * Custom domains (not under a root domain) return null here and will be
 * resolved via a domain-mapping table in a later step.
 */
export function tenantUsernameFromHost(
  host: string | null | undefined,
  rootDomains: readonly string[] = DEFAULT_ROOT_DOMAINS,
): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0]!.trim().toLowerCase();
  if (!hostname) return null;

  for (const root of rootDomains) {
    if (hostname === root) return null;
    const suffix = "." + root;
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      // Only single-label subdomains are tenants for the MVP.
      if (sub.includes(".")) return null;
      // isValidUsername also rejects reserved labels (www, app, admin, api…).
      return isValidUsername(sub) ? sub : null;
    }
  }

  return null;
}
