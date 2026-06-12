import "server-only";
import { cache } from "react";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { getTenantByUsername, getTenantByCustomDomain } from "@invoxai/db";

/**
 * Resolve the tenant for an incoming Host header — the single source of truth for
 * "which tenant owns this request". Tries the `username.invoxai.io` subdomain
 * first; if the host isn't one of our subdomains, falls back to a VERIFIED custom
 * domain (Phase 15). Returns null if the host maps to no tenant.
 *
 * ISOLATION: a custom domain matches at most one VERIFIED row (partial unique
 * index), so a host can never resolve to two tenants.
 *
 * Wrapped in React `cache()` so generateMetadata and the page body (which both
 * resolve the same host per request) share ONE query instead of two.
 */
export const resolveTenantByHost = cache(
  async (host: string | null | undefined) => {
    const username = tenantUsernameFromHost(host);
    if (username) return getTenantByUsername(username);
    const hostname = (host ?? "").split(":")[0]!.trim().toLowerCase();
    if (!hostname) return null;
    return getTenantByCustomDomain(hostname);
  },
);
