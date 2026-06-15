import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateIST } from "@invoxai/utils/date";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getSellerTicket } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { ReplyForm } from "../ReplyForm";
import { sellerReplyAction, closeTicketAction, reopenTicketAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SellerTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const ticket = await getSellerTicket(tenant.id, id);
  if (!ticket) notFound();

  const replyAction = sellerReplyAction.bind(null, ticket.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader eyebrow="InvoxAI · support" title={ticket.subject} />
      <p className="-mt-2 text-sm text-muted">
        From {ticket.buyerEmail} ·{" "}
        <Link href="/support" className="text-brand-strong underline">
          back to inbox
        </Link>
      </p>

      <GlassCard className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 ${
              m.sender === "SELLER" ? "bg-brand/5 ml-8" : "bg-zinc-50 mr-8"
            }`}
          >
            <div className="text-xs font-medium text-muted">
              {m.sender === "SELLER" ? "You" : "Buyer"} · {formatDateIST(m.createdAt)}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
          </div>
        ))}
      </GlassCard>

      {ticket.status !== "CLOSED" ? (
        <GlassCard title="Reply">
          <ReplyForm action={replyAction} />
        </GlassCard>
      ) : (
        <GlassCard className="text-sm text-muted">
          This ticket is closed.
          <form action={reopenTicketAction.bind(null, ticket.id)} className="mt-2">
            <button className="text-brand-strong underline">Reopen</button>
          </form>
        </GlassCard>
      )}

      {ticket.status !== "CLOSED" ? (
        <form action={closeTicketAction.bind(null, ticket.id)}>
          <button className="text-sm text-muted underline hover:text-zinc-900">
            Close this ticket
          </button>
        </form>
      ) : null}
    </div>
  );
}
