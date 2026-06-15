import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { formatDateIST } from "@invoxai/utils/date";
import { GlassCard } from "@invoxai/ui";
import { listBuyerTickets } from "@invoxai/db";
import { getSessionUser } from "../../../lib/auth";
import { resolveTenantByHost } from "../../../lib/resolve";
import { BuyerReplyForm } from "./BuyerReplyForm";
import { createTicketAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Awaiting reply",
  ANSWERED: "Replied",
  CLOSED: "Closed",
};

export default async function BuyerSupportPage() {
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  if (!tenant) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const tickets = await listBuyerTickets(tenant.id, {
    profileId: user.id,
    email: user.email ?? null,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/account" className="text-sm text-muted underline">
        ← Back to account
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Support</h1>
      <p className="mt-1 text-muted">Message {tenant.name ?? tenant.username} about your orders.</p>

      <div className="mt-6 space-y-3">
        {tickets.length === 0 ? (
          <GlassCard className="text-muted">No messages yet. Start one below.</GlassCard>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              href={`/account/support/${t.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-surface p-4 hover:border-brand/40"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-900">{t.subject}</div>
                <div className="text-xs text-muted">
                  {STATUS_LABEL[t.status] ?? t.status} · {formatDateIST(t.updatedAt)}
                </div>
              </div>
              <span className="text-brand-strong">→</span>
            </Link>
          ))
        )}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="mb-3 font-semibold">New message</h2>
        <BuyerReplyForm action={createTicketAction} withSubject submitLabel="Send message" />
      </div>
    </main>
  );
}
