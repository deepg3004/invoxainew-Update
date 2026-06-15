import {
  listCheckoutsForRecovery,
  claimRecoveryEmail,
  getEmailDispatchConfig,
  recordNotificationLog,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { sendEmail } from "@invoxai/utils/email";
import { renderEmail } from "@invoxai/utils/email-render";
import { getNotifEvent, renderTemplate } from "@invoxai/utils/notifications";
import { buildResumeUrl } from "./recovery-logic";

/**
 * Growth G1.2 — sweep started-but-unpaid checkouts and send ONE recovery email per
 * order (a buyer who left at checkout, asked once to come back). Designed to be run
 * on a schedule (e.g. every 15 min via the /api/cron/recovery endpoint).
 *
 * Safety:
 *  - Each order is claimed ATOMICALLY (claimRecoveryEmail) before sending, so two
 *    concurrent runs can never double-send.
 *  - The email respects the tenant's notification preference and the admin's editable
 *    template, and is fully env-gated — no RESEND_API_KEY → logged "skipped", nothing
 *    sent — exactly like the sale emails.
 *  - Never throws: a send failure must not break the cron run. The order stays
 *    claimed (we don't retry) to avoid spamming on transient errors.
 *
 * Returns a small summary for the cron response/log.
 */
export async function sweepAbandonedRecovery(opts?: {
  minAgeMinutes?: number;
  maxAgeHours?: number;
  limit?: number;
}): Promise<{ considered: number; sent: number; skipped: number }> {
  const event = getNotifEvent("buyer.abandoned");
  if (!event) return { considered: 0, sent: 0, skipped: 0 };

  const due = await listCheckoutsForRecovery({
    minAgeMinutes: opts?.minAgeMinutes ?? 30,
    maxAgeHours: opts?.maxAgeHours ?? 24,
    limit: opts?.limit ?? 200,
  });

  let sent = 0;
  let skipped = 0;

  for (const row of due) {
    const to = row.buyerEmail;
    if (!to) continue;

    // Atomic claim — only the winner sends; a redelivery/parallel run no-ops.
    const claimed = await claimRecoveryEmail(row.id).catch(() => false);
    if (!claimed) continue;

    try {
      const cfg = await getEmailDispatchConfig(row.tenantId);
      if (!cfg.enabled("buyer.abandoned")) {
        await recordNotificationLog({
          tenantId: row.tenantId,
          eventType: "buyer.abandoned",
          recipient: to,
          status: "skipped",
          error: "disabled by tenant preference",
        }).catch(() => {});
        skipped++;
        continue;
      }

      const storeName = row.tenant.name?.trim() || row.tenant.username;
      const itemLabel = row.itemTitle ?? "Your order";
      const amountLabel = formatRupees(row.amountPaise);
      const vars: Record<string, string> = {
        storeName,
        item: itemLabel,
        amount: amountLabel,
      };
      const resumeUrl = buildResumeUrl({
        username: row.tenant.username,
        primaryDomain: row.tenant.domains[0]?.domain,
        paymentPageSlug: row.paymentPage?.slug,
        productSlug: row.product?.slug,
      });

      const tpl = cfg.template("buyer.abandoned");
      const subject = renderTemplate(tpl?.subject ?? event.defaultSubject, vars);
      const intro = renderTemplate(tpl?.body ?? event.defaultBody, vars);

      const result = await sendEmail({
        to,
        subject,
        html: renderEmail({
          storeName,
          heading: event.heading,
          bodyText: `${intro}\n\n${itemLabel} — ${amountLabel}`,
          cta: { label: event.buttonLabel, href: resumeUrl },
          accent: row.tenant.brandColor,
          footerNote: event.footer,
          preheader: intro.slice(0, 120),
        }),
      });
      if (result.status === "sent") sent++;
      else skipped++;

      await recordNotificationLog({
        tenantId: row.tenantId,
        eventType: "buyer.abandoned",
        recipient: to,
        subject,
        status: result.status,
        providerMessageId: result.status === "sent" ? result.providerMessageId : null,
        error: result.status === "failed" ? result.error : null,
      }).catch(() => {});
    } catch {
      // Swallow: one bad row must not abort the sweep. The order stays claimed.
      skipped++;
    }
  }

  return { considered: due.length, sent, skipped };
}

