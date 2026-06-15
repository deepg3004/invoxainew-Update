import { Button, PageHeader } from "@invoxai/ui";
import { listPublishedTemplates } from "@invoxai/db";
import { THEME_PRESETS, type ThemePreset } from "@invoxai/utils/blocks";
import { requireTenant } from "../../../lib/tenant";
import { TEMPLATES } from "../../../lib/templates";
import { TemplateCard } from "./TemplateCard";

export const dynamic = "force-dynamic";

const PRESET_KEYS = Object.keys(THEME_PRESETS) as ThemePreset[];
function asPreset(value: string): ThemePreset {
  return (PRESET_KEYS as string[]).includes(value) ? (value as ThemePreset) : "light";
}

export default async function TemplatesPage() {
  await requireTenant();

  const marketplace = await listPublishedTemplates();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="AI builder"
        title="Start from a template"
        description="Pick a ready-made page, give it an address, then edit it. Free templates use no AI credits; premium templates carry a one-time fee."
        actions={
          <Button href="/ai-pages/new" variant="secondary">
            Generate with AI instead →
          </Button>
        }
      />

      {/* Built-in quick-starts (always free). */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Quick starts</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => {
          const h1 = t.content.blocks.find((b) => b.type === "heading" && b.level === 1);
          const heroBlock = t.content.blocks.find((b) => b.type === "hero");
          const heroText =
            h1 && h1.type === "heading"
              ? h1.text
              : heroBlock && heroBlock.type === "hero"
                ? heroBlock.heading
                : t.name;
          return (
            <TemplateCard
              key={t.id}
              id={t.id}
              name={t.name}
              description={t.description}
              preset={t.content.theme.preset}
              heroText={heroText}
            />
          );
        })}
      </div>

      {/* Admin-authored marketplace templates (free + premium). */}
      {marketplace.length > 0 ? (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Template marketplace</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {marketplace.map((t) => (
              <TemplateCard
                key={t.id}
                id={t.id}
                name={t.name}
                description={t.description}
                preset={asPreset(t.themePreset)}
                heroText={t.name}
                isPremium={t.isPremium}
                category={t.category}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
