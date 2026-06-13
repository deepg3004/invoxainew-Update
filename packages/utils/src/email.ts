import "server-only";
import { serverEnv } from "@invoxai/config";

/**
 * Email channel (Phase 14, slice 2). A thin server-only transport over the Resend
 * REST API (https://resend.com/docs/api-reference/emails/send-email) — REST via
 * fetch so there's no SDK dependency, the same approach as the Razorpay helper.
 *
 * ENV-GATED: when RESEND_API_KEY is empty, sendEmail is a no-op that returns
 * `skipped` (and the caller logs it), so the whole notification path works the
 * moment a key is dropped into .env and harmlessly does nothing until then.
 *
 * Every caller treats sending as a BEST-EFFORT side effect: a failure here must
 * never throw into a money path — sendEmail catches its own errors and reports
 * them as `failed` rather than rejecting.
 */

export type SendEmailResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Override the default From (must be a Resend-verified sender). */
  from?: string;
  replyTo?: string;
};

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    return { status: "skipped", reason: "no RESEND_API_KEY configured" };
  }
  const to = input.to.trim();
  if (!to) return { status: "skipped", reason: "no recipient" };

  const body = JSON.stringify({
    from: input.from ?? env.EMAIL_FROM,
    to: [to],
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  });

  // Retry transient failures only — a rate-limit (429), a Resend 5xx, or a network
  // error can succeed on a retry; a 4xx (bad key, invalid recipient) cannot, so we
  // fail fast on those. Backoff: 400ms, 1200ms. Callers run this off the request
  // path (after()), so the wait never delays the buyer.
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return { status: "sent", providerMessageId: json.id ?? "" };
      }

      const detail = await res.text().catch(() => "");
      lastError = `resend ${res.status}: ${detail.slice(0, 300)}`;
      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt === MAX_ATTEMPTS) {
        return { status: "failed", error: lastError };
      }
    } catch (e) {
      // Network/abort error — retriable.
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === MAX_ATTEMPTS) return { status: "failed", error: lastError };
    }
    await sleep(attempt * 400);
  }
  return { status: "failed", error: lastError };
}

/** Minimal HTML escape for interpolating user/seller-controlled strings into the
 *  email body (titles, store names) so they can't inject markup. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
