import Link from "next/link";
import { requireTenant } from "../../../lib/tenant";
import { TEMPLATES } from "../../../lib/templates";
import { TemplateCard } from "./TemplateCard";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireTenant();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            AI builder
          </p>
          <h1 className="mt-1 text-3xl font-bold">Start from a template</h1>
          <p className="mt-1 text-muted">
            Pick a ready-made page, give it an address, then edit it. Free — no AI
            credits used.
          </p>
        </div>
        <Link href="/ai-pages/new" className="text-sm text-cyan underline">
          Generate with AI instead →
        </Link>
      </div>

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
