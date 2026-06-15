"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createUpsell,
  updateUpsell,
  setUpsellActive,
  deleteUpsell,
  getSellerGateway,
} from "@invoxai/db";
import { percentStringToBps } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type UpsellFormState = { error?: string };

interface ParsedUpsell {
  offerProductId: string;
  triggerProductId: string | null;
  headline: string;
  blurb: string | null;
  discountBps: number;
  active: boolean;
}

const ID_RE = /^[0-9a-f-]{36}$/i;

function parseUpsellFields(
  form: FormData,
): { ok: true; value: ParsedUpsell } | { ok: false; message: string } {
  const offerProductId = String(form.get("offerProductId") ?? "").trim();
  if (!ID_RE.test(offerProductId)) {
    return { ok: false, message: "Pick the product to offer." };
  }

  // "" (the "any purchase" option) → null; otherwise must look like an id.
  const triggerRaw = String(form.get("triggerProductId") ?? "").trim();
  let triggerProductId: string | null = null;
  if (triggerRaw) {
    if (!ID_RE.test(triggerRaw)) return { ok: false, message: "Trigger product is invalid." };
    if (triggerRaw === offerProductId) {
      return { ok: false, message: "The trigger and the offered product must be different." };
    }
    triggerProductId = triggerRaw;
  }

  const headline = String(form.get("headline") ?? "").trim();
  if (headline.length < 2 || headline.length > 120) {
    return { ok: false, message: "Headline must be 2–120 characters." };
  }

  const blurbRaw = String(form.get("blurb") ?? "").trim();
  if (blurbRaw.length > 500) return { ok: false, message: "Description is too long (max 500)." };
  const blurb = blurbRaw || null;

  // Discount is optional; blank = 0% (full price).
  let discountBps = 0;
  const discRaw = String(form.get("discount") ?? "").trim();
  if (discRaw) {
    const pct = percentStringToBps(discRaw);
    if (!pct.ok) return { ok: false, message: `Discount: ${pct.message}` };
    discountBps = pct.bps;
  }

  return {
    ok: true,
    value: {
      offerProductId,
      triggerProductId,
      headline,
      blurb,
      discountBps,
      active: form.get("active") === "on",
    },
  };
}

function messageFor(reason: string): string {
  switch (reason) {
    case "offer_not_found":
      return "That offered product no longer exists or isn't yours.";
    case "trigger_not_found":
      return "That trigger product no longer exists or isn't yours.";
    case "not_owned":
      return "This offer could not be found.";
    default:
      return "Could not save the offer.";
  }
}

export async function createUpsellAction(
  _prev: UpsellFormState,
  form: FormData,
): Promise<UpsellFormState> {
  const { tenant } = await requireTenant();

  // OTOs charge on the seller's own gateway — require it connected, mirroring coupons.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) return { error: "Connect your payment gateway first (Connect gateway)." };

  const parsed = parseUpsellFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const result = await createUpsell(tenant.id, parsed.value);
  if (!result.ok) return { error: messageFor(result.reason) };

  revalidatePath("/upsells");
  redirect("/upsells");
}

export async function updateUpsellAction(
  id: string,
  _prev: UpsellFormState,
  form: FormData,
): Promise<UpsellFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseUpsellFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const result = await updateUpsell(tenant.id, id, parsed.value);
  if (!result.ok) return { error: messageFor(result.reason) };

  revalidatePath("/upsells");
  redirect("/upsells");
}

export async function setUpsellActiveAction(id: string, active: boolean) {
  const { tenant } = await requireTenant();
  await setUpsellActive(tenant.id, id, active);
  revalidatePath("/upsells");
}

export async function deleteUpsellAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteUpsell(tenant.id, id);
  revalidatePath("/upsells");
}
