import { Card, HealthBadge } from "@invoxai/ui";
import { checkHealth } from "./lib/health";

// This status page reads live DB/Redis state, so it must be dynamic.
export const dynamic = "force-dynamic";

const APP_NAME = "tenant";
const APP_DOMAIN = "username.invoxai.io (public tenant pages)";

export default async function Home() {
  const health = await checkHealth();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · {APP_NAME}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{APP_DOMAIN}</h1>
      <p className="mt-2 text-neutral-500">
        C1 Foundation — this app boots and its dependencies are wired.
      </p>

      <div className="mt-8">
        <Card title="Health">
          <div className="flex flex-wrap gap-2">
            <HealthBadge ok={health.checks.db.ok} label="db" />
            <HealthBadge ok={health.checks.redis.ok} label="redis" />
          </div>
          <p className="mt-4 text-sm">
            Raw probe:{" "}
            <a className="text-blue-600 underline" href="/health">
              /health
            </a>
          </p>
        </Card>
      </div>
    </main>
  );
}
