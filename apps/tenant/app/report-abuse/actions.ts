"use server";

import { headers } from "next/headers";
import { createAbuseReport } from "@invoxai/db";
import { resolveTenantByHost } from "../../lib/resolve";

export type ReportState = { ok?: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * File an abuse report against the store this request is on (host-resolved, never
 * client-supplied — a reporter can only report the store they're viewing). Anon;
 * the row is written server-side via Prisma so deny-anon RLS is respected.
 */
export async function submitAbuseReport(
  _prev: ReportState,
  form: FormData,
): Promise<ReportState> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { error: "This store could not be found." };

  const reason = String(form.get("reason") ?? "");
  const detail = String(form.get("detail") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!reason) return { error: "Please choose a reason." };
  if (email && !EMAIL_RE.test(email)) {
    return { error: "That email looks invalid — or leave it blank." };
  }
  if (detail.length > 2000) return { error: "Please keep the details under 2000 characters." };

  await createAbuseReport({
    tenantId: tenant.id,
    reason,
    detail: detail || null,
    reporterEmail: email || null,
    pageUrl: host ? `https://${host}/report-abuse` : null,
  });
  return { ok: true };
}
