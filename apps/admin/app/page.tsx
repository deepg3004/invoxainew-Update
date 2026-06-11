import Link from "next/link";
import { Card } from "@invoxai/ui";
import { listPlans, listPricingSettings } from "@invoxai/db";
import { requireAdmin } from "../lib/auth";
import { AdminShell } from "./components/AdminShell";
import { NotAuthorized } from "./components/NotAuthorized";

// Reads live DB state, so it must be dynamic.
export const dynamic = "force-dynamic";

export default async function Home() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const [plans, settings] = await Promise.all([
    listPlans(),
    listPricingSettings(),
  ]);
  const activePlans = plans.filter((p) => p.isActive).length;

  return (
    <AdminShell email={gate.user.email}>
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · admin
      </p>
      <h1 className="mt-1 text-3xl font-bold">Platform dashboard</h1>
      <p className="mt-2 text-neutral-500">
        Define subscription plans and platform pricing. Every price, limit, and
        commission here is the single source of truth used across the platform.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card title="Plans">
          <p className="text-sm">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · {activePlans}{" "}
            active
          </p>
          <Link
            href="/plans"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Manage plans →
          </Link>
        </Card>
        <Card title="Pricing settings">
          <p className="text-sm">
            {settings.length} setting{settings.length === 1 ? "" : "s"}
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Manage pricing →
          </Link>
        </Card>
      </div>
    </AdminShell>
  );
}
