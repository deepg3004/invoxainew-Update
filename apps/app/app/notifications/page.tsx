import {formatDateTimeShortIST} from "@invoxai/utils/date";
import Link from "next/link";
import {
  listNotifications,
  countUnreadNotifications,
  getNotificationPreferences,
  listNotificationLogs,
} from "@invoxai/db";
import { NOTIFICATION_EVENTS } from "@invoxai/utils/notifications";
import { requireTenant } from "../../lib/tenant";
import { markAllReadAction } from "./actions";
import { EmailPreferences, type PrefRow } from "./EmailPreferences";

export const dynamic = "force-dynamic";

function timeAgo(d: Date): string {
  return formatDateTimeShortIST(d);
}

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-zinc-100 text-zinc-600",
};

export default async function NotificationsPage() {
  const { tenant } = await requireTenant();
  const [items, unread, prefRows, logs] = await Promise.all([
    listNotifications(tenant.id),
    countUnreadNotifications(tenant.id),
    getNotificationPreferences(tenant.id),
    listNotificationLogs(tenant.id, 10),
  ]);

  const prefs: PrefRow[] = NOTIFICATION_EVENTS.filter((e) => e.channel === "email").map((e) => ({
    key: e.key,
    label: e.label,
    description: e.description,
    audience: e.audience,
    // No row = enabled by default.
    enabled: prefRows.find((p) => p.eventKey === e.key && p.channel === "email")?.enabled ?? true,
  }));

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

      {/* Email preferences */}
      <div className="mt-10 rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="text-lg font-semibold text-zinc-900">Email notifications</h2>
        <p className="mt-1 text-sm text-muted">
          Choose which emails your store sends. Buyer receipts go to the customer; sale
          alerts come to you.
        </p>
        <div className="mt-3">
          <EmailPreferences prefs={prefs} />
        </div>
      </div>

      {/* Recent emails (send log) */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="text-lg font-semibold text-zinc-900">Recent emails</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No emails sent yet. Email delivery turns on once the platform email key is
            configured — until then sends are recorded here as “skipped”.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-zinc-500">{l.eventType}</span>
                  <span className="ml-2 truncate text-zinc-700">{l.recipient}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">{timeAgo(l.createdAt)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[l.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
