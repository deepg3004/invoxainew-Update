import {
  listDueBroadcastRecipients,
  claimBroadcastRecipient,
  finishBroadcastRecipient,
  markBroadcastSending,
  finalizeCompletedBroadcasts,
  recordNotificationLog,
} from "@invoxai/db";
import { sendEmail, escapeHtml } from "@invoxai/utils/email";

/**
 * Phase 14 — deliver QUEUED email broadcasts. Designed to run on a schedule
 * (e.g. every ~5 min via /api/cron/broadcasts).
 *
 * Safety, mirroring the sequences/recovery sweeps:
 *  - Each recipient is CLAIMED atomically (PENDING → SENDING) before sending, so
 *    two concurrent runs can't double-send to the same address.
 *  - Email is env-gated (no RESEND_API_KEY → "skipped") — the recipient is marked
 *    SKIPPED and the run moves on; nothing throws into a loop.
 *  - After the batch, any broadcast with no PENDING/SENDING recipients left is
 *    finalised to SENT. A `limit` bounds each run so a huge list drains over
 *    several sweeps rather than one long request.
 */
export async function sweepBroadcasts(opts?: { limit?: number }): Promise<{
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  finalized: number;
}> {
  const due = await listDueBroadcastRecipients(opts?.limit ?? 200);
  const started = new Set<string>();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of due) {
    // Flip the parent QUEUED → SENDING once so the UI reflects "in progress".
    if (!started.has(r.broadcastId)) {
      await markBroadcastSending(r.broadcastId).catch(() => {});
      started.add(r.broadcastId);
    }

    // Atomic claim — only the winner sends this recipient.
    const claimed = await claimBroadcastRecipient(r.id).catch(() => false);
    if (!claimed) continue;

    const storeName = r.broadcast.tenant.name?.trim() || r.broadcast.tenant.username;
    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await sendEmail({
        to: r.email,
        subject: r.broadcast.subject,
        html: broadcastEmailHtml({ storeName, body: escapeHtml(r.broadcast.body) }),
      });
    } catch (e) {
      result = { status: "failed", error: e instanceof Error ? e.message : "send error" };
    }

    const status =
      result.status === "sent" ? "SENT" : result.status === "skipped" ? "SKIPPED" : "FAILED";
    if (status === "SENT") sent++;
    else if (status === "SKIPPED") skipped++;
    else failed++;

    await finishBroadcastRecipient({
      id: r.id,
      broadcastId: r.broadcastId,
      status,
      providerMessageId: result.status === "sent" ? result.providerMessageId : null,
      error: result.status === "failed" ? result.error : null,
    }).catch(() => {});

    await recordNotificationLog({
      tenantId: r.broadcast.tenantId,
      eventType: "broadcast.sent",
      recipient: r.email,
      subject: r.broadcast.subject,
      status: result.status,
      providerMessageId: result.status === "sent" ? result.providerMessageId : null,
      error: result.status === "failed" ? result.error : null,
    }).catch(() => {});
  }

  const finalized = await finalizeCompletedBroadcasts().catch(() => 0);
  return { considered: due.length, sent, failed, skipped, finalized };
}

/** Minimal, email-client-safe HTML for a broadcast (inline styles, line breaks). */
export function broadcastEmailHtml(a: { storeName: string; body: string }): string {
  const paragraphs = a.body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#3f3f46;font-size:14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 28px 8px"><div style="font-size:13px;color:#71717a">${escapeHtml(a.storeName)}</div></td></tr>
        <tr><td style="padding:8px 28px 24px">${paragraphs}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
