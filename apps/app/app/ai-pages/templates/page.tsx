import { Button, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { TEMPLATES } from "../../../lib/templates";
import { TemplateCard } from "./TemplateCard";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireTenant();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="AI builder"
        title="Start from a template"
        description="Pick a ready-made page, give it an address, then edit it. Free — no AI credits used."
        actions={
          <Button href="/ai-pages/new" variant="secondary">
            Generate with AI instead →
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => {
          const hero = t.content.blocks.find((b) => b.type === "heading" && b.level === 1);
          return (
            <TemplateCard
              key={t.id}
              id={t.id}
              name={t.name}
              description={t.description}
              preset={t.content.theme.preset}
              heroText={hero && hero.type === "heading" ? hero.text : t.name}
            />
          );
        })}
      </div>
    </div>
  );
}
