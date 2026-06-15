import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { listPagesForExperiment } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { NewExperimentForm } from "./NewExperimentForm";

export const dynamic = "force-dynamic";

export default async function NewExperimentPage() {
  const { tenant } = await requireTenant();
  const pages = await listPagesForExperiment(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="New A/B test"
        description="Pick a payment page and write an alternative headline. Half your visitors see it; we track which converts better."
      />
      <GlassCard>
        {pages.length === 0 ? (
          <p className="text-sm text-muted">
            You need a payment page without an existing test.{" "}
            <Link href="/pay-pages/new" className="text-brand-strong underline">
              Create a payment page →
            </Link>
          </p>
        ) : (
          <NewExperimentForm pages={pages} />
        )}
      </GlassCard>
    </div>
  );
}
