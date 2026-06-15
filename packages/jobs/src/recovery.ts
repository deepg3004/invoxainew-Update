import {
  listCheckoutsForRecovery,
  claimRecoveryEmail,
  getEmailDispatchConfig,
  recordNotificationLog,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { sendEmail, escapeHtml } from "@invoxai/utils/email";
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
        html: recoveryEmailHtml({
          heading: event.heading,
          intro: escapeHtml(intro),
          item: escapeHtml(itemLabel),
          amount: amountLabel,
          button: { label: event.buttonLabel, url: resumeUrl },
          footer: event.footer,
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

/** Minimal, email-client-safe HTML for the recovery nudge (inline styles). */
function recoveryEmailHtml(a: {
  heading: string;
  intro: string;
  item: string;
  amount: string;
  button: { label: string; url: string };
  footer: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:28px 28px 8px"><h1 style="margin:0;font-size:20px;color:#18181b">${a.heading}</h1></td></tr>
        <tr><td style="padding:0 28px 16px;color:#3f3f46;font-size:14px;line-height:1.6">${a.intro}</td></tr>
        <tr><td style="padding:0 28px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px">
            <tr><td style="padding:10px 14px;color:#71717a;font-size:13px">Item</td><td style="padding:10px 14px;text-align:right;color:#18181b;font-size:13px">${a.item}</td></tr>
            <tr><td style="padding:10px 14px;color:#71717a;font-size:13px;border-top:1px solid #f4f4f5">Amount</td><td style="padding:10px 14px;text-align:right;color:#18181b;font-size:13px;border-top:1px solid #f4f4f5">${a.amount}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 28px 28px">
          <a href="${a.button.url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px">${a.button.label}</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px;color:#a1a1aa;font-size:12px">${a.footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
