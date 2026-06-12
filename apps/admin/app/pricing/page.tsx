import { GlassCard, PageHeader } from "@invoxai/ui";
import { listPricingSettings } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { PricingRow, NewSettingForm } from "./PricingForms";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const settings = await listPricingSettings();

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Pricing settings"
        description="Global platform fees (e.g. the AI-page fee). All values are in rupees."
      />

      <GlassCard className="overflow-hidden p-0">
        {settings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No settings yet. Add one below.
          </p>
        ) : (
          settings.map((s) => (
            <PricingRow
              key={s.key}
              settingKey={s.key}
              label={s.label}
              valuePaise={s.valuePaise}
            />
          ))
        )}
      </GlassCard>

      <div className="mt-8">
        <GlassCard title="Add a setting">
          <NewSettingForm />
        </GlassCard>
      </div>
    </AdminShell>
  );
}
