import { serverEnv } from "@invoxai/config";
import { getPlatformSettings, listGlobalAdminAuditLog } from "@invoxai/db";
import { PageHeader } from "@invoxai/ui";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "settings.update": "Platform settings updated",
  "plan.create": "Plan created",
  "plan.update": "Plan updated",
  "plan.retire": "Plan retired",
  "plan.restore": "Plan restored",
  "pricing.update": "Pricing setting updated",
  "feature.rule.update": "Feature rule updated",
  "feature.limit.update": "Feature allowance updated",
};

export default async function SettingsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const env = serverEnv();
  const [s, auditLog] = await Promise.all([
    getPlatformSettings(),
    listGlobalAdminAuditLog(30),
  ]);
  const rateBps = s.invoice_gst_rate_bps;

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Platform settings"
        description="Manage invoice/GST details and branding without a redeploy. These are platform-global. (Secret keys — gateway/API — stay in the server env, not here.)"
      />
      <div className="mt-6 max-w-3xl">
        <SettingsForm
          initial={{
            invoice_legal_name: s.invoice_legal_name ?? "",
            invoice_gstin: s.invoice_gstin ?? "",
            invoice_address: s.invoice_address ?? "",
            invoice_gst_rate_percent: rateBps ? String(Number(rateBps) / 100) : "",
            invoice_email: s.invoice_email ?? "",
            invoice_phone: s.invoice_phone ?? "",
            invoice_pan: s.invoice_pan ?? "",
            invoice_hsn: s.invoice_hsn ?? "",
            invoice_number_prefix: s.invoice_number_prefix ?? "",
            invoice_gst_mode: s.invoice_gst_mode === "CGST_SGST" ? "CGST_SGST" : "IGST",
            invoice_footer_note: s.invoice_footer_note ?? "",
            invoice_support_email: s.invoice_support_email ?? "",
            brand_logo_url: s.brand_logo_url ?? "",
            brand_favicon_url: s.brand_favicon_url ?? "",
            upi_due_block_rupees: s.upi_due_block_paise
              ? String(Number(s.upi_due_block_paise) / 100)
              : "",
            ph_legal_name: env.INVOICE_LEGAL_NAME,
            ph_gstin: env.INVOICE_GSTIN,
            ph_gst_percent: String(env.INVOICE_GST_RATE_BPS / 100),
          }}
        />
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-semibold text-zinc-900">Recent config changes</h2>
        <p className="mt-1 text-sm text-muted">
          Platform-wide admin edits (plans, pricing, feature rules, settings) — the global audit trail.
        </p>
        {auditLog.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No global config changes recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-surface">
            {auditLog.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-900">
                    {ACTION_LABELS[a.action] ?? a.action}
                  </span>
                  {a.detail ? <span className="ml-2 text-muted">{a.detail}</span> : null}
                  {a.amountPaise != null ? (
                    <span className="ml-2 text-muted">· {formatRupees(a.amountPaise)}</span>
                  ) : null}
                  <div className="text-xs text-muted">{a.adminEmail}</div>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {formatDateTimeShortIST(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
