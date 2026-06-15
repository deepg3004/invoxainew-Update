"use server";

import { revalidatePath } from "next/cache";
import {
  createBuilderTemplate,
  updateBuilderTemplate,
  deleteBuilderTemplate,
  type BuilderTemplateInput,
} from "@invoxai/db";
import { normalizeToBlocks } from "@invoxai/utils/blocks";
import { requireAdmin } from "../../lib/auth";

/**
 * Parse + sanitise the admin-authored template fields. Content is run through
 * normalizeToBlocks (the same trust boundary the seller render uses), so a
 * malformed or unsafe block JSON can never reach a tenant page. Returns null if
 * the content textarea isn't valid JSON.
 */
function parseForm(form: FormData): BuilderTemplateInput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("content") ?? ""));
  } catch {
    return null;
  }
  const safe = normalizeToBlocks(parsed);
  const sortRaw = Number(String(form.get("sortOrder") ?? "0"));
  return {
    name: String(form.get("name") ?? "").trim().slice(0, 80) || "Untitled template",
    category: String(form.get("category") ?? "").trim().slice(0, 40).toLowerCase() || "landing",
    description: String(form.get("description") ?? "").trim().slice(0, 200),
    themePreset: safe.theme.preset,
    isPremium: form.get("isPremium") === "on",
    isPublished: form.get("isPublished") === "on",
    sortOrder: Number.isInteger(sortRaw) ? sortRaw : 0,
    content: JSON.parse(JSON.stringify(safe)),
  };
}

export async function createTemplateAction(form: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  const data = parseForm(form);
  if (!data) return;
  await createBuilderTemplate(data);
  revalidatePath("/templates");
}

export async function updateTemplateAction(id: string, form: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  const data = parseForm(form);
  if (!data) return;
  await updateBuilderTemplate(id, data);
  revalidatePath("/templates");
}

export async function deleteTemplateAction(id: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  await deleteBuilderTemplate(id);
  revalidatePath("/templates");
}
