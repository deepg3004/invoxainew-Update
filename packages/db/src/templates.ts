import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Builder Part 3 — admin-authored template marketplace (db layer).
 *
 * `builder_templates` is a GLOBAL catalog, NOT tenant-scoped: platform admins
 * author them and every seller can browse the published ones. Applying a
 * template copies its block JSON into a new AiPage — that happens in the app
 * action (it re-validates the content through normalizeToBlocks and, for premium
 * templates, runs the Feature Billing engine first). This module is pure CRUD +
 * reads; it never charges and never writes to AiPage.
 */

// ── Admin (authoring) ────────────────────────────────────────────────────────

export interface BuilderTemplateInput {
  name: string;
  category: string;
  description: string;
  themePreset: string;
  isPremium: boolean;
  isPublished: boolean;
  sortOrder: number;
  content: Prisma.InputJsonValue;
}

export function createBuilderTemplate(input: BuilderTemplateInput) {
  return prisma.builderTemplate.create({ data: input, select: { id: true } });
}

/** Every template, newest-relevant first (admin list). */
export function listBuilderTemplates() {
  return prisma.builderTemplate.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

/** One template by id, any status (admin edit). */
export function getBuilderTemplate(id: string) {
  return prisma.builderTemplate.findUnique({ where: { id } });
}

export function updateBuilderTemplate(id: string, input: Partial<BuilderTemplateInput>) {
  return prisma.builderTemplate.update({ where: { id }, data: input });
}

export function deleteBuilderTemplate(id: string) {
  return prisma.builderTemplate.delete({ where: { id } });
}

// ── Seller (gallery) ─────────────────────────────────────────────────────────

/**
 * Published templates a seller can pick, grouped-ready (category then sortOrder).
 * `content` is intentionally NOT selected here — the gallery only needs the
 * card metadata; the full block JSON is read at apply time via
 * getPublishedTemplate so an unpublished/edited template can't be applied from a
 * stale list.
 */
export function listPublishedTemplates() {
  return prisma.builderTemplate.findMany({
    where: { isPublished: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      themePreset: true,
      isPremium: true,
    },
  });
}

/** One PUBLISHED template with its content (apply path). Null if unpublished. */
export function getPublishedTemplate(id: string) {
  return prisma.builderTemplate.findFirst({ where: { id, isPublished: true } });
}
