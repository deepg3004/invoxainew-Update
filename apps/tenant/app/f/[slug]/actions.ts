"use server";

import { headers } from "next/headers";
import { submitLead } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";

export async function submitLeadAction(input: {
  formId: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  company?: string; // honeypot — must be empty for a real human
}): Promise<{ ok: boolean }> {
  // Spam honeypot: a bot that auto-fills the hidden "company" field gets a fake
  // success and is silently dropped (no row written, no notification).
  if ((input.company ?? "").trim()) return { ok: true };

  // Tenant is resolved from the request HOST; submitLead then re-checks the form
  // belongs to this tenant AND is published, and stamps tenant_id server-side —
  // so a forged formId can't write under another tenant or into a draft.
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant || tenant.suspendedAt) return { ok: false };

  const email = (input.email ?? "").trim();
  const name = (input.name ?? "").trim();
  if (!email && !name) return { ok: false };

  return submitLead({
    tenantId: tenant.id,
    formId: input.formId,
    name: name || null,
    email: email || null,
    phone: input.phone ?? null,
    message: input.message ?? null,
  });
}
