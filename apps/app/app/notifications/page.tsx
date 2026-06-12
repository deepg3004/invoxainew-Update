import {formatDateTimeShortIST} from "@invoxai/utils/date";
import Link from "next/link";
import { listNotifications, countUnreadNotifications } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { markAllReadAction } from "./actions";

export const dynamic = "force-dynamic";

function timeAgo(d: Date): string {
  return formatDateTimeShortIST(d);
}

export default async function NotificationsPage() {
  const { tenant } = await requireTenant();
  const [items, unread] = await Promise.all([
    listNotifications(tenant.id),
    countUnreadNotifications(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI
          </p>
          <h1 className="mt-1 text-3xl font-bold">Notifications</h1>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50">
              Mark all read ({unread})
            </button>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-muted">No notifications yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start gap-3 p-4">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.readAt ? "bg-transparent" : "bg-blue-500"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${n.readAt ? "text-muted" : "font-semibold text-zinc-900"}`}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:bg-zinc-50">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
