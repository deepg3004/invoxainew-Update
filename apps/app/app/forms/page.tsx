import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listLeadForms } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  ARCHIVED: "bg-zinc-50 text-muted border-zinc-200",
};

export default async function FormsPage() {
  const { tenant } = await requireTenant();
  const forms = await listLeadForms(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · grow"
        title="Lead forms"
        description={
          <>
            Collect enquiries, sign-ups and leads from your site — submissions
            land here for you to follow up.
          </>
        }
        actions={<Button href="/forms/new">New form</Button>}
      />

      {forms.length === 0 ? (
        <GlassCard className="mt-8 text-center">
          <p className="text-muted">No lead forms yet.</p>
          <Link href="/forms/new" className="mt-3 inline-block text-brand-strong underline">
            Create your first form →
          </Link>
        </GlassCard>
      ) : (
        <div className="mt-8 space-y-3">
          {forms.map((f) => (
            <Link key={f.id} href={`/forms/${f.id}`}>
              <GlassCard className="transition hover:border-brand/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900">{f.title}</div>
                    <div className="mt-0.5 text-sm text-muted">
                      /f/{f.slug} · {f._count.submissions} submission
                      {f._count.submissions === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[f.status]}`}
                  >
                    {f.status.charAt(0) + f.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
