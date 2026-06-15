"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getWalletByTenant,
  getFeatureQuota,
  consumeFeature,
  createAiPage,
  setAiPageChargeRef,
  updateAiPageContent,
  recordAiPageVersion,
  getAiPageVersion,
  setAiPagePublished,
  deleteAiPage,
  renameAiPage,
  getPublishedTemplate,
  logActivity,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { normalizeToBlocks, THEME_PRESETS, type Block, type Theme, type BuilderSeo } from "@invoxai/utils/blocks";
import { requireTenant } from "../../lib/tenant";
import { aiConfigured, generateLandingPage } from "../../lib/ai";
import { getTemplate } from "../../lib/templates";

export type AiPageFormState = { error?: string };
export type SaveResult = { ok: true } | { ok: false; error: string };

/** The theme the seller picked in the create wizard, or null if absent/unknown.
 *  Validated against the known presets so a forged value can't reach storage. */
function chosenThemeFromForm(form: FormData): Theme | null {
  const preset = String(form.get("themePreset") ?? "").trim();
  return preset && THEME_PRESETS[preset] ? { preset, accent: "" } : null;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const RESERVED = new Set(["pay", "account", "api", "health", "store", "p", "cart", "c", "courses", "learn", "report-abuse", "m", "communities", "_next", "favicon"]);
const FEATURE = "ai_page";
// Feature Billing key for PREMIUM marketplace templates. Free templates (the
// static built-ins and any admin template with isPremium=false) never touch it.
const TEMPLATE_FEATURE = "builder_template";

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

  // Apply the theme the seller chose in the create wizard (over the AI's default).
  const chosen = chosenThemeFromForm(form);
  const content = chosen ? { ...result.content, theme: chosen } : result.content;

  // Create the page first (reserves the slug, no charge), then bill it. If
  // billing fails we roll back the page, so we never charge for a page that
  // doesn't exist and never create one we couldn't bill.
  const created = await createAiPage({
    tenantId: tenant.id,
    slug,
    title: content.title,
    brief,
    content: JSON.parse(JSON.stringify(content)),
    chargeRef: null,
  });
  if (!created.ok) {
    return { error: `The address "/${slug}" is already in use.` };
  }

  const charge = await consumeFeature({ tenantId: tenant.id, featureKey: FEATURE });
  if (!charge.ok) {
    await deleteAiPage(tenant.id, created.id);
    const price = formatRupees(charge.pricePaise ?? quota.totalPaise);
    if (charge.reason === "insufficient_funds") {
      // Wallet too low. Offer the direct pay-per-use credit when it's available.
      return charge.directAvailable
        ? { error: `Free AI pages used up and your wallet is low. Top up your wallet, or buy a ${price} credit from Feature charges, then try again.` }
        : { error: `Free AI pages used up and your wallet is low (need ${price}). Top up and try again.` };
    }
    if (charge.reason === "payment_required") {
      // Direct-pay only: buy a credit on /feature-payments, then re-generate.
      return { error: `This AI page costs ${price}. Buy a credit from Feature charges, then generate again.` };
    }
    return { error: "Couldn’t bill the AI page. Please try again." };
  }
  if ((charge.charged === "wallet" || charge.charged === "direct") && charge.referenceId) {
    await setAiPageChargeRef(tenant.id, created.id, charge.referenceId);
  }

  await logActivity(tenant.id, "page.generated", `/${slug}`).catch(() => {});
  revalidatePath("/ai-pages");
  // Drop the seller straight into the block editor to refine the generated page.
  redirect(`/ai-pages/${created.id}/edit`);
}

/**
 * Save edited blocks for a page (AI builder editor). SECURITY: the blocks come
 * from the browser, so they're re-validated + sanitized through normalizeToBlocks
 * server-side (the same trust boundary as generation) before storage — the editor
 * can't persist an unrecognized block type or a `javascript:` URL.
 */
export async function saveAiPageAction(
  id: string,
  title: string,
  blocks: Block[],
  theme: Theme,
  seo?: BuilderSeo,
): Promise<SaveResult> {
  const { tenant } = await requireTenant();
  const safe = normalizeToBlocks({ title, blocks, theme, seo });
  if (safe.blocks.length === 0) {
    return { ok: false, error: "Add at least one block before saving." };
  }
  const snapshot = JSON.parse(JSON.stringify(safe));
  const res = await updateAiPageContent(tenant.id, id, safe.title, snapshot);
  if (res.count === 0) return { ok: false, error: "Page not found." };
  // Snapshot into version history (best-effort — never block the save).
  await recordAiPageVersion(tenant.id, id, snapshot).catch(() => {});
  revalidatePath("/ai-pages");
  return { ok: true };
}

/**
 * Restore a previous version of a page (AI builder history). Non-destructive:
 * the version's content is re-sanitized and written back, and the restore is
 * itself snapshotted, so the pre-restore state stays in history. Tenant-scoped.
 */
export async function restoreAiPageVersionAction(
  pageId: string,
  versionId: string,
  _formData?: FormData,
): Promise<void> {
  const { tenant } = await requireTenant();
  const version = await getAiPageVersion(tenant.id, pageId, versionId);
  if (!version) return;
  const safe = normalizeToBlocks(version.content);
  if (safe.blocks.length === 0) return;
  const snapshot = JSON.parse(JSON.stringify(safe));
  const res = await updateAiPageContent(tenant.id, pageId, safe.title, snapshot);
  if (res.count === 0) return;
  await recordAiPageVersion(tenant.id, pageId, snapshot).catch(() => {});
  revalidatePath(`/ai-pages/${pageId}/edit`);
  redirect(`/ai-pages/${pageId}/edit`);
}

/**
 * Create a page from a starter template. No AI call ever runs here, so there's
 * no AI-page fee. Three kinds of template resolve through one action:
 *   • a static built-in (free) — matched by its string id;
 *   • an admin marketplace template with isPremium=false (free);
 *   • a premium marketplace template — billed through the Feature Billing engine
 *     (featureKey "builder_template"), the same charge path as a paid AI page.
 * In every case the content is re-validated + sanitized through normalizeToBlocks
 * before storage (the render trust boundary), and slug ownership is enforced by
 * the db layer's unique [tenantId, slug].
 */
export async function createFromTemplateAction(
  templateId: string,
  _prev: AiPageFormState,
  form: FormData,
): Promise<AiPageFormState> {
  const { tenant } = await requireTenant();

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { error: "Address must be 1–50 chars (letters, digits, hyphens) and not reserved." };
  }

  // The theme the seller picked in the create wizard overrides the template's own.
  const chosen = chosenThemeFromForm(form);

  // 1) Static built-in template (free) — original behaviour, unchanged.
  const builtIn = getTemplate(templateId);
  if (builtIn) {
    const safe = normalizeToBlocks(chosen ? { ...builtIn.content, theme: chosen } : builtIn.content);
    const created = await createAiPage({
      tenantId: tenant.id,
      slug,
      title: safe.title,
      brief: `Started from the "${builtIn.name}" template`,
      content: JSON.parse(JSON.stringify(safe)),
      chargeRef: null,
    });
    if (!created.ok) return { error: `The address "/${slug}" is already in use.` };
    revalidatePath("/ai-pages");
    redirect(`/ai-pages/${created.id}/edit`);
  }

  // 2) Admin marketplace template (free or premium). Only PUBLISHED ones resolve.
  const tpl = await getPublishedTemplate(templateId);
  if (!tpl) return { error: "That template is no longer available." };
  const safe = normalizeToBlocks(
    chosen && tpl.content && typeof tpl.content === "object"
      ? { ...(tpl.content as Record<string, unknown>), theme: chosen }
      : tpl.content,
  );

  // Premium pre-check: don't reserve a slug we can't bill (mirrors the AI-page
  // flow). Free admin templates skip billing entirely.
  if (tpl.isPremium) {
    const quota = await getFeatureQuota(tenant.id, TEMPLATE_FEATURE);
    if (!quota || !quota.active) {
      return { error: "Premium templates aren’t available right now." };
    }
    const willBeFree = quota.remainingFree !== 0; // -1 (unlimited) or > 0
    if (!willBeFree) {
      const wallet = await getWalletByTenant(tenant.id);
      const affordable =
        quota.walletEnabled && (wallet?.balancePaise ?? 0) >= quota.totalPaise;
      if (!affordable) {
        return {
          error: `This is a premium template (${formatRupees(quota.totalPaise)}). Top up your wallet first, or buy a credit from Feature charges.`,
        };
      }
    }
  }

  // Create first (reserves the slug, no charge), then bill. If billing fails we
  // roll the page back — never charge for a page that wasn't created.
  const created = await createAiPage({
    tenantId: tenant.id,
    slug,
    title: safe.title,
    brief: `Started from the "${tpl.name}" template`,
    content: JSON.parse(JSON.stringify(safe)),
    chargeRef: null,
  });
  if (!created.ok) return { error: `The address "/${slug}" is already in use.` };

  if (tpl.isPremium) {
    const charge = await consumeFeature({ tenantId: tenant.id, featureKey: TEMPLATE_FEATURE });
    if (!charge.ok) {
      await deleteAiPage(tenant.id, created.id);
      const price = formatRupees(charge.pricePaise ?? 0);
      if (charge.reason === "insufficient_funds") {
        return charge.directAvailable
          ? { error: `Premium template — wallet too low. Top up, or buy a ${price} credit from Feature charges, then try again.` }
          : { error: `Premium template — wallet too low (need ${price}). Top up and try again.` };
      }
      if (charge.reason === "payment_required") {
        return { error: `This template costs ${price}. Buy a credit from Feature charges, then try again.` };
      }
      return { error: "Couldn’t bill the premium template. Please try again." };
    }
    if ((charge.charged === "wallet" || charge.charged === "direct") && charge.referenceId) {
      await setAiPageChargeRef(tenant.id, created.id, charge.referenceId);
    }
  }

  await logActivity(tenant.id, "page.from_template", `/${slug}`).catch(() => {});
  revalidatePath("/ai-pages");
  redirect(`/ai-pages/${created.id}/edit`);
}

export async function setAiPagePublishedAction(id: string, isPublished: boolean) {
  const { tenant } = await requireTenant();
  await setAiPagePublished(tenant.id, id, isPublished);
  await logActivity(tenant.id, isPublished ? "page.published" : "page.unpublished").catch(() => {});
  revalidatePath("/ai-pages");
}

export async function deleteAiPageAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteAiPage(tenant.id, id);
  revalidatePath("/ai-pages");
}

/** Quick rename from the AI-pages list (title only — keeps content.title in sync). */
export async function renameAiPageAction(id: string, form: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  if (!title) return;
  await renameAiPage(tenant.id, id, title);
  revalidatePath("/ai-pages");
}
