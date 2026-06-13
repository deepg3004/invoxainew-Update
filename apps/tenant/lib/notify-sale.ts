import {
  notifyTenant,
  listSoldOutProductsForOrder,
  getOrderNotifyContext,
  recordNotificationLog,
  getEmailDispatchConfig,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { sendEmail, escapeHtml, type SendEmailResult } from "@invoxai/utils/email";
import { getNotifEvent, renderTemplate } from "@invoxai/utils/notifications";

/**
 * Best-effort seller notifications fired after a NEWLY-PAID order — the sale, a
 * commission-due nudge, and any product the sale took to zero stock. Shared by the
 * Razorpay verify route and the manual-UPI auto-confirm path so both notify
 * identically. NEVER throws: a notification failure must not affect the payment.
 */
export async function notifySaleEffects(input: {
  tenantId: string;
  buyerPaymentId: string;
  itemTitle: string | null;
  amountPaise: number;
  commission: "paid" | "due" | "none";
}): Promise<void> {
  try {
    await notifyTenant(input.tenantId, {
      type: "sale",
      title: "New sale",
      body: `${input.itemTitle ?? "Order"} — ${formatRupees(input.amountPaise)}`,
      link: "/orders",
    });
    if (input.commission === "due") {
      await notifyTenant(input.tenantId, {
        type: "wallet_low",
        title: "Wallet low — commission due",
        body: "A sale's commission couldn't be collected. Top up your wallet to clear it.",
        link: "/wallet",
      });
    }
    const soldOut = await listSoldOutProductsForOrder(input.buyerPaymentId);
    for (const pr of soldOut) {
      await notifyTenant(input.tenantId, {
        type: "out_of_stock",
        title: "Out of stock",
        body: `“${pr.title}” just sold out — restock it to keep selling.`,
        link: "/products",
      });
    }
  } catch {
    // Swallow: a notification failure must not affect the payment outcome.
  }

  // Email channel (Phase 14). Independent of the in-app notifications above and
  // also fully best-effort — wrapped so a transport error never escapes.
  await sendSaleEmails(input).catch(() => {});
}

/**
 * Send the two highest-value sale emails — the buyer's receipt and the seller's
 * sale alert — and log each attempt. Each send is isolated so one failing doesn't
 * skip the other; both are env-gated (no RESEND_API_KEY → logged as "skipped").
 */
async function sendSaleEmails(input: {
  tenantId: string;
  buyerPaymentId: string;
  amountPaise: number;
}): Promise<void> {
  const ctx = await getOrderNotifyContext(input.buyerPaymentId);
  if (!ctx) return;
  const cfg = await getEmailDispatchConfig(input.tenantId);

  const storeName = ctx.tenant.name?.trim() || ctx.tenant.username;
  const vars: Record<string, string> = {
    storeName,
    item: ctx.itemTitle ?? "Your order",
    amount: formatRupees(input.amountPaise),
  };

  // Prefer the seller's primary custom domain for the buyer's "Visit store" link,
  // falling back to the username subdomain.
  const primaryDomain = ctx.tenant.domains[0]?.domain;
  const storeUrl = primaryDomain
    ? `https://${primaryDomain}`
    : `https://${ctx.tenant.username}.invoxai.io`;

  await dispatchEmail({
    tenantId: input.tenantId,
    eventKey: "buyer.receipt",
    to: ctx.buyerEmail,
    vars,
    buttonUrl: storeUrl,
    cfg,
  });
  await dispatchEmail({
    tenantId: input.tenantId,
    eventKey: "seller.sale",
    to: ctx.tenant.owner?.email ?? null,
    vars,
    buttonUrl: "https://app.invoxai.io/orders",
    cfg,
  });
}

/**
 * Dispatch one catalog event's email: respect the tenant's preference (a disabled
 * event is logged "skipped", never sent), render subject + body from the admin
 * template (or the code default), and log the result. The structured rows + button
 * + footer chrome come from the catalog so a template edit can't break the layout.
 */
async function dispatchEmail(args: {
  tenantId: string;
  eventKey: string;
  to: string | null;
  vars: Record<string, string>;
  buttonUrl: string;
  cfg: { template(k: string): { subject: string; body: string } | null; enabled(k: string): boolean };
}): Promise<void> {
  const event = getNotifEvent(args.eventKey);
  if (!event || !args.to) return;

  if (!args.cfg.enabled(args.eventKey)) {
    await recordNotificationLog({
      tenantId: args.tenantId,
      eventType: args.eventKey,
      recipient: args.to,
      status: "skipped",
      error: "disabled by tenant preference",
    }).catch(() => {});
    return;
  }

  const tpl = args.cfg.template(args.eventKey);
  const subject = renderTemplate(tpl?.subject ?? event.defaultSubject, args.vars);
  const intro = renderTemplate(tpl?.body ?? event.defaultBody, args.vars);

  const result = await sendEmail({
    to: args.to,
    subject,
    html: emailShell({
      heading: event.heading,
      intro: escapeHtml(intro),
      rows: [
        ["Item", escapeHtml(args.vars.item ?? "")],
        ["Amount", args.vars.amount ?? ""],
      ],
      button: { label: event.buttonLabel, url: args.buttonUrl },
      footer: event.footer,
    }),
  });
  await logSend(args.tenantId, args.eventKey, args.to, subject, result);
}

/** Persist one send attempt (best-effort — a log failure is swallowed). */
function logSend(
  tenantId: string,
  eventType: string,
  recipient: string,
  subject: string,
  result: SendEmailResult,
) {
  return recordNotificationLog({
    tenantId,
    eventType,
    recipient,
    subject,
    status: result.status,
    providerMessageId: result.status === "sent" ? result.providerMessageId : null,
    error: result.status === "failed" ? result.error : null,
  }).catch(() => {});
}

/** A small, email-client-safe HTML shell (inline styles, table layout). */
function emailShell(p: {
  heading: string;
  intro: string;
  rows: [string, string][];
  button: { label: string; url: string };
  footer: string;
}): string {
  const rows = p.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#78716c;font-size:14px">${k}</td>` +
        `<td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;text-align:right">${v}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#fffbf8;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #f1e7e0;border-radius:16px;padding:32px">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#18181b">${p.heading}</h1>
        <p style="margin:0 0 20px;color:#57534e;font-size:15px">${p.intro}</p>
        <table role="presentation" width="100%" style="border-top:1px solid #f1e7e0;border-bottom:1px solid #f1e7e0;margin-bottom:24px">${rows}</table>
        <a href="${p.button.url}" style="display:inline-block;background:linear-gradient(90deg,#f97316,#ec4899);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${p.button.label}</a>
        <p style="margin:24px 0 0;color:#a8a29e;font-size:12px">${p.footer}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;color:#a8a29e;font-size:12px">Powered by InvoxAI</p>
  </td></tr></table>
</body></html>`;
}
