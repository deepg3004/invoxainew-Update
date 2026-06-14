import { GlassCard, PageHeader } from "@invoxai/ui";
import { listAffiliatesWithStats } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { formatDateIST } from "@invoxai/utils/date";
import { requireTenant } from "../../lib/tenant";
import { AffiliateForm } from "./AffiliateForm";
import { CopyRefLink } from "./CopyRefLink";
import { setAffiliateStatusAction, deleteAffiliateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const { tenant } = await requireTenant();
  const affiliates = await listAffiliatesWithStats(tenant.id);

  const base = `https://${tenant.username}.invoxai.io/store`;
  const totalOwed = affiliates.reduce((s, a) => s + a.commissionOwedPaise, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · grow"
        title="Affiliates"
        description="Reward partners who send you sales. Share their link; orders that arrive through it are attributed and the commission you owe is tracked here. Payouts are off-platform — InvoxAI only records what's due."
      />

      <GlassCard title="Add an affiliate">
        <AffiliateForm />
      </GlassCard>

      <div className="mt-6">
        {affiliates.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted">
              No affiliates yet. Add one above, then share their link to start tracking referred sales.
            </p>
          </GlassCard>
        ) : (
          <GlassCard title="Your affiliates">
            {totalOwed > 0 ? (
              <p className="mb-2 text-sm text-muted">
                {formatRupees(totalOwed)} commission owed across all partners
              </p>
            ) : null}
            <ul className="divide-y divide-zinc-200">
              {affiliates.map((a) => {
                const url = `${base}?ref=${encodeURIComponent(a.code)}`;
                return (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">{a.name}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
                          {a.code}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {a.status === "ACTIVE" ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-700">
                        {bpsToPercentString(a.commissionBps)}% commission
                        {a.email ? ` · ${a.email}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Added {formatDateIST(a.createdAt)} · <CopyRefLink url={url} />
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-right text-sm">
                      <div>
                        <div className="font-semibold text-zinc-900">{a.clicks}</div>
                        <div className="text-xs text-muted">clicks</div>
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900">{a.paidSales}</div>
                        <div className="text-xs text-muted">sales</div>
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900">{formatRupees(a.grossPaise)}</div>
                        <div className="text-xs text-muted">revenue</div>
                      </div>
                      <div>
                        <div className="font-semibold text-brand-strong">
                          {formatRupees(a.commissionOwedPaise)}
                        </div>
                        <div className="text-xs text-muted">owed</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {a.status === "ACTIVE" ? (
                          <form action={setAffiliateStatusAction.bind(null, a.id, "PAUSED")}>
                            <button className="text-muted underline hover:text-zinc-900">Pause</button>
                          </form>
                        ) : (
                          <form action={setAffiliateStatusAction.bind(null, a.id, "ACTIVE")}>
                            <button className="text-muted underline hover:text-zinc-900">Activate</button>
                          </form>
                        )}
                        <form action={deleteAffiliateAction.bind(null, a.id)}>
                          <button className="text-muted underline hover:text-red-700">Delete</button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
