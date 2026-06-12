import { NextResponse, type NextRequest } from "next/server";
import {
  getPublishedBioLink,
  listPublishedProducts,
  listPublishedCourses,
  recordBioLinkClick,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { bioRender, bioAllowedHrefs } from "../../../lib/bio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = new URL("/bio", origin);

  const tenant = await resolveTenantByHost(req.headers.get("host"));
  if (!tenant || tenant.suspendedAt) return NextResponse.redirect(back);

  const target = req.nextUrl.searchParams.get("u") ?? "";
  if (!target) return NextResponse.redirect(back);

  const bio = await getPublishedBioLink(tenant.id);
  if (!bio) return NextResponse.redirect(back);

  const [products, courses] = await Promise.all([
    listPublishedProducts(tenant.id),
    listPublishedCourses(tenant.id),
  ]);
  const allowed = bioAllowedHrefs(
    bioRender(bio, {
      hasProducts: products.length > 0,
      hasCourses: courses.length > 0,
    }),
  );

  // SECURITY: only record + redirect to a target that is actually on THIS
  // tenant's published bio — otherwise this would be an open redirector.
  const label = allowed.get(target);
  if (label === undefined) return NextResponse.redirect(back);

  // Best-effort: a failed click write must never block the redirect.
  try {
    await recordBioLinkClick(tenant.id, target, label);
  } catch {
    /* ignore */
  }

  const dest = target.startsWith("/") ? new URL(target, origin) : new URL(target);
  return NextResponse.redirect(dest);
}
