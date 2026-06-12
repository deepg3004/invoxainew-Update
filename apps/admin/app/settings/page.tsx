import { serverEnv } from "@invoxai/config";
import { getPlatformSettings } from "@invoxai/db";
import { PageHeader } from "@invoxai/ui";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const env = serverEnv();
  const s = await getPlatformSettings();
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
            brand_logo_url: s.brand_logo_url ?? "",
            brand_favicon_url: s.brand_favicon_url ?? "",
            ph_legal_name: env.INVOICE_LEGAL_NAME,
            ph_gstin: env.INVOICE_GSTIN,
            ph_gst_percent: String(env.INVOICE_GST_RATE_BPS / 100),
          }}
        />
      </div>
    </AdminShell>
  );
}
