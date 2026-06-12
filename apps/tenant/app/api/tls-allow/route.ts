import { NextResponse, type NextRequest } from "next/server";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { getTenantByUsername, getTenantByCustomDomain } from "@invoxai/db";

export const dynamic = "force-dynamic";

/**
 * Caddy on-demand TLS guard ("ask" endpoint).
 *
 * Caddy calls GET /api/tls-allow?domain=<host> before issuing a certificate
 * for any host not explicitly configured. We return 200 ONLY for hosts that
 * map to a real tenant — preventing cert-issuance abuse from arbitrary domains
 * pointed at this server's IP. Custom domains will be allow-listed here later.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return new NextResponse("missing domain", { status: 400 });
  }

  const username = tenantUsernameFromHost(domain);
  if (username) {
    const tenant = await getTenantByUsername(username);
    if (tenant) return new NextResponse("ok", { status: 200 });
    return new NextResponse("not allowed", { status: 404 });
  }

  // Not one of our subdomains — allow a cert only for a VERIFIED custom domain,
  // so Caddy won't issue certs for arbitrary hosts pointed at this IP.
  const tenant = await getTenantByCustomDomain(domain);
  if (tenant) return new NextResponse("ok", { status: 200 });

  return new NextResponse("not allowed", { status: 404 });
}
