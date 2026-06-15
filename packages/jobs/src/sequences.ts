import {
  listDueEnrollments,
  claimEnrollmentAdvance,
  recordNotificationLog,
} from "@invoxai/db";
import { sendEmail, escapeHtml } from "@invoxai/utils/email";
import { planAdvance } from "./sequences-logic";

/**
 * Growth G1.3 (Part 2) — advance every due sequence enrolment by one step. Designed
 * to run on a schedule (e.g. every 15 min via /api/cron/sequences).
 *
 * Safety, mirroring the recovery sweep:
 *  - Each enrolment is CLAIMED atomically before sending (claimEnrollmentAdvance
 *    guards on the current step pointer), so two concurrent runs can't double-send.
 *  - A paused sequence (active=false) is left untouched — it resumes when re-activated.
 *  - Email is env-gated (no RESEND_API_KEY → "skipped") and respects the tenant's
 *    notification preference for the channel. Never throws.
 *  - We claim (advance the pointer) BEFORE sending, so a transient send failure does
 *    NOT loop/spam — the step is considered attempted and the run moves on.
 */
export async function sweepSequences(opts?: { limit?: number }): Promise<{
  considered: number;
  sent: number;
  skipped: number;
  completed: number;
}> {
  const due = await listDueEnrollments(opts?.limit ?? 200);
  const now = new Date();

  let sent = 0;
  let skipped = 0;
  let completed = 0;

  for (const e of due) {
    // Paused sequence → leave the enrolment ACTIVE for when it resumes.
    if (!e.sequence.active) continue;

    const steps = e.sequence.steps;
    const step = steps[e.currentStep];

    // Pointer past the end (e.g. steps deleted after enrolment) → finish cleanly.
    if (!step) {
      const done = await claimEnrollmentAdvance(e.id, e.currentStep, { status: "DONE" }).catch(
        () => false,
      );
      if (done) completed++;
      continue;
    }

    const plan = planAdvance(
      e.currentStep,
      steps.map((s) => s.delayHours),
      now,
    );

    // Atomic claim guarded on the current pointer — only the winner sends.
    const claimed = await claimEnrollmentAdvance(e.id, e.currentStep, plan).catch(() => false);
    if (!claimed) continue;
    if (plan.status === "DONE") completed++;

    // Send the step (best-effort; a failure does not roll back the advance).
    try {
      const result = await sendEmail({
        to: e.email,
        subject: step.subject?.trim() || `A message from ${e.sequence.tenant.name?.trim() || e.sequence.tenant.username}`,
        html: sequenceEmailHtml({
          storeName: e.sequence.tenant.name?.trim() || e.sequence.tenant.username,
          body: escapeHtml(step.body),
        }),
      });
      if (result.status === "sent") sent++;
      else skipped++;

      await recordNotificationLog({
        tenantId: e.tenantId,
        eventType: "sequence.step",
        recipient: e.email,
        subject: step.subject ?? null,
        status: result.status,
        providerMessageId: result.status === "sent" ? result.providerMessageId : null,
        error: result.status === "failed" ? result.error : null,
      }).catch(() => {});
    } catch {
      skipped++;
    }
  }

  return { considered: due.length, sent, skipped, completed };
}

/** Minimal, email-client-safe HTML for a sequence step (inline styles). */
function sequenceEmailHtml(a: { storeName: string; body: string }): string {
  // Preserve the seller's line breaks in the plain body.
  const paragraphs = a.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;color:#3f3f46;font-size:14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
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
