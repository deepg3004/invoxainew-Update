import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { formatDateIST } from "@invoxai/utils/date";
import { getBuyerTicket } from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { BuyerReplyForm } from "../BuyerReplyForm";
import { buyerReplyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BuyerTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  if (!tenant) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { id } = await params;
  const ticket = await getBuyerTicket(tenant.id, id, {
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!ticket) notFound();

  const replyAction = buyerReplyAction.bind(null, ticket.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/account/support" className="text-sm text-muted underline">
        ← Back to support
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{ticket.subject}</h1>

      <div className="mt-6 space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 ${
              m.sender === "BUYER" ? "bg-brand/5 ml-8" : "bg-zinc-50 mr-8"
            }`}
          >
            <div className="text-xs font-medium text-muted">
              {m.sender === "BUYER" ? "You" : tenant.name ?? tenant.username} ·{" "}
              {formatDateIST(m.createdAt)}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status === "CLOSED" ? (
        <p className="mt-6 rounded-lg bg-zinc-50 p-3 text-sm text-muted">
          This conversation is closed. Send a new message to reopen it.
        </p>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
          <h2 className="mb-3 font-semibold">Reply</h2>
          <BuyerReplyForm action={replyAction} submitLabel="Send reply" />
        </div>
      )}
    </main>
  );
}
