import type { ReactNode } from "react";
import {
  getWalletAttention,
  listRecentPaymentEvents,
  getBranding,
  countOpenAbuseReports,
  countOpenRiskAlerts,
  countPendingVerifications,
} from "@invoxai/db";
import { AdminShellClient } from "./AdminShellClient";

/** Left-sidebar chrome shared by every authorized admin page. Keeps the same
 *  `email`-prop server API so all admin pages stay unchanged; the sidebar +
 *  active-route highlighting live in the client wrapper. Also computes the
 *  header bell's alert count (sellers needing attention + unprocessed webhooks),
 *  fail-safe so it can never break a page. */
export async function AdminShell({
  email,
  children,
}: {
  email: string | null | undefined;
  children: ReactNode;
}) {
  let alerts = 0;
  let logoUrl: string | undefined;
  try {
    const [attention, events, branding, openAbuse, openRisk, pendingVerif] = await Promise.all([
      getWalletAttention(),
      listRecentPaymentEvents(),
      getBranding(),
      countOpenAbuseReports(),
      countOpenRiskAlerts(),
      countPendingVerifications(),
    ]);
    alerts =
      attention.length +
      events.filter((e) => !e.processedAt).length +
      openAbuse +
      openRisk +
      pendingVerif;
    logoUrl = branding.logoUrl;
  } catch {
    alerts = 0;
  }
  return (
    <AdminShellClient email={email} alerts={alerts} logoUrl={logoUrl}>
      {children}
    </AdminShellClient>
  );
}
