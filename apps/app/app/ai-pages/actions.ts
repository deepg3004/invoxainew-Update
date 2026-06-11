"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getPricingSetting,
  getWalletByTenant,
  chargeAndCreateAiPage,
  deleteAiPage,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { aiConfigured, generateLandingPage } from "../../lib/ai";

export type AiPageFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
// Reserved so an AI page can't shadow a real tenant route.
const RESERVED = new Set(["pay", "account", "api", "health", "_next", "favicon"]);
const DEFAULT_AI_PAGE_PAISE = 14900; // ₹149 fallback if the setting is missing

export async function generateAiPageAction(
  _prev: AiPageFormState,
  form: FormData,
): Promise<AiPageFormState> {
  const { tenant } = await requireTenant();

  if (!aiConfigured()) {
    return { error: "AI generation isn’t available yet. Please try again later." };
  }

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { error: "Address must be 1–50 chars (letters, digits, hyphens) and not reserved." };
  }
  const businessName = String(form.get("businessName") ?? "").trim();
  if (!businessName) return { error: "Business name is required." };
  const brief = String(form.get("brief") ?? "").trim();
  if (brief.length < 10) return { error: "Add a short brief (at least 10 characters)." };

  // Price is admin-editable (C3); fall back to ₹149 if unset.
  const setting = await getPricingSetting("ai_page_price");
  const pricePaise = setting?.valuePaise ?? DEFAULT_AI_PAGE_PAISE;

  // Prepaid service: require the balance up front (charged only on success).
  const wallet = await getWalletByTenant(tenant.id);
  if (!wallet || wallet.balancePaise < pricePaise) {
    return {
      error: `Your wallet needs at least ${formatRupees(pricePaise)} to generate a page. Top up your wallet first.`,
    };
  }

  const result = await generateLandingPage({ businessName, brief });
  if (!result.ok) return { error: result.error };

  // Charge + create atomically; nothing is charged unless the page is created.
  const created = await chargeAndCreateAiPage({
    tenantId: tenant.id,
    slug,
    title: result.content.title,
    brief,
    // Round-trip to a plain JSON value (Prisma's InputJsonValue wants an index
    // signature that a typed interface doesn't provide).
    content: JSON.parse(JSON.stringify(result.content)),
    pricePaise,
    chargeRef: randomUUID(),
  });
  if (!created.ok) {
    if (created.reason === "slug_taken") {
      return { error: `The address "/${slug}" is already in use. (You were not charged.)` };
    }
    return { error: "Your wallet balance just changed — please top up and try again." };
  }

  revalidatePath("/ai-pages");
  redirect("/ai-pages");
}

export async function deleteAiPageAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteAiPage(tenant.id, id);
  revalidatePath("/ai-pages");
}
