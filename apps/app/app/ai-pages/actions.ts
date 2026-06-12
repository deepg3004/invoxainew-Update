"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getWalletByTenant,
  getFeatureQuota,
  consumeFeature,
  createAiPage,
  setAiPageChargeRef,
  deleteAiPage,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { aiConfigured, generateLandingPage } from "../../lib/ai";

export type AiPageFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const RESERVED = new Set(["pay", "account", "api", "health", "store", "p", "cart", "_next", "favicon"]);
const FEATURE = "ai_page";

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

  // Feature Billing: free within the plan's monthly allowance, else wallet fee.
  const quota = await getFeatureQuota(tenant.id, FEATURE);
  if (!quota || !quota.active) {
    return { error: "AI page generation isn’t available right now." };
  }
  const willBeFree = quota.remainingFree !== 0; // -1 (unlimited) or > 0
  if (!willBeFree) {
    // Don't spend an AI call if the seller can't cover the fee.
    const wallet = await getWalletByTenant(tenant.id);
    const affordable =
      quota.walletEnabled && (wallet?.balancePaise ?? 0) >= quota.totalPaise;
    if (!affordable) {
      return {
        error: `You’ve used your free AI pages this month. The next one is ${formatRupees(quota.totalPaise)} — top up your wallet first.`,
      };
    }
  }

  const result = await generateLandingPage({ businessName, brief });
  if (!result.ok) return { error: result.error };

  // Create the page first (reserves the slug, no charge), then bill it. If
  // billing fails we roll back the page, so we never charge for a page that
  // doesn't exist and never create one we couldn't bill.
  const created = await createAiPage({
    tenantId: tenant.id,
    slug,
    title: result.content.title,
    brief,
    content: JSON.parse(JSON.stringify(result.content)),
    chargeRef: null,
  });
  if (!created.ok) {
    return { error: `The address "/${slug}" is already in use.` };
  }

  const charge = await consumeFeature({ tenantId: tenant.id, featureKey: FEATURE });
  if (!charge.ok) {
    await deleteAiPage(tenant.id, created.id);
    if (charge.reason === "insufficient_funds") {
      return {
        error: `Free AI pages used up and your wallet is low (need ${formatRupees(charge.pricePaise ?? quota.totalPaise)}). Top up and try again.`,
      };
    }
    return { error: "Couldn’t bill the AI page. Please try again." };
  }
  if (charge.charged === "wallet" && charge.referenceId) {
    await setAiPageChargeRef(created.id, charge.referenceId);
  }

  revalidatePath("/ai-pages");
  redirect("/ai-pages");
}

export async function deleteAiPageAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteAiPage(tenant.id, id);
  revalidatePath("/ai-pages");
}
