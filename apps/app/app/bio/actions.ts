"use server";

import { revalidatePath } from "next/cache";
import { upsertBioLink } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export async function saveBioLinkAction(form: FormData): Promise<void> {
  const { tenant } = await requireTenant();
  const g = (k: string) => String(form.get(k) ?? "");
  await upsertBioLink(tenant.id, {
    displayName: g("displayName"),
    bio: g("bio"),
    avatarUrl: g("avatarUrl"),
    instagram: g("instagram"),
    youtube: g("youtube"),
    twitter: g("twitter"),
    facebook: g("facebook"),
    whatsapp: g("whatsapp"),
    website: g("website"),
    tiktok: g("tiktok"),
    linkedin: g("linkedin"),
    threads: g("threads"),
    bgColor: g("bgColor"),
    linksText: g("linksText"),
    published: form.get("published") === "on",
  });
  revalidatePath("/bio");
}
