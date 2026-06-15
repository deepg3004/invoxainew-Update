import {
  listDueBroadcastRecipients,
  claimBroadcastRecipient,
  finishBroadcastRecipient,
  markBroadcastSending,
  finalizeCompletedBroadcasts,
  recordNotificationLog,
} from "@invoxai/db";
import { sendEmail } from "@invoxai/utils/email";
import { renderEmail } from "@invoxai/utils/email-render";

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
        html: renderEmail({
          storeName,
          heading: r.broadcast.subject,
          bodyText: r.broadcast.body,
          accent: r.broadcast.tenant.brandColor,
          preheader: r.broadcast.subject,
          footerNote: "You’re receiving this because you’re a contact of this store.",
        }),
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
