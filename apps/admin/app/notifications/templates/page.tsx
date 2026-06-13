import { PageHeader } from "@invoxai/ui";
import { listNotificationTemplates } from "@invoxai/db";
import { NOTIFICATION_EVENTS } from "@invoxai/utils/notifications";
import { requireAdmin } from "../../../lib/auth";
import { AdminShell } from "../../components/AdminShell";
import { NotAuthorized } from "../../components/NotAuthorized";
import { TemplatesEditor, type EditorEvent } from "./TemplatesEditor";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const overrides = await listNotificationTemplates();
  const events: EditorEvent[] = NOTIFICATION_EVENTS.filter((e) => e.channel === "email").map(
    (e) => {
      const o = overrides.find((t) => t.eventKey === e.key && t.channel === "email");
      return {
        key: e.key,
        label: e.label,
        description: e.description,
        audience: e.audience,
        variables: e.variables,
        subject: o?.subject ?? e.defaultSubject,
        body: o?.body ?? e.defaultBody,
        customized: !!o,
      };
    },
  );

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Email templates"
        description="Customize the subject and message for each notification email. Insert order details with {{variables}}; the layout (logo, totals, button) stays consistent automatically. Leave a template unchanged to use the default."
      />
      <div className="mt-6 max-w-3xl">
        <TemplatesEditor events={events} />
      </div>
    </AdminShell>
  );
}
