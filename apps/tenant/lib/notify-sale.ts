import {
  notifyTenant,
  listSoldOutProductsForOrder,
  getOrderNotifyContext,
  recordNotificationLog,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { sendEmail, escapeHtml, type SendEmailResult } from "@invoxai/utils/email";

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

  const storeName = ctx.tenant.name?.trim() || ctx.tenant.username;
  const item = ctx.itemTitle ?? "Your order";
  const amount = formatRupees(input.amountPaise);
  const storeUrl = `https://${ctx.tenant.username}.invoxai.io`;

  // Buyer receipt.
  if (ctx.buyerEmail) {
    const subject = `Your purchase from ${storeName}`;
    const result = await sendEmail({
      to: ctx.buyerEmail,
      subject,
      html: emailShell({
        heading: "Thanks for your purchase 🎉",
        intro: `Your payment to ${escapeHtml(storeName)} was successful.`,
        rows: [
          ["Item", escapeHtml(item)],
          ["Amount paid", amount],
        ],
        button: { label: `Visit ${escapeHtml(storeName)}`, url: storeUrl },
        footer: "You're receiving this because you made a purchase on this store.",
      }),
    });
    await logSend(input.tenantId, "buyer.receipt", ctx.buyerEmail, subject, result);
  }

  // Seller sale alert.
  const sellerEmail = ctx.tenant.owner?.email;
  if (sellerEmail) {
    const subject = `New sale: ${amount}`;
    const result = await sendEmail({
      to: sellerEmail,
      subject,
      html: emailShell({
        heading: "You made a sale 💸",
        intro: `A buyer just paid on ${escapeHtml(storeName)}.`,
        rows: [
          ["Item", escapeHtml(item)],
          ["Amount", amount],
        ],
        button: { label: "View order", url: "https://app.invoxai.io/orders" },
        footer: "Manage email alerts in your InvoxAI dashboard.",
      }),
    });
    await logSend(input.tenantId, "seller.sale", sellerEmail, subject, result);
  }
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
