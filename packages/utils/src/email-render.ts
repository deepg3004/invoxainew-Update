/**
 * Shared premium email template (Phase 5). A 600px, table-based, email-client-safe
 * layout with a themed header band, body paragraphs, an optional CTA button, and a
 * compliant footer. Pure (no imports) so it's testable + usable from the worker.
 *
 * Email clients render gradients inconsistently, so the header band + button use a
 * SOLID accent colour (the tenant's brand colour, validated to hex). Inline styles
 * only — no flexbox/grid — for Outlook/Gmail compatibility.
 */

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_ACCENT = "#7C3AED";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailOptions {
  /** The seller's store name (header + footer). */
  storeName: string;
  /** Raw body text — escaped + split into paragraphs (blank line = new paragraph). */
  bodyText: string;
  /** Optional bold heading above the body. */
  heading?: string;
  /** Optional call-to-action button. href is used as-is (already a real URL). */
  cta?: { label: string; href: string } | null;
  /** Brand/accent colour (hex). Falls back to the InvoxAI purple. */
  accent?: string | null;
  /** Small print under the body (e.g. "You’re receiving this because…"). */
  footerNote?: string | null;
  /** Hidden inbox-preview text. */
  preheader?: string | null;
}

/** Build a complete, email-safe HTML document for a transactional/marketing email. */
export function renderEmail(opts: EmailOptions): string {
  const accent = opts.accent && HEX_RE.test(opts.accent.trim()) ? opts.accent.trim() : DEFAULT_ACCENT;
  const store = esc(opts.storeName || "Store");

  const paragraphs = opts.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#3f3f46;font-size:15px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const heading = opts.heading
    ? `<h1 style="margin:0 0 14px;color:#18181b;font-size:20px;line-height:1.3;font-family:Arial,Helvetica,sans-serif">${esc(opts.heading)}</h1>`
    : "";

  const cta =
    opts.cta && opts.cta.label && opts.cta.href
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
           <tr><td align="center" bgcolor="${accent}" style="border-radius:10px">
             <a href="${esc(opts.cta.href)}" target="_blank"
                style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:bold;
                       text-decoration:none;border-radius:10px;font-family:Arial,Helvetica,sans-serif">${esc(opts.cta.label)}</a>
           </td></tr>
         </table>`
      : "";

  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 8px;color:#a1a1aa;font-size:12px;line-height:1.5">${esc(opts.footerNote)}</p>`
    : "";

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td bgcolor="${accent}" style="padding:18px 28px">
        <span style="color:#ffffff;font-size:16px;font-weight:bold">${store}</span>
      </td></tr>
      <tr><td style="padding:28px">
        ${heading}${paragraphs}${cta}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #ececef">
        ${footerNote}
        <p style="margin:0;color:#a1a1aa;font-size:12px">Sent by ${store} · powered by InvoxAI</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
