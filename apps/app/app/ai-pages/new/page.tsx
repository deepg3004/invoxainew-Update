import { GlassCard, PageHeader } from "@invoxai/ui";
import { getFeatureQuota, listPublishedTemplates } from "@invoxai/db";
import { THEME_PRESETS, type ThemePreset } from "@invoxai/utils/blocks";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { aiConfigured } from "../../../lib/ai";
import { TEMPLATES } from "../../../lib/templates";
import { CreatePageWizard, type TemplateOption } from "./CreatePageWizard";

export const dynamic = "force-dynamic";

const PRESET_KEYS = Object.keys(THEME_PRESETS) as ThemePreset[];
function asPreset(value: string): ThemePreset {
  return (PRESET_KEYS as string[]).includes(value) ? (value as ThemePreset) : "aurora-glow";
}

export default async function NewAiPage() {
  const { tenant } = await requireTenant();
  const [quota, marketplace] = await Promise.all([
    getFeatureQuota(tenant.id, "ai_page"),
    listPublishedTemplates(),
  ]);

  const unlimited = quota?.remainingFree === -1;
  const freeLeft = unlimited ? Infinity : quota?.remainingFree ?? 0;
  const nextIsFree = unlimited || freeLeft > 0;
  const price = quota?.totalPaise ?? 17582;
  const priceLabel = nextIsFree ? "Free" : formatRupees(price);

  const templates: TemplateOption[] = [
    ...TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      preset: t.content.theme.preset,
    })),
    ...marketplace.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      preset: asPreset(t.themePreset),
      isPremium: t.isPremium,
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="InvoxAI · AI pages"
        title="Create a page"
        description={
          <>
            Pick a theme and a starting point, then publish.{" "}
            {unlimited
              ? "AI generation is unlimited on your plan."
              : nextIsFree
                ? `Your next AI page is free (${freeLeft} of your monthly allowance left). Templates are free.`
                : `An AI page is ${formatRupees(price)} (incl. GST), charged only if it succeeds. Templates are free.`}
          </>
        }
      />
      <GlassCard className="p-6">
        <CreatePageWizard
          templates={templates}
          aiEnabled={aiConfigured()}
          priceLabel={priceLabel}
          defaultPreset={tenant.storeTheme || "aurora-glow"}
        />
      </GlassCard>
    </div>
  );
}
