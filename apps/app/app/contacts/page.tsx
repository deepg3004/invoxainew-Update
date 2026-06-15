import Link from "next/link";
import { Badge, Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listContacts, contactStage, CRM_STAGES, type CrmStage } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const STAGE_META: Record<CrmStage, { label: string; tone: "cyan" | "neutral" | "success" | "brand" }> = {
  LEAD: { label: "Lead", tone: "cyan" },
  ENGAGED: { label: "Engaged", tone: "neutral" },
  CUSTOMER: { label: "Customer", tone: "success" },
  VIP: { label: "VIP", tone: "brand" },
};

function timeAgo(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const [rawContacts, { q: rawQ, stage: rawStage, page: rawPage, size: rawSize }] =
    await Promise.all([listContacts(tenant.id), searchParams]);

  // Decorate every contact with its derived pipeline stage (Growth G1.4).
  const contacts = rawContacts.map((c) => ({ ...c, stage: contactStage(c) }));

  // Pipeline funnel counts (across all contacts, before search/stage filters).
  const stageCounts = CRM_STAGES.reduce(
    (acc, s) => ({ ...acc, [s]: contacts.filter((c) => c.stage === s).length }),
    {} as Record<CrmStage, number>,
  );

  const activeStage = (CRM_STAGES as readonly string[]).includes(rawStage ?? "")
    ? (rawStage as CrmStage)
    : null;

  const q = (rawQ ?? "").trim().toLowerCase();
  const filtered = contacts.filter((c) => {
    if (activeStage && c.stage !== activeStage) return false;
    if (!q) return true;
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  // The merged contact list is in memory; paginate the (filtered) array for display.
  const total = filtered.length;
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const paged = filtered.slice(skip, skip + take);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + paged.length;

  const qParam = rawQ ? `q=${encodeURIComponent(rawQ)}` : "";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · grow"
        title="Contacts"
        description="Everyone who submitted a form or started a checkout — your CRM, built from your leads and buyers."
        actions={
          contacts.length > 0 ? (
            <Button
              href={`/contacts/export${rawQ ? `?q=${encodeURIComponent(rawQ)}` : ""}`}
              variant="secondary"
              size="sm"
            >
              Export CSV
            </Button>
          ) : null
        }
      />

      {/* Pipeline funnel — click a stage to filter (Growth G1.4). Stages are derived
          from each contact's activity (Lead → Engaged → Customer → VIP). */}
      <div className="grid gap-3 sm:grid-cols-4">
        {CRM_STAGES.map((s) => {
          const meta = STAGE_META[s];
          const isActive = activeStage === s;
          const href = isActive
            ? `/contacts${qParam ? `?${qParam}` : ""}`
            : `/contacts?stage=${s}${qParam ? `&${qParam}` : ""}`;
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-xl border p-4 transition ${
                isActive ? "border-brand bg-brand/5" : "border-zinc-200 bg-surface hover:border-brand/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700">{meta.label}</span>
                <Badge tone={meta.tone}>{stageCounts[s]}</Badge>
              </div>
              <div className="mt-1 text-2xl font-bold text-zinc-900">{stageCounts[s]}</div>
            </Link>
          );
        })}
      </div>
      {activeStage ? (
        <p className="mt-2 text-sm text-muted">
          Showing <span className="font-medium">{STAGE_META[activeStage].label}</span> contacts ·{" "}
          <Link href={`/contacts${qParam ? `?${qParam}` : ""}`} className="text-brand-strong underline">
            clear
          </Link>
        </p>
      ) : null}

      <form className="mt-6">
        <input
          name="q"
          defaultValue={rawQ ?? ""}
          placeholder="Search name, email or phone"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
      </form>

      {filtered.length === 0 ? (
        <GlassCard className="mt-6">
          <p className="text-muted">
            {q ? `No contacts match “${rawQ}”.` : "No contacts yet. They’ll appear as people submit forms or start checkouts."}
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 divide-y divide-zinc-100 p-0">
          {paged.map((c) => (
            <div
              key={c.email.toLowerCase()}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{c.name ?? c.email}</span>
                  <Badge tone={STAGE_META[c.stage].tone}>{STAGE_META[c.stage].label}</Badge>
                </div>
                <div className="mt-0.5 space-x-2 text-sm">
                  <a href={`mailto:${c.email}`} className="text-brand-strong underline">
                    {c.email}
                  </a>
                  {c.phone ? (
                    <a
                      href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted underline hover:text-zinc-900"
                    >
                      {c.phone}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="text-right text-sm">
                {c.paidCount > 0 ? (
                  <div className="font-semibold text-zinc-900">
                    {formatRupees(c.totalSpentPaise)}
                  </div>
                ) : null}
                <div className="text-xs text-muted">
                  {c.paidCount > 0
                    ? `${c.paidCount} order${c.paidCount === 1 ? "" : "s"} · `
                    : c.leadCount > 0
                      ? `${c.leadCount} lead${c.leadCount === 1 ? "" : "s"} · `
                      : ""}
                  {timeAgo(c.lastSeen)}
                </div>
              </div>
            </div>
          ))}
        </GlassCard>
      )}
      {total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="contacts"
        />
      ) : null}
    </div>
  );
}
