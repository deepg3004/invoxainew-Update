import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@invoxai/ui";
import { getTenantByOwnerId } from "@invoxai/db";
import { getSessionUser } from "../lib/auth";

export const dynamic = "force-dynamic";

function publicSiteUrl(username: string): string {
  // Dev: the tenant app serves username.localhost:3003. Prod: the real domain.
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tenant = await getTenantByOwnerId(user.id);
  if (!tenant) redirect("/onboarding");

  const siteUrl = publicSiteUrl(tenant.username);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            InvoxAI · dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {tenant.name ?? "Your site"}
          </h1>
          <p className="mt-1 text-neutral-500">Signed in as {user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card title="Your address is live">
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-medium text-blue-600 underline"
          >
            {tenant.username}.invoxai.io
          </a>
          <p className="mt-2 text-sm text-neutral-500">
            This resolves to your public buyer-facing site (host-based tenant
            resolution). Building it out comes in later steps.
          </p>
        </Card>
        <Card title="Plan & billing">
          <p className="text-sm text-neutral-500">
            Choose a subscription to raise your limits and lower commission.
          </p>
          <Link
            href="/billing"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Manage billing →
          </Link>
        </Card>
        <Card title="Wallet">
          <p className="text-sm text-neutral-500">
            Prepaid balance for InvoxAI fees (commission, AI pages, add-ons).
          </p>
          <Link
            href="/wallet"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Open wallet →
          </Link>
        </Card>
        <Card title="Payment gateway">
          <p className="text-sm text-neutral-500">
            Connect your own Razorpay so buyers pay you directly.
          </p>
          <Link
            href="/gateway"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Connect gateway →
          </Link>
        </Card>
        <Card title="Payment pages">
          <p className="text-sm text-neutral-500">
            Create shareable links buyers can pay you through.
          </p>
          <Link
            href="/pay-pages"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Manage pages →
          </Link>
        </Card>
        <Card title="AI landing pages">
          <p className="text-sm text-neutral-500">
            Let AI write and publish a landing page from a short brief.
          </p>
          <Link
            href="/ai-pages"
            className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
          >
            Generate a page →
          </Link>
        </Card>
      </div>
    </main>
  );
}
